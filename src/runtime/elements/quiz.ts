import type { RuntimeElementDef } from './types';
import { h, icon, num, SHADOWS, svg } from './types';
import { fontStack } from '../fonts';
import { contrastText, parseHex, withAlpha } from '../../model/paint';
import { COMPONENT_EVENTS, emit } from '../triggers';

export interface QuizProps {
  question: string;
  choices: string[];
  /** Index of the correct choice. */
  correct: number;
  /** "list" (stacked rows), "grid" (2-column tiles) or "pills" (compact, wrapping). */
  layout: 'list' | 'grid' | 'pills';
  showLetters: boolean;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  /** Viewers may try again after a wrong answer. */
  allowRetry: boolean;
  /** After a wrong answer without retry, highlight the right one. */
  revealAnswer: boolean;
  /** Optional number variable to add points to on a correct answer. */
  scoreVariable: string;
  points: number;
  /** Only a correct FIRST attempt scores. */
  firstTryOnly: boolean;
  font: string;
  headingFont: string;
  color: string;
  background: string;
  accent: string;
  choiceBg: string;
  borderColor: string;
  success: string;
  danger: string;
  radius: number;
  shadow: string;
}

export const QUIZ_LAYOUTS = ['list', 'grid', 'pills'] as const;

/**
 * Per-session answer state, kept in `env.state` under the element id so it
 * survives leaving and revisiting a slide. When the entry is absent (never
 * answered, or cleared by the player) the quiz renders fresh.
 */
export interface QuizSession {
  /** Index of the chosen answer, or null while unanswered. */
  answer: number | null;
  /** Answers given since the last reset (including retries). */
  attempts: number;
}

/**
 * Stored separately under `${id}:awarded` so it survives quiz resets: points
 * are not added again unless the score variable has since been reset to its
 * initial value.
 */
export interface QuizAward {
  variable: string;
}
export const quizAwardKey = (id: string) => `${id}:awarded`;

export const choiceLetter = (i: number) => String.fromCharCode(65 + (i % 26));

/** Translucent version of any colour (hex via rgba, anything else via color-mix). */
function tint(c: string, alpha: number): string {
  return parseHex(c) ? withAlpha(c, alpha) : `color-mix(in srgb, ${c} ${Math.round(alpha * 100)}%, transparent)`;
}

