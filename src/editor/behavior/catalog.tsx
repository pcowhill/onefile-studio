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
  art: ReactNode;
}

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
];

export const triggerUi = (id: string) => TRIGGERS.find((t) => t.id === id);

export const ACTION_CATEGORIES: Record<string, Category> = {
  visibility: { id: 'visibility', label: 'Show & hide', color: '#00a884', soft: '#dcf7ee' },
  navigation: { id: 'navigation', label: 'Navigate', color: '#3d8bff', soft: '#e2ecff' },
  variables: { id: 'variables', label: 'Variables', color: '#8e44ad', soft: '#f1e4f8' },
  animation: { id: 'animation', label: 'Animate', color: '#ff8a1f', soft: '#ffeedc' },
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
