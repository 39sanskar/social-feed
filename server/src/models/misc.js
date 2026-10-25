import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

/** A user-curated group of accounts with its own timeline. Lists are private to their owner. */
export const List = mongoose.model(
  'List',
  new mongoose.Schema(
    {
      owner: { type: ObjectId, ref: 'User', required: true, index: true },
      name: { type: String, required: true, trim: true, maxlength: 50 },
      description: { type: String, default: '', maxlength: 160 },
      members: [{ type: ObjectId, ref: 'User' }],
    },
    { timestamps: true }
  )
);

/** Reports are stored for moderators to review (there is no admin UI yet). */
export const Report = mongoose.model(
  'Report',
  new mongoose.Schema(
    {
      reporter: { type: ObjectId, ref: 'User', required: true },
      targetType: { type: String, enum: ['post', 'user', 'message'], required: true },
      target: { type: ObjectId, required: true },
      reason: { type: String, enum: ['spam', 'abuse', 'harassment', 'violence', 'sensitive', 'other'], required: true },
      details: { type: String, default: '', maxlength: 500 },
      status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open' },
    },
    { timestamps: true }
  )
);
