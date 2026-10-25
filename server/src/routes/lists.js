import { Router } from 'express';
import { List } from '../models/misc.js';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validate, objectIdParam } from '../middleware/validate.js';
import { timeline } from '../services/feed.js';
import { listSchema, memberSchema } from '../validators.js';
import { withFollowState } from '../services/access.js';
import { PUBLIC } from './users.js';

const router = Router();
router.param('id', objectIdParam);
router.param('userId', objectIdParam);

// Lists are private to their owner, so every lookup is scoped by owner.
const mine = async (req) => {
  const list = await List.findOne({ _id: req.params.id, owner: req.user._id });
  if (!list) throw new AppError(404, 'List not found');
  return list;
};

router.get('/', auth, async (req, res) => res.json(await List.find({ owner: req.user._id }).sort('-updatedAt').limit(50)));

router.post('/', auth, validate(listSchema), async (req, res) => {
  if ((await List.countDocuments({ owner: req.user._id })) >= 20) throw new AppError(400, 'You can have up to 20 lists');
  res.status(201).json(await List.create({ ...req.body, owner: req.user._id }));
});

router.get('/:id', auth, async (req, res) => {
  const list = await mine(req);
  const members = await User.find({ _id: { $in: list.members }, active: true }).select(PUBLIC);
  res.json({ ...list.toObject(), members: await withFollowState(members, req.user) });
});

router.put('/:id', auth, validate(listSchema), async (req, res) => {
  const list = await mine(req);
  Object.assign(list, req.body);
  await list.save();
  res.json(list);
});

router.delete('/:id', auth, async (req, res) => {
  await (await mine(req)).deleteOne();
  res.json({ ok: true });
});

router.post('/:id/members', auth, validate(memberSchema), async (req, res) => {
  const list = await mine(req);
  if (list.members.length >= 100) throw new AppError(400, 'A list can have up to 100 accounts');
  if (!(await User.exists({ _id: req.body.userId, active: true }))) throw new AppError(404, 'User not found');
  await List.updateOne({ _id: list._id }, { $addToSet: { members: req.body.userId } });
  res.json({ ok: true });
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  const list = await mine(req);
  await List.updateOne({ _id: list._id }, { $pull: { members: req.params.userId } });
  res.json({ ok: true });
});

// Curated timeline: only posts from the accounts on this list
router.get('/:id/timeline', auth, async (req, res) => {
  const list = await mine(req);
  res.json(await timeline({ author: { $in: list.members }, kind: { $in: ['post', 'quote', 'repost'] } }, req.user, req.query.cursor));
});

export default router;
