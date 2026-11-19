import { describe, expect, it } from 'vitest';
import {
  addDays,
  currentOccurrence,
  DAY,
  formatOffset,
  formatWallTime,
  HOUR,
  MINUTE,
  relativeTime,
  tzOffset,
  utcToZonedParts,
  zonedTimeToUtc,
} from '../../src/runtime/time';

const U = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s);
const wall = (y: number, mo: number, d: number, h = 0, mi = 0) => ({ year: y, month: mo, day: d, hour: h, minute: mi });

describe('utcToZonedParts / tzOffset', () => {
  it('reads wall-clock parts in a zone, including the weekday', () => {
    expect(utcToZonedParts(U(2026, 12, 12, 17, 0), 'Europe/Berlin')).toEqual({
      year: 2026,
      month: 12,
      day: 12,
      hour: 18,
      minute: 0,
      second: 0,
      weekday: 6,
    });
    // Midnight is hour 0 (never "24").
    expect(utcToZonedParts(U(2026, 1, 1, 5, 0), 'America/New_York').hour).toBe(0);
  });

  it('follows New York across the March and November changes', () => {
    expect(utcToZonedParts(U(2026, 3, 8, 6, 59), 'America/New_York')).toMatchObject({ hour: 1, minute: 59 });
    expect(utcToZonedParts(U(2026, 3, 8, 7, 0), 'America/New_York')).toMatchObject({ hour: 3, minute: 0 });
    expect(tzOffset(U(2026, 3, 1), 'America/New_York')).toBe(-5 * HOUR);
    expect(tzOffset(U(2026, 7, 1), 'America/New_York')).toBe(-4 * HOUR);
    expect(utcToZonedParts(U(2026, 11, 1, 5, 30), 'America/New_York')).toMatchObject({ hour: 1, minute: 30 });
    expect(utcToZonedParts(U(2026, 11, 1, 6, 30), 'America/New_York')).toMatchObject({ hour: 1, minute: 30 });
  });

  it('handles half-hour zones and the southern hemisphere', () => {
    expect(tzOffset(U(2026, 6, 1), 'Asia/Kolkata')).toBe(5.5 * HOUR);
    expect(tzOffset(U(2026, 1, 15), 'Australia/Sydney')).toBe(11 * HOUR);
    expect(tzOffset(U(2026, 7, 15), 'Australia/Sydney')).toBe(10 * HOUR);
  });

  it('falls back to UTC for unknown zones instead of throwing', () => {
    expect(utcToZonedParts(U(2026, 5, 5, 10), 'Not/AZone')).toMatchObject({ hour: 10 });
  });
});

describe('zonedTimeToUtc', () => {
  it('converts ordinary wall times on either side of a DST change', () => {
    expect(zonedTimeToUtc(wall(2026, 3, 7, 12), 'America/New_York')).toBe(U(2026, 3, 7, 17));
    expect(zonedTimeToUtc(wall(2026, 3, 8, 12), 'America/New_York')).toBe(U(2026, 3, 8, 16));
    expect(zonedTimeToUtc(wall(2026, 12, 12, 18), 'Europe/Berlin')).toBe(U(2026, 12, 12, 17));
    expect(zonedTimeToUtc(wall(2026, 7, 1, 9), 'Europe/London')).toBe(U(2026, 7, 1, 8));
    expect(zonedTimeToUtc(wall(2026, 1, 1, 0), 'UTC')).toBe(U(2026, 1, 1));
  });

  it('moves skipped times (spring forward) past the gap', () => {
    // 02:30 does not exist in New York on 8 March 2026 → 03:30 EDT.
    expect(zonedTimeToUtc(wall(2026, 3, 8, 2, 30), 'America/New_York')).toBe(U(2026, 3, 8, 7, 30));
    // London: 01:30 on 29 March 2026 → 02:30 BST.
    expect(zonedTimeToUtc(wall(2026, 3, 29, 1, 30), 'Europe/London')).toBe(U(2026, 3, 29, 1, 30));
    // Sydney: 02:30 on 4 October 2026 → 03:30 AEDT.
    expect(zonedTimeToUtc(wall(2026, 10, 4, 2, 30), 'Australia/Sydney')).toBe(U(2026, 10, 3, 16, 30));
  });

  it('picks the first of two repeated times (fall back)', () => {
    expect(zonedTimeToUtc(wall(2026, 11, 1, 1, 30), 'America/New_York')).toBe(U(2026, 11, 1, 5, 30));
    expect(zonedTimeToUtc(wall(2026, 10, 25, 1, 30), 'Europe/London')).toBe(U(2026, 10, 25, 0, 30));
    expect(zonedTimeToUtc(wall(2026, 4, 5, 2, 30), 'Australia/Sydney')).toBe(U(2026, 4, 4, 15, 30));
  });

  it('round-trips every hour of a year in several zones', () => {
    for (const tz of ['America/New_York', 'Europe/London', 'Australia/Sydney', 'Asia/Kolkata', 'Pacific/Auckland']) {
      for (let t = U(2026, 1, 1); t < U(2027, 1, 1); t += 7 * HOUR + 13 * MINUTE) {
        const p = utcToZonedParts(t, tz);
        const back = zonedTimeToUtc(p, tz);
        const q = utcToZonedParts(back, tz);
        expect([q.year, q.month, q.day, q.hour, q.minute], `${tz} ${new Date(t).toISOString()}`).toEqual([p.year, p.month, p.day, p.hour, p.minute]);
        expect(back <= t).toBe(true);
      }
    }
  });
});

