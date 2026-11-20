import type { CaptureSource } from '../../io/capture';

/** Colourful SVG illustrations for the Capture cards (same family as the Insert catalog's). */
export function CaptureIllustration({ id, size = 'sm' }: { id: CaptureSource; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'ed-cap-art-lg' : undefined;
  const screen = (fill = 'url(#cap-scr)') => (
    <>
      <rect x="8" y="7" width="48" height="30" rx="4" fill={fill} />
      <rect x="11" y="10" width="42" height="24" rx="2" fill="#fff" opacity=".92" />
      <rect x="27" y="37" width="10" height="4" fill="#b9b2d9" />
      <rect x="20" y="41" width="24" height="3" rx="1.5" fill="#b9b2d9" />
    </>
  );
  const defs = (
    <defs>
      <linearGradient id="cap-scr" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7c5cff" />
        <stop offset="1" stopColor="#4a2fd9" />
      </linearGradient>
      <linearGradient id="cap-cam" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff8fb8" />
        <stop offset="1" stopColor="#e5487f" />
      </linearGradient>
      <linearGradient id="cap-mic" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3ddc97" />
        <stop offset="1" stopColor="#0e9f6e" />
      </linearGradient>
      <linearGradient id="cap-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bfe3ff" />
        <stop offset="1" stopColor="#e9f5ff" />
      </linearGradient>
    </defs>
  );
  const rec = (cx: number, cy: number) => (
    <>
      <circle cx={cx} cy={cy} r="6.5" fill="#fff" />
      <circle cx={cx} cy={cy} r="4.2" fill="#e5484d" />
    </>
  );
  const webcam = (x: number, y: number, s = 1) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="22" height="18" rx="5" fill="url(#cap-cam)" />
      <circle cx="11" cy="9" r="5.5" fill="#fff" />
      <circle cx="11" cy="9" r="3" fill="#4b1d3a" />
      <circle cx="12.2" cy="7.8" r="1" fill="#fff" />
    </g>
  );
  switch (id) {
    case 'screenshot':
      return (
        <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
          {defs}
          {screen()}
          <path d="M16 26l7-7 5 5 4-4 9 9" fill="none" stroke="#7c5cff" strokeWidth="2.4" strokeLinejoin="round" opacity=".55" />
          <circle cx="40" cy="16" r="2.6" fill="#ffc94d" />
          <path d="M5 13V5h8M59 13V5h-8M5 31v8h8M59 31v8h-8" fill="none" stroke="#ff7eb3" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case 'screen':
      return (
        <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
          {defs}
          {screen()}
          <path d="M19 15h18M19 20h26M19 25h12" stroke="#cfc8ef" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M36 21l9 4-3.6 1.3L40 30l-1.8.7-1.5-3.7-3 2.2z" fill="#1d1b2c" />
          {rec(50, 12)}
        </svg>
      );
    case 'webcam':
      return (
        <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
          {defs}
          <rect x="12" y="8" width="40" height="30" rx="6" fill="url(#cap-sky)" />
          <circle cx="32" cy="22" r="6.5" fill="#ffcf9e" />
          <path d="M20 38c1-7 6-10 12-10s11 3 12 10z" fill="#7c5cff" />
          <path d="M25.6 19.5c.5-4.4 3.4-6.6 6.4-6.6s6 2.2 6.4 6.6c-2-1.6-4.2-2.4-6.4-2.4s-4.4.8-6.4 2.4z" fill="#4b2f1a" />
          {rec(48, 13)}
          <rect x="27" y="40" width="10" height="4" rx="2" fill="#b9b2d9" />
        </svg>
      );
    case 'photo':
      return (
        <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
          {defs}
          <path d="M10 14h10l3-5h18l3 5h10v24H10z" fill="url(#cap-cam)" />
          <circle cx="32" cy="25" r="9.5" fill="#fff" />
          <circle cx="32" cy="25" r="6" fill="#4b1d3a" />
          <circle cx="34" cy="23" r="1.8" fill="#fff" />
          <circle cx="48" cy="18" r="1.8" fill="#ffe3f1" />
          <path d="M52 6l1.2 3 3 1.2-3 1.2L52 14.5l-1.2-3.1-3-1.2 3-1.2z" fill="#ffc94d" />
        </svg>
      );
    case 'microphone':
      return (
        <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
          {defs}
          <rect x="25" y="6" width="14" height="24" rx="7" fill="url(#cap-mic)" />
          <path d="M28 12h8M28 16.5h8M28 21h8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
          <path d="M20 22a12 12 0 0 0 24 0" fill="none" stroke="#4b4766" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M32 34v6M25 41h14" stroke="#4b4766" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M10 18v8M14 14v16M50 14v16M54 18v8" stroke="#3ddc97" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case 'screenCamera':
      return (
        <svg viewBox="0 0 64 48" className={cls} aria-hidden="true">
          {defs}
          {screen()}
          <path d="M16 16h18M16 21h24M16 26h10" stroke="#cfc8ef" strokeWidth="2.6" strokeLinecap="round" />
          {webcam(36, 18, 0.95)}
          {rec(53, 11)}
        </svg>
      );
  }
}
