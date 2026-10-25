import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useUI } from '../context/UIContext.jsx';
import useInfinite from '../hooks/useInfinite.js';
import FeedList from '../components/FeedList.jsx';
import Icon from '../components/Icon.jsx';
import Menu from '../components/Menu.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PostCard from '../components/PostCard.jsx';
import Tabs from '../components/Tabs.jsx';
import UserRow from '../components/UserRow.jsx';
import { Skeletons } from '../components/Skeleton.jsx';

/** Create / rename form, used for both. */
function ListForm({ list, onSaved, onClose }) {
  const ui = useUI();
  const [f, setF] = useState({ name: list?.name || '', description: list?.description || '' });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = list ? await api.put(`/lists/${list._id}`, f) : await api.post('/lists', f);
      onSaved(data);
    } catch (err) { ui.toast('error', errMsg(err)); setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={save}>
      <label className="field">Name<input className="input" value={f.name} maxLength={50} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus required /></label>
      <label className="field">Description <span className="muted">(optional)</span><textarea className="input" rows={2} maxLength={160} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="row gap-s end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{list ? 'Save' : 'Create list'}</button></div>
    </form>
  );
}

export default function Lists() {
  const nav = useNavigate();
  const [lists, setLists] = useState(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { api.get('/lists').then((r) => setLists(r.data)); }, []);
  return (
    <>
      <PageHeader title="Lists" subtitle="Private, curated timelines"><button className="btn primary sm" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New list</button></PageHeader>
      {lists === null && <Skeletons n={3} row />}
      {lists?.length === 0 && <div className="state"><h2>Curate your own timeline</h2><p className="muted">Group accounts into a list (friends, news, designers…) and read only their posts.</p><button className="btn primary" onClick={() => setCreating(true)}>Create your first list</button></div>}
      {lists?.map((l) => (
        <Link key={l._id} to={`/lists/${l._id}`} className="user-row list-row">
          <span className="list-icon"><Icon name="list" /></span>
          <span className="grow"><strong>{l.name}</strong><span className="muted block small">{l.members.length} accounts{l.description ? ` · ${l.description}` : ''}</span></span>
        </Link>
      ))}
      <Modal open={creating} onClose={() => setCreating(false)} title="Create list">
        <ListForm onClose={() => setCreating(false)} onSaved={(l) => nav(`/lists/${l._id}`)} />
      </Modal>
    </>
  );
}

export function ListDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const ui = useUI();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('timeline');
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const inf = useInfinite(async (cursor) => (await api.get(`/lists/${id}/timeline`, { params: { cursor } })).data, [id]);

  const load = () => api.get(`/lists/${id}`).then((r) => setList(r.data)).catch(() => nav('/lists'));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  // search people to add (debounced)
  useEffect(() => {
    if (!q.trim()) return setFound([]);
    const t = setTimeout(() => api.get('/search', { params: { q, type: 'users' } }).then((r) => setFound(r.data.items)), 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!list) return <><PageHeader title="List" back /><Skeletons n={2} row /></>;
  const memberIds = new Set(list.members.map((m) => m._id));

  const add = async (u) => { await api.post(`/lists/${id}/members`, { userId: u._id }); setQ(''); await load(); inf.reload(); ui.toast('success', `Added @${u.username}`); };
  const remove = async (u) => { await api.delete(`/lists/${id}/members/${u._id}`); await load(); inf.reload(); };
  const del = async () => {
    if (!(await ui.confirm({ title: 'Delete this list?', body: 'The accounts on it are not affected.', confirmLabel: 'Delete', danger: true }))) return;
    await api.delete(`/lists/${id}`);
    nav('/lists');
  };

  return (
    <>
      <PageHeader title={list.name} subtitle={list.description || `${list.members.length} accounts`} back>
        <Menu label="List options">
          <button role="menuitem" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit details</button>
          <button role="menuitem" className="danger" onClick={del}><Icon name="trash" size={16} /> Delete list</button>
        </Menu>
      </PageHeader>
      <Tabs label="List sections" value={tab} onChange={setTab} tabs={[['timeline', 'Timeline'], ['members', `Members (${list.members.length})`]]} />
      {tab === 'timeline' && (
        <FeedList inf={inf} render={(p) => <PostCard key={p._id} post={p} />} empty={<div className="state"><p className="muted">{list.members.length ? 'No posts from this list yet.' : 'Add people in the Members tab to fill this timeline.'}</p></div>} />
      )}
      {tab === 'members' && (
        <>
          <div className="pad"><input className="input" placeholder="Search people to add" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people to add" /></div>
          {found.map((u) => <UserRow key={u._id} u={u} message={false}>{!memberIds.has(u._id) && <button className="btn sm" onClick={() => add(u)}>Add to list</button>}</UserRow>)}
          {!q && list.members.map((u) => <UserRow key={u._id} u={u} message={false}><button className="btn sm" onClick={() => remove(u)}>Remove</button></UserRow>)}
          {!q && list.members.length === 0 && <div className="state"><p className="muted">No members yet. Search above to add some.</p></div>}
        </>
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit list">
        <ListForm list={list} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      </Modal>
    </>
  );
}
