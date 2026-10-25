import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { auth, signToken } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, registerLimiter, resetLimiter } from '../middleware/rateLimit.js';
import { sendVerificationMail, sendResetMail } from '../services/mailer.js';
import { deleteAccount } from '../services/account.js';
import { registerSchema, loginSchema, emailSchema, tokenSchema, resetSchema, changePasswordSchema, passwordOnlySchema } from '../validators.js';

const router = Router();

// One-time tokens are random; only their SHA-256 hash is stored, so a database
// leak does not hand out working verification / reset links.
const newToken = () => crypto.randomBytes(32).toString('hex');
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const HOUR = 36e5;

// Compared against when the account doesn't exist, so "unknown user" and
// "wrong password" take equally long (prevents account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// Used by deactivate / delete: re-asks for the password before destructive actions.
async function confirmPassword(userId, password) {
  const u = await User.findById(userId).select('+password');
  if (!(await u.matchPassword(password))) throw new AppError(400, 'Password is incorrect');
  return u;
}

router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
  const { username, displayName, email, password } = req.body;
  const token = newToken();
  const user = await User.create({
    username, email, password,
    displayName: displayName || username,
    verifyTokenHash: hash(token),
    verifyExpires: new Date(Date.now() + 24 * HOUR),
  });
  await sendVerificationMail(user, token);
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { login, password } = req.body; // "login" is an e-mail OR a username
  const user = await User.findOne({ $or: [{ email: login }, { username: login }] }).select('+password +failedLogins +lockUntil');
  const wrong = new AppError(400, 'Wrong e-mail/username or password');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw wrong;
  }
  // brute-force protection per ACCOUNT (the route limiter above protects per IP)
  if (user.lockUntil && user.lockUntil > new Date()) throw new AppError(429, 'Too many failed attempts. Try again in about 15 minutes.');

  if (!(await user.matchPassword(password))) {
    const failed = (user.failedLogins || 0) + 1;
    await User.updateOne({ _id: user._id }, failed >= 5 ? { failedLogins: 0, lockUntil: new Date(Date.now() + 15 * 60 * 1000) } : { failedLogins: failed });
    throw wrong;
  }
  // success: clear the counters; logging in also reactivates a deactivated account
  await User.updateOne({ _id: user._id }, { failedLogins: 0, active: true, $unset: { lockUntil: 1 } });
  user.active = true;
  res.json({ token: signToken(user), user });
});

router.get('/me', auth, (req, res) => res.json(req.user));

// ── e-mail verification ──
router.post('/verify-email', resetLimiter, validate(tokenSchema), async (req, res) => {
  const user = await User.findOne({ verifyTokenHash: hash(req.body.token), verifyExpires: { $gt: new Date() } });
  if (!user) throw new AppError(400, 'This verification link is invalid or has expired');
  await User.updateOne({ _id: user._id }, { emailVerified: true, $unset: { verifyTokenHash: 1, verifyExpires: 1 } });
  res.json({ ok: true });
});

router.post('/resend-verification', auth, resetLimiter, async (req, res) => {
  if (req.user.emailVerified) throw new AppError(400, 'Your e-mail is already verified');
  const token = newToken();
  await User.updateOne({ _id: req.user._id }, { verifyTokenHash: hash(token), verifyExpires: new Date(Date.now() + 24 * HOUR) });
  await sendVerificationMail(req.user, token);
  res.json({ ok: true });
});

// ── password reset ──
router.post('/forgot-password', resetLimiter, validate(emailSchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const token = newToken();
    await User.updateOne({ _id: user._id }, { resetTokenHash: hash(token), resetExpires: new Date(Date.now() + HOUR) });
    await sendResetMail(user, token);
  }
  // identical answer whether or not the account exists (no account enumeration)
  res.json({ message: 'If that e-mail has an account, a reset link is on its way.' });
});

router.post('/reset-password', resetLimiter, validate(resetSchema), async (req, res) => {
  const user = await User.findOne({ resetTokenHash: hash(req.body.token), resetExpires: { $gt: new Date() } }).select('+resetTokenHash +resetExpires');
  if (!user) throw new AppError(400, 'This reset link is invalid or has expired');
  user.password = req.body.password; // hashed by the model's pre-save hook
  user.tokenVersion += 1; // signs the user out everywhere
  user.resetTokenHash = undefined;
  user.resetExpires = undefined;
  await user.save();
  res.json({ ok: true });
});

// ── account security ──
router.post('/change-password', auth, validate(changePasswordSchema), async (req, res) => {
  const user = await confirmPassword(req.user._id, req.body.current);
  user.password = req.body.password;
  user.tokenVersion += 1; // other devices are signed out, this one gets a fresh token
  await user.save();
  res.json({ token: signToken(user) });
});

router.post('/logout-all', auth, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ ok: true });
});

router.post('/deactivate', auth, validate(passwordOnlySchema), async (req, res) => {
  await confirmPassword(req.user._id, req.body.password);
  await User.updateOne({ _id: req.user._id }, { active: false, $inc: { tokenVersion: 1 } });
  res.json({ ok: true });
});

router.delete('/account', auth, validate(passwordOnlySchema), async (req, res) => {
  await confirmPassword(req.user._id, req.body.password);
  await deleteAccount(req.user._id);
  res.json({ ok: true });
});

export default router;
