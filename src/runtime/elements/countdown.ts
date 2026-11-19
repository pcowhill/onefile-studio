import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { fontStack } from '../fonts';
import { COMPONENT_EVENTS, emit } from '../triggers';
import { currentOccurrence, DAY, HOUR, MINUTE } from '../time';
import type { Repeat } from '../time';

export interface CountdownProps {
  /** Target instant (ISO 8601, UTC, e.g. "2026-12-31T23:00:00.000Z"). Unambiguous everywhere. */
  target: string;
  /** IANA time zone the author picked the time in (used for editing and repeats). */
  timezone: string;
  /** Repeat the countdown every day/week at the same local time (always shows the next occurrence). */
  repeat: 'none' | 'daily' | 'weekly';
  /** With a repeat: minutes the "done" message stays up after each occurrence. */
  holdMinutes: number;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
  /** "cards" (separate blocks), "digital" (large clock) or "inline" (compact sentence). */
  style: 'cards' | 'digital' | 'inline';
  showLabels: boolean;
  /** Optional line above the numbers. */
  title: string;
  /** Shown once the countdown reaches zero. */
  doneText: string;
  font: string;
  labelFont: string;
  color: string;
  accent: string;
  cardBg: string;
  cardText: string;
  labelColor: string;
  radius: number;
  shadow: string;
}

