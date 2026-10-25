// Permanent account deletion: removes the user's data and repairs the counters
// other people's content depended on.
import User from '../models/User.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import { Like, Bookmark, Follow } from '../models/edges.js';
import { Conversation, Message } from '../models/Chat.js';
import { List } from '../models/misc.js';

export async function deleteAccount(userId) {
  const [likes, follows, followers, myPosts] = await Promise.all([
    Like.find({ user: userId }).distinct('post'),
    Follow.find({ follower: userId }).distinct('following'),
    Follow.find({ following: userId }).distinct('follower'),
    Post.find({ author: userId }).select('_id kind parent repostOf quoteOf'),
  ]);

  // undo this user's effect on other people's counters
  await Promise.all([
    Post.updateMany({ _id: { $in: likes } }, { $inc: { likesCount: -1 } }),
    User.updateMany({ _id: { $in: follows } }, { $inc: { followersCount: -1 } }),
    User.updateMany({ _id: { $in: followers } }, { $inc: { followingCount: -1 } }),
    ...myPosts.filter((p) => p.kind === 'reply' && p.parent).map((p) => Post.updateOne({ _id: p.parent }, { $inc: { repliesCount: -1 } })),
    ...myPosts.filter((p) => p.kind === 'repost').map((p) => Post.updateOne({ _id: p.repostOf }, { $inc: { repostsCount: -1 } })),
    ...myPosts.filter((p) => p.kind === 'quote' && p.quoteOf).map((p) => Post.updateOne({ _id: p.quoteOf }, { $inc: { quotesCount: -1 } })),
  ]);

  const postIds = myPosts.map((p) => p._id);
  await Promise.all([
    Post.deleteMany({ $or: [{ author: userId }, { kind: 'repost', repostOf: { $in: postIds } }] }),
    Like.deleteMany({ $or: [{ user: userId }, { post: { $in: postIds } }] }),
    Bookmark.deleteMany({ $or: [{ user: userId }, { post: { $in: postIds } }] }),
    Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] }),
    List.deleteMany({ owner: userId }),
    List.updateMany({}, { $pull: { members: userId } }),
    Conversation.updateMany({ isGroup: true }, { $pull: { members: userId } }),
    Message.deleteMany({ sender: userId }),
  ]);
  // direct chats with a deleted user are meaningless – remove them
  await Conversation.deleteMany({ isGroup: false, members: userId });
  await User.deleteOne({ _id: userId });
}
