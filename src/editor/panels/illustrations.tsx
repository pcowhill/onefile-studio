import { SHAPE_PATHS } from '../../runtime/elements/shape';

/** Small colourful SVG illustrations for the Insert catalog. */
export function CatalogIllustration({ id }: { id: string }) {
  const v = '0 0 64 48';
  const grad = (gid: string, a: string, b: string) => (
    <defs>
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={a} />
        <stop offset="1" stopColor={b} />
      </linearGradient>
    </defs>
  );
  const shape = (kind: string, a: string, b: string) => (
    <svg viewBox={v}>
      {grad(`g-${kind}`, a, b)}
      {kind === 'rect' ? (
        <rect x="12" y="8" width="40" height="32" rx="8" fill={`url(#g-${kind})`} />
      ) : kind === 'ellipse' ? (
        <circle cx="32" cy="24" r="17" fill={`url(#g-${kind})`} />
      ) : (
        <g transform="translate(14 6) scale(0.36)">
          <path d={SHAPE_PATHS[kind]} fill={`url(#g-${kind})`} />
        </g>
      )}
    </svg>
  );
  switch (id) {
    case 'heading':
      return (
        <svg viewBox={v}>
          <text x="32" y="33" textAnchor="middle" fontSize="26" fontWeight="900" fill="#6d4aff" fontFamily="'OFS Nunito', system-ui">
            Aa
          </text>
        </svg>
      );
    case 'subheading':
      return (
        <svg viewBox={v}>
          <text x="32" y="28" textAnchor="middle" fontSize="16" fontWeight="800" fill="#4b4766" fontFamily="'OFS Nunito', system-ui">
            Aa
          </text>
          <rect x="16" y="33" width="32" height="3" rx="1.5" fill="#cfc8ef" />
        </svg>
      );
    case 'body':
      return (
        <svg viewBox={v}>
          {[12, 19, 26, 33].map((y, i) => (
            <rect key={y} x="12" y={y} width={i === 3 ? 24 : 40} height="3.5" rx="1.75" fill="#b9b2d9" />
          ))}
        </svg>
      );
    case 'tag':
      return (
        <svg viewBox={v}>
          <rect x="12" y="16" width="40" height="16" rx="8" fill="#ffe3f1" />
          <text x="32" y="27.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#d63384" letterSpacing="1" fontFamily="system-ui">
            NEW
          </text>
        </svg>
      );
    case 'shape-rect':
      return shape('rect', '#8b6cff', '#5b3df5');
    case 'shape-ellipse':
      return shape('ellipse', '#ffb86c', '#ff6b6b');
    case 'shape-star':
      return shape('star', '#ffe66d', '#ffb100');
    case 'shape-heart':
      return shape('heart', '#ff9ac1', '#ff4d8d');
    case 'shape-triangle':
      return shape('triangle', '#7ef0c1', '#14b8a6');
    case 'shape-blob':
      return shape('blob', '#9be7ff', '#3d8bff');
    case 'arrow':
      return (
        <svg viewBox={v}>
          <path d="M10 24 H46" stroke="#ff5d73" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M54 24 L42 16 L42 32Z" fill="#ff5d73" stroke="#ff5d73" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case 'arrow-curved':
      return (
        <svg viewBox={v}>
          <path d="M10 36 Q30 4 48 22" fill="none" stroke="#6d4aff" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M55 30 L43 27 L52 17Z" fill="#6d4aff" stroke="#6d4aff" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case 'image':
      return (
        <svg viewBox={v}>
          <rect x="10" y="8" width="44" height="32" rx="6" fill="#d9f7ee" />
          <circle cx="22" cy="18" r="4" fill="#ffd23f" />
          <path d="M10 34 L24 22 L33 30 L40 24 L54 36 V34 a6 6 0 0 1 -6 6 H16 a6 6 0 0 1 -6 -6Z" fill="#00b894" />
        </svg>
      );
    case 'button':
      return (
        <svg viewBox={v}>
          <rect x="8" y="17" width="48" height="16" rx="8" fill="#2a64c9" />
          <rect x="8" y="14" width="48" height="16" rx="8" fill="#3d8bff" />
          <rect x="20" y="20.5" width="24" height="3.5" rx="1.75" fill="#fff" />
        </svg>
      );
    case 'link-button':
      return (
        <svg viewBox={v}>
          <rect x="6" y="17" width="52" height="16" rx="8" fill="#0e7490" />
          <rect x="6" y="14" width="52" height="16" rx="8" fill="#0891b2" />
          <rect x="13" y="20.5" width="20" height="3.5" rx="1.75" fill="#fff" />
          <path d="M42 26.5l7-7M44 19.5h5v5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M36 38h22" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="1 3.5" opacity=".6" />
        </svg>
      );
    case 'next':
    case 'back': {
      const back = id === 'back';
      return (
        <svg viewBox={v}>
          <rect x="8" y="14" width="48" height="20" rx="10" fill={back ? '#e2ecff' : '#3d8bff'} />
          <rect x={back ? 28 : 16} y="22.25" width="18" height="3.5" rx="1.75" fill={back ? '#3d8bff' : '#fff'} />
          <path
            d={back ? 'M24 19 L19 24 L24 29' : 'M40 19 L45 24 L40 29'}
            fill="none"
            stroke={back ? '#3d8bff' : '#fff'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    case 'beforeAfter':
      return (
        <svg viewBox={v}>
          <rect x="8" y="8" width="48" height="32" rx="5" fill="#ffb27a" />
          <path d="M8 13 a5 5 0 0 1 5 -5 H32 V40 H13 a5 5 0 0 1 -5 -5Z" fill="#c9ccd6" />
          <path d="M8 32 L20 22 L32 30 V40 H13 a5 5 0 0 1 -5 -5Z" fill="#9196a6" />
          <path d="M32 30 L44 20 L56 32 V35 a5 5 0 0 1 -5 5 H32Z" fill="#2bb673" />
          <rect x="31" y="6" width="2.5" height="36" rx="1.25" fill="#fff" />
          <circle cx="32.25" cy="24" r="6" fill="#fff" stroke="#e7e3f8" />
          <path d="M30 22 L28 24 L30 26 M34.5 22 L36.5 24 L34.5 26" fill="none" stroke="#6d4aff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'gallery':
      return (
        <svg viewBox={v}>
          <rect x="16" y="5" width="36" height="26" rx="5" fill="#ffd0e6" transform="rotate(8 34 18)" />
          <rect x="12" y="9" width="40" height="28" rx="5" fill="#e84393" />
          <circle cx="22" cy="18" r="3.5" fill="#ffe66d" />
          <path d="M12 32 L24 23 L32 29 L40 22 L52 32 a5 5 0 0 1 -5 5 H17 a5 5 0 0 1 -5 -5Z" fill="#a52a6c" />
          <circle cx="26" cy="43" r="2" fill="#e84393" />
          <circle cx="32" cy="43" r="2" fill="#f5b5d3" />
          <circle cx="38" cy="43" r="2" fill="#f5b5d3" />
        </svg>
      );
    case 'scrollText':
      return (
        <svg viewBox={v}>
          <rect x="12" y="5" width="40" height="38" rx="6" fill="#e2f7fc" />
          {[11, 17, 23, 29, 35].map((y, i) => (
            <rect key={y} x="17" y={y} width={i % 2 ? 22 : 26} height="3" rx="1.5" fill="#0abde3" opacity={1 - i * 0.15} />
          ))}
          <rect x="47" y="9" width="2.5" height="12" rx="1.25" fill="#0abde3" />
        </svg>
      );
    case 'progress':
      return (
        <svg viewBox={v}>
          {grad('g-prog', '#ff7eb3', '#6d4aff')}
          <rect x="8" y="20" width="48" height="9" rx="4.5" fill="#ece6ff" />
          <rect x="8" y="20" width="31" height="9" rx="4.5" fill="url(#g-prog)" />
        </svg>
      );
    case 'score':
      return (
        <svg viewBox={v}>
          <rect x="12" y="11" width="40" height="26" rx="8" fill="#8e44ad" />
          <text x="32" y="30" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff" fontFamily="'OFS Nunito', system-ui">
            42
          </text>
        </svg>
      );
    case 'video':
      return (
        <svg viewBox={v}>
          <rect x="8" y="8" width="48" height="32" rx="6" fill="#2a2340" />
          <rect x="8" y="8" width="48" height="7" rx="3" fill="#3b3356" />
          <circle cx="13" cy="11.5" r="1.4" fill="#ff5d73" />
          <circle cx="17.5" cy="11.5" r="1.4" fill="#ffd23f" />
          <circle cx="32" cy="27" r="8" fill="#ef4444" />
          <path d="M29.5 23.2v7.6l6.2-3.8z" fill="#fff" />
          <rect x="12" y="36" width="40" height="2" rx="1" fill="#5d5576" />
          <rect x="12" y="36" width="17" height="2" rx="1" fill="#ef4444" />
        </svg>
      );
    case 'model':
      return (
        <svg viewBox={v}>
          {grad('g-model', '#8b6cff', '#3d8bff')}
          <ellipse cx="32" cy="41" rx="17" ry="3.5" fill="#2a2340" opacity=".14" />
          <path d="M32 6l15 8.5v17L32 40 17 31.5v-17z" fill="url(#g-model)" />
          <path d="M32 6l15 8.5L32 23 17 14.5z" fill="#fff" opacity=".45" />
          <path d="M32 23v17l15-8.5v-17z" fill="#2a2340" opacity=".18" />
          <path d="M8 22a24 9 0 0 0 48 0" fill="none" stroke="#ff7eb3" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 5" />
          <path d="M53 18l3.5 4-5 1.2" fill="none" stroke="#ff7eb3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'audio':
      return (
        <svg viewBox={v}>
          <rect x="6" y="13" width="52" height="22" rx="11" fill="#e4f8f0" />
          <circle cx="17" cy="24" r="7" fill="#10b981" />
          <path d="M15.2 20.8v6.4l5-3.2z" fill="#fff" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect
              key={i}
              x={28 + i * 3.4}
              y={24 - [3, 6, 4, 8, 5, 7, 3, 5][i]}
              width="2"
              height={[3, 6, 4, 8, 5, 7, 3, 5][i] * 2}
              rx="1"
              fill={i < 4 ? '#10b981' : '#9fe3c8'}
            />
          ))}
        </svg>
      );
    case 'chart-bar':
      return (
        <svg viewBox={v}>
          <path d="M10 40h44" stroke="#d6d1e8" strokeWidth="2" strokeLinecap="round" />
          {[
            [13, 18, '#8b6cff'],
            [22, 12, '#ff7eb3'],
            [31, 24, '#8b6cff'],
            [40, 8, '#ff7eb3'],
          ].map(([x, y, c]) => (
            <rect key={String(x)} x={Number(x)} y={Number(y)} width="7" height={38 - Number(y)} rx="2.5" fill={String(c)} />
          ))}
          <rect x="49" y="15" width="5" height="23" rx="2" fill="#3d8bff" />
        </svg>
      );
    case 'chart-line':
      return (
        <svg viewBox={v}>
          <path d="M10 40h44" stroke="#d6d1e8" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 32 L22 24 L32 28 L42 14 L53 10 V38 H11Z" fill="#3d8bff" opacity=".14" />
          <path d="M11 32 L22 24 L32 28 L42 14 L53 10" fill="none" stroke="#3d8bff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M11 36 L22 33 L32 34 L42 27 L53 24" fill="none" stroke="#ff7eb3" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          {[
            [22, 24],
            [32, 28],
            [42, 14],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="2.6" fill="#fff" stroke="#3d8bff" strokeWidth="2" />
          ))}
        </svg>
      );
    case 'table':
      return (
        <svg viewBox={v}>
          <rect x="8" y="8" width="48" height="32" rx="5" fill="#fff" stroke="#d6eef6" strokeWidth="1.5" />
          <path d="M8 13a5 5 0 0 1 5-5h38a5 5 0 0 1 5 5v3H8z" fill="#0abde3" />
          <rect x="8" y="24" width="48" height="8" fill="#ecf9fd" />
          {[20, 28, 36].map((y) => (
            <g key={y}>
              <rect x="12" y={y - 1.5} width="12" height="3" rx="1.5" fill="#b9b2d9" />
              <rect x="30" y={y - 1.5} width="8" height="3" rx="1.5" fill="#b9b2d9" />
              <rect x="44" y={y - 1.5} width="8" height="3" rx="1.5" fill="#b9b2d9" />
            </g>
          ))}
        </svg>
      );
    case 'countdown':
      return (
        <svg viewBox={v}>
          {[8, 23, 38].map((x, i) => (
            <g key={x}>
              <rect x={x} y="12" width="13" height="18" rx="3.5" fill="#f39c12" />
              <text x={x + 6.5} y="25.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="'OFS Nunito', system-ui">
                {['07', '12', '45'][i]}
              </text>
              <rect x={x + 2} y="34" width="9" height="2.5" rx="1.25" fill="#f7c873" />
            </g>
          ))}
        </svg>
      );
    case 'quiz':
      return (
        <svg viewBox={v}>
          <rect x="10" y="6" width="44" height="6" rx="3" fill="#b9b2d9" />
          <rect x="10" y="16" width="44" height="8" rx="4" fill="#fde4f0" />
          <rect x="10" y="27" width="44" height="8" rx="4" fill="#e84393" />
          <rect x="10" y="38" width="44" height="6" rx="3" fill="#fde4f0" />
          <circle cx="15" cy="31" r="2.6" fill="#fff" />
          <path d="M44 31l2.4 2.4 4.6-4.8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox={v}>
          <circle cx="32" cy="24" r="12" fill="#6d4aff" />
        </svg>
      );
  }
}

/** Layout thumbnails for "add slide/section" templates. */
export function TemplateIllustration({ id }: { id: string }) {
  const bar = (x: number, y: number, w: number, h: number, fill: string, rx = 2) => <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} />;
  let body: React.ReactNode;
  let bg = '#ffffff';
  switch (id) {
    case 'title':
      bg = 'url(#tg1)';
      body = (
        <>
          {bar(22, 22, 56, 8, '#fff')}
          {bar(32, 34, 36, 4, '#e9e2ff')}
        </>
      );
      break;
    case 'titleText':
      bg = '#fbfaff';
      body = (
        <>
          {bar(10, 10, 10, 2, '#ff7eb3')}
          {bar(10, 15, 44, 7, '#1d1b2c')}
          {bar(10, 28, 60, 3, '#b9b2d9')}
          {bar(10, 35, 52, 3, '#b9b2d9')}
          {bar(10, 42, 40, 3, '#b9b2d9')}
        </>
      );
      break;
    case 'imageText':
      bg = '#fff8ef';
      body = (
        <>
          {bar(7, 8, 40, 40, '#00b894', 4)}
          {bar(54, 18, 36, 6, '#1d1b2c')}
          {bar(54, 29, 34, 3, '#b9b2d9')}
          {bar(54, 35, 28, 3, '#b9b2d9')}
        </>
      );
      break;
    case 'chartText':
      body = (
        <>
          {bar(8, 12, 30, 6, '#1d1b2c')}
          {bar(8, 23, 32, 3, '#b9b2d9')}
          {bar(8, 29, 26, 3, '#b9b2d9')}
          {bar(46, 8, 46, 40, '#f3f0ff', 4)}
          {bar(52, 30, 6, 14, '#8b6cff', 1.5)}
          {bar(61, 22, 6, 22, '#ff7eb3', 1.5)}
          {bar(70, 26, 6, 18, '#8b6cff', 1.5)}
          {bar(79, 16, 6, 28, '#ff7eb3', 1.5)}
        </>
      );
      break;
    case 'countdownSection':
      bg = '#fbfaff';
      body = (
        <>
          {bar(24, 9, 52, 6, '#1d1b2c')}
          {bar(18, 22, 18, 20, '#f39c12', 3)}
          {bar(41, 22, 18, 20, '#f39c12', 3)}
          {bar(64, 22, 18, 20, '#f39c12', 3)}
        </>
      );
      break;
    case 'statement':
      bg = '#2a2350';
      body = (
        <>
          {bar(16, 22, 68, 5, '#fff')}
          {bar(26, 31, 48, 5, '#fff')}
        </>
      );
      break;
    case 'hero':
      bg = 'url(#tg2)';
      body = (
        <>
          {bar(20, 16, 60, 7, '#fff')}
          {bar(28, 27, 44, 3, '#f4eeff')}
          {bar(38, 36, 24, 7, '#fff', 3.5)}
        </>
      );
      break;
    case 'textImage':
      body = (
        <>
          {bar(8, 16, 34, 6, '#1d1b2c')}
          {bar(8, 26, 36, 3, '#b9b2d9')}
          {bar(8, 32, 30, 3, '#b9b2d9')}
          {bar(52, 9, 40, 38, '#00b894', 4)}
        </>
      );
      break;
    case 'features':
      bg = '#fbfaff';
      body = (
        <>
          {bar(34, 6, 32, 5, '#1d1b2c')}
          {bar(8, 16, 26, 30, '#ffe3f1', 3)}
          {bar(37, 16, 26, 30, '#e8e2ff', 3)}
          {bar(66, 16, 26, 30, '#dcfbef', 3)}
        </>
      );
      break;
    case 'cta':
      bg = '#1b1834';
      body = (
        <>
          {bar(22, 16, 56, 6, '#fff')}
          {bar(36, 30, 28, 8, '#ffd23f', 4)}
        </>
      );
      break;
    default:
      body = (
        <g stroke="#cfc8ef" strokeWidth="2" strokeDasharray="4 3" fill="none">
          <rect x="6" y="6" width="88" height="44" rx="4" />
        </g>
      );
  }
  return (
    <svg viewBox="0 0 100 56" className="ed-template-art">
      <defs>
        <linearGradient id="tg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d4aff" />
          <stop offset="1" stopColor="#b06bff" />
        </linearGradient>
        <linearGradient id="tg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d4aff" />
          <stop offset="1" stopColor="#ff7eb3" />
        </linearGradient>
      </defs>
      <rect width="100" height="56" rx="5" fill={bg} />
      {body}
    </svg>
  );
}
