import type { ReactNode } from 'react';
import type { ParamValue, Project } from '../../model/types';
import { SELF_TARGET } from '../../model/types';

/**
 * Editor-side catalog for triggers and actions. The runtime registries
 * (src/runtime/triggers.ts, src/runtime/actions.ts) execute them; these
 * entries describe how they appear in the no-code UI. Only registered,
 * working triggers/actions are listed.
 */

export interface Category {
  id: string;
  label: string;
  color: string;
  soft: string;
}

export const TRIGGER_CATEGORIES: Record<string, Category> = {
  mouse: { id: 'mouse', label: 'Mouse & touch', color: '#ff5d73', soft: '#ffe5ea' },
  keyboard: { id: 'keyboard', label: 'Keyboard', color: '#3d8bff', soft: '#e2ecff' },
  timing: { id: 'timing', label: 'Timing', color: '#f5b400', soft: '#fff4cc' },
  state: { id: 'state', label: 'Variables', color: '#8e44ad', soft: '#f1e4f8' },
  component: { id: 'component', label: 'This component', color: '#e84393', soft: '#fde4f0' },
};

export interface TriggerUi {
  id: string;
  label: string;
  /** Completes "When <element> …". */
  sentence: string;
  description: string;
  category: keyof typeof TRIGGER_CATEGORIES;
  /** Shown prominently; others go under "More". */
  primary?: boolean;
  /** Only offered for these element types (and then shown first). */
  forTypes?: string[];
  art: ReactNode;
}

const Badge = ({ kind }: { kind: 'check' | 'cross' | 'any' | 'timer' | 'end' }) => (
  <svg viewBox="0 0 120 90" className="ed-trigger-art">
    <circle cx="60" cy="45" r="38" fill="currentColor" opacity=".12" />
    {kind === 'timer' ? (
      <>
        <circle cx="60" cy="49" r="24" fill="#fff" stroke="#2a2340" strokeWidth="4" />
        <path d="M52 19h16M60 19v6M60 49V36" stroke="#2a2340" strokeWidth="4" strokeLinecap="round" />
        <path d="M60 49 L60 25 A24 24 0 0 1 84 49 Z" fill="currentColor" opacity=".85" />
        <text x="60" y="88" textAnchor="middle" fontSize="13" fontWeight="900" fill="currentColor" fontFamily="system-ui">
          0:00
        </text>
      </>
    ) : kind === 'end' ? (
      <>
        <rect x="28" y="24" width="64" height="42" rx="8" fill="#fff" stroke="#2a2340" strokeWidth="4" />
        <rect x="36" y="56" width="48" height="4" rx="2" fill="currentColor" />
        <path d="M54 36v14M66 36v14" stroke="#2a2340" strokeWidth="4" strokeLinecap="round" />
      </>
    ) : (
      <>
        <rect x="26" y="20" width="68" height="16" rx="8" fill="#fff" stroke="#2a2340" strokeWidth="3.5" />
        <rect x="26" y="44" width="68" height="16" rx="8" fill={kind === 'any' ? 'currentColor' : '#fff'} stroke="#2a2340" strokeWidth="3.5" />
        <circle cx="86" cy="62" r="14" fill={kind === 'cross' ? '#ff5d73' : kind === 'check' ? '#00b894' : 'currentColor'} />
        <path
          d={kind === 'cross' ? 'M80 56l12 12M92 56l-12 12' : kind === 'check' ? 'M79 62l5 5 9-10' : 'M80 62h12'}
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    )}
  </svg>
);

const Mouse = ({ left, right, dbl, hover }: { left?: boolean; right?: boolean; dbl?: boolean; hover?: boolean }) => (
  <svg viewBox="0 0 120 90" className="ed-trigger-art">
    <circle cx="60" cy="45" r="38" fill="currentColor" opacity=".12" />
    {hover && <path d="M24 22 L38 30 M20 45 h14 M24 68 L38 60" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".55" />}
    <rect x="42" y="14" width="36" height="58" rx="18" fill="#fff" stroke="#2a2340" strokeWidth="4" />
    <path d="M60 14 V38 M42 38 H78" stroke="#2a2340" strokeWidth="4" />
    {left && <path d="M60 16 V36 H44 V32 A16 16 0 0 1 60 16Z" fill="currentColor" />}
    {right && <path d="M60 16 V36 H76 V32 A16 16 0 0 0 60 16Z" fill="currentColor" />}
    {(left || right) && !dbl && (
      <path
        d={right ? 'M88 16 l8 -6 M92 28 h10 M88 40 l8 6' : 'M32 16 l-8 -6 M28 28 h-10 M32 40 l-8 6'}
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    )}
    {dbl && (
      <>
        <path d="M32 16 l-8 -6 M28 28 h-10 M32 40 l-8 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <text x="96" y="32" fontSize="18" fontWeight="900" fill="currentColor" fontFamily="system-ui">
          ×2
        </text>
      </>
    )}
  </svg>
);

