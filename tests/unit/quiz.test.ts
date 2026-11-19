import { afterEach, describe, expect, it } from 'vitest';
import runtime from 'virtual:ofs-runtime';
import { mountPlayer, tick } from './helpers';
import { createElement, createPage, createProject, createVariable } from '../../src/model/factory';
import type { QuizProps } from '../../src/runtime/elements/quiz';
import { quizAwardKey } from '../../src/runtime/elements/quiz';
import { createStaticEnv } from '../../src/runtime/env';
import { renderContent } from '../../src/runtime/mount';
import { validateProject } from '../../src/model/validate';
import { themeNewElement } from '../../src/model/theme';
import { buildStandaloneHtml } from '../../src/io/exportHtml';
import { importFromText } from '../../src/io/importHtml';
import type { Interaction, Project, SceneElement, ThemeId } from '../../src/model/types';

const ix = (id: string, trigger: string, actions: Interaction['actions']): Interaction => ({ id, trigger, conditions: [], actions });

/**
 * Slide 1: a quiz (Mars = B is right), a hidden "well done" shape shown on a
 * correct answer, a Wrong counter bumped on wrong answers, and a reset button.
 * Slide 2: empty.
 */
function setup(props: Partial<QuizProps> = {}, opts: { score?: boolean } = { score: true }) {
  const p = createProject('slides');
  const score = createVariable('Score', 0);
  const wrong = createVariable('Wrong', 0);
  p.variables.push(score, wrong);
  const quiz = createElement('quiz', {
    id: 'el_quiz',
    w: 560,
    h: 420,
    props: { scoreVariable: opts.score ? score.id : '', points: 10, ...props },
    interactions: [
      ix('ix1', 'quizCorrect', [{ id: 'a1', type: 'show', params: { target: 'el_yay', effect: 'none' } }]),
      ix('ix2', 'quizIncorrect', [{ id: 'a2', type: 'varAdd', params: { variable: wrong.id, amount: 1 } }]),
    ],
  });
  const yay = createElement('shape', { id: 'el_yay', hidden: true });
  const reset = createElement('button', {
    id: 'el_reset',
    interactions: [ix('ix3', 'click', [{ id: 'a3', type: 'quizReset', params: { target: 'el_quiz' } }])],
  });
  const resetScore = createElement('button', {
    id: 'el_reset_score',
    interactions: [ix('ix4', 'click', [{ id: 'a4', type: 'varReset', params: { variable: score.id } }])],
  });
  p.pages[0].elements.push(quiz as SceneElement, yay, reset, resetScore);
  p.pages.push(createPage(p));
  const m = mountPlayer(p);
  const quizNode = () => m.q('el_quiz')!.querySelector<HTMLElement>('.ofs-quiz')!;
  const choice = (i: number) => quizNode().querySelectorAll<HTMLButtonElement>('.ofs-quiz-choice')[i];
  const feedback = () => quizNode().querySelector('.ofs-quiz-feedback')!;
  const retry = () => quizNode().querySelector<HTMLButtonElement>('.ofs-quiz-retry')!;
  const clickReset = async () => {
    m.q('el_reset')!.querySelector('button')!.click();
    await tick();
  };
  const clickResetScore = async () => {
    m.q('el_reset_score')!.querySelector('button')!.click();
    await tick();
  };
  return { ...m, project: p, score: score.id, wrong: wrong.id, quizNode, choice, feedback, retry, clickReset, clickResetScore };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('quiz playback', () => {
  it('renders the question and lettered answer buttons', () => {
    const { quizNode, choice } = setup();
    expect(quizNode().querySelector('.ofs-quiz-q')!.textContent).toBe('Which planet is known as the Red Planet?');
    expect(quizNode().querySelectorAll('button.ofs-quiz-choice')).toHaveLength(4);
    expect(choice(0).querySelector('.ofs-quiz-letter')!.textContent).toBe('A');
    expect(choice(3).querySelector('.ofs-quiz-letter')!.textContent).toBe('D');
    expect(quizNode().querySelector('.ofs-quiz-footer')!.hasAttribute('hidden')).toBe(true);
    expect(quizNode().querySelector('.ofs-quiz-feedback')!.getAttribute('aria-live')).toBe('polite');
  });

  it('a correct answer is marked, explained, scored and runs "Answered correctly"', async () => {
    const { player, choice, feedback, retry, quizNode, score } = setup();
    expect(player.isVisible('el_yay')).toBe(false);
    choice(1).click();
    await tick();
    expect(choice(1).classList.contains('ofs-correct')).toBe(true);
    expect(choice(1).querySelector('.ofs-quiz-mark svg')).not.toBeNull();
    expect(choice(0).classList.contains('ofs-dim')).toBe(true);
    expect(feedback().textContent).toContain('Correct! Mars looks red');
    expect(retry().hidden).toBe(true);
    expect(quizNode().dataset.state).toBe('correct');
    expect(player.vars.get(score)).toBe(10);
    expect(player.isVisible('el_yay')).toBe(true);
    // Further answers are ignored.
    choice(2).click();
    await tick();
    expect(choice(2).classList.contains('ofs-incorrect')).toBe(false);
    expect(choice(1).getAttribute('aria-disabled')).toBe('true');
  });

  it('a wrong answer runs "Answered wrongly"; "Try again" resets and focuses the first answer', async () => {
    const { player, choice, feedback, retry, wrong, score } = setup();
    choice(0).click();
    await tick();
    expect(choice(0).classList.contains('ofs-incorrect')).toBe(true);
    expect(feedback().textContent).toBe('Not quite — have another look.');
    expect(player.vars.get(wrong)).toBe(1);
    expect(player.isVisible('el_yay')).toBe(false);
    expect(retry().hidden).toBe(false);
    // No reveal while a retry is possible.
    expect(choice(1).classList.contains('ofs-revealed')).toBe(false);
    retry().click();
    expect(choice(0).classList.contains('ofs-incorrect')).toBe(false);
    expect(choice(0).hasAttribute('aria-disabled')).toBe(false);
    expect(document.activeElement).toBe(choice(0));
    expect(feedback().textContent).toBe('');
    choice(1).click();
    await tick();
    expect(player.vars.get(score)).toBe(10);
    expect(player.isVisible('el_yay')).toBe(true);
  });

  it('reveals the right answer after a wrong one when retry is off', async () => {
    const { choice, retry } = setup({ allowRetry: false, revealAnswer: true });
    choice(3).click();
    await tick();
    expect(choice(3).classList.contains('ofs-incorrect')).toBe(true);
    expect(choice(1).classList.contains('ofs-revealed')).toBe(true);
    expect(choice(1).textContent).toContain('the correct answer');
    expect(retry().hidden).toBe(true);
  });

  it('does not reveal when reveal is off', async () => {
    const { choice } = setup({ allowRetry: false, revealAnswer: false });
    choice(3).click();
    await tick();
    expect(choice(1).classList.contains('ofs-revealed')).toBe(false);
  });

  it('first-try-only scoring ignores a correct retry', async () => {
    const { player, choice, retry, score } = setup({ firstTryOnly: true });
    choice(0).click();
    retry().click();
    choice(1).click();
    await tick();
    expect(choice(1).classList.contains('ofs-correct')).toBe(true);
    expect(player.vars.get(score)).toBe(0);
  });

  it('scores at most once per session, even after the Reset quiz action', async () => {
    const { player, choice, clickReset, clickResetScore, score, quizNode } = setup();
    choice(1).click();
    await tick();
    expect(player.vars.get(score)).toBe(10);
    await clickReset();
    expect(quizNode().dataset.state).toBe('open');
    expect(choice(1).classList.contains('ofs-correct')).toBe(false);
    choice(1).click();
    await tick();
    expect(player.vars.get(score)).toBe(10);
    // Once the score itself has been reset, the quiz can score again after a reset.
    await clickResetScore();
    await clickReset();
    choice(1).click();
    await tick();
    expect(player.vars.get(score)).toBe(10);
  });

  it('works without a score variable', async () => {
    const { player, choice, score } = setup({}, { score: false });
    choice(1).click();
    await tick();
    expect(player.vars.get(score)).toBe(0);
    expect(player.isVisible('el_yay')).toBe(true);
  });

  it('keeps the answered state when the viewer leaves and comes back', async () => {
    const { player, choice, quizNode, wrong } = setup({ allowRetry: false });
    choice(2).click();
    await tick();
    expect(player.vars.get(wrong)).toBe(1);
    player.goTo(1);
    expect(quizNode).toThrow();
    player.goTo(0);
    await tick();
    expect(quizNode().dataset.state).toBe('incorrect');
    expect(choice(2).classList.contains('ofs-incorrect')).toBe(true);
    expect(choice(1).classList.contains('ofs-revealed')).toBe(true);
    // Restoring does not fire the trigger again.
    expect(player.vars.get(wrong)).toBe(1);
  });

  it('stores its state under the element id; a missing entry renders fresh', () => {
    const p = createProject('slides');
    const el = createElement('quiz', { id: 'el_q' }) as SceneElement;
    p.pages[0].elements.push(el);
    const env = createStaticEnv(p, 'play');
    env.state.set('el_q', { answer: 1, attempts: 1 });
    const a = renderContent(el, env, document);
    expect(a.node.dataset.state).toBe('correct');
    a.destroy();
    env.state.delete('el_q');
    const b = renderContent(el, env, document);
    expect(b.node.dataset.state).toBe('open');
    b.node.querySelectorAll<HTMLButtonElement>('.ofs-quiz-choice')[0].click();
    expect(env.state.get('el_q')).toEqual({ answer: 0, attempts: 1 });
    expect(env.state.has(quizAwardKey('el_q'))).toBe(false);
    b.destroy();
  });

  it('is inert in the editor: buttons are not focusable and clicks do nothing', () => {
    const p = createProject('slides');
    const el = createElement('quiz') as SceneElement;
    const env = createStaticEnv(p, 'edit');
    const c = renderContent(el, env, document);
    const buttons = [...c.node.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.length).toBe(5);
    expect(buttons.every((b) => b.tabIndex === -1)).toBe(true);
    buttons[1].click();
    expect(c.node.dataset.state).toBe('open');
    expect(env.state.size).toBe(0);
    c.destroy();
  });

  it('supports grid and pills layouts and hides letters on request', () => {
    const p = createProject('slides');
    for (const layout of ['grid', 'pills'] as const) {
      const el = createElement('quiz', { props: { layout, showLetters: false } }) as SceneElement;
      const c = renderContent(el, createStaticEnv(p, 'thumb'), document);
      expect(c.node.classList.contains(`ofs-quiz-${layout}`)).toBe(true);
      expect(c.node.querySelector('.ofs-quiz-letter')).toBeNull();
      c.destroy();
    }
  });
});

describe('quiz validation, export and themes', () => {
  it('sanitises hostile imported props', () => {
    const p = createProject('slides');
    const el = createElement('quiz', { id: 'el_x' });
    Object.assign(el.props, {
      question: { toString: 'evil' },
      choices: ['<img src=x onerror=alert(1)>', 7, null, ...Array.from({ length: 40 }, (_, i) => `c${i}`)],
      correct: 99,
      layout: 'carousel',
      scoreVariable: 'var_missing',
      points: 'lots',
      success: 'red;background:url(x)',
      radius: -50,
    });
    p.pages[0].elements.push(el);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.project.pages[0].elements[0].props as unknown as QuizProps;
    expect(out.question).toBe('Which planet is known as the Red Planet?');
    expect(out.choices).toHaveLength(10);
    expect(out.choices.slice(0, 3)).toEqual(['<img src=x onerror=alert(1)>', '7', '']);
    expect(out.correct).toBe(9);
    expect(out.layout).toBe('list');
    expect(out.scoreVariable).toBe('');
    expect(out.points).toBe(1);
    expect(out.success).toBe('#00b894');
    expect(out.radius).toBe(0);
    // Text is rendered as text, never markup.
    const c = renderContent(r.project.pages[0].elements[0], createStaticEnv(r.project, 'play'), document);
    expect(c.node.querySelector('img')).toBeNull();
    expect(c.node.textContent).toContain('<img src=x onerror=alert(1)>');
    c.destroy();
    // Too few choices fall back to the defaults.
    const p2 = createProject('slides');
    p2.pages[0].elements.push(createElement('quiz', { props: { choices: ['only one'] } }));
    const r2 = validateProject(JSON.parse(JSON.stringify(p2)));
    expect(r2.ok && (r2.project.pages[0].elements[0].props as unknown as QuizProps).choices).toHaveLength(4);
  });

  it('survives export → import with its settings and score link intact', () => {
    const p: Project = createProject('slides');
    const v = createVariable('Score', 0);
    p.variables.push(v);
    const props: Partial<QuizProps> = {
      question: 'Pick B',
      choices: ['a', 'b', 'c'],
      correct: 1,
      layout: 'pills',
      allowRetry: false,
      scoreVariable: v.id,
      points: 3,
      firstTryOnly: true,
    };
    p.pages[0].elements.push(createElement('quiz', { id: 'el_q', props }) as unknown as SceneElement);
    const { project, warnings } = importFromText(buildStandaloneHtml(p, runtime), 'q.html');
    expect(warnings).toEqual([]);
    expect(project.pages[0].elements[0].props).toMatchObject(props);
  });

  it('renders in all four themes with legible, distinct state colours', () => {
    for (const theme of ['playful', 'professional', 'technical', 'editorial'] as ThemeId[]) {
      const project = createProject('slides', 'x', theme);
      const el = themeNewElement(createElement('quiz', { w: 560, h: 420 }), theme) as unknown as SceneElement<QuizProps>;
      expect(el.themed).toEqual(expect.arrayContaining(['background', 'choiceBg', 'success', 'danger', 'accent']));
      const env = createStaticEnv(project, 'play');
      const c = renderContent(el as unknown as SceneElement, env, document);
      document.body.appendChild(c.node);
      expect(c.node.style.background).not.toBe('');
      expect(c.node.style.getPropertyValue('--q-success')).toBe(el.props.success);
      expect(el.props.success).not.toBe(el.props.danger);
      expect(el.props.color.toLowerCase()).not.toBe(el.props.background.toLowerCase());
      c.node.querySelectorAll<HTMLButtonElement>('.ofs-quiz-choice')[1].click();
      expect(c.node.dataset.state).toBe('correct');
      c.destroy();
      c.node.remove();
    }
  });
});