/** A week from now, on the hour — a sensible, always-in-the-future sample. */
export function sampleTarget(now = Date.now()): string {
  const d = new Date(now + 7 * 24 * 3600 * 1000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export const COUNTDOWN_STYLES = ['cards', 'digital', 'inline'] as const;
export const COUNTDOWN_REPEATS = ['none', 'daily', 'weekly'] as const;

type UnitKey = 'days' | 'hours' | 'minutes' | 'seconds';
interface Unit {
  key: UnitKey;
  ms: number;
  one: string;
  many: string;
  /** Compact suffix for the inline style (with labels / without). */
  word: [string, string];
  short: string;
}
const UNITS: Unit[] = [
  { key: 'days', ms: DAY, one: 'Day', many: 'Days', word: ['day', 'days'], short: 'd' },
  { key: 'hours', ms: HOUR, one: 'Hour', many: 'Hours', word: ['h', 'h'], short: 'h' },
  { key: 'minutes', ms: MINUTE, one: 'Minute', many: 'Minutes', word: ['min', 'min'], short: 'm' },
  { key: 'seconds', ms: 1000, one: 'Second', many: 'Seconds', word: ['s', 's'], short: 's' },
];
const SHOW_KEY: Record<UnitKey, keyof CountdownProps> = { days: 'showDays', hours: 'showHours', minutes: 'showMinutes', seconds: 'showSeconds' };

/** Units to display, largest first (all of them if the props hide every unit). */
export function shownUnits(p: Pick<CountdownProps, 'showDays' | 'showHours' | 'showMinutes' | 'showSeconds'>): Unit[] {
  const list = UNITS.filter((u) => p[SHOW_KEY[u.key] as keyof typeof p] !== false);
  return list.length ? list : UNITS;
}

/**
 * Splits a remaining duration into the shown units. The smallest shown unit
 * is rounded UP (so "0" only appears once the time is really up) and the
 * largest shown unit absorbs everything above it (hidden days → more hours).
 */
export function splitDuration(remainingMs: number, units: Unit[]): number[] {
  const smallest = units[units.length - 1].ms;
  let rest = Math.max(0, Math.ceil(remainingMs / smallest)) * smallest;
  return units.map((u) => {
    const v = Math.floor(rest / u.ms);
    rest -= v * u.ms;
    return v;
  });
}

export interface CountdownState {
  /** Milliseconds until the current occurrence (≤ 0 once reached). */
  remaining: number;
  done: boolean;
  /** The occurrence being counted to (epoch ms). */
  occurrence: number;
}

/** Pure countdown state for `now` (exported for tests and the editor summary). */
export function countdownState(p: Pick<CountdownProps, 'target' | 'timezone' | 'repeat' | 'holdMinutes'>, now: number): CountdownState {
  const parsed = Date.parse(p.target);
  const target = Number.isFinite(parsed) ? parsed : now;
  const repeat: Repeat = p.repeat === 'daily' || p.repeat === 'weekly' ? p.repeat : 'none';
  const occurrence = currentOccurrence(target, p.timezone || 'UTC', repeat, now, Math.max(0, num(p.holdMinutes, 0)) * MINUTE);
  const remaining = occurrence - now;
  return { remaining, done: remaining <= 0, occurrence };
}

const pad = (v: number) => String(v).padStart(2, '0');
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** "3 days, 4 hours and 12 minutes" (for screen readers; minute precision). */
function spokenDuration(remaining: number, units: Unit[]): string {
  // Never more precise than minutes: live regions should not chatter every second.
  let coarse = units.filter((u) => u.key !== 'seconds');
  if (!coarse.length) coarse = [UNITS[2]];
  if (remaining < MINUTE && coarse[coarse.length - 1].key === 'minutes') return 'less than a minute';
  const values = splitDuration(remaining, coarse);
  const parts = coarse.map((u, i) => (values[i] ? `${values[i]} ${values[i] === 1 ? u.one : u.many}`.toLowerCase() : '')).filter(Boolean);
  if (!parts.length) return `0 ${coarse[coarse.length - 1].many.toLowerCase()}`;
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

export const countdownDef: RuntimeElementDef<CountdownProps> = {
  id: 'countdown',
  defaults: () => ({
    target: sampleTarget(),
    timezone: 'UTC',
    repeat: 'none',
    holdMinutes: 60,
    showDays: true,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
    style: 'cards',
    showLabels: true,
    title: 'Starts in',
    doneText: "It's here! 🎉",
    font: 'rounded',
    labelFont: 'rounded',
    color: '#1d1b2c',
    accent: '#6d4aff',
    cardBg: '#6d4aff',
    cardText: '#ffffff',
    labelColor: '#4b4766',
    radius: 24,
    shadow: 'soft',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const style = (COUNTDOWN_STYLES as readonly string[]).includes(p.style) ? p.style : 'cards';
    const units = shownUnits(p);
    const W = Math.max(40, el.w);
    const H = Math.max(24, el.h);
    const title = String(p.title ?? '').trim();
    const doneText = String(p.doneText ?? '');
    const labels = p.showLabels !== false;

    const node = h(doc, 'div', `ofs-countdown ofs-countdown-${style}`, { fontFamily: fontStack(p.font), color: p.color });
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', title || 'Countdown');
    const s = node.style;
    s.setProperty('--cd-accent', p.accent);
    s.setProperty('--cd-card', p.cardBg);
    s.setProperty('--cd-card-text', p.cardText);
    s.setProperty('--cd-label', p.labelColor);
    s.setProperty('--cd-label-font', fontStack(p.labelFont));
    s.setProperty('--cd-shadow', SHADOWS[p.shadow] ?? 'none');

    // ---- layout (logical px, derived from the box) ----
    const showTitle = !!title && style !== 'inline';
    const titleSize = showTitle ? clamp(Math.min(H * 0.15, (W * 1.6) / Math.max(8, title.length)), 11, 56) : 0;
    const titleEl = h(doc, 'div', 'ofs-countdown-title', { fontSize: `${titleSize}px`, marginBottom: `${titleSize * 0.45}px` });
    titleEl.textContent = title;
    const bodyH = H - (showTitle ? titleSize * 1.7 : 0);
    const body = h(doc, 'div', 'ofs-countdown-body');
    body.setAttribute('aria-hidden', 'true');
    const doneEl = h(doc, 'div', 'ofs-countdown-done');
    doneEl.textContent = doneText;
    doneEl.style.fontSize = `${clamp(Math.min(H * 0.42, (W * 1.7) / Math.max(4, doneText.length)), 12, 140)}px`;
    const sr = h(doc, 'span', 'ofs-sr');
    sr.setAttribute('aria-live', 'polite');
    if (showTitle) node.appendChild(titleEl);
    node.append(body, doneEl, sr);

    // Cards / digital: one value node per unit, built once and updated in place.
    const values: HTMLElement[] = [];
    const labelEls: HTMLElement[] = [];
    let sizedFor = '';
    const n = units.length;
    if (style !== 'inline') {
      units.forEach((u, i) => {
        if (style === 'digital' && i > 0) {
          const sep = h(doc, 'span', 'ofs-countdown-sep');
          sep.textContent = ':';
          body.appendChild(sep);
        }
        const unit = h(doc, 'div', 'ofs-countdown-unit');
        const value = h(doc, 'span', 'ofs-countdown-value');
        if (style === 'cards') {
          const card = h(doc, 'div', 'ofs-countdown-card');
          card.appendChild(value);
          unit.appendChild(card);
        } else unit.appendChild(value);
        const label = h(doc, 'span', 'ofs-countdown-label');
        label.textContent = u.many;
        if (labels) unit.appendChild(label);
        values.push(value);
        labelEls.push(label);
        body.appendChild(unit);
      });
    }

    /** Sizes the numbers for `chars` digits in the leading unit (re-run only when that changes). */
    const size = (lead: number) => {
      const key = `${lead}`;
      if (key === sizedFor) return;
      sizedFor = key;
      const chars = units.map((_, i) => (i === 0 ? Math.max(2, lead) : 2));
      if (style === 'cards') {
        const gap = clamp(W * 0.03, 6, 28);
        const cardW = (W - gap * (n - 1)) / n;
        const labelSize = labels ? clamp(Math.min(cardW * 0.15, bodyH * 0.12), 9, 24) : 0;
        const cardH = Math.max(20, Math.min(bodyH - (labels ? labelSize * 1.9 : 0), cardW * 1.1));
        body.style.gap = `${gap}px`;
        units.forEach((_, i) => {
          const card = values[i].parentElement as HTMLElement;
          card.style.height = `${cardH}px`;
          card.style.borderRadius = `${clamp(num(p.radius, 0), 0, Math.min(cardW, cardH) / 2)}px`;
          const fs = Math.min(cardH * 0.56, (cardW * 0.84) / (chars[i] * 0.62));
          values[i].style.fontSize = `${fs}px`;
          values[i].style.width = `${chars[i]}ch`;
          labelEls[i].style.fontSize = `${labelSize}px`;
          labelEls[i].style.marginTop = `${labelSize * 0.55}px`;
          (values[i].parentElement!.parentElement as HTMLElement).style.width = `${cardW}px`;
        });
      } else {
        const total = chars.reduce((a, b) => a + b, 0) + (n - 1) * 0.5;
        const fs = Math.min((bodyH / (labels ? 1.3 : 1)) * 0.86, (W * 0.94) / (total * 0.62));
        const labelSize = clamp(fs * 0.17, 9, 22);
        body.style.fontSize = `${fs}px`;
        units.forEach((_, i) => {
          values[i].style.width = `${chars[i]}ch`;
          labelEls[i].style.fontSize = `${labelSize}px`;
        });
      }
    };

    const renderInline = (vals: number[]) => {
      body.textContent = '';
      let first = vals.findIndex((v) => v > 0);
      if (first < 0) first = vals.length - 1;
      const pieces: Array<[string, string]> = units
        .map((u, i) => [String(vals[i]), labels ? ` ${u.word[vals[i] === 1 ? 0 : 1]}` : u.short] as [string, string])
        .slice(first);
      const len = (title ? title.length + 1 : 0) + pieces.reduce((a, [v, w]) => a + v.length + w.length + 1, 0);
      const fs = Math.max(Math.min(bodyH * 0.55, W / (len * 0.52)), Math.min(bodyH * 0.24, 16));
      body.style.fontSize = `${fs}px`;
      if (title) {
        const pre = h(doc, 'span', 'ofs-countdown-prefix');
        pre.textContent = `${title} `;
        body.appendChild(pre);
      }
      pieces.forEach(([v, w], i) => {
        const part = h(doc, 'span', 'ofs-countdown-part');
        const numEl = h(doc, 'span', 'ofs-countdown-num');
        numEl.textContent = v;
        const word = h(doc, 'span', 'ofs-countdown-word');
        word.textContent = w;
        part.append(numEl, word);
        body.appendChild(part);
        if (i < pieces.length - 1) body.appendChild(doc.createTextNode(' '));
      });
    };

    // ---- state & updates ----
    const play = env.mode === 'play';
    const stateKey = `countdown:${el.id}`;
    const saved = (env.state.get(stateKey) as { fired?: number } | undefined) ?? {};
    env.state.set(stateKey, saved);
    let disposed = false;
    let pendingFire: number | null = null;
    let prevOcc: number | null = null;
    let lastText = '';
    let lastSpoken = '';

    let fireTimer: ReturnType<typeof setTimeout> | undefined;
    const fire = (occ: number) => {
      if (saved.fired === occ || pendingFire === occ) return;
      pendingFire = occ;
      // Deferred so the trigger listener (bound after rendering) receives it.
      fireTimer = setTimeout(() => {
        pendingFire = null;
        if (disposed || saved.fired === occ) return;
        saved.fired = occ;
        emit(node, COMPONENT_EVENTS.countdownDone, { occurrence: new Date(occ).toISOString() });
      }, 0);
    };

    const update = (now: number): ReturnType<typeof countdownState> => {
      const st = countdownState(p, now);
      node.classList.toggle('ofs-countdown-is-done', st.done);
      node.dataset.done = String(st.done);
      node.dataset.remaining = String(Math.max(0, Math.ceil(st.remaining / 1000)));
      if (!st.done) {
        const vals = splitDuration(st.remaining, units);
        const text = vals.join(':');
        if (text !== lastText) {
          lastText = text;
          if (style === 'inline') renderInline(vals);
          else {
            size(String(vals[0]).length);
            vals.forEach((v, i) => {
              const t = pad(v);
              if (values[i].textContent !== t) values[i].textContent = t;
              if (labels) labelEls[i].textContent = style === 'cards' && v === 1 ? units[i].one : units[i].many;
            });
          }
        }
      } else lastText = '';
      const spoken = st.done ? doneText || 'Time is up' : `${title ? `${title} ` : ''}${spokenDuration(st.remaining, units)}`;
      if (spoken !== lastSpoken) {
        lastSpoken = spoken;
        sr.textContent = spoken;
      }
      if (play) {
        if (prevOcc !== null && prevOcc !== st.occurrence && prevOcc <= now) fire(prevOcc);
        if (st.done) fire(st.occurrence);
        prevOcc = st.occurrence;
      }
      return st;
    };

    const first = update(Date.now());
    if (!play) return { node };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const repeating = p.repeat === 'daily' || p.repeat === 'weekly';
    const schedule = (st: CountdownState, now: number) => {
      clearTimeout(timer);
      timer = undefined;
      let delay: number;
      if (!st.done) delay = st.remaining % 1000 || 1000;
      else if (repeating)
        delay = 1000 - (now % 1000); // showing the done message until the next occurrence takes over
      else return; // finished for good
      timer = setTimeout(tick, Math.min(delay, 60_000) + 15);
    };
    function tick() {
      if (disposed) return;
      const now = Date.now();
      schedule(update(now), now);
    }
    schedule(first, Date.now());

    // Background tabs throttle timers; recompute as soon as the page is visible again.
    const onVisibility = () => {
      if (doc.visibilityState === 'hidden') {
        clearTimeout(timer);
        timer = undefined;
      } else tick();
    };
    doc.addEventListener('visibilitychange', onVisibility);
    onCleanup(() => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(fireTimer);
      doc.removeEventListener('visibilitychange', onVisibility);
    });
    return { node };
  },
  css: `
.ofs-countdown{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.1;overflow:hidden}
.ofs-countdown-title{flex:none;max-width:100%;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ofs-countdown-body{display:flex;justify-content:center;align-items:flex-start;max-width:100%;font-variant-numeric:tabular-nums}
.ofs-countdown-unit{display:flex;flex-direction:column;align-items:center;min-width:0}
.ofs-countdown-card{position:relative;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--cd-card);color:var(--cd-card-text);box-shadow:var(--cd-shadow)}
.ofs-countdown-card::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,0) 48%,rgba(0,0,0,.05) 52%,rgba(0,0,0,0));pointer-events:none}
.ofs-countdown-value{display:inline-block;position:relative;font-weight:800;line-height:1;letter-spacing:-.01em;text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums lining-nums}
.ofs-countdown-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;color:var(--cd-label);font-family:var(--cd-label-font);font-weight:700;line-height:1.1;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap}
.ofs-countdown-digital .ofs-countdown-value{font-weight:700;letter-spacing:-.02em}
.ofs-countdown-digital .ofs-countdown-label{margin-top:.35em}
.ofs-countdown-sep{color:var(--cd-accent);font-weight:700;line-height:1;width:.5em;text-align:center;flex:none;transform:translateY(-.06em)}
.ofs-countdown-inline .ofs-countdown-body{display:block;line-height:1.25;overflow-wrap:break-word}
.ofs-countdown-prefix{color:var(--cd-label);font-weight:700}
.ofs-countdown-part{white-space:nowrap}
.ofs-countdown-num{color:var(--cd-accent);font-weight:800;font-variant-numeric:tabular-nums}
.ofs-countdown-word{font-weight:700;margin-left:.08em}
.ofs-countdown-done{display:none;max-width:100%;padding:0 .2em;font-weight:800;line-height:1.2;color:var(--cd-accent);overflow-wrap:break-word}
.ofs-countdown-is-done .ofs-countdown-body,.ofs-countdown-is-done .ofs-countdown-title{display:none}
.ofs-countdown-is-done .ofs-countdown-done{display:block}
.ofs-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
`,
};
