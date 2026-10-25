import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const conversationSchema = new mongoose.Schema(
  {
    members: [{ type: ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    name: { type: String, maxlength: 60, default: '' },
    createdBy: { type: ObjectId, ref: 'User' },
    // "a:b" (sorted ids) for 1-to-1 chats. The unique sparse index guarantees a
    // pair of users only ever has ONE direct conversation.
    dmKey: { type: String },
    lastMessage: { text: String, sender: ObjectId, at: Date },
    lastAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
conversationSchema.index({ members: 1, lastAt: -1 });
conversationSchema.index({ dmKey: 1 }, { unique: true, sparse: true });

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: 'Conversation', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, default: '', maxlength: 1000 },
    media: { url: String, type: { type: String, enum: ['image', 'video'] } },
    readBy: [{ type: ObjectId }], // read receipts: who has seen it (sender included)
    editedAt: Date,
    deleted: { type: Boolean, default: false }, // soft delete keeps the thread layout intact
  },
  { timestamps: true }
);
messageSchema.index({ conversation: 1, _id: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
