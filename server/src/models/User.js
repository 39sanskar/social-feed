import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { ObjectId } = mongoose.Schema.Types;

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_]{3,20}$/ },
    displayName: { type: String, trim: true, maxlength: 50, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // bcrypt hash, never returned by default
    bio: { type: String, default: '', maxlength: 160 },
    location: { type: String, default: '', maxlength: 40 },
    website: { type: String, default: '', maxlength: 100 },
    avatar: { type: String, default: '' },
    cover: { type: String, default: '' },
    verifiedBadge: { type: Boolean, default: false }, // set manually by an admin after identity checks

    // denormalised counters (updated atomically with $inc) so profiles don't need COUNT queries
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    pinnedPost: { type: ObjectId, ref: 'Post', default: null },

    // safety lists
    blocked: [{ type: ObjectId, ref: 'User' }],
    muted: [{ type: ObjectId, ref: 'User' }],
    mutedWords: [{ type: String, maxlength: 40 }],

    settings: {
      allowDMsFrom: { type: String, enum: ['everyone', 'following'], default: 'everyone' },
      notifications: {
        like: { type: Boolean, default: true },
        reply: { type: Boolean, default: true },
        repost: { type: Boolean, default: true },
        follow: { type: Boolean, default: true },
        mention: { type: Boolean, default: true },
      },
    },

    // account state & security
    active: { type: Boolean, default: true }, // false = deactivated (hidden); logging in reactivates
    emailVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, select: false },
    verifyExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0 }, // bump to invalidate every issued JWT
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ displayName: 1 });
userSchema.index({ followersCount: -1 });

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Whatever leaves the API through toJSON never contains secrets.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    for (const k of ['password', 'verifyTokenHash', 'verifyExpires', 'resetTokenHash', 'resetExpires', 'failedLogins', 'lockUntil', 'tokenVersion', '__v'])
      delete ret[k];
    return ret;
  },
});

export default mongoose.model('User', userSchema);
