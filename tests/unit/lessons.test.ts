import { afterEach, describe, expect, it, vi } from 'vitest';
import { LESSONS, LEVELS, getLesson } from '../../src/editor/learn/lessons';
import { completedLessons, markLessonDone, onProgressChange, resetLessonProgress } from '../../src/editor/learn/progress';
import { closeCoach, coachEvent, confirmStep, contextFor, goToStep, startCoach, stepDone, useCoach } from '../../src/editor/learn/coach';
import { validateProject } from '../../src/model/validate';
import { createElement } from '../../src/model/factory';
import { editor } from '../../src/editor/store/store';
import type { CoachContext } from '../../src/templates';
import type { Interaction, Project } from '../../src/model/types';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ctx = (project: Project, stepStart: Project, events: string[] = [], ui = { inspectorTab: 'design', leftTab: 'pages' }): CoachContext => ({
  project,
  initial: stepStart,
  stepStart,
  events: new Set(events),
  stepEvents: new Set(events),
  selection: [],
  ui,
});
const click = (actions: Array<[string, Record<string, unknown>]>, conditions: Interaction['conditions'] = [], trigger = 'click'): Interaction => ({
  id: `ix_${Math.random()}`,
  trigger,
  conditions,
  actions: actions.map(([type, params], i) => ({ id: `a${i}`, type, params: params as Interaction['actions'][number]['params'] })),
});
const step = (lessonId: string, stepId: string) => getLesson(lessonId)!.steps.find((s) => s.id === stepId)!;
const els = (p: Project) => p.pages.flatMap((pg) => pg.elements);

