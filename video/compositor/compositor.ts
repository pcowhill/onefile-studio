import type { Cam, ResolvedStoryboard } from './types.ts';

/**
 * The compositor page: lays out one frame of a storyboard at time t.
 * Everything is a pure function of t (no CSS animations or transitions), so
 * rendering frame by frame is deterministic and can run at any speed.
 *
 * window.__setup(storyboard) builds the DOM; window.__renderAt(t) updates it
 * and resolves once every image on screen is decoded.
 */

const W = 1920;
const H = 1080;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
const outCubic = (v: number) => 1 - Math.pow(1 - clamp(v), 3);
const outBack = (v: number) => {
  const x = clamp(v);
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
/** 0→1 over [a, a+d]. */
const ramp = (t: number, a: number, d: number) => clamp((t - a) / d);
/** In over `inD` from `a`, out over `outD` ending at `b`. */
const life = (t: number, a: number, b: number, inD = 0.35, outD = 0.3) => Math.min(smooth(ramp(t, a, inD)), 1 - smooth(ramp(t, b - outD, outD)));

type Rect = { x: number; y: number; w: number; h: number };
const FRAMES: Record<string, Rect> = {
  full: { x: 0, y: 0, w: W, h: H },
  window: { x: 192, y: 84, w: 1536, h: 864 },
  browser: { x: 288, y: 140, w: 1344, h: 756 },
};
const CHROME = 58;

const LOGO = `<svg viewBox="0 0 48 48"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset="1" stop-color="#ff7eb3"/></linearGradient></defs><rect x="4" y="3" width="34" height="42" rx="9" fill="url(#cg)"/><path d="M28 3h1a9 9 0 0 1 9 9v1h-6a4 4 0 0 1-4-4z" fill="#fff" opacity=".45"/><path d="M17 17l5-3v20" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="39" cy="38" r="7" fill="#ffd23f" stroke="#fff" stroke-width="2.5"/><path d="M36.5 38.2l1.8 1.8 3.3-3.6" fill="none" stroke="#2a2340" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FILE = `<svg viewBox="0 0 200 240"><path d="M20 12h112l52 52v164H20z" fill="#fff" stroke="#1d1145" stroke-width="8" stroke-linejoin="round"/><path d="M132 12v52h52" fill="#ffd23f" stroke="#1d1145" stroke-width="8" stroke-linejoin="round"/><rect x="44" y="96" width="112" height="16" rx="8" fill="#6d4aff"/><rect x="44" y="124" width="80" height="12" rx="6" fill="#cdbfff"/><rect x="44" y="150" width="96" height="12" rx="6" fill="#ffc2d8"/><text x="100" y="208" text-anchor="middle" font-family="Nunito Variable" font-weight="900" font-size="34" fill="#1d1145">.html</text></svg>`;
const POINTER = `<svg width="46" height="46" viewBox="0 0 30 30" style="overflow:visible;filter:drop-shadow(0 3px 4px rgba(0,0,0,.4))"><path d="M4 2.5l18.5 13.2-8.6 1.4 5.2 9.3-3.6 2-5.2-9.4-6.3 5.9z" fill="#1d1145" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const WIFI_OFF = `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

interface ShotView {
  start: number;
  end: number;
  root: HTMLElement;
  update(t: number, local: number): Promise<void> | void;
}

let views: ShotView[] = [];
let sb: ResolvedStoryboard;
let bgBlobs: HTMLElement[] = [];
let captionEls: HTMLElement[] = [];
let headlineEls: HTMLElement[] = [];
let rail: HTMLElement | null = null;

function frameAt(scene: string, s: number): string {
  const f = sb.footage[scene];
  const list = f.frames;
  let lo = 0;
  let hi = list.length - 1;
  if (s <= list[0].t) return `${f.base}${list[0].file}`;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid].t <= s) lo = mid;
    else hi = mid - 1;
  }
  return `${f.base}${list[lo].file}`;
}

function camAt(cams: Cam[] | undefined, p: number): Cam {
  if (!cams || !cams.length) return { at: 0, x: 0.5, y: 0.5, z: 1 };
  if (p <= cams[0].at) return cams[0];
  for (let i = 0; i < cams.length - 1; i++) {
    const a = cams[i];
    const b = cams[i + 1];
    if (p <= b.at) {
      const k = smooth((p - a.at) / Math.max(0.0001, b.at - a.at));
      return { at: p, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
    }
  }
  return cams[cams.length - 1];
}

async function setImg(img: HTMLImageElement, src: string) {
  if (img.dataset.src === src) return;
  img.dataset.src = src;
  img.src = src;
  await img.decode().catch(() => undefined);
}

function el(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
}

function buildClip(shot: Extract<ResolvedStoryboard['shots'][number], { type: 'clip' }>): ShotView['update'] & { root: HTMLElement } {
  const kind = shot.frame ?? 'window';
  const r = FRAMES[kind];
  const root = el(`<div class="shot clip is-${kind}"></div>`);
  const box = el(
    `<div class="vp" style="left:${r.x}px;top:${r.y - (kind === 'browser' ? CHROME : 0)}px;width:${r.w}px;height:${r.h + (kind === 'browser' ? CHROME : 0)}px"></div>`,
  );
  if (kind === 'browser') {
    box.appendChild(
      el(
        `<div class="chrome"><i></i><i></i><i></i><div class="addr"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>${esc(shot.url ?? '')}</div>${shot.badge ? `<div class="badge">${WIFI_OFF}${esc(shot.badge)}</div>` : ''}</div>`,
      ),
    );
  }
  const view = el(`<div class="footage" style="width:${r.w}px;height:${r.h}px"></div>`);
  const img = document.createElement('img');
  img.width = r.w;
  img.height = r.h;
  view.appendChild(img);
  box.appendChild(view);
  root.appendChild(box);
  const update = async (_t: number, local: number) => {
    const s = shot.from + local * (shot.speed ?? 1);
    const c = camAt(shot.cam, local / shot.dur);
    const z = Math.max(1, c.z);
    let tx = r.w / 2 - c.x * r.w * z;
    let ty = r.h / 2 - c.y * r.h * z;
    tx = clamp(tx, r.w - r.w * z, 0);
    ty = clamp(ty, r.h - r.h * z, 0);
    img.style.transform = `translate(${tx}px,${ty}px) scale(${z})`;
    await setImg(img, frameAt(shot.scene, s));
  };
  return Object.assign(update, { root });
}

function buildFile(shot: Extract<ResolvedStoryboard['shots'][number], { type: 'file' }>) {
  const root = el(`<div class="shot file"></div>`);
  const icon = el(`<div class="file-icon">${FILE}</div>`);
  const name = el(`<div class="file-name">${esc(shot.name)}</div>`);
  const meta = el(`<div class="file-meta">${esc(shot.meta)}</div>`);
  const chips = ['Slides & media', 'Interactions', 'Fonts', 'Playback engine', 'Editable project'].map((c, i) => el(`<div class="chip c${i}">${c}</div>`));
  const ptr = el(`<div class="ptr">${POINTER}</div>`);
  const ring = el(`<div class="ring"></div>`);
  root.append(icon, name, meta, ...chips, ring, ptr);
  const update = (_t: number, u: number) => {
    const s = outBack(ramp(u, 0, 0.6));
    icon.style.transform = `translate(-50%,-50%) scale(${0.55 + 0.45 * s}) rotate(${(1 - s) * -8}deg)`;
    icon.style.opacity = String(smooth(ramp(u, 0, 0.25)));
    name.style.opacity = String(smooth(ramp(u, 0.35, 0.35)));
    name.style.transform = `translate(-50%, ${(1 - outCubic(ramp(u, 0.35, 0.4))) * 20}px)`;
    meta.style.opacity = String(smooth(ramp(u, 0.55, 0.35)));
    // the chips fly into the file
    chips.forEach((c, i) => {
      const a = 0.25 + i * 0.13;
      const k = outCubic(ramp(u, a, 0.55));
      const angle = (-150 + i * 75) * (Math.PI / 180);
      const rad = 430 * (1 - k) + 300;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad * 0.55 - 40;
      c.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${0.85 + 0.15 * k})`;
      c.style.opacity = String(smooth(ramp(u, a, 0.25)));
    });
    // a pointer double-clicks the file near the end
    const pa = shot.dur - 1.2;
    const pk = outCubic(ramp(u, pa, 0.55));
    ptr.style.opacity = String(smooth(ramp(u, pa, 0.2)));
    ptr.style.transform = `translate(${1260 - 260 * pk}px, ${900 - 330 * pk}px)`;
    const click = ramp(u, pa + 0.62, 0.4);
    ring.style.opacity = String(click > 0 && click < 1 ? 1 - click : 0);
    ring.style.transform = `translate(-50%,-50%) scale(${0.4 + click * 1.4})`;
  };
  return Object.assign(update, { root });
}

