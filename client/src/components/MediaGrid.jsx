import { useState } from 'react';
import { optimize } from '../utils.js';

/** 1–4 images/videos in a responsive grid. Posts flagged "sensitive" stay blurred until the viewer opts in. */
export default function MediaGrid({ media = [], sensitive = false }) {
  const [shown, setShown] = useState(!sensitive);
  if (!media.length) return null;
  return (
    <div className={`media-grid n${media.length}`}>
      {media.map((m, i) =>
        m.type === 'video' ? (
          <video key={i} src={m.url} controls preload="metadata" className={shown ? '' : 'blurred'} />
        ) : (
          <img key={i} src={optimize(m.url)} alt="Attached media" loading="lazy" className={shown ? '' : 'blurred'} />
        )
      )}
      {!shown && (
        <button className="sensitive-cover" onClick={(e) => { e.stopPropagation(); setShown(true); }}>
          <strong>Sensitive content</strong>
          <span>The author marked this post. Click to view.</span>
        </button>
      )}
    </div>
  );
}
