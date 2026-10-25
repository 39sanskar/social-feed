import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import 'express-async-errors'; // lets async route handlers throw errors to the central handler
import { config } from './config/env.js';
import { sanitize } from './middleware/sanitize.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './services/storage.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import bookmarkRoutes from './routes/bookmarks.js';
import listRoutes from './routes/lists.js';
import searchRoutes from './routes/search.js';
import notificationRoutes from './routes/notifications.js';
import conversationRoutes from './routes/conversations.js';
import reportRoutes from './routes/reports.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render's proxy: real client IPs for rate limiting
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // secure headers (images are loaded from another origin)
  app.use(cors({ origin: config.clientUrls })); // explicit allow-list, never "*"
  app.use(compression());
  app.use(express.json({ limit: '100kb' })); // request size limit
  app.use(sanitize); // strips Mongo operators ($ne, $gt…) from client input
  app.use(morgan(config.isProd ? 'combined' : 'dev')); // never logs bodies, so no passwords/tokens
  app.use('/api', globalLimiter);

  // local-disk uploads (development fallback). nosniff + CSP stop browsers from ever executing them.
  app.use('/uploads', express.static(UPLOAD_DIR, {
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
  }));

  app.get('/', (_req, res) => res.json({ name: 'Social-Feed API', status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/bookmarks', bookmarkRoutes);
  app.use('/api/lists', listRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/reports', reportRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
