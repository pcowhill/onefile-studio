import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayer, tick } from './helpers';
import { createElement, createPage, createProject, createVariable, clonePage } from '../../src/model/factory';
import type { Interaction, Project } from '../../src/model/types';
import { SCHEMA_VERSION } from '../../src/model/types';
import { validateProject } from '../../src/model/validate';
import { describeKey, isTypingTarget, keyActivatesFocused, keyIdFromEvent, matchesKey, keySpec } from '../../src/runtime/keys';
import { linkProblem, normalizeLink } from '../../src/model/links';
import { EXAMPLES } from '../../src/examples';

const ix = (
  id: string,
  trigger: string,
  actions: Array<[string, Record<string, string | number | boolean>]>,
  options?: Interaction['options'],
): Interaction => ({
  id,
  trigger,
  conditions: [],
  actions: actions.map(([type, params], i) => ({ id: `${id}_${i}`, type, params })),
  ...(options ? { options } : {}),
});

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
  const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : key === ' ' ? 'Space' : key;
  const e = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

/** Two slides with a counter; slide 1 has a hidden box. */
function twoSlides(): Project {
  const p = createProject('slides');
  p.variables = [createVariable('Count', 0)];
  p.variables[0].id = 'var_n';
  p.pages[0].elements = [createElement('shape', { id: 'el_box', hidden: true })];
  p.pages.push(createPage(p, 'Slide 2'));
  return p;
}

afterEach(() => vi.useRealTimers());

describe('keys', () => {
  it('maps keyboard events to layout-friendly ids', () => {
    expect(keyIdFromEvent({ key: ' ', code: 'Space' })).toBe('Space');
    expect(keyIdFromEvent({ key: 'K', code: 'KeyK' })).toBe('k');
    expect(keyIdFromEvent({ key: 'å', code: 'KeyA' })).toBe('a'); // Option/Alt on macOS
    expect(keyIdFromEvent({ key: '!', code: 'Digit1' })).toBe('1'); // Shift+1
    expect(keyIdFromEvent({ key: 'ArrowRight', code: 'ArrowRight' })).toBe('ArrowRight');
    expect(keyIdFromEvent({ key: '?', code: 'Slash' })).toBe('?');
    expect(keyIdFromEvent({ key: 'Shift', code: 'ShiftLeft' })).toBeNull();
    expect(keyIdFromEvent({ key: 'F5', code: 'F5' })).toBeNull();
    expect(keyIdFromEvent({ key: 'Tab', code: 'Tab' })).toBeNull();
  });

  it('matches modifiers exactly, never Ctrl/⌘, and ignores auto-repeat unless asked', () => {
    const base = { key: 'r', code: 'KeyR', shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, repeat: false };
    const spec = keySpec({ key: 'r' });
    expect(matchesKey(spec, base)).toBe(true);
    expect(matchesKey(spec, { ...base, shiftKey: true, key: 'R' })).toBe(false);
    expect(matchesKey(keySpec({ key: 'r', shift: true }), { ...base, shiftKey: true, key: 'R' })).toBe(true);
    expect(matchesKey(spec, { ...base, ctrlKey: true })).toBe(false);
    expect(matchesKey(spec, { ...base, metaKey: true })).toBe(false);
    expect(matchesKey(spec, { ...base, altKey: true })).toBe(false);
    expect(matchesKey(spec, { ...base, repeat: true })).toBe(false);
    expect(matchesKey(keySpec({ key: 'r', repeat: true }), { ...base, repeat: true })).toBe(true);
    // Punctuation ignores Shift (it differs per keyboard layout).
    expect(matchesKey(keySpec({ key: '?' }), { ...base, key: '?', code: 'Slash', shiftKey: true })).toBe(true);
    expect(matchesKey(keySpec({ key: '' }), base)).toBe(false);
    expect(describeKey({ key: 'ArrowRight', shift: true, alt: false })).toBe('Shift + Right arrow');
  });

  it('leaves typing, sliders and keyboard-focused buttons alone', () => {
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const slider = document.createElement('div');
    slider.setAttribute('role', 'slider');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(area)).toBe(true);
    expect(isTypingTarget(slider)).toBe(true);
    expect(isTypingTarget(document.body)).toBe(false);
    const btn = document.createElement('button');
    expect(keyActivatesFocused(btn, 'k')).toBe(false);
    // jsdom has no :focus-visible → treated like a mouse-focused button (the author's rule wins).
    expect(keyActivatesFocused(btn, 'Enter')).toBe(false);
  });
});

