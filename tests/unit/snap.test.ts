import { describe, expect, it } from 'vitest';
import { resizeBox, snapBox, snapResize } from '../../src/editor/canvas/snap';

const page = { w: 1280, h: 720 };

describe('snapBox (moving)', () => {
  it('snaps a box near the page edge', () => {
    const r = snapBox({ x: 4, y: 100, w: 200, h: 100 }, [], page, 7);
    expect(r.dx).toBe(-4);
    expect(r.guides).toEqual([{ axis: 'x', pos: 0 }]);
  });
});

describe('snapResize', () => {
  it('snaps the dragged right/bottom edges to the slide edges', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 };
    const raw = resizeBox(start, 0, 'se', 976, 516, false);
    expect(raw).toEqual({ x: 100, y: 100, w: 1176, h: 616 });
    const r = snapResize(start, raw, 'se', false, [], page, 7);
    expect(r.box).toEqual({ x: 100, y: 100, w: 1180, h: 620 });
    expect(r.guides).toEqual([
      { axis: 'x', pos: 1280 },
      { axis: 'y', pos: 720 },
    ]);
  });

  it('snaps the dragged left/top edges and keeps the opposite edges fixed', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 };
    const raw = resizeBox(start, 0, 'nw', -95, -97, false);
    const r = snapResize(start, raw, 'nw', false, [], page, 7);
    expect(r.box).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('only snaps edges the handle moves', () => {
    const start = { x: 3, y: 100, w: 200, h: 100 };
    const raw = resizeBox(start, 0, 'e', 10, 0, false);
    const r = snapResize(start, raw, 'e', false, [], page, 7);
    // The left edge is 3px from the page edge but is not being dragged.
    expect(r.box).toEqual(raw);
    expect(r.guides).toEqual([]);
  });

  it('snaps to other elements’ edges and centres', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 };
    const other = { x: 500, y: 400, w: 100, h: 100 };
    const raw = resizeBox(start, 0, 's', 0, 247, false);
    const r = snapResize(start, raw, 's', false, [other], page, 7);
    expect(r.box.h).toBe(350); // bottom edge on the other box's centre (y = 450)
    expect(r.guides).toEqual([{ axis: 'y', pos: 450 }]);
  });

  it('keeps the aspect ratio when snapping a corner of a locked-ratio box', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 };
    const raw = resizeBox(start, 0, 'se', 976, 488, true);
    const r = snapResize(start, raw, 'se', true, [], page, 7);
    expect(r.box.x + r.box.w).toBe(1280);
    expect(r.box.w / r.box.h).toBeCloseTo(2, 1);
    expect(r.box.x).toBe(100);
    expect(r.box.y).toBe(100);
  });

  it('does not snap when nothing is within the threshold', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 };
    const raw = resizeBox(start, 0, 'se', 50, 50, false);
    const r = snapResize(start, raw, 'se', false, [], page, 7);
    expect(r.box).toEqual(raw);
    expect(r.guides).toEqual([]);
  });
});
