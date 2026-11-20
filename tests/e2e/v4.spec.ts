import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { embeddedProject, exportProject, importIntoStudio, normalise, openExported, openStudio, paintedFraction, studioProject } from './helpers';
import { makePng } from './png';

/**
 * v0.4 — Interaction & Exploration. Every feature is built or opened in the
 * real editor, exported through the real dialog, opened from disk (file://)
 * in an OFFLINE browser, exercised, checked for zero network requests and
 * script errors, then re-imported.
 */

const el = (p: Page, id: string) => p.locator(`.ofs-el[data-id="${id}"]`);
const ROVER = path.resolve('src/examples/media/rover.glb');

async function openExample(page: Page, id: string) {
  await openStudio(page);
  await page.getByTestId(`example-${id}`).click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
}

/** The address a new tab was opened at (offline it ends on an error page, so read its first request). */
async function popupTarget(popup: Page): Promise<string> {
  const first = popup.url();
  if (first.startsWith('http')) return first;
  const req = await popup.waitForEvent('request', { timeout: 3000 }).catch(() => null);
  if (req) return req.url();
  // Already failed: the navigation entry still records where it was going.
  return popup.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.name ?? location.href);
}

test('Insert → Image creates a placeholder, then library / upload / replace keep the element', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  let opened = false;
  page.on('filechooser', () => (opened = true));
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-image').click();
  await page.waitForTimeout(400);
  expect(opened).toBe(false); // no OS picker
  const picker = page.getByTestId('image-picker');
  await expect(picker).toBeVisible();
  await expect(picker).toContainText('No pictures in this project yet');
  await expect(page.locator('.ed-el .ofs-image-empty')).toContainText('Add an image');
  let proj = await studioProject(page);
  const pg = () => (proj.pages as Array<{ elements: Array<Record<string, unknown>> }>)[0];
  expect(pg().elements).toHaveLength(1);
  expect((pg().elements[0].props as Record<string, unknown>).assetId).toBe('');

  // Upload from the inspector.
  page.removeAllListeners('filechooser');
  const red = makePng(400, 200, () => [230, 40, 40]);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-image').click()]);
  await chooser.setFiles({ name: 'red.png', mimeType: 'image/png', buffer: red });
  await expect(page.locator('.ed-el .ofs-image img')).toHaveCount(1);
  proj = await studioProject(page);
  const placed = pg().elements[0];
  expect(Number(placed.w) / Number(placed.h)).toBeCloseTo(2, 1); // took the picture's shape

  // A second picture via the Media panel, then "Library" in the inspector replaces it in place.
  await page.getByTestId('tab-images').click();
  const blue = makePng(300, 300, () => [30, 60, 230]);
  const [c2] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('upload-images').click()]);
  await c2.setFiles({ name: 'blue.png', mimeType: 'image/png', buffer: blue });
  await page.locator('.ed-el').first().click();
  await page.getByTestId('library-image').click();
  await page.locator('.ed-lib-item').nth(1).click();
  proj = await studioProject(page);
  const replaced = pg().elements[0];
  expect({ x: replaced.x, y: replaced.y, w: replaced.w, h: replaced.h }).toEqual({ x: placed.x, y: placed.y, w: placed.w, h: placed.h });
  const assets = proj.assets as Record<string, { name: string }>;
  expect(assets[(replaced.props as { assetId: string }).assetId].name).toBe('blue.png');

  // Undo goes back to the first picture.
  await page.keyboard.press('Control+z');
  proj = await studioProject(page);
  expect(assets[(pg().elements[0].props as { assetId: string }).assetId]?.name).toBe('red.png');

  // Export and reopen offline.
  const file = await exportProject(page, 'v4-image.html');
  const ex = await openExported(browser, file);
  await expect(ex.page.locator('.ofs-image img')).toHaveCount(1);
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();
});

