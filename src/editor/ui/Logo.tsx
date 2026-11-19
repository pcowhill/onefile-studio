export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="ed-logo">
      <defs>
        <linearGradient id="ofs-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cff" />
          <stop offset="1" stopColor="#ff7eb3" />
        </linearGradient>
      </defs>
      <rect x="4" y="3" width="34" height="42" rx="9" fill="url(#ofs-logo-g)" />
      <path d="M28 3 h1 a9 9 0 0 1 9 9 v1 h-6 a4 4 0 0 1 -4 -4z" fill="#fff" opacity=".45" />
      <path d="M17 17 l5 -3 v20" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="39" cy="38" r="7" fill="#ffd23f" stroke="#fff" strokeWidth="2.5" />
      <path d="M36.5 38.2 l1.8 1.8 3.3 -3.6" fill="none" stroke="#2a2340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
