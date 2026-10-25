// Realtime layer. All *writes* (sending messages, posting…) go through the
// authenticated REST API, which then pushes events here. Sockets themselves
// only handle presence + typing, and every event is authorised on the server.
import mongoose from 'mongoose';
import { userFromToken } from './middleware/auth.js';
import { Conversation } from './models/Chat.js';

const online = new Map(); // userId -> number of open tabs/devices

export default function initSocket(io) {
  // 1) Authenticate the connection with the same JWT the REST API uses
  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(socket.handshake.auth?.token);
      if (!user.active) throw new Error('inactive');
      socket.userId = String(user._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const uid = socket.userId;
    socket.join(`user:${uid}`); // personal room: messages, notifications, typing arrive here
    online.set(uid, (online.get(uid) || 0) + 1);

    // Presence is only shared with people you actually chat with (privacy + scalability)
    const peers = (await Conversation.find({ members: uid }).distinct('members')).map(String).filter((id) => id !== uid);
    socket.emit('presence:list', peers.filter((id) => online.has(id)));
    if (online.get(uid) === 1) for (const p of peers) io.to(`user:${p}`).emit('presence:update', { userId: uid, online: true });

    // 2) Typing indicator: only forwarded to members of that conversation
    let lastTyping = 0;
    socket.on('typing', async ({ conversationId, typing } = {}) => {
      if (!mongoose.isValidObjectId(conversationId)) return;
      if (typing && Date.now() - lastTyping < 800) return; // light throttle against spam
      lastTyping = Date.now();
      const convo = await Conversation.findOne({ _id: conversationId, members: uid }).select('members');
      if (!convo) return; // not a member → ignore silently
      for (const m of convo.members) if (String(m) !== uid) io.to(`user:${m}`).emit('typing', { conversationId, userId: uid, typing: !!typing });
    });

    socket.on('disconnect', () => {
      const n = (online.get(uid) || 1) - 1;
      if (n > 0) return online.set(uid, n);
      online.delete(uid);
      for (const p of peers) io.to(`user:${p}`).emit('presence:update', { userId: uid, online: false });
    });
  });
}