test('Keyboard: a slide-level key rule built in the UI works in Preview and offline exports', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByRole('button', { name: 'Shape', exact: true }).first().click();
  await page.getByTestId('tab-behavior').click();
  await page.getByText('Hidden when the page opens').click();
  await page.getByTestId('canvas').click({ position: { x: 12, y: 12 } }); // deselect → slide behavior
  await expect(page.getByTestId('page-behavior')).toBeVisible();
  await page.getByTestId('add-interaction').click();
  await page.getByTestId('trigger-key').click();
  await expect(page.getByTestId('key-picker')).toContainText('Press a key');
  await page.keyboard.press('Shift+K');
  await expect(page.getByTestId('key-current')).toContainText('Shift');
  await expect(page.getByTestId('interaction')).toContainText('Shift + K is pressed');
  // The editor's own shortcuts did not run while capturing (the shape is still there).
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-show').click();
  await page.locator('.ed-elpick-btn').click();
  await page.locator('.ed-elpick-menu [role="option"]').first().click();
  // A second rule on Space replaces "next slide" on this slide: the editor says so.
  await page.getByTestId('add-interaction').click();
  await page.getByTestId('trigger-key').click();
  await page.keyboard.press('Space');
  await expect(page.locator('.ed-keypick-note').first()).toContainText('normally goes to the next slide');

  const proj = await studioProject(page);
  const ixs = (proj.pages as Array<{ interactions?: Array<{ trigger: string; options: unknown }> }>)[0].interactions!;
  expect(ixs.map((i) => [i.trigger, i.options])).toEqual([
    ['key', { key: 'k', shift: true }],
    ['key', { key: 'Space' }],
  ]);

  // Preview.
  await page.getByTestId('preview').click();
  const shape = page.locator('.ed-preview .ofs-el-shape');
  await expect(shape).toBeHidden();
  await page.keyboard.press('k'); // without Shift: nothing
  await expect(shape).toBeHidden();
  await page.keyboard.press('Shift+K');
  await expect(shape).toBeVisible();
  await page.keyboard.press('Escape');

  const file = await exportProject(page, 'v4-keys.html');
  const ex = await openExported(browser, file);
  const s = ex.page.locator('.ofs-el-shape');
  await expect(s).toBeHidden();
  // Typing in a field never triggers.
  await ex.page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 'probe';
    document.body.appendChild(i);
  });
  await ex.page.locator('#probe').press('Shift+K');
  await expect(s).toBeHidden();
  await ex.page.locator('#probe').evaluate((i) => (i as HTMLInputElement).blur());
  await ex.page.keyboard.press('Shift+K');
  await expect(s).toBeVisible();
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  expect(normalise(await studioProject(page))).toEqual(normalise(embeddedProject(file)));
});

test('Open link: the Link button preset opens safe links (new tab) and refuses unsafe ones', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-link-button').click();
  await expect(page.getByTestId('quick-openLink')).toHaveAttribute('aria-checked', 'true');
  const address = page.getByLabel('Link address');
  await address.fill('javascript:alert(1)');
  await address.blur();
  await expect(page.getByTestId('link-problem')).toContainText('not allowed');
  await address.fill('example.com/handbook');
  await expect(page.getByTestId('link-problem')).toHaveCount(0);

  const file = await exportProject(page, 'v4-link.html');
  // Tamper with the exported file: an unsafe link must be dropped on import and never opened.
  const ex = await openExported(browser, file);
  // Offline, the new tab cannot load — but it is opened, at the right address, without access to this page.
  const [popup] = await Promise.all([ex.page.context().waitForEvent('page'), ex.page.locator('.ofs-el-button button').click()]);
  expect(await popupTarget(popup)).toBe('https://example.com/handbook');
  expect(await popup.evaluate(() => window.opener).catch(() => null)).toBeNull(); // noopener
  expect(ex.errors).toEqual([]);
  await ex.close();

  const html = fs.readFileSync(file, 'utf8').replace('example.com/handbook', 'javascript:alert(document.domain)');
  const evil = file.replace('.html', '-tampered.html');
  fs.writeFileSync(evil, html);
  const ex2 = await openExported(browser, evil);
  let opened = false;
  ex2.page.context().on('page', () => (opened = true));
  ex2.page.on('dialog', () => (opened = true));
  await ex2.page.locator('.ofs-el-button button').click();
  await ex2.page.waitForTimeout(400);
  expect(opened).toBe(false);
  await ex2.close();

  await importIntoStudio(page, evil);
  const p = await studioProject(page);
  const btn = (p.pages as Array<{ elements: Array<{ interactions: Array<{ actions: Array<{ params: { url: string } }> }> }> }>)[0].elements[0];
  expect(btn.interactions[0].actions[0].params.url).toBe('');
});

/** Drags with real mouse events in small steps; returns the wrapper's transform mid-drag. */
async function drag(p: Page, target: Locator, from: { x: number; y: number }, dx: number, dy: number) {
  const box = (await target.boundingBox())!;
  const sx = box.x + from.x * box.width;
  const sy = box.y + from.y * box.height;
  await p.mouse.move(sx, sy);
  await p.mouse.down();
  let mid = '';
  for (let i = 1; i <= 20; i++) {
    await p.mouse.move(sx + (dx * i) / 20, sy + (dy * i) / 20);
    await p.waitForTimeout(16);
    if (i === 14) mid = await target.evaluate((n) => (n as HTMLElement).style.transform);
  }
  await p.mouse.up();
  return mid;
}
const angleOf = (t: string) => Number(/rotate\((-?[\d.]+)deg\)/.exec(t)?.[1] ?? 0);

