import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../api';

/**
 * Cursor-based infinite scrolling.
 *   fetchPage(cursor) must resolve to { items, nextCursor }.
 * The list resets whenever `deps` change (tab switch, different profile…) and
 * loads the next page when `sentinelRef` (an empty div at the bottom) scrolls
 * near the viewport. A request counter ignores answers from outdated requests.
 */
export default function useInfinite(fetchPage, deps = []) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const cursor = useRef(null);
  const doneRef = useRef(false);
  const busy = useRef(false);
  const seq = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const sentinelRef = useRef(null);

  const load = useCallback(async (reset = false) => {
    if (!reset && (busy.current || doneRef.current)) return;
    const mine = reset ? ++seq.current : seq.current;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const r = await fetchRef.current(reset ? null : cursor.current);
      if (mine !== seq.current) return; // a newer request replaced this one
      setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
      cursor.current = r.nextCursor;
      doneRef.current = !r.nextCursor;
      setDone(!r.nextCursor);
    } catch (e) {
      if (mine === seq.current) setError(errMsg(e));
    } finally {
      if (mine === seq.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setDone(false);
    doneRef.current = false;
    cursor.current = null;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // (re)attach the observer after every load: if the sentinel is still visible
  // (short page) the observer fires immediately and loads the next page
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done || loading || error) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && load(), { rootMargin: '500px' });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, done, loading, error, load]);

  const retry = () => load(items.length === 0);
  return { items, setItems, loading, error, done, sentinelRef, retry, reload: () => load(true) };
}
