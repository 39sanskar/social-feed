import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { compact, timeAgo } from '../utils.js';
import Avatar from './Avatar.jsx';
import Icon, { VerifiedBadge } from './Icon.jsx';
import Menu from './Menu.jsx';
import MediaGrid from './MediaGrid.jsx';
import PostText from './PostText.jsx';
import QuoteEmbed from './QuoteEmbed.jsx';

const EDIT_WINDOW_MS = 60 * 60 * 1000; // must match the server rule

/**
 * One post in any list. Handles: reposts (shows the original with a
 * "reposted" note), quotes, replies, optimistic like/repost/bookmark,
 * inline editing, delete, pin, share, mute/block/report.
 *   onRemove(id) tells the parent list to drop this card.
 */
export default function PostCard({ post, onRemove, detail = false }) {
  const { user } = useAuth();
  const ui = useUI();
  const nav = useNavigate();
  const repostedBy = post.kind === 'repost' ? post.author : null;
  const [p, setP] = useState(post.kind === 'repost' ? post.repostOf : post); // the post we actually display
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.text);
  const [saving, setSaving] = useState(false);

  const mine = p.author._id === user._id;
  const canEdit = mine && Date.now() - new Date(p.createdAt) < EDIT_WINDOW_MS;
  const url = `${location.origin}/post/${p._id}`;

  // keep reply/quote counters live when someone answers from anywhere in the app
  useEffect(() => {
    const h = (e) => {
      const d = e.detail;
      if (d.parent?._id === p._id) setP((c) => ({ ...c, repliesCount: c.repliesCount + 1 }));
      if (d.quoteOf?._id === p._id) setP((c) => ({ ...c, quotesCount: c.quotesCount + 1 }));
    };
    window.addEventListener('post:created', h);
    return () => window.removeEventListener('post:created', h);
  }, [p._id]);

  /** Optimistic update: change the UI immediately, call the API, roll back + toast on failure. */
  const optimistic = async (patch, request, fromServer) => {
    const before = p;
    setP((c) => ({ ...c, ...patch(c) }));
    try {
      const { data } = await request();
      if (fromServer) setP((c) => ({ ...c, ...fromServer(data) })); // settle on the server's real counter
    } catch (e) {
      setP(before);
      ui.toast('error', errMsg(e));
    }
  };

  const like = () => optimistic(
    (c) => ({ viewer: { ...c.viewer, liked: !c.viewer.liked }, likesCount: c.likesCount + (c.viewer.liked ? -1 : 1) }),
    () => api.post(`/posts/${p._id}/like`), (d) => ({ likesCount: d.likesCount }));
  const repost = () => optimistic(
    (c) => ({ viewer: { ...c.viewer, reposted: !c.viewer.reposted }, repostsCount: c.repostsCount + (c.viewer.reposted ? -1 : 1) }),
    () => api.post(`/posts/${p._id}/repost`), (d) => ({ repostsCount: d.repostsCount }));
  const bookmark = async () => {
    const was = p.viewer.bookmarked;
    await optimistic((c) => ({ viewer: { ...c.viewer, bookmarked: !c.viewer.bookmarked } }), () => api.post(`/posts/${p._id}/bookmark`));
    ui.toast('success', was ? 'Removed from bookmarks' : 'Saved to bookmarks');
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ url, text: p.text.slice(0, 100) });
      else { await navigator.clipboard.writeText(url); ui.toast('success', 'Link copied'); }
    } catch { /* user dismissed the share sheet */ }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/posts/${p._id}`, { text: draft });
      setP(data);
      setEditing(false);
      ui.toast('success', 'Post updated');
    } catch (e) { ui.toast('error', errMsg(e)); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!(await ui.confirm({ title: 'Delete this post?', body: "This can't be undone. Its likes and replies stay linked to a deleted post.", confirmLabel: 'Delete', danger: true }))) return;
    try { await api.delete(`/posts/${p._id}`); ui.toast('success', 'Post deleted'); onRemove?.(post._id); if (detail) nav(-1); }
    catch (e) { ui.toast('error', errMsg(e)); }
  };
  const pin = async () => {
    try { const { data } = await api.post(`/posts/${p._id}/pin`); ui.toast('success', data.pinned ? 'Pinned to your profile' : 'Unpinned'); }
    catch (e) { ui.toast('error', errMsg(e)); }
  };
  const muteOrBlock = async (kind) => {
    if (kind === 'block' && !(await ui.confirm({ title: `Block @${p.author.username}?`, body: "They won't be able to follow, message or interact with you, and you'll stop seeing each other's posts.", confirmLabel: 'Block', danger: true }))) return;
    try { await api.post(`/users/${p.author._id}/${kind}`); ui.toast('success', kind === 'block' ? 'Account blocked' : 'Account muted'); onRemove?.(post._id); }
    catch (e) { ui.toast('error', errMsg(e)); }
  };

  // clicking the card body opens the thread, unless the click was on a control
  const open = (e) => { if (!detail && !e.target.closest('a,button,video,input,textarea,dialog,.menu')) nav(`/post/${p._id}`); };

  return (
    <article className={`post ${detail ? 'detail' : ''}`} onClick={open}>
      {repostedBy && <div className="post-note"><Icon name="repeat" size={14} /> {repostedBy._id === user._id ? 'You' : repostedBy.displayName || repostedBy.username} reposted</div>}
      {post.pinned && <div className="post-note"><Icon name="pin" size={14} /> Pinned post</div>}

      <Link to={`/u/${p.author.username}`} aria-label={`@${p.author.username}'s profile`}><Avatar user={p.author} /></Link>
      <div className="post-main">
        <header className="post-head">
          <Link to={`/u/${p.author.username}`} className="author">
            <strong>{p.author.displayName || p.author.username}</strong>
            {p.author.verifiedBadge && <VerifiedBadge />}
            <span className="muted"> @{p.author.username}</span>
          </Link>
          <span className="muted">· <Link to={`/post/${p._id}`} title={new Date(p.createdAt).toLocaleString()}>{timeAgo(p.createdAt)}</Link>{p.editedAt && ' · edited'}</span>
          <Menu label="Post options">
            {mine ? (
              <>
                {canEdit && <button role="menuitem" onClick={() => { setDraft(p.text); setEditing(true); }}><Icon name="edit" size={16} /> Edit</button>}
                <button role="menuitem" onClick={pin}><Icon name="pin" size={16} /> Pin / unpin on profile</button>
                <button role="menuitem" className="danger" onClick={remove}><Icon name="trash" size={16} /> Delete</button>
              </>
            ) : (
              <>
                <button role="menuitem" onClick={() => muteOrBlock('mute')}><Icon name="mute" size={16} /> Mute @{p.author.username}</button>
                <button role="menuitem" onClick={() => muteOrBlock('block')}><Icon name="block" size={16} /> Block @{p.author.username}</button>
                <button role="menuitem" className="danger" onClick={() => ui.report({ targetType: 'post', target: p._id })}><Icon name="flag" size={16} /> Report post</button>
              </>
            )}
          </Menu>
        </header>

        {p.kind === 'reply' && p.parent?.author && <p className="muted small">Replying to <Link to={`/u/${p.parent.author.username}`}>@{p.parent.author.username}</Link></p>}

        {editing ? (
          <div className="edit-box">
            <textarea value={draft} maxLength={500} rows={3} onChange={(e) => setDraft(e.target.value)} aria-label="Edit post text" autoFocus />
            <div className="row gap-s end">
              <button className="btn sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn primary sm" disabled={saving || !draft.trim()} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        ) : (
          p.text && <p className="post-text"><PostText text={p.text} /></p>
        )}

        <MediaGrid media={p.media} sensitive={p.sensitive} />
        {p.kind === 'quote' && <QuoteEmbed post={p.quoteOf} />}

        <footer className="post-actions">
          <button className="act" onClick={() => ui.openCompose({ parent: p })} aria-label={`Reply, ${p.repliesCount} replies`}>
            <Icon name="comment" size={18} /><span>{compact(p.repliesCount)}</span>
          </button>
          <Menu label={`Repost options, ${p.repostsCount + p.quotesCount} reposts`} triggerClass={`act repost ${p.viewer.reposted ? 'on' : ''}`} trigger={<><Icon name="repeat" size={18} /><span>{compact(p.repostsCount + p.quotesCount)}</span></>}>
            <button role="menuitem" onClick={repost}><Icon name="repeat" size={16} /> {p.viewer.reposted ? 'Undo repost' : 'Repost'}</button>
            <button role="menuitem" onClick={() => ui.openCompose({ quoteOf: p })}><Icon name="edit" size={16} /> Quote</button>
          </Menu>
          <button className={`act like ${p.viewer.liked ? 'on' : ''}`} onClick={like} aria-pressed={p.viewer.liked} aria-label={`Like, ${p.likesCount} likes`}>
            <Icon name="heart" size={18} style={p.viewer.liked ? { fill: 'currentColor' } : null} /><span>{compact(p.likesCount)}</span>
          </button>
          <button className={`act bookmark ${p.viewer.bookmarked ? 'on' : ''}`} onClick={bookmark} aria-pressed={p.viewer.bookmarked} aria-label="Bookmark">
            <Icon name="bookmark" size={18} style={p.viewer.bookmarked ? { fill: 'currentColor' } : null} />
          </button>
          <button className="act" onClick={share} aria-label="Share"><Icon name="share" size={18} /></button>
        </footer>
      </div>
    </article>
  );
}
