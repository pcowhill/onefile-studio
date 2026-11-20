import { describe, expect, it, vi } from 'vitest';
// Unit tests are typed for the browser (no Node types), but vitest runs them in Node.
// @ts-expect-error -- Node built-in, untyped here
import fs from 'node:fs';
// @ts-expect-error -- Node built-in, untyped here
import path from 'node:path';
import { zoomedDistance } from '../../src/runtime/model3d/contract';
import { createElement, createProject } from '../../src/model/factory';
import { mountPlayer, tick } from './helpers';
import { puff } from '../../src/examples/art';
import { GLB_MIME } from '../../src/model/glb';

describe('v0.5 fix: 3D zoom buttons', () => {
  it('a factor above 1 moves the camera closer (zoom in), below 1 farther (zoom out)', () => {
    expect(zoomedDistance(10, 1.25, 1, 50)).toBeLessThan(10);
    expect(zoomedDistance(10, 0.8, 1, 50)).toBeGreaterThan(10);
    expect(zoomedDistance(10, 1.25, 1, 50)).toBeCloseTo(8);
    expect(zoomedDistance(10, 0.8, 1, 50)).toBeCloseTo(12.5);
  });

  it('respects the distance limits and ignores nonsense factors', () => {
    expect(zoomedDistance(1.1, 4, 1, 50)).toBe(1);
    expect(zoomedDistance(49, 0.1, 1, 50)).toBe(50);
    expect(zoomedDistance(10, 0, 1, 50)).toBe(10);
    expect(zoomedDistance(10, Number.NaN, 1, 50)).toBe(10);
  });

  it('“Zoom in” asks the viewer to zoom in and “Zoom out” to zoom out', async () => {
    const handle = { view: vi.fn(), spin: vi.fn(), zoomBy: vi.fn(), destroy: vi.fn() };
    window.__ofsModel3d = {
      create: (_c: HTMLElement, o: { onStatus(s: string): void }) => {
        queueMicrotask(() => o.onStatus('ready'));
        return handle;
      },
      poster: vi.fn(),
    } as never;
    const p = createProject('slides');
    p.assets.as_m = { id: 'as_m', name: 'm.glb', mime: GLB_MIME, data: `data:${GLB_MIME};base64,Z2xURg==`, width: 0, height: 0, bytes: 4, hash: 'h' };
    p.pages[0].elements = [createElement('model', { id: 'el_m', props: { assetId: 'as_m', controls: true } })];
    const { q, player } = mountPlayer(p);
    await tick();
    q('el_m')!.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
    q('el_m')!.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.click();
    const [zin, zout] = handle.zoomBy.mock.calls.map((c) => c[0] as number);
    expect(zoomedDistance(10, zin, 0, 100)).toBeLessThan(10);
    expect(zoomedDistance(10, zout, 0, 100)).toBeGreaterThan(10);
    player.destroy();
    delete (window as { __ofsModel3d?: unknown }).__ofsModel3d;
  });

  it('the viewer implements zoomBy through zoomedDistance, not three.js dollyIn/dollyOut', () => {
    const src = fs.readFileSync(path.resolve('src/runtime/model3d/viewer.ts'), 'utf8');
    const body = src.slice(src.indexOf('zoomBy(factor)'), src.indexOf('destroy()', src.indexOf('zoomBy(factor)')));
    expect(body).toContain('zoomedDistance(');
    expect(body).not.toMatch(/dolly(In|Out)\(/);
  });
});

describe('v0.5 fix: Puff artwork', () => {
  it('has no stray open yellow stroke outside the ring', () => {
    const svg = puff();
    // The ring is one closed ellipse; nothing else is drawn in the ring colour.
    const yellow = svg.match(/<[^>]*#ffd23f[^>]*>/g) ?? [];
    expect(yellow).toHaveLength(1);
    expect(yellow[0]).toMatch(/^<ellipse /);
    expect(svg).not.toContain('M85 270');
  });

  it('keeps the rest of Puff (body, face, cheeks, ring)', () => {
    const svg = puff();
    expect(svg).toContain('<circle cx="300" cy="300" r="200" fill="url(#g)"/>');
    expect(svg).toContain('rx="285" ry="70"');
    expect(svg).toContain('M262 362 q38 34 76 0');
    expect((svg.match(/<ellipse /g) ?? []).length).toBe(6);
  });
});

describe('v0.5 fix: first slide thumbnail outline', () => {
  it('the thumbnail list leaves room for the selection ring and drop marker inside its scroll box', () => {
    const css = fs.readFileSync(path.resolve('src/styles/editor.css'), 'utf8');
    const rule = css.slice(css.indexOf('.ed-pages {'), css.indexOf('}', css.indexOf('.ed-pages {')));
    const padTop = Number(/padding:\s*(\d+)px/.exec(rule)![1]);
    const ring = Number(/\.ed-page-item\.is-on \.ed-page-btn \{\s*box-shadow:\s*0 0 0 (\d+)px/.exec(css)![1]);
    const marker = Number(/\.ed-page-item\.is-drop-before::before \{\s*top: -(\d+)px/.exec(css)![1]);
    expect(padTop).toBeGreaterThanOrEqual(ring);
    expect(padTop).toBeGreaterThanOrEqual(marker);
  });
});
