import { Router } from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { Like, Bookmark, Follow } from '../models/edges.js';
import { auth, requireVerified } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { upload } from '../middleware/upload.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { postLimiter } from '../middleware/rateLimit.js';
import { saveMedia } from '../services/storage.js';
import { assertNotBlocked } from '../services/access.js';
import { notify } from '../services/notify.js';
import { timeline, edgeTimeline, present, postPopulate, PAGE } from '../services/feed.js';
import { toggle } from '../utils/toggle.js';
import { extractHashtags, extractMentions } from '../utils/text.js';
import { feedScore } from '../utils/ranking.js';
import { createPostSchema, editPostSchema } from '../validators.js';

const router = Router();
router.param('id', objectIdParam);
router.param('userId', objectIdParam);

const EDIT_WINDOW_MS = 60 * 60 * 1000; // posts can be edited for 60 minutes
const NOT_REPOST = { kind: { $ne: 'repost' } };

/** Loads a post the viewer is allowed to interact with (exists, not a bare repost, not blocked). */
async function loadInteractable(req) {
  const post = await Post.findById(req.params.id);
  if (!post || post.kind === 'repost') throw new AppError(404, 'Post not found');
  await assertNotBlocked(req.user, post.author);
  return post;
}
const populateOne = async (post, viewer) => {
  const doc = await Post.findById(post._id).populate(postPopulate).lean();
  return (await present([doc], viewer))[0];
};

// ───────────── CREATE ─────────────
router.post('/', auth, requireVerified, postLimiter, upload.array('media', 4), validate(createPostSchema), async (req, res) => {
  const { text, parent, quoteOf, sensitive } = req.body;
  if (parent && quoteOf) throw new AppError(400, 'A post cannot be both a reply and a quote');

  let kind = 'post';
  let parentPost;
  let quoted;
  if (parent) {
    parentPost = await Post.findById(parent);
    if (!parentPost || parentPost.kind === 'repost') throw new AppError(404, 'The post you are replying to no longer exists');
    await assertNotBlocked(req.user, parentPost.author);
    kind = 'reply';
  } else if (quoteOf) {
    quoted = await Post.findById(quoteOf);
    if (!quoted || quoted.kind === 'repost') throw new AppError(404, 'The post you are quoting no longer exists');
    await assertNotBlocked(req.user, quoted.author);
    kind = 'quote';
  }

  const media = await saveMedia(req.files || [], 'social-feed/posts');
  if (!text && !media.length) throw new AppError(400, 'Write something or add a photo/video');

  // @mentions → real users (unknown names are simply ignored)
  const names = extractMentions(text);
  const mentioned = names.length ? await User.find({ username: { $in: names }, active: true }).select('_id') : [];

  const post = await Post.create({
    author: req.user._id, kind, text, media, sensitive,
    hashtags: extractHashtags(text),
    mentions: mentioned.map((u) => u._id),
    parent: parentPost?._id,
    quoteOf: quoted?._id,
  });

  if (parentPost) await Post.updateOne({ _id: parentPost._id }, { $inc: { repliesCount: 1 } });
  if (quoted) await Post.updateOne({ _id: quoted._id }, { $inc: { quotesCount: 1 } });

  // notifications: reply/quote → the original author; @mentions → mentioned users (once each)
  const told = new Set();
  const tell = async (recipient, type) => {
    if (told.has(String(recipient))) return;
    told.add(String(recipient));
    await notify(req, { recipient, type, post: post._id });
  };
  if (parentPost) await tell(parentPost.author, 'reply');
  if (quoted) await tell(quoted.author, 'quote');
  for (const u of mentioned) await tell(u._id, 'mention');

  res.status(201).json(await populateOne(post, req.user));
});

