import { describe, expect, it, vi } from 'vitest';
import { mountPlayer, rightClick, tick } from './helpers';
import { EXAMPLES } from '../../src/examples';
import { createElement, createProject, createVariable } from '../../src/model/factory';
import { SAMPLE_IDS, sampleAssets } from '../../src/examples/art';
import type { Project } from '../../src/model/types';

const example = (id: string) => EXAMPLES.find((e) => e.id === id)!.build();

describe('playback engine — interactions and variables', () => {
  it('left-click adds to the score and updates text and progress', async () => {
    const { player, q } = mountPlayer(example('clicker'));
    const puff = q('el_c_puff')!;
    expect(q('el_c_score')!.textContent).toBe('Score: 0');
    puff.click();
    await tick();
    puff.click();
    await tick();
    expect(player.vars.get('var_score')).toBe(2);
    expect(q('el_c_score')!.textContent).toBe('Score: 2');
    expect(q('el_c_meter')!.querySelector('.ofs-progress')!.getAttribute('aria-valuenow')).toBe('4');
    expect(q('el_c_meter')!.textContent).toBe('2 / 50');
  });

  it('right-click runs its own interaction and suppresses the browser menu only there', async () => {
    const { player, q } = mountPlayer(example('clicker'));
    const ev = rightClick(q('el_c_puff')!);
    await tick();
    expect(ev.defaultPrevented).toBe(true);
    expect(player.vars.get('var_score')).toBe(5);
    const other = rightClick(q('el_c_title')!);
    expect(other.defaultPrevented).toBe(false);
    expect(player.vars.get('var_score')).toBe(5);
  });

  it('conditions gate actions and reset restores the starting state', async () => {
    const { player, q } = mountPlayer(example('clicker'));
    const win = q('el_c_win')!;
    expect(win.classList.contains('ofs-hidden')).toBe(true);
    for (let i = 0; i < 9; i++) {
      rightClick(q('el_c_puff')!);
      await tick();
    }
    expect(player.vars.get('var_score')).toBe(45);
    expect(win.classList.contains('ofs-hidden')).toBe(true);
    rightClick(q('el_c_puff')!);
    await tick();
    await tick();
    expect(player.vars.get('var_score')).toBe(50);
    expect(win.classList.contains('ofs-hidden')).toBe(false);
    q('el_c_reset')!.querySelector('button')!.click();
    await tick();
    await tick();
    expect(player.vars.get('var_score')).toBe(0);
    expect(win.classList.contains('ofs-hidden')).toBe(true);
  });

  it('supports set / subtract / reset-all and toggle visibility', async () => {
    const p = createProject('slides');
    const v = createVariable('Lives', 3);
    p.variables.push(v);
    const target = createElement('shape', { id: 'el_target' });
    const btn = createElement('button', {
      id: 'el_btn',
      interactions: [
        {
          id: 'ix',
          trigger: 'click',
          conditions: [],
          actions: [
            { id: 'a1', type: 'varSubtract', params: { variable: v.id, amount: 2 } },
            { id: 'a2', type: 'toggle', params: { target: 'el_target', effect: 'none' } },
          ],
        },
      ],
    });
    const setBtn = createElement('button', {
      id: 'el_set',
      interactions: [{ id: 'ix2', trigger: 'dblclick', conditions: [], actions: [{ id: 'a3', type: 'varSet', params: { variable: v.id, value: 42 } }] }],
    });
    const resetBtn = createElement('button', {
      id: 'el_reset',
      interactions: [{ id: 'ix3', trigger: 'click', conditions: [], actions: [{ id: 'a4', type: 'varReset', params: { variable: '@all' } }] }],
    });
    p.pages[0].elements.push(target, btn, setBtn, resetBtn);
    const { player, q } = mountPlayer(p);
    q('el_btn')!.querySelector('button')!.click();
    await tick();
    expect(player.vars.get(v.id)).toBe(1);
    expect(player.isVisible('el_target')).toBe(false);
    q('el_btn')!.querySelector('button')!.click();
    await tick();
    expect(player.vars.get(v.id)).toBe(-1);
    expect(player.isVisible('el_target')).toBe(true);
    q('el_set')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await tick();
    expect(player.vars.get(v.id)).toBe(42);
    q('el_reset')!.querySelector('button')!.click();
    await tick();
    expect(player.vars.get(v.id)).toBe(3);
  });

  it('runs actions in order, including waits', async () => {
    vi.useFakeTimers();
    try {
      const p = createProject('slides');
      const v = createVariable('n', 0);
      p.variables.push(v);
      p.pages[0].elements.push(
        createElement('shape', {
          id: 'el_s',
          interactions: [
            {
              id: 'ix',
              trigger: 'click',
              conditions: [],
              actions: [
                { id: 'a', type: 'varAdd', params: { variable: v.id, amount: 1 } },
                { id: 'b', type: 'wait', params: { seconds: 1 } },
                { id: 'c', type: 'varSet', params: { variable: v.id, value: 10 } },
              ],
            },
          ],
        }),
      );
      const { player, q } = mountPlayer(p);
      q('el_s')!.click();
      await vi.advanceTimersByTimeAsync(10);
      expect(player.vars.get(v.id)).toBe(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(player.vars.get(v.id)).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('playback engine — navigation', () => {
  it('navigates slides with navigation buttons, keys and actions', async () => {
    const p = example('presentation');
    const { player, host } = mountPlayer(p);
    expect(player.currentPage()).toBe(0);
    host.querySelector<HTMLButtonElement>('.ofs-el[data-id="el_p_next1"] button')!.click();
    expect(player.currentPage()).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(player.currentPage()).toBe(2);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(player.currentPage()).toBe(1);
    player.goTo('last');
    expect(player.currentPage()).toBe(3);
    // Slide-progress bar reflects position.
    const prog = host.querySelector('.ofs-el[data-id="el_p_progress4"] .ofs-progress')!;
    expect(prog.getAttribute('aria-valuenow')).toBe('100');
    host.querySelector<HTMLButtonElement>('.ofs-el[data-id="el_p_restart"] button')!.click();
    expect(player.currentPage()).toBe(0);
    // Built-in controls
    expect(host.querySelector('.ofs-nav-count')!.textContent).toBe('1 / 4');
  });

  it('keeps visibility state when returning to a slide', async () => {
    const p = example('presentation');
    const { player, q } = mountPlayer(p, { startPage: 2 });
    expect(q('el_p_idea')!.classList.contains('ofs-hidden')).toBe(true);
    q('el_p_bulb')!.click();
    await tick();
    await tick();
    expect(player.isVisible('el_p_idea')).toBe(true);
    player.goTo('next');
    player.goTo('prev');
    expect(q('el_p_idea')!.classList.contains('ofs-hidden')).toBe(false);
  });

  it('renders all sections of a webpage', () => {
    const p = example('before-after');
    const { host } = mountPlayer(p);
    expect(host.querySelectorAll('.ofs-section')).toHaveLength(5);
    expect(host.querySelector('.ofs-player-page')).not.toBeNull();
  });
});

describe('ready-made components', () => {
  function galleryProject(loop = true): Project {
    const p = createProject('slides');
    const art = sampleAssets();
    const ids = [SAMPLE_IDS.ocean, SAMPLE_IDS.desert, SAMPLE_IDS.aurora];
    for (const id of ids) p.assets[id] = art[id];
    p.pages[0].elements.push(createElement('gallery', { id: 'el_g', props: { images: ids, loop } }));
    return p;
  }

  it('gallery cycles on click and loops', () => {
    const { q } = mountPlayer(galleryProject());
    const g = q('el_g')!.querySelector<HTMLElement>('.ofs-gallery')!;
    expect(g.dataset.index).toBe('0');
    expect(g.querySelectorAll('img')).toHaveLength(3);
    g.click();
    expect(g.dataset.index).toBe('1');
    g.click();
    g.click();
    expect(g.dataset.index).toBe('0');
    // Dots jump directly
    g.querySelectorAll<HTMLButtonElement>('.ofs-gallery-dot')[2].click();
    expect(g.dataset.index).toBe('2');
  });

  it('gallery stops at the end without looping, and can be advanced by an action', async () => {
    const p = galleryProject(false);
    p.pages[0].elements.push(
      createElement('button', {
        id: 'el_b',
        interactions: [{ id: 'ix', trigger: 'click', conditions: [], actions: [{ id: 'a', type: 'gallery', params: { target: 'el_g', direction: 'prev' } }] }],
      }),
    );
    const { q } = mountPlayer(p);
    const g = q('el_g')!.querySelector<HTMLElement>('.ofs-gallery')!;
    g.click();
    g.click();
    g.click();
    expect(g.dataset.index).toBe('2');
    q('el_b')!.querySelector('button')!.click();
    await tick();
    expect(g.dataset.index).toBe('1');
  });

  it('before/after divider follows the pointer and the keyboard', () => {
    const p = createProject('slides');
    const art = sampleAssets();
    p.assets[SAMPLE_IDS.before] = art[SAMPLE_IDS.before];
    p.assets[SAMPLE_IDS.after] = art[SAMPLE_IDS.after];
    p.pages[0].elements.push(createElement('beforeAfter', { id: 'el_ba', w: 400, h: 300, props: { before: SAMPLE_IDS.before, after: SAMPLE_IDS.after } }));
    const { q } = mountPlayer(p);
    const ba = q('el_ba')!.querySelector<HTMLElement>('.ofs-ba')!;
    ba.getBoundingClientRect = () => ({ left: 100, top: 0, width: 400, height: 300, right: 500, bottom: 300, x: 100, y: 0, toJSON() {} });
    const before = ba.querySelector<HTMLElement>('.ofs-ba-before')!;
    expect(before.style.clipPath.replace(/0px/g, '0')).toBe('inset(0 50% 0 0)');
    ba.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 200, button: 0 }) as PointerEvent);
    expect(ba.dataset.position).toBe('25');
    ba.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 400 }) as PointerEvent);
    expect(ba.dataset.position).toBe('75');
    ba.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }) as PointerEvent);
    ba.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 150 }) as PointerEvent);
    expect(ba.dataset.position).toBe('75');
    const knob = ba.querySelector<HTMLElement>('.ofs-ba-knob')!;
    expect(knob.getAttribute('role')).toBe('slider');
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    expect(ba.dataset.position).toBe('65');
    expect(ba.querySelectorAll('img')).toHaveLength(2);
  });

  it('scrolling text is an independently scrollable, focusable panel', () => {
    const p = createProject('slides');
    p.pages[0].elements.push(createElement('scrollText', { id: 'el_st', w: 300, h: 200 }));
    const { q } = mountPlayer(p);
    const panel = q('el_st')!.querySelector<HTMLElement>('.ofs-scrolltext')!;
    const body = panel.querySelector<HTMLElement>('.ofs-scrolltext-body')!;
    expect(body.tabIndex).toBe(0);
    expect(body.querySelectorAll('p').length).toBeGreaterThan(2);
    expect(body.querySelector('ul li')).not.toBeNull();
    expect(body.querySelector('strong')!.textContent).toBe('Bold text');
    Object.defineProperty(body, 'scrollHeight', { value: 900, configurable: true });
    Object.defineProperty(body, 'clientHeight', { value: 200, configurable: true });
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    expect(panel.classList.contains('ofs-at-top')).toBe(true);
    expect(panel.classList.contains('ofs-at-end')).toBe(false);
    body.scrollTop = 700;
    body.dispatchEvent(new Event('scroll'));
    expect(panel.classList.contains('ofs-at-end')).toBe(true);
  });

  it('never renders user text as HTML', () => {
    const p = createProject('slides');
    p.pages[0].elements.push(createElement('text', { id: 'el_t', props: { text: '<img src=x onerror=alert(1)>' } }));
    p.pages[0].elements.push(createElement('scrollText', { id: 'el_s', props: { text: '<script>alert(1)</script> **hi**', title: '<b>t</b>' } }));
    const { q } = mountPlayer(p);
    expect(q('el_t')!.querySelector('img')).toBeNull();
    expect(q('el_t')!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(q('el_s')!.querySelector('script')).toBeNull();
    expect(q('el_s')!.querySelector('b')).toBeNull();
  });
});

