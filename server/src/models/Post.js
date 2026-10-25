import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

/**
 * One collection for every kind of post:
 *  post   – a normal top-level post
 *  reply  – answers another post (`parent`)
 *  quote  – own text + embeds another post (`quoteOf`)
 *  repost – pure share of another post (`repostOf`), has no text
 */
const postSchema = new mongoose.Schema(
  {
    author: { type: ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['post', 'reply', 'quote', 'repost'], default: 'post' },
    text: { type: String, default: '', maxlength: 500 },
    media: [{ _id: false, url: String, type: { type: String, enum: ['image', 'video'] } }],
    hashtags: [{ type: String }],
    mentions: [{ type: ObjectId, ref: 'User' }],
    sensitive: { type: Boolean, default: false }, // content warning: media is blurred until clicked

    parent: { type: ObjectId, ref: 'Post' },
    repostOf: { type: ObjectId, ref: 'Post' },
    quoteOf: { type: ObjectId, ref: 'Post' },

    likesCount: { type: Number, default: 0 },
    repostsCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    quotesCount: { type: Number, default: 0 },
    editedAt: Date,
  },
  { timestamps: true }
);

// Indexes that back the main queries (profile, tag page, threads, search).
postSchema.index({ author: 1, _id: -1 });
postSchema.index({ hashtags: 1, _id: -1 });
postSchema.index({ parent: 1, _id: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ text: 'text' });
// A user can repost a given post only once – enforced by the database itself,
// so double-clicks and race conditions can't create duplicates.
postSchema.index({ author: 1, repostOf: 1 }, { unique: true, partialFilterExpression: { kind: 'repost' } });

export default mongoose.model('Post', postSchema);
