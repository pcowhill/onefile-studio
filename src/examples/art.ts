/**
 * Original vector artwork (created for OneFile Studio) used by component
 * defaults and the example projects. Embedded as base64 SVG data URLs.
 */
import type { Asset } from '../model/types';

export function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv${(h >>> 0).toString(16)}-${s.length}`;
}

function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function svgAsset(id: string, name: string, svg: string, width: number, height: number): Asset {
  const data = `data:image/svg+xml;base64,${b64(svg)}`;
  return { id, name, mime: 'image/svg+xml', data, width, height, bytes: Math.floor((data.length - 26) * 0.75), hash: fnv(data) };
}

const wrap = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

/** Valley landscape. `vivid=false` renders the muted, wintry "before" version. */
export function valley(vivid: boolean): string {
  const c = vivid
    ? {
        sky1: '#ff9a8b',
        sky2: '#ffd3a5',
        sun: '#fff3b0',
        far: '#a77bca',
        mid: '#6d4aff',
        near: '#2bb673',
        near2: '#1f9d5f',
        lake: '#7fd6ff',
        lake2: '#4fb3ff',
        tree: '#137a4a',
        trunk: '#7a4a2a',
        flower: '#ff5d73',
        flower2: '#ffd23f',
        cloud: '#ffffff',
      }
    : {
        sky1: '#c9ccd6',
        sky2: '#eef0f4',
        sun: '#f6f7fa',
        far: '#b3b7c4',
        mid: '#9196a6',
        near: '#d9dce3',
        near2: '#c6cad3',
        lake: '#aab3c2',
        lake2: '#99a3b4',
        tree: '#6f7484',
        trunk: '#5d6170',
        flower: '#ffffff',
        flower2: '#ffffff',
        cloud: '#f7f8fa',
      };
  const trees = [140, 210, 1010, 1080, 1150]
    .map((x, i) => {
      const s = 1 + (i % 2) * 0.25;
      return `<g transform="translate(${x} ${560 - i * 6}) scale(${s})"><rect x="-7" y="40" width="14" height="40" fill="${c.trunk}" rx="4"/><path d="M0 -60 L44 40 L-44 40Z" fill="${c.tree}"/><path d="M0 -95 L34 -10 L-34 -10Z" fill="${c.tree}"/></g>`;
    })
    .join('');
  const flowers = vivid
    ? Array.from({ length: 26 }, (_, i) => {
        const x = 60 + ((i * 197) % 1080);
        const y = 690 + ((i * 53) % 90);
        return `<circle cx="${x}" cy="${y}" r="${7 + (i % 3) * 2}" fill="${i % 2 ? c.flower : c.flower2}"/>`;
      }).join('')
    : Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 131) % 1200}" cy="${(i * 71) % 520}" r="${2 + (i % 3)}" fill="#ffffff" opacity=".9"/>`).join('');
  return wrap(
    1200,
    800,
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky1}"/><stop offset="1" stop-color="${c.sky2}"/></linearGradient><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.lake}"/><stop offset="1" stop-color="${c.lake2}"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#s)"/>
    <circle cx="880" cy="230" r="${vivid ? 110 : 90}" fill="${c.sun}" opacity="${vivid ? 1 : 0.8}"/>
    <g fill="${c.cloud}" opacity=".85"><ellipse cx="260" cy="170" rx="110" ry="34"/><ellipse cx="330" cy="150" rx="70" ry="40"/><ellipse cx="640" cy="110" rx="90" ry="26"/></g>
    <path d="M0 470 L180 300 L320 420 L470 250 L640 430 L780 320 L960 450 L1090 330 L1200 420 L1200 800 L0 800Z" fill="${c.far}"/>
    ${vivid ? '' : '<path d="M180 300 L220 338 L200 350 L160 340Z M470 250 L520 300 L480 310 L440 290Z M1090 330 L1130 368 L1100 372 L1060 360Z" fill="#ffffff"/>'}
    <path d="M0 560 C200 470 350 520 520 500 C700 480 860 430 1200 520 L1200 800 L0 800Z" fill="${c.mid}" opacity="${vivid ? 0.85 : 1}"/>
    <path d="M0 610 C260 560 420 600 600 590 C820 580 980 560 1200 600 L1200 800 L0 800Z" fill="${c.near}"/>
    <ellipse cx="620" cy="660" rx="330" ry="58" fill="url(#l)"/>
    <path d="M0 700 C300 660 700 690 1200 670 L1200 800 L0 800Z" fill="${c.near2}"/>
    ${trees}${flowers}`,
  );
}

const SCENES = {
  ocean: { sky: ['#4facfe', '#00f2fe'], sea: ['#0061a8', '#00a6d6'], sun: '#ffe66d', label: 'Ocean' },
  desert: { sky: ['#f6d365', '#fda085'], sea: ['#e07a3f', '#f4a261'], sun: '#fff7d6', label: 'Desert' },
  aurora: { sky: ['#0f0c29', '#302b63'], sea: ['#11998e', '#38ef7d'], sun: '#f0f3ff', label: 'Aurora' },
};

export function scene(kind: keyof typeof SCENES): string {
  const s = SCENES[kind];
  let body = `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sea[0]}"/><stop offset="1" stop-color="${s.sea[1]}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#a)"/>`;
  if (kind === 'ocean') {
    body += `<circle cx="600" cy="420" r="150" fill="${s.sun}"/><rect y="440" width="1200" height="360" fill="url(#b)"/>`;
    for (let i = 0; i < 7; i++)
      body += `<path d="M${-100 + i * 40} ${490 + i * 45} q 75 -28 150 0 t 150 0 t 150 0 t 150 0 t 150 0 t 150 0 t 150 0 t 150 0 t 150 0" fill="none" stroke="#ffffff" stroke-opacity="${0.55 - i * 0.05}" stroke-width="7" stroke-linecap="round"/>`;
    body += `<path d="M840 560 l60 -150 l10 150z" fill="#ffffff"/><path d="M800 565 h150 l-25 30 h-100z" fill="#ff5d73"/>`;
  } else if (kind === 'desert') {
    body += `<circle cx="860" cy="260" r="120" fill="${s.sun}"/><path d="M0 520 C250 430 500 470 700 520 C900 570 1050 480 1200 470 V800 H0Z" fill="#f4a261"/><path d="M0 640 C300 560 600 600 800 650 C950 690 1100 620 1200 610 V800 H0Z" fill="url(#b)"/>`;
    body += `<g fill="#2a9d8f" transform="translate(300 420)"><rect x="-22" y="0" width="44" height="230" rx="22"/><rect x="-80" y="60" width="34" height="100" rx="17"/><rect x="-80" y="130" width="80" height="30" rx="15"/><rect x="46" y="30" width="34" height="90" rx="17"/><rect x="0" y="100" width="80" height="30" rx="15"/></g>`;
  } else {
    for (let i = 0; i < 60; i++)
      body += `<circle cx="${(i * 197) % 1200}" cy="${(i * 89) % 430}" r="${1.5 + (i % 3)}" fill="#ffffff" opacity="${0.5 + (i % 5) * 0.1}"/>`;
    body += `<path d="M0 300 C200 180 400 380 620 240 C820 120 1000 300 1200 200 L1200 330 C1000 420 820 260 620 370 C400 500 200 300 0 420Z" fill="url(#b)" opacity=".55"/><circle cx="960" cy="140" r="52" fill="${s.sun}"/><circle cx="982" cy="128" r="46" fill="${s.sky[0]}"/>`;
    body += `<path d="M0 640 L120 520 L230 610 L380 470 L520 600 L660 500 L820 620 L960 520 L1100 610 L1200 560 V800 H0Z" fill="#090720"/>`;
  }
  return wrap(1200, 800, body);
}

