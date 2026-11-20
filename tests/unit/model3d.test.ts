import { beforeEach, describe, expect, it, vi } from 'vitest';
// Unit tests are typed for the browser (no Node types), but vitest runs them in Node.
// @ts-expect-error -- Node built-in, untyped here
import fs from 'node:fs';
// @ts-expect-error -- Node built-in, untyped here
import path from 'node:path';
import core from 'virtual:ofs-runtime';
import addon from 'virtual:ofs-runtime-3d';
import { inspectGlb, isGlbDataUrl, GLB_MIME } from '../../src/model/glb';
import { buildStandaloneHtml, pruneUnusedAssets, usesModels } from '../../src/io/exportHtml';
import { estimateExport, findAssetIssues } from '../../src/io/exportPlan';
import { importFromText } from '../../src/io/importHtml';
import { fileToAsset, normalizeMime } from '../../src/io/assets';
import { createElement, createProject } from '../../src/model/factory';
import { validateProject } from '../../src/model/validate';
import type { Asset, Project } from '../../src/model/types';
import { mountPlayer, tick } from './helpers';
import { roverModel } from '../../src/examples/v4';
import { editor } from '../../src/editor/store/store';
import { CATALOG } from '../../src/editor/catalog';
import { insertCatalogItem, replaceElementImage } from '../../src/editor/ops';
import { sampleAssets, SAMPLE_IDS } from '../../src/examples/art';

const rover: Uint8Array<ArrayBuffer> = new Uint8Array(fs.readFileSync(path.resolve('src/examples/media/rover.glb')));

/** Builds a minimal GLB with the given JSON (and optional BIN chunk). */
function glb(json: Record<string, unknown>, bin = new Uint8Array(0)): Uint8Array<ArrayBuffer> {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBytes.length + (bin.length ? 8 + bin.length + binPad : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  if (bin.length) {
    const at = 20 + jsonBytes.length;
    dv.setUint32(at, bin.length + binPad, true);
    dv.setUint32(at + 4, 0x004e4942, true);
    out.set(bin, at + 8);
  }
  return out;
}
const tri = { meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 3 }], asset: { version: '2.0' } };
const b64 = (b: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin);
};
const modelAsset = (id = 'as_m', bytes = rover): Asset => ({
  id,
  name: 'model.glb',
  mime: GLB_MIME,
  data: `data:${GLB_MIME};base64,${b64(bytes)}`,
  width: 0,
  height: 0,
  bytes: bytes.length,
  hash: id,
});

function modelProject(): Project {
  const p = createProject('slides');
  p.assets.as_m = modelAsset();
  p.pages[0].elements = [createElement('model', { id: 'el_m', w: 500, h: 400, props: { assetId: 'as_m' } })];
  return p;
}

