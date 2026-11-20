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

const unit = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);

/** The feel settings of a drag behaviour with defaults filled in. */
export function dragFeel(drag: { amount?: number; settle?: number } | null | undefined): DragFeel {
  return { amount: unit(drag?.amount, DEFAULT_FEEL.amount), settle: unit(drag?.settle, DEFAULT_FEEL.settle) };
}

/** CSS transform for a pose: rotation plus an optional squash & stretch along an axis. */
export function poseTransform(angle: number, stretch = 1, stretchAngle = 0): string {
  const r = `rotate(${round(angle)}deg)`;
  if (!stretch || Math.abs(stretch - 1) < 0.002) return angle ? r : '';
  // Stretch along the axis, squash across it (area roughly preserved). The axis is in page space,
  // so undo the element's rotation first.
  const a = round(stretchAngle - angle);
  return `${r} rotate(${a}deg) scale(${round(stretch, 4)}, ${round(1 / stretch, 4)}) rotate(${-a}deg)`;
}

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

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

// ---------- physics modes: floaty and weighted ----------
//
// The physics is DOM-free (a plain body + step functions) so it can be unit-tested; `attachPhysics` wires a body
// to pointer events and a requestAnimationFrame loop that runs only while the element is held or still moving.

/** Fixed integration step (s): the motion is the same at any frame rate. */
export const PHYSICS_STEP = 1 / 240;
const MAX_FRAME = 1 / 30; // longer frames (tab switches, jank) are not simulated in full
const MAX_SPIN = 1440; // deg/s
const DEG = 180 / Math.PI;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Simulation state of a dragged element (logical px, seconds, degrees): centre `x, y`, velocity `vx, vy`,
 * absolute `angle` and angular velocity `spin` (deg/s), squash & `stretch` along `stretchAngle`, size `w, h`.
 * Grab offset `gx, gy` — floaty: centre minus pointer in page space; weighted: pointer minus centre in the
 * element's own frame. Floaty only: target centre `tx, ty` and the `home` angle it returns to. `err` is how far
 * the spring is from satisfied (px), for rest detection.
 */
export type DragBody = Record<
  'x' | 'y' | 'vx' | 'vy' | 'angle' | 'spin' | 'stretch' | 'stretchAngle' | 'w' | 'h' | 'gx' | 'gy' | 'tx' | 'ty' | 'home' | 'err',
  number
> & {
  held: boolean;
  feel: DragFeel;
};

/** Pointer position `px, py` (logical px, interpolated per step) and velocity `pvx, pvy` (px/s); page size `bw, bh`. */
export type DragInput = Record<'px' | 'py' | 'pvx' | 'pvy' | 'bw' | 'bh', number>;

export interface DragPhysics {
  /** Starts holding the body at pointer (px, py); a moving body is caught from its current state. */
  grab(b: DragBody, px: number, py: number): void;
  /** Advances one fixed step of `dt` seconds. */
  step(b: DragBody, dt: number, input: DragInput): void;
  /** True once nothing visibly moves any more (and snaps the body exactly to rest). */
  rest(b: DragBody): boolean;
}

/** A body at rest, centred at (x, y). */
export function createDragBody(x: number, y: number, w: number, h: number, angle: number, feel: DragFeel = DEFAULT_FEEL): DragBody {
  return { x, y, vx: 0, vy: 0, angle, spin: 0, stretch: 1, stretchAngle: 0, held: false, gx: 0, gy: 0, tx: x, ty: y, home: angle, err: 0, w, h, feel };
}

/** Keeps the centre on the page; velocity into an edge is reflected with restitution `e`. */
function keepInside(b: DragBody, bw: number, bh: number, e: number) {
  if ((b.x < 0 && b.vx < 0) || (b.x > bw && b.vx > 0)) b.vx *= -e;
  if ((b.y < 0 && b.vy < 0) || (b.y > bh && b.vy > 0)) b.vy *= -e;
  b.x = clamp(b.x, 0, Math.max(0, bw));
  b.y = clamp(b.y, 0, Math.max(0, bh));
}

/** Never let a bad number reach the page: fall back to the pose before the step, at rest. */
function guard(b: DragBody, x: number, y: number, angle: number) {
  if ([b.x, b.y, b.vx, b.vy, b.angle, b.spin, b.stretch, b.stretchAngle, b.tx, b.ty, b.err].every(Number.isFinite)) return;
  Object.assign(b, { x, y, angle, vx: 0, vy: 0, spin: 0, stretch: 1, stretchAngle: 0, tx: x, ty: y, err: 0 });
}

