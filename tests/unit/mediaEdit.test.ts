import { describe, expect, it } from 'vitest';
import type { MediaEdit } from '../../src/model/mediaEdit';
import {
  describeEdit,
  editedAspect,
  editedSize,
  flipEdit,
  isIdentity,
  orientationMatrix,
  resolveEdit,
  rotateEdit,
  sanitizeEdit,
  trimBounds,
} from '../../src/model/mediaEdit';
import { createElement, createProject } from '../../src/model/factory';
import type { Asset, Project } from '../../src/model/types';
import { SCHEMA_VERSION } from '../../src/model/types';
import { validateProject } from '../../src/model/validate';
import { buildStandaloneHtml } from '../../src/io/exportHtml';
import { importFromText } from '../../src/io/importHtml';
import { editRetention } from '../../src/io/exportPlan';

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const img = (extra: Partial<Asset> = {}): Asset => ({
  id: 'as_img',
  name: 'shot.png',
  mime: 'image/png',
  data: PNG_1x1,
  width: 400,
  height: 200,
  bytes: 70,
  hash: 'h',
  ...extra,
});
const vid = (extra: Partial<Asset> = {}): Asset => ({
  id: 'as_vid',
  name: 'rec.webm',
  mime: 'video/webm',
  data: 'data:video/webm;base64,GkXfo0',
  width: 1280,
  height: 720,
  bytes: 4,
  hash: 'v',
  duration: 30,
  ...extra,
});
const snd = (extra: Partial<Asset> = {}): Asset => ({
  id: 'as_snd',
  name: 'voice.webm',
  mime: 'audio/webm',
  data: 'data:audio/webm;base64,GkXfo0',
  width: 0,
  height: 0,
  bytes: 4,
  hash: 's',
  duration: 12,
  ...extra,
});

/** Applies an SVG matrix to a point. */
const apply = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

