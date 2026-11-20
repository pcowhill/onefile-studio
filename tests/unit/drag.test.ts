import { describe, expect, it, vi } from 'vitest';
import {
  createDragBody,
  dragRegistry,
  floatyPhysics,
  PHYSICS_STEP,
  weightedPhysics,
  type DragBody,
  type DragContext,
  type DragFeel,
  type DragPhysics,
  type DragPose,
} from '../../src/runtime/drag';
import type { SceneElement } from '../../src/model/types';

const BOUNDS = { w: 1000, h: 800 };

// ---------- pure physics helpers ----------

/** Runs `seconds` of fixed steps with the pointer moving at (vx, vy) px/s while held. */
function run(phys: DragPhysics, b: DragBody, seconds: number, p: { x: number; y: number }, vx = 0, vy = 0, onStep?: (b: DragBody) => void) {
  for (let t = 0; t < seconds - 1e-9; t += PHYSICS_STEP) {
    if (b.held) {
      p.x += vx * PHYSICS_STEP;
      p.y += vy * PHYSICS_STEP;
    }
    phys.step(b, PHYSICS_STEP, { px: p.x, py: p.y, pvx: b.held ? vx : 0, pvy: b.held ? vy : 0, bw: BOUNDS.w, bh: BOUNDS.h });
    onStep?.(b);
  }
}

/** Seconds until the body is at rest (stepping with the pointer still), or Infinity. */
function timeToRest(phys: DragPhysics, b: DragBody, p: { x: number; y: number }, max = 5) {
  for (let t = 0; t < max; t += PHYSICS_STEP) {
    if (phys.rest(b)) return t;
    run(phys, b, PHYSICS_STEP, p);
  }
  return Infinity;
}

/** A 300×200 card centred at (500, 400), grabbed at `offset` from its centre. */
function grabbed(phys: DragPhysics, offset: { x: number; y: number }, feel: Partial<DragFeel> = {}, angle = 0) {
  const b = createDragBody(500, 400, 300, 200, angle, { amount: 0.5, settle: 0.5, ...feel });
  const p = { x: 500 + offset.x, y: 400 + offset.y };
  phys.grab(b, p.x, p.y);
  return { b, p };
}

const finite = (b: DragBody) => [b.x, b.y, b.vx, b.vy, b.angle, b.spin, b.stretch, b.stretchAngle].every(Number.isFinite);

// ---------- DOM harness: fake window with a manual animation-frame clock ----------

function setup(mode: string, opts: { scale?: number; rotation?: number; feel?: Partial<DragFeel> } = {}) {
  const s = opts.scale ?? 1;
  // Only the geometry is read by drag modes.
  const el = { id: 'el', x: 100, y: 100, w: 200, h: 100, rotation: opts.rotation ?? 0 } as SceneElement;
  let pos = { x: el.x, y: el.y };
  let angle = el.rotation;
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const poses: DragPose[] = [];
  const win = {
    requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
      frames.set(++nextId, cb);
      return nextId;
    }),
    cancelAnimationFrame: vi.fn((id: number) => void frames.delete(id)),
    performance: { now: () => now },
  };
  const ctx: DragContext = {
    el,
    feel: { amount: 0.5, settle: 0.5, ...opts.feel },
    scale: () => s,
    bounds: () => BOUNDS,
    position: () => pos,
    moveTo: vi.fn((x: number, y: number) => void (pos = { x, y })),
    angle: () => angle,
    setPose: vi.fn((p: DragPose) => {
      pos = { x: p.x, y: p.y };
      angle = p.angle;
      poses.push(p);
    }),
    toLocal: (cx, cy) => ({ x: cx / s, y: cy / s }),
    win: win as unknown as Window,
  };
  const node = document.createElement('div');
  const parent = document.createElement('div');
  parent.appendChild(node);
  const cleanup = dragRegistry.get(mode)!.attach(node, ctx);
  const fire = (type: string, x: number, y: number, extra: { button?: number; pointerId?: number } = {}) => {
    const e = new MouseEvent(type, { clientX: x, clientY: y, button: extra.button ?? 0, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'pointerId', { value: extra.pointerId ?? 1 });
    node.dispatchEvent(e);
  };
  /** Advances the clock by one 60 fps frame and runs pending frame callbacks. */
  const tick = (ms = 1000 / 60) => {
    now += ms;
    const cbs = [...frames.values()];
    frames.clear();
    for (const cb of cbs) cb(now);
  };
  const frameFor = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) tick();
  };
  return { el, ctx, node, parent, win, frames, poses, fire, tick, frameFor, cleanup, pos: () => pos, angle: () => angle };
}