describe('links', () => {
  it('accepts web, internal, e-mail and phone addresses', () => {
    expect(normalizeLink('https://example.com/docs?a=1#x')).toBe('https://example.com/docs?a=1#x');
    expect(normalizeLink('example.com/docs')).toBe('https://example.com/docs');
    expect(normalizeLink('http://intranet.local:8080/tool')).toBe('http://intranet.local:8080/tool');
    expect(normalizeLink('wiki:8080/page')).toBe('https://wiki:8080/page');
    expect(normalizeLink('localhost:3000')).toBe('http://localhost:3000/');
    expect(normalizeLink('team@example.com')).toBe('mailto:team@example.com');
    expect(normalizeLink('mailto:a@b.co?subject=Hi')).toBe('mailto:a@b.co?subject=Hi');
    expect(normalizeLink('tel:+15551234')).toBe('tel:+15551234');
  });

  it('rejects scripts, data, files and other schemes', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:x',
      'file:///etc/passwd',
      'blob:https://x/1',
      'ftp://example.com',
      '',
      '   ',
      'http://',
    ])
      expect(normalizeLink(bad), bad).toBeNull();
    expect(linkProblem('javascript:alert(1)')).toMatch(/not allowed/);
    expect(linkProblem('https://ok.example')).toBeNull();
  });
});

