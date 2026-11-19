import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Unit tests are typed for the browser (no Node types), but vitest runs them in Node.
// @ts-expect-error -- Node built-in, untyped here
import fs from 'node:fs';
// @ts-expect-error -- Node built-in, untyped here
import path from 'node:path';
import { mountPlayer, tick } from './helpers';
import { createElement, createProject, createVariable } from '../../src/model/factory';
import type { Asset, Project, SceneElement } from '../../src/model/types';
import { SCHEMA_ID } from '../../src/model/types';
import { validateProject } from '../../src/model/validate';
import {
  acceptAttribute,
  contentHash,
  countGifFrames,
  dataUrlBytes,
  fileToAsset,
  hashString,
  isAnimatedImage,
  isOptimizable,
  normalizeMime,
  optimizeAssets,
  parseWavDuration,
} from '../../src/io/assets';
import { buildStandaloneHtml, byteSize, pruneUnusedAssets } from '../../src/io/exportHtml';
import { importFromText } from '../../src/io/importHtml';
import { assetBreakdown, estimateExport, findAssetIssues } from '../../src/io/exportPlan';
import { joinDraft, referencedKeys, splitDraft } from '../../src/io/storage';
import type { DraftRecordV2 } from '../../src/io/storage';
import { renderContent } from '../../src/runtime/mount';
import { createStaticEnv } from '../../src/runtime/env';
import { themeNewElement, THEME_IDS } from '../../src/model/theme';
import { formatTime } from '../../src/runtime/elements/mediaShared';

const FIX = path.resolve('tests/fixtures/media');
const bytes = (name: string): Uint8Array<ArrayBuffer> & { toString(enc: 'base64'): string } => fs.readFileSync(path.join(FIX, name));
const dataUrl = (name: string, mime: string) => `data:${mime};base64,${bytes(name).toString('base64')}`;
const fileOf = (name: string, type = '') => new File([bytes(name)], name, { type });

function media(id: string, name: string, mime: string, extra: Partial<Asset> = {}): Asset {
  const data = dataUrl(name, mime);
  return { id, name, mime, data, width: 0, height: 0, bytes: dataUrlBytes(data), hash: id, ...extra };
}

function projectWith(elements: SceneElement[], assets: Asset[]): Project {
  const p = createProject('slides');
  p.pages[0].elements = elements;
  for (const a of assets) p.assets[a.id] = a;
  return p;
}

const WEBM = () => media('as_v', 'clip.webm', 'video/webm', { width: 320, height: 180, duration: 3 });
const MP3 = () => media('as_a', 'tone.mp3', 'audio/mpeg', { duration: 2.04 });
const GIF = () => media('as_g', 'spinner.gif', 'image/gif', { width: 64, height: 64, animated: true });
const STILL = () => media('as_s', 'still.gif', 'image/gif', { width: 48, height: 32 });

