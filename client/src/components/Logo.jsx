import { useId } from 'react';

/**
 * Social-Feed identity: an "S" drawn as ONE continuous ribbon (a feed that
 * never stops scrolling) with a ghost copy offset behind it for depth.
 * Variants: <LogoMark/> (favicon, avatar, loading) and <Logo/> (mark + wordmark).
 */
export function LogoMark({ size = 36, tile = false }) {
  const id = useId();
  const S = 'M70 30C70 14 30 12 30 34C30 52 70 46 70 68C70 90 30 88 30 70';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Social-Feed">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset=".55" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      {tile && <rect width="100" height="100" rx="24" fill="#0b1030" />}
      <path d={S} transform="translate(7 6)" fill="none" stroke={`url(#${id})`} strokeWidth="15" strokeLinecap="round" opacity=".28" />
      <path d={S} fill="none" stroke={`url(#${id})`} strokeWidth="15" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 34, wordmark = true }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {wordmark && (
        <span className="wordmark" style={{ fontSize: size * 0.66 }}>
          𝓢𝓸𝓬𝓲𝓪𝓵<span className="grad-text">𝓕𝓮𝓮𝓭</span>
        </span>
      )}
    </span>
  );
}