describe('schema v4', () => {
  it('migrates v3 files without changes and keeps v4 additions', () => {
    const p = twoSlides();
    const v3 = { ...JSON.parse(JSON.stringify(p)), version: 3 };
    const r = validateProject(v3);
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.project.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(4);
    expect(r.project.pages[0].interactions).toBeUndefined();
    expect(r.project.interactions).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it('validates page and project interactions by owner, trigger options and links', () => {
    const p = twoSlides();
    p.pages[0].interactions = [
      ix('ix_k', 'key', [['show', { target: 'el_box', effect: 'none' }]], { key: 'Space', shift: 'yes' as unknown as boolean, junk: 1 }),
      ix('ix_t', 'pageTimer', [['show', { target: '@self' }]], { seconds: 99999 }),
      ix('ix_bad', 'click', [['show', { target: 'el_box' }]]),
      ix('ix_l', 'pageStart', [
        ['openLink', { url: 'javascript:alert(1)' }],
        ['openLink', { url: 'https://example.com/' + 'x'.repeat(500) }],
      ]),
    ];
    p.pages[0].elements[0].interactions = [ix('ix_el', 'pageStart', [['hide', { target: '@self' }]]), ix('ix_ek', 'key', [['hide', {}]], { key: 'not a key' })];
    p.interactions = [ix('ix_p', 'key', [['navigate', { page: 'first' }]], { key: 'h' }), ix('ix_pt', 'pageTimer', [['wait', {}]], { seconds: 1 })];
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    if (!r.ok) throw new Error(r.errors.join());
    const pg = r.project.pages[0];
    expect(pg.interactions!.map((x) => x.id)).toEqual(['ix_k', 'ix_t', 'ix_l']);
    expect(pg.interactions![0].options).toEqual({ key: 'Space' });
    expect(pg.interactions![1].options).toEqual({ seconds: 600 });
    expect(pg.interactions![1].actions[0].params.target).toBe(''); // no "self" on a page
    expect(pg.interactions![2].actions[0].params.url).toBe('');
    expect(String(pg.interactions![2].actions[1].params.url).length).toBeGreaterThan(500);
    expect(pg.elements[0].interactions.map((x) => x.id)).toEqual(['ix_ek']);
    expect(pg.elements[0].interactions[0].options).toEqual({ key: '' });
    expect(r.project.interactions!.map((x) => x.id)).toEqual(['ix_p']);
    expect(r.warnings.some((w) => /link/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /pageStart|click|pageTimer/.test(w))).toBe(true);
  });

  it('validates drag feel settings', () => {
    const p = twoSlides();
    const el = p.pages[0].elements[0];
    el.drag = { mode: 'weighted', amount: 7, settle: -2 };
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    if (!r.ok) throw new Error();
    expect(r.project.pages[0].elements[0].drag).toEqual({ mode: 'weighted', amount: 1, settle: 0 });
    el.drag = { mode: 'rigid', amount: 0.3 };
    const r2 = validateProject(JSON.parse(JSON.stringify(p)));
    if (!r2.ok) throw new Error();
    expect(r2.project.pages[0].elements[0].drag).toEqual({ mode: 'rigid' });
    el.drag = { mode: 'teleport' };
    const r3 = validateProject(JSON.parse(JSON.stringify(p)));
    if (!r3.ok) throw new Error();
    expect(r3.project.pages[0].elements[0].drag).toBeNull();
  });

  it('duplicating a slide copies its own interactions with fresh ids and re-pointed targets', () => {
    const p = twoSlides();
    p.pages[0].interactions = [ix('ix_k', 'key', [['show', { target: 'el_box' }]], { key: 'k' })];
    const copy = clonePage(p.pages[0]);
    expect(copy.interactions![0].id).not.toBe('ix_k');
    expect(copy.interactions![0].options).toEqual({ key: 'k' });
    expect(copy.interactions![0].actions[0].params.target).toBe(copy.elements[0].id);
  });
});

describe('player — keyboard and slide triggers', () => {
  it('a slide key rule runs only on its slide and replaces built-in navigation there', async () => {
    const p = twoSlides();
    p.pages[0].interactions = [ix('ix_k', 'key', [['varAdd', { variable: 'var_n', amount: 1 }]], { key: 'ArrowRight' })];
    const { player } = mountPlayer(p);
    const e = press('ArrowRight');
    await tick();
    expect(e.defaultPrevented).toBe(true);
    expect(player.vars.get('var_n')).toBe(1);
    expect(player.currentPage()).toBe(0); // consumed: did not go to the next slide
    player.goTo(1);
    press('ArrowRight');
    await tick();
    expect(player.vars.get('var_n')).toBe(1); // not active on slide 2
    press('ArrowLeft');
    expect(player.currentPage()).toBe(0); // built-in navigation still works
  });

  it('other keys still navigate, and typing in a field never triggers', async () => {
    const p = twoSlides();
    p.pages[0].interactions = [ix('ix_k', 'key', [['varAdd', { variable: 'var_n', amount: 1 }]], { key: 'a' })];
    const { player, host } = mountPlayer(p);
    const input = document.createElement('input');
    host.appendChild(input);
    press('a', {}, input);
    await tick();
    expect(player.vars.get('var_n')).toBe(0);
    press('a', { repeat: true });
    await tick();
    expect(player.vars.get('var_n')).toBe(0); // held key: no auto-repeat by default
    press('a', { ctrlKey: true });
    await tick();
    expect(player.vars.get('var_n')).toBe(0);
    press('a');
    await tick();
    expect(player.vars.get('var_n')).toBe(1);
    press(' ');
    expect(player.currentPage()).toBe(1);
  });

  it('project-wide keys work on every slide; element keys follow their slide', async () => {
    const p = twoSlides();
    p.interactions = [ix('ix_h', 'key', [['navigate', { page: 'first' }]], { key: 'h' })];
    p.pages[1].elements = [
      createElement('shape', { id: 'el_two', interactions: [ix('ix_e', 'key', [['varSet', { variable: 'var_n', value: 7 }]], { key: '7' })] }),
    ];
    const { player } = mountPlayer(p);
    press('7');
    await tick();
    expect(player.vars.get('var_n')).toBe(0);
    player.goTo(1);
    press('7');
    await tick();
    expect(player.vars.get('var_n')).toBe(7);
    press('h');
    await tick();
    expect(player.currentPage()).toBe(0);
  });

  it('same-key rules on one slide run in list order, each checking its condition when it starts', async () => {
    const p = twoSlides();
    const step = (n: number, op: 'eq' | 'gte' = 'eq') => [{ id: `cd${n}`, type: 'variable' as const, variableId: 'var_n', op, value: n }];
    p.pages[0].interactions = [
      { ...ix('ix_2', 'key', [['varSet', { variable: 'var_n', value: 3 }]], { key: 'n' }), conditions: step(2) },
      { ...ix('ix_1', 'key', [['varSet', { variable: 'var_n', value: 2 }]], { key: 'n' }), conditions: step(1) },
      { ...ix('ix_0', 'key', [['varSet', { variable: 'var_n', value: 1 }]], { key: 'n' }), conditions: step(0) },
    ];
    const { player } = mountPlayer(p);
    for (let i = 1; i <= 3; i++) {
      press('n');
      await tick();
      await tick();
      expect(player.vars.get('var_n')).toBe(i);
    }
  });

  it('"slide opens" runs on every visit and "after a delay" is cancelled when leaving', async () => {
    vi.useFakeTimers();
    const p = twoSlides();
    p.pages[0].interactions = [
      ix('ix_open', 'pageStart', [['varAdd', { variable: 'var_n', amount: 1 }]]),
      ix('ix_later', 'pageTimer', [['show', { target: 'el_box', effect: 'none' }]], { seconds: 2 }),
    ];
    const { player } = mountPlayer(p);
    await vi.advanceTimersByTimeAsync(0);
    expect(player.vars.get('var_n')).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(player.isVisible('el_box')).toBe(false);
    player.goTo(1); // leave before the delay is over
    await vi.advanceTimersByTimeAsync(5000);
    expect(player.isVisible('el_box')).toBe(false);
    player.goTo(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(player.vars.get('var_n')).toBe(2);
    await vi.advanceTimersByTimeAsync(2100);
    expect(player.isVisible('el_box')).toBe(true);
    player.destroy();
  });

  it('scrolling pages: section triggers follow the current section', async () => {
    const p = createProject('page');
    p.variables = [createVariable('Count', 0)];
    p.variables[0].id = 'var_n';
    p.pages[0].interactions = [ix('ix_open', 'pageStart', [['varAdd', { variable: 'var_n', amount: 1 }]])];
    p.pages.push(createPage(p));
    p.pages[1].interactions = [ix('ix_k', 'key', [['varAdd', { variable: 'var_n', amount: 10 }]], { key: 'k' })];
    // jsdom has no layout: give sections real offsets so "the current section" is meaningful.
    const offset = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('ofs-section') ? Number(this.dataset.index) * 1000 : 0;
    });
    const { player } = mountPlayer(p);
    await tick();
    expect(player.vars.get('var_n')).toBe(1);
    press('k');
    await tick();
    expect(player.vars.get('var_n')).toBe(1); // section 2 is not the current one
    offset.mockRestore();
  });

  it('removes its listeners when destroyed', async () => {
    const p = twoSlides();
    p.pages[0].interactions = [ix('ix_k', 'key', [['varAdd', { variable: 'var_n', amount: 1 }]], { key: 'k' })];
    const { player } = mountPlayer(p);
    const spy = vi.spyOn(player.vars, 'set');
    player.destroy();
    const e = press('k');
    await tick();
    expect(spy).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });
});

describe('player — Open link', () => {
  const linkProject = (url: string, newTab = true) => {
    const p = createProject('slides');
    p.pages[0].elements = [
      createElement('button', { id: 'el_btn', interactions: [ix('ix', 'click', [['openLink', { url, newTab, label: 'Read the docs' }]])] }),
    ];
    return p;
  };

  it('opens validated links through the host, new tab or same tab', async () => {
    const openLink = vi.fn();
    const { q } = mountPlayer(linkProject('example.com/docs'), { openLink });
    q('el_btn')!.querySelector('button')!.click();
    await tick();
    expect(openLink).toHaveBeenCalledWith('https://example.com/docs', true);
    const second = mountPlayer(linkProject('https://example.com', false), { openLink });
    second.q('el_btn')!.querySelector('button')!.click();
    await tick();
    expect(openLink).toHaveBeenLastCalledWith('https://example.com/', false);
  });

  it('never opens unsafe links, even if the data was tampered with after validation', async () => {
    const openLink = vi.fn();
    const { q } = mountPlayer(linkProject('javascript:alert(1)'), { openLink });
    q('el_btn')!.querySelector('button')!.click();
    await tick();
    expect(openLink).not.toHaveBeenCalled();
  });

  it('defaults to window.open with noopener,noreferrer for new tabs', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { q } = mountPlayer(linkProject('https://example.com/a'));
    q('el_btn')!.querySelector('button')!.click();
    await tick();
    expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('clickable non-button elements that open a link are announced as links', () => {
    const p = createProject('slides');
    p.pages[0].elements = [
      createElement('shape', { id: 'el_s', interactions: [ix('ix', 'click', [['openLink', { url: 'https://x.example', label: 'Visit X' }]])] }),
    ];
    const { q } = mountPlayer(p);
    expect(q('el_s')!.getAttribute('role')).toBe('link');
    expect(q('el_s')!.getAttribute('aria-label')).toBe('Visit X');
  });
});

describe('v0.4 examples', () => {
  it('the technical explainer steps through its diagram with the keyboard', async () => {
    const p = EXAMPLES.find((e) => e.id === 'explainer')!.build();
    const { player, q } = mountPlayer(JSON.parse(JSON.stringify(p)), { startPage: 1 });
    await tick();
    expect(q('el_x_arrow0')!.classList.contains('ofs-hidden')).toBe(true);
    press('ArrowRight');
    await tick();
    expect(player.vars.get('var_step')).toBe(1);
    expect(player.isVisible('el_x_arrow0')).toBe(true);
    expect(player.currentPage()).toBe(1);
    press('r');
    await tick();
    expect(player.vars.get('var_step')).toBe(0);
    expect(player.isVisible('el_x_arrow0')).toBe(false);
    for (let i = 0; i < 4; i++) {
      press(' ');
      await tick();
    }
    expect(player.vars.get('var_step')).toBe(4);
    press(' ');
    await tick();
    expect(player.currentPage()).toBe(2);
    press('h');
    await tick();
    expect(player.currentPage()).toBe(0);
  });

  it('both examples validate without warnings and round-trip unchanged', () => {
    for (const id of ['explainer', 'explorer']) {
      const p = JSON.parse(JSON.stringify(EXAMPLES.find((e) => e.id === id)!.build()));
      const r = validateProject(JSON.parse(JSON.stringify(p)));
      if (!r.ok) throw new Error(r.errors.join());
      expect(r.warnings).toEqual([]);
      expect(JSON.parse(JSON.stringify(r.project))).toEqual(p);
    }
  });
});
