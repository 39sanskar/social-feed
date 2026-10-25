import { Router } from 'express';
import { Report } from '../models/misc.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportLimiter } from '../middleware/rateLimit.js';
import { reportSchema } from '../validators.js';

const router = Router();

// Stores the report for moderators. (No admin UI yet: review in the database.)
router.post('/', auth, reportLimiter, validate(reportSchema), async (req, res) => {
  await Report.create({ ...req.body, reporter: req.user._id });
  res.status(201).json({ message: 'Thanks, your report was sent to our moderators.' });
});

export default router;
