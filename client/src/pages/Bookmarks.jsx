import api from '../api';
import useInfinite from '../hooks/useInfinite.js';
import FeedList from '../components/FeedList.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PostCard from '../components/PostCard.jsx';

/** Private: bookmarks are only ever visible to the person who saved them. */
export default function Bookmarks() {
  const inf = useInfinite(async (cursor) => (await api.get('/bookmarks', { params: { cursor } })).data, []);
  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Only you can see what you save" />
      <FeedList
        inf={inf}
        render={(p) => <PostCard key={p._id} post={p} onRemove={(id) => inf.setItems((x) => x.filter((i) => i._id !== id))} />}
        empty={<div className="state"><h2>Save posts for later</h2><p className="muted">Tap the bookmark icon on any post to keep it here.</p></div>}
      />
    </>
  );
}
