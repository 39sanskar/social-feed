import { Router } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { auth } from '../middleware/auth.js';
import { PAGE } from '../services/feed.js';

const router = Router();

// All queries are scoped to recipient = current user, so nobody can read someone else's notifications.
router.get('/', auth, async (req, res) => {
  const q = { recipient: req.user._id };
  if (req.query.type === 'mentions') q.type = { $in: ['mention', 'reply'] };
  if (req.query.cursor && mongoose.isValidObjectId(req.query.cursor)) q._id = { $lt: req.query.cursor };
  const docs = await Notification.find(q).sort({ _id: -1 }).limit(PAGE + 1)
    .populate('sender', 'username displayName avatar').populate('post', 'text media').lean();
  const slice = docs.slice(0, PAGE);
  res.json({ items: slice, nextCursor: docs.length > PAGE ? String(slice.at(-1)._id) : null });
});

router.get('/unread-count', auth, async (req, res) =>
  res.json({ count: await Notification.countDocuments({ recipient: req.user._id, read: false }) }));

router.put('/read-all', auth, async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
});

export default router;
