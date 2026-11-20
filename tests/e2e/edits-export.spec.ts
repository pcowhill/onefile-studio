import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { embeddedProject, exportProject, importIntoStudio, normalise, OUT, openExported, studioProject } from './helpers';
import { quadrants, RED, YELLOW } from './png';

/**
 * Nondestructive edits in a standalone file: crops, rotations and trims must
 * render and play the same way in the exported HTML (opened from disk,
 * offline) as in the editor, survive re-import intact, and stay editable.
 */
const FIX = path.resolve('tests/fixtures/media');
const b64 = (name: string) => fs.readFileSync(path.join(FIX, name)).toString('base64');
const PNG = `data:image/png;base64,${quadrants().toString('base64')}`;

const el = (id: string, type: string, x: number, y: number, w: number, h: number, props: Record<string, unknown>, interactions: unknown[] = []) => ({
  id,
  type,
  name: id,
  x,
  y,
  w,
  h,
  rotation: 0,
  hidden: false,
  locked: false,
  props,
  interactions,
});
const ix = (id: string, trigger: string, type: string, params: Record<string, unknown>) => ({
  id,
  trigger,
  conditions: [],
  actions: [{ id: `${id}_a`, type, params }],
});

function editedProject() {
  return {
    schema: 'onefile-studio/project',
    version: 3,
    id: 'prj_edits',
    kind: 'slides',
    meta: { title: 'Edited media', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' },
    settings: { width: 1280, height: 720, transition: 'none', showNavigation: true, backdrop: '#ffffff', theme: 'professional' },
    variables: [{ id: 'var_done', name: 'Done', type: 'number', initial: 0 }],
    assets: {
      as_png: {
        id: 'as_png',
        name: 'quadrants.png',
        mime: 'image/png',
        data: PNG,
        width: 200,
        height: 100,
        bytes: 0,
        hash: 'p',
        edit: { crop: { x: 0, y: 0, w: 0.5, h: 0.5 } },
      },
      as_vid: {
        id: 'as_vid',
        name: 'clip.webm',
        mime: 'video/webm',
        data: `data:video/webm;base64,${b64('clip.webm')}`,
        width: 320,
        height: 180,
        bytes: 0,
        hash: 'v',
        duration: 3,
        edit: { trim: { start: 1, end: 2 }, crop: { x: 0.5, y: 0, w: 0.5, h: 1 } },
      },
      as_snd: {
        id: 'as_snd',
        name: 'tone.mp3',
        mime: 'audio/mpeg',
        data: `data:audio/mpeg;base64,${b64('tone.mp3')}`,
        width: 0,
        height: 0,
        bytes: 0,
        hash: 's',
        duration: 2.04,
      },
    },
    pages: [
      {
        id: 'pg_1',
        name: 'Slide 1',
        background: { paint: { kind: 'solid', color: '#ffffff' } },
        elements: [
          // One picture, three ways: library crop (red quarter), own crop (yellow quarter), own rotation (original, upside down).
          el('el_lib', 'image', 40, 40, 200, 100, { assetId: 'as_png', fit: 'cover', radius: 0, shadow: 'none' }),
          el('el_own', 'image', 300, 40, 200, 100, {
            assetId: 'as_png',
            fit: 'cover',
            radius: 0,
            shadow: 'none',
            edit: { crop: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
          }),
          el('el_rot', 'image', 560, 40, 200, 100, { assetId: 'as_png', fit: 'cover', radius: 0, shadow: 'none', edit: { rotate: 180 } }),
          el('el_vid', 'video', 40, 200, 320, 360, { assetId: 'as_vid', fit: 'contain', controls: true, frame: 'none', radius: 0, shadow: 'none' }, [
            ix('ix_end', 'mediaEnded', 'varAdd', { variable: 'var_done', amount: 1 }),
          ]),
          el('el_full', 'video', 420, 200, 320, 180, { assetId: 'as_vid', fit: 'contain', controls: true, edit: {} }),
          el('el_snd', 'audio', 800, 200, 420, 96, { assetId: 'as_snd', style: 'player', edit: { trim: { start: 0.4, end: 1.2 } } }),
          el('el_txt', 'text', 800, 340, 420, 60, { text: 'Finished {Done}' }),
          el('el_btn', 'button', 800, 440, 260, 64, { label: 'Replay the clip' }, [ix('ix_btn', 'click', 'mediaRestart', { target: 'el_vid' })]),
        ],
      },
    ],
  };
}

/** Average colour of the middle of an element, read from a real screenshot. */
async function centreColour(page: Page, target: Locator): Promise<[number, number, number]> {
  const box = (await target.boundingBox())!;
  const shot = await page.screenshot({ clip: { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3, width: box.width * 0.4, height: box.height * 0.4 } });
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += px[i + k];
    const n = px.length / 4;
    return sum.map((s) => Math.round(s / n)) as [number, number, number];
  }, shot.toString('base64'));
}
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 40);

