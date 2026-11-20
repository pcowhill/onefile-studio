import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPlayer, tick } from './helpers';
import { createElement, createProject, createVariable } from '../../src/model/factory';
import type { Asset, Project, SceneElement } from '../../src/model/types';
import { renderContent, renderPageStatic } from '../../src/runtime/mount';
import { createStaticEnv } from '../../src/runtime/env';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const IMG = (edit?: Asset['edit']): Asset => ({
  id: 'as_i',
  name: 'shot.png',
  mime: 'image/png',
  data: PNG,
  width: 400,
  height: 200,
  bytes: 70,
  hash: 'i',
  ...(edit ? { edit } : {}),
});
const VID = (edit?: Asset['edit']): Asset => ({
  id: 'as_v',
  name: 'rec.webm',
  mime: 'video/webm',
  data: 'data:video/webm;base64,GkXfo0',
  width: 1280,
  height: 720,
  bytes: 4,
  hash: 'v',
  duration: 30,
  ...(edit ? { edit } : {}),
});
const SND = (edit?: Asset['edit']): Asset => ({
  id: 'as_a',
  name: 'voice.webm',
  mime: 'audio/webm',
  data: 'data:audio/webm;base64,GkXfo0',
  width: 0,
  height: 0,
  bytes: 4,
  hash: 'a',
  duration: 20,
  ...(edit ? { edit } : {}),
});

function projectWith(elements: SceneElement[], assets: Asset[]): Project {
  const p = createProject('slides');
  p.pages[0].elements = elements;
  for (const a of assets) p.assets[a.id] = a;
  return p;
}
const edit = (p: Project) => createStaticEnv(p, 'edit');

let play: ReturnType<typeof vi.fn>;
beforeEach(() => {
  play = vi.fn(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: false, configurable: true });
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play as unknown as () => Promise<void>);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: true, configurable: true });
    this.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** Gives a media element a controllable clock (jsdom has no media pipeline). */
function clock(media: HTMLMediaElement, duration: number) {
  const s = { t: 0 };
  Object.defineProperty(media, 'currentTime', {
    get: () => s.t,
    set: (v: number) => {
      s.t = v;
      media.dispatchEvent(new Event('seeking'));
    },
    configurable: true,
  });
  Object.defineProperty(media, 'duration', { get: () => duration, configurable: true });
  return s;
}

describe('edited pictures', () => {
  it('an unedited picture is a plain <img> (unchanged from v0.2)', () => {
    const el = createElement('image', { props: { assetId: 'as_i' } });
    const node = renderContent(el, edit(projectWith([el], [IMG()])), document).node;
    expect(node.querySelector('img')!.getAttribute('src')).toBe(PNG);
    expect(node.querySelector('svg')).toBeNull();
  });

  it('a library crop + rotation renders the original bytes through a viewBox and matrix', () => {
    const el = createElement('image', { props: { assetId: 'as_i', fit: 'contain', alt: 'Demo' } });
    const p = projectWith([el], [IMG({ crop: { x: 0.25, y: 0, w: 0.5, h: 1 }, rotate: 90 })]);
    const svg = renderContent(el, edit(p), document).node.querySelector('svg.ofs-edimg')!;
    // Rotated picture is 200×400; the crop keeps x 50–150 over the full height.
    expect(svg.getAttribute('viewBox')).toBe('50 0 100 400');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(svg.getAttribute('aria-label')).toBe('Demo');
    const image = svg.querySelector('image')!;
    expect(image.getAttribute('href')).toBe(PNG);
    expect(image.getAttribute('transform')).toBe('matrix(0 1 -1 0 200 0)');
  });

  it('an element’s own edit overrides the library version; {} shows the original', () => {
    const own = createElement('image', { props: { assetId: 'as_i', edit: { flipH: true } } });
    const orig = createElement('image', { props: { assetId: 'as_i', edit: {} } });
    const p = projectWith([own, orig], [IMG({ rotate: 180 })]);
    const a = renderContent(own, edit(p), document).node.querySelector('svg image')!;
    expect(a.getAttribute('transform')).toBe('matrix(-1 0 0 1 400 0)');
    expect(renderContent(orig, edit(p), document).node.querySelector('img')).not.toBeNull();
  });

  it('galleries, before/after sliders and backgrounds follow the library version', () => {
    const asset = IMG({ crop: { x: 0, y: 0, w: 0.5, h: 0.5 } });
    const gallery = createElement('gallery', { props: { images: ['as_i', 'as_i'] } });
    const ba = createElement('beforeAfter', { props: { before: 'as_i', after: 'as_i' } });
    const p = projectWith([gallery, ba], [asset]);
    p.pages[0].background.imageId = 'as_i';
    expect(renderContent(gallery, edit(p), document).node.querySelectorAll('svg.ofs-edimg')).toHaveLength(2);
    expect(renderContent(ba, edit(p), document).node.querySelectorAll('svg.ofs-edimg')).toHaveLength(2);
    const page = renderPageStatic(p, 0, edit(p), document).node;
    const bg = page.querySelector<HTMLElement>('.ofs-bg-image')!;
    expect(bg.style.backgroundImage).toBe('');
    expect(bg.querySelector('svg.ofs-edimg')!.getAttribute('viewBox')).toBe('0 0 200 100');
  });
});

