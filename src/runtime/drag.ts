import type { SceneElement } from '../model/types';
import { Registry } from './registry';

/** Feel settings for the physics-based modes (0..1 each, 0.5 = the polished default). */
export interface DragFeel {
  /** Floaty: playfulness (tilt / stretch). Weighted: weight (heavier = more lag and inertia). */
  amount: number;
  /** Floaty: how quickly it settles back. Weighted: how quickly it slows down after release. */
  settle: number;
}

/** A visual pose for an element during playback (viewer state; never saved into the project). */
export interface DragPose {
  /** Logical top-left position. */
  x: number;
  y: number;
  /** Absolute angle in degrees (the authored rotation is the starting value). */
  angle: number;
  /** Optional squash & stretch: scale factor along `stretchAngle` (1 = none). */
  stretch?: number;
  /** Axis of the stretch, degrees in page space. */
  stretchAngle?: number;
}

export interface DragContext {
  el: SceneElement;
  /** Feel settings (defaults filled in). */
  feel: DragFeel;
  /** Current stage scale (screen px per logical px). */
  scale(): number;
  /** Logical bounds of the page the element lives on. */
  bounds(): { w: number; h: number };
  /** Current logical position. */
  position(): { x: number; y: number };
  moveTo(x: number, y: number): void;
  /** Current absolute angle in degrees (starts at el.rotation, or the session's saved angle). */
  angle(): number;
  /** Applies a visual pose (position, angle, stretch) and remembers position + angle for the session. */
  setPose(pose: DragPose): void;
  /** Converts viewport (client) coordinates to logical page coordinates. */
  toLocal(clientX: number, clientY: number): { x: number; y: number };
  /** Window used for requestAnimationFrame / performance.now (the player's window). */
  win: Window;
}

export const DEFAULT_FEEL: DragFeel = { amount: 0.5, settle: 0.5 };

/**
 * Drag modes let viewers move elements during playback: "rigid" (follows the
 * pointer exactly), "floaty" (springy, tilts while moving, settles back to its
 * angle) and "weighted" (grab-point physics with momentum; keeps its final angle).
 */
export interface DragMode {
  id: string;
  attach(node: HTMLElement, ctx: DragContext): () => void;
}

export const dragRegistry = new Registry<DragMode>('drag');

dragRegistry.register({
  id: 'rigid',
  attach(node, ctx) {
    let start: { px: number; py: number; x: number; y: number } | null = null;
    let moved = false;
    node.style.touchAction = 'none';
    node.classList.add('ofs-draggable');
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = ctx.position();
      start = { px: e.clientX, py: e.clientY, x: p.x, y: p.y };
      moved = false;
      try {
        node.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const s = ctx.scale() || 1;
      const dx = (e.clientX - start.px) / s;
      const dy = (e.clientY - start.py) / s;
      if (!moved && Math.hypot(dx * s, dy * s) < 4) return;
      if (!moved) node.classList.add('ofs-dragging');
      moved = true;
      const b = ctx.bounds();
      const x = Math.max(-ctx.el.w / 2, Math.min(b.w - ctx.el.w / 2, start.x + dx));
      const y = Math.max(-ctx.el.h / 2, Math.min(b.h - ctx.el.h / 2, start.y + dy));
      ctx.moveTo(x, y);
    };
    const up = () => {
      start = null;
      node.classList.remove('ofs-dragging');
    };
    // A drag should not count as a click.
    const click = (e: Event) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('click', click, true);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      node.removeEventListener('click', click, true);
    };
  },
});
