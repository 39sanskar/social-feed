import { optimize } from '../utils.js';

const COLORS = ['#7C5CF0', '#3B82F6', '#0EA5C6', '#E0507A', '#D9822B', '#1F9D74'];

/** Profile picture, or a coloured initial when there isn't one. `online` adds the green presence dot. */
export default function Avatar({ user, size = 44, online = false }) {
  const name = user?.username || '?';
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {user?.avatar ? (
        <img src={optimize(user.avatar, size * 2)} alt="" loading="lazy" />
      ) : (
        <span className="avatar-fallback" style={{ background: COLORS[name.charCodeAt(0) % COLORS.length] }}>{name[0].toUpperCase()}</span>
      )}
      {online && <i className="presence" title="Online" />}
    </span>
  );
}