export const TRIGGERS: TriggerUi[] = [
  { id: 'click', label: 'Click', sentence: 'is clicked', description: 'A normal click or tap', category: 'mouse', primary: true, art: <Mouse left /> },
  {
    id: 'rightclick',
    label: 'Right-click',
    sentence: 'is right-clicked',
    description: 'The secondary mouse button (long-press on touch)',
    category: 'mouse',
    primary: true,
    art: <Mouse right />,
  },
  { id: 'dblclick', label: 'Double-click', sentence: 'is double-clicked', description: 'Two quick clicks', category: 'mouse', art: <Mouse left dbl /> },
  { id: 'hover', label: 'Pointer enters', sentence: 'is hovered', description: 'The mouse moves over it', category: 'mouse', art: <Mouse hover /> },
  {
    id: 'quizCorrect',
    label: 'Answered correctly',
    sentence: 'is answered correctly',
    description: 'The viewer picks the right answer',
    category: 'component',
    forTypes: ['quiz'],
    art: <Badge kind="check" />,
  },
  {
    id: 'quizIncorrect',
    label: 'Answered wrongly',
    sentence: 'is answered wrongly',
    description: 'The viewer picks a wrong answer',
    category: 'component',
    forTypes: ['quiz'],
    art: <Badge kind="cross" />,
  },
  {
    id: 'quizAnswered',
    label: 'Any answer',
    sentence: 'is answered',
    description: 'Right or wrong — whenever an answer is chosen',
    category: 'component',
    forTypes: ['quiz'],
    art: <Badge kind="any" />,
  },
  {
    id: 'countdownDone',
    label: 'Countdown finishes',
    sentence: 'reaches zero',
    description: 'Runs once when the time is up (also if it is already up when opened)',
    category: 'component',
    forTypes: ['countdown'],
    art: <Badge kind="timer" />,
  },
  {
    id: 'mediaEnded',
    label: 'Finishes playing',
    sentence: 'finishes playing',
    description: 'The video or sound reaches its end',
    category: 'component',
    forTypes: ['video', 'audio'],
    art: <Badge kind="end" />,
  },
];

export const triggerUi = (id: string) => TRIGGERS.find((t) => t.id === id);

/** Triggers that make sense for an element type. */
export function triggersFor(type: string): TriggerUi[] {
  return TRIGGERS.filter((t) => !t.forTypes || t.forTypes.includes(type));
}

export const ACTION_CATEGORIES: Record<string, Category> = {
  visibility: { id: 'visibility', label: 'Show & hide', color: '#00a884', soft: '#dcf7ee' },
  navigation: { id: 'navigation', label: 'Navigate', color: '#3d8bff', soft: '#e2ecff' },
  variables: { id: 'variables', label: 'Variables', color: '#8e44ad', soft: '#f1e4f8' },
  animation: { id: 'animation', label: 'Animate', color: '#ff8a1f', soft: '#ffeedc' },
  media: { id: 'media', label: 'Video & audio', color: '#ef4444', soft: '#fde6e6' },
  components: { id: 'components', label: 'Components', color: '#e84393', soft: '#fde4f0' },
  timing: { id: 'timing', label: 'Timing', color: '#d39e00', soft: '#fff4cc' },
};

export interface ActionUi {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: keyof typeof ACTION_CATEGORIES;
  defaults(project: Project, selfId: string): Record<string, ParamValue>;
  /** Returns a reason when the action cannot be used yet (it is then shown disabled with the reason). */
  unavailable?(project: Project): string | null;
}

const firstVar = (p: Project) => p.variables[0]?.id ?? '';
const firstGallery = (p: Project) => p.pages.flatMap((x) => x.elements).find((e) => e.type === 'gallery')?.id ?? '';
const needsVar = (p: Project) => (p.variables.length ? null : 'Create a variable first (Variables panel)');
const firstOf = (p: Project, types: string[]) => p.pages.flatMap((x) => x.elements).find((e) => types.includes(e.type))?.id ?? '';
const MEDIA = ['video', 'audio'];
const mediaDefaults = (p: Project, self: string): Record<string, ParamValue> => {
  const own = p.pages.flatMap((x) => x.elements).find((e) => e.id === self);
  return { target: own && MEDIA.includes(own.type) ? SELF_TARGET : firstOf(p, MEDIA) };
};
const needsMedia = (p: Project) => (firstOf(p, MEDIA) ? null : 'Add a Video or Audio element first');

