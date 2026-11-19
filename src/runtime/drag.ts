import type { SceneElement } from '../model/types';
import { Registry } from './registry';

export interface DragContext {
  el: SceneElement;
  /** Current stage scale (screen px per logical px). */
  scale(): number;
  /** Logical bounds of the page the element lives on. */
  bounds(): { w: number; h: number };
  /** Current logical position. */
  position(): { x: number; y: number };
  moveTo(x: number, y: number): void;
}

/**
 * Drag modes let viewers move elements during playback. "rigid" is the only
 * MVP mode; future modes (e.g. "floaty" spring rotation, "weighted" inertia)
 * register here with the same attach() contract.
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
