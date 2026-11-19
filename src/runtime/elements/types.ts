import type { SceneElement } from '../../model/types';
import type { RuntimeEnv } from '../env';

export interface RenderCtx {
  env: RuntimeEnv;
  doc: Document;
  /** Register teardown (listeners, timers, subscriptions). */
  onCleanup(fn: () => void): void;
}

/** Imperative capabilities an element exposes to actions (e.g. gallery "next", video "play"). */
export interface ElementApi {
  next?(): void;
  prev?(): void;
  /** Gallery: first image. Quiz: clear the answer. */
  reset?(): void;
  /** Media (video/audio). */
  play?(): void;
  pause?(): void;
  restart?(): void;
}

export interface RenderResult {
  node: HTMLElement;
  api?: ElementApi;
}

export interface RuntimeElementDef<P extends object = Record<string, unknown>> {
  /** Element type id stored in SceneElement.type. */
  id: string;
  defaults(): P;
  render(el: SceneElement<P>, ctx: RenderCtx): RenderResult;
  /** Element-specific playback CSS (class names prefixed with `ofs-`). */
  css?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyElementDef = RuntimeElementDef<any>;

export const SHADOWS: Record<string, string> = Object.assign(Object.create(null), {
  none: 'none',
  soft: '0 6px 20px rgba(32, 20, 70, 0.14)',
  lifted: '0 18px 44px rgba(32, 20, 70, 0.26)',
  subtle: '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 14px rgba(15, 23, 42, 0.07)',
  glow: '0 0 0 1px rgba(56, 189, 248, 0.28), 0 0 26px rgba(34, 211, 238, 0.16)',
});

/** Equivalent drop-shadow filters for non-rectangular content (SVG shapes). */
export const DROP_SHADOWS: Record<string, string> = Object.assign(Object.create(null), {
  soft: 'drop-shadow(0 5px 10px rgba(32,20,70,.16))',
  lifted: 'drop-shadow(0 14px 22px rgba(32,20,70,.28))',
  subtle: 'drop-shadow(0 2px 5px rgba(15,23,42,.12))',
  glow: 'drop-shadow(0 0 10px rgba(34,211,238,.35))',
});

export function h<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  style?: Partial<CSSStyleDeclaration>,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (style) Object.assign(node.style, style);
  return node;
}

export const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Tiny icon set used inside rendered content (buttons, gallery arrows, handles). */
export const ICON_PATHS: Record<string, string> = Object.assign(Object.create(null), {
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  play: 'M8 5.5v13l11-6.5z',
  star: 'M12 3.5l2.6 5.6 6 .6-4.5 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6L3.4 9.7l6-.6z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  plus: 'M12 5v14M5 12h14',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
});

export function icon(doc: Document, name: string, size = 20, filled = false): SVGSVGElement {
  const s = svg(doc, 'svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' });
  s.setAttribute('class', 'ofs-icon');
  const p = svg(doc, 'path', {
    d: ICON_PATHS[name] ?? ICON_PATHS['arrow-right'],
    fill: filled ? 'currentColor' : 'none',
    stroke: 'currentColor',
    'stroke-width': filled ? 1 : 2.4,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  s.appendChild(p);
  return s;
}

export function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
