import rateLimit from 'express-rate-limit';

const make = (windowMs, max, message, byUser = false) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // after login we throttle per account (shared offices/NATs aren't punished); before it, per IP
    keyGenerator: (req) => (byUser && req.user ? String(req.user._id) : req.ip),
    message: { message },
  });

const MIN = 60 * 1000;
export const globalLimiter = make(15 * MIN, 1500, 'Too many requests, slow down');
export const loginLimiter = make(15 * MIN, 20, 'Too many login attempts, try again in 15 minutes');
export const registerLimiter = make(60 * MIN, 10, 'Too many sign-ups from this network, try again later');
export const resetLimiter = make(60 * MIN, 6, 'Too many requests, try again in an hour');
export const postLimiter = make(10 * MIN, 40, 'You are posting too fast, take a short break', true);
export const messageLimiter = make(MIN, 60, 'You are sending messages too fast', true);
export const reportLimiter = make(60 * MIN, 30, 'Too many reports submitted', true);
