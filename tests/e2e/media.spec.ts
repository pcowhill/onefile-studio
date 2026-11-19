import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { embeddedProject, exportProject, importIntoStudio, openExported, openStudio, studioProject } from './helpers';

const FIX = path.resolve('tests/fixtures/media');
const fixture = (name: string) => path.join(FIX, name);
const b64 = (name: string) => fs.readFileSync(fixture(name)).toString('base64');

type El = { id: string; type: string; props: Record<string, unknown>; w: number; h: number };
type Asset = { id: string; name: string; mime: string; data: string; width: number; height: number; duration?: number; animated?: boolean };
type Proj = { pages: Array<{ elements: El[] }>; assets: Record<string, Asset> };

async function project(page: Page): Promise<Proj> {
  return (await studioProject(page)) as unknown as Proj;
}
const els = async (page: Page) => (await project(page)).pages.flatMap((p) => p.elements);

/** Adds a click interaction with one media action to the selected element. */
async function addMediaAction(page: Page, action: 'mediaPlay' | 'mediaPause' | 'mediaRestart') {
  await page.getByTestId('tab-behavior').click();
  await page.getByTestId('add-interaction').click();
  await page.getByTestId('trigger-click').click();
  await page.getByTestId('add-action').click();
  await page.getByTestId(`action-${action}`).click();
}

/** Buttons cascade on top of each other: click their uncovered top-left part. */
const CORNER = { position: { x: 16, y: 10 } };

const videoState = (page: Page, sel: string) =>
  page.locator(sel).evaluate((v: HTMLVideoElement) => ({ t: v.currentTime, paused: v.paused, ready: v.readyState, duration: v.duration }));