describe('media edit model', () => {
  it('sanitises per kind: images crop/rotate/flip, videos crop/trim, sounds trim only', () => {
    const raw = { crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, rotate: 450, flipH: true, flipV: 'yes', trim: { start: 2, end: 8 } };
    expect(sanitizeEdit(raw, 'image')).toEqual({ crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, rotate: 90, flipH: true });
    expect(sanitizeEdit(raw, 'video', 30)).toEqual({ crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, trim: { start: 2, end: 8 } });
    expect(sanitizeEdit(raw, 'audio', 30)).toEqual({ trim: { start: 2, end: 8 } });
  });

  it('clamps invalid crops and trims instead of failing', () => {
    expect(sanitizeEdit({ crop: { x: 0.9, y: -1, w: 0.5, h: 0.001 } }, 'image').crop).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.02 });
    expect(sanitizeEdit({ crop: { x: 0, y: 0, w: 1, h: 1 } }, 'image')).toEqual({});
    expect(sanitizeEdit({ crop: { x: 'a', y: 0, w: 1, h: 1 } }, 'image')).toEqual({});
    // End before start: the shortest valid segment.
    expect(sanitizeEdit({ trim: { start: 5, end: 2 } }, 'audio', 12).trim).toEqual({ start: 5, end: 5.1 });
    // Beyond the file: clamped to its duration.
    expect(sanitizeEdit({ trim: { start: 1, end: 99 } }, 'audio', 12).trim).toEqual({ start: 1, end: 12 });
    // The whole file is no trim at all.
    expect(sanitizeEdit({ trim: { start: 0, end: 12 } }, 'audio', 12)).toEqual({});
    expect(sanitizeEdit('nope', 'image')).toEqual({});
  });

  it('maps the original picture onto the rotated/flipped one (corners land on corners)', () => {
    const W = 400;
    const H = 200;
    const cases: Array<[MediaEdit, [number, number]]> = [
      [{}, [0, 0]],
      [{ rotate: 90 }, [200, 0]],
      [{ rotate: 180 }, [400, 200]],
      [{ rotate: 270 }, [0, 400]],
      [{ flipH: true }, [400, 0]],
      [{ flipV: true }, [0, 200]],
      [{ rotate: 90, flipH: true }, [0, 0]],
    ];
    for (const [edit, origin] of cases) {
      const m = orientationMatrix(W, H, edit);
      expect(apply(m, 0, 0)).toEqual(origin);
      // Every corner of the original stays inside the displayed picture.
      const o = edit.rotate === 90 || edit.rotate === 270 ? [H, W] : [W, H];
      for (const [x, y] of [
        [W, 0],
        [W, H],
        [0, H],
      ]) {
        const [px, py] = apply(m, x, y);
        expect(px).toBeGreaterThanOrEqual(0);
        expect(py).toBeGreaterThanOrEqual(0);
        expect(px).toBeLessThanOrEqual(o[0]);
        expect(py).toBeLessThanOrEqual(o[1]);
      }
    }
  });

  it('rotation and flips carry the crop along with the picture', () => {
    const crop = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    const r = rotateEdit({ crop }, 1);
    expect(r.rotate).toBe(90);
    expect(r.crop).toEqual({ x: 0.4, y: 0.1, w: 0.4, h: 0.3 });
    // Four quarter turns are the identity, crop included.
    let e: MediaEdit = { crop };
    for (let i = 0; i < 4; i++) e = rotateEdit(e, 1);
    expect(e.rotate).toBeUndefined();
    expect(e.crop!.x).toBeCloseTo(crop.x);
    expect(e.crop!.y).toBeCloseTo(crop.y);
    expect(rotateEdit(rotateEdit({ crop }, 1), -1).crop).toEqual(crop);
    const f = flipEdit({ crop }, 'h');
    expect(f).toEqual({ crop: { x: 0.6, y: 0.2, w: 0.3, h: 0.4 }, flipH: true });
    expect(flipEdit(f, 'h')).toEqual({ crop });
    expect(flipEdit({ crop }, 'v').crop).toEqual({ x: 0.1, y: 0.4, w: 0.3, h: 0.4 });
  });

  it('rotating a mirrored picture turns it the way the author sees it', () => {
    // A point at the top-left of what is displayed must move to the top-right after a clockwise turn.
    const W = 400;
    const H = 200;
    const before: MediaEdit = { flipH: true };
    const after = rotateEdit(before, 1);
    // Find the source point shown at the displayed top-left before…
    const mb = orientationMatrix(W, H, before);
    const src = [0, 0, W, H, W, 0, 0, H]
      .reduce<number[][]>((acc, _, i, arr) => (i % 2 ? acc : [...acc, [arr[i], arr[i + 1]]]), [])
      .find(([x, y]) => {
        const [px, py] = apply(mb, x, y);
        return px === 0 && py === 0;
      })!;
    // …after a clockwise turn it is at the displayed top-right (x = new width).
    const [ax, ay] = apply(orientationMatrix(W, H, after), src[0], src[1]);
    expect([ax, ay]).toEqual([H, 0]);
  });

  it('computes edited sizes and trim bounds', () => {
    expect(editedSize(400, 200, { rotate: 90, crop: { x: 0, y: 0, w: 0.5, h: 0.5 } })).toEqual({ width: 100, height: 200 });
    expect(editedAspect(1280, 720, { crop: { x: 0, y: 0, w: 0.5, h: 1 } })).toBeCloseTo(640 / 720);
    expect(trimBounds({}, 30)).toEqual({ start: 0, end: 30 });
    expect(trimBounds({ trim: { start: 4, end: 40 } }, 30)).toEqual({ start: 4, end: 30 });
    expect(describeEdit({ trim: { start: 1, end: 5 }, crop: { x: 0, y: 0, w: 0.5, h: 0.5 } }, (s) => `${s}s`)).toBe('Trimmed to 4s · cropped');
    expect(isIdentity({})).toBe(true);
    expect(isIdentity(null)).toBe(true);
    expect(isIdentity({ flipV: true })).toBe(false);
  });

  it('an element override wins over the library version; {} means "the original"', () => {
    const p = createProject('slides');
    p.assets.as_img = img({ edit: { rotate: 180 } });
    expect(resolveEdit(p, 'as_img', null)).toEqual({ rotate: 180 });
    expect(resolveEdit(p, 'as_img', undefined)).toEqual({ rotate: 180 });
    expect(resolveEdit(p, 'as_img', { flipH: true })).toEqual({ flipH: true });
    expect(resolveEdit(p, 'as_img', {})).toEqual({});
    expect(resolveEdit(p, 'missing', {})).toEqual({});
  });
});