/** Drags from (x0, y0) by (dx, dy) in `n` frames, one pointermove per frame. */
function dragBy(h: ReturnType<typeof setup>, x0: number, y0: number, dx: number, dy: number, n = 20) {
  h.fire('pointerdown', x0, y0);
  for (let k = 1; k <= n; k++) {
    h.fire('pointermove', x0 + (dx * k) / n, y0 + (dy * k) / n);
    h.tick();
  }
}

// ---------- rigid ----------

describe('drag: rigid (regression)', () => {
  it('moves by the pointer delta divided by the stage scale', () => {
    const h = setup('rigid', { scale: 2 });
    expect(h.node.classList.contains('ofs-draggable')).toBe(true);
    h.fire('pointerdown', 300, 300);
    h.fire('pointermove', 340, 320);
    expect(h.pos()).toEqual({ x: 120, y: 110 });
    expect(h.node.classList.contains('ofs-dragging')).toBe(true);
    h.fire('pointerup', 340, 320);
    expect(h.node.classList.contains('ofs-dragging')).toBe(false);
  });

  it('keeps at least half the element on the page', () => {
    const h = setup('rigid');
    h.fire('pointerdown', 150, 150);
    h.fire('pointermove', -2000, 5000);
    expect(h.pos()).toEqual({ x: -100, y: BOUNDS.h - 50 });
  });

  it('a press under 4px is not a drag, and clicks pass through', () => {
    const h = setup('rigid');
    const onClick = vi.fn();
    h.parent.addEventListener('click', onClick);
    h.fire('pointerdown', 150, 150);
    h.fire('pointermove', 152, 152);
    h.fire('pointerup', 152, 152);
    h.node.click();
    expect(h.ctx.moveTo).not.toHaveBeenCalled();
    expect(h.node.classList.contains('ofs-dragging')).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('swallows the click that ends a drag', () => {
    const h = setup('rigid');
    const onClick = vi.fn();
    h.parent.addEventListener('click', onClick);
    h.fire('pointerdown', 150, 150);
    h.fire('pointermove', 200, 150);
    h.fire('pointerup', 200, 150);
    h.node.click();
    expect(onClick).not.toHaveBeenCalled();
    h.node.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cleanup removes its listeners', () => {
    const h = setup('rigid');
    h.cleanup();
    h.fire('pointerdown', 150, 150);
    h.fire('pointermove', 250, 150);
    expect(h.ctx.moveTo).not.toHaveBeenCalled();
  });
});

// ---------- floaty ----------

describe('drag: floaty physics', () => {
  it('tilts with horizontal velocity (top leads) within the amount-scaled limit', () => {
    for (const [vx, sign] of [
      [400, 1],
      [-400, -1],
    ]) {
      const { b, p } = grabbed(floatyPhysics, { x: 0, y: -50 });
      let peak = 0;
      run(floatyPhysics, b, 0.5, p, vx, 0, (s) => (peak = Math.max(peak, Math.abs(s.angle))));
      expect(Math.sign(b.angle)).toBe(sign);
      expect(Math.abs(b.angle)).toBeGreaterThan(5);
      expect(peak).toBeLessThanOrEqual(14 + 1e-9);
    }
    for (const amount of [0.5, 1]) {
      const { b, p } = grabbed(floatyPhysics, { x: 0, y: 0 }, { amount });
      let peak = 0;
      run(floatyPhysics, b, 0.4, p, 4000, 0, (s) => (peak = Math.max(peak, Math.abs(s.angle))));
      expect(peak).toBeLessThanOrEqual(4 + 20 * amount + 1e-9);
      expect(peak).toBeGreaterThan(amount === 1 ? 18 : 10);
    }
  });

  it('springs back to its original angle after release, then rests', () => {
    const { b, p } = grabbed(floatyPhysics, { x: 30, y: -40 }, {}, 12);
    run(floatyPhysics, b, 0.6, p, 400, 0);
    expect(b.angle - 12).toBeGreaterThan(5);
    b.held = false; // release
    const t = timeToRest(floatyPhysics, b, p);
    expect(t).toBeGreaterThan(0.3);
    expect(t).toBeLessThan(1.2);
    expect(b.angle).toBe(12);
    // It ends where the pointer left it (centre = pointer + grab offset).
    expect(b.x).toBeCloseTo(p.x - 30, 5);
    expect(b.y).toBeCloseTo(p.y + 40, 5);
  });

  it('settle=1 comes to rest faster than settle=0', () => {
    const times = [0, 1].map((settle) => {
      const { b, p } = grabbed(floatyPhysics, { x: 0, y: 0 }, { settle });
      run(floatyPhysics, b, 0.5, p, 500, 0);
      b.held = false; // release
      return timeToRest(floatyPhysics, b, p);
    });
    expect(times[1]).toBeLessThan(times[0] * 0.5);
    expect(times[0]).toBeLessThan(1.6);
  });

  it('stretches along the motion by at most 10%', () => {
    for (const amount of [0, 0.5, 1]) {
      const { b, p } = grabbed(floatyPhysics, { x: 0, y: 0 }, { amount });
      let [lo, hi] = [Infinity, 0];
      run(floatyPhysics, b, 0.15, p, 2500, 2500, (s) => {
        lo = Math.min(lo, s.stretch);
        hi = Math.max(hi, s.stretch);
      });
      expect(lo).toBeGreaterThanOrEqual(1);
      expect(hi).toBeLessThanOrEqual(1.1);
      expect(b.stretchAngle).toBeCloseTo(45, 0);
    }
  });

  it('keeps the centre on the page', () => {
    const { b, p } = grabbed(floatyPhysics, { x: 0, y: 0 });
    run(floatyPhysics, b, 1, p, 3000, -3000);
    expect(b.x).toBeCloseTo(BOUNDS.w, 5);
    expect(b.y).toBeCloseTo(0, 5);
  });
});

describe('drag: floaty in the DOM', () => {
  it('tilts while dragged, returns to the original angle and stops its loop', () => {
    const h = setup('floaty', { rotation: 10 });
    dragBy(h, 200, 150, 200, 0);
    expect(h.node.classList.contains('ofs-dragging')).toBe(true);
    expect(h.angle()).toBeGreaterThan(13);
    h.fire('pointerup', 400, 150);
    expect(h.node.classList.contains('ofs-dragging')).toBe(false);
    h.frameFor(1.5);
    expect(h.frames.size).toBe(0);
    expect(h.angle()).toBe(10);
    expect(h.pos()).toEqual({ x: 300, y: 100 });
    // setPose runs at most once per frame.
    expect(h.poses.length).toBeLessThanOrEqual(h.win.requestAnimationFrame.mock.calls.length);
  });

  it('a press under 4px does not move it; the click after a drag is swallowed', () => {
    const h = setup('floaty');
    const onClick = vi.fn();
    h.parent.addEventListener('click', onClick);
    h.fire('pointerdown', 150, 150);
    h.fire('pointermove', 153, 151);
    h.fire('pointerup', 153, 151);
    h.frameFor(0.2);
    h.node.click();
    expect(h.pos()).toEqual({ x: 100, y: 100 });
    expect(onClick).toHaveBeenCalledTimes(1);
    dragBy(h, 150, 150, 60, 0, 5);
    h.fire('pointerup', 210, 150);
    h.node.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores other buttons and re-reads the session pose on a fresh grab', () => {
    const h = setup('floaty');
    h.fire('pointerdown', 150, 150, { button: 2 });
    h.fire('pointermove', 250, 150, { button: 2 });
    h.frameFor(0.1);
    expect(h.ctx.setPose).not.toHaveBeenCalled();
    h.ctx.moveTo(400, 300); // e.g. another behaviour moved it
    dragBy(h, 500, 350, 10, 0, 2);
    h.fire('pointerup', 510, 350);
    h.frameFor(1.5);
    expect(h.pos().x).toBeCloseTo(410, 5);
    expect(h.pos().y).toBeCloseTo(300, 5);
  });
});

// ---------- weighted ----------

describe('drag: weighted physics', () => {
  it('rotates when dragged by a corner, barely when grabbed at the centre', () => {
    const corner = grabbed(weightedPhysics, { x: 150, y: 100 });
    run(weightedPhysics, corner.b, 0.6, corner.p, 500, 0);
    // The centre swings to trail behind the grab point: the bottom-right corner turns counter-clockwise.
    expect(corner.b.angle).toBeLessThan(-15);
    expect(corner.b.angle).toBeGreaterThan(-60);
    const centre = grabbed(weightedPhysics, { x: 0, y: 0 });
    run(weightedPhysics, centre.b, 0.6, centre.p, 500, 0);
    expect(Math.abs(centre.b.angle)).toBeLessThan(0.5);
  });

  it('keeps its momentum and final angle after release, then comes to rest', () => {
    const { b, p } = grabbed(weightedPhysics, { x: -150, y: -100 }, {}, 5);
    run(weightedPhysics, b, 0.5, p, 500, 0);
    b.held = false; // release
    const [x, angle] = [b.x, b.angle];
    const t = timeToRest(weightedPhysics, b, p);
    expect(t).toBeLessThan(2);
    expect(b.x - x).toBeGreaterThan(20); // glides on
    expect(b.x - x).toBeLessThan(200);
    expect(Math.abs(b.angle - 5)).toBeGreaterThan(20); // no return to the original angle
    expect(Math.abs(b.angle - angle)).toBeLessThan(30);
    expect(b.vx).toBe(0);
    expect(b.spin).toBe(0);
  });

  it('settle controls how quickly it slows down', () => {
    const glide = [0, 1].map((settle) => {
      const { b, p } = grabbed(weightedPhysics, { x: 0, y: 0 }, { settle });
      run(weightedPhysics, b, 0.5, p, 500, 0);
      b.held = false; // release
      const x = b.x;
      timeToRest(weightedPhysics, b, p);
      return b.x - x;
    });
    expect(glide[0]).toBeGreaterThan(glide[1] * 3);
  });

  it('heavier lags further behind the pointer', () => {
    const lag = [0, 0.5, 1].map((amount) => {
      const { b, p } = grabbed(weightedPhysics, { x: 0, y: 0 }, { amount });
      run(weightedPhysics, b, 0.3, p, 600, 0);
      return b.err; // how far the grab point trails the pointer
    });
    expect(lag[0]).toBeGreaterThan(0);
    expect(lag[1]).toBeGreaterThan(lag[0] * 1.5);
    expect(lag[2]).toBeGreaterThan(lag[1] * 1.5);
  });

  it('keeps its centre on the page and bounces softly off the edges', () => {
    const { b, p } = grabbed(weightedPhysics, { x: 60, y: 40 });
    run(weightedPhysics, b, 0.25, p, 3000, 1500);
    b.held = false; // release
    let bounced = false;
    run(weightedPhysics, b, 2, p, 0, 0, (s) => {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(BOUNDS.w);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(BOUNDS.h);
      if (s.vx < 0) bounced = true;
    });
    expect(bounced).toBe(true);
  });

  it('never produces NaN or runaway spin', () => {
    const { b, p } = grabbed(weightedPhysics, { x: 150, y: 100 });
    run(weightedPhysics, b, 0.3, p, 1e7, -1e7);
    expect(finite(b)).toBe(true);
    expect(Math.abs(b.spin)).toBeLessThanOrEqual(1440);
    weightedPhysics.step(b, PHYSICS_STEP, { px: NaN, py: 0, pvx: Infinity, pvy: 0, bw: BOUNDS.w, bh: BOUNDS.h });
    expect(finite(b)).toBe(true);
    const flat = createDragBody(10, 10, 0, 0, 0, { amount: 1, settle: 0 });
    weightedPhysics.grab(flat, 10, 10);
    run(weightedPhysics, flat, 0.2, { x: 10, y: 10 }, 800, 0);
    expect(finite(flat)).toBe(true);
    const f = grabbed(floatyPhysics, { x: 0, y: 0 });
    floatyPhysics.step(f.b, PHYSICS_STEP, { px: NaN, py: Infinity, pvx: 0, pvy: 0, bw: BOUNDS.w, bh: BOUNDS.h });
    expect(finite(f.b)).toBe(true);
    floatyPhysics.rest(f.b);
    expect(finite(f.b) && Number.isFinite(f.b.tx)).toBe(true);
  });
});

describe('drag: weighted in the DOM', () => {
  it('a corner drag rotates the element and it keeps the angle after release', () => {
    const h = setup('weighted');
    dragBy(h, 295, 195, 300, 0, 30); // bottom-right corner of a 200×100 element at (100, 100)
    h.fire('pointerup', 595, 195);
    h.frameFor(3);
    expect(h.frames.size).toBe(0);
    expect(h.angle()).toBeLessThan(-10);
    const last = h.poses[h.poses.length - 1];
    expect([last.x, last.y, last.angle].every(Number.isFinite)).toBe(true);
  });

  it('pointercancel ends the drag like a release, and later moves are ignored', () => {
    const h = setup('weighted');
    dragBy(h, 200, 150, 100, 0, 10);
    h.fire('pointercancel', 300, 150);
    expect(h.node.classList.contains('ofs-dragging')).toBe(false);
    h.frameFor(3);
    expect(h.frames.size).toBe(0);
    const x = h.pos().x;
    h.fire('pointermove', 600, 150);
    h.frameFor(0.2);
    expect(h.pos().x).toBe(x);
    expect(h.frames.size).toBe(0);
  });

  it('lostpointercapture also ends the drag', () => {
    const h = setup('weighted');
    dragBy(h, 200, 150, 100, 0, 10);
    h.fire('lostpointercapture', 300, 150);
    expect(h.node.classList.contains('ofs-dragging')).toBe(false);
  });

  it('re-grabbing a gliding element catches it without a jump', () => {
    const h = setup('weighted');
    dragBy(h, 200, 150, 200, 0, 10);
    h.fire('pointerup', 400, 150);
    h.frameFor(0.1);
    const before = { ...h.pos(), a: h.angle() };
    h.fire('pointerdown', 380, 150);
    h.tick();
    expect(Math.abs(h.pos().x - before.x)).toBeLessThan(10);
    expect(Math.abs(h.angle() - before.a)).toBeLessThan(2);
    h.frameFor(1);
    const caught = h.pos().x;
    h.frameFor(0.5);
    expect(Math.abs(h.pos().x - caught)).toBeLessThan(0.5); // held in place
    h.fire('pointerup', 380, 150);
  });

  it('cleanup cancels a pending animation frame and removes listeners', () => {
    const h = setup('weighted');
    dragBy(h, 200, 150, 100, 0, 5);
    expect(h.frames.size).toBe(1);
    h.cleanup();
    expect(h.win.cancelAnimationFrame).toHaveBeenCalled();
    expect(h.frames.size).toBe(0);
    const n = h.poses.length;
    h.fire('pointermove', 400, 150);
    h.fire('pointerup', 400, 150);
    h.frameFor(0.2);
    expect(h.poses.length).toBe(n);
  });
});
