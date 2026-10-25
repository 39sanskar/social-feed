// Ranking formulas. Kept as small pure functions so they are documented,
// transparent and unit-tested.

/** Weighted engagement: conversation and sharing count more than a like. */
export const engagement = (p) =>
  (p.likesCount || 0) + 2 * (p.repostsCount || 0) + 1.5 * (p.repliesCount || 0) + 2 * (p.quotesCount || 0);

/** "For you" score: engagement divided by an age penalty (similar to
 *  Hacker News gravity). Fresh posts get a chance, old ones fade out. */
export const feedScore = (p, now = Date.now()) => {
  const ageHours = Math.max(0, (now - new Date(p.createdAt).getTime()) / 36e5);
  return (engagement(p) + 1) / Math.pow(ageHours + 2, 1.5);
};

/** Trending score for a hashtag inside a time window. Different authors count
 *  the most, so one person spamming a tag cannot make it trend by themselves. */
export const trendScore = ({ uniqueAuthors, posts, engagement: eng }) => uniqueAuthors * 3 + posts + eng * 0.5;
