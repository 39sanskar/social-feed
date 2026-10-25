import http from 'node:http';
import { Server } from 'socket.io';
import { config } from './config/env.js';
import connectDB from './config/db.js';
import { createApp } from './app.js';
import initSocket from './socket.js';

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientUrls } });
app.set('io', io); // routes use it to push realtime events
initSocket(io);

connectDB()
  .then(() => server.listen(config.port, () => console.log(`Social-Feed API on :${config.port} (storage: ${config.storageProvider}, mail: ${config.mail.provider})`)))
  .catch((e) => { console.error('Could not connect to MongoDB:', e.message); process.exit(1); });

// Don't let one stray rejected promise kill the process silently
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
