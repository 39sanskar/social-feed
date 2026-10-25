import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import useInfinite from '../hooks/useInfinite.js';
import { compact, optimize } from '../utils.js';
import Avatar from '../components/Avatar.jsx';
import FeedList from '../components/FeedList.jsx';
import Icon, { VerifiedBadge } from '../components/Icon.jsx';
import Menu from '../components/Menu.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PostCard from '../components/PostCard.jsx';
import Tabs from '../components/Tabs.jsx';
import UserRow from '../components/UserRow.jsx';
import { PostSkeleton } from '../components/Skeleton.jsx';

/** Edit-profile form: names, bio, links and the two images (with live previews). */
function EditProfile({ profile, onSaved, onClose }) {
  const ui = useUI();
  const [f, setF] = useState({ displayName: profile.displayName || '', username: profile.username, bio: profile.bio || '', location: profile.location || '', website: profile.website || '' });
  const [avatar, setAvatar] = useState(null);
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (avatar) fd.append('avatar', avatar);
      if (cover) fd.append('cover', cover);
      const { data } = await api.put('/users/me', fd);
      ui.toast('success', 'Profile updated');
      onSaved(data);
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  };
  const preview = (file, fallback) => (file ? URL.createObjectURL(file) : fallback);

  return (
    <form className="stack" onSubmit={save}>
      <div className="cover small-cover" style={{ backgroundImage: `url(${preview(cover, optimize(profile.cover, 900)) || ''})` }}>
        <label className="btn sm floating">Change cover<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => setCover(e.target.files[0] || null)} /></label>
      </div>
      <div className="row gap-s">
        <Avatar user={{ ...profile, avatar: preview(avatar, profile.avatar) }} size={72} />
        <label className="btn sm">Change photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => setAvatar(e.target.files[0] || null)} /></label>
      </div>
      <label className="field">Display name<input className="input" value={f.displayName} onChange={set('displayName')} maxLength={50} /></label>
      <label className="field">Username<input className="input" value={f.username} onChange={set('username')} pattern="[A-Za-z0-9_]{3,20}" title="3–20 letters, numbers or underscores" required /></label>
      <label className="field">Bio<textarea className="input" rows={3} value={f.bio} onChange={set('bio')} maxLength={160} /><small className="muted">{f.bio.length}/160</small></label>
      <label className="field">Location<input className="input" value={f.location} onChange={set('location')} maxLength={40} /></label>
      <label className="field">Website<input className="input" type="url" value={f.website} onChange={set('website')} placeholder="https://example.com" maxLength={100} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row gap-s end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
    </form>
  );
}

