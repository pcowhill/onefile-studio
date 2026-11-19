import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { fontStack } from '../fonts';

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
  render(el, { doc }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-quiz', {
      fontFamily: fontStack(p.font),
      color: p.color,
      background: p.background,
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    node.textContent = p.question;
    return { node };
  },
  css: `.ofs-quiz{width:100%;height:100%}`,
};
