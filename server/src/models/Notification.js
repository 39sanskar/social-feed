import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    recipient: { type: ObjectId, ref: 'User', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'reply', 'repost', 'quote', 'follow', 'mention'], required: true },
    post: { type: ObjectId, ref: 'Post' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
schema.index({ recipient: 1, _id: -1 });
schema.index({ recipient: 1, read: 1 });
export default mongoose.model('Notification', schema);
