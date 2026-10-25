// Small "relationship" collections. Each has a UNIQUE compound index, so the
// database guarantees there are no duplicate likes / bookmarks / follows.
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const edge = (name, a, b, extra = {}) => {
  const s = new mongoose.Schema({ [a]: { type: ObjectId, required: true }, [b]: { type: ObjectId, required: true }, ...extra }, { timestamps: { createdAt: true, updatedAt: false } });
  s.index({ [a]: 1, [b]: 1 }, { unique: true });
  s.index({ [b]: 1, _id: -1 });
  return mongoose.model(name, s);
};

export const Like = edge('Like', 'user', 'post');
export const Bookmark = edge('Bookmark', 'user', 'post');
export const Follow = edge('Follow', 'follower', 'following');
