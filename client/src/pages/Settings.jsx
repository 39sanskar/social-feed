import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';
import UserRow from '../components/UserRow.jsx';

const Row = ({ title, desc, children }) => (
  <div className="setting-row"><div className="grow"><strong>{title}</strong>{desc && <p className="muted small">{desc}</p>}</div>{children}</div>
);
const Switch = ({ checked, onChange, label }) => (
  <label className="switch"><input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} /><span /></label>
);

/** Asks for the password again before irreversible actions. */
function PasswordGate({ title, body, confirmLabel, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { await onConfirm(password); } catch (err) { setError(errMsg(err)); setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={go}>
      <p className="muted">{body}</p>
      <label className="field">Your password<input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row gap-s end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy}>{confirmLabel}</button></div>
    </form>
  );
}

function Account() {
  const { user, logout, authenticate } = useAuth();
  const ui = useUI();
  const [pw, setPw] = useState({ current: '', password: '' });
  const [gate, setGate] = useState(null); // 'deactivate' | 'delete'

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/change-password', pw);
      authenticate({ token: data.token, user }); // other devices are signed out, this one stays signed in
      setPw({ current: '', password: '' });
      ui.toast('success', 'Password changed. Other devices were signed out.');
    } catch (err) { ui.toast('error', errMsg(err)); }
  };
  const resend = async () => { try { await api.post('/auth/resend-verification'); ui.toast('success', 'Verification e-mail sent'); } catch (e) { ui.toast('error', errMsg(e)); } };
  const logoutAll = async () => { await api.post('/auth/logout-all'); logout(); };
  const exportData = async () => {
    try {
      const { data } = await api.get('/users/me/export', { responseType: 'blob' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(data), download: 'social-feed-export.json' });
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { ui.toast('error', errMsg(e)); }
  };

  return (
    <>
      <Row title="E-mail" desc={user.email}>
        {user.emailVerified ? <span className="pill ok">Verified</span> : <button className="btn sm" onClick={resend}>Send verification link</button>}
      </Row>
      <form className="stack settings-form" onSubmit={changePassword}>
        <strong>Change password</strong>
        <label className="field">Current password<input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required /></label>
        <label className="field">New password<input className="input" type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} minLength={8} autoComplete="new-password" required /></label>
        <button className="btn primary self-start">Update password</button>
      </form>
      <Row title="Sign out everywhere" desc="Ends every session on every device, including this one."><button className="btn sm" onClick={logoutAll}>Sign out all</button></Row>
      <Row title="Download your data" desc="A JSON file with your profile, posts, bookmarks and follows."><button className="btn sm" onClick={exportData}>Export</button></Row>
      <Row title="Deactivate account" desc="Hides your profile and posts. Log in again any time to bring it back."><button className="btn sm" onClick={() => setGate('deactivate')}>Deactivate</button></Row>
      <Row title="Delete account" desc="Permanently deletes your profile, posts, messages and follows. This can't be undone."><button className="btn danger sm" onClick={() => setGate('delete')}>Delete</button></Row>

      <Modal open={gate === 'deactivate'} onClose={() => setGate(null)} title="Deactivate account?">
        <PasswordGate body="Your profile and posts will be hidden until you log in again." confirmLabel="Deactivate" onClose={() => setGate(null)}
          onConfirm={async (password) => { await api.post('/auth/deactivate', { password }); logout(); }} />
      </Modal>
      <Modal open={gate === 'delete'} onClose={() => setGate(null)} title="Delete account permanently?">
        <PasswordGate body="Everything you created will be erased. Type your password to confirm." confirmLabel="Delete forever" onClose={() => setGate(null)}
          onConfirm={async (password) => { await api.delete('/auth/account', { data: { password } }); logout(); }} />
      </Modal>
    </>
  );
}

