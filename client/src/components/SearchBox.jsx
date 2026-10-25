import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

const RECENT_KEY = 'sf-recent-searches'; // recent searches live only in this browser (privacy)
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
export const saveRecent = (q) => localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 6)));

/** Search field with typeahead: recent searches when empty, people + trending tags while typing. */
export default function SearchBox({ initial = '', autoFocus = false }) {
  const nav = useNavigate();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState({ users: [], tags: [] });
  const [recent, setRecent] = useState(readRecent);
  const ref = useRef(null);

  useEffect(() => setQ(initial), [initial]);
  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);
  // debounce: wait for the user to pause typing before hitting the API
  useEffect(() => {
    if (!q.trim()) return setSug({ users: [], tags: [] });
    const t = setTimeout(() => api.get('/search/suggest', { params: { q } }).then((r) => setSug(r.data)).catch(() => {}), 220);
    return () => clearTimeout(t);
  }, [q]);

  const go = (value, type) => {
    const term = value.trim();
    if (!term) return;
    saveRecent(term);
    setRecent(readRecent());
    setOpen(false);
    nav(`/search?q=${encodeURIComponent(term)}${type ? `&type=${type}` : ''}`);
  };

  return (
    <div className="searchbox" ref={ref}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); go(q); }}>
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search people, posts, #tags" aria-label="Search" autoFocus={autoFocus} maxLength={100} />
      </form>
      {open && (q.trim() || recent.length > 0) && (
        <div className="suggest" role="listbox">
          {!q.trim() && recent.map((r) => (
            <button key={r} role="option" onClick={() => go(r)}><Icon name="search" size={16} /> {r}</button>
          ))}
          {q.trim() && (
            <button role="option" onClick={() => go(q)}><Icon name="search" size={16} /> Search for “{q}”</button>
          )}
          {sug.tags.map((t) => <button key={t.tag} role="option" onClick={() => go('#' + t.tag, 'tags')}><strong>#{t.tag}</strong> <span className="muted">{t.posts} posts today</span></button>)}
          {sug.users.map((u) => (
            <Link key={u._id} role="option" to={`/u/${u.username}`} onClick={() => setOpen(false)}>
              <Avatar user={u} size={28} /> <span><strong>{u.displayName || u.username}</strong> <span className="muted">@{u.username}</span></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