describe('GLB inspection', () => {
  it('accepts the bundled example model and reports its contents', () => {
    const r = inspectGlb(rover, 'rover.glb');
    if (!r.ok) throw new Error(r.error);
    expect(r.info.meshes).toBeGreaterThan(3);
    expect(r.info.triangles).toBeGreaterThan(10_000);
    expect(r.info.ignoredExtensions).toEqual([]);
  });

  it('rejects files that would not work offline, with an explanation', () => {
    const cases: Array<[Uint8Array, RegExp]> = [
      [new TextEncoder().encode('{"asset":{"version":"2.0"}}'), /text glTF/],
      [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]), /not a binary glTF/],
      [glb({ ...tri, buffers: [{ uri: 'scene.bin', byteLength: 10 }] }), /separate file/],
      [glb({ ...tri, buffers: [{ uri: 'data:application/octet-stream;base64,AAAA', byteLength: 3 }] }), /as text/],
      [glb({ ...tri, images: [{ uri: 'textures/wood.png' }] }), /texture is a separate file/],
      [glb({ ...tri, extensionsRequired: ['KHR_draco_mesh_compression'], extensionsUsed: ['KHR_draco_mesh_compression'] }), /Draco/],
      [glb({ asset: { version: '2.0' } }), /no visible geometry/],
      [glb({ ...tri, buffers: [{ byteLength: 400 }] }, new Uint8Array(8)), /incomplete/],
      [glb({ ...tri, asset: { version: '1.0' } }), /glTF 2\.0/],
    ];
    for (const [bytes, why] of cases) {
      const r = inspectGlb(bytes, 'x.glb');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(why);
    }
    const truncated = rover.slice(0, 5000);
    expect(inspectGlb(truncated).ok).toBe(false);
  });

  it('tolerates optional extensions it can ignore', () => {
    const r = inspectGlb(glb({ ...tri, extensionsUsed: ['VENDOR_fancy'] }));
    expect(r.ok && r.info.ignoredExtensions).toEqual(['VENDOR_fancy']);
  });

  it('imports .glb files as model assets (with a friendly error for broken ones)', async () => {
    expect(normalizeMime('', 'thing.glb')).toBe(GLB_MIME);
    expect(normalizeMime('application/octet-stream', 'thing.GLB')).toBe(GLB_MIME);
    expect(normalizeMime('model/gltf-binary', 'thing.glb')).toBe(GLB_MIME);
    expect(normalizeMime('', 'thing.gltf')).toBeNull();
    const a = await fileToAsset(new File([rover], 'rover.glb'));
    expect(a.mime).toBe(GLB_MIME);
    expect(a.data.startsWith(`data:${GLB_MIME};base64,`)).toBe(true);
    expect(a.bytes).toBe(rover.length);
    expect(isGlbDataUrl(a.data)).toBe(true);
    await expect(fileToAsset(new File([glb({ ...tri, extensionsRequired: ['EXT_meshopt_compression'] })], 'small.glb'))).rejects.toThrow(/meshopt/);
    await expect(fileToAsset(new File(['nope'], 'scene.gltf'))).rejects.toThrow(/binary \.glb/);
  });
});

describe('model assets in projects', () => {
  it('validation keeps GLB assets, checks their header and kind-checks references', () => {
    const p = modelProject();
    p.assets.as_fake = { ...modelAsset('as_fake'), data: `data:${GLB_MIME};base64,${b64(new TextEncoder().encode('not a model at all, sorry'))}` };
    p.assets.as_img = { ...sampleAssets()[SAMPLE_IDS.ocean], id: 'as_img' };
    p.pages[0].elements.push(createElement('model', { id: 'el_m2', props: { assetId: 'as_img' } }));
    p.pages[0].elements.push(createElement('image', { id: 'el_i', props: { assetId: 'as_m' } }));
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    if (!r.ok) throw new Error(r.errors.join());
    expect(Object.keys(r.project.assets).sort()).toEqual(['as_img', 'as_m']);
    expect(r.warnings.some((w) => /not a valid GLB/.test(w))).toBe(true);
    const byId = Object.fromEntries(r.project.pages[0].elements.map((e) => [e.id, e.props as Record<string, unknown>]));
    expect(byId.el_m.assetId).toBe('as_m');
    expect(byId.el_m2.assetId).toBe(''); // an image is not a model
    expect(byId.el_i.assetId).toBe(''); // a model is not an image
  });

  it('sanitises viewer settings', () => {
    const p = modelProject();
    Object.assign(p.pages[0].elements[0].props, { lighting: 'disco', backdrop: 'neon', rotateSpeed: 99, pitch: 400, zoom: -3, background: 'url(x)' });
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    if (!r.ok) throw new Error();
    const m = r.project.pages[0].elements[0].props as Record<string, unknown>;
    expect(m).toMatchObject({ lighting: 'studio', backdrop: 'gradient', rotateSpeed: 3, pitch: 85, zoom: 0.4 });
    expect(m.background).toBe('#f3f1fa');
  });

  it('exports embed the 3D add-on only when a model is shown, and re-import intact', () => {
    const runtime = { core, model3d: addon };
    expect(addon.length).toBeGreaterThan(200_000);
    expect(addon).not.toMatch(/<\/script/i);
    const plain = createProject('slides');
    plain.pages[0].elements = [createElement('model', { id: 'el_empty' })]; // a model element without a file
    expect(usesModels(plain)).toBe(false);
    const plainHtml = buildStandaloneHtml(plain, runtime);
    expect(plainHtml).not.toContain('__ofsModel3d=');
    expect(plainHtml.length).toBeLessThan(core.length + 20_000);

    const p = pruneUnusedAssets(modelProject());
    expect(usesModels(p)).toBe(true);
    const html = buildStandaloneHtml(p, runtime);
    expect(html).toContain(addon.slice(0, 200));
    expect(html.indexOf(addon.slice(0, 200))).toBeLessThan(html.indexOf(core.slice(0, 200))); // add-on first
    expect(html).toContain(b64(rover).slice(0, 1000));
    expect(Math.abs(estimateExport(p, runtime).chars - html.length)).toBeLessThan(100); // estimate includes the add-on
    const { project, warnings } = importFromText(html, 'm.html');
    expect(warnings).toEqual([]);
    expect(project.assets.as_m.data).toBe(p.assets.as_m.data);
    expect(project.pages[0].elements[0].type).toBe('model');
    expect(findAssetIssues(plain).empty[0]?.message).toMatch(/3D model/);
  });
});

