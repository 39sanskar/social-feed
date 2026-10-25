import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import PostText from './PostText.jsx';
import { timeAgo } from '../utils.js';

/** Compact version of a post, shown inside quotes and in the composer. */
export default function QuoteEmbed({ post, label }) {
  if (!post) return <div className="quote-embed gone">This post was deleted.</div>;
  return (
    <Link to={`/post/${post._id}`} className="quote-embed" onClick={(e) => e.stopPropagation()}>
      <div className="quote-head">
        <Avatar user={post.author} size={20} />
        <strong>{post.author.displayName || post.author.username}</strong>
        <span className="muted">@{post.author.username} · {timeAgo(post.createdAt)}</span>
        {label && <span className="muted"> · {label}</span>}
      </div>
      {post.text && <p className="clamp"><PostText text={post.text} /></p>}
      {post.media?.[0] && (post.media[0].type === 'image' ? <img src={post.media[0].url} alt="" loading="lazy" className={post.sensitive ? 'blurred' : ''} /> : <span className="muted">Video attached</span>)}
    </Link>
  );
}