function buildOutro(shot: Extract<ResolvedStoryboard['shots'][number], { type: 'outro' }>) {
  const root = el(`<div class="shot outro"></div>`);
  const logo = el(`<div class="o-logo">${LOGO}<span>OneFile <b>Studio</b></span></div>`);
  const l1 = el(`<div class="o-line">Make it interactive.</div>`);
  const l2 = el(`<div class="o-line">Share it as <em>one file.</em></div>`);
  const url = el(`<div class="o-url">${esc(shot.url)}</div>`);
  const small = el(`<div class="o-small">Free · open source · no account needed</div>`);
  root.append(logo, l1, l2, url, small);
  const update = (_t: number, u: number) => {
    const items: Array<[HTMLElement, number]> = [
      [logo, 0],
      [l1, 0.25],
      [l2, 0.45],
      [url, 0.75],
      [small, 0.9],
    ];
    for (const [node, a] of items) {
      node.style.opacity = String(smooth(ramp(u, a, 0.4)));
      node.style.transform = `translateY(${(1 - outCubic(ramp(u, a, 0.55))) * 28}px)`;
    }
  };
  return Object.assign(update, { root });
}

function buildTitle(shot: Extract<ResolvedStoryboard['shots'][number], { type: 'title' }>) {
  const root = el(`<div class="shot title" style="--acc:${shot.accent ?? '#ffd23f'}"></div>`);
  const k = shot.kicker ? el(`<div class="t-kicker">${esc(shot.kicker)}</div>`) : null;
  const h = el(`<div class="t-title">${esc(shot.title)}</div>`);
  const s = shot.sub ? el(`<div class="t-sub">${esc(shot.sub)}</div>`) : null;
  for (const n of [k, h, s]) if (n) root.appendChild(n);
  const update = (_t: number, u: number) => {
    [k, h, s].forEach((n, i) => {
      if (!n) return;
      n.style.opacity = String(smooth(ramp(u, i * 0.15, 0.35)));
      n.style.transform = `translateY(${(1 - outCubic(ramp(u, i * 0.15, 0.5))) * 24}px)`;
    });
  };
  return Object.assign(update, { root });
}

