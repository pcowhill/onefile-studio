import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SceneContext } from './types.ts';

/**
 * Footage for the main product video: a real project built from a blank slide
 * in the real editor, previewed, exported, and the downloaded file opened from
 * disk in a browser with the network switched off.
 *
 *   hero-create  editor: new slides → title → heading → star → "when clicked → animate"
 *                → theme → Preview → Export → Download
 *   hero-file    the downloaded Launch-Party.html opened via file://, offline
 */
export async function heroCreate(ctx: SceneContext) {
  const { page, context } = await ctx.newPage();
  await page.goto(`${ctx.site}studio/?home`);
  await page.getByTestId('new-slides').waitFor();
  const { rec, hand } = await ctx.record(page, 'hero-create');
  await hand.moveTo(700, 560, 200);
  await hand.wait(900);
  rec.mark('start');

  // 1. A new slide presentation in the Playful style.
  await hand.click(page.getByTestId('new-slides'), { settle: 900 });
  const canvas = page.locator('.ed-stage').first();
  await canvas.waitFor();
  rec.mark('editor');

  // 2. Name the project (it becomes the file name).
  const title = page.getByLabel('Project title');
  await hand.click(title, { dx: 0.3, settle: 150 });
  await page.keyboard.press('ControlOrMeta+a');
  await hand.type('Launch Party', 65);
  await page.keyboard.press('Enter');
  await hand.wait(300);
  rec.mark('titled');

  // 3. A colourful theme background for the slide (before adding text, so new
  //    text picks the theme's "on dark" style automatically).
  await hand.click(page.getByTestId('bg-theme-hero'), { settle: 700 });
  rec.mark('background');

  // 4. A heading: insert, double-click, type.
  await hand.click(page.getByTestId('quick-heading'), { settle: 700 });
  const heading = page.locator('.ed-el').last();
  await hand.click(heading, { dx: 0.35, double: true, settle: 250 });
  await page.keyboard.press('ControlOrMeta+a');
  rec.mark('typing');
  await hand.type("You're invited!", 70);
  await page.keyboard.press('Escape');
  await hand.wait(400);
  rec.mark('typed');

  // 5. A star from the Insert panel, dragged into place and made bigger.
  await hand.click(page.getByTestId('tab-insert'), { settle: 500 });
  await hand.click(page.getByTestId('insert-shape-star'), { settle: 700 });
  rec.mark('star');
  const star = page.locator('.ed-el').last();
  const sb = (await star.boundingBox())!;
  const cb = (await canvas.boundingBox())!;
  await hand.drag({ x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 }, { x: cb.x + cb.width * 0.76, y: cb.y + cb.height * 0.6 }, 800);
  await hand.wait(300);
  const handle = page.locator('.ed-handle-se').first();
  const hb = (await handle.boundingBox())!;
  await hand.drag({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, { x: hb.x + 70, y: hb.y + 70 }, 600);
  await hand.wait(400);
  rec.mark('placed');

  // 6. Behavior: when clicked → animate (spin).
  await hand.click(page.getByTestId('tab-behavior'), { settle: 500 });
  await hand.click(page.getByTestId('add-interaction'), { settle: 1100 });
  rec.mark('triggers');
  await hand.click(page.getByTestId('trigger-click'), { settle: 600 });
  await hand.click(page.getByTestId('add-action'), { settle: 1000 });
  rec.mark('actions');
  await hand.click(page.getByTestId('action-animate'), { settle: 700 });
  const preset = page.getByLabel('Animation', { exact: true });
  await hand.to(preset);
  await hand.wait(250);
  await preset.selectOption('spin');
  await hand.wait(700);
  rec.mark('interaction');

  // 7. Try other looks live (Editorial, Technical), then settle on Playful.
  await hand.click(page.getByTestId('theme-button'), { settle: 900 });
  rec.mark('themes');
  await hand.click(page.getByTestId('theme-editorial'), { settle: 1100 });
  rec.mark('editorial');
  await hand.click(page.getByTestId('theme-technical'), { settle: 1100 });
  rec.mark('technical');
  await hand.click(page.getByTestId('theme-playful'), { settle: 900 });
  rec.mark('themed');
  await hand.click(page.getByTestId('theme-done'), { settle: 600 });

  // 8. Preview: the real playback engine. Click the star.
  await hand.click(page.getByTestId('preview'), { settle: 1300 });
  rec.mark('preview');
  const stage = page.getByTestId('preview-stage');
  const pstar = stage.locator('.ofs-el').last();
  await hand.click(pstar, { settle: 900 });
  await hand.click(pstar, { settle: 900 });
  rec.mark('popped');
  await hand.click(page.getByTestId('close-preview'), { settle: 700 });

  // 9. Export → Download.
  await hand.click(page.getByTestId('export'), { settle: 1400 });
  rec.mark('exportDialog');
  const dialog = page.getByRole('dialog', { name: 'Export' });
  const btn = dialog.getByTestId('download-html');
  await hand.to(btn);
  const [download] = await Promise.all([page.waitForEvent('download'), hand.click(undefined, { settle: 300 })]);
  rec.mark('download');
  const file = path.join(ctx.downloads, download.suggestedFilename());
  await download.saveAs(file);
  await hand.wait(1200);
  rec.mark('end');
  await rec.end();
  await context.close();
  fs.writeFileSync(path.join(ctx.downloads, 'hero-file.txt'), file);

  // 10. The downloaded file, opened from disk, offline.
  const off = await ctx.newPage({ offline: true });
  await off.page.goto(pathToFileURL(file).href);
  await off.page.waitForFunction(() => !!(window as unknown as { __ofs?: unknown }).__ofs);
  const r2 = await ctx.record(off.page, 'hero-file');
  await r2.hand.moveTo(900, 640, 200);
  await r2.hand.wait(1000);
  r2.rec.mark('opened');
  const fstar = off.page.locator('.ofs-el').last();
  await r2.hand.click(fstar, { settle: 900 });
  r2.rec.mark('pop1');
  await r2.hand.click(fstar, { settle: 1000 });
  r2.rec.mark('pop2');
  await r2.hand.wait(600);
  await r2.rec.end();
  await off.context.close();
}
