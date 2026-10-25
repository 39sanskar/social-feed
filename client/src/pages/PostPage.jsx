import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import useInfinite from '../hooks/useInfinite.js';
import Composer from '../components/Composer.jsx';
import FeedList from '../components/FeedList.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PostCard from '../components/PostCard.jsx';
import { PostSkeleton } from '../components/Skeleton.jsx';

/** A single post as a conversation: the chain above it, the post, a reply box and the replies. */
export default function PostPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const replies = useInfinite(async (cursor) => (await api.get(`/posts/${id}/replies`, { params: { cursor } })).data, [id]);
  const { setItems } = replies;

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/posts/${id}`).then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, [id]);

  // a reply written here (or in the reply modal) is added to the thread right away
  useEffect(() => {
    const h = (e) => e.detail.parent?._id === id && setItems((items) => [...items, e.detail]);
    window.addEventListener('post:created', h);
    return () => window.removeEventListener('post:created', h);
  }, [id, setItems]);

  return (
    <>
      <PageHeader title="Post" back />
      {error && <div className="state" role="alert"><h2>{error}</h2><p className="muted">It may have been deleted, or its author may have restricted it.</p></div>}
      {!data && !error && <PostSkeleton />}
      {data && (
        <>
          {data.ancestors.map((p) => <PostCard key={p._id} post={p} />)}
          <PostCard key={data.post._id} post={data.post} detail />
          <div className="inline-composer"><Composer parent={data.post} /></div>
          <FeedList inf={replies} render={(p) => <PostCard key={p._id} post={p} onRemove={(rid) => setItems((x) => x.filter((i) => i._id !== rid))} />} empty={<div className="state"><p className="muted">No replies yet. Start the conversation.</p></div>} />
        </>
      )}
    </>
  );
}