/**
 * Floaty: the centre trails the pointer on a near-critically damped spring; the angle is an underdamped
 * spring towards a tilt that follows horizontal velocity (moving right leans the top right, like a card
 * hanging from the grab point), so it wobbles back to its original angle once the motion stops. The centre
 * lags a little behind its target, so after release it glides softly into place.
 */
export const floatyPhysics: DragPhysics = {
  grab(b, px, py) {
    b.held = true;
    b.gx = b.x - px;
    b.gy = b.y - py;
  },
  step(b, dt, i) {
    const { amount, settle } = b.feel;
    const [x0, y0, a0] = [b.x, b.y, b.angle];
    if (b.held) [b.tx, b.ty] = [i.px + b.gx, i.py + b.gy];
    b.tx = clamp(b.tx, 0, Math.max(0, i.bw));
    b.ty = clamp(b.ty, 0, Math.max(0, i.bh));
    const wp = lerp(50, 24, amount); // position spring (rad/s), damping ratio 0.9
    b.vx += (wp * wp * (b.tx - b.x) - 1.8 * wp * b.vx) * dt;
    b.vy += (wp * wp * (b.ty - b.y) - 1.8 * wp * b.vy) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    keepInside(b, i.bw, i.bh, 0);
    const wa = lerp(10, 40, settle); // angle spring (rad/s), damping ratio 0.4: a short wobble
    const maxTilt = 4 + 20 * amount; // ±14° by default; the 0.85 leaves room for the spring's overshoot
    const tilt = 0.85 * maxTilt * Math.tanh(b.vx / 450);
    b.spin = clamp(b.spin + (wa * wa * (b.home + tilt - b.angle) - 0.8 * wa * b.spin) * dt, -MAX_SPIN, MAX_SPIN);
    b.angle = clamp(b.angle + b.spin * dt, b.home - maxTilt, b.home + maxTilt);
    // Squash & stretch along the direction of travel.
    const speed = Math.hypot(b.vx, b.vy);
    b.stretch = 1 + (0.02 + 0.06 * amount) * Math.tanh(speed / 1200);
    if (speed > 1) b.stretchAngle = Math.atan2(b.vy, b.vx) * DEG;
    b.err = Math.hypot(b.tx - b.x, b.ty - b.y);
    guard(b, x0, y0, a0);
  },
  rest(b) {
    if (b.err > 0.05 || Math.hypot(b.vx, b.vy) > 1 || Math.abs(b.angle - b.home) > 0.05 || Math.abs(b.spin) > 1) return false;
    Object.assign(b, { x: b.tx, y: b.ty, vx: 0, vy: 0, angle: b.home, spin: 0, stretch: 1, err: 0 });
    return true;
  },
};

/**
 * Weighted: a 2D rigid body on a table. While held, a stiff damped spring pulls the grabbed point towards the
 * pointer; its force also produces a torque (r × F) about the centre, so a card dragged by a corner swings
 * until its centre trails behind the motion, while one grabbed at the centre barely turns. Friction damps
 * linear and angular velocity; after release it glides to rest and keeps its final angle.
 */
export const weightedPhysics: DragPhysics = {
  grab(b, px, py) {
    b.held = true;
    const a = b.angle / DEG;
    const [c, s, dx, dy] = [Math.cos(a), Math.sin(a), px - b.x, py - b.y];
    b.gx = c * dx + s * dy;
    b.gy = c * dy - s * dx;
    b.err = 0;
  },
  step(b, dt, i) {
    const { amount, settle } = b.feel;
    const [x0, y0, a0] = [b.x, b.y, b.angle];
    const m = 0.4 + 2.2 * amount; // mass (1.5 by default); the spring stiffness is fixed, so heavier lags more
    const I = (m * (b.w * b.w + b.h * b.h)) / 12 || m; // rectangle's moment of inertia about its centre
    const a = b.angle / DEG;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const [rx, ry] = [c * b.gx - s * b.gy, s * b.gx + c * b.gy]; // grab offset in page space
    let om = b.spin / DEG;
    let [fx, fy] = [0, 0];
    if (b.held) {
      // Spring on the grab point, damped against its velocity relative to the pointer (v + ω × r).
      const [ex, ey] = [i.px - b.x - rx, i.py - b.y - ry];
      const k = 700;
      const d = 2 * 0.8 * Math.sqrt(k * m);
      fx = k * ex + d * (i.pvx - (b.vx - om * ry));
      fy = k * ey + d * (i.pvy - (b.vy + om * rx));
      b.err = Math.hypot(ex, ey);
    }
    b.vx += (fx / m) * dt;
    b.vy += (fy / m) * dt;
    om += ((rx * fy - ry * fx) / I) * dt;
    // Table friction: viscous plus a little constant (Coulomb) drag so it comes to a definite stop.
    const mu = b.held ? 5 : lerp(2.5, 9, settle) * (1.25 - 0.5 * amount); // heavier carries more momentum
    const sp = Math.hypot(b.vx, b.vy);
    const f = sp > 0 ? Math.max(0, 1 - (mu + 40 / sp) * dt) : 0;
    b.vx *= f;
    b.vy *= f;
    om *= Math.abs(om) > 0 ? Math.max(0, 1 - (mu + 0.6 / Math.abs(om)) * dt) : 0;
    b.spin = clamp(om * DEG, -MAX_SPIN, MAX_SPIN);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.spin * dt;
    keepInside(b, i.bw, i.bh, 0.3);
    guard(b, x0, y0, a0);
  },
  rest(b) {
    if (Math.hypot(b.vx, b.vy) > 2 || Math.abs(b.spin) > 0.5 || (b.held && b.err > 0.1)) return false;
    Object.assign(b, { vx: 0, vy: 0, spin: 0 });
    return true;
  },
};

