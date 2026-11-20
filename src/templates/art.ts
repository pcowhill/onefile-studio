/**
 * Original vector artwork for the project templates (created for OneFile
 * Studio, MIT like the rest of the code). Every picture is a placeholder the
 * author is expected to replace — they are deliberately friendly but generic.
 */
import type { Asset } from '../model/types';
import { svgAsset } from '../examples/art';

const wrap = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

/** A fictional "Brightdesk" help-desk app showing its new Smart Filters panel. */
export function screenshotArt(): Asset {
  const row = (i: number) => {
    const y = 232 + i * 58;
    const tags = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#dcfce7'];
    const tagInk = ['#1d4ed8', '#15803d', '#b45309', '#be185d', '#4338ca', '#15803d'];
    return `<rect x="432" y="${y}" width="728" height="48" rx="10" fill="${i === 1 ? '#eff6ff' : '#ffffff'}" stroke="${i === 1 ? '#93c5fd' : '#e2e8f0'}" stroke-width="2"/>
      <circle cx="458" cy="${y + 24}" r="11" fill="${['#f97316', '#2563eb', '#16a34a', '#db2777', '#7c3aed', '#0891b2'][i]}"/>
      <rect x="480" y="${y + 13}" width="${[210, 250, 180, 230, 200, 160][i]}" height="10" rx="5" fill="#0f172a"/>
      <rect x="480" y="${y + 29}" width="${[150, 120, 170, 110, 140, 130][i]}" height="7" rx="3.5" fill="#94a3b8"/>
      <rect x="850" y="${y + 14}" width="86" height="20" rx="10" fill="${tags[i]}"/><rect x="864" y="${y + 21}" width="58" height="6" rx="3" fill="${tagInk[i]}"/>
      <rect x="1060" y="${y + 18}" width="74" height="10" rx="5" fill="#cbd5e1"/>`;
  };
  const chip = (x: number, y: number, w: number, on: boolean) =>
    `<rect x="${x}" y="${y}" width="${w}" height="30" rx="15" fill="${on ? '#2563eb' : '#f1f5f9'}"/><rect x="${x + 14}" y="${y + 12}" width="${w - 28}" height="7" rx="3.5" fill="${on ? '#ffffff' : '#64748b'}"/>`;
  const body = `
  <rect width="1200" height="750" rx="26" fill="#f8fafc"/>
  <rect width="1200" height="56" rx="26" fill="#ffffff"/><rect y="28" width="1200" height="28" fill="#ffffff"/>
  <path d="M0 56H1200" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="30" cy="28" r="7" fill="#ff5f57"/><circle cx="52" cy="28" r="7" fill="#febc2e"/><circle cx="74" cy="28" r="7" fill="#28c840"/>
  <rect x="440" y="17" width="320" height="22" rx="11" fill="#f1f5f9"/>
  <rect x="0" y="56" width="220" height="694" fill="#0f172a"/>
  <rect x="26" y="82" width="34" height="34" rx="10" fill="#38bdf8"/><path d="M36 99l6 6 10-12" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="70" y="92" width="96" height="14" rx="7" fill="#e2e8f0"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i === 1 ? 14 : 26}" y="${150 + i * 46}" width="${i === 1 ? 192 : 120}" height="${i === 1 ? 36 : 10}" rx="${i === 1 ? 10 : 5}" fill="${i === 1 ? '#1e293b' : '#475569'}" ${i === 1 ? '' : 'transform="translate(0 13)"'}/>`).join('')}
  <rect x="40" y="163" width="100" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="252" y="84" width="300" height="22" rx="11" fill="#0f172a"/>
  <rect x="252" y="118" width="210" height="11" rx="5.5" fill="#94a3b8"/>
  <rect x="1010" y="80" width="150" height="40" rx="12" fill="#2563eb"/><rect x="1034" y="96" width="102" height="9" rx="4.5" fill="#ffffff"/>
  <rect x="252" y="160" width="160" height="560" rx="18" fill="#ffffff" stroke="#bfdbfe" stroke-width="3"/>
  <rect x="270" y="180" width="96" height="12" rx="6" fill="#1d4ed8"/>
  <rect x="270" y="204" width="122" height="7" rx="3.5" fill="#94a3b8"/>
  ${chip(270, 232, 96, true)}${chip(270, 272, 120, false)}${chip(270, 312, 84, true)}${chip(270, 352, 110, false)}
  <path d="M270 410H394" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="270" y="428" width="80" height="9" rx="4.5" fill="#475569"/>
  ${[0, 1, 2].map((i) => `<rect x="270" y="${456 + i * 34}" width="18" height="18" rx="5" fill="${i < 2 ? '#2563eb' : '#e2e8f0'}"/><rect x="298" y="${461 + i * 34}" width="${[70, 84, 60][i]}" height="8" rx="4" fill="#64748b"/>`).join('')}
  <rect x="270" y="580" width="124" height="38" rx="12" fill="#eff6ff"/><rect x="290" y="595" width="84" height="8" rx="4" fill="#2563eb"/>
  <rect x="432" y="160" width="728" height="54" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="462" cy="187" r="10" fill="none" stroke="#94a3b8" stroke-width="3"/><path d="M469 194l7 7" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
  <rect x="490" y="182" width="200" height="10" rx="5" fill="#cbd5e1"/>
  <rect x="960" y="172" width="86" height="30" rx="15" fill="#dbeafe"/><rect x="976" y="183" width="54" height="8" rx="4" fill="#1d4ed8"/>
  <rect x="1056" y="172" width="90" height="30" rx="15" fill="#dbeafe"/><rect x="1072" y="183" width="58" height="8" rx="4" fill="#1d4ed8"/>
  ${[0, 1, 2, 3, 4, 5].map(row).join('')}
  <rect x="432" y="586" width="728" height="134" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="452" y="606" width="140" height="10" rx="5" fill="#0f172a"/>
  ${[38, 52, 46, 70, 64, 88, 80, 96, 74, 90, 102, 94].map((v, i) => `<rect x="${456 + i * 56}" y="${706 - v * 0.7}" width="30" height="${v * 0.7}" rx="6" fill="${i === 11 ? '#2563eb' : '#bfdbfe'}"/>`).join('')}`;
  return svgAsset('as_tpl_screenshot', 'Feature screenshot (replace me)', wrap(1200, 750, body), 1200, 750);
}

/** A website redesign: `after=false` is the cluttered old page, `true` the bright new one. */
export function redesignArt(after: boolean): Asset {
  const W = 1200;
  const H = 800;
  let body: string;
  if (!after) {
    const links = Array.from({ length: 9 }, (_, i) => `<rect x="${40 + i * 124}" y="112" width="100" height="12" rx="2" fill="#4b5563"/>`).join('');
    const lines = (x: number, y: number, n: number, w: number) =>
      Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y + i * 18}" width="${w - (i % 3) * 30}" height="8" rx="1" fill="#9ca3af"/>`).join('');
    body = `<rect width="${W}" height="${H}" fill="#e5e7eb"/>
    <rect width="${W}" height="96" fill="#6b7280"/>
    <rect x="40" y="30" width="230" height="36" fill="#d1d5db"/><rect x="900" y="34" width="260" height="28" fill="#9ca3af"/>
    <rect y="96" width="${W}" height="44" fill="#d1d5db"/>${links}
    <rect x="40" y="166" width="760" height="230" fill="#9ca3af"/>
    <path d="M40 396 L240 260 L380 350 L520 240 L800 396Z" fill="#6b7280"/>
    <rect x="70" y="196" width="380" height="28" fill="#f3f4f6"/>
    <rect x="830" y="166" width="330" height="70" fill="#fca5a5"/><rect x="850" y="186" width="230" height="12" fill="#7f1d1d"/><rect x="850" y="208" width="160" height="10" fill="#7f1d1d"/>
    <rect x="830" y="252" width="330" height="144" fill="#d1d5db"/>${lines(850, 272, 6, 290)}
    <rect x="40" y="420" width="360" height="340" fill="#f3f4f6"/>${lines(60, 440, 15, 320)}
    <rect x="420" y="420" width="360" height="340" fill="#f3f4f6"/>${lines(440, 440, 15, 320)}
    <rect x="800" y="420" width="360" height="160" fill="#fde68a"/>${lines(820, 440, 6, 320)}
    <rect x="800" y="600" width="170" height="160" fill="#c4b5fd"/><rect x="990" y="600" width="170" height="160" fill="#93c5fd"/>
    <rect x="830" y="660" width="110" height="30" fill="#6b7280"/><rect x="1020" y="660" width="110" height="30" fill="#6b7280"/>`;
  } else {
    const card = (x: number, c1: string, c2: string, i: number) =>
      `<rect x="${x}" y="470" width="340" height="270" rx="28" fill="#ffffff"/><circle cx="${x + 60}" cy="530" r="30" fill="${c1}"/><path d="M${x + 46} 530 l10 10 l18 -20" stroke="${c2}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="${x + 30}" y="584" width="${[190, 220, 170][i]}" height="18" rx="9" fill="#1e1b4b"/><rect x="${x + 30}" y="618" width="270" height="10" rx="5" fill="#a5b4fc"/><rect x="${x + 30}" y="640" width="230" height="10" rx="5" fill="#c7d2fe"/><rect x="${x + 30}" y="662" width="250" height="10" rx="5" fill="#c7d2fe"/>`;
    body = `<defs><linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d4aff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="#eef2ff"/>
    <rect width="${W}" height="430" fill="url(#hero)"/>
    <rect x="60" y="36" width="40" height="40" rx="12" fill="#ffffff"/><rect x="114" y="48" width="120" height="16" rx="8" fill="#ffffff"/>
    ${[0, 1, 2].map((i) => `<rect x="${800 + i * 110}" y="50" width="80" height="12" rx="6" fill="#e0e7ff"/>`).join('')}
    <rect x="60" y="140" width="520" height="44" rx="14" fill="#ffffff"/><rect x="60" y="198" width="400" height="44" rx="14" fill="#ffffff"/>
    <rect x="60" y="266" width="440" height="14" rx="7" fill="#e0e7ff"/><rect x="60" y="292" width="360" height="14" rx="7" fill="#e0e7ff"/>
    <rect x="60" y="334" width="190" height="56" rx="28" fill="#ffd23f"/><rect x="96" y="356" width="118" height="12" rx="6" fill="#1e1b4b"/>
    <circle cx="900" cy="250" r="150" fill="#ffffff" opacity=".18"/>
    <rect x="740" y="140" width="330" height="230" rx="26" fill="#ffffff"/>
    <rect x="770" y="170" width="140" height="14" rx="7" fill="#1e1b4b"/>
    ${[50, 74, 62, 96, 84, 120].map((v, i) => `<rect x="${776 + i * 46}" y="${346 - v}" width="28" height="${v}" rx="8" fill="${i === 5 ? '#6d4aff' : '#c7d2fe'}"/>`).join('')}
    ${card(60, '#dcfce7', '#16a34a', 0)}${card(430, '#fef3c7', '#d97706', 1)}${card(800, '#fce7f3', '#db2777', 2)}`;
  }
  return svgAsset(after ? 'as_tpl_after' : 'as_tpl_before', after ? 'After image (replace me)' : 'Before image (replace me)', wrap(W, H, body), W, H);
}

