import { useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { checkMedia } from '../utils.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import QuoteEmbed from './QuoteEmbed.jsx';

const MAX = 500;

/**
 * Create a post, reply (parent) or quote (quoteOf).
 * After a successful post it broadcasts a `post:created` window event, so any
 * open page (home feed, thread, profile…) can add it without a reload.
 */
export default function Composer({ parent, quoteOf, placeholder = "What's happening?", autoFocus = false, onDone }) {
  const { user } = useAuth();
  const ui = useUI();
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // { file, url, video }
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const taRef = useRef(null);

  const left = MAX - text.length;
  const canPost = (text.trim() || files.length) && left >= 0 && !busy;

  useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus]);
  // free the preview object-URLs when the composer unmounts
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []); // eslint-disable-line

  const grow = (el) => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px'; };

  const addFiles = (list) => {
    const next = [...files];
    setError('');
    for (const f of list) {
      if (next.length >= 4) { setError('You can attach up to 4 files'); break; }
      const bad = checkMedia(f);
      if (bad) { setError(bad); continue; }
      next.push({ file: f, url: URL.createObjectURL(f), video: f.type.startsWith('video/') });
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  };
  const removeFile = (i) => { URL.revokeObjectURL(files[i].url); setFiles(files.filter((_, j) => j !== i)); };

  const submit = async (e) => {
    e?.preventDefault();
    if (!canPost) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('text', text);
      if (parent) fd.append('parent', parent._id);
      if (quoteOf) fd.append('quoteOf', quoteOf._id);
      if (sensitive) fd.append('sensitive', 'true');
      files.forEach((f) => fd.append('media', f.file));
      const { data } = await api.post('/posts', fd);
      window.dispatchEvent(new CustomEvent('post:created', { detail: data }));
      files.forEach((f) => URL.revokeObjectURL(f.url));
      setText(''); setFiles([]); setSensitive(false);
      if (taRef.current) taRef.current.style.height = 'auto';
      ui.toast('success', parent ? 'Reply sent' : 'Posted');
      onDone?.(data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const R = 9, C = 2 * Math.PI * R;
  return (
    <form className="composer" onSubmit={submit}>
      <Avatar user={user} />
      <div className="grow">
        {parent && <p className="muted small">Replying to <strong>@{parent.author.username}</strong></p>}
        <label className="sr-only" htmlFor="composer-text">{parent ? 'Write your reply' : 'Write a post'}</label>
        <textarea
          id="composer-text"
          ref={taRef}
          value={text}
          placeholder={parent ? 'Post your reply' : placeholder}
          rows={2}
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit()}
        />
        {files.length > 0 && (
          <div className={`media-grid n${files.length} preview`}>
            {files.map((f, i) => (
              <div key={f.url} className="preview-item">
                {f.video ? <video src={f.url} muted /> : <img src={f.url} alt={`Attachment ${i + 1}`} />}
                <button type="button" className="icon-btn dark" onClick={() => removeFile(i)} aria-label={`Remove attachment ${i + 1}`}><Icon name="x" size={16} /></button>
              </div>
            ))}
          </div>
        )}
        {quoteOf && <QuoteEmbed post={quoteOf} />}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="composer-tools">
          <div className="row gap-s">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" multiple hidden onChange={(e) => addFiles([...e.target.files])} />
            <button type="button" className="icon-btn brand" onClick={() => fileRef.current?.click()} aria-label="Add photo or video" disabled={files.length >= 4}><Icon name="image" /></button>
            {files.length > 0 && (
              <label className="check small"><input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} /> Sensitive content</label>
            )}
          </div>
          <div className="row gap-s">
            {text.length > 0 && (
              <span className={`ring ${left < 0 ? 'over' : left <= 20 ? 'warn' : ''}`} role="img" aria-label={`${left} characters left`}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r={R} className="track" />
                  <circle cx="12" cy="12" r={R} className="fill" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(text.length, MAX) / MAX)} transform="rotate(-90 12 12)" />
                </svg>
                {left <= 20 && <b>{left}</b>}
              </span>
            )}
            <button className="btn primary" disabled={!canPost}>{busy ? 'Posting…' : parent ? 'Reply' : 'Post'}</button>
          </div>
        </div>
      </div>
    </form>
  );
}