test('cropped, rotated and trimmed media work in an offline exported file and come back editable', async ({ page, browser }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(OUT, { recursive: true });
  const json = path.join(OUT, 'edited-media.json');
  fs.writeFileSync(json, JSON.stringify(editedProject()));
  await importIntoStudio(page, json);
  const before = await studioProject(page);

  // The editor canvas already shows the edits.
  await expect(page.locator('.ed-el[data-id="el_lib"] svg.ofs-edimg')).toBeVisible();
  expect(near(await centreColour(page, page.locator('.ed-el[data-id="el_lib"]')), RED)).toBe(true);
  expect(near(await centreColour(page, page.locator('.ed-el[data-id="el_own"]')), YELLOW)).toBe(true);

  const file = await exportProject(page, 'edited-media.html');
  // One copy of each file's bytes, however many ways it is shown.
  const html = fs.readFileSync(file, 'utf8');
  expect(html.split(PNG.slice(40, 120)).length - 1).toBe(1);
  expect(html.split(b64('clip.webm').slice(200, 280)).length - 1).toBe(1);
  // The edit metadata travels in the file.
  const embedded = embeddedProject(file) as { assets: Record<string, { edit?: unknown }> };
  expect(embedded.assets.as_vid.edit).toEqual({ trim: { start: 1, end: 2 }, crop: { x: 0.5, y: 0, w: 0.5, h: 1 } });

  const out = await openExported(browser, file);
  try {
    const x = out.page;
    const q = (id: string) => x.locator(`.ofs-el[data-id="${id}"]`);
    // Pictures: library crop, own crop, own rotation.
    expect(near(await centreColour(x, q('el_lib')), RED)).toBe(true);
    expect(near(await centreColour(x, q('el_own')), YELLOW)).toBe(true);
    const rot = (await q('el_rot').boundingBox())!;
    const tl = await x.screenshot({ clip: { x: rot.x + 10, y: rot.y + 10, width: 20, height: 20 } });
    const br = await x.screenshot({ clip: { x: rot.x + rot.width - 30, y: rot.y + rot.height - 30, width: 20, height: 20 } });
    const avg = (buf: Buffer) =>
      x.evaluate(async (d) => {
        const img = new Image();
        img.src = `data:image/png;base64,${d}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const p = ctx.getImageData(img.width >> 1, img.height >> 1, 1, 1).data;
        return [p[0], p[1], p[2]];
      }, buf.toString('base64'));
    // Upside down: yellow (bottom-right of the original) is now top-left, red bottom-right.
    expect(near(await avg(tl), YELLOW)).toBe(true);
    expect(near(await avg(br), RED)).toBe(true);

    // Video crop: the viewport has the crop's shape and the picture is scaled so the crop fills it.
    const vp = (await q('el_vid').locator('.ofs-video-crop').boundingBox())!;
    expect(vp.width / vp.height).toBeCloseTo(160 / 180, 1);
    const vb = (await q('el_vid').locator('video').boundingBox())!;
    expect(vb.width / vp.width).toBeCloseTo(2, 1);
    expect(vb.x + vb.width).toBeCloseTo(vp.x + vp.width, 0);
    // The untrimmed copy of the same file keeps native controls and the whole picture.
    expect(
      await q('el_full')
        .locator('video')
        .evaluate((v: HTMLVideoElement) => v.controls),
    ).toBe(true);
    await expect(q('el_full').locator('.ofs-video-crop')).toHaveCount(0);

    // Video trim: starts at 1 s, stops by itself at 2 s, announces "finished" once.
    const video = q('el_vid').locator('video');
    const state = () => video.evaluate((v: HTMLVideoElement) => ({ t: v.currentTime, paused: v.paused }));
    await expect(q('el_vid').locator('.ofs-vbar-time')).toHaveText('0:00 / 0:01');
    await q('el_vid').locator('.ofs-video-play').click();
    const first = await state();
    expect(first.t).toBeGreaterThanOrEqual(0.99);
    await expect.poll(async () => (await state()).paused, { timeout: 10_000 }).toBe(true);
    const end = await state();
    expect(end.t).toBeGreaterThan(1.9);
    expect(end.t).toBeLessThan(2.15);
    await expect(q('el_txt')).toContainText('Finished 1');
    // A media action restarts the segment, not the file.
    await q('el_btn').click();
    await expect.poll(async () => (await state()).paused).toBe(false);
    expect((await state()).t).toBeLessThan(1.6);
    await expect.poll(async () => (await state()).paused, { timeout: 10_000 }).toBe(true);
    await expect(q('el_txt')).toContainText('Finished 2');

    // Sound trim: 0.4 → 1.2 s, shown as a 0:00 / 0:00 (0.8 s) segment.
    const audio = q('el_snd').locator('audio');
    await q('el_snd').locator('.ofs-audio-btn').click();
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThanOrEqual(0.4);
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.paused), { timeout: 10_000 }).toBe(true);
    const at = await audio.evaluate((a: HTMLAudioElement) => a.currentTime);
    expect(at).toBeGreaterThan(1.1);
    expect(at).toBeLessThan(1.35);

    expect(out.requests).toEqual([]);
    expect(out.errors).toEqual([]);
  } finally {
    await out.close();
  }

  // Re-import: every edit survives and the project stays editable.
  await importIntoStudio(page, file);
  const after = await studioProject(page);
  expect(normalise(after)).toEqual(normalise(before));
  await page.locator('.ed-el[data-id="el_own"]').click();
  await expect(page.getByTestId('element-edit-status')).toContainText('Cropped (just here)');
  await page.getByTestId('element-edit-media').click();
  await page.getByTestId('rotate-right').click();
  await page.getByTestId('edit-save').click();
  const edited = (await studioProject(page)) as unknown as { pages: Array<{ elements: Array<{ id: string; props: { edit: { rotate?: number } } }> }> };
  expect(edited.pages[0].elements.find((e) => e.id === 'el_own')!.props.edit.rotate).toBe(90);
  // Going back to the library version is one click.
  await page.getByTestId('use-library-version').click();
  await expect(page.getByTestId('element-edit-status')).toContainText('Cropped (library version)');
});
