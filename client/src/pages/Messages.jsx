import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { checkMedia, timeAgo } from '../utils.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import Menu from '../components/Menu.jsx';
import Modal from '../components/Modal.jsx';
import { Skeletons } from '../components/Skeleton.jsx';

// ── helpers: a conversation is either a group (has a name) or a 1-to-1 chat (named after the other person)
const peers = (c, meId) => c.members.filter((m) => m._id !== meId);
const titleOf = (c, meId) => (c.isGroup ? c.name || 'Group chat' : peers(c, meId)[0]?.displayName || peers(c, meId)[0]?.username || 'Chat');
const previewOf = (c, meId) => (c.lastMessage ? `${c.lastMessage.sender === meId ? 'You: ' : ''}${c.lastMessage.text}` : 'No messages yet');

/** "Start a chat" dialog: pick one person for a DM or several for a group. */
function NewChat({ onCreated, onClose }) {
  const ui = useUI();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(() => api.get('/search', { params: { q, type: 'users' } }).then((r) => setResults(r.data.items)), 250);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (u) => setPicked((p) => (p.some((x) => x._id === u._id) ? p.filter((x) => x._id !== u._id) : [...p, u]));
  const start = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/conversations', { userIds: picked.map((u) => u._id), name: name || undefined });
      onCreated(data);
    } catch (e) { ui.toast('error', errMsg(e)); setBusy(false); }
  };

  return (
    <div className="stack">
      <input className="input" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" autoFocus />
      {picked.length > 0 && (
        <ul className="chips picked">{picked.map((u) => <li key={u._id}>@{u.username} <button onClick={() => toggle(u)} aria-label={`Remove @${u.username}`}><Icon name="x" size={12} /></button></li>)}</ul>
      )}
      <div className="results">
        {results.map((u) => (
          <button key={u._id} className="convo" onClick={() => toggle(u)} aria-pressed={picked.some((x) => x._id === u._id)}>
            <Avatar user={u} size={36} /><span className="grow"><strong>{u.displayName || u.username}</strong><span className="muted block small">@{u.username}</span></span>
            {picked.some((x) => x._id === u._id) && <Icon name="check" />}
          </button>
        ))}
      </div>
      {picked.length > 1 && <label className="field">Group name<input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend plans" /></label>}
      <div className="row gap-s end"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!picked.length || busy} onClick={start}>{picked.length > 1 ? 'Create group' : 'Start chat'}</button></div>
    </div>
  );
}

