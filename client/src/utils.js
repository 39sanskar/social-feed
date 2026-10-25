export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** 1200 → "1.2K" */
export const compact = (n = 0) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** Asks Cloudinary for a smaller, auto-format version (f_auto,q_auto) of an uploaded image.
 *  Other URLs (local uploads) are returned unchanged. */
export const optimize = (url, width = 900) =>
  url?.includes('res.cloudinary.com') && url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`) : url;

export const NOTIF_TEXT = {
  like: 'liked your post',
  reply: 'replied to your post',
  repost: 'reposted your post',
  quote: 'quoted your post',
  follow: 'followed you',
  mention: 'mentioned you',
};

/** Browser-side file checks (UX only: the server re-validates everything). */
export function checkMedia(file) {
  const isVideo = file.type.startsWith('video/');
  if (!isVideo && !file.type.startsWith('image/')) return 'Only images and videos can be attached';
  if (isVideo && file.size > 25 * 1024 * 1024) return 'Videos can be up to 25 MB';
  if (!isVideo && file.size > 8 * 1024 * 1024) return 'Images can be up to 8 MB';
  return null;
}