/** Puff, an original round space critter used in the clicker game. */
export function puff(): string {
  return wrap(
    600,
    600,
    `<defs><radialGradient id="g" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffb6e1"/><stop offset=".55" stop-color="#ff6fb5"/><stop offset="1" stop-color="#c2338a"/></radialGradient><radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="300" cy="330" rx="285" ry="70" fill="none" stroke="#ffd23f" stroke-width="26" transform="rotate(-14 300 330)" opacity=".95"/>
    <circle cx="300" cy="300" r="200" fill="url(#g)"/>
    <ellipse cx="225" cy="200" rx="70" ry="44" fill="url(#h)" transform="rotate(-25 225 200)"/>
    <circle cx="190" cy="390" r="26" fill="#c2338a" opacity=".35"/><circle cx="410" cy="250" r="18" fill="#c2338a" opacity=".3"/><circle cx="380" cy="420" r="14" fill="#c2338a" opacity=".3"/>
    <g fill="#2a1840"><ellipse cx="240" cy="300" rx="24" ry="32"/><ellipse cx="360" cy="300" rx="24" ry="32"/></g>
    <g fill="#fff"><circle cx="248" cy="288" r="9"/><circle cx="368" cy="288" r="9"/></g>
    <path d="M262 362 q38 34 76 0" fill="none" stroke="#2a1840" stroke-width="12" stroke-linecap="round"/>
    <g fill="#ff3d7f" opacity=".55"><ellipse cx="200" cy="350" rx="26" ry="14"/><ellipse cx="400" cy="350" rx="26" ry="14"/></g>
    <path d="M85 270 C40 300 40 360 90 400" fill="none" stroke="#ffd23f" stroke-width="26" stroke-linecap="round" transform="rotate(-14 300 330)" opacity=".95"/>`,
  );
}