/** A sunny riverside park for the event announcement. */
export function picnicArt(): Asset {
  const W = 1200;
  const H = 800;
  const flowers = Array.from({ length: 22 }, (_, i) => {
    const x = 40 + ((i * 211) % 1120);
    const y = 640 + ((i * 47) % 130);
    return `<circle cx="${x}" cy="${y}" r="${6 + (i % 3) * 2}" fill="${['#ff7eb3', '#ffd23f', '#ffffff'][i % 3]}"/>`;
  }).join('');
  const bunting = Array.from({ length: 14 }, (_, i) => {
    const x = 70 + i * 76;
    const y = 120 + Math.sin((i / 13) * Math.PI) * 50;
    return `<path d="M${x} ${y.toFixed(1)} l40 2 l-18 44z" fill="${['#ff7eb3', '#ffd23f', '#6d4aff', '#2bb673'][i % 4]}"/>`;
  }).join('');
  const body = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd6ff"/><stop offset="1" stop-color="#e8f8ff"/></linearGradient>
    <linearGradient id="river" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4fb3ff"/><stop offset="1" stop-color="#7fd6ff"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="980" cy="170" r="90" fill="#fff3b0"/><circle cx="980" cy="170" r="130" fill="#fff3b0" opacity=".3"/>
    <g fill="#ffffff" opacity=".9"><ellipse cx="260" cy="230" rx="110" ry="32"/><ellipse cx="330" cy="210" rx="70" ry="40"/><ellipse cx="700" cy="150" rx="90" ry="26"/></g>
    <path d="M70 120 Q 600 230 1130 120" fill="none" stroke="#5a3426" stroke-width="3"/>${bunting}
    <path d="M0 470 C200 420 380 450 600 440 C820 430 1000 400 1200 430 V800 H0Z" fill="#7ccf8a"/>
    <path d="M0 520 C300 500 520 540 760 520 C940 505 1080 520 1200 510 V600 C1000 610 820 590 600 610 C380 630 200 600 0 620Z" fill="url(#river)"/>
    <path d="M0 600 C200 590 420 640 640 620 C860 600 1040 630 1200 610 V800 H0Z" fill="#2bb673"/>
    <g transform="translate(180 330)"><rect x="-12" y="80" width="24" height="200" rx="10" fill="#7a4a2a"/><circle cx="0" cy="60" r="100" fill="#1f9d5f"/><circle cx="-60" cy="110" r="70" fill="#22a866"/><circle cx="64" cy="104" r="74" fill="#1a8a53"/></g>
    <g transform="translate(700 650) skewX(-18)"><rect x="0" y="0" width="300" height="110" rx="8" fill="#ff5d73"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${i * 60 + 20}" y="0" width="20" height="110" fill="#ffffff" opacity=".7"/>`).join('')}
    ${[0, 1].map((i) => `<rect x="0" y="${i * 50 + 20}" width="300" height="18" fill="#ffffff" opacity=".55"/>`).join('')}</g>
    <g transform="translate(860 616)"><rect x="-40" y="0" width="80" height="54" rx="10" fill="#c97b3d"/><path d="M-30 0 a30 26 0 0 1 60 0" fill="none" stroke="#7a4a2a" stroke-width="7"/><rect x="-40" y="18" width="80" height="8" fill="#a3602b"/></g>
    <circle cx="780" cy="690" r="22" fill="#ffd23f"/><circle cx="940" cy="720" r="16" fill="#ff9a3c"/>
    ${flowers}`;
  return svgAsset('as_tpl_picnic', 'Event picture (replace me)', wrap(W, H, body), W, H);
}

/** A wrapped present (the greeting's surprise) — `open=true` shows the lid popped off. */
export function giftArt(open: boolean): Asset {
  const lid = open
    ? `<g transform="rotate(-18 160 150) translate(-30 -70)"><rect x="70" y="150" width="260" height="60" rx="14" fill="#ff7eb3"/><rect x="180" y="150" width="40" height="60" fill="#ffd23f"/></g>`
    : `<rect x="70" y="150" width="260" height="60" rx="14" fill="#ff7eb3"/><rect x="180" y="150" width="40" height="60" fill="#ffd23f"/>
       <path d="M200 150 C150 90 110 110 130 140 C140 152 170 152 200 150Z M200 150 C250 90 290 110 270 140 C260 152 230 152 200 150Z" fill="#ffd23f"/>`;
  const stars = open
    ? Array.from({ length: 9 }, (_, i) => {
        const a = (-150 + i * 15) * (Math.PI / 180);
        const x = 200 + Math.cos(a) * 150;
        const y = 210 + Math.sin(a) * 150;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${6 + (i % 3) * 3}" fill="${['#ffd23f', '#6d4aff', '#2bb673'][i % 3]}"/>`;
      }).join('')
    : '';
  const body = `${stars}<rect x="86" y="206" width="228" height="170" rx="14" fill="#6d4aff"/><rect x="180" y="206" width="40" height="170" fill="#ffd23f"/>
    <rect x="86" y="206" width="228" height="18" fill="#5b3df5" opacity=".5"/>${lid}`;
  return svgAsset(open ? 'as_tpl_gift_open' : 'as_tpl_gift', open ? 'Open present' : 'Wrapped present', wrap(400, 400, body), 400, 400);
}

/** Three party balloons on strings. */
export function balloonsArt(): Asset {
  const b = (x: number, y: number, c: string, s: string) =>
    `<path d="M${x} ${y + 92} q-14 60 10 120 q14 40 -6 90" fill="none" stroke="#7c6f99" stroke-width="3"/>
     <ellipse cx="${x}" cy="${y}" rx="64" ry="80" fill="${c}"/><path d="M${x - 8} ${y + 78} l8 14 l8 -14z" fill="${c}"/>
     <ellipse cx="${x - 22}" cy="${y - 30}" rx="14" ry="24" fill="${s}" opacity=".55" transform="rotate(-20 ${x - 22} ${y - 30})"/>`;
  return svgAsset(
    'as_tpl_balloons',
    'Balloons',
    wrap(400, 480, `${b(120, 120, '#ff7eb3', '#ffffff')}${b(280, 100, '#6d4aff', '#ffffff')}${b(200, 190, '#ffd23f', '#ffffff')}`),
    400,
    480,
  );
}
