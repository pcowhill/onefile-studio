import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { exportProject, openExported, openStudio, studioProject } from './helpers';

/**
 * Capture workflows against Chromium's fake capture devices:
 * `--use-fake-device-for-media-stream` supplies a synthetic camera, microphone
 * and screen (a moving test pattern and beeps), and
 * `--use-fake-ui-for-media-stream` grants permission without the native
 * prompts and picker (which cannot be automated headless). Everything after
 * the permission step — getUserMedia/getDisplayMedia streams, MediaRecorder,
 * the recorded files, the media library and exports — runs for real. The
 * native screen picker itself is verified manually (see docs/CAPTURE.md).
 *
 * An init script records every stream the page receives, so each test can
 * assert that no camera, microphone or screen track is left running.
 */
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
});

type El = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  interactions: Array<{ actions: Array<{ type: string; params: Record<string, unknown> }> }>;
};
type Asset = { id: string; name: string; mime: string; width: number; height: number; duration?: number; edit?: Record<string, unknown> };
type Proj = { pages: Array<{ elements: El[] }>; assets: Record<string, Asset> };
const project = async (page: Page) => (await studioProject(page)) as unknown as Proj;

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[]; __deny: Record<string, string>; __live(): number };
    w.__streams = [];
    w.__deny = {};
    const md = navigator.mediaDevices;
    for (const fn of ['getUserMedia', 'getDisplayMedia'] as const) {
      const orig = (md[fn] as (c: unknown) => Promise<MediaStream>).bind(md);
      (md as unknown as Record<string, unknown>)[fn] = async (c: unknown) => {
        if (w.__deny[fn]) throw new DOMException('Permission denied', w.__deny[fn]);
        const s = await orig(c);
        w.__streams.push(s);
        return s;
      };
    }
    w.__live = () => w.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length;
  });
}
const liveTracks = (page: Page) => page.evaluate(() => (window as unknown as { __live(): number }).__live());
const streamCount = (page: Page) => page.evaluate(() => (window as unknown as { __streams: unknown[] }).__streams.length);

async function newSlides(page: Page) {
  await instrument(page);
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-images').click();
}

/** Starts a recording from a Capture card and lets it run for about `ms`. */
async function record(page: Page, card: string, ms = 1500) {
  await page.getByTestId(`capture-${card}`).click();
  await page.getByTestId('record-start-now').click();
  await expect(page.getByTestId('record-elapsed')).toBeVisible();
  await page.waitForTimeout(ms);
}

