/**
 * Time-zone math without libraries. `Intl.DateTimeFormat` knows every IANA
 * zone's rules (including daylight-saving changes); everything here derives
 * from it, so results are correct for any zone the viewer's browser supports.
 * Bundled into exports (keep it small and framework-free).
 */

export interface ZonedParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

export type WallTime = Pick<ZonedParts, 'year' | 'month' | 'day' | 'hour' | 'minute'> & { second?: number };

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    } catch {
      f = tz === 'UTC' ? undefined : formatter('UTC');
      if (!f) throw new Error('Intl time zones are unavailable');
    }
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock date and time of the instant `ms` in time zone `tz`. Unknown zones fall back to UTC. */
export function utcToZonedParts(ms: number, tz: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  const hour = out.hour === 24 ? 0 : out.hour;
  const weekday = new Date(Date.UTC(out.year, out.month - 1, out.day)).getUTCDay();
  return { year: out.year, month: out.month, day: out.day, hour, minute: out.minute, second: out.second, weekday };
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds (e.g. +3 600 000 for CET). */
export function tzOffset(ms: number, tz: string): number {
  const p = utcToZonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The UTC instant at which the clocks in `tz` show `wall`.
 * - Times skipped by a "spring forward" change resolve to the same clock
 *   distance after the change (02:30 on a 02:00→03:00 night becomes 03:30).
 * - Times that happen twice ("fall back") resolve to the first occurrence.
 */
export function zonedTimeToUtc(wall: WallTime, tz: string): number {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second ?? 0);
  // Offsets a day either side bracket any transition near this wall time.
  const before = tzOffset(asUtc - DAY, tz);
  const offsets = [...new Set([before, tzOffset(asUtc, tz), tzOffset(asUtc + DAY, tz)])];
  const valid = offsets.map((o) => asUtc - o).filter((t) => tzOffset(t, tz) === asUtc - t);
  if (valid.length) return Math.min(...valid);
  return asUtc - before;
}

/** Adds `days` calendar days to a date (no time-zone involvement). */
export function addDays(d: Pick<WallTime, 'year' | 'month' | 'day'>, days: number): { year: number; month: number; day: number; weekday: number } {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), weekday: t.getUTCDay() };
}

export type Repeat = 'none' | 'daily' | 'weekly';

/**
 * The occurrence a countdown should currently be about.
 * Without a repeat it is simply `target`. With a repeat it is the earliest
 * occurrence of `target`'s local wall-clock time in `tz` (every day, or every
 * week on the same weekday) that has not finished its hold period yet:
 * `now < occurrence + holdMs`. The date of `target` only matters for its
 * weekday — a repeating countdown always shows the next occurrence.
 */
export function currentOccurrence(target: number, tz: string, repeat: Repeat, now: number, holdMs = 0): number {
  if (repeat !== 'daily' && repeat !== 'weekly') return target;
  const period = repeat === 'daily' ? DAY : 7 * DAY;
  const hold = Math.max(0, Math.min(period - MINUTE, holdMs));
  const t = utcToZonedParts(target, tz);
  const base = utcToZonedParts(now - hold, tz);
  for (let d = -1; d <= 8; d++) {
    const date = addDays(base, d);
    if (repeat === 'weekly' && date.weekday !== t.weekday) continue;
    const occ = zonedTimeToUtc({ ...date, hour: t.hour, minute: t.minute, second: t.second }, tz);
    if (occ + hold > now) return occ;
  }
  return target;
}

// ---------------------------------------------------------------- formatting

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "UTC+1", "UTC−5", "UTC+5:30", "UTC". */
export function formatOffset(offsetMs: number): string {
  if (!offsetMs) return 'UTC';
  const mins = Math.round(Math.abs(offsetMs) / MINUTE);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `UTC${offsetMs < 0 ? '−' : '+'}${h}${m ? `:${pad2(m)}` : ''}`;
}

/** "Fri 12 Dec 2026, 18:00" in `tz`. */
export function formatWallTime(ms: number, tz: string, withYear = true): string {
  const p = utcToZonedParts(ms, tz);
  return `${WEEKDAYS[p.weekday].slice(0, 3)} ${p.day} ${MONTHS[p.month - 1]}${withYear ? ` ${p.year}` : ''}, ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Rough, friendly distance: "in 23 days", "in 5 hours", "2 minutes ago". */
export function relativeTime(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let s: string;
  if (abs < MINUTE) s = 'less than a minute';
  else if (abs < HOUR) s = unit(Math.round(abs / MINUTE), 'minute');
  else if (abs < 2 * DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs - h * HOUR) / MINUTE);
    s = m && h < 6 ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(Math.round(abs / HOUR), 'hour');
  } else s = unit(Math.round(abs / DAY), 'day');
  return deltaMs >= 0 ? `in ${s}` : `${s} ago`;
}
