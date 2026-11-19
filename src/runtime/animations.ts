import type { Direction } from '../model/types';
import { Registry } from './registry';

export interface AnimationOptions {
  duration: number;
  delay?: number;
  direction?: Direction;
}

export interface AnimationPreset {
  id: string;
  kind: 'entrance' | 'emphasis' | 'exit';
  directional?: boolean;
  /** Restrict to element types (e.g. "draw" only applies to arrows). */
  onlyFor?: string[];
  defaultDuration: number;
  easing?: string;
  keyframes?(opts: AnimationOptions): Keyframe[];
  /** Custom implementation; returns the animations started. */
  custom?(node: HTMLElement, opts: AnimationOptions): Animation[];
}

export const animationRegistry = new Registry<AnimationPreset>('animation');

const DIST = 90;
const offset = (d: Direction | undefined, k = 1): string => {
  switch (d) {
    case 'right':
      return `translate(${DIST * k}px, 0)`;
    case 'up':
      return `translate(0, ${-DIST * k}px)`;
    case 'down':
      return `translate(0, ${DIST * k}px)`;
    default:
      return `translate(${-DIST * k}px, 0)`;
  }
};
const BOUNCY = 'cubic-bezier(.34,1.56,.64,1)';
const SMOOTH = 'cubic-bezier(.22,1,.36,1)';

const presets: AnimationPreset[] = [
  { id: 'fadeIn', kind: 'entrance', defaultDuration: 600, easing: 'ease-out', keyframes: () => [{ opacity: 0 }, { opacity: 1 }] },
  {
    id: 'slideIn',
    kind: 'entrance',
    directional: true,
    defaultDuration: 700,
    easing: SMOOTH,
    keyframes: (o) => [
      { opacity: 0, transform: offset(o.direction) },
      { opacity: 1, transform: 'translate(0, 0)' },
    ],
  },
  {
    id: 'zoomIn',
    kind: 'entrance',
    defaultDuration: 600,
    easing: BOUNCY,
    keyframes: () => [
      { opacity: 0, transform: 'scale(0.4)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
  },
  {
    id: 'draw',
    kind: 'entrance',
    onlyFor: ['arrow'],
    defaultDuration: 900,
    custom(node, o) {
      const out: Animation[] = [];
      const line = node.querySelector<SVGPathElement>('.ofs-arrow-line');
      const heads = node.querySelectorAll<SVGElement>('.ofs-arrow-head');
      const delay = o.delay ?? 0;
      if (line && typeof line.getTotalLength === 'function') {
        const len = line.getTotalLength() || 1;
        const dash = line.getAttribute('stroke-dasharray');
        if (!dash) {
          out.push(
            line.animate(
              [
                { strokeDasharray: `${len} ${len}`, strokeDashoffset: `${len}` },
                { strokeDasharray: `${len} ${len}`, strokeDashoffset: '0' },
              ],
              {
                duration: o.duration * 0.8,
                delay,
                easing: 'ease-in-out',
                fill: 'backwards',
              },
            ),
          );
        } else {
          out.push(
            node.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
              duration: o.duration * 0.8,
              delay,
              easing: 'ease-in-out',
              fill: 'backwards',
            }),
          );
        }
      }
      heads.forEach((hd) =>
        out.push(hd.animate([{ opacity: 0 }, { opacity: 1 }], { duration: o.duration * 0.25, delay: delay + o.duration * 0.72, fill: 'backwards' })),
      );
      return out;
    },
  },
  { id: 'fadeOut', kind: 'exit', defaultDuration: 500, easing: 'ease-in', keyframes: () => [{ opacity: 1 }, { opacity: 0 }] },
  {
    id: 'slideOut',
    kind: 'exit',
    directional: true,
    defaultDuration: 600,
    easing: 'cubic-bezier(.55,0,.75,.2)',
    keyframes: (o) => [
      { opacity: 1, transform: 'translate(0, 0)' },
      { opacity: 0, transform: offset(o.direction, -1) },
    ],
  },
  {
    id: 'zoomOut',
    kind: 'exit',
    defaultDuration: 450,
    easing: 'ease-in',
    keyframes: () => [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.4)' },
    ],
  },
  {
    id: 'pop',
    kind: 'emphasis',
    defaultDuration: 380,
    keyframes: () => [
      { transform: 'scale(1)' },
      { transform: 'scale(1.16)', offset: 0.35 },
      { transform: 'scale(0.94)', offset: 0.7 },
      { transform: 'scale(1)' },
    ],
  },
  {
    id: 'shake',
    kind: 'emphasis',
    defaultDuration: 500,
    keyframes: () => [0, -12, 12, -9, 9, -5, 5, 0].map((x) => ({ transform: `translateX(${x}px)` })),
  },
  {
    id: 'wiggle',
    kind: 'emphasis',
    defaultDuration: 600,
    keyframes: () => [0, -9, 8, -6, 4, 0].map((r) => ({ transform: `rotate(${r}deg)` })),
  },
  {
    id: 'bounce',
    kind: 'emphasis',
    defaultDuration: 700,
    keyframes: () => [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-28px)', offset: 0.3, easing: 'ease-in' },
      { transform: 'translateY(0)', offset: 0.55, easing: 'ease-out' },
      { transform: 'translateY(-10px)', offset: 0.75, easing: 'ease-in' },
      { transform: 'translateY(0)' },
    ],
  },
  {
    id: 'pulse',
    kind: 'emphasis',
    defaultDuration: 800,
    easing: 'ease-in-out',
    keyframes: () => [
      { transform: 'scale(1)' },
      { transform: 'scale(1.08)' },
      { transform: 'scale(1)' },
      { transform: 'scale(1.08)' },
      { transform: 'scale(1)' },
    ],
  },
  {
    id: 'spin',
    kind: 'emphasis',
    defaultDuration: 700,
    easing: 'cubic-bezier(.45,0,.25,1)',
    keyframes: () => [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  },
];
presets.forEach((p) => animationRegistry.register(p));

/** Plays a preset on `node`. Resolves when finished (immediately where WAAPI is unavailable). */
export function playAnimation(node: HTMLElement, presetId: string, opts: Partial<AnimationOptions> = {}): Promise<void> {
  const preset = animationRegistry.get(presetId);
  if (!preset || typeof node.animate !== 'function') return Promise.resolve();
  const o: AnimationOptions = {
    duration: Math.max(50, Math.min(10000, Number(opts.duration) || preset.defaultDuration)),
    delay: Math.max(0, Math.min(20000, Number(opts.delay) || 0)),
    direction: opts.direction,
  };
  let anims: Animation[];
  if (preset.custom) anims = preset.custom(node, o);
  else {
    anims = [
      node.animate(preset.keyframes!(o), {
        duration: o.duration,
        delay: o.delay,
        easing: preset.easing ?? 'ease',
        fill: preset.kind === 'entrance' ? 'backwards' : preset.kind === 'exit' ? 'forwards' : 'none',
      }),
    ];
  }
  return Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(() => {
    if (preset.kind === 'exit') anims.forEach((a) => a.cancel());
  });
}