describe('behaviours', () => {
  it('rigid drag lets viewers move an element without counting as a click', async () => {
    const p = createProject('slides');
    const v = createVariable('clicks', 0);
    p.variables.push(v);
    p.pages[0].elements.push(
      createElement('shape', {
        id: 'el_d',
        x: 100,
        y: 100,
        w: 100,
        h: 100,
        rotation: 15,
        drag: { mode: 'rigid' },
        interactions: [{ id: 'ix', trigger: 'click', conditions: [], actions: [{ id: 'a', type: 'varAdd', params: { variable: v.id, amount: 1 } }] }],
      }),
    );
    const { q, player } = mountPlayer(p);
    const node = q('el_d')!;
    expect(node.classList.contains('ofs-draggable')).toBe(true);
    const ptr = (type: string, x: number, y: number) => node.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
    ptr('pointerdown', 10, 10);
    ptr('pointermove', 60, 40);
    ptr('pointerup', 60, 40);
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    expect(parseFloat(node.style.left)).toBeGreaterThan(100);
    expect(parseFloat(node.style.top)).toBeGreaterThan(100);
    // Rigid: orientation is unchanged.
    expect(node.style.transform).toBe('rotate(15deg)');
    expect(player.vars.get(v.id)).toBe(0);
    // A plain click still works.
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    expect(player.vars.get(v.id)).toBe(1);
  });

  it('entrance animations and effects degrade gracefully without the Web Animations API', async () => {
    const p = example('presentation');
    const { player, q } = mountPlayer(p, { startPage: 2 });
    await player.control.setVisible('el_p_idea', true, 'pop');
    expect(q('el_p_idea')!.classList.contains('ofs-hidden')).toBe(false);
    await player.control.animate('el_p_bulb', 'shake', {});
  });
});