function editedProject(): Project {
  const p = createProject('slides');
  p.assets.as_img = img({ edit: { crop: { x: 0.25, y: 0, w: 0.5, h: 1 }, rotate: 90 } });
  p.assets.as_vid = vid({ edit: { trim: { start: 5, end: 15 } } });
  p.assets.as_snd = snd();
  p.pages[0].elements = [
    createElement('image', { id: 'el_a', props: { assetId: 'as_img' } }),
    // The same picture again, with its own (different) crop: no second copy of the bytes.
    createElement('image', { id: 'el_b', props: { assetId: 'as_img', edit: { crop: { x: 0, y: 0, w: 0.3, h: 0.3 } } } }),
    // And once as the original.
    createElement('image', { id: 'el_c', props: { assetId: 'as_img', edit: {} } }),
    createElement('video', { id: 'el_v1', props: { assetId: 'as_vid' } }),
    createElement('video', { id: 'el_v2', props: { assetId: 'as_vid', edit: { trim: { start: 20, end: 25 }, crop: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } } } }),
    createElement('audio', { id: 'el_s', props: { assetId: 'as_snd', edit: { trim: { start: 1.5, end: 9 } } } }),
  ];
  return p;
}

describe('schema v3: media edits survive validation, export and import', () => {
  it('validates edits (library and per element) without changing them', () => {
    const r = validateProject(JSON.parse(JSON.stringify(editedProject())));
    if (!r.ok) throw new Error(r.errors.join());
    const p = r.project;
    expect(p.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
    expect(p.assets.as_img.edit).toEqual({ crop: { x: 0.25, y: 0, w: 0.5, h: 1 }, rotate: 90 });
    expect(p.assets.as_vid.edit).toEqual({ trim: { start: 5, end: 15 } });
    expect(p.assets.as_snd.edit).toBeUndefined();
    const props = (id: string) => p.pages[0].elements.find((e) => e.id === id)!.props as Record<string, unknown>;
    expect(props('el_a').edit).toBeNull();
    expect(props('el_b').edit).toEqual({ crop: { x: 0, y: 0, w: 0.3, h: 0.3 } });
    expect(props('el_c').edit).toEqual({});
    expect(props('el_v2').edit).toEqual({ trim: { start: 20, end: 25 }, crop: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } });
    expect(props('el_s').edit).toEqual({ trim: { start: 1.5, end: 9 } });
  });

  it('drops edits a kind of media cannot have, and malformed ones', () => {
    const raw = JSON.parse(JSON.stringify(editedProject()));
    raw.assets.as_snd.edit = { crop: { x: 0, y: 0, w: 0.5, h: 0.5 }, rotate: 90 };
    raw.assets.as_img.edit = 'garbage';
    raw.pages[0].elements[5].props.edit = [1, 2];
    const r = validateProject(raw);
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.project.assets.as_snd.edit).toBeUndefined();
    expect(r.project.assets.as_img.edit).toBeUndefined();
    expect(r.project.pages[0].elements[5].props.edit).toBeNull();
  });

  it('migrates v2 files (no edits) to the current version with every element following the library', () => {
    const raw = JSON.parse(JSON.stringify(editedProject()));
    raw.version = 2;
    for (const a of Object.values(raw.assets) as Array<Record<string, unknown>>) delete a.edit;
    for (const el of raw.pages[0].elements) delete el.props.edit;
    const r = validateProject(raw);
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.project.version).toBe(SCHEMA_VERSION);
    for (const el of r.project.pages[0].elements) expect(el.props.edit).toBeNull();
    expect(Object.values(r.project.assets).every((a) => !a.edit)).toBe(true);
  });

  it('round-trips through a standalone HTML export with every edit intact and bytes stored once', () => {
    const p = editedProject();
    const html = buildStandaloneHtml(p, '/* runtime */');
    // One copy of the picture's bytes, although it is shown three ways.
    expect(html.split(PNG_1x1.slice(30, 60)).length - 1).toBe(1);
    const back = importFromText(html).project;
    const direct = validateProject(JSON.parse(JSON.stringify(p))) as { project: Project };
    expect(back.assets).toEqual(direct.project.assets);
    expect(back.pages[0].elements.map((e) => e.props.edit)).toEqual([
      null,
      { crop: { x: 0, y: 0, w: 0.3, h: 0.3 } },
      {},
      null,
      { trim: { start: 20, end: 25 }, crop: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
      { trim: { start: 1.5, end: 9 } },
    ]);
  });

  it('reports honestly that trimmed media keep their whole original in the export', () => {
    const p = editedProject();
    const r = editRetention(p);
    expect(r.edited).toBe(3);
    // The video is used 5–15 s and 20–25 s of 30 s: the span 5–25 is kept in use; a third lies outside.
    expect(r.outsideTrimBytes).toBeGreaterThan(0);
    const untrimmed = createProject('slides');
    untrimmed.assets.as_snd = snd();
    untrimmed.pages[0].elements = [createElement('audio', { props: { assetId: 'as_snd' } })];
    expect(editRetention(untrimmed)).toEqual({ edited: 0, outsideTrimBytes: 0 });
  });
});