const CROSS = 'M6.5 6.5l11 11M17.5 6.5l-11 11';
function mark(doc: Document, ok: boolean) {
  const s = svg(doc, 'svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'ofs-icon' });
  s.appendChild(
    svg(doc, 'path', {
      d: ok ? 'M5 12.5l4.5 4.5L19 7.5' : CROSS,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 3,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return s;
}

export const quizDef: RuntimeElementDef<QuizProps> = {
  id: 'quiz',
  defaults: () => ({
    question: 'Which planet is known as the Red Planet?',
    choices: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
    correct: 1,
    layout: 'list',
    showLetters: true,
    feedbackCorrect: 'Correct! Mars looks red because of iron oxide (rust) on its surface.',
    feedbackIncorrect: 'Not quite — have another look.',
    allowRetry: true,
    revealAnswer: true,
    scoreVariable: '',
    points: 1,
    firstTryOnly: false,
    font: 'rounded',
    headingFont: 'rounded',
    color: '#1d1b2c',
    background: '#ffffff',
    accent: '#6d4aff',
    choiceBg: '#f3f0ff',
    borderColor: '#e4e0f5',
    success: '#00b894',
    danger: '#ff5d73',
    radius: 24,
    shadow: 'soft',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const choices = (Array.isArray(p.choices) ? p.choices : []).map((c) => String(c ?? ''));
    const correct = Math.max(0, Math.min(choices.length - 1, Math.round(num(p.correct, 0))));
    const layout = (QUIZ_LAYOUTS as readonly string[]).includes(p.layout) ? p.layout : 'list';
    const play = env.mode === 'play';
    const radius = Math.max(0, num(p.radius, 0));

    // Typography scales with the box: estimate the content height (question,
    // answers and the feedback line that appears later) and shrink until it fits.
    // Content that still does not fit scrolls inside the panel.
    const rows = layout === 'grid' ? Math.ceil(choices.length / 2) : layout === 'pills' ? Math.ceil(choices.length / 3) : choices.length;
    const rowEm = layout === 'grid' ? 3.75 : 3.15;
    const qLen = String(p.question ?? '').length;
    const fbLen = Math.max(String(p.feedbackCorrect ?? '').length, String(p.feedbackIncorrect ?? '').length);
    const padFor = (b: number) => Math.max(12, Math.min(radius * 0.7, b * 1.6), b * 1.1);
    const heightFor = (b: number) => {
      const inner = Math.max(40, el.w - 2 * padFor(b));
      const lines = (chars: number, em: number) => Math.max(1, Math.ceil((chars * em * 0.52 * b) / inner));
      const em = lines(qLen, 1.3) * 1.625 + rows * rowEm + 0.85 + Math.max(lines(fbLen, 1) * 1.35, 2.1) + 0.85;
      return em * b + 2 * padFor(b);
    };
    let base = Math.min(30, el.w / 26);
    for (let i = 0; i < 4 && base > 12; i++) {
      const need = heightFor(base);
      if (need <= el.h) break;
      base = Math.max(12, base * Math.max(0.6, el.h / need));
    }

    const node = h(doc, 'div', `ofs-quiz ofs-quiz-${layout}${p.showLetters ? '' : ' ofs-quiz-noletters'}`, {
      fontFamily: fontStack(p.font),
      color: p.color,
      background: p.background,
      borderRadius: `${radius}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
      fontSize: `${base}px`,
    });
    const s = node.style;
    s.setProperty('--q-accent', p.accent);
    s.setProperty('--q-accent-soft', tint(p.accent, 0.14));
    s.setProperty('--q-choice', p.choiceBg);
    s.setProperty('--q-border', p.borderColor);
    s.setProperty('--q-success', p.success);
    s.setProperty('--q-success-soft', tint(p.success, 0.14));
    s.setProperty('--q-on-success', contrastText(p.success));
    s.setProperty('--q-danger', p.danger);
    s.setProperty('--q-danger-soft', tint(p.danger, 0.13));
    s.setProperty('--q-on-danger', contrastText(p.danger));
    s.setProperty('--q-on-accent', contrastText(p.accent));
    s.setProperty('--q-radius', `${Math.min(radius, base * 1.1)}px`);
    s.setProperty('--q-pad', `${padFor(base)}px`);

    const question = h(doc, 'h3', 'ofs-quiz-q', { fontFamily: fontStack(p.headingFont) });
    question.textContent = p.question;
    const list = h(doc, 'div', 'ofs-quiz-choices');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', p.question || 'Answers');

    const buttons = choices.map((text, i) => {
      const b = h(doc, 'button', 'ofs-quiz-choice');
      b.type = 'button';
      b.dataset.index = String(i);
      if (!play) b.tabIndex = -1;
      if (p.showLetters) {
        const letter = h(doc, 'span', 'ofs-quiz-letter');
        letter.textContent = choiceLetter(i);
        letter.setAttribute('aria-hidden', 'true');
        b.appendChild(letter);
      }
      const label = h(doc, 'span', 'ofs-quiz-text');
      label.textContent = text;
      const markEl = h(doc, 'span', 'ofs-quiz-mark');
      const status = h(doc, 'span', 'ofs-sr');
      b.append(label, markEl, status);
      list.appendChild(b);
      return { b, markEl, status };
    });

    const footer = h(doc, 'div', 'ofs-quiz-footer');
    const feedback = h(doc, 'div', 'ofs-quiz-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    const fbIcon = h(doc, 'span', 'ofs-quiz-fb-icon');
    const fbText = h(doc, 'span', 'ofs-quiz-fb-text');
    feedback.append(fbIcon, fbText);
    const retry = h(doc, 'button', 'ofs-quiz-retry');
    retry.type = 'button';
    retry.append(icon(doc, 'refresh', Math.round(base * 0.95)), doc.createTextNode('Try again'));
    if (!play) retry.tabIndex = -1;
    footer.append(feedback, retry);
    node.append(question, list, footer);

    // ---- session state (re-read from env.state on every use: the player may clear it) ----
    const read = (): QuizSession => {
      const v = env.state.get(el.id) as QuizSession | undefined;
      const answer = v && typeof v.answer === 'number' && v.answer >= 0 && v.answer < choices.length ? v.answer : null;
      return { answer, attempts: v && Number.isFinite(v.attempts) ? v.attempts : 0 };
    };
    const write = (v: QuizSession) => {
      if (play) env.state.set(el.id, v);
    };

    const paint = (animate: boolean) => {
      const a = read().answer;
      const answered = a !== null;
      const right = answered && a === correct;
      const reveal = answered && !right && !p.allowRetry && p.revealAnswer;
      node.classList.toggle('ofs-quiz-answered', answered);
      node.dataset.state = !answered ? 'open' : right ? 'correct' : 'incorrect';
      buttons.forEach(({ b, markEl, status }, i) => {
        const chosen = answered && i === a;
        const revealed = reveal && i === correct;
        b.classList.toggle('ofs-chosen', chosen);
        b.classList.toggle('ofs-correct', chosen && right);
        b.classList.toggle('ofs-incorrect', chosen && !right);
        b.classList.toggle('ofs-revealed', revealed);
        b.classList.toggle('ofs-dim', answered && !chosen && !revealed);
        b.classList.remove('ofs-pop', 'ofs-shake');
        if (answered) b.setAttribute('aria-disabled', 'true');
        else b.removeAttribute('aria-disabled');
        if (chosen) b.setAttribute('aria-pressed', 'true');
        else b.removeAttribute('aria-pressed');
        markEl.textContent = '';
        if (chosen || revealed) markEl.appendChild(mark(doc, chosen ? right : true));
        status.textContent = chosen ? (right ? ' — your answer, correct' : ' — your answer, incorrect') : revealed ? ' — the correct answer' : '';
        if (animate && chosen) {
          void b.offsetWidth;
          b.classList.add(right ? 'ofs-pop' : 'ofs-shake');
        }
      });
      fbIcon.textContent = '';
      if (answered) fbIcon.appendChild(mark(doc, right));
      fbText.textContent = !answered ? '' : right ? p.feedbackCorrect : p.feedbackIncorrect;
      feedback.classList.toggle('ofs-quiz-fb-correct', right);
      feedback.classList.toggle('ofs-quiz-fb-incorrect', answered && !right);
      const showRetry = answered && !right && p.allowRetry;
      retry.hidden = !showRetry;
      footer.hidden = !answered || (!fbText.textContent && !showRetry);
    };

    const scoreVar = String(p.scoreVariable ?? '');
    const award = () => {
      const def = env.vars.list().find((v) => v.id === scoreVar);
      if (!def) return;
      const prev = env.state.get(quizAwardKey(el.id)) as QuizAward | undefined;
      // Once per session, unless the score itself was reset since (then the quiz may score again).
      if (prev?.variable === scoreVar && env.vars.get(scoreVar) !== def.initial) return;
      env.vars.set(scoreVar, env.vars.get(scoreVar) + num(p.points, 1));
      const rec: QuizAward = { variable: scoreVar };
      env.state.set(quizAwardKey(el.id), rec);
    };
    /** Scrolls the panel (never the page) so the feedback line is visible. */
    const showFooter = () => {
      if (footer.hidden) return;
      const over = footer.offsetTop + footer.offsetHeight - (node.scrollTop + node.clientHeight);
      if (over > 0) node.scrollTop += over + 4;
    };
    const choose = (i: number) => {
      const st = read();
      if (st.answer !== null) return;
      const attempts = st.attempts + 1;
      write({ answer: i, attempts });
      const right = i === correct;
      if (right && scoreVar && (!p.firstTryOnly || attempts === 1)) award();
      paint(true);
      showFooter();
      emit(node, COMPONENT_EVENTS.quizAnswer, { correct: right, choice: i });
    };
    const retryNow = () => {
      const st = read();
      if (st.answer === null) return;
      // Retries keep counting attempts (for "first try only").
      write({ answer: null, attempts: st.attempts });
      paint(false);
      buttons[0]?.b.focus();
    };

    paint(false);
    if (!play) return { node };

    buttons.forEach(({ b }, i) => {
      const onClick = () => choose(i);
      b.addEventListener('click', onClick);
      onCleanup(() => b.removeEventListener('click', onClick));
    });
    const onRetry = () => retryNow();
    retry.addEventListener('click', onRetry);
    onCleanup(() => retry.removeEventListener('click', onRetry));
    const reset = () => {
      const had = read().answer !== null;
      env.state.delete(el.id);
      paint(false);
      if (had && node.contains(doc.activeElement)) buttons[0]?.b.focus();
    };
    return { node, api: { reset } };
  },
  css: `
.ofs-quiz{width:100%;height:100%;display:flex;flex-direction:column;gap:.85em;padding:var(--q-pad);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scroll-behavior:smooth;scrollbar-width:thin;scrollbar-color:var(--q-border) transparent;line-height:1.35;overflow-wrap:break-word;word-break:break-word}
.ofs-quiz>*{flex:none}
.ofs-quiz-q{margin:0;font-size:1.3em;line-height:1.25;font-weight:800;letter-spacing:-.005em;white-space:pre-wrap}
.ofs-quiz-choices{display:flex;flex-direction:column;gap:.55em}
.ofs-quiz-grid .ofs-quiz-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.ofs-quiz-pills .ofs-quiz-choices{flex-direction:row;flex-wrap:wrap}
.ofs-quiz-choice{position:relative;display:flex;align-items:center;gap:.65em;width:100%;min-height:2.6em;margin:0;padding:.55em .8em;border:2px solid var(--q-border);border-radius:var(--q-radius);background:var(--q-choice);color:inherit;font:inherit;font-weight:700;line-height:1.3;text-align:left;cursor:pointer;transition:border-color .15s ease,background-color .15s ease,opacity .2s ease,box-shadow .15s ease}
.ofs-quiz-grid .ofs-quiz-choice{align-items:flex-start;min-height:3.2em}
.ofs-quiz-pills .ofs-quiz-choice{width:auto;max-width:100%;border-radius:999px;padding:.45em 1em .45em .5em}
.ofs-quiz-pills.ofs-quiz-noletters .ofs-quiz-choice{padding-left:1em}
.ofs-quiz-choice:not([aria-disabled]):hover{border-color:var(--q-accent);box-shadow:0 0 0 3px var(--q-accent-soft)}
.ofs-quiz-choice:focus-visible{outline:3px solid var(--q-accent);outline-offset:2px}
.ofs-quiz-choice[aria-disabled]{cursor:default}
.ofs-quiz-letter{flex:none;display:inline-flex;align-items:center;justify-content:center;width:1.75em;height:1.75em;border-radius:min(var(--q-radius),.6em);background:var(--q-accent-soft);color:var(--q-accent);font-size:.9em;font-weight:800;line-height:1;transition:background-color .15s ease,color .15s ease}
.ofs-quiz-pills .ofs-quiz-letter{border-radius:999px}
.ofs-quiz-choice:not([aria-disabled]):hover .ofs-quiz-letter{background:var(--q-accent);color:var(--q-on-accent)}
.ofs-quiz-text{flex:1;min-width:0;white-space:pre-wrap}
.ofs-quiz-grid .ofs-quiz-text{align-self:center}
.ofs-quiz-mark{flex:none;display:inline-flex;width:1.35em;height:1.35em;margin-left:auto}
.ofs-quiz-mark:empty{display:none}
.ofs-quiz-mark .ofs-icon{width:100%;height:100%}
.ofs-quiz-grid .ofs-quiz-mark{align-self:center}
.ofs-quiz-choice.ofs-correct{border-color:var(--q-success);background:var(--q-success-soft)}
.ofs-quiz-choice.ofs-correct .ofs-quiz-letter{background:var(--q-success);color:var(--q-on-success)}
.ofs-quiz-choice.ofs-correct .ofs-quiz-mark{color:var(--q-success)}
.ofs-quiz-choice.ofs-incorrect{border-color:var(--q-danger);background:var(--q-danger-soft)}
.ofs-quiz-choice.ofs-incorrect .ofs-quiz-letter{background:var(--q-danger);color:var(--q-on-danger)}
.ofs-quiz-choice.ofs-incorrect .ofs-quiz-mark{color:var(--q-danger)}
.ofs-quiz-choice.ofs-revealed{border-color:var(--q-success);border-style:dashed}
.ofs-quiz-choice.ofs-revealed .ofs-quiz-letter{background:var(--q-success-soft);color:var(--q-success)}
.ofs-quiz-choice.ofs-revealed .ofs-quiz-mark{color:var(--q-success)}
.ofs-quiz-choice.ofs-dim{opacity:.5}
.ofs-quiz-choice.ofs-pop{animation:ofs-quiz-pop .42s cubic-bezier(.3,1.6,.5,1)}
.ofs-quiz-choice.ofs-shake{animation:ofs-quiz-shake .42s ease}
@keyframes ofs-quiz-pop{0%{scale:1}40%{scale:1.035}100%{scale:1}}
@keyframes ofs-quiz-shake{0%,100%{translate:0}20%{translate:-.3em}40%{translate:.3em}60%{translate:-.2em}80%{translate:.12em}}
.ofs-quiz-footer{display:flex;flex-wrap:wrap;align-items:center;gap:.5em .8em}
.ofs-quiz-footer[hidden],.ofs-quiz-retry[hidden]{display:none}
.ofs-quiz-feedback{flex:1 1 12em;display:flex;align-items:flex-start;gap:.5em;font-weight:700;line-height:1.35;white-space:pre-wrap}
.ofs-quiz-fb-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:1.45em;height:1.45em;border-radius:50%;padding:.22em}
.ofs-quiz-fb-icon:empty{display:none}
.ofs-quiz-fb-icon .ofs-icon{width:100%;height:100%}
.ofs-quiz-fb-correct .ofs-quiz-fb-icon{background:var(--q-success);color:var(--q-on-success)}
.ofs-quiz-fb-incorrect .ofs-quiz-fb-icon{background:var(--q-danger);color:var(--q-on-danger)}
.ofs-quiz-fb-text:empty{display:none}
.ofs-quiz-fb-text{padding-top:.08em}
.ofs-quiz-retry{flex:none;display:inline-flex;align-items:center;gap:.4em;margin:0;padding:.45em 1em;border:2px solid var(--q-accent);border-radius:999px;background:transparent;color:var(--q-accent);font:inherit;font-size:.92em;font-weight:800;line-height:1.2;cursor:pointer;transition:background-color .15s ease,color .15s ease}
.ofs-quiz-retry:hover{background:var(--q-accent);color:var(--q-on-accent)}
.ofs-quiz-retry:focus-visible{outline:3px solid var(--q-accent);outline-offset:2px}
.ofs-editing .ofs-quiz-choice,.ofs-editing .ofs-quiz-retry{pointer-events:none;transition:none}
@media (prefers-reduced-motion:reduce){.ofs-quiz{scroll-behavior:auto}.ofs-quiz-choice.ofs-pop,.ofs-quiz-choice.ofs-shake{animation:none}.ofs-quiz-choice,.ofs-quiz-letter,.ofs-quiz-retry{transition:none}}
`,
};
