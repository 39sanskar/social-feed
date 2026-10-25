import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { AppError } from './error.js';

/** The token carries the user's tokenVersion ("tv"). Changing the password or
 *  "log out everywhere" bumps it in the DB, which instantly kills old tokens. */
export const signToken = (user) => jwt.sign({ id: user._id, tv: user.tokenVersion }, config.jwtSecret, { expiresIn: '7d' });

export async function userFromToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  const user = await User.findById(payload.id);
  if (!user || user.tokenVersion !== payload.tv) throw new Error('stale token');
  return user;
}

/** Required on every protected route. Sets req.user. */
export const auth = async (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new AppError(401, 'Please log in');
  try {
    req.user = await userFromToken(token);
  } catch {
    throw new AppError(401, 'Session expired, please log in again');
  }
  if (!req.user.active) throw new AppError(401, 'This account is deactivated');
  next();
};

/** Optional gate for write actions when REQUIRE_VERIFIED_EMAIL=true. */
export const requireVerified = (req, _res, next) => {
  if (config.requireVerifiedEmail && !req.user.emailVerified) throw new AppError(403, 'Please verify your e-mail address first');
  next();
};