/** Rocket illustration for the presentation example. */
export function rocket(): string {
  return wrap(
    800,
    800,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d4aff"/><stop offset="1" stop-color="#ff7eb3"/></linearGradient><linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff5d73"/></linearGradient></defs>
    <circle cx="400" cy="400" r="380" fill="url(#bg)"/>
    ${Array.from({ length: 24 }, (_, i) => `<circle cx="${120 + ((i * 167) % 560)}" cy="${110 + ((i * 113) % 560)}" r="${3 + (i % 3) * 2}" fill="#fff" opacity=".7"/>`).join('')}
    <g transform="rotate(35 400 400)">
      <path d="M400 560 C370 640 380 690 400 740 C420 690 430 640 400 560Z" fill="url(#fl)"/>
      <path d="M330 470 L270 560 L340 545Z" fill="#ff5d73"/><path d="M470 470 L530 560 L460 545Z" fill="#ff5d73"/>
      <path d="M400 130 C480 200 500 330 470 560 H330 C300 330 320 200 400 130Z" fill="#ffffff"/>
      <path d="M400 130 C440 165 465 210 478 262 H322 C335 210 360 165 400 130Z" fill="#ff5d73"/>
      <circle cx="400" cy="360" r="52" fill="#2a1840"/><circle cx="400" cy="360" r="36" fill="#7fd6ff"/><circle cx="388" cy="348" r="10" fill="#fff" opacity=".8"/>
      <rect x="370" y="540" width="60" height="30" rx="8" fill="#9a90c4"/>
    </g>`,
  );
}

/** Lightbulb idea illustration. */
export function bulb(): string {
  return wrap(
    800,
    800,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9a3c"/></linearGradient></defs>
    <rect width="800" height="800" rx="80" fill="url(#bg)"/>
    <g stroke="#fff" stroke-width="22" stroke-linecap="round" opacity=".9"><path d="M400 70v60M180 160l42 42M620 160l-42 42M100 380h60M640 380h60"/></g>
    <path d="M400 190 C300 190 230 270 230 360 C230 430 270 470 310 520 C330 545 335 570 335 600 H465 C465 570 470 545 490 520 C530 470 570 430 570 360 C570 270 500 190 400 190Z" fill="#fff"/>
    <rect x="330" y="615" width="140" height="34" rx="14" fill="#2a1840"/><rect x="345" y="660" width="110" height="34" rx="14" fill="#2a1840"/>
    <path d="M350 440 l30 -60 l40 60 l30 -60" fill="none" stroke="#ff9a3c" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

export const SAMPLE_IDS = {
  before: 'as_sample_valley_before',
  after: 'as_sample_valley_after',
  ocean: 'as_sample_ocean',
  desert: 'as_sample_desert',
  aurora: 'as_sample_aurora',
};

let cache: Record<string, Asset> | null = null;
/** Lazily-built sample assets (used to make new components work immediately). */
export function sampleAssets(): Record<string, Asset> {
  if (cache) return cache;
  cache = {
    [SAMPLE_IDS.before]: svgAsset(SAMPLE_IDS.before, 'Valley in winter', valley(false), 1200, 800),
    [SAMPLE_IDS.after]: svgAsset(SAMPLE_IDS.after, 'Valley in spring', valley(true), 1200, 800),
    [SAMPLE_IDS.ocean]: svgAsset(SAMPLE_IDS.ocean, 'Ocean', scene('ocean'), 1200, 800),
    [SAMPLE_IDS.desert]: svgAsset(SAMPLE_IDS.desert, 'Desert', scene('desert'), 1200, 800),
    [SAMPLE_IDS.aurora]: svgAsset(SAMPLE_IDS.aurora, 'Aurora', scene('aurora'), 1200, 800),
  };
  return cache;
}
