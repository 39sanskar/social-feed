import Post from '../models/Post.js';
import { config } from '../config/env.js';
import { trendScore } from '../utils/ranking.js';

// Trending = hashtags used in the last 24h, ranked by trendScore() (see
// utils/ranking.js): distinct authors weigh most, then volume, then engagement.
// Tags need `trendingMinAuthors` different authors so one person can't trend a tag.
// Result is cached for 60 s, so this aggregation runs at most once a minute.
let cache = { at: 0, data: [] };

export async function trendingTags(limit = 10) {
  if (Date.now() - cache.at < 60_000) return cache.data.slice(0, limit);
  const since = new Date(Date.now() - 24 * 36e5);
  const rows = await Post.aggregate([
    { $match: { createdAt: { $gte: since }, kind: { $in: ['post', 'quote', 'reply'] }, hashtags: { $exists: true, $ne: [] } } },
    { $unwind: '$hashtags' },
    { $group: { _id: '$hashtags', posts: { $sum: 1 }, authors: { $addToSet: '$author' }, eng: { $sum: { $add: ['$likesCount', { $multiply: ['$repostsCount', 2] }, '$repliesCount'] } } } },
    { $project: { posts: 1, engagement: '$eng', uniqueAuthors: { $size: '$authors' } } },
    { $match: { uniqueAuthors: { $gte: config.trendingMinAuthors } } },
  ]);
  const data = rows
    .map((r) => ({ tag: r._id, posts: r.posts, score: trendScore(r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  cache = { at: Date.now(), data };
  return data.slice(0, limit);
}
