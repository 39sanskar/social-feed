import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api, { API_ORIGIN } from '../api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

/**
 * Owns the session and the realtime connection:
 *  - restores the user from the saved token
 *  - opens ONE authenticated Socket.IO connection while logged in
 *  - keeps global counters (unread notifications / messages) and presence live
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [online, setOnline] = useState(new Set()); // ids of chat partners that are online
  const [unread, setUnread] = useState(0); // notifications
  const [msgUnread, setMsgUnread] = useState(0); // messages
  const [liveNotification, setLiveNotification] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  // restore session
  useEffect(() => {
    if (!localStorage.getItem('token')) return setLoading(false);
    api.get('/auth/me').then((r) => setUser(r.data)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
  }, []);

  // the axios interceptor fires this when the server says the session is invalid
  useEffect(() => {
    window.addEventListener('auth:expired', logout);
    return () => window.removeEventListener('auth:expired', logout);
  }, [logout]);

  const refreshMsgUnread = useCallback(() => api.get('/conversations/unread-count').then((r) => setMsgUnread(r.data.count)).catch(() => {}), []);

  // realtime connection
  useEffect(() => {
    if (!user?._id) return;
    const s = io(API_ORIGIN, { auth: { token: localStorage.getItem('token') } });
    s.on('presence:list', (ids) => setOnline(new Set(ids)));
    s.on('presence:update', ({ userId, online: on }) =>
      setOnline((prev) => {
        const next = new Set(prev);
        on ? next.add(userId) : next.delete(userId);
        return next;
      })
    );
    s.on('notification', (n) => {
      setUnread((c) => c + 1);
      setLiveNotification(n);
    });
    s.on('message:new', (m) => m.sender !== user._id && refreshMsgUnread());
    s.on('message:read', refreshMsgUnread);
    setSocket(s);
    api.get('/notifications/unread-count').then((r) => setUnread(r.data.count)).catch(() => {});
    refreshMsgUnread();
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user?._id, refreshMsgUnread]);

  const authenticate = ({ token, user: u }) => {
    localStorage.setItem('token', token);
    setUser(u);
  };
  const refreshUser = () => api.get('/auth/me').then((r) => setUser(r.data));

  return (
    <Ctx.Provider
      value={{ user, setUser, loading, socket, online, unread, setUnread, msgUnread, refreshMsgUnread, liveNotification, authenticate, logout, refreshUser }}
    >
      {children}
    </Ctx.Provider>
  );
}
