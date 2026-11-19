import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { fontStack } from '../fonts';

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
  render(el, { doc }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-countdown', {
      fontFamily: fontStack(p.font),
      color: p.color,
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS.none,
    });
    node.textContent = p.title;
    return { node };
  },
  css: `.ofs-countdown{width:100%;height:100%}`,
};
