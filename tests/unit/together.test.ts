import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Action, Interaction, Project } from '../../src/model/types';
import { SCHEMA_VERSION } from '../../src/model/types';
import { editSteps, fromSteps, stepOps, toSteps } from '../../src/model/actionSteps';
import { runInteraction } from '../../src/runtime/actions';
import type { PlayerControl } from '../../src/runtime/actions';
import { VarStore } from '../../src/runtime/env';
import { validateProject } from '../../src/model/validate';
import { createElement, createProject, createVariable } from '../../src/model/factory';
import { buildStandaloneHtml } from '../../src/io/exportHtml';
import { extractProjectData } from '../../src/io/importHtml';
import { EXAMPLES } from '../../src/examples';
import { actionsSummary, groupHint } from '../../src/editor/behavior/BehaviorPanel';
import { mountPlayer, tick } from './helpers';

afterEach(() => vi.useRealTimers());

const act = (id: string, type: string, params: Action['params'] = {}, together = false): Action => ({
  id,
  type,
  params,
  ...(together ? { together: true } : {}),
});
const interaction = (actions: Action[], conditions: Interaction['conditions'] = []): Interaction => ({ id: 'ix', trigger: 'click', conditions, actions });

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
  reject(e: unknown): void;
}
const deferred = (): Deferred => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

/**
 * A fake player: every Show/Hide with an effect returns a promise the test
 * resolves by hand, and every call is logged in order — fully deterministic.
 */