/** Wires a physics model to pointer events and an animation loop (same pointer contract as rigid). */
function attachPhysics(node: HTMLElement, ctx: DragContext, phys: DragPhysics): () => void {
  const { el, win } = ctx;
  let body: DragBody | null = null;
  let press: { id: number; cx: number; cy: number } | null = null;
  let moved = false;
  let frame = 0;
  let last = 0;
  let acc = 0;
  // Latest pointer position (logical) and where it was when the simulation last consumed it.
  let ptr = { x: 0, y: 0 };
  let prev = ptr;
  node.style.touchAction = 'none';
  node.classList.add('ofs-draggable');

  const loop = () => {
    frame = 0;
    if (!body) return;
    const now = win.performance.now();
    acc += clamp((now - last) / 1000, 0, MAX_FRAME);
    last = now;
    const n = Math.floor(acc / PHYSICS_STEP + 1e-9);
    if (n > 0) {
      const { w: bw, h: bh } = ctx.bounds();
      // Spread this frame's pointer motion over the substeps so the springs see a smooth path.
      const [dx, dy, t] = [ptr.x - prev.x, ptr.y - prev.y, n * PHYSICS_STEP];
      for (let k = 1; k <= n; k++) {
        phys.step(body, PHYSICS_STEP, { px: prev.x + (dx * k) / n, py: prev.y + (dy * k) / n, pvx: dx / t, pvy: dy / t, bw, bh });
      }
      acc -= t;
      prev = ptr;
    }
    const done = ptr === prev && phys.rest(body);
    // The only DOM write: once per frame.
    ctx.setPose({ x: body.x - el.w / 2, y: body.y - el.h / 2, angle: body.angle, stretch: body.stretch, stretchAngle: body.stretchAngle });
    if (!done) frame = win.requestAnimationFrame(loop);
    else if (!press) body = null; // fully at rest: the next grab re-reads the session pose
  };
  const wake = () => {
    if (frame) return;
    last = win.performance.now();
    acc = 0;
    frame = win.requestAnimationFrame(loop);
  };

  const down = (e: PointerEvent) => {
    if (e.button !== 0 || press) return;
    const p = ctx.toLocal(e.clientX, e.clientY);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    if (!body) {
      const pos = ctx.position();
      body = createDragBody(pos.x + el.w / 2, pos.y + el.h / 2, el.w, el.h, ctx.angle(), ctx.feel);
    }
    // Grabbing a moving body catches it from its current state.
    phys.grab(body, p.x, p.y);
    ptr = prev = p;
    press = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
    moved = false;
    try {
      node.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const move = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    if (!moved) {
      if (Math.hypot(e.clientX - press.cx, e.clientY - press.cy) < 4) return;
      moved = true;
      node.classList.add('ofs-dragging');
    }
    const p = ctx.toLocal(e.clientX, e.clientY);
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) ptr = p;
    wake();
  };
  const up = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    press = null;
    node.classList.remove('ofs-dragging');
    if (body) {
      body.held = false;
      wake();
    }
  };
  // A drag should not count as a click.
  const click = (e: Event) => {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      moved = false;
    }
  };
  const events = Object.entries({ pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up }) as [
    string,
    EventListener,
  ][];
  for (const [type, fn] of events) node.addEventListener(type, fn);
  node.addEventListener('click', click, true);
  return () => {
    for (const [type, fn] of events) node.removeEventListener(type, fn);
    node.removeEventListener('click', click, true);
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
  };
}

dragRegistry.register({ id: 'floaty', attach: (node, ctx) => attachPhysics(node, ctx, floatyPhysics) });
dragRegistry.register({ id: 'weighted', attach: (node, ctx) => attachPhysics(node, ctx, weightedPhysics) });