describe('edited videos', () => {
  it('a crop shows only that region at any size (container-query viewport), with a custom control bar', () => {
    const el = createElement('video', { props: { assetId: 'as_v', fit: 'contain' } });
    const p = projectWith([el], [VID({ crop: { x: 0.5, y: 0.25, w: 0.5, h: 0.5 } })]);
    const node = renderContent(el, edit(p), document).node;
    const screen = node.querySelector<HTMLElement>('.ofs-video-screen')!;
    expect(screen.classList.contains('ofs-video-cropped')).toBe(true);
    const box = node.querySelector<HTMLElement>('.ofs-video-crop')!;
    expect(box.style.getPropertyValue('--ofs-v-r')).toBe(String(Math.round(((0.5 * 1280) / (0.5 * 720)) * 10000) / 10000));
    const v = box.querySelector('video')!;
    expect(v.style.width).toBe('200%');
    expect(v.style.left).toBe('-100%');
    expect(v.style.top).toBe('-50%');
    expect(node.querySelector('.ofs-vbar')).not.toBeNull();
  });

  it('in the editor a trimmed video shows its first trimmed frame', () => {
    const el = createElement('video', { props: { assetId: 'as_v', edit: { trim: { start: 4.5, end: 9 } } } });
    const node = renderContent(el, edit(projectWith([el], [VID()])), document).node;
    expect(node.querySelector('video')!.getAttribute('src')).toMatch(/#t=4\.5$/);
  });

  it('plays only the trimmed segment: starts at the start, stops at the end, fires "finished" once', async () => {
    const v1 = createVariable('Ended', 0);
    const el = createElement('video', {
      id: 'el_v',
      props: { assetId: 'as_v', controls: true, edit: { trim: { start: 5, end: 10 } } },
      interactions: [{ id: 'ix', trigger: 'mediaEnded', conditions: [], actions: [{ id: 'a', type: 'varAdd', params: { variable: v1.id, amount: 1 } }] }],
    });
    const p = projectWith([el], [VID()]);
    p.variables.push(v1);
    const { q, player } = mountPlayer(p);
    const video = q('el_v')!.querySelector('video')!;
    const c = clock(video, 30);
    // Native controls would show the whole file: an edited video uses its own bar.
    expect(video.controls).toBe(false);
    const bar = q('el_v')!.querySelector('.ofs-vbar')!;
    expect(bar.querySelector('.ofs-vbar-time')!.textContent).toBe('0:00 / 0:05');
    q('el_v')!.querySelector<HTMLButtonElement>('.ofs-video-play')!.click();
    expect(c.t).toBe(5);
    expect(play).toHaveBeenCalledTimes(1);
    // Seeking before the start is clamped into the segment.
    video.currentTime = 1;
    expect(c.t).toBe(5);
    c.t = 10.2;
    video.dispatchEvent(new Event('timeupdate'));
    await tick();
    expect(video.paused).toBe(true);
    expect(c.t).toBe(10);
    expect(player.vars.get(v1.id)).toBe(1);
    // Playing again after the end starts over at the trim start.
    bar.querySelector<HTMLButtonElement>('.ofs-vbar-play')!.click();
    expect(c.t).toBe(5);
  });

  it('loops the segment, not the file', async () => {
    const el = createElement('video', { id: 'el_v', props: { assetId: 'as_v', loop: true, edit: { trim: { start: 2, end: 4 } } } });
    const { q } = mountPlayer(projectWith([el], [VID()]));
    const video = q('el_v')!.querySelector('video')!;
    const c = clock(video, 30);
    expect(video.loop).toBe(false);
    q('el_v')!.querySelector<HTMLButtonElement>('.ofs-video-play')!.click();
    c.t = 4.01;
    video.dispatchEvent(new Event('timeupdate'));
    expect(c.t).toBe(2);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('Restart returns to the trim start', async () => {
    const vid = createElement('video', { id: 'el_v', props: { assetId: 'as_v', edit: { trim: { start: 7, end: 12 } } } });
    const btn = createElement('button', {
      id: 'el_b',
      interactions: [{ id: 'ix', trigger: 'click', conditions: [], actions: [{ id: 'a', type: 'mediaRestart', params: { target: 'el_v' } }] }],
    });
    const { q } = mountPlayer(projectWith([vid, btn], [VID()]));
    const c = clock(q('el_v')!.querySelector('video')!, 30);
    c.t = 9;
    q('el_b')!.querySelector('button')!.click();
    await tick();
    expect(c.t).toBe(7);
  });

  it('untrimmed videos keep native loop and native controls (v0.2 behaviour)', () => {
    const el = createElement('video', { id: 'el_v', props: { assetId: 'as_v', loop: true, controls: true } });
    const { q } = mountPlayer(projectWith([el], [VID()]));
    const video = q('el_v')!.querySelector('video')!;
    expect(video.loop).toBe(true);
    expect(video.controls).toBe(true);
    expect(q('el_v')!.querySelector('.ofs-vbar')).toBeNull();
  });
});

describe('trimmed sounds', () => {
  it('the player shows and seeks within the trimmed segment', async () => {
    const el = createElement('audio', { id: 'el_a', w: 420, props: { assetId: 'as_a', edit: { trim: { start: 3, end: 11 } } } });
    const { q } = mountPlayer(projectWith([el], [SND()]));
    const node = q('el_a')!;
    expect(node.querySelector('.ofs-audio-time')!.textContent).toBe('0:00 / 0:08');
    const audio = node.querySelector('audio')!;
    const c = clock(audio, 20);
    node.querySelector<HTMLButtonElement>('.ofs-audio-btn')!.click();
    expect(c.t).toBe(3);
    const track = node.querySelector<HTMLElement>('.ofs-audio-track')!;
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(c.t).toBe(11);
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(c.t).toBe(3);
    c.t = 7;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(node.querySelector('.ofs-audio-time')!.textContent).toBe('0:04 / 0:08');
  });

  it('a library trim applies to every use without its own', () => {
    const a = createElement('audio', { id: 'el_a', props: { assetId: 'as_a' } });
    const b = createElement('audio', { id: 'el_b', props: { assetId: 'as_a', edit: {} } });
    const p = projectWith([a, b], [SND({ trim: { start: 0, end: 5 } })]);
    expect(renderContent(a, edit(p), document).node.querySelector('.ofs-audio-time')!.textContent).toBe('0:00 / 0:05');
    expect(renderContent(b, edit(p), document).node.querySelector('.ofs-audio-time')!.textContent).toBe('0:00 / 0:20');
  });
});