test('video, sound and animated GIF: upload, place, control, export offline and re-import byte-for-byte', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await openStudio(page);
  const canWebm = await page.evaluate(() => document.createElement('video').canPlayType('video/webm; codecs="vp9"'));
  expect(canWebm).not.toBe('');

  // A photo-sized PNG (so "Optimised" has something to compress): a screenshot of the start screen.
  const png = await page.screenshot();
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-images').click();
  await expect(page.getByTestId('tab-images')).toContainText('Media');
  const [pngChooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('upload-images').click()]);
  await pngChooser.setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await page.getByTestId('media-asset').first().click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('upload-images').click()]);
  await chooser.setFiles([fixture('clip.webm'), fixture('tone.mp3'), fixture('spinner.gif'), fixture('clip.mp4')]);
  const tiles = page.getByTestId('media-asset');
  await expect(tiles).toHaveCount(5);

  // Assets were measured and classified.
  const p0 = await project(page);
  const byName = (n: string) => Object.values(p0.assets).find((a) => a.name === n)!;
  expect(byName('clip.webm')).toMatchObject({ mime: 'video/webm', width: 320, height: 180 });
  expect(byName('clip.webm').duration).toBeGreaterThan(2.5);
  expect(byName('clip.mp4')).toMatchObject({ mime: 'video/mp4', width: 320, height: 180 });
  expect(byName('clip.mp4').duration).toBeGreaterThan(1.5);
  expect(byName('tone.mp3').mime).toBe('audio/mpeg');
  expect(byName('tone.mp3').duration).toBeGreaterThan(1.5);
  expect(byName('spinner.gif')).toMatchObject({ mime: 'image/gif', animated: true });
  for (const n of ['clip.webm', 'tone.mp3', 'spinner.gif', 'clip.mp4']) expect(byName(n).data.split(',')[1]).toBe(b64(n));
  await expect(page.locator('[data-testid=media-asset][data-kind=image]').nth(1)).toContainText('Animated');
  await expect(page.locator('[data-testid=media-asset][data-kind=image]').first()).not.toContainText('Animated');

  // Clicking a tile places the right element type (the WebM first: it becomes the default action target).
  await page.locator('[data-testid=media-asset][data-kind=video]').first().click();
  // The new video is selected and the inspector shows the chosen file.
  await page.getByTestId('tab-design').click();
  await expect(page.getByTestId('chosen-video')).toContainText('clip.webm');
  await page.getByTestId('tab-images').click();
  await page.locator('[data-testid=media-asset][data-kind=image]').nth(1).click();
  await page.locator('[data-testid=media-asset][data-kind=video]').nth(1).click();
  await page.locator('[data-testid=media-asset][data-kind=audio]').click();
  const placed = await els(page);
  expect(placed.map((e) => e.type)).toEqual(['image', 'video', 'image', 'video', 'audio']);
  const video = placed[1];
  const audio = placed[4];
  expect(Math.abs(video.w / video.h - 16 / 9)).toBeLessThan(0.02);
  // In the editor the video is a still, muted, control-less picture.
  const edVideo = page.locator(`.ed-el[data-id="${video.id}"] video`);
  await expect(edVideo).toHaveCount(1);
  expect(await edVideo.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, controls: v.controls, autoplay: v.autoplay }))).toEqual({
    muted: true,
    controls: false,
    autoplay: false,
  });

  // Play / Pause / Restart buttons targeting the video, built in the Behavior tab.
  const buttons: string[] = [];
  for (const action of ['mediaPlay', 'mediaPause', 'mediaRestart'] as const) {
    await page.getByTestId('tab-insert').click();
    await page.getByTestId('insert-button').click();
    await addMediaAction(page, action);
    const all = await els(page);
    buttons.push(all[all.length - 1].id);
  }
  const all = await els(page);
  for (const id of buttons) {
    const b = all.find((e) => e.id === id) as unknown as { interactions: Array<{ actions: Array<{ params: { target: string } }> }> };
    expect(b.interactions[0].actions[0].params.target).toBe(video.id);
  }

  // Preview runs the same engine: Play really plays.
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await stage.locator(`.ofs-el[data-id="${buttons[0]}"]`).click(CORNER);
  await expect.poll(async () => (await videoState(page, `.ed-preview .ofs-el[data-id="${video.id}"] video`)).t, { timeout: 10_000 }).toBeGreaterThan(0.2);
  await page.getByTestId('close-preview').click();

  // The export dialog shows the estimated size and the biggest files.
  await page.getByTestId('export').click();
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await expect(dialog.getByTestId('size-breakdown')).toBeVisible();
  await expect(dialog.getByTestId('export-size')).toHaveText(/KB|MB/);
  await expect(dialog.getByTestId('size-row')).toHaveCount(5);
  await expect(dialog.getByTestId('size-breakdown')).toContainText('clip.webm');
  await expect(dialog.getByTestId('size-breakdown')).toContainText('spinner.gif');
  const shown = (await dialog.getByTestId('export-size').textContent())!;
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  const file = await exportProject(page, 'media.html');
  const actual = fs.statSync(file).size;
  const [, num, unit] = /([\d.]+) (KB|MB)/.exec(shown)!;
  const estimated = Number(num) * (unit === 'MB' ? 1024 * 1024 : 1024);
  expect(Math.abs(estimated - actual) / actual).toBeLessThan(0.01);

  const ex = await openExported(browser, file);
  const v = `.ofs-el[data-id="${video.id}"] video`;
  await expect.poll(async () => (await videoState(ex.page, v)).duration, { timeout: 10_000 }).toBeGreaterThan(2.5);
  expect(await ex.page.locator(v).getAttribute('src')).toMatch(/^blob:/);
  // Play
  await ex.page.locator(`.ofs-el[data-id="${buttons[0]}"]`).click(CORNER);
  await expect.poll(async () => (await videoState(ex.page, v)).t, { timeout: 10_000 }).toBeGreaterThan(0.4);
  const playing = await videoState(ex.page, v);
  expect(playing.ready).toBeGreaterThanOrEqual(2);
  expect(playing.paused).toBe(false);
  // Pause
  await ex.page.locator(`.ofs-el[data-id="${buttons[1]}"]`).click(CORNER);
  await expect.poll(async () => (await videoState(ex.page, v)).paused).toBe(true);
  const pausedAt = (await videoState(ex.page, v)).t;
  await ex.page.waitForTimeout(400);
  expect((await videoState(ex.page, v)).t).toBeCloseTo(pausedAt, 2);
  await expect(ex.page.locator(`.ofs-el[data-id="${video.id}"] .ofs-video`)).toHaveAttribute('data-state', 'paused');
  // Restart
  await ex.page.locator(`.ofs-el[data-id="${buttons[2]}"]`).click(CORNER);
  await expect.poll(async () => (await videoState(ex.page, v)).paused).toBe(false);
  expect((await videoState(ex.page, v)).t).toBeLessThan(pausedAt);

  // The sound loads and plays from its own play button.
  const a = `.ofs-el[data-id="${audio.id}"] audio`;
  await expect.poll(() => ex.page.locator(a).evaluate((el: HTMLAudioElement) => el.duration), { timeout: 10_000 }).toBeGreaterThan(1.5);
  await ex.page.locator(`.ofs-el[data-id="${audio.id}"] .ofs-audio-btn`).click();
  await expect.poll(() => ex.page.locator(a).evaluate((el: HTMLAudioElement) => el.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.2);
  await expect(ex.page.locator(`.ofs-el[data-id="${audio.id}"] .ofs-audio-time`)).not.toHaveText('0:00 / 0:00');

  // The animated GIF decodes and is embedded byte-for-byte.
  const gif = ex.page.locator('.ofs-image img[src^="data:image/gif"]');
  await expect.poll(() => gif.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(64);
  expect(await gif.getAttribute('src')).toBe(`data:image/gif;base64,${b64('spinner.gif')}`);
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  // Optimised export keeps the GIF, video and sounds untouched.
  const optFile = await exportProject(page, 'media-optimised.html', 'optimized');
  const opt = embeddedProject(optFile) as unknown as Proj;
  const optByName = (n: string) => Object.values(opt.assets).find((x) => x.name === n)!;
  for (const n of ['clip.webm', 'tone.mp3', 'spinner.gif', 'clip.mp4']) expect(optByName(n).data.split(',')[1]).toBe(b64(n));
  const ex2 = await openExported(browser, optFile);
  expect(await ex2.page.locator('.ofs-image img[src^="data:image/gif"]').getAttribute('src')).toBe(`data:image/gif;base64,${b64('spinner.gif')}`);
  expect(ex2.errors).toEqual([]);
  await ex2.close();

  // Re-import: every media asset survives byte-for-byte.
  await importIntoStudio(page, file);
  const back = await project(page);
  const backByName = (n: string) => Object.values(back.assets).find((x) => x.name === n)!;
  for (const n of ['clip.webm', 'tone.mp3', 'spinner.gif', 'clip.mp4']) expect(backByName(n).data).toBe(byName(n).data);
  expect(backByName('spinner.gif').animated).toBe(true);
  expect(backByName('clip.webm').duration).toBeCloseTo(byName('clip.webm').duration!, 2);
});

