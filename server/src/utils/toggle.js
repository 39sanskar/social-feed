/**
 * Race-condition-safe on/off switch for "edge" documents (like, bookmark,
 * follow, repost). We simply TRY to create the edge; the unique index makes a
 * duplicate fail with code 11000, which tells us it already existed, so we
 * remove it instead. Counters only change when a document really was
 * created/removed, so they can never drift, even with double clicks.
 *
 * @returns {Promise<boolean>} true = now ON, false = now OFF
 */
export async function toggle({ create, remove, inc = async () => {} }) {
  try {
    await create();
    await inc(1);
    return true;
  } catch (e) {
    if (e.code !== 11000) throw e;
    const r = await remove();
    if (r.deletedCount) await inc(-1);
    return false;
  }
}
