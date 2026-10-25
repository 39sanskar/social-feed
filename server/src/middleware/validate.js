import mongoose from 'mongoose';
import { AppError } from './error.js';

/** validate(zodSchema) → replaces req.body with the parsed + cleaned data.
 *  Unknown fields are dropped (zod objects strip them), types are enforced. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  req[source] = schema.parse(req[source] ?? {});
  next();
};

/** router.param('id', objectIdParam): rejects malformed ids before any query runs. */
export const objectIdParam = (_req, _res, next, value) => {
  if (!mongoose.isValidObjectId(value) || String(value).length !== 24) return next(new AppError(400, 'Invalid id'));
  next();
};
