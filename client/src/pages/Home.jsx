import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import useInfinite from '../hooks/useInfinite.js';
import Composer from '../components/Composer.jsx';
import FeedList from '../components/FeedList.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PostCard from '../components/PostCard.jsx';
import Tabs from '../components/Tabs.jsx';

/**
 * Two ranking modes (server: GET /posts/feed?mode=):
 *   top    "For you"   engagement ÷ age score over people you follow + popular posts
 *   latest "Following" strictly chronological
 */
export default function Home() {
  const [mode, setMode] = useState('top');
  const inf = useInfinite(async (cursor) => (await api.get('/posts/feed', { params: { mode, cursor } })).data, [mode]);
  const { setItems } = inf;

  // posts written anywhere in the app (inline composer or modal) appear instantly
  useEffect(() => {
    const h = (e) => e.detail.kind !== 'reply' && setItems((items) => [e.detail, ...items]);
    window.addEventListener('post:created', h);
    return () => window.removeEventListener('post:created', h);
  }, [setItems]);

  const remove = (id) => setItems((items) => items.filter((p) => p._id !== id));

  return (
    <>
      <PageHeader title="Home" />
      <Tabs label="Feed type" value={mode} onChange={setMode} tabs={[['top', 'For you'], ['latest', 'Following']]} />
      <div className="inline-composer"><Composer /></div>
      <FeedList
        inf={inf}
        render={(p) => <PostCard key={p._id} post={p} onRemove={remove} />}
        empty={
          <div className="state">
            <h2>Your feed is quiet</h2>
            <p className="muted">Follow a few people or topics and their posts will land here.</p>
            <Link className="btn primary" to="/explore">Find people to follow</Link>
          </div>
        }
      />
    </>
  );
}
