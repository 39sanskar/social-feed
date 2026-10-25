import { Skeletons } from './Skeleton.jsx';

/**
 * Renders any useInfinite() list: items, skeletons while loading, an error
 * with retry, an empty state, and the invisible sentinel that triggers the next page.
 */
export default function FeedList({ inf, render, empty, row = false }) {
  const { items, loading, error, done, sentinelRef, retry } = inf;
  return (
    <>
      {items.map(render)}
      {loading && <Skeletons n={items.length ? 1 : 3} row={row} />}
      {error && (
        <div className="state" role="alert">
          <p className="error">{error}</p>
          <button className="btn" onClick={retry}>Try again</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (empty || <div className="state"><p>Nothing here yet.</p></div>)}
      {!done && !error && <div ref={sentinelRef} style={{ height: 1 }} />}
    </>
  );
}