test('drafts keep large media out of the draft record and reopen intact', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-images').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('upload-images').click()]);
  await chooser.setFiles([fixture('clip.webm'), fixture('tone.wav')]);
  await expect(page.getByTestId('media-asset')).toHaveCount(2);
  await page.locator('[data-testid=media-asset][data-kind=video]').click();
  await expect(page.locator('.ed-save')).toHaveText(/Saved/);
  const stored = await page.evaluate(
    () =>
      new Promise<{ draftBytes: number; assets: number }>((resolve, reject) => {
        const req = indexedDB.open('onefile-studio');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const t = db.transaction(['drafts', 'assets'], 'readonly');
          const drafts = t.objectStore('drafts').getAll();
          const assets = t.objectStore('assets').count();
          t.oncomplete = () => {
            resolve({ draftBytes: JSON.stringify(drafts.result).length, assets: assets.result });
            db.close();
          };
        };
      }),
  );
  expect(stored.assets).toBe(2);
  expect(stored.draftBytes).toBeLessThan(20_000);

  await page.goto('./');
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  const p = await project(page);
  const assets = Object.values(p.assets);
  expect(assets.find((a) => a.name === 'clip.webm')!.data.split(',')[1]).toBe(b64('clip.webm'));
  expect(assets.find((a) => a.name === 'tone.wav')!.data).toBe(`data:audio/wav;base64,${b64('tone.wav')}`);
  await expect(page.locator('.ed-el video')).toHaveCount(1);
});
