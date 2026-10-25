// Everything that turns raw Post documents into what the client displays:
// populating authors / embedded posts, attaching the viewer's own state
// (liked / bookmarked / reposted), filtering muted content and paginating.
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import { Like, Bookmark } from '../models/edges.js';
import { escapeRegex } from '../utils/text.js';

export const PAGE = 15;
const AUTHOR = 'username displayName avatar verifiedBadge active';

export const postPopulate = [
  { path: 'author', select: AUTHOR },
  { path: 'parent', select: 'author', populate: { path: 'author', select: 'username' } }, // "Replying to @x"
  { path: 'repostOf', populate: { path: 'author', select: AUTHOR } },
  { path: 'quoteOf', populate: { path: 'author', select: AUTHOR } },
];

/** Authors the viewer never wants to see in feeds. */
export const hiddenAuthors = (viewer) => [...viewer.blocked, ...viewer.muted];

/** Adds `viewer: {liked, bookmarked, reposted}` to posts (and embedded posts)
 *  using 3 batched queries for the whole page instead of 3 per post. */
export async function present(posts, viewer) {
  const mutedRx = viewer.mutedWords?.length ? new RegExp(viewer.mutedWords.map(escapeRegex).join('|'), 'i') : null;

  const visible = posts.filter((p) => {
    if (!p.author?.active) return false; // author deleted/deactivated
    if (p.kind === 'repost' && !p.repostOf?.author?.active) return false; // original gone
    const text = p.kind === 'repost' ? p.repostOf.text : p.text;
    return !(mutedRx && mutedRx.test(text || ''));
  });

  const ids = new Set();
  for (const p of visible) [p._id, p.repostOf?._id, p.quoteOf?._id].filter(Boolean).forEach((id) => ids.add(String(id)));
  const list = [...ids];

  const [liked, saved, reposted] = await Promise.all([
    Like.find({ user: viewer._id, post: { $in: list } }).distinct('post'),
    Bookmark.find({ user: viewer._id, post: { $in: list } }).distinct('post'),
    Post.find({ author: viewer._id, kind: 'repost', repostOf: { $in: list } }).distinct('repostOf'),
  ]);
  const L = new Set(liked.map(String));
  const B = new Set(saved.map(String));
  const R = new Set(reposted.map(String));
  const flag = (p) => ({ ...p, viewer: { liked: L.has(String(p._id)), bookmarked: B.has(String(p._id)), reposted: R.has(String(p._id)) } });

  return visible.map((p) => ({ ...flag(p), repostOf: p.repostOf && flag(p.repostOf), quoteOf: p.quoteOf && flag(p.quoteOf) }));
}

/** Cursor pagination on _id (ObjectIds are time-ordered). Unlike skip/limit it
 *  stays fast on deep pages and never duplicates items when new posts arrive. */
export async function timeline(filter, viewer, cursor, { asc = false, hide = true } = {}) {
  const and = [filter];
  if (hide) {
    const hidden = hiddenAuthors(viewer);
    if (hidden.length) and.push({ author: { $nin: hidden } });
  }
  if (cursor && mongoose.isValidObjectId(cursor)) and.push({ _id: { [asc ? '$gt' : '$lt']: cursor } });

  const docs = await Post.find({ $and: and }).sort({ _id: asc ? 1 : -1 }).limit(PAGE + 1).populate(postPopulate).lean();
  const slice = docs.slice(0, PAGE);
  return { items: await present(slice, viewer), nextCursor: docs.length > PAGE ? String(slice.at(-1)._id) : null };
}

/** Same idea for "edge" collections (bookmarks, likes) that point at posts. */
export async function edgeTimeline(Model, filter, viewer, cursor) {
  const q = { ...filter };
  if (cursor && mongoose.isValidObjectId(cursor)) q._id = { $lt: cursor };
  const edges = await Model.find(q).sort({ _id: -1 }).limit(PAGE + 1).populate({ path: 'post', populate: postPopulate }).lean();
  const slice = edges.slice(0, PAGE);
  const items = await present(slice.map((e) => e.post).filter(Boolean), viewer);
  return { items, nextCursor: edges.length > PAGE ? String(slice.at(-1)._id) : null };
}
