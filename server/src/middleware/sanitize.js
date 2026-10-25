import { deepSanitize } from '../utils/sanitize.js';

// Runs on every request before the routes. See utils/sanitize.js for why.
export const sanitize = (req, _res, next) => {
  deepSanitize(req.body);
  deepSanitize(req.query);
  deepSanitize(req.params);
  next();
};
