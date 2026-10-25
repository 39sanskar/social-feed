import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import Avatar from './Avatar.jsx';
import { VerifiedBadge } from './Icon.jsx';

/** A person in a list (search, suggestions, followers, list members…) with Follow / Message buttons. */
export default function UserRow({ u, showBio = true, message = true, children }) {
  const { online } = useAuth();
  const ui = useUI();
  const nav = useNavigate();
  const [following, setFollowing] = useState(!!u.viewer?.following);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/users/${u._id}/follow`);
      setFollowing(data.following);
    } catch (e) { ui.toast('error', errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="user-row">
      <Link to={`/u/${u.username}`} aria-label={`@${u.username}'s profile`}><Avatar user={u} online={online.has(u._id)} /></Link>
      <Link to={`/u/${u.username}`} className="grow">
        <strong>{u.displayName || u.username}</strong>{u.verifiedBadge && <VerifiedBadge />}
        <span className="muted block">@{u.username}</span>
        {showBio && u.bio && <span className="muted block clamp small">{u.bio}</span>}
      </Link>
      {children}
      {!u.viewer?.isMe && (
        <div className="row gap-s">
          {message && <button className="btn sm" onClick={() => nav('/messages', { state: { user: u } })}>Message</button>}
          <button className={`btn sm ${following ? '' : 'primary'}`} disabled={busy} onClick={toggle} aria-pressed={following}>{following ? 'Following' : 'Follow'}</button>
        </div>
      )}
    </div>
  );
}