export default function Messages() {
  const { user, socket, online, refreshMsgUnread } = useAuth();
  const ui = useUI();
  const loc = useLocation();
  const [convos, setConvos] = useState(null);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [typing, setTyping] = useState({}); // { conversationId: [userId…] }
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(null); // { id, text }
  const [newChat, setNewChat] = useState(false);
  const bottom = useRef(null);
  const typingTimer = useRef(null);
  const fileRef = useRef(null);
  const activeId = active?._id;

  const loadConvos = useCallback(() => api.get('/conversations').then((r) => { setConvos(r.data); return r.data; }), []);

  const markRead = useCallback((id) => api.put(`/conversations/${id}/read`).then(() => refreshMsgUnread()).catch(() => {}), [refreshMsgUnread]);

  const open = useCallback(async (c) => {
    setActive(c); setMsgs([]); setEditing(null); setText(''); setFile(null); setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/conversations/${c._id}/messages`);
      setMsgs(data.items); setHasMore(data.hasMore);
      markRead(c._id);
      setConvos((list) => list?.map((x) => (x._id === c._id ? { ...x, unread: 0 } : x)));
    } catch (e) { ui.toast('error', errMsg(e)); } finally { setLoadingMsgs(false); }
  }, [markRead]); // eslint-disable-line

  // first load; if we arrived from a profile's "Message" button, open (or create) that chat
  useEffect(() => {
    loadConvos().then(async () => {
      const target = loc.state?.user;
      if (!target) return;
      try {
        const { data } = await api.post('/conversations', { userIds: [target._id] });
        await loadConvos();
        open(data);
      } catch (e) { ui.toast('error', errMsg(e)); }
    });
  }, []); // eslint-disable-line

  // ── realtime events ──
  useEffect(() => {
    if (!socket) return;
    const onNew = (m) => {
      if (m.conversation === activeId) {
        setMsgs((list) => (list.some((x) => x._id === m._id) ? list : [...list, m])); // REST reply + socket push can both arrive: dedupe
        if (m.sender !== user._id) markRead(activeId);
      }
      loadConvos();
    };
    const onUpdate = (m) => setMsgs((list) => list.map((x) => (x._id === m._id ? m : x)));
    const onRead = ({ conversationId, userId }) => {
      if (conversationId === activeId) setMsgs((list) => list.map((x) => (x.readBy.includes(userId) ? x : { ...x, readBy: [...x.readBy, userId] })));
    };
    const onTyping = ({ conversationId, userId, typing: on }) =>
      setTyping((t) => ({ ...t, [conversationId]: on ? [...new Set([...(t[conversationId] || []), userId])] : (t[conversationId] || []).filter((x) => x !== userId) }));
    socket.on('message:new', onNew);
    socket.on('message:update', onUpdate);
    socket.on('message:read', onRead);
    socket.on('typing', onTyping);
    socket.on('conversation:new', loadConvos);
    return () => {
      socket.off('message:new', onNew); socket.off('message:update', onUpdate); socket.off('message:read', onRead);
      socket.off('typing', onTyping); socket.off('conversation:new', loadConvos);
    };
  }, [socket, activeId, user._id, loadConvos, markRead]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, activeId]);

  const loadOlder = async () => {
    const { data } = await api.get(`/conversations/${activeId}/messages`, { params: { before: msgs[0]._id } });
    setMsgs((list) => [...data.items, ...list]);
    setHasMore(data.hasMore);
  };

  const onType = (e) => {
    setText(e.target.value);
    if (!socket) return;
    socket.emit('typing', { conversationId: activeId, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('typing', { conversationId: activeId, typing: false }), 1500);
  };

  const send = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('text', text);
      if (file) fd.append('media', file);
      const { data } = await api.post(`/conversations/${activeId}/messages`, fd);
      setMsgs((list) => (list.some((x) => x._id === data._id) ? list : [...list, data]));
      setText(''); setFile(null);
      socket?.emit('typing', { conversationId: activeId, typing: false });
    } catch (err) { ui.toast('error', errMsg(err)); } finally { setSending(false); }
  };

  const pickFile = (f) => {
    if (!f) return;
    const bad = checkMedia(f);
    bad ? ui.toast('error', bad) : setFile(f);
    if (fileRef.current) fileRef.current.value = '';
  };

  const saveEdit = async () => {
    try { await api.patch(`/conversations/messages/${editing.id}`, { text: editing.text }); setEditing(null); }
    catch (e) { ui.toast('error', errMsg(e)); }
  };
  const del = async (m) => {
    if (!(await ui.confirm({ title: 'Delete message?', body: 'It will be removed for everyone in this chat.', confirmLabel: 'Delete', danger: true }))) return;
    try { await api.delete(`/conversations/messages/${m._id}`); } catch (e) { ui.toast('error', errMsg(e)); }
  };
  const leave = async () => {
    if (!(await ui.confirm({ title: 'Leave this group?', body: "You'll stop receiving its messages.", confirmLabel: 'Leave', danger: true }))) return;
    await api.delete(`/conversations/${activeId}/leave`);
    setActive(null); loadConvos();
  };
  const report = () => ui.report({ targetType: 'user', target: peers(active, user._id)[0]._id });

  // who is typing / online in the open chat
  const others = active ? peers(active, user._id) : [];
  const typers = others.filter((m) => (typing[activeId] || []).includes(m._id));
  const anyOnline = others.some((m) => online.has(m._id));
  const lastMineId = [...msgs].reverse().find((m) => m.sender === user._id && !m.deleted)?._id;

  return (
    <div className={`chat ${active ? 'has-active' : ''}`}>
      <section className="convo-list" aria-label="Conversations">
        <header className="page-head"><h1>Messages</h1><button className="icon-btn" onClick={() => setNewChat(true)} aria-label="New message"><Icon name="edit" /></button></header>
        {convos === null && <Skeletons n={4} row />}
        {convos?.length === 0 && <div className="state"><h2>No conversations yet</h2><button className="btn primary" onClick={() => setNewChat(true)}>Start a chat</button></div>}
        {convos?.map((c) => {
          const other = peers(c, user._id)[0];
          return (
            <button key={c._id} className={`convo ${c._id === activeId ? 'on' : ''}`} onClick={() => open(c)} aria-current={c._id === activeId}>
              {c.isGroup ? <span className="group-avatar"><Icon name="users" /></span> : <Avatar user={other} online={online.has(other?._id)} />}
              <span className="grow"><strong>{titleOf(c, user._id)}</strong><span className="muted block clip small">{previewOf(c, user._id)}</span></span>
              {c.unread > 0 && c._id !== activeId && <b className="badge" aria-label={`${c.unread} unread`}>{c.unread}</b>}
            </button>
          );
        })}
      </section>

      <section className="chat-pane" aria-label="Chat">
        {!active ? (
          <div className="state"><h2>Select a message</h2><p className="muted">Choose a conversation or start a new one.</p><button className="btn primary" onClick={() => setNewChat(true)}>New message</button></div>
        ) : (
          <>
            <header className="chat-head">
              <button className="icon-btn back-btn" onClick={() => setActive(null)} aria-label="Back to conversations"><Icon name="back" /></button>
              {active.isGroup ? <span className="group-avatar"><Icon name="users" /></span> : <Avatar user={others[0]} size={40} online={online.has(others[0]?._id)} />}
              <div className="grow">
                <strong>{titleOf(active, user._id)}</strong>
                <span className="muted block small" aria-live="polite">
                  {typers.length ? `${typers.map((t) => t.username).join(', ')} typing…` : active.isGroup ? `${active.members.length} members` : anyOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <Menu label="Chat options">
                {active.isGroup ? <button role="menuitem" className="danger" onClick={leave}><Icon name="logout" size={16} /> Leave group</button>
                  : <button role="menuitem" className="danger" onClick={report}><Icon name="flag" size={16} /> Report @{others[0]?.username}</button>}
              </Menu>
            </header>

            <div className="msgs" role="log" aria-live="polite">
              {loadingMsgs && <Skeletons n={2} row />}
              {hasMore && <button className="btn sm center-btn" onClick={loadOlder}>Load older messages</button>}
              {msgs.map((m) => {
                const mine = m.sender === user._id;
                const sender = active.members.find((x) => x._id === m.sender);
                const seen = others.length > 0 && others.every((o) => m.readBy.includes(o._id));
                return (
                  <div key={m._id} className={`msg-row ${mine ? 'mine' : ''}`}>
                    {!mine && active.isGroup && <Avatar user={sender} size={26} />}
                    <div className="msg-col">
                      {!mine && active.isGroup && <span className="muted small">@{sender?.username || 'former member'}</span>}
                      {editing?.id === m._id ? (
                        <div className="edit-box">
                          <input className="input" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} maxLength={1000} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }} aria-label="Edit message" />
                          <div className="row gap-s end"><button className="btn sm" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary sm" onClick={saveEdit}>Save</button></div>
                        </div>
                      ) : (
                        <div className="bubble-wrap">
                          <div className={`msg ${mine ? 'mine' : ''} ${m.deleted ? 'deleted' : ''}`}>
                            {m.deleted ? <em>This message was deleted</em> : (
                              <>
                                {m.media && (m.media.type === 'video' ? <video src={m.media.url} controls preload="metadata" /> : <img src={m.media.url} alt="Shared" loading="lazy" />)}
                                {m.text && <p>{m.text}</p>}
                              </>
                            )}
                          </div>
                          {mine && !m.deleted && (
                            <Menu label="Message options">
                              {m.text && <button role="menuitem" onClick={() => setEditing({ id: m._id, text: m.text })}><Icon name="edit" size={16} /> Edit</button>}
                              <button role="menuitem" className="danger" onClick={() => del(m)}><Icon name="trash" size={16} /> Delete</button>
                            </Menu>
                          )}
                        </div>
                      )}
                      <span className="msg-meta muted small">
                        {timeAgo(m.createdAt)}{m.editedAt && !m.deleted && ' · edited'}{mine && m._id === lastMineId && ` · ${seen ? 'Seen' : 'Sent'}`}
                      </span>
                    </div>
                  </div>
                );
              })}
              {typers.length > 0 && <div className="typing" aria-hidden="true"><i /><i /><i /></div>}
              <div ref={bottom} />
            </div>

            <form className="chat-form" onSubmit={send}>
              {file && <div className="attach-chip"><Icon name="image" size={16} /> {file.name} <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment"><Icon name="x" size={14} /></button></div>}
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" onChange={(e) => pickFile(e.target.files[0])} />
              <button type="button" className="icon-btn brand" onClick={() => fileRef.current?.click()} aria-label="Attach photo or video"><Icon name="image" /></button>
              <input className="input" value={text} onChange={onType} placeholder="Write a message" maxLength={1000} aria-label="Message" />
              <button className="btn primary icon-only" disabled={(!text.trim() && !file) || sending} aria-label="Send"><Icon name="send" /></button>
            </form>
          </>
        )}
      </section>

      <Modal open={newChat} onClose={() => setNewChat(false)} title="New message">
        <NewChat onClose={() => setNewChat(false)} onCreated={async (c) => { setNewChat(false); await loadConvos(); open(c); }} />
      </Modal>
    </div>
  );
}