test('Example: interactive technical explainer (keys, slide triggers, floaty + weighted drag, links) offline', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await openExample(page, 'explainer');
  await expect(page.getByTestId('theme-button')).toContainText('Technical');
  const before = await studioProject(page);
  const file = await exportProject(page, 'v4-explainer.html');
  expect(normalise(embeddedProject(file))).toEqual(normalise(before));
  // No 3D model → no 3D viewer code in the file.
  expect(fs.readFileSync(file, 'utf8')).not.toContain('__ofsModel3d=');

  const ex = await openExported(browser, file);
  const p = ex.page;
  const vars = () =>
    p.evaluate(() => (window as unknown as { __ofs: { player: { vars: { snapshot(): Record<string, number> } } } }).__ofs.player.vars.snapshot());
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 3');
  await p.keyboard.press('ArrowRight'); // built-in navigation on slide 1
  await expect(p.locator('.ofs-nav-count')).toHaveText('2 / 3');
  await expect(el(p, 'el_x_arrow0')).toBeHidden();
  await p.keyboard.press('ArrowRight'); // the slide's own rule takes over
  await expect(el(p, 'el_x_arrow0')).toBeVisible();
  await expect(el(p, 'el_x_call1')).toBeVisible();
  await expect(p.locator('.ofs-nav-count')).toHaveText('2 / 3');
  expect((await vars()).var_step).toBe(1);
  await p.keyboard.press('r');
  await expect(el(p, 'el_x_arrow0')).toBeHidden();
  for (let i = 0; i < 4; i++) await p.keyboard.press(' ');
  await expect(el(p, 'el_x_arrow3')).toBeVisible();
  expect((await vars()).var_step).toBe(4);
  // Clicking a box toggles its note.
  await el(p, 'el_x_nodet2').click(); // the label in the middle of the box
  await expect(el(p, 'el_x_call2')).toBeVisible();

  // Floaty: tilts while dragging, settles back to its angle, and is not saved anywhere.
  const token = el(p, 'el_x_packet');
  const startLeft = await token.evaluate((n) => (n as HTMLElement).style.left);
  const mid = await drag(p, token, { x: 0.5, y: 0.5 }, 260, 0);
  expect(Math.abs(angleOf(mid))).toBeGreaterThan(1);
  await p.waitForTimeout(1600);
  expect(Math.abs(angleOf(await token.evaluate((n) => (n as HTMLElement).style.transform)))).toBeLessThan(0.5);
  expect(await token.evaluate((n) => (n as HTMLElement).style.left)).not.toBe(startLeft);

  // Slide 3: the delay trigger, number keys, weighted drag that keeps its final angle.
  await p.keyboard.press(' ');
  await expect(p.locator('.ofs-nav-count')).toHaveText('3 / 3');
  await expect(el(p, 'el_x_tip')).toBeHidden();
  await expect(el(p, 'el_x_tip')).toBeVisible({ timeout: 5000 });
  await p.keyboard.press('2');
  await expect(el(p, 'el_x_cardb1')).toBeVisible();
  const sticky = el(p, 'el_x_sticky1');
  const a0 = angleOf(await sticky.evaluate((n) => (n as HTMLElement).style.transform));
  await drag(p, sticky, { x: 0.92, y: 0.15 }, 0, 160); // grab a corner, pull down
  await p.waitForTimeout(1800);
  const a1 = angleOf(await sticky.evaluate((n) => (n as HTMLElement).style.transform));
  expect(Math.abs(a1 - a0)).toBeGreaterThan(5);
  await p.waitForTimeout(600);
  expect(angleOf(await sticky.evaluate((n) => (n as HTMLElement).style.transform))).toBeCloseTo(a1, 0); // no snapping back

  // Project-wide key and links.
  await p.keyboard.press('h');
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 3');
  const [popup] = await Promise.all([p.context().waitForEvent('page'), el(p, 'el_x_docs').locator('button').click()]);
  expect(await popupTarget(popup)).toBe('https://example.com/relay/docs');
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  expect(normalise(await studioProject(page))).toEqual(normalise(embeddedProject(file)));
});