describe('currentOccurrence (repeating countdowns)', () => {
  const ny = 'America/New_York';
  // 18:00 New York on Sunday 1 March 2026 (EST).
  const target = U(2026, 3, 1, 23);

  it('returns the target itself without a repeat', () => {
    expect(currentOccurrence(target, ny, 'none', U(2030, 1, 1))).toBe(target);
  });

  it('daily: always the next 18:00 in New York, DST-correct', () => {
    expect(currentOccurrence(target, ny, 'daily', U(2026, 3, 7, 20))).toBe(U(2026, 3, 7, 23));
    // After the change on 8 March, 18:00 EDT is 22:00 UTC.
    expect(currentOccurrence(target, ny, 'daily', U(2026, 3, 8, 20))).toBe(U(2026, 3, 8, 22));
    // Months later, and in November after falling back.
    expect(currentOccurrence(target, ny, 'daily', U(2026, 11, 2, 12))).toBe(U(2026, 11, 2, 23));
    // A target in the future still counts to the next daily occurrence.
    expect(currentOccurrence(U(2027, 6, 1, 22), ny, 'daily', U(2026, 11, 2, 12))).toBe(U(2026, 11, 2, 23));
  });

  it('keeps the current occurrence during the hold period, then rolls over', () => {
    const now = U(2026, 3, 7, 23, 30);
    expect(currentOccurrence(target, ny, 'daily', now, 60 * MINUTE)).toBe(U(2026, 3, 7, 23));
    expect(currentOccurrence(target, ny, 'daily', now, 0)).toBe(U(2026, 3, 8, 22));
    expect(currentOccurrence(target, ny, 'daily', U(2026, 3, 8, 0, 0), 60 * MINUTE)).toBe(U(2026, 3, 8, 22));
  });

  it('weekly: same weekday and time; London and Sydney across their changes', () => {
    // Target: Friday 6 March 2026 09:00 London.
    const fri = U(2026, 3, 6, 9);
    expect(currentOccurrence(fri, 'Europe/London', 'weekly', U(2026, 3, 7, 12))).toBe(U(2026, 3, 13, 9));
    expect(currentOccurrence(fri, 'Europe/London', 'weekly', U(2026, 3, 30, 12))).toBe(U(2026, 4, 3, 8));
    // Sydney, every Sunday 10:00: before and after DST ends on 5 April 2026.
    const sun = zonedTimeToUtc(wall(2026, 3, 1, 10), 'Australia/Sydney');
    expect(currentOccurrence(sun, 'Australia/Sydney', 'weekly', U(2026, 3, 27))).toBe(U(2026, 3, 28, 23));
    expect(currentOccurrence(sun, 'Australia/Sydney', 'weekly', U(2026, 4, 3))).toBe(U(2026, 4, 5, 0));
  });
});

describe('formatting helpers', () => {
  it('formats offsets, wall times and relative times', () => {
    expect(formatOffset(0)).toBe('UTC');
    expect(formatOffset(HOUR)).toBe('UTC+1');
    expect(formatOffset(-5 * HOUR)).toBe('UTC−5');
    expect(formatOffset(5.5 * HOUR)).toBe('UTC+5:30');
    expect(formatWallTime(U(2026, 12, 12, 17), 'Europe/Berlin')).toBe('Sat 12 Dec 2026, 18:00');
    expect(relativeTime(23 * DAY + HOUR)).toBe('in 23 days');
    expect(relativeTime(5 * HOUR)).toBe('in 5 hours');
    expect(relativeTime(90 * MINUTE)).toBe('in 1 hour 30 minutes');
    expect(relativeTime(-2 * MINUTE)).toBe('2 minutes ago');
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1, weekday: 5 });
  });
});