export default function Profile() {
  const { username } = useParams();
  const { user: me, setUser } = useAuth();
  const ui = useUI();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('posts');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfile(null); setError(''); setTab('posts');
    api.get(`/users/${username}`).then((r) => setProfile(r.data)).catch((e) => setError(errMsg(e)));
  }, [username]);

  const inf = useInfinite(
    async (cursor) => (profile ? (await api.get(`/posts/user/${profile._id}`, { params: { tab, cursor } })).data : { items: [], nextCursor: null }),
    [profile?._id, tab]
  );
  const { setItems } = inf;
  const isMe = profile?._id === me._id;

  // new posts/replies by me show up on my own profile instantly
  useEffect(() => {
    if (!isMe) return;
    const h = (e) => {
      const k = e.detail.kind;
      if ((tab === 'posts' && k !== 'reply') || (tab === 'replies' && k === 'reply')) setItems((x) => [e.detail, ...x]);
    };
    window.addEventListener('post:created', h);
    return () => window.removeEventListener('post:created', h);
  }, [isMe, tab, setItems]);

  if (error) return <><PageHeader title="Profile" back /><div className="state"><h2>{error}</h2></div></>;
  if (!profile) return <><PageHeader title="Profile" back /><PostSkeleton /></>;

  const v = profile.viewer;
  const patchViewer = (patch, followersDelta = 0) => setProfile((p) => ({ ...p, followersCount: p.followersCount + followersDelta, viewer: { ...p.viewer, ...patch } }));

  const follow = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/users/${profile._id}/follow`);
      patchViewer({ following: data.following }, data.following ? 1 : -1);
    } catch (e) { ui.toast('error', errMsg(e)); } finally { setBusy(false); }
  };
  const mute = async () => { const { data } = await api.post(`/users/${profile._id}/mute`); patchViewer({ muted: data.muted }); ui.toast('success', data.muted ? 'Account muted' : 'Account unmuted'); };
  const block = async () => {
    if (!v.blocked && !(await ui.confirm({ title: `Block @${profile.username}?`, body: "They won't be able to follow, message or interact with you. Any follow between you is removed.", confirmLabel: 'Block', danger: true }))) return;
    const { data } = await api.post(`/users/${profile._id}/block`);
    patchViewer({ blocked: data.blocked, following: false });
    ui.toast('success', data.blocked ? 'Account blocked' : 'Account unblocked');
  };
  const copyLink = async () => { await navigator.clipboard.writeText(`${location.origin}/u/${profile.username}`); ui.toast('success', 'Profile link copied'); };

  const onSaved = (data) => {
    setUser(data);
    setProfile((p) => ({ ...p, ...data }));
    setEditing(false);
    if (data.username !== username) nav(`/u/${data.username}`, { replace: true });
  };

  const tabs = [['posts', 'Posts'], ['replies', 'Replies'], ['media', 'Media'], ...(isMe ? [['likes', 'Likes']] : [])];

  return (
    <>
      <PageHeader title={profile.displayName || profile.username} subtitle={`@${profile.username}`} back />
      <div className="cover" style={profile.cover ? { backgroundImage: `url(${optimize(profile.cover, 1200)})` } : null} />
      <section className="profile-head">
        <div className="profile-top">
          <div className="profile-avatar"><Avatar user={profile} size={104} /></div>
          <div className="row gap-s">
            {isMe ? (
              <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit profile</button>
            ) : (
              <>
                <button className="btn icon-only" onClick={() => nav('/messages', { state: { user: profile } })} aria-label={`Message @${profile.username}`}><Icon name="mail" /></button>
                <button className={`btn ${v.following ? '' : 'primary'}`} onClick={follow} disabled={busy || v.blocked} aria-pressed={v.following}>{v.following ? 'Following' : v.followsYou ? 'Follow back' : 'Follow'}</button>
                <Menu label="Profile options">
                  <button role="menuitem" onClick={copyLink}><Icon name="link" size={16} /> Copy link</button>
                  <button role="menuitem" onClick={mute}><Icon name="mute" size={16} /> {v.muted ? 'Unmute' : 'Mute'} @{profile.username}</button>
                  <button role="menuitem" onClick={block}><Icon name="block" size={16} /> {v.blocked ? 'Unblock' : 'Block'} @{profile.username}</button>
                  <button role="menuitem" className="danger" onClick={() => ui.report({ targetType: 'user', target: profile._id })}><Icon name="flag" size={16} /> Report</button>
                </Menu>
              </>
            )}
          </div>
        </div>
        <h2 className="profile-name">{profile.displayName || profile.username}{profile.verifiedBadge && <VerifiedBadge />}</h2>
        <p className="muted">@{profile.username}{v?.followsYou && <span className="pill">Follows you</span>}</p>
        {profile.bio && <p className="bio">{profile.bio}</p>}
        <ul className="meta">
          {profile.location && <li><Icon name="pin2" size={16} /> {profile.location}</li>}
          {profile.website && <li><Icon name="link" size={16} /> <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow ugc">{profile.website.replace(/^https?:\/\//, '')}</a></li>}
          <li><Icon name="calendar" size={16} /> Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</li>
        </ul>
        <p className="stats">
          <Link to={`/u/${profile.username}/following`}><strong>{compact(profile.followingCount)}</strong> Following</Link>
          <Link to={`/u/${profile.username}/followers`}><strong>{compact(profile.followersCount)}</strong> Followers</Link>
        </p>
        {v.blocked && <p className="notice">You blocked this account. Unblock it from the ⋯ menu to interact again.</p>}
      </section>

      <Tabs label="Profile sections" value={tab} onChange={setTab} tabs={tabs} />
      <FeedList
        inf={inf}
        render={(p) => <PostCard key={p._id} post={p} onRemove={(id) => setItems((x) => x.filter((i) => i._id !== id))} />}
        empty={<div className="state"><h2>{tab === 'likes' ? 'No likes yet' : 'Nothing here yet'}</h2><p className="muted">{isMe ? 'When you post, it will show up here.' : `@${profile.username} hasn't posted anything here.`}</p></div>}
      />

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit profile" wide>
        <EditProfile profile={profile} onSaved={onSaved} onClose={() => setEditing(false)} />
      </Modal>
    </>
  );
}

/** /u/:username/followers and /u/:username/following */
export function Connections({ kind }) {
  const { username } = useParams();
  const inf = useInfinite(async (cursor) => (await api.get(`/users/${username}/${kind}`, { params: { cursor } })).data, [username, kind]);
  return (
    <>
      <PageHeader title={kind === 'followers' ? 'Followers' : 'Following'} subtitle={`@${username}`} back />
      <FeedList inf={inf} row render={(u) => <UserRow key={u._id} u={u} />} empty={<div className="state"><p>{kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p></div>} />
    </>
  );
}
