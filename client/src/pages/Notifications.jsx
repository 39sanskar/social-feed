import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import useInfinite from '../hooks/useInfinite.js';
import { NOTIF_TEXT, timeAgo } from '../utils.js';
import Avatar from '../components/Avatar.jsx';
import FeedList from '../components/FeedList.jsx';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';

const ICON = { like: 'heart', reply: 'comment', repost: 'repeat', quote: 'repeat', follow: 'user', mention: 'comment' };

export default function Notifications() {
  const { socket, setUnread } = useAuth();
  const [tab, setTab] = useState('all');
  const inf = useInfinite(async (cursor) => (await api.get('/notifications', { params: { type: tab === 'mentions' ? 'mentions' : undefined, cursor } })).data, [tab]);
  const { setItems } = inf;

  // opening the page marks everything as read
  useEffect(() => { api.put('/notifications/read-all').then(() => setUnread(0)).catch(() => {}); }, [setUnread]);

  // live: new notifications slide in while the page is open
  useEffect(() => {
    if (!socket) return;
    const on = (n) => {
      if (tab === 'mentions' && !['mention', 'reply'].includes(n.type)) return;
      setItems((x) => [n, ...x]);
      setUnread(0);
      api.put('/notifications/read-all').catch(() => {});
    };
    socket.on('notification', on);
    return () => socket.off('notification', on);
  }, [socket, tab, setItems, setUnread]);

  return (
    <>
      <PageHeader title="Notifications" />
      <Tabs label="Notification filter" value={tab} onChange={setTab} tabs={[['all', 'All'], ['mentions', 'Mentions & replies']]} />
      <FeedList
        inf={inf}
        row
        render={(n) => (
          <Link key={n._id} to={n.post ? `/post/${n.post._id || n.post}` : `/u/${n.sender.username}`} className={`notif ${n.read ? '' : 'unread'}`}>
            <span className={`notif-icon ${n.type}`}><Icon name={ICON[n.type]} size={18} /></span>
            <div className="grow">
              <Avatar user={n.sender} size={32} />
              <p><strong>{n.sender.displayName || n.sender.username}</strong> {NOTIF_TEXT[n.type]}</p>
              {n.post?.text && <p className="muted clamp">{n.post.text}</p>}
            </div>
            <span className="muted small">{timeAgo(n.createdAt)}</span>
          </Link>
        )}
        empty={<div className="state"><h2>Nothing yet</h2><p className="muted">Likes, replies, reposts, mentions and new followers will appear here.</p></div>}
      />
    </>
  );
}