test('screenshot: capture, crop and rotate, insert — the original pixels stay in the project', async ({ page }) => {
  await newSlides(page);
  await page.getByTestId('capture-screenshot').click();
  const item = page.getByTestId('capture-review-item');
  await expect(item).toBeVisible();
  await expect(item).toContainText('Screenshot 1.png');
  // The share is released as soon as the still is taken.
  expect(await streamCount(page)).toBe(1);
  expect(await liveTracks(page)).toBe(0);
  // A real frame (not an empty one) at the source's resolution.
  const size = await page.getByTestId('capture-result-image').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
  expect(size[0]).toBeGreaterThan(100);
  expect(size[1]).toBeGreaterThan(100);

  await page.getByTestId('capture-edit').click();
  const box = (await page.getByTestId('crop-box').boundingBox())!;
  await page.mouse.move(box.x + box.width - 1, box.y + box.height - 1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.getByTestId('rotate-right').click();
  await page.getByTestId('edit-done').click();
  await expect(item).toContainText('Cropped · rotated');
  await page.getByTestId('capture-insert').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const p = await project(page);
  const asset = Object.values(p.assets)[0];
  expect(asset).toMatchObject({ name: 'Screenshot 1.png', mime: 'image/png', width: size[0], height: size[1] });
  expect(asset.edit).toMatchObject({ rotate: 90 });
  const crop = asset.edit!.crop as { w: number; h: number };
  expect(crop.w).toBeCloseTo(0.5, 1);
  expect(crop.h).toBeCloseTo(0.5, 1);
  const el = p.pages[0].elements[0];
  expect(el.type).toBe('image');
  // The element took the cropped, rotated shape (portrait from a landscape crop).
  const placed = (await studioProject(page)) as unknown as { pages: Array<{ elements: Array<{ w: number; h: number }> }> };
  expect(placed.pages[0].elements[0].h).toBeGreaterThan(placed.pages[0].elements[0].w);
  await expect(page.locator(`.ed-el[data-id="${el.id}"] svg.ofs-edimg`)).toBeVisible();
  await expect(page.getByTestId('media-asset')).toContainText('Edited');
});

test('screenshot cancelled at the picker: a friendly message, nothing added, Try again works', async ({ page }) => {
  await newSlides(page);
  await page.evaluate(() => ((window as unknown as { __deny: Record<string, string> }).__deny.getDisplayMedia = 'NotAllowedError'));
  await page.getByTestId('capture-screenshot').click();
  await expect(page.getByTestId('capture-error')).toContainText('Screen sharing was cancelled');
  await expect(page.getByTestId('capture-error')).not.toContainText('Permission denied');
  await page.evaluate(() => ((window as unknown as { __deny: Record<string, string> }).__deny = {}));
  await page.getByTestId('capture-retry').click();
  await expect(page.getByTestId('capture-review-item')).toBeVisible();
  await page.getByTestId('capture-save').click();
  const p = await project(page);
  expect(Object.keys(p.assets)).toHaveLength(1);
  expect(p.pages[0].elements).toHaveLength(0);
});

test('webcam photo: live preview, take, retake, save to library; the camera is released', async ({ page }) => {
  await newSlides(page);
  await page.getByTestId('capture-photo').click();
  const preview = page.getByTestId('capture-preview');
  await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  // Nothing is saved before the photo is taken.
  expect(Object.keys((await project(page)).assets)).toHaveLength(0);
  await page.getByTestId('take-photo').click();
  await expect(page.getByTestId('capture-review-item')).toContainText('Photo 1.png');
  expect(await liveTracks(page)).toBe(0);
  await page.getByTestId('capture-retake').click();
  await page.getByTestId('take-photo').click();
  await expect(page.getByTestId('capture-review-item')).toBeVisible();
  await page.getByTestId('capture-save').click();
  expect(await liveTracks(page)).toBe(0);
  const assets = Object.values((await project(page)).assets);
  expect(assets).toHaveLength(1);
  expect(assets[0].mime).toBe('image/png');
});

test('camera permission denied: a friendly message and no live devices', async ({ page }) => {
  await newSlides(page);
  await page.evaluate(() => ((window as unknown as { __deny: Record<string, string> }).__deny.getUserMedia = 'NotAllowedError'));
  await page.getByTestId('capture-webcam').click();
  await expect(page.getByTestId('capture-error')).toContainText('Access to your camera was blocked');
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  expect(await liveTracks(page)).toBe(0);
  await page.getByTestId('capture-microphone').click();
  await expect(page.getByTestId('capture-error')).toContainText('microphone was blocked');
});

test('voice recording: countdown, pause/resume, stop, trim, insert; plays trimmed in Preview', async ({ page }) => {
  await newSlides(page);
  await page.getByTestId('capture-microphone').click();
  await expect(page.getByTestId('capture-status')).toContainText('Starting in');
  await page.getByTestId('record-start-now').click();
  await expect(page.getByTestId('record-elapsed')).toBeVisible();
  await page.waitForTimeout(1300);
  await page.getByTestId('record-pause').click();
  await expect(page.getByTestId('capture-status')).toContainText('Paused');
  const paused = await page.getByTestId('record-elapsed').textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('record-elapsed')).toHaveText(paused!);
  await page.getByTestId('record-pause').click();
  await page.waitForTimeout(1300);
  await page.getByTestId('record-stop').click();
  const item = page.getByTestId('capture-review-item');
  await expect(item).toContainText('Voice recording 1.webm');
  expect(await liveTracks(page)).toBe(0);
  // The recorded file really plays back.
  const audio = page.getByTestId('capture-result-audio');
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.readyState)).toBeGreaterThan(0);

  await page.getByTestId('capture-edit').click();
  const start = page.getByTestId('trim-start');
  await start.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('trim-start-label')).toHaveText('0:00.5');
  await page.getByTestId('edit-done').click();
  await expect(item).toContainText('Trimmed');
  await page.getByTestId('capture-insert').click();

  const p = await project(page);
  const asset = Object.values(p.assets)[0];
  expect(asset.mime).toBe('audio/webm');
  expect(asset.duration).toBeGreaterThan(2);
  expect(asset.edit).toMatchObject({ trim: { start: 0.5 } });
  expect(p.pages[0].elements[0].type).toBe('audio');

  // Preview runs the real player: playback starts at the trim start.
  await page.getByTestId('preview').click();
  const player = page.locator('.ofs-audio').last();
  await player.locator('.ofs-audio-btn').click();
  await expect.poll(() => player.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThanOrEqual(0.5);
});

