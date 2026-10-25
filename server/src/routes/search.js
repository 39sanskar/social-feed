import { Router } from 'express';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { timeline } from '../services/feed.js';
import { withFollowState } from '../services/access.js';
import { trendingTags } from '../services/trending.js';
import { cleanText, escapeRegex } from '../utils/text.js';
import { PUBLIC } from './users.js';

const router = Router();
const readQuery = (req) => cleanText(String(req.query.q || '')).slice(0, 100);

// Full search. type = posts (full-text) | users (prefix match) | tags (exact hashtag)
router.get('/', auth, async (req, res) => {
  const q = readQuery(req);
  const type = ['users', 'posts', 'tags'].includes(req.query.type) ? req.query.type : 'posts';
  if (!q) return res.json({ items: [], nextCursor: null });

  if (type === 'users') {
    // the user's text is escaped, so it is matched literally and can't act as a regex
    const rx = new RegExp('^' + escapeRegex(q.replace(/^@/, '')), 'i');
    const items = await User.find({ active: true, _id: { $nin: req.user.blocked }, $or: [{ username: rx }, { displayName: rx }] })
      .sort({ followersCount: -1 }).limit(20).select(PUBLIC);
    return res.json({ items: await withFollowState(items, req.user), nextCursor: null });
  }
  if (type === 'tags') {
    const tag = q.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    return res.json(await timeline({ hashtags: tag, kind: { $ne: 'repost' } }, req.user, req.query.cursor));
  }
  res.json(await timeline({ $text: { $search: q }, kind: { $in: ['post', 'quote', 'reply'] } }, req.user, req.query.cursor));
});

// Typeahead: a few matching people and trending tags
router.get('/suggest', auth, async (req, res) => {
  const q = readQuery(req).replace(/^[@#]/, '');
  if (!q) return res.json({ users: [], tags: [] });
  const rx = new RegExp('^' + escapeRegex(q), 'i');
  const [users, trending] = await Promise.all([
    User.find({ active: true, _id: { $nin: req.user.blocked }, $or: [{ username: rx }, { displayName: rx }] }).sort({ followersCount: -1 }).limit(5).select(PUBLIC),
    trendingTags(20),
  ]);
  res.json({ users, tags: trending.filter((t) => t.tag.startsWith(q.toLowerCase())).slice(0, 4) });
});

router.get('/trending', auth, async (_req, res) => res.json(await trendingTags(10)));

export default router;