describe('lessons', () => {
  it('eight lessons over three levels, numbered in order', () => {
    expect(LESSONS.map((l) => l.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const lv of LEVELS) expect(LESSONS.some((l) => l.level === lv.id)).toBe(true);
    for (const l of LESSONS) {
      expect(l.steps.length).toBeGreaterThanOrEqual(4);
      expect(l.steps.length).toBeLessThanOrEqual(8);
      // Short, approachable instructions.
      for (const s of l.steps) expect(s.body.length, `${l.id}/${s.id}`).toBeLessThan(200);
      expect(new Set(l.steps.map((s) => s.id)).size).toBe(l.steps.length);
    }
  });

  it('every practice project is valid, clearly named and gets a fresh id each time', () => {
    for (const l of LESSONS) {
      const a = l.setup();
      const b = l.setup();
      expect(a.id).not.toBe(b.id);
      expect(a.meta.title).toMatch(/^Practice — /);
      const r = validateProject(clone(a));
      expect(r.ok && r.warnings, l.id).toEqual([]);
    }
  });

  it('checks start undone and pass on the real edits', () => {
    // Lesson 1
    const l1 = getLesson('first-onefile')!;
    const p0 = l1.setup();
    expect(step('first-onefile', 'text').done!(ctx(p0, p0))).toBe(false);
    const p1 = clone(p0);
    p1.pages[0].elements.push(createElement('text', { id: 'el_t', props: { text: 'Hello' } }));
    expect(step('first-onefile', 'text').done!(ctx(p1, p0))).toBe(true);
    const p2 = clone(p1);
    (els(p2)[0].props as Record<string, unknown>).text = 'Sam';
    expect(step('first-onefile', 'type').done!(ctx(p2, p1))).toBe(true);
    const p3 = clone(p2);
    p3.pages[0].elements.push(createElement('shape', { id: 'el_s' }));
    expect(step('first-onefile', 'shape').done!(ctx(p3, p2))).toBe(true);
    const p4 = clone(p3);
    const sh = els(p4).find((e) => e.id === 'el_s')!;
    sh.x += 40;
    expect(step('first-onefile', 'move').done!(ctx(p4, p3))).toBe(false); // moved, not resized yet
    sh.w += 40;
    expect(step('first-onefile', 'move').done!(ctx(p4, p3))).toBe(true);
    expect(step('first-onefile', 'preview').done!(ctx(p4, p4))).toBe(false);
    expect(step('first-onefile', 'preview').done!(ctx(p4, p4, ['preview']))).toBe(true);

    // Lesson 2: a button that shows the secret.
    const q0 = getLesson('interactive')!.setup();
    const q1 = clone(q0);
    q1.pages[0].elements.push(createElement('button', { id: 'el_b', interactions: [click([['show', { target: 'el_l2_secret' }]])] }));
    expect(step('interactive', 'button').done!(ctx(q1, q0))).toBe(true);
    expect(step('interactive', 'when').done!(ctx(q0, q0))).toBe(false);
    expect(step('interactive', 'when').done!(ctx(q1, q0))).toBe(true);

    // Lesson 3: export and re-import are events.
    expect(step('share', 'export').done!(ctx(q0, q0, ['export']))).toBe(true);
    expect(step('share', 'reimport').done!(ctx(q0, q0, ['import']))).toBe(true);

    // Lesson 4: image, choose, replace, before/after.
    const m0 = getLesson('media')!.setup();
    const ids = Object.keys(m0.assets);
    const m1 = clone(m0);
    m1.pages[0].elements.push(createElement('image', { id: 'el_i' }));
    expect(step('media', 'image').done!(ctx(m1, m0))).toBe(true);
    expect(step('media', 'choose').done!(ctx(m1, m0))).toBe(false);
    const m2 = clone(m1);
    (els(m2)[0].props as Record<string, unknown>).assetId = ids[0];
    expect(step('media', 'choose').done!(ctx(m2, m1))).toBe(true);
    const m3 = clone(m2);
    (els(m3)[0].props as Record<string, unknown>).assetId = ids[1];
    expect(step('media', 'replace').done!(ctx(m3, m2))).toBe(true);
    expect(step('media', 'replace').done!(ctx(m2, m1))).toBe(false); // first choice is not a replacement
    const m4 = clone(m3);
    m4.pages[0].elements.push(createElement('beforeAfter'));
    expect(step('media', 'ba').done!(ctx(m4, m3))).toBe(true);

    // Lesson 5: entrance, timing, animate, navigation.
    const a0 = getLesson('motion')!.setup();
    const a1 = clone(a0);
    els(a1).find((e) => e.id === 'el_l5_star')!.entrance = { preset: 'pop', duration: 600, delay: 0 };
    expect(step('motion', 'entrance').done!(ctx(a1, a0))).toBe(true);
    const a2 = clone(a1);
    els(a2).find((e) => e.id === 'el_l5_star')!.entrance!.delay = 400;
    expect(step('motion', 'timing').done!(ctx(a2, a1))).toBe(true);
    const a3 = clone(a2);
    a3.pages[0].elements.push(createElement('button', { interactions: [click([['animate', { target: 'el_l5_star', preset: 'bounce' }]])] }));
    expect(step('motion', 'animate').done!(ctx(a3, a2))).toBe(true);
    const a4 = clone(a3);
    a4.pages[0].elements.push(createElement('navButton'));
    expect(step('motion', 'nav').done!(ctx(a4, a3))).toBe(true);

    // Lesson 6: variable, varAdd, {token}, progress bound to a variable.
    const v0 = getLesson('variables')!.setup();
    const v1 = clone(v0);
    v1.variables.push({ id: 'var_c', name: 'Clicks', type: 'number', initial: 0 });
    expect(step('variables', 'create').done!(ctx(v1, v0))).toBe(true);
    const v2 = clone(v1);
    v2.pages[0].elements.push(createElement('button', { interactions: [click([['varAdd', { variable: 'var_c', amount: 1 }]])] }));
    expect(step('variables', 'add').done!(ctx(v2, v1))).toBe(true);
    const v3 = clone(v2);
    v3.pages[0].elements.push(createElement('text', { props: { text: 'You clicked {Clicks} times' } }));
    expect(step('variables', 'show').done!(ctx(v3, v2))).toBe(true);
    const v4 = clone(v3);
    v4.pages[0].elements.push(createElement('progress', { props: { source: 'variable', variableId: 'var_c' } }));
    expect(step('variables', 'progress').done!(ctx(v4, v3))).toBe(true);

    // Lesson 7: keys, condition, branch.
    const c0 = getLesson('challenge')!.setup();
    const c1 = clone(c0);
    els(c1).find((e) => e.id === 'el_l7_key0')!.interactions = [
      click([
        ['varAdd', { variable: 'var_l7_keys', amount: 1 }],
        ['hide', { target: '@self' }],
      ]),
    ];
    expect(step('challenge', 'keys').done!(ctx(c0, c0))).toBe(false);
    expect(step('challenge', 'keys').done!(ctx(c1, c0))).toBe(true);
    const chest = els(c1).find((e) => e.id === 'el_l7_chest')!;
    chest.interactions = [click([['show', { target: 'el_l7_win' }]], [{ id: 'k', type: 'variable', variableId: 'var_l7_keys', op: 'gte', value: 3 }])];
    expect(step('challenge', 'condition').done!(ctx(c1, c0))).toBe(true);
    expect(step('challenge', 'branch').done!(ctx(c1, c0))).toBe(false);
    chest.interactions.push(
      click([['animate', { target: '@self', preset: 'shake' }]], [{ id: 'k2', type: 'variable', variableId: 'var_l7_keys', op: 'lt', value: 3 }]),
    );
    expect(step('challenge', 'branch').done!(ctx(c1, c0))).toBe(true);

    // Lesson 8: model, choose, drag mode, key rule.
    const d0 = getLesson('advanced-components')!.setup();
    const d1 = clone(d0);
    d1.pages[0].elements.push(createElement('model', { props: { assetId: '' } }));
    expect(step('advanced-components', 'model').done!(ctx(d1, d0))).toBe(true);
    expect(step('advanced-components', 'choose').done!(ctx(d1, d0))).toBe(false);
    (els(d1)[0].props as Record<string, unknown>).assetId = 'as_rover';
    expect(step('advanced-components', 'choose').done!(ctx(d1, d0))).toBe(true);
    d1.pages[0].elements.push(createElement('shape', { drag: { mode: 'floaty' } }));
    expect(step('advanced-components', 'drag').done!(ctx(d1, d0))).toBe(true);
    d1.pages[0].interactions = [{ ...click([['modelView', { view: 'reset' }]], [], 'key'), options: { key: 'r' } }];
    expect(step('advanced-components', 'key').done!(ctx(d1, d0))).toBe(true);
  });
});

describe('coach state', () => {
  afterEach(() => {
    closeCoach();
    editor().closeProject();
  });

  it('runs a lesson: steps, events since the step started, completion recorded', () => {
    resetLessonProgress();
    const l = getLesson('first-onefile')!;
    editor().openProject(l.setup());
    startCoach('lesson', l.id, l.title, l.steps);
    const run = () => useCoach.getState().run!;
    expect(run().index).toBe(0);
    coachEvent('preview');
    goToStep(5); // the preview step: earlier events do not count for it
    const s = run().steps[run().index];
    expect(s.id).toBe('preview');
    expect(stepDone(run(), s, contextFor(run(), editor().project, []))).toBe(false);
    coachEvent('preview');
    expect(stepDone(run(), s, contextFor(run(), editor().project, []))).toBe(true);
    goToStep(99); // clamps to the last step, which records completion
    expect(run().index).toBe(l.steps.length - 1);
    expect(completedLessons()).toContain('first-onefile');
    goToStep(-3);
    expect(run().index).toBe(0);
  });

  it('“Mark as done” confirms a step; a throwing check never breaks the coach', () => {
    editor().openProject(getLesson('share')!.setup());
    startCoach('guide', 'x', 'Guide', [
      {
        id: 'boom',
        title: 'Boom',
        body: '',
        done: () => {
          throw new Error('x');
        },
      },
    ]);
    const run = () => useCoach.getState().run!;
    expect(stepDone(run(), run().steps[0], contextFor(run(), editor().project, []))).toBe(false);
    confirmStep('boom');
    expect(stepDone(run(), run().steps[0], contextFor(run(), editor().project, []))).toBe(true);
  });
});

describe('lesson progress storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetLessonProgress();
  });

  it('persists to localStorage and notifies listeners', () => {
    resetLessonProgress();
    const fn = vi.fn();
    const off = onProgressChange(fn);
    markLessonDone('share');
    markLessonDone('share');
    expect(completedLessons()).toEqual(['share']);
    expect(JSON.parse(localStorage.getItem('ofs:lessons-done')!)).toEqual(['share']);
    expect(fn).toHaveBeenCalled();
    off();
  });

  it('keeps working in memory when storage is unavailable', () => {
    resetLessonProgress();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markLessonDone('media')).not.toThrow();
    expect(completedLessons()).toEqual(['media']);
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('ofs:lessons-done', '{not json');
    expect(completedLessons()).toEqual([]);
    localStorage.setItem('ofs:lessons-done', JSON.stringify([1, 'motion', null]));
    expect(completedLessons()).toEqual(['motion']);
  });
});