test('Example: interactive 3D explorer renders the model offline (pixels), orbits, zooms, resets and re-imports', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await openExample(page, 'explorer');
  // The editor shows a rendered still of the model (shared renderer).
  const poster = page.locator('.ed-el[data-id="el_m_viewer"] .ofs-model-poster');
  await expect(poster).toHaveAttribute('src', /^data:image\/png/, { timeout: 20_000 });
  expect(await paintedFraction(page, page.locator('.ed-el[data-id="el_m_viewer"]'))).toBeGreaterThan(0.04);

  const before = await studioProject(page);
  const file = await exportProject(page, 'v4-explorer.html');
  const html = fs.readFileSync(file, 'utf8');
  expect(html).toContain('__ofsModel3d=');
  expect(normalise(embeddedProject(file))).toEqual(normalise(before));

  const ex = await openExported(browser, file);
  const p = ex.page;
  const viewer = el(p, 'el_m_viewer');
  await expect(viewer.locator('canvas')).toHaveCount(1);
  await expect(viewer.locator('.ofs-model-loading')).toBeHidden({ timeout: 20_000 });
  expect(await p.evaluate(() => !!document.querySelector('canvas')?.getContext)).toBe(true);
  await p.waitForTimeout(500);
  const painted = await paintedFraction(p, viewer);
  expect(painted).toBeGreaterThan(0.04); // the rover really rendered (not an empty panel)

  // Stop the auto-spin, then orbit with the mouse: the picture changes but the element does not move.
  await p.keyboard.press('s');
  await p.waitForTimeout(300);
  const box = (await viewer.boundingBox())!;
  const left = await viewer.evaluate((n) => (n as HTMLElement).style.left);
  const shot1 = await viewer.screenshot();
  await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(box.x + box.width * 0.5 + i * 18, box.y + box.height * 0.5);
  await p.mouse.up();
  await p.waitForTimeout(600);
  const shot2 = await viewer.screenshot();
  expect(shot2.equals(shot1)).toBe(false);
  expect(await viewer.evaluate((n) => (n as HTMLElement).style.left)).toBe(left);

  // Zoom with the overlay button, then a part button flies the camera and shows its note.
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await p.waitForTimeout(600);
  expect((await viewer.screenshot()).equals(shot2)).toBe(false);
  await el(p, 'el_m_btn_solar').locator('button').click();
  await expect(el(p, 'el_m_info_solar')).toBeVisible();
  await p.waitForTimeout(1000);
  const top = await viewer.screenshot();
  await el(p, 'el_m_reset').locator('button').click();
  await expect(el(p, 'el_m_info_solar')).toBeHidden();
  await p.waitForTimeout(1000);
  expect((await viewer.screenshot()).equals(top)).toBe(false);

  // Slide 2: a second viewer with dramatic lighting; the first viewer's GPU resources are released.
  await p.keyboard.press('ArrowRight');
  await expect(p.locator('.ofs-nav-count')).toHaveText('2 / 2');
  await expect(el(p, 'el_m_viewer2').locator('.ofs-model-loading')).toBeHidden({ timeout: 20_000 });
  await expect(p.locator('canvas')).toHaveCount(1);
  await p.waitForTimeout(400);
  expect(await paintedFraction(p, el(p, 'el_m_viewer2'))).toBeGreaterThan(0.03);
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  expect(normalise(await studioProject(page))).toEqual(normalise(embeddedProject(file)));
});

test('3D: insert a model element, upload a GLB, Preview it; broken files get a helpful message', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('new-page').click();
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-model').click();
  await expect(page.locator('.ed-el .ofs-model-msg')).toContainText('Add a 3D model');
  const [bad] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-model').click()]);
  await bad.setFiles({ name: 'broken.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('definitely not a model') });
  await expect(page.locator('.ed-toast').last()).toContainText('not a binary glTF');
  const [good] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('choose-model').click()]);
  await good.setFiles(ROVER);
  // Inspecting a 650 KB model can take a while when the machine is busy.
  await expect(page.getByTestId('chosen-model')).toContainText('rover.glb', { timeout: 30_000 });
  await expect(page.locator('.ed-el .ofs-model-poster')).toHaveAttribute('src', /^data:image\/png/, { timeout: 20_000 });
  // Editor gestures move the element (the model itself does not orbit in the editor).
  const before = await studioProject(page);
  const elx = (proj: Record<string, unknown>) => Number((proj.pages as Array<{ elements: Array<{ x: number }> }>)[0].elements[0].x);
  const target = page.locator('.ed-el').first();
  const b = (await target.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(elx(await studioProject(page))).toBeGreaterThan(elx(before) + 20);
  // Preview runs the live viewer.
  await page.getByTestId('preview').click();
  const live = page.locator('.ed-preview .ofs-el-model');
  await expect(live.locator('canvas')).toHaveCount(1);
  await expect(live.locator('.ofs-model-loading')).toBeHidden({ timeout: 20_000 });
  await page.waitForTimeout(400);
  expect(await paintedFraction(page, live)).toBeGreaterThan(0.04);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ed-preview')).toHaveCount(0);
});
