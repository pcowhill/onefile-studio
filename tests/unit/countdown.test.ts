import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPlayer } from './helpers';
import { createElement, createPage, createProject, createVariable } from '../../src/model/factory';
import { countdownState, shownUnits, splitDuration } from '../../src/runtime/elements/countdown';
import type { CountdownProps } from '../../src/runtime/elements/countdown';
import { createStaticEnv } from '../../src/runtime/env';
import { renderContent } from '../../src/runtime/mount';
import { validateProject } from '../../src/model/validate';
import { themeNewElement } from '../../src/model/theme';
import { parseHex } from '../../src/model/paint';
import type { Project, SceneElement, ThemeId } from '../../src/model/types';
import { DAY, HOUR, MINUTE } from '../../src/runtime/time';

const U = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s);
const NOW = U(2026, 11, 19, 12, 0, 0);

function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = parseHex(c)!.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** A two-slide project: a countdown (whose "finishes" interaction adds 1 to Done) on slide 1. */
function setup(props: Partial<CountdownProps>, extra: Partial<SceneElement> = {}) {
  const p = createProject('slides');
  const done = createVariable('Done', 0);
  p.variables.push(done);
  const cd = createElement('countdown', {
    id: 'el_cd',
    w: 600,
    h: 200,
    props,
    interactions: [{ id: 'ix', trigger: 'countdownDone', conditions: [], actions: [{ id: 'a', type: 'varAdd', params: { variable: done.id, amount: 1 } }] }],
    ...extra,
  });
  p.pages[0].elements.push(cd as unknown as SceneElement);
  p.pages.push(createPage(p));
  const m = mountPlayer(p);
  const values = () => [...m.q('el_cd')!.querySelectorAll('.ofs-countdown-value')].map((n) => n.textContent);
  const root = () => m.q('el_cd')!.querySelector<HTMLElement>('.ofs-countdown')!;
  return { ...m, project: p, doneVar: done.id, values, root };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('countdown calculations', () => {
  const all = { showDays: true, showHours: true, showMinutes: true, showSeconds: true };
  it('splits durations into the shown units, rounding the smallest up', () => {
    const d = 3 * DAY + 4 * HOUR + 12 * MINUTE + 9_400;
    expect(splitDuration(d, shownUnits(all))).toEqual([3, 4, 12, 10]);
    // Hidden days accumulate into hours; hidden seconds round minutes up.
    expect(splitDuration(d, shownUnits({ ...all, showDays: false, showSeconds: false }))).toEqual([76, 13]);
    expect(splitDuration(d, shownUnits({ ...all, showDays: false, showHours: false, showMinutes: false }))).toEqual([274330]);
    // Nothing shown → everything is shown.
    expect(shownUnits({ showDays: false, showHours: false, showMinutes: false, showSeconds: false })).toHaveLength(4);
    expect(splitDuration(0, shownUnits(all))).toEqual([0, 0, 0, 0]);
  });

  it('computes state from the viewer clock; bad targets count as done', () => {
    const base = { target: new Date(NOW + 90_000).toISOString(), timezone: 'UTC', repeat: 'none' as const, holdMinutes: 60 };
    expect(countdownState(base, NOW)).toMatchObject({ remaining: 90_000, done: false });
    expect(countdownState(base, NOW + 90_000)).toMatchObject({ remaining: 0, done: true });
    expect(countdownState({ ...base, target: 'nonsense' }, NOW).done).toBe(true);
  });
});

describe('countdown playback', () => {
  it('shows padded numbers and ticks every second, aligned to the target', () => {
    const t = NOW + 2 * DAY + 3 * HOUR + 4 * MINUTE + 5_000;
    const { values, root } = setup({ target: new Date(t).toISOString() });
    expect(values()).toEqual(['02', '03', '04', '05']);
    expect(root().dataset.remaining).toBe(String(2 * 86400 + 3 * 3600 + 4 * 60 + 5));
    vi.advanceTimersByTime(1020);
    expect(values()).toEqual(['02', '03', '04', '04']);
    vi.advanceTimersByTime(5000);
    expect(values()).toEqual(['02', '03', '03', '59']);
    expect(root().querySelector('.ofs-countdown-title')!.textContent).toBe('Starts in');
    // Labels follow singular/plural.
    expect([...root().querySelectorAll('.ofs-countdown-label')].map((n) => n.textContent)).toEqual(['Days', 'Hours', 'Minutes', 'Seconds']);
  });

  it('is correct when opened months later and after the tab was hidden', () => {
    const t = U(2027, 3, 1, 12);
    const { root } = setup({ target: new Date(t).toISOString() });
    vi.setSystemTime(U(2027, 2, 28, 12));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(root().dataset.remaining).toBe(String(86400));
  });

  it('hides units: hours accumulate days', () => {
    const t = NOW + 2 * DAY + 3 * HOUR + 30_000;
    const { values, root } = setup({ target: new Date(t).toISOString(), showDays: false, showSeconds: false });
    expect(values()).toEqual(['51', '01']);
    expect(root().querySelectorAll('.ofs-countdown-unit')).toHaveLength(2);
  });

  it('inline style reads as a compact sentence', () => {
    const t = NOW + 3 * DAY + 4 * HOUR + 12 * MINUTE;
    const { root } = setup({ target: new Date(t).toISOString(), style: 'inline', showSeconds: false, title: 'Ends in' });
    expect(root().querySelector('.ofs-countdown-body')!.textContent).toBe('Ends in 3 days 4 h 12 min');
  });

  it('digital style uses colon separators', () => {
    const t = NOW + 4 * HOUR + 2 * MINUTE + 1000;
    const { root } = setup({ target: new Date(t).toISOString(), style: 'digital', showDays: false });
    expect(root().querySelector('.ofs-countdown-body')!.textContent).toBe('04Hours:02Minutes:01Seconds');
    expect(root().querySelectorAll('.ofs-countdown-sep')).toHaveLength(2);
  });

  it('announces politely, at most once a minute', () => {
    const t = NOW + 2 * HOUR + 5 * MINUTE + 30_000;
    const { root } = setup({ target: new Date(t).toISOString() });
    const sr = root().querySelector('.ofs-sr')!;
    expect(sr.getAttribute('aria-live')).toBe('polite');
    expect(sr.textContent).toBe('Starts in 2 hours and 6 minutes');
    vi.advanceTimersByTime(20_000);
    expect(sr.textContent).toBe('Starts in 2 hours and 6 minutes');
    vi.advanceTimersByTime(15_000);
    expect(sr.textContent).toBe('Starts in 2 hours and 5 minutes');
    expect(root().querySelector('.ofs-countdown-body')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('reaches zero, shows the done text and fires "finishes" exactly once', () => {
    const { player, values, root, doneVar } = setup({ target: new Date(NOW + 3000).toISOString(), doneText: 'Go!' });
    expect(values()).toEqual(['00', '00', '00', '03']);
    vi.advanceTimersByTime(2000);
    expect(player.vars.get(doneVar)).toBe(0);
    vi.advanceTimersByTime(1100);
    expect(root().classList.contains('ofs-countdown-is-done')).toBe(true);
    expect(root().querySelector('.ofs-countdown-done')!.textContent).toBe('Go!');
    expect(player.vars.get(doneVar)).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(player.vars.get(doneVar)).toBe(1);
    // Leaving and revisiting the slide does not fire again.
    player.goTo(1);
    player.goTo(0);
    vi.advanceTimersByTime(5000);
    expect(player.vars.get(doneVar)).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fires once (after mount) when it is already over when shown', () => {
    const { player, root, doneVar } = setup({ target: new Date(NOW - DAY).toISOString() });
    expect(root().dataset.done).toBe('true');
    expect(player.vars.get(doneVar)).toBe(0);
    vi.advanceTimersByTime(0);
    expect(player.vars.get(doneVar)).toBe(1);
    player.goTo(1);
    player.goTo(0);
    vi.advanceTimersByTime(1000);
    expect(player.vars.get(doneVar)).toBe(1);
  });

  it('daily repeat: holds the done message, rolls over across DST, fires once per occurrence', () => {
    // 18:00 New York every day; start 7 March 2026 17:59:58 EST.
    vi.setSystemTime(U(2026, 3, 7, 22, 59, 58));
    const { player, root, values, doneVar } = setup({
      target: new Date(U(2026, 3, 1, 23)).toISOString(),
      timezone: 'America/New_York',
      repeat: 'daily',
      holdMinutes: 1,
    });
    expect(values()).toEqual(['00', '00', '00', '02']);
    vi.advanceTimersByTime(2100);
    expect(root().dataset.done).toBe('true');
    expect(player.vars.get(doneVar)).toBe(1);
    vi.advanceTimersByTime(30_000);
    expect(player.vars.get(doneVar)).toBe(1);
    vi.advanceTimersByTime(31_000);
    // Rolled over: the next 18:00 is only 23 hours later (clocks went forward on 8 March).
    expect(root().dataset.done).toBe('false');
    expect(Number(root().dataset.remaining)).toBe(23 * 3600 - 61);
    // Jump to just before the next occurrence (as after a sleeping laptop wakes).
    vi.setSystemTime(U(2026, 3, 8, 21, 59, 57) + 500);
    vi.advanceTimersByTime(1100);
    expect(root().dataset.done).toBe('false');
    vi.advanceTimersByTime(2000);
    expect(root().dataset.done).toBe('true');
    expect(player.vars.get(doneVar)).toBe(2);
  });

  it('renders a static, timer-free picture in the editor', () => {
    const p = createProject('slides');
    const el = createElement('countdown', { w: 600, h: 200, props: { target: new Date(NOW + HOUR).toISOString() } });
    const before = vi.getTimerCount();
    const c = renderContent(el as unknown as SceneElement, createStaticEnv(p, 'edit'), document);
    expect(vi.getTimerCount()).toBe(before);
    expect([...c.node.querySelectorAll('.ofs-countdown-value')].map((n) => n.textContent)).toEqual(['00', '01', '00', '00']);
    c.destroy();
  });
});

describe('countdown validation and themes', () => {
  it('sanitises hostile imported props', () => {
    const p = createProject('slides');
    const el = createElement('countdown', { id: 'el_x' });
    Object.assign(el.props, {
      target: 'yesterday-ish',
      timezone: '../../etc/passwd',
      repeat: 'hourly',
      holdMinutes: 1e12,
      style: '<img src=x onerror=alert(1)>',
      cardBg: 'url(javascript:alert(1))',
      title: 42,
      showDays: 'yes',
    });
    p.pages[0].elements.push(el);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.project.pages[0].elements[0].props as unknown as CountdownProps;
    expect(Number.isFinite(Date.parse(out.target))).toBe(true);
    expect(out.timezone).toBe('UTC');
    expect(out.repeat).toBe('none');
    expect(out.holdMinutes).toBe(7 * 24 * 60 - 1);
    expect(out.style).toBe('cards');
    expect(out.cardBg).toBe('#6d4aff');
    expect(out.title).toBe('Starts in');
    expect(out.showDays).toBe(true);
  });

  it('keeps valid props through a validation round trip', () => {
    const p = createProject('slides');
    const props: Partial<CountdownProps> = {
      target: '2026-12-12T17:00:00.000Z',
      timezone: 'Europe/Berlin',
      repeat: 'weekly',
      holdMinutes: 90,
      style: 'digital',
      showSeconds: false,
    };
    p.pages[0].elements.push(createElement('countdown', { id: 'el_ok', props }) as unknown as SceneElement);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok && r.project.pages[0].elements[0].props).toMatchObject(props);
  });

  it('looks right in all four themes', () => {
    for (const theme of ['playful', 'professional', 'technical', 'editorial'] as ThemeId[]) {
      const project: Project = createProject('slides', 'x', theme);
      for (const style of ['cards', 'digital', 'inline'] as const) {
        const el = themeNewElement(createElement('countdown', { w: 600, h: 200, props: { style } }), theme) as unknown as SceneElement<CountdownProps>;
        expect(el.themed).toEqual(expect.arrayContaining(['font', 'cardBg', 'cardText', 'color', 'accent', 'labelColor']));
        const c = renderContent(el as unknown as SceneElement, createStaticEnv(project, 'thumb'), document);
        const node = c.node;
        expect(node.style.getPropertyValue('--cd-card')).toBe(el.props.cardBg);
        expect(node.style.color).not.toBe('');
        if (style === 'inline') expect(node.textContent).toContain('7 days');
        else expect(node.querySelectorAll('.ofs-countdown-value')).toHaveLength(4);
        c.destroy();
      }
      // Card numbers stay legible on the card colour (WCAG AA for large text and better).
      const t = themeNewElement(createElement('countdown'), theme).props as unknown as CountdownProps;
      expect(contrast(t.cardText, t.cardBg), theme).toBeGreaterThan(4.5);
    }
  });
});
