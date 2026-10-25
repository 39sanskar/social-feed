import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import useInfinite from '../hooks/useInfinite.js';
import { compact } from '../utils.js';
import FeedList from '../components/FeedList.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PostCard from '../components/PostCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import Tabs from '../components/Tabs.jsx';
import UserRow from '../components/UserRow.jsx';
import { Skeletons } from '../components/Skeleton.jsx';

const postList = (inf) => (
  <FeedList inf={inf} render={(p) => <PostCard key={p._id} post={p} onRemove={(id) => inf.setItems((x) => x.filter((i) => i._id !== id))} />} />
);

/** Discover: everyone's latest, what's trending (transparent formula) and people to follow. */
export default function Explore() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'everyone';
  const [trending, setTrending] = useState(null);
  const [people, setPeople] = useState(null);
  const inf = useInfinite(async (cursor) => (tab === 'everyone' ? (await api.get('/posts/explore', { params: { cursor } })).data : { items: [], nextCursor: null }), [tab]);

  useEffect(() => {
    if (tab === 'trending' && !trending) api.get('/search/trending').then((r) => setTrending(r.data));
    if (tab === 'people' && !people) api.get('/users/suggestions').then((r) => setPeople(r.data));
  }, [tab]); // eslint-disable-line

  return (
    <>
      <PageHeader title="Explore" />
      <div className="pad"><SearchBox /></div>
      <Tabs label="Explore sections" value={tab} onChange={(t) => setParams({ tab: t })} tabs={[['everyone', 'Everyone'], ['trending', 'Trending'], ['people', 'People']]} />
      {tab === 'everyone' && postList(inf)}
      {tab === 'trending' && (
        <>
          <p className="muted small pad">Trending ranks hashtags from the last 24 hours. Different authors count most, then post volume, then likes, reposts and replies, so one person can't push a tag alone.</p>
          {trending === null && <Skeletons n={4} row />}
          {trending?.length === 0 && <div className="state"><p>Nothing is trending yet. Be the first to start a topic with a #hashtag.</p></div>}
          {trending?.map((t, i) => (
            <Link key={t.tag} to={`/tag/${t.tag}`} className="trend big"><span className="muted">{i + 1}</span><strong>#{t.tag}</strong><span className="muted">{compact(t.posts)} posts</span></Link>
          ))}
        </>
      )}
      {tab === 'people' && (
        <>
          {people === null && <Skeletons n={4} row />}
          {people?.length === 0 && <div className="state"><p>No new people to suggest right now.</p></div>}
          {people?.map((u) => <UserRow key={u._id} u={u} />)}
        </>
      )}
    </>
  );
}

/** /search?q=…&type=posts|users|tags */
export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const type = params.get('type') || 'posts';
  const inf = useInfinite(async (cursor) => (await api.get('/search', { params: { q, type, cursor } })).data, [q, type]);
  return (
    <>
      <PageHeader title="Search" back />
      <div className="pad"><SearchBox initial={q} /></div>
      <Tabs label="Result type" value={type} onChange={(t) => setParams({ q, type: t })} tabs={[['posts', 'Posts'], ['users', 'People'], ['tags', 'Hashtag']]} />
      <FeedList
        inf={inf}
        row={type === 'users'}
        render={(item) => (type === 'users' ? <UserRow key={item._id} u={item} /> : <PostCard key={item._id} post={item} />)}
        empty={<div className="state"><h2>No results for “{q}”</h2><p className="muted">Check the spelling or try a different word.</p></div>}
      />
    </>
  );
}

/** /tag/:tag */
export function Tag() {
  const { tag } = useParams();
  const inf = useInfinite(async (cursor) => (await api.get(`/posts/tag/${tag}`, { params: { cursor } })).data, [tag]);
  return (
    <>
      <PageHeader title={`#${tag}`} back />
      <FeedList inf={inf} render={(p) => <PostCard key={p._id} post={p} />} empty={<div className="state"><p>No posts use #{tag} yet.</p></div>} />
    </>
  );
}