function Privacy() {
  const { user, setUser } = useAuth();
  const ui = useUI();
  const [words, setWords] = useState((user.mutedWords || []).join(', '));
  const [blocked, setBlocked] = useState(null);
  const [muted, setMuted] = useState(null);
  useEffect(() => {
    api.get('/users/me/blocked').then((r) => setBlocked(r.data));
    api.get('/users/me/muted').then((r) => setMuted(r.data));
  }, []);

  const saveDM = async (allowDMsFrom) => { setUser((await api.put('/users/me/settings', { allowDMsFrom })).data); ui.toast('success', 'Saved'); };
  const saveWords = async () => {
    const list = words.split(',').map((w) => w.trim()).filter(Boolean);
    try { setUser((await api.put('/users/me/muted-words', { words: list })).data); ui.toast('success', 'Muted words saved'); } catch (e) { ui.toast('error', errMsg(e)); }
  };
  const undo = async (kind, u, setList) => { await api.post(`/users/${u._id}/${kind}`); setList((l) => l.filter((x) => x._id !== u._id)); };

  return (
    <>
      <Row title="Who can message you" desc="Applies to new conversations.">
        <select className="input select" value={user.settings.allowDMsFrom} onChange={(e) => saveDM(e.target.value)} aria-label="Who can message you">
          <option value="everyone">Everyone</option><option value="following">Only people I follow</option>
        </select>
      </Row>
      <div className="stack settings-form">
        <strong>Muted words</strong>
        <p className="muted small">Posts containing these words are hidden from your feeds. Separate with commas.</p>
        <textarea className="input" rows={2} value={words} onChange={(e) => setWords(e.target.value)} placeholder="spoilers, crypto, …" aria-label="Muted words" />
        <button className="btn sm self-start" onClick={saveWords}>Save muted words</button>
      </div>
      <div className="settings-form"><strong>Blocked accounts</strong></div>
      {blocked?.length === 0 && <p className="muted small pad">You haven't blocked anyone.</p>}
      {blocked?.map((u) => <UserRow key={u._id} u={{ ...u, viewer: { isMe: true } }} showBio={false}><button className="btn sm" onClick={() => undo('block', u, setBlocked)}>Unblock</button></UserRow>)}
      <div className="settings-form"><strong>Muted accounts</strong></div>
      {muted?.length === 0 && <p className="muted small pad">You haven't muted anyone.</p>}
      {muted?.map((u) => <UserRow key={u._id} u={{ ...u, viewer: { isMe: true } }} showBio={false}><button className="btn sm" onClick={() => undo('mute', u, setMuted)}>Unmute</button></UserRow>)}
    </>
  );
}

const NOTIFS = [['like', 'Likes'], ['reply', 'Replies'], ['repost', 'Reposts and quotes'], ['follow', 'New followers'], ['mention', 'Mentions']];
function Notifs() {
  const { user, setUser } = useAuth();
  const ui = useUI();
  const toggle = async (key, value) => {
    try { setUser((await api.put('/users/me/settings', { notifications: { [key]: value } })).data); } catch (e) { ui.toast('error', errMsg(e)); }
  };
  return (
    <>
      <p className="muted pad">Choose which activity creates in-app notifications.</p>
      {NOTIFS.map(([k, label]) => <Row key={k} title={label}><Switch label={label} checked={user.settings.notifications[k]} onChange={(v) => toggle(k, v)} /></Row>)}
    </>
  );
}

function Appearance() {
  const ui = useUI();
  return (
    <>
      <fieldset className="setting-row stack-s">
        <legend><strong>Theme</strong></legend>
        {[['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, label]) => (
          <label key={v} className="check"><input type="radio" name="theme" checked={ui.theme === v} onChange={() => ui.setTheme(v)} /> {label}</label>
        ))}
      </fieldset>
      <Row title="Larger text" desc="Increases the base font size across the app."><Switch label="Larger text" checked={ui.bigText} onChange={ui.setBigText} /></Row>
    </>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('account');
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs label="Settings sections" value={tab} onChange={setTab} tabs={[['account', 'Account'], ['privacy', 'Privacy & safety'], ['notifications', 'Notifications'], ['appearance', 'Appearance']]} />
      {tab === 'account' && <Account />}
      {tab === 'privacy' && <Privacy />}
      {tab === 'notifications' && <Notifs />}
      {tab === 'appearance' && <Appearance />}
    </>
  );
}
