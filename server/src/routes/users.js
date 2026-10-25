import { Router } from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { Follow, Bookmark } from '../models/edges.js';
import { auth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { upload } from '../middleware/upload.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { saveMedia } from '../services/storage.js';
import { assertNotBlocked, withFollowState } from '../services/access.js';
import { notify } from '../services/notify.js';
import { PAGE } from '../services/feed.js';
import { toggle } from '../utils/toggle.js';
import { profileSchema, settingsSchema, mutedWordsSchema } from '../validators.js';
import mongoose from 'mongoose';

const router = Router();
router.param('id', objectIdParam);

// The only user fields other people may ever see (never e-mail, settings, tokens…).
export const PUBLIC = 'username displayName bio location website avatar cover verifiedBadge followersCount followingCount pinnedPost createdAt';

// ── discovery ──
router.get('/suggestions', auth, async (req, res) => {
  const following = await Follow.find({ follower: req.user._id }).distinct('following');
  const exclude = [req.user._id, ...following, ...req.user.blocked, ...req.user.muted];
  const users = await User.find({ _id: { $nin: exclude }, active: true }).sort({ followersCount: -1, _id: -1 }).limit(5).select(PUBLIC);
  res.json(await withFollowState(users, req.user));
});

// ── own account ──
router.put(
  '/me',
  auth,
  upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  validate(profileSchema),
  async (req, res) => {
    const { username, displayName, bio, location, website } = req.body;
    if (username !== undefined) req.user.username = username; // unique index rejects duplicates (409)
    if (displayName !== undefined) req.user.displayName = displayName || req.user.username;
    if (bio !== undefined) req.user.bio = bio;
    if (location !== undefined) req.user.location = location;
    if (website !== undefined) req.user.website = website;
    const [avatar] = await saveMedia(req.files?.avatar, 'social-feed/avatars', { imagesOnly: true });
    const [cover] = await saveMedia(req.files?.cover, 'social-feed/covers', { imagesOnly: true });
    if (avatar) req.user.avatar = avatar.url;
    if (cover) req.user.cover = cover.url;
    await req.user.save();
    res.json(req.user);
  }
);

router.put('/me/settings', auth, validate(settingsSchema), async (req, res) => {
  const { allowDMsFrom, notifications } = req.body;
  if (allowDMsFrom) req.user.settings.allowDMsFrom = allowDMsFrom;
  for (const [k, v] of Object.entries(notifications || {})) req.user.settings.notifications[k] = v;
  await req.user.save();
  res.json(req.user);
});

router.put('/me/muted-words', auth, validate(mutedWordsSchema), async (req, res) => {
  req.user.mutedWords = [...new Set(req.body.words.map((w) => w.toLowerCase()))];
  await req.user.save();
  res.json(req.user);
});

router.get('/me/blocked', auth, async (req, res) => res.json(await User.find({ _id: { $in: req.user.blocked } }).select(PUBLIC)));
router.get('/me/muted', auth, async (req, res) => res.json(await User.find({ _id: { $in: req.user.muted } }).select(PUBLIC)));

// GDPR-style data export: everything the user created, as a JSON download.
router.get('/me/export', auth, async (req, res) => {
  const [posts, bookmarks, following] = await Promise.all([
    Post.find({ author: req.user._id }).select('-__v').lean(),
    Bookmark.find({ user: req.user._id }).select('post createdAt -_id').lean(),
    Follow.find({ follower: req.user._id }).populate('following', 'username').lean(),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="social-feed-export.json"');
  res.json({ exportedAt: new Date(), profile: req.user, posts, bookmarks, following: following.map((f) => f.following?.username) });
});

// ── public profiles ──
router.get('/:username', auth, async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase(), active: true }).select(PUBLIC + ' blocked');
  if (!user) throw new AppError(404, 'User not found');
  if (user.blocked.some((id) => id.equals(req.user._id))) throw new AppError(403, `@${user.username} has blocked you`);
  const [following, followsYou] = await Promise.all([
    Follow.exists({ follower: req.user._id, following: user._id }),
    Follow.exists({ follower: user._id, following: req.user._id }),
  ]);
  const out = user.toObject();
  delete out.blocked;
  res.json({
    ...out,
    viewer: {
      following: !!following,
      followsYou: !!followsYou,
      blocked: req.user.blocked.some((id) => id.equals(user._id)),
      muted: req.user.muted.some((id) => id.equals(user._id)),
    },
  });
});

// followers / following lists, paginated on the Follow document id
const connections = (field, other) => async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase(), active: true }).select('_id');
  if (!user) throw new AppError(404, 'User not found');
  const q = { [field]: user._id };
  if (req.query.cursor && mongoose.isValidObjectId(req.query.cursor)) q._id = { $lt: req.query.cursor };
  const edges = await Follow.find(q).sort({ _id: -1 }).limit(PAGE + 1).populate(other, PUBLIC).lean();
  const slice = edges.slice(0, PAGE);
  res.json({ items: await withFollowState(slice.map((e) => e[other]).filter(Boolean), req.user), nextCursor: edges.length > PAGE ? String(slice.at(-1)._id) : null });
};
router.get('/:username/followers', auth, connections('following', 'follower'));
router.get('/:username/following', auth, connections('follower', 'following'));

// ── relationships ──
router.post('/:id/follow', auth, async (req, res) => {
  const me = req.user._id;
  const target = req.params.id;
  if (String(me) === target) throw new AppError(400, "You can't follow yourself");
  await assertNotBlocked(req.user, target);
  const following = await toggle({
    create: () => Follow.create({ follower: me, following: target }),
    remove: () => Follow.deleteOne({ follower: me, following: target }),
    inc: (n) => Promise.all([User.updateOne({ _id: target }, { $inc: { followersCount: n } }), User.updateOne({ _id: me }, { $inc: { followingCount: n } })]),
  });
  if (following) await notify(req, { recipient: target, type: 'follow' });
  res.json({ following });
});

router.post('/:id/block', auth, async (req, res) => {
  const me = req.user._id;
  const target = req.params.id;
  if (String(me) === target) throw new AppError(400, "You can't block yourself");
  if (!(await User.exists({ _id: target }))) throw new AppError(404, 'User not found');
  const already = req.user.blocked.some((id) => id.equals(target));
  if (already) {
    await User.updateOne({ _id: me }, { $pull: { blocked: target } });
  } else {
    await User.updateOne({ _id: me }, { $addToSet: { blocked: target } });
    // blocking also removes any follow relationship in both directions
    for (const [a, b] of [[me, target], [target, me]]) {
      const r = await Follow.deleteOne({ follower: a, following: b });
      if (r.deletedCount) await Promise.all([User.updateOne({ _id: b }, { $inc: { followersCount: -1 } }), User.updateOne({ _id: a }, { $inc: { followingCount: -1 } })]);
    }
  }
  res.json({ blocked: !already });
});

router.post('/:id/mute', auth, async (req, res) => {
  const target = req.params.id;
  if (String(req.user._id) === target) throw new AppError(400, "You can't mute yourself");
  if (!(await User.exists({ _id: target }))) throw new AppError(404, 'User not found');
  const already = req.user.muted.some((id) => id.equals(target));
  await User.updateOne({ _id: req.user._id }, already ? { $pull: { muted: target } } : { $addToSet: { muted: target } });
  res.json({ muted: !already });
});

export default router;