describe('model element rendering', () => {
  beforeEach(() => {
    delete window.__ofsModel3d;
    delete window.__ofsModel3dLoad;
  });

  it('shows a friendly placeholder without a file, and a clear message when the viewer is missing', async () => {
    const p = createProject('slides');
    p.pages[0].elements = [createElement('model', { id: 'el_m' })];
    const a = mountPlayer(p);
    expect(a.q('el_m')!.textContent).toContain('3D model');
    const b = mountPlayer(modelProject());
    await tick();
    expect(b.q('el_m')!.textContent).toMatch(/viewer is missing/);
  });

  it('creates an interactive viewer, wires actions, and destroys it with the player', async () => {
    const handle = { view: vi.fn(), spin: vi.fn(), zoomBy: vi.fn(), destroy: vi.fn() };
    const create = vi.fn((_c: HTMLElement, o: { onStatus(s: string): void }) => {
      queueMicrotask(() => o.onStatus('ready'));
      return handle;
    });
    window.__ofsModel3d = { create, poster: vi.fn() } as never;
    const p = modelProject();
    p.pages[0].elements.push(
      createElement('button', {
        id: 'el_b',
        interactions: [
          {
            id: 'ix',
            trigger: 'click',
            conditions: [],
            actions: [
              { id: 'a1', type: 'modelView', params: { target: 'el_m', view: 'top' } },
              { id: 'a2', type: 'modelSpin', params: { target: 'el_m', mode: 'stop' } },
            ],
          },
        ],
      }),
    );
    const { q, player } = mountPlayer(p);
    await tick();
    expect(create).toHaveBeenCalledTimes(1);
    const opts = create.mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(opts).toMatchObject({ allowRotate: true, allowZoom: true, wheelNeedsFocus: false, lighting: 'studio' });
    expect(String(opts.data).startsWith(`data:${GLB_MIME}`)).toBe(true);
    q('el_b')!.querySelector('button')!.click();
    await tick();
    expect(handle.view).toHaveBeenCalledWith('top');
    expect(handle.spin).toHaveBeenCalledWith(false);
    q('el_m')!.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
    expect(handle.zoomBy).toHaveBeenCalledWith(1.25);
    // Orbiting must not reach the element (drag modes, click triggers).
    const down = new MouseEvent('pointerdown', { bubbles: true });
    const spy = vi.fn();
    q('el_m')!.addEventListener('pointerdown', spy);
    q('el_m')!.querySelector('.ofs-model-stage')!.dispatchEvent(down);
    expect(spy).not.toHaveBeenCalled();
    player.destroy();
    expect(handle.destroy).toHaveBeenCalled();
  });

  it('the editor canvas uses posters from the shared renderer, never live viewers', async () => {
    const create = vi.fn();
    const poster = vi.fn(() => Promise.resolve('data:image/png;base64,iVBORw0KGgo='));
    window.__ofsModel3d = { create, poster } as never;
    const { renderContent } = await import('../../src/runtime/mount');
    const { createStaticEnv } = await import('../../src/runtime/env');
    const p = modelProject();
    const c = renderContent(p.pages[0].elements[0], createStaticEnv(p, 'edit'), document);
    await tick();
    await tick();
    expect(create).not.toHaveBeenCalled();
    expect(poster).toHaveBeenCalledWith(expect.objectContaining({ width: 500, height: 400, yaw: 30 }));
    expect(c.node.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/png/);
    expect(c.node.textContent).toContain('3D');
  });

  it('the example rover asset is a valid embedded model', () => {
    const a = roverModel();
    expect(a.mime).toBe(GLB_MIME);
    expect(isGlbDataUrl(a.data)).toBe(true);
    expect(a.bytes).toBe(rover.length);
  });
});

