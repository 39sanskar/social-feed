/** Loading placeholders shaped like the content that will replace them. */
export const PostSkeleton = () => (
  <div className="post skeleton-post" aria-hidden="true">
    <div className="skeleton circle" />
    <div className="grow">
      <div className="skeleton line w40" />
      <div className="skeleton line" />
      <div className="skeleton line w70" />
    </div>
  </div>
);
export const RowSkeleton = () => (
  <div className="user-row" aria-hidden="true"><div className="skeleton circle" /><div className="grow"><div className="skeleton line w40" /><div className="skeleton line w70" /></div></div>
);
export const Skeletons = ({ n = 3, row = false }) => <div role="status" aria-label="Loading">{Array.from({ length: n }, (_, i) => (row ? <RowSkeleton key={i} /> : <PostSkeleton key={i} />))}</div>;