// ───────────── READ: feeds ─────────────
// mode=latest → chronological Following feed
// mode=top    → "For you": ranked by feedScore() (engagement ÷ age) over recent
//               posts from people you follow + popular posts from everyone
router.get('/feed', auth, async (req, res) => {
  const following = await Follow.find({ follower: req.user._id }).distinct('following');
  const authors = [...following, req.user._id];

  if (req.query.mode !== 'top') {
    // latest: reposts of followed people are included, replies are not
    return res.json(await timeline({ author: { $in: authors }, kind: { $in: ['post', 'quote', 'repost'] } }, req.user, req.query.cursor));
  }

  const day = new Date(Date.now() - 24 * 36e5);
  const candidates = await Post.find({
    kind: { $in: ['post', 'quote'] },
    $or: [{ author: { $in: authors }, createdAt: { $gte: new Date(Date.now() - 72 * 36e5) } }, { createdAt: { $gte: day }, likesCount: { $gte: 2 } }],
  }).sort({ _id: -1 }).limit(200).populate(postPopulate).lean();

  const hidden = new Set([...req.user.blocked, ...req.user.muted].map(String));
  const ranked = candidates.filter((p) => !hidden.has(String(p.author?._id))).sort((a, b) => feedScore(b) - feedScore(a));
  const offset = Math.max(0, parseInt(req.query.cursor) || 0); // for ranked mode the cursor is an offset
  const slice = ranked.slice(offset, offset + PAGE);
  res.json({ items: await present(slice, req.user), nextCursor: offset + PAGE < ranked.length ? String(offset + PAGE) : null });
});

router.get('/explore', auth, async (req, res) => {
  res.json(await timeline({ kind: { $in: ['post', 'quote'] } }, req.user, req.query.cursor));
});

router.get('/tag/:tag', auth, async (req, res) => {
  const tag = String(req.params.tag).toLowerCase().replace(/[^a-z0-9_]/g, '');
  res.json(await timeline({ hashtags: tag, ...NOT_REPOST }, req.user, req.query.cursor));
});

// Profile tabs: posts | replies | media | likes
router.get('/user/:userId', auth, async (req, res) => {
  const { userId } = req.params;
  const { tab = 'posts', cursor } = req.query;
  if (tab === 'likes') {
    // likes are private: you only ever see your own
    if (String(userId) !== String(req.user._id)) return res.json({ items: [], nextCursor: null });
    return res.json(await edgeTimeline(Like, { user: userId }, req.user, cursor));
  }

  const filter = { author: userId };
  if (tab === 'replies') filter.kind = 'reply';
  else if (tab === 'media') Object.assign(filter, { kind: { $ne: 'repost' }, 'media.0': { $exists: true } });
  else filter.kind = { $ne: 'reply' };

  const page = await timeline(filter, req.user, cursor, { hide: false });
  // pinned post goes first on the first page of the main tab
  if (tab === 'posts' && !cursor) {
    const owner = await User.findById(userId).select('pinnedPost');
    if (owner?.pinnedPost) {
      const pinned = await Post.findById(owner.pinnedPost).populate(postPopulate).lean();
      if (pinned) {
        const [item] = await present([pinned], req.user);
        if (item) page.items = [{ ...item, pinned: true }, ...page.items.filter((p) => String(p._id) !== String(pinned._id))];
      }
    }
  }
  res.json(page);
});

// A single post with the chain of posts it replies to (the conversation above it)
router.get('/:id', auth, async (req, res) => {
  const post = await Post.findById(req.params.id).populate(postPopulate).lean();
  if (!post || post.kind === 'repost') throw new AppError(404, 'This post does not exist');
  const chain = [];
  let cursor = post;
  while (cursor?.parent && chain.length < 10) {
    cursor = await Post.findById(cursor.parent._id || cursor.parent).populate(postPopulate).lean();
    if (cursor) chain.unshift(cursor);
  }
  const [item] = await present([post], req.user);
  res.json({ post: item, ancestors: await present(chain, req.user) });
});

router.get('/:id/replies', auth, async (req, res) => {
  res.json(await timeline({ parent: req.params.id }, req.user, req.query.cursor, { asc: true }));
});

