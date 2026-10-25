import { Router } from 'express';
import { Bookmark } from '../models/edges.js';
import { auth } from '../middleware/auth.js';
import { edgeTimeline } from '../services/feed.js';

const router = Router();
// Bookmarks are private: the query is always scoped to the logged-in user.
router.get('/', auth, async (req, res) => res.json(await edgeTimeline(Bookmark, { user: req.user._id }, req.user, req.query.cursor)));
export default router;
