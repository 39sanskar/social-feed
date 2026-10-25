import { Router } from 'express';
import mongoose from 'mongoose';
import { Conversation, Message } from '../models/Chat.js';
import User from '../models/User.js';
import { auth, requireVerified } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { upload } from '../middleware/upload.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { messageLimiter } from '../middleware/rateLimit.js';
import { saveMedia } from '../services/storage.js';
import { assertCanMessage } from '../services/access.js';
import { createConversationSchema, sendMessageSchema, editMessageSchema } from '../validators.js';

const router = Router();
router.param('id', objectIdParam);
router.param('messageId', objectIdParam);

const MEMBER = 'username displayName avatar';
const MSG_PAGE = 30;
const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Authorisation for everything in this file: you only get a conversation if you are a member of it. */
async function memberConversation(req) {
  const convo = await Conversation.findOne({ _id: req.params.id, members: req.user._id });
  if (!convo) throw new AppError(404, 'Conversation not found');
  return convo;
}

/** Push a realtime event to every member's personal socket room (all their open tabs). */
const emitTo = (req, members, event, payload) => {
  const io = req.app.get('io');
  for (const m of members) io.to(`user:${m}`).emit(event, payload);
};

// ── conversation list (with unread counts) ──
router.get('/', auth, async (req, res) => {
  const convos = await Conversation.find({ members: req.user._id }).sort({ lastAt: -1 }).limit(50).populate('members', MEMBER).lean();
  const counts = await Message.aggregate([
    { $match: { conversation: { $in: convos.map((c) => c._id) }, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deleted: false } },
    { $group: { _id: '$conversation', n: { $sum: 1 } } },
  ]);
  const unread = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(convos.map((c) => ({ ...c, unread: unread.get(String(c._id)) || 0 })));
});

router.get('/unread-count', auth, async (req, res) => {
  const ids = await Conversation.find({ members: req.user._id }).distinct('_id');
  res.json({ count: await Message.countDocuments({ conversation: { $in: ids }, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id }, deleted: false }) });
});

// ── start a chat: 1 user id = direct message, several = group ──
router.post('/', auth, requireVerified, validate(createConversationSchema), async (req, res) => {
  const others = [...new Set(req.body.userIds.filter((id) => id !== String(req.user._id)))];
  if (!others.length) throw new AppError(400, 'Choose someone to message');
  const users = await User.find({ _id: { $in: others }, active: true }).select('username');
  if (users.length !== others.length) throw new AppError(404, 'One of the people you picked no longer exists');
  for (const id of others) await assertCanMessage(req.user, id); // blocks + DM privacy setting

  if (others.length === 1) {
    const dmKey = [String(req.user._id), others[0]].sort().join(':');
    let convo = await Conversation.findOne({ dmKey });
    if (!convo) {
      try {
        convo = await Conversation.create({ members: [req.user._id, others[0]], isGroup: false, dmKey, createdBy: req.user._id });
      } catch (e) {
        if (e.code !== 11000) throw e;
        convo = await Conversation.findOne({ dmKey }); // two people started it at the same moment
      }
    }
    await convo.populate('members', MEMBER);
    return res.json(convo);
  }
  const name = req.body.name || users.map((u) => u.username).slice(0, 3).join(', ');
  const convo = await Conversation.create({ members: [req.user._id, ...others], isGroup: true, name, createdBy: req.user._id });
  await convo.populate('members', MEMBER);
  emitTo(req, convo.members.map((m) => m._id), 'conversation:new', convo);
  res.status(201).json(convo);
});

// ── editing / deleting a single message (sender only) ──
async function ownMessage(req) {
  const msg = await Message.findById(req.params.messageId);
  if (!msg || msg.deleted) throw new AppError(404, 'Message not found');
  if (!msg.sender.equals(req.user._id)) throw new AppError(403, 'You can only change your own messages');
  const convo = await Conversation.findOne({ _id: msg.conversation, members: req.user._id }).select('members');
  if (!convo) throw new AppError(403, 'You are no longer in this conversation');
  return { msg, convo };
}
router.patch('/messages/:messageId', auth, validate(editMessageSchema), async (req, res) => {
  const { msg, convo } = await ownMessage(req);
  if (Date.now() - msg.createdAt.getTime() > EDIT_WINDOW_MS) throw new AppError(403, 'Messages can only be edited within 15 minutes');
  msg.text = req.body.text;
  msg.editedAt = new Date();
  await msg.save();
  emitTo(req, convo.members, 'message:update', msg);
  res.json(msg);
});
router.delete('/messages/:messageId', auth, async (req, res) => {
  const { msg, convo } = await ownMessage(req);
  Object.assign(msg, { deleted: true, text: '', media: undefined });
  await msg.save();
  emitTo(req, convo.members, 'message:update', msg);
  res.json(msg);
});

// ── messages inside a conversation ──
router.get('/:id/messages', auth, async (req, res) => {
  await memberConversation(req);
  const q = { conversation: req.params.id };
  if (req.query.before && mongoose.isValidObjectId(req.query.before)) q._id = { $lt: req.query.before }; // older-message pagination
  const docs = await Message.find(q).sort({ _id: -1 }).limit(MSG_PAGE + 1).lean();
  const slice = docs.slice(0, MSG_PAGE).reverse(); // oldest → newest for display
  res.json({ items: slice, hasMore: docs.length > MSG_PAGE });
});

router.post('/:id/messages', auth, requireVerified, messageLimiter, upload.single('media'), validate(sendMessageSchema), async (req, res) => {
  const convo = await memberConversation(req);
  if (!convo.isGroup) await assertCanMessage(req.user, convo.members.find((m) => !m.equals(req.user._id))); // re-checked on every send: blocks apply to old chats too
  const [media] = await saveMedia(req.file ? [req.file] : [], 'social-feed/chat');
  if (!req.body.text && !media) throw new AppError(400, 'Write a message or attach a file');

  const msg = await Message.create({ conversation: convo._id, sender: req.user._id, text: req.body.text, media, readBy: [req.user._id] });
  convo.lastMessage = { text: req.body.text || (media?.type === 'video' ? 'Sent a video' : 'Sent a photo'), sender: req.user._id, at: msg.createdAt };
  convo.lastAt = msg.createdAt;
  await convo.save();
  emitTo(req, convo.members, 'message:new', msg);
  res.status(201).json(msg);
});

// ── read receipts ──
router.put('/:id/read', auth, async (req, res) => {
  const convo = await memberConversation(req);
  await Message.updateMany({ conversation: convo._id, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
  emitTo(req, convo.members, 'message:read', { conversationId: convo._id, userId: req.user._id });
  res.json({ ok: true });
});

router.delete('/:id/leave', auth, async (req, res) => {
  const convo = await memberConversation(req);
  if (!convo.isGroup) throw new AppError(400, 'You can only leave group chats');
  await Conversation.updateOne({ _id: convo._id }, { $pull: { members: req.user._id } });
  res.json({ ok: true });
});

export default router;