// ───────────── UPDATE (owner, within 60 min) ─────────────
router.put('/:id', auth, validate(editPostSchema), async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.kind === 'repost') throw new AppError(404, 'Post not found');
  if (!post.author.equals(req.user._id)) throw new AppError(403, 'You can only edit your own posts'); // ownership check (prevents IDOR)
  if (Date.now() - post.createdAt.getTime() > EDIT_WINDOW_MS) throw new AppError(403, 'Posts can only be edited within 60 minutes');
  post.text = req.body.text;
  post.hashtags = extractHashtags(req.body.text);
  if (req.body.sensitive !== undefined) post.sensitive = req.body.sensitive;
  post.editedAt = new Date();
  await post.save();
  res.json(await populateOne(post, req.user));
});

// ───────────── DELETE (owner) ─────────────
router.delete('/:id', auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new AppError(404, 'Post not found');
  if (!post.author.equals(req.user._id)) throw new AppError(403, 'You can only delete your own posts');

  // keep other posts' counters consistent
  if (post.kind === 'reply' && post.parent) await Post.updateOne({ _id: post.parent }, { $inc: { repliesCount: -1 } });
  if (post.kind === 'repost') await Post.updateOne({ _id: post.repostOf }, { $inc: { repostsCount: -1 } });
  if (post.kind === 'quote' && post.quoteOf) await Post.updateOne({ _id: post.quoteOf }, { $inc: { quotesCount: -1 } });

  await Promise.all([
    Post.deleteMany({ kind: 'repost', repostOf: post._id }),
    Like.deleteMany({ post: post._id }),
    Bookmark.deleteMany({ post: post._id }),
    User.updateOne({ _id: req.user._id, pinnedPost: post._id }, { $unset: { pinnedPost: 1 } }),
    post.deleteOne(),
  ]);
  res.json({ ok: true });
});

// ───────────── ENGAGEMENT toggles ─────────────
router.post('/:id/like', auth, async (req, res) => {
  const post = await loadInteractable(req);
  const liked = await toggle({
    create: () => Like.create({ user: req.user._id, post: post._id }),
    remove: () => Like.deleteOne({ user: req.user._id, post: post._id }),
    inc: (n) => Post.updateOne({ _id: post._id }, { $inc: { likesCount: n } }),
  });
  if (liked) await notify(req, { recipient: post.author, type: 'like', post: post._id });
  res.json({ liked, likesCount: (await Post.findById(post._id).select('likesCount')).likesCount });
});

router.post('/:id/repost', auth, requireVerified, async (req, res) => {
  const post = await loadInteractable(req);
  const reposted = await toggle({
    create: () => Post.create({ author: req.user._id, kind: 'repost', repostOf: post._id }), // unique partial index blocks duplicates
    remove: () => Post.deleteOne({ author: req.user._id, kind: 'repost', repostOf: post._id }),
    inc: (n) => Post.updateOne({ _id: post._id }, { $inc: { repostsCount: n } }),
  });
  if (reposted) await notify(req, { recipient: post.author, type: 'repost', post: post._id });
  res.json({ reposted, repostsCount: (await Post.findById(post._id).select('repostsCount')).repostsCount });
});

router.post('/:id/bookmark', auth, async (req, res) => {
  const post = await loadInteractable(req);
  const bookmarked = await toggle({
    create: () => Bookmark.create({ user: req.user._id, post: post._id }),
    remove: () => Bookmark.deleteOne({ user: req.user._id, post: post._id }),
  });
  res.json({ bookmarked });
});

router.post('/:id/pin', auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post || !post.author.equals(req.user._id) || !['post', 'quote'].includes(post.kind)) throw new AppError(403, 'You can only pin your own posts');
  const pinned = String(req.user.pinnedPost) !== String(post._id);
  await User.updateOne({ _id: req.user._id }, pinned ? { pinnedPost: post._id } : { $unset: { pinnedPost: 1 } });
  res.json({ pinned });
});

export default router;