export const ACTIONS: ActionUi[] = [
  {
    id: 'show',
    label: 'Show',
    description: 'Make a hidden element appear',
    icon: 'eye',
    category: 'visibility',
    defaults: () => ({ target: '', effect: 'fade' }),
  },
  {
    id: 'hide',
    label: 'Hide',
    description: 'Make an element disappear',
    icon: 'eyeOff',
    category: 'visibility',
    defaults: (_p, self) => ({ target: self ? SELF_TARGET : '', effect: 'fade' }),
  },
  {
    id: 'toggle',
    label: 'Show / hide',
    description: 'Flip between visible and hidden',
    icon: 'eye',
    category: 'visibility',
    defaults: () => ({ target: '', effect: 'fade' }),
  },
  { id: 'navigate', label: 'Go to', description: 'Jump to another slide or section', icon: 'next', category: 'navigation', defaults: () => ({ page: 'next' }) },
  {
    id: 'varAdd',
    label: 'Add to',
    description: 'e.g. add 1 to Score',
    icon: 'plus',
    category: 'variables',
    defaults: (p) => ({ variable: firstVar(p), amount: 1 }),
    unavailable: needsVar,
  },
  {
    id: 'varSubtract',
    label: 'Subtract from',
    description: 'e.g. take 1 away from Lives',
    icon: 'minus',
    category: 'variables',
    defaults: (p) => ({ variable: firstVar(p), amount: 1 }),
    unavailable: needsVar,
  },
  {
    id: 'varSet',
    label: 'Set to',
    description: 'Give a variable a specific value',
    icon: 'variable',
    category: 'variables',
    defaults: (p) => ({ variable: firstVar(p), value: 0 }),
    unavailable: needsVar,
  },
  {
    id: 'varReset',
    label: 'Reset',
    description: 'Back to the starting value',
    icon: 'restart',
    category: 'variables',
    defaults: (p) => ({ variable: firstVar(p) || '@all' }),
    unavailable: needsVar,
  },
  {
    id: 'animate',
    label: 'Animate',
    description: 'Pop, shake, bounce, spin…',
    icon: 'sparkle',
    category: 'animation',
    defaults: () => ({ target: SELF_TARGET, preset: 'pop' }),
  },
  {
    id: 'gallery',
    label: 'Change gallery image',
    description: 'Show the next or previous image',
    icon: 'gallery',
    category: 'components',
    defaults: (p) => ({ target: firstGallery(p), direction: 'next' }),
    unavailable: (p) => (firstGallery(p) ? null : 'Add a Gallery first'),
  },
  {
    id: 'mediaPlay',
    label: 'Play',
    description: 'Start a video or sound',
    icon: 'play',
    category: 'media',
    defaults: mediaDefaults,
    unavailable: needsMedia,
  },
  {
    id: 'mediaPause',
    label: 'Pause',
    description: 'Pause a video or sound',
    icon: 'pause',
    category: 'media',
    defaults: mediaDefaults,
    unavailable: needsMedia,
  },
  {
    id: 'mediaRestart',
    label: 'Restart',
    description: 'Play again from the beginning',
    icon: 'restart',
    category: 'media',
    defaults: mediaDefaults,
    unavailable: needsMedia,
  },
  {
    id: 'quizReset',
    label: 'Reset quiz',
    description: 'Clear the answer so it can be tried again',
    icon: 'reset',
    category: 'components',
    defaults: (p, self) => ({ target: firstOf(p, ['quiz']) === self ? SELF_TARGET : firstOf(p, ['quiz']) }),
    unavailable: (p) => (firstOf(p, ['quiz']) ? null : 'Add a Quiz first'),
  },
  { id: 'wait', label: 'Wait', description: 'Pause before the next action', icon: 'clock', category: 'timing', defaults: () => ({ seconds: 0.5 }) },
];

export const actionUi = (id: string) => ACTIONS.find((a) => a.id === id);

export const VISIBILITY_EFFECTS = [
  { value: 'none', label: 'instantly' },
  { value: 'fade', label: 'with a fade' },
  { value: 'pop', label: 'with a pop' },
  { value: 'slide', label: 'with a slide' },
];

export const EMPHASIS_PRESETS = [
  { value: 'pop', label: 'Pop' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'shake', label: 'Shake' },
  { value: 'wiggle', label: 'Wiggle' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'spin', label: 'Spin' },
];

export const ENTRANCE_PRESETS = [
  { value: 'fadeIn', label: 'Fade in', icon: 'sparkle' },
  { value: 'slideIn', label: 'Slide in', icon: 'right' },
  { value: 'zoomIn', label: 'Pop in', icon: 'zoomIn' },
  { value: 'draw', label: 'Draw', icon: 'arrow', onlyFor: 'arrow' },
];