function setup(board: ResolvedStoryboard) {
  sb = board;
  const stage = document.getElementById('stage')!;
  stage.className = `stage pal-${board.palette ?? 'night'}`;
  stage.style.setProperty('--accent', board.accent ?? '#6d4aff');
  stage.style.setProperty('--cs', String(board.captionScale ?? 1));
  stage.innerHTML = '<div class="bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="dots"></div></div>';
  bgBlobs = [...stage.querySelectorAll<HTMLElement>('.blob')];
  views = [];
  let start = 0;
  for (const shot of board.shots) {
    const build = shot.type === 'clip' ? buildClip(shot) : shot.type === 'file' ? buildFile(shot) : shot.type === 'outro' ? buildOutro(shot) : buildTitle(shot);
    build.root.style.display = 'none';
    stage.appendChild(build.root);
    views.push({ start, end: start + shot.dur, root: build.root, update: build });
    start += shot.dur;
  }
  headlineEls = (board.headlines ?? []).map((hl) => {
    const n = el(
      `<div class="headline">${hl.kicker ? `<div class="hl-kicker">${esc(hl.kicker)}</div>` : ''}${hl.lines.map((l) => `<div class="hl-line">${l}</div>`).join('')}</div>`,
    );
    stage.appendChild(n);
    return n;
  });
  if (board.steps?.length) {
    rail = el(`<div class="rail">${board.steps.map((s, i) => `<div class="step"><b>${i + 1}</b>${esc(s.label)}</div>`).join('')}</div>`);
    stage.appendChild(rail);
  }
  captionEls = board.captions.map((c) => {
    const n = el(
      `<div class="caption" style="--c:${c.color ?? board.accent ?? '#6d4aff'}">${c.badge ? `<span class="cap-badge">${esc(c.badge)}</span>` : ''}<span class="cap-text">${esc(c.text)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span></div>`,
    );
    stage.appendChild(n);
    return n;
  });
}