function fakePlayer(vars: VarStore = new VarStore([])) {
  const log: string[] = [];
  const pending = new Map<string, Deferred>();
  const visible = new Set<string>();
  let alive = true;
  const control: PlayerControl = {
    vars,
    alive: () => alive,
    isVisible: (id) => visible.has(id),
    setVisible(id, v, effect) {
      log.push(`${v ? 'show' : 'hide'}:${id}`);
      if (v) visible.add(id);
      else visible.delete(id);
      if (!effect || effect === 'none') return;
      if (id === 'boom') throw new Error('broken element');
      if (id === 'reject') return Promise.reject(new Error('animation failed'));
      const d = deferred();
      pending.set(id, d);
      return d.promise;
    },
    navigate: (t) => void log.push(`navigate:${t}`),
    api: () => undefined,
    animate: (id) => {
      log.push(`animate:${id}`);
      const d = deferred();
      pending.set(`anim:${id}`, d);
      return d.promise;
    },
    openLink: (href) => void log.push(`open:${href}`),
  };
  return { control, log, pending, visible, kill: () => void (alive = false) };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('action steps model', () => {
  it('splits a flat list into steps and flattens it back', () => {
    const list = [act('a', 'show'), act('b', 'show', {}, true), act('c', 'show', {}, true), act('d', 'wait'), act('e', 'show')];
    const steps = toSteps(list);
    expect(steps.map((s) => s.map((a) => a.id))).toEqual([['a', 'b', 'c'], ['d'], ['e']]);
    const flat = fromSteps(steps);
    expect(flat.map((a) => [a.id, !!a.together])).toEqual([
      ['a', false],
      ['b', true],
      ['c', true],
      ['d', false],
      ['e', false],
    ]);
    // A leading flag has nothing to join: it is its own step.
    expect(toSteps([act('x', 'show', {}, true), act('y', 'show')]).length).toBe(2);
  });

  it('join, split, take out, reorder, add and remove keep ids and rewrite flags', () => {
    const list = [act('a', 'show'), act('b', 'show'), act('c', 'show'), act('d', 'wait')];
    editSteps(list, (s) => stepOps.joinNext(s, 0)); // a+b
    editSteps(list, (s) => stepOps.joinNext(s, 0)); // a+b+c
    expect(toSteps(list).map((s) => s.map((a) => a.id))).toEqual([['a', 'b', 'c'], ['d']]);
    editSteps(list, (s) => stepOps.moveInStep(s, 'c', -1));
    expect(toSteps(list)[0].map((a) => a.id)).toEqual(['a', 'c', 'b']);
    expect(list[0].together).toBeUndefined();
    editSteps(list, (s) => stepOps.moveInStep(s, 'a', 1)); // a moves to 2nd place, c becomes the group's first
    expect(list.map((a) => [a.id, !!a.together])).toEqual([
      ['c', false],
      ['a', true],
      ['b', true],
      ['d', false],
    ]);
    editSteps(list, (s) => stepOps.takeOut(s, 'a'));
    expect(toSteps(list).map((s) => s.map((a) => a.id))).toEqual([['c', 'b'], ['a'], ['d']]);
    editSteps(list, (s) => stepOps.moveStep(s, 0, 1));
    expect(toSteps(list).map((s) => s.map((a) => a.id))).toEqual([['a'], ['c', 'b'], ['d']]);
    editSteps(list, (s) => stepOps.addTo(s, 1, act('n', 'show')));
    expect(toSteps(list)[1].map((a) => a.id)).toEqual(['c', 'b', 'n']);
    editSteps(list, (s) => stepOps.split(s, 1));
    expect(toSteps(list).map((s) => s.length)).toEqual([1, 1, 1, 1, 1]);
    expect(list.some((a) => a.together)).toBe(false);
    editSteps(list, (s) => stepOps.joinNext(s, 1));
    editSteps(list, (s) => stepOps.remove(s, 'c'));
    editSteps(list, (s) => stepOps.remove(s, 'b'));
    expect(list.map((a) => a.id)).toEqual(['a', 'n', 'd']);
    expect(list.some((a) => a.together)).toBe(false);
    editSteps(list, (s) => stepOps.joinNext(s, 0));
    editSteps(list, (s) => stepOps.removeStep(s, 0));
    expect(list.map((a) => a.id)).toEqual(['d']);
  });
});

describe('running steps', () => {
  it('sequential actions still run one after another (unchanged default)', async () => {
    const f = fakePlayer();
    const run = runInteraction(interaction([act('1', 'show', { target: 'A', effect: 'pop' }), act('2', 'show', { target: 'B', effect: 'pop' })]), {
      player: f.control,
      selfId: '',
    });
    await flush();
    expect(f.log).toEqual(['show:A']);
    f.pending.get('A')!.resolve();
    await flush();
    expect(f.log).toEqual(['show:A', 'show:B']);
    f.pending.get('B')!.resolve();
    expect(await run).toBe(true);
  });

  it('a Together step starts every action at once, synchronously, and waits for all of them', async () => {
    const f = fakePlayer();
    const run = runInteraction(
      interaction([
        act('1', 'show', { target: 'A', effect: 'pop' }),
        act('2', 'show', { target: 'B', effect: 'pop' }, true),
        act('3', 'show', { target: 'C', effect: 'pop' }, true),
        act('4', 'show', { target: 'Done' }),
      ]),
      { player: f.control, selfId: '' },
    );
    // All three started before runInteraction even yielded (same task → same animation frame).
    expect(f.log).toEqual(['show:A', 'show:B', 'show:C']);
    f.pending.get('B')!.resolve();
    f.pending.get('A')!.resolve();
    await flush();
    expect(f.log).not.toContain('show:Done'); // C is still animating
    f.pending.get('C')!.resolve();
    await flush();
    expect(f.log).toEqual(['show:A', 'show:B', 'show:C', 'show:Done']);
    expect(await run).toBe(true);
  });

  it('failures are logged and never stop the rest of the group or the next steps', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = fakePlayer();
    const run = runInteraction(
      interaction([
        act('1', 'show', { target: 'boom', effect: 'pop' }), // throws synchronously
        act('2', 'show', { target: 'reject', effect: 'pop' }, true), // rejects
        act('3', 'show', { target: 'A', effect: 'pop' }, true),
        act('4', 'show', { target: 'Done' }),
      ]),
      { player: f.control, selfId: '' },
    );
    expect(f.log).toEqual(['show:boom', 'show:reject', 'show:A']);
    f.pending.get('A')!.resolve();
    await run;
    expect(f.log).toEqual(['show:boom', 'show:reject', 'show:A', 'show:Done']);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a Wait inside a group makes the group last at least that long', async () => {
    vi.useFakeTimers();
    const f = fakePlayer();
    const run = runInteraction(interaction([act('1', 'show', { target: 'A' }), act('2', 'wait', { seconds: 1 }, true), act('3', 'show', { target: 'Done' })]), {
      player: f.control,
      selfId: '',
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(f.log).toEqual(['show:A']);
    await vi.advanceTimersByTimeAsync(2);
    expect(f.log).toEqual(['show:A', 'show:Done']);
    await run;
  });

  it('variable changes in one group apply top to bottom (the lower action has the last word)', async () => {
    const vars = new VarStore([{ ...createVariable('Score', 5), id: 'v' }]);
    const f = fakePlayer(vars);
    await runInteraction(
      interaction([
        act('1', 'varAdd', { variable: 'v', amount: 2 }),
        act('2', 'varSet', { variable: 'v', value: 10 }, true),
        act('3', 'varAdd', { variable: 'v', amount: 1 }, true),
      ]),
      { player: f.control, selfId: '' },
    );
    expect(vars.get('v')).toBe(11);
  });

  it('Play animation only holds a group up when its "wait" setting is on', async () => {
    const f = fakePlayer();
    const run = runInteraction(
      interaction([
        act('1', 'animate', { target: 'A', preset: 'pop' }),
        act('2', 'animate', { target: 'B', preset: 'pop', wait: true }, true),
        act('3', 'show', { target: 'Done' }),
      ]),
      { player: f.control, selfId: '' },
    );
    expect(f.log).toEqual(['animate:A', 'animate:B']);
    await flush();
    expect(f.log).not.toContain('show:Done');
    f.pending.get('anim:B')!.resolve();
    await run;
    expect(f.log).toEqual(['animate:A', 'animate:B', 'show:Done']); // A never finished: it did not matter
  });

  it('conditions are checked once, before anything runs', async () => {
    const vars = new VarStore([{ ...createVariable('n', 0), id: 'n' }]);
    const f = fakePlayer(vars);
    const ok = await runInteraction(
      interaction(
        [act('1', 'show', { target: 'A' }), act('2', 'show', { target: 'B' }, true)],
        [{ id: 'c', type: 'variable', variableId: 'n', op: 'gte', value: 1 }],
      ),
      { player: f.control, selfId: '' },
    );
    expect(ok).toBe(false);
    expect(f.log).toEqual([]);
  });

  it('skips the remaining steps once the player is destroyed', async () => {
    const f = fakePlayer();
    const run = runInteraction(
      interaction([
        act('1', 'show', { target: 'A', effect: 'pop' }),
        act('2', 'show', { target: 'B', effect: 'pop' }, true),
        act('3', 'show', { target: 'C' }),
      ]),
      {
        player: f.control,
        selfId: '',
      },
    );
    f.kill();
    f.pending.get('A')!.resolve();
    f.pending.get('B')!.resolve();
    await run;
    expect(f.log).toEqual(['show:A', 'show:B']);
  });

  it('a link in a Together group opens in the same task as the click (keeps the user gesture)', () => {
    const f = fakePlayer();
    void runInteraction(interaction([act('1', 'show', { target: 'A', effect: 'pop' }), act('2', 'openLink', { url: 'https://example.com/' }, true)]), {
      player: f.control,
      selfId: '',
    });
    expect(f.log).toEqual(['show:A', 'open:https://example.com/']);
  });
});

/** The "Three shapes, together" example in the real player. */
describe('Three shapes, together (real player)', () => {
  it('pops the three shapes in the same frame, and shows the label only after they finish', async () => {
    const project = EXAMPLES.find((e) => e.id === 'together')!.build();
    const started: Array<{ id: string; t: number }> = [];
    const finishers: Array<() => void> = [];
    // jsdom has no Web Animations: provide a controllable element.animate().
    const proto = HTMLElement.prototype as unknown as { animate?: unknown };
    const original = proto.animate;
    proto.animate = function (this: HTMLElement) {
      const id = this.closest<HTMLElement>('.ofs-el')?.dataset.id ?? '?';
      started.push({ id, t: performance.now() });
      let done!: () => void;
      const finished = new Promise<void>((r) => (done = r));
      finishers.push(done);
      return { finished, cancel() {}, playState: 'running' } as unknown as Animation;
    };
    try {
      const { player, q } = mountPlayer(project);
      const reveal = q('el_tg_reveal')!;
      reveal.click();
      // All three Pop animations began synchronously, within the same click handler.
      expect(started.map((s) => s.id)).toEqual(['el_tg_circle', 'el_tg_star', 'el_tg_heart']);
      expect(started[2].t - started[0].t).toBeLessThan(16);
      for (const id of ['el_tg_circle', 'el_tg_star', 'el_tg_heart']) expect(player.isVisible(id)).toBe(true);
      expect(player.isVisible('el_tg_done')).toBe(false);
      vi.useFakeTimers();
      finishers.splice(0).forEach((f) => f());
      await vi.advanceTimersByTimeAsync(400);
      expect(player.isVisible('el_tg_done')).toBe(false); // still waiting 0.5 s
      await vi.advanceTimersByTimeAsync(200);
      expect(player.isVisible('el_tg_done')).toBe(true);
      vi.useRealTimers();
      // "Start over" hides all four at once.
      q('el_tg_reset')!.click();
      await tick();
      for (const id of ['el_tg_circle', 'el_tg_star', 'el_tg_heart', 'el_tg_done']) expect(player.isVisible(id)).toBe(false);
    } finally {
      proto.animate = original;
    }
  });
});

describe('schema v5: Together steps', () => {
  const withGroup = (): Project => {
    const p = createProject('slides');
    p.pages[0].elements = [createElement('shape', { id: 'el_a' }), createElement('shape', { id: 'el_b' })];
    p.pages[0].elements[0].interactions = [
      interaction([
        act('ac_1', 'show', { target: 'el_a', effect: 'pop' }),
        act('ac_2', 'show', { target: 'el_b', effect: 'pop' }, true),
        act('ac_3', 'wait', { seconds: 1 }),
      ]),
    ];
    return p;
  };

  it('is version 5 and keeps groups (ids included) through validation', () => {
    expect(SCHEMA_VERSION).toBe(5);
    const r = validateProject(JSON.parse(JSON.stringify(withGroup())));
    if (!r.ok) throw new Error(r.errors.join());
    const actions = r.project.pages[0].elements[0].interactions[0].actions;
    expect(actions.map((a) => [a.id, !!a.together])).toEqual([
      ['ac_1', false],
      ['ac_2', true],
      ['ac_3', false],
    ]);
  });

  it('never makes an older (v1–v4) project parallel: stray flags are ignored', () => {
    for (const version of [1, 2, 3, 4]) {
      const raw = { ...JSON.parse(JSON.stringify(withGroup())), version };
      const r = validateProject(raw);
      if (!r.ok) throw new Error(r.errors.join());
      expect(r.project.version).toBe(5);
      expect(r.project.pages[0].elements[0].interactions[0].actions.some((a) => a.together)).toBe(false);
    }
  });

  it('normalises invalid grouping data safely', () => {
    const raw = JSON.parse(JSON.stringify(withGroup()));
    const actions = raw.pages[0].elements[0].interactions[0].actions;
    actions[0].together = true; // first action: nothing to join
    actions[1].together = 'yes'; // not a boolean
    actions[2].together = 1;
    actions.splice(1, 0, { id: 'ac_bad', type: 'doesNotExist', params: {}, together: true });
    const r = validateProject(raw);
    if (!r.ok) throw new Error(r.errors.join());
    const out = r.project.pages[0].elements[0].interactions[0].actions;
    expect(out.map((a) => a.id)).toEqual(['ac_1', 'ac_2', 'ac_3']);
    expect(out.some((a) => a.together)).toBe(false);
    // An unsupported first action is dropped; the flag on the new first action is cleared.
    const raw2 = JSON.parse(JSON.stringify(withGroup()));
    raw2.pages[0].elements[0].interactions[0].actions.unshift({ id: 'x', type: 'nope', params: {} });
    raw2.pages[0].elements[0].interactions[0].actions[1].together = true;
    const r2 = validateProject(raw2);
    if (!r2.ok) throw new Error(r2.errors.join());
    expect(r2.project.pages[0].elements[0].interactions[0].actions[0].together).toBeUndefined();
  });

  it('survives standalone HTML export and re-import', () => {
    const html = buildStandaloneHtml(withGroup(), { core: '/*core*/' });
    const back = extractProjectData(html);
    const r = validateProject(back);
    if (!r.ok) throw new Error(r.errors.join());
    expect(toSteps(r.project.pages[0].elements[0].interactions[0].actions).map((s) => s.map((a) => a.id))).toEqual([['ac_1', 'ac_2'], ['ac_3']]);
  });
});

describe('editor wording', () => {
  it('summarises Together groups and Then steps in plain words', () => {
    const p = createProject('slides');
    p.pages[0].elements = [
      createElement('shape', { id: 'el_a', name: 'Shape A' }),
      createElement('shape', { id: 'el_b', name: 'Shape B' }),
      createElement('shape', { id: 'el_c', name: 'Shape C' }),
      createElement('text', { id: 'el_t', name: 'Complete' }),
    ];
    const list = [
      act('1', 'show', { target: 'el_a', effect: 'pop' }),
      act('2', 'show', { target: 'el_b', effect: 'pop' }, true),
      act('3', 'show', { target: 'el_c', effect: 'pop' }, true),
      act('4', 'wait', { seconds: 0.5 }),
      act('5', 'show', { target: 'el_t', effect: 'fade' }),
    ];
    expect(actionsSummary(list, p, '')).toBe('pop Shape A, Shape B and Shape C together, then wait 0.5s, then fade in Complete');
    expect(actionsSummary([act('1', 'show', { target: 'el_a' }), act('2', 'wait', { seconds: 1 }, true)], p, '')).toBe('show Shape A and wait 1s together');
    expect(actionsSummary([], p, '')).toBe('nothing yet');
  });

  it('points out conflicting actions in one group', () => {
    const p = createProject('slides');
    p.variables = [{ ...createVariable('Score', 0), id: 'v' }];
    p.pages[0].elements = [createElement('shape', { id: 'el_a', name: 'Shape A' })];
    expect(groupHint([act('1', 'show', { target: 'el_a' }), act('2', 'hide', { target: 'el_a' }, true)], p, '')).toMatch(/Shape A.*lower one wins/);
    expect(groupHint([act('1', 'varAdd', { variable: 'v', amount: 1 }), act('2', 'varSet', { variable: 'v', value: 3 }, true)], p, '')).toMatch(/Score/);
    expect(groupHint([act('1', 'show', { target: 'el_a' }), act('2', 'navigate', { page: 'next' }, true)], p, '')).toMatch(/Go to slide/);
    expect(groupHint([act('1', 'varAdd', { variable: 'v', amount: 1 }), act('2', 'varAdd', { variable: 'v', amount: 2 }, true)], p, '')).toBeNull();
  });
});
