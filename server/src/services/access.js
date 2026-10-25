import User from '../models/User.js';
import { Follow } from '../models/edges.js';
import { AppError } from '../middleware/error.js';

/** Blocking works both ways: neither side may interact with the other. */
export async function assertNotBlocked(viewer, targetId) {
  if (String(viewer._id) === String(targetId)) return;
  if (viewer.blocked.some((id) => id.equals(targetId))) throw new AppError(403, 'You have blocked this account');
  const target = await User.findById(targetId).select('blocked active');
  if (!target || !target.active) throw new AppError(404, 'User not found');
  if (target.blocked.some((id) => id.equals(viewer._id))) throw new AppError(403, 'You cannot interact with this account');
}

/** Direct-message permission: blocks + the recipient's "who can message me" setting. */
export async function assertCanMessage(viewer, targetId) {
  await assertNotBlocked(viewer, targetId);
  const target = await User.findById(targetId).select('settings');
  if (target.settings?.allowDMsFrom === 'following') {
    const follows = await Follow.exists({ follower: targetId, following: viewer._id });
    if (!follows) throw new AppError(403, 'This person only accepts messages from people they follow');
  }
}

/** Adds `viewer: { following, isMe }` to a list of users so the UI can render the right Follow button. */
export async function withFollowState(users, viewer) {
  const followed = new Set(
    (await Follow.find({ follower: viewer._id, following: { $in: users.map((u) => u._id) } }).distinct('following')).map(String)
  );
  return users.map((u) => ({
    ...(u.toObject ? u.toObject() : u),
    viewer: { following: followed.has(String(u._id)), isMe: String(u._id) === String(viewer._id) },
  }));
}