async function renderAt(t: number) {
  const fade = sb.fade;
  // background drift
  bgBlobs.forEach((b, i) => {
    const a = t * (0.12 + i * 0.05) + i * 2;
    b.style.transform = `translate(${Math.sin(a) * 60}px, ${Math.cos(a * 0.8) * 40}px)`;
  });
  const pending: Array<Promise<void> | void> = [];
  views.forEach((v, i) => {
    const visibleUntil = i === views.length - 1 ? v.end : v.end + fade;
    const on = t >= v.start && t < visibleUntil;
    v.root.style.display = on ? '' : 'none';
    if (!on) return;
    const local = t - v.start;
    let op = i === 0 ? (sb.loop ? smooth(ramp(local, 0, 0.4)) : 1) : smooth(ramp(local, 0, fade));
    if (sb.loop && i === views.length - 1) op *= 1 - smooth(ramp(t, v.end - 0.45, 0.45));
    v.root.style.opacity = String(op);
    v.root.style.zIndex = String(10 + i);
    pending.push(v.update(t, local));
  });
  // headline overlays
  (sb.headlines ?? []).forEach((hl, i) => {
    const n = headlineEls[i];
    const a = life(t, hl.from, hl.to, 0.01, 0.4);
    n.style.display = a > 0 ? '' : 'none';
    n.style.opacity = String(a);
    [...n.children].forEach((c, j) => {
      const k = outCubic(ramp(t, hl.from + 0.12 * j, 0.6));
      (c as HTMLElement).style.transform = `translateY(${(1 - k) * 40}px)`;
      (c as HTMLElement).style.opacity = String(smooth(ramp(t, hl.from + 0.12 * j, 0.4)));
    });
  });
  // step rail
  if (rail && sb.steps && sb.stepsVisible) {
    const [a, b] = sb.stepsVisible;
    const op = life(t, a, b, 0.4, 0.4);
    rail.style.display = op > 0 ? '' : 'none';
    rail.style.opacity = String(op);
    const cur = sb.steps.reduce((acc, s, i) => (t >= s.from ? i : acc), 0);
    [...rail.children].forEach((c, i) => c.classList.toggle('is-on', i === cur));
  }
  // captions
  sb.captions.forEach((c, i) => {
    const n = captionEls[i];
    const prev = sb.captions[i - 1];
    const next = sb.captions[i + 1];
    // Back-to-back captions swap text without the pill dropping out.
    const joinedIn = prev && Math.abs(prev.to - c.from) < 0.05;
    const joinedOut = next && Math.abs(next.from - c.to) < 0.05;
    const inD = joinedIn ? 0.22 : 0.4;
    const outD = joinedOut ? 0.18 : 0.35;
    const a = life(t, c.from, c.to, inD, outD);
    n.style.display = a > 0 ? '' : 'none';
    n.style.opacity = String(a);
    const rise = joinedIn ? 0 : (1 - outCubic(ramp(t, c.from, 0.45))) * 36;
    n.style.transform = `translate(-50%, ${rise}px)`;
  });
  await Promise.all(pending);
}

Object.assign(window, { __setup: setup, __renderAt: renderAt, __W: W, __H: H });