describe('Insert → Image (placeholder first)', () => {
  beforeEach(() => editor().openProject(createProject('slides')));
  const els = () => editor().project!.pages[0].elements;

  it('creates a selected placeholder without opening a file picker', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    insertCatalogItem(CATALOG.find((c) => c.id === 'image')!);
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
    expect(els()).toHaveLength(1);
    expect(els()[0].type).toBe('image');
    expect((els()[0].props as { assetId: string }).assetId).toBe('');
    expect(editor().selection).toEqual([els()[0].id]);
    // The placeholder is a valid project.
    expect(validateProject(JSON.parse(JSON.stringify(editor().project))).ok).toBe(true);
    editor().undo();
    expect(els()).toHaveLength(0);
  });

  it('choosing a picture fits the placeholder; replacing keeps size, style and interactions', () => {
    insertCatalogItem(CATALOG.find((c) => c.id === 'image')!);
    const id = els()[0].id;
    const before = { ...els()[0] };
    const wide: Asset = { ...sampleAssets()[SAMPLE_IDS.ocean], id: 'as_wide', width: 1600, height: 800 };
    const tall: Asset = { ...wide, id: 'as_tall', width: 600, height: 900, data: wide.data + '' };
    editor().update((d) => {
      d.assets.as_wide = wide;
      d.assets.as_tall = tall;
      const el = d.pages[0].elements[0];
      el.interactions = [{ id: 'ix', trigger: 'click', conditions: [], actions: [] }];
      (el.props as Record<string, unknown>).radius = 30;
    });
    replaceElementImage(id, wide);
    let el = els()[0];
    expect(el.w).toBe(before.w);
    expect(el.h).toBe(Math.round(before.w / 2)); // took the picture's shape
    expect(Math.round(el.y + el.h / 2)).toBe(Math.round(before.y + before.h / 2)); // same centre
    const sized = { x: el.x, y: el.y, w: el.w, h: el.h };
    (el.props as { edit: unknown }).edit = { crop: { x: 0, y: 0, w: 0.5, h: 0.5 } };
    replaceElementImage(id, tall);
    el = els()[0];
    expect({ x: el.x, y: el.y, w: el.w, h: el.h }).toEqual(sized); // replacing keeps the box
    expect((el.props as { assetId: string; radius: number; edit: unknown }).assetId).toBe('as_tall');
    expect((el.props as { radius: number }).radius).toBe(30);
    expect((el.props as { edit: unknown }).edit).toBeNull();
    expect(el.interactions).toHaveLength(1);
    editor().undo();
    expect((els()[0].props as { assetId: string }).assetId).toBe('as_wide');
  });
});