/** jsdom has no media pipeline: stub what the runtime calls. */
let play: ReturnType<typeof vi.fn>;
beforeEach(() => {
  play = vi.fn(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play as unknown as () => Promise<void>);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('asset pipeline', () => {
  it('normalises MIME types, falling back to the file extension', () => {
    expect(normalizeMime('audio/x-wav', 'a.wav')).toBe('audio/wav');
    expect(normalizeMime('audio/wave')).toBe('audio/wav');
    expect(normalizeMime('audio/mp3', 'a.mp3')).toBe('audio/mpeg');
    expect(normalizeMime('audio/x-m4a', 'a.m4a')).toBe('audio/mp4');
    expect(normalizeMime('image/jpg')).toBe('image/jpeg');
    expect(normalizeMime('', 'Clip.MP4')).toBe('video/mp4');
    expect(normalizeMime('', 'song.m4a')).toBe('audio/mp4');
    expect(normalizeMime('application/octet-stream', 'tone.mp3')).toBe('audio/mpeg');
    expect(normalizeMime('', 'intro.webm')).toBe('video/webm');
    expect(normalizeMime('application/ogg', 'x.ogg')).toBe('audio/ogg');
    expect(normalizeMime('video/quicktime', 'movie.mov')).toBeNull();
    expect(normalizeMime('', 'notes.txt')).toBeNull();
    expect(normalizeMime('text/html', 'evil.mp4')).toBeNull();
    // Everything we produce is accepted by the import validator.
    for (const mime of ['video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'image/gif']) {
      const r = validateProject({ ...createProject('slides'), assets: { a: { data: `data:${mime};base64,AAAA` } } });
      expect(r.ok && Object.keys(r.project.assets)).toEqual(['a']);
    }
    expect(acceptAttribute(['video'])).toContain('.webm');
    expect(acceptAttribute(['image'])).not.toContain('video');
  });

  it('detects animated GIFs (and APNG / animated WebP headers)', () => {
    expect(countGifFrames(bytes('spinner.gif'))).toBe(4);
    expect(isAnimatedImage('image/gif', bytes('spinner.gif'))).toBe(true);
    expect(countGifFrames(bytes('still.gif'))).toBe(1);
    expect(isAnimatedImage('image/gif', bytes('still.gif'))).toBe(false);
    expect(isAnimatedImage('image/gif', new Uint8Array([1, 2, 3]))).toBe(false);
    const png = (chunk: string) => {
      const b = new Uint8Array(8 + 12 + 13 + 12 + 8);
      b.set([137, 80, 78, 71, 13, 10, 26, 10]);
      const dv = new DataView(b.buffer);
      dv.setUint32(8, 13);
      b.set(
        [...'IHDR'].map((c) => c.charCodeAt(0)),
        12,
      );
      dv.setUint32(33, 8);
      b.set(
        [...chunk].map((c) => c.charCodeAt(0)),
        37,
      );
      return b;
    };
    expect(isAnimatedImage('image/png', png('acTL'))).toBe(true);
    expect(isAnimatedImage('image/png', png('IDAT'))).toBe(false);
    const webp = new Uint8Array(30);
    webp.set(
      [...'RIFF'].map((c) => c.charCodeAt(0)),
      0,
    );
    webp.set(
      [...'WEBPVP8X'].map((c) => c.charCodeAt(0)),
      8,
    );
    webp[20] = 0x02;
    expect(isAnimatedImage('image/webp', webp)).toBe(true);
    webp[20] = 0;
    expect(isAnimatedImage('image/webp', webp)).toBe(false);
  });

  it('turns video, sound and GIF files into measured assets without a media decoder', async () => {
    // jsdom never loads media or images: dimensions come from container headers.
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 64;
        naturalHeight = 64;
        onload: (() => void) | null = null;
        set src(_v: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      },
    );
    const mp4 = await fileToAsset(fileOf('clip.mp4'), { measureTimeoutMs: 20 });
    expect(mp4).toMatchObject({ mime: 'video/mp4', width: 320, height: 180, name: 'clip.mp4' });
    expect(mp4.duration).toBeCloseTo(2, 1);
    expect(mp4.data).toBe(dataUrl('clip.mp4', 'video/mp4'));
    expect(mp4.bytes).toBe(bytes('clip.mp4').length);
    expect(mp4.hash).toBe(await hashString(mp4.data));

    const wav = await fileToAsset(fileOf('tone.wav', 'audio/x-wav'), { measureTimeoutMs: 20 });
    expect(wav).toMatchObject({ mime: 'audio/wav', width: 0, height: 0 });
    expect(wav.duration).toBeCloseTo(1, 2);
    expect(wav.data.startsWith('data:audio/wav;base64,')).toBe(true);

    const mp3 = await fileToAsset(fileOf('tone.mp3', 'audio/mp3'), { measureTimeoutMs: 20 });
    expect(mp3.mime).toBe('audio/mpeg');

    const gif = await fileToAsset(fileOf('spinner.gif', 'image/gif'));
    expect(gif.animated).toBe(true);
    expect(gif.data).toBe(dataUrl('spinner.gif', 'image/gif'));
    const still = await fileToAsset(fileOf('still.gif'));
    expect(still.animated).toBeUndefined();
    expect(parseWavDuration(bytes('tone.wav'))).toBeCloseTo(1, 3);
    vi.unstubAllGlobals();
  });

  it('rejects unsupported and oversized files with friendly messages', async () => {
    await expect(fileToAsset(new File(['x'], 'holiday.mov', { type: 'video/quicktime' }))).rejects.toThrow(/convert it to MP4/);
    await expect(fileToAsset(new File(['x'], 'scan.tiff', { type: 'image/tiff' }))).rejects.toThrow(/PNG or JPEG/);
    const big = new File(['x'], 'film.mp4', { type: 'video/mp4' });
    Object.defineProperty(big, 'size', { value: 400 * 1024 * 1024 });
    await expect(fileToAsset(big)).rejects.toThrow(/400 MB, more than the 150 MB/);
    await expect(fileToAsset(new File([], 'empty.mp3', { type: 'audio/mpeg' }))).rejects.toThrow(/empty/);
  });

  it('optimisation never touches GIFs, animated images, video or audio', async () => {
    const p = projectWith([], [WEBM(), MP3(), GIF(), STILL(), media('as_w', 'tone.wav', 'audio/wav')]);
    const out = await optimizeAssets(p);
    for (const id of Object.keys(p.assets)) expect(out.assets[id]).toBe(p.assets[id]);
    expect(isOptimizable(GIF())).toBe(false);
    expect(isOptimizable(STILL())).toBe(false);
    expect(isOptimizable(WEBM())).toBe(false);
    expect(isOptimizable({ ...GIF(), mime: 'image/png', animated: true })).toBe(false);
    expect(isOptimizable({ ...STILL(), mime: 'image/png', data: 'data:image/png;base64,iVBORw0KGgo=' })).toBe(true);
  });

  it('caches content hashes per asset while the data is unchanged', async () => {
    const a = MP3();
    const h1 = await contentHash(a);
    expect(h1).toBe(await hashString(a.data));
    expect(await contentHash({ ...a })).toBe(h1);
    expect(await contentHash({ ...a, data: STILL().data })).toBe(await hashString(STILL().data));
  });
});

describe('validation of media', () => {
  const raw = (assets: Record<string, unknown>, props: Record<string, unknown>, type = 'video') => ({
    schema: SCHEMA_ID,
    version: 2,
    kind: 'slides',
    pages: [{ id: 'pg1', name: 'P', background: {}, elements: [{ id: 'el1', type, x: 0, y: 0, w: 100, h: 100, props }] }],
    assets,
  });

  it('accepts video, audio and GIF assets with their metadata', () => {
    const r = validateProject(
      raw({ as_v: WEBM(), as_g: GIF(), as_a: MP3() }, { assetId: 'as_v', posterId: 'as_g', autoplay: true, muted: true, frame: 'browser' }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.assets.as_v).toMatchObject({ mime: 'video/webm', width: 320, height: 180, duration: 3 });
    expect(r.project.assets.as_g.animated).toBe(true);
    expect(r.project.pages[0].elements[0].props).toMatchObject({ assetId: 'as_v', posterId: 'as_g', autoplay: true, frame: 'browser' });
  });

  it('clears references to the wrong kind of asset', () => {
    const r = validateProject(raw({ as_v: WEBM(), as_g: GIF(), as_a: MP3() }, { assetId: 'as_g', posterId: 'as_v' }));
    expect(r.ok && r.project.pages[0].elements[0].props).toMatchObject({ assetId: '', posterId: '' });
    const r2 = validateProject(raw({ as_v: WEBM() }, { assetId: 'as_v' }, 'audio'));
    expect(r2.ok && r2.project.pages[0].elements[0].props.assetId).toBe('');
    const r3 = validateProject(raw({ as_a: MP3() }, { assetId: 'as_a' }, 'audio'));
    expect(r3.ok && r3.project.pages[0].elements[0].props.assetId).toBe('as_a');
  });

  it('rejects non-base64, unsupported and blob: media', () => {
    const r = validateProject(
      raw(
        {
          bad1: { ...WEBM(), data: 'data:video/webm;base64,@@not base64@@' },
          bad2: { ...WEBM(), data: 'data:video/quicktime;base64,AAAA' },
          bad3: { ...WEBM(), data: 'blob:https://example.com/123' },
          bad4: { ...MP3(), data: 'data:audio/mpeg,plain' },
          bad5: { ...WEBM(), data: 'https://example.com/video.mp4' },
          ok: WEBM(),
        },
        { assetId: 'bad1' },
      ),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.project.assets)).toEqual(['ok']);
    expect(r.warnings.filter((w) => w.includes('Skipped asset'))).toHaveLength(5);
    expect(r.project.pages[0].elements[0].props.assetId).toBe('');
  });
});

describe('video element', () => {
  const env = (p: Project, mode: 'edit' | 'thumb' = 'edit') => createStaticEnv(p, mode);

  it('invites adding a video when empty', () => {
    const el = createElement('video');
    const p = projectWith([el], []);
    const { node } = renderContent(el, env(p), document);
    expect(node.querySelector('.ofs-video-empty')).not.toBeNull();
    expect(node.textContent).toContain('Add a video');
    expect(node.querySelector('video')).toBeNull();
  });

  it('shows a muted still (poster or first frame) outside playback', () => {
    const el = createElement('video', { props: { assetId: 'as_v', posterId: 'as_g', autoplay: true, controls: true } });
    const p = projectWith([el], [WEBM(), GIF()]);
    const { node } = renderContent(el, env(p), document);
    const v = node.querySelector('video')!;
    // Decoded once into a cached Blob URL where available (never persisted), else the data URL.
    expect(v.getAttribute('src')).toMatch(/^(blob:|data:video\/webm;base64,)/);
    expect(v.getAttribute('src')!.endsWith('#t=0.1')).toBe(true);
    expect(v.poster).toBe(GIF().data);
    expect(v.muted).toBe(true);
    expect(v.controls).toBe(false);
    expect(v.autoplay).toBe(false);
    expect(v.preload).toBe('metadata');
    expect(play).not.toHaveBeenCalled();
    // Autoplay with sound will be blocked, so the viewer will first see the play button.
    expect(node.querySelector<HTMLElement>('.ofs-video-play')!.hidden).toBe(false);
  });

  it('renders border and browser-window frames with the title', () => {
    const el = createElement('video', { props: { assetId: 'as_v', frame: 'browser', alt: 'Getting started' } });
    const p = projectWith([el], [WEBM()]);
    const { node } = renderContent(el, env(p, 'thumb'), document);
    expect(node.classList.contains('ofs-video-frame-browser')).toBe(true);
    expect(node.querySelectorAll('.ofs-video-dots i')).toHaveLength(3);
    expect(node.querySelector('.ofs-video-url')!.textContent).toBe('Getting started');
    const b = createElement('video', { props: { assetId: 'as_v', frame: 'border', fit: 'cover' } });
    const nb = renderContent(b, env(projectWith([b], [WEBM()])), document).node;
    expect(nb.classList.contains('ofs-video-frame-border')).toBe(true);
    expect(nb.querySelector('video')!.style.objectFit).toBe('cover');
  });

  it('looks right in every theme (themed accents, readable text)', () => {
    for (const theme of THEME_IDS) {
      const el = themeNewElement(createElement('video', { props: { frame: 'browser' } }), theme);
      const p = projectWith([el], []);
      const { node } = renderContent(el, env(p), document);
      expect(node.style.getPropertyValue('--ofs-v-accent')).toBe((el.props as unknown as { accent: string }).accent);
      const empty = node.querySelector<HTMLElement>('.ofs-video-empty')!;
      // mediaBg is dark in every theme, so the text is light.
      expect(empty.style.color).toBe('rgb(255, 255, 255)');
      const audio = themeNewElement(createElement('audio', { props: { assetId: 'as_a' } }), theme);
      const an = renderContent(audio, env(projectWith([audio], [MP3()])), document).node;
      expect(an.style.getPropertyValue('--ofs-a-accent')).toBe((audio.props as unknown as { accent: string }).accent);
    }
  });
});

function playerProject() {
  const video = createElement('video', { id: 'el_vid', props: { assetId: 'as_v', controls: false } });
  const mk = (id: string, type: string) =>
    createElement('button', {
      id,
      interactions: [{ id: `ix_${id}`, trigger: 'click', conditions: [], actions: [{ id: `a_${id}`, type, params: { target: 'el_vid' } }] }],
    });
  const v = createVariable('Ended', 0);
  video.interactions = [
    { id: 'ix_end', trigger: 'mediaEnded', conditions: [], actions: [{ id: 'a_end', type: 'varAdd', params: { variable: v.id, amount: 1 } }] },
  ];
  const p = projectWith([video, mk('el_play', 'mediaPlay'), mk('el_pause', 'mediaPause'), mk('el_restart', 'mediaRestart')], [WEBM()]);
  p.variables.push(v);
  return { p, v };
}

describe('video playback', () => {
  it('Play / Pause / Restart actions drive the video, and "ended" fires mediaEnded', async () => {
    const { p, v } = playerProject();
    const { q, player } = mountPlayer(p);
    const video = q('el_vid')!.querySelector('video')!;
    expect(video.getAttribute('src')).toMatch(/^(blob:|data:video\/webm;base64,)/);
    expect(video.controls).toBe(false);
    expect(video.hasAttribute('playsinline')).toBe(true);
    let time = 12;
    Object.defineProperty(video, 'currentTime', { get: () => time, set: (t: number) => (time = t), configurable: true });

    q('el_play')!.querySelector('button')!.click();
    await tick();
    expect(play).toHaveBeenCalledTimes(1);
    q('el_pause')!.querySelector('button')!.click();
    await tick();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    q('el_restart')!.querySelector('button')!.click();
    await tick();
    expect(time).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);

    video.dispatchEvent(new Event('ended'));
    await tick();
    expect(player.vars.get(v.id)).toBe(1);
  });

  it('shows the play button honestly when the browser blocks playback', async () => {
    play.mockImplementation(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    const video = createElement('video', { id: 'el_vid', props: { assetId: 'as_v', autoplay: true } });
    const { q } = mountPlayer(projectWith([video], [WEBM()]));
    await tick();
    await tick();
    expect(play).toHaveBeenCalled();
    const box = q('el_vid')!.querySelector<HTMLElement>('.ofs-video')!;
    expect(box.dataset.state).toBe('blocked');
    expect(box.querySelector<HTMLElement>('.ofs-video-play')!.hidden).toBe(false);
    expect(box.querySelector<HTMLElement>('.ofs-video-hint')!.hidden).toBe(false);
  });

  it('a rejected play() from an action is handled (no unhandled rejection) and shows the overlay', async () => {
    play.mockImplementation(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    const { p } = playerProject();
    const { q } = mountPlayer(p);
    q('el_play')!.querySelector('button')!.click();
    await tick();
    await tick();
    expect(q('el_vid')!.querySelector<HTMLElement>('.ofs-video')!.dataset.state).toBe('blocked');
  });

  it('clicking the picture toggles playback when controls are off; destroy stops the video', async () => {
    const { p } = playerProject();
    const { q, player } = mountPlayer(p);
    q('el_vid')!.querySelector<HTMLElement>('.ofs-video-screen')!.click();
    expect(play).toHaveBeenCalledTimes(1);
    const video = q('el_vid')!.querySelector('video')!;
    player.destroy();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('never autoplays in the editor', () => {
    const el = createElement('video', { props: { assetId: 'as_v', autoplay: true, muted: true } });
    renderContent(el, createStaticEnv(projectWith([el], [WEBM()]), 'edit'), document);
    expect(play).not.toHaveBeenCalled();
  });
});

describe('audio element', () => {
  it('invites adding a sound when empty', () => {
    const el = createElement('audio');
    const { node } = renderContent(el, createStaticEnv(projectWith([el], []), 'edit'), document);
    expect(node.textContent).toContain('Add a sound');
    expect(node.querySelector('audio')).toBeNull();
  });

  it('renders the player card statically with title and duration', () => {
    const el = createElement('audio', { props: { assetId: 'as_a' } });
    const { node } = renderContent(el, createStaticEnv(projectWith([el], [MP3()]), 'edit'), document);
    expect(node.querySelector('.ofs-audio-title')!.textContent).toBe('tone');
    expect(node.querySelector('.ofs-audio-time')!.textContent).toBe('0:00 / 0:02');
    expect(node.querySelector('[role=slider]')).not.toBeNull();
    expect(node.querySelector('audio')).toBeNull();
    const native = createElement('audio', { props: { assetId: 'as_a', style: 'native' } });
    const nn = renderContent(native, createStaticEnv(projectWith([native], [MP3()]), 'edit'), document).node;
    expect(nn.querySelector('audio')!.controls).toBe(true);
    const compact = createElement('audio', { props: { assetId: 'as_a', style: 'compact', title: 'Theme' } });
    const cn = renderContent(compact, createStaticEnv(projectWith([compact], [MP3()]), 'edit'), document).node;
    expect(cn.classList.contains('ofs-audio-compact')).toBe(true);
    expect(cn.querySelector('.ofs-audio-title')!.textContent).toBe('Theme');
  });

  it('plays from its own button, seeks with the keyboard and supports the media actions', async () => {
    const el = createElement('audio', { id: 'el_aud', props: { assetId: 'as_a', volume: 50, loop: true } });
    const btn = createElement('button', {
      id: 'el_b',
      interactions: [{ id: 'ix', trigger: 'click', conditions: [], actions: [{ id: 'a', type: 'mediaRestart', params: { target: 'el_aud' } }] }],
    });
    const { q } = mountPlayer(projectWith([el, btn], [MP3()]));
    const audio = q('el_aud')!.querySelector('audio')!;
    expect(audio.getAttribute('src')).toMatch(/^(blob:|data:audio\/mpeg;base64,)/);
    expect(audio.volume).toBe(0.5);
    expect(audio.loop).toBe(true);
    let time = 0;
    Object.defineProperty(audio, 'currentTime', { get: () => time, set: (t: number) => (time = t), configurable: true });
    q('el_aud')!.querySelector<HTMLButtonElement>('.ofs-audio-btn')!.click();
    expect(play).toHaveBeenCalledTimes(1);
    const slider = q('el_aud')!.querySelector<HTMLElement>('[role=slider]')!;
    expect(slider.tabIndex).toBe(0);
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(time).toBe(2.04); // clamped to the (known) duration
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(time).toBe(0);
    time = 1;
    q('el_b')!.querySelector('button')!.click();
    await tick();
    expect(time).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('highlights the play button when autoplay is blocked', async () => {
    play.mockImplementation(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    const el = createElement('audio', { id: 'el_aud', props: { assetId: 'as_a', autoplay: true } });
    const { q } = mountPlayer(projectWith([el], [MP3()]));
    await tick();
    await tick();
    const node = q('el_aud')!.querySelector<HTMLElement>('.ofs-audio')!;
    expect(node.dataset.state).toBe('blocked');
    expect(node.classList.contains('ofs-audio-blocked')).toBe(true);
  });

  it('formats times', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.4)).toBe('1:05');
    expect(formatTime(3723)).toBe('1:02:03');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});

describe('export with media', () => {
  const runtime = 'window.__ofs={};';

  it('embeds media as base64 data URLs that survive re-import byte-for-byte', () => {
    const v = createElement('video', { props: { assetId: 'as_v', posterId: 'as_g' } });
    const a = createElement('audio', { props: { assetId: 'as_a' } });
    const i = createElement('image', { props: { assetId: 'as_s' } });
    const p = projectWith([v, a, i], [WEBM(), MP3(), GIF(), STILL(), media('as_unused', 'tone.wav', 'audio/wav')]);
    const pruned = pruneUnusedAssets(p);
    expect(Object.keys(pruned.assets).sort()).toEqual(['as_a', 'as_g', 'as_s', 'as_v']);
    const html = buildStandaloneHtml(pruned, runtime);
    for (const asset of Object.values(pruned.assets)) expect(html).toContain(asset.data);
    expect(html).toContain('media-src data: blob:');
    const json = /<script type="application\/json" id="ofs-project">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(json).not.toContain('blob:');
    const back = importFromText(html).project;
    for (const asset of Object.values(pruned.assets)) {
      expect(back.assets[asset.id].data).toBe(asset.data);
      expect(back.assets[asset.id].mime).toBe(asset.mime);
    }
    expect(back.assets.as_v.duration).toBe(3);
    expect(back.assets.as_g.animated).toBe(true);
  });

  it('estimates the exact file size without embedding the data twice', () => {
    const v = createElement('video', { props: { assetId: 'as_v' } });
    const p = projectWith([v, createElement('text', { props: { text: 'Größe – ünïcödé ✓' } })], [WEBM()]);
    const est = estimateExport(p, runtime);
    const html = buildStandaloneHtml(p, runtime);
    expect(est.bytes).toBe(byteSize(html));
    expect(est.chars).toBe(html.length);
    const rows = assetBreakdown(p, est.bytes);
    expect(rows[0]).toMatchObject({ kind: 'video', bytes: WEBM().data.length });
    expect(rows[0].share).toBeGreaterThan(0.3);
  });

  it('finds elements that point at missing or wrong-kind files', () => {
    const v = createElement('video', { name: 'Intro video', props: { assetId: 'as_gone' } });
    const a = createElement('audio', { name: 'Music', props: { assetId: 'as_v' } });
    const empty = createElement('video', { name: 'Empty video' });
    const ok = createElement('video', { props: { assetId: 'as_v', posterId: 'as_g' } });
    const p = projectWith([v, a, empty, ok], [WEBM(), GIF()]);
    p.pages[0].background.imageId = 'as_missing';
    const { problems, empty: none } = findAssetIssues(p);
    expect(problems.map((x) => x.label)).toEqual(['Background of slide 1', 'Intro video', 'Music']);
    expect(problems[1].message).toMatch(/no longer in the project/);
    expect(problems[2].message).toMatch(/needs a sound but points to a video/);
    expect(none.map((x) => x.label)).toEqual(['Empty video']);
    expect(findAssetIssues(projectWith([ok], [WEBM(), GIF()])).problems).toEqual([]);
  });
});

describe('draft storage split', () => {
  it('stores asset data separately, once per content key, and joins it back', () => {
    const p = projectWith([createElement('video', { props: { assetId: 'as_v' } })], [WEBM(), MP3(), { ...MP3(), id: 'as_a2' }]);
    const keys = { as_v: 'k_video', as_a: 'k_tone', as_a2: 'k_tone' };
    const { record, assets } = splitDraft(p, keys);
    expect(record.format).toBe(2);
    expect(JSON.stringify(record).length).toBeLessThan(10_000);
    expect(Object.values(record.project.assets).every((a) => a.data === '')).toBe(true);
    expect(assets.map((a) => a.key).sort()).toEqual(['k_tone', 'k_video']);
    const store = new Map(assets.map((a) => [a.key, a.data]));
    const back = joinDraft(record, (k) => store.get(k));
    expect(back).toEqual(p);
    expect(referencedKeys([record])).toEqual(new Set(['k_video', 'k_tone']));
  });

  it('drops assets whose payload is missing and reads v1 records unchanged', () => {
    const p = projectWith([], [WEBM(), MP3()]);
    const { record } = splitDraft(p, { as_v: 'k1', as_a: 'k2' });
    const back = joinDraft(record, (k) => (k === 'k1' ? WEBM().data : undefined));
    expect(Object.keys(back.assets)).toEqual(['as_v']);
    const v1 = { id: p.id, title: 't', kind: 'slides' as const, updatedAt: '', pages: 1, project: p };
    expect(joinDraft(v1, () => undefined)).toBe(p);
    expect(referencedKeys([v1, record as DraftRecordV2])).toEqual(new Set(['k1', 'k2']));
  });
});
