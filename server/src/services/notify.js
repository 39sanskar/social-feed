import Notification from '../models/Notification.js';
import User from '../models/User.js';

/** Stores a notification (respecting the recipient's preferences) and pushes
 *  it in real time to every open tab of the recipient via their socket room. */
export async function notify(req, { recipient, type, post }) {
  if (String(recipient) === String(req.user._id)) return; // never notify yourself
  const target = await User.findById(recipient).select('settings blocked muted active');
  if (!target?.active) return;
  const prefKey = type === 'quote' ? 'repost' : type;
  if (target.settings?.notifications?.[prefKey] === false) return;
  if (target.blocked.some((id) => id.equals(req.user._id)) || target.muted.some((id) => id.equals(req.user._id))) return;

  const n = await Notification.create({ recipient, sender: req.user._id, type, post });
  await n.populate('sender', 'username displayName avatar');
  req.app.get('io').to(`user:${recipient}`).emit('notification', n);
}