test('screen recording: cancel releases the screen; Stop sharing in the browser ends a take; the video is inserted and exported', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await newSlides(page);
  page.on('dialog', (d) => void d.accept());
  await record(page, 'screen', 800);
  await page.getByTestId('record-cancel').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await liveTracks(page)).toBe(0);
  expect(Object.keys((await project(page)).assets)).toHaveLength(0);

  await record(page, 'screen', 1600);
  // The browser's own "Stop sharing" button ends the video track.
  await page.evaluate(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    const t = w.__streams[w.__streams.length - 1].getVideoTracks()[0];
    t.stop();
    t.dispatchEvent(new Event('ended'));
  });
  const item = page.getByTestId('capture-review-item');
  await expect(item).toContainText('Screen recording 1.webm');
  expect(await liveTracks(page)).toBe(0);
  await page.getByTestId('capture-insert').click();
  const p = await project(page);
  const asset = Object.values(p.assets)[0];
  expect(asset.mime).toBe('video/webm');
  expect(asset.width).toBeGreaterThan(0);
  expect(asset.duration).toBeGreaterThan(0.5);
  expect(p.pages[0].elements[0].type).toBe('video');

  // The captured video is a normal asset: it exports, plays offline and comes back.
  const file = await exportProject(page, 'captured-screen.html');
  const out = await openExported(browser, file);
  try {
    const v = out.page.locator('video').first();
    await out.page.locator('.ofs-video-play').first().click();
    await expect.poll(() => v.evaluate((x: HTMLVideoElement) => x.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.2);
    expect(out.requests).toEqual([]);
    expect(out.errors).toEqual([]);
  } finally {
    await out.close();
  }
});

test('screen + webcam: two recordings, inserted as picture-in-picture that play together', async ({ page }) => {
  test.setTimeout(90_000);
  await newSlides(page);
  await record(page, 'screenCamera', 1800);
  await expect(page.getByTestId('capture-preview-camera')).toBeVisible();
  await page.getByTestId('record-stop').click();
  await expect(page.getByTestId('capture-review-item')).toHaveCount(2);
  expect(await liveTracks(page)).toBe(0);
  await page.getByTestId('capture-insert').click();
  const p = await project(page);
  const names = Object.values(p.assets).map((a) => a.name);
  expect(names).toEqual(['Screen recording 1.webm', 'Webcam recording 1.webm']);
  const [screen, cam] = p.pages[0].elements;
  expect([screen.type, cam.type]).toEqual(['video', 'video']);
  // The webcam sits inside the screen recording's bottom-right corner…
  const placed = (await studioProject(page)) as unknown as { pages: Array<{ elements: Array<{ x: number; y: number; w: number; h: number }> }> };
  const [s, c] = placed.pages[0].elements;
  expect(c.x + c.w).toBeLessThanOrEqual(s.x + s.w);
  expect(c.y + c.h).toBeLessThanOrEqual(s.y + s.h);
  expect(c.w).toBeLessThan(s.w / 2);
  // …and clicking either toggles the other too.
  expect(screen.interactions[0].actions[0]).toMatchObject({ type: 'mediaToggle', params: { target: cam.id } });
  expect(cam.interactions[0].actions[0]).toMatchObject({ type: 'mediaToggle', params: { target: screen.id } });

  await page.getByTestId('preview').click();
  const stage = page.locator('.ed-preview');
  await stage.locator(`.ofs-el[data-id="${screen.id}"] .ofs-video-screen`).click();
  const playing = (id: string) => stage.locator(`.ofs-el[data-id="${id}"] video`).evaluate((v: HTMLVideoElement) => !v.paused);
  await expect.poll(() => playing(screen.id)).toBe(true);
  await expect.poll(() => playing(cam.id)).toBe(true);
});

test('closing the dialog mid-recording releases every device', async ({ page }) => {
  await newSlides(page);
  page.on('dialog', (d) => void d.accept());
  await record(page, 'webcam', 600);
  expect(await liveTracks(page)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await liveTracks(page)).toBe(0);
  expect(Object.keys((await project(page)).assets)).toHaveLength(0);
});
