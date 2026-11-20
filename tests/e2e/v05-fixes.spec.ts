import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { exportProject, openExported, openStudio } from './helpers';

/**
 * v0.5 regression checks for the three reported defects:
 * 3D zoom buttons, the first slide's selection ring, and Puff's artwork.
 */

async function openExample(page: Page, id: string) {
  await openStudio(page);
  await page.getByTestId(`example-${id}`).click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
}

/**
 * Fraction of the viewer covered by the model: pixels with a dark channel (the
 * light backdrop gradient never has one). The overlay buttons (bottom) are skipped.
 */
async function modelCoverage(page: Page, target: Locator): Promise<number> {
  const shot = (await target.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = Math.floor(img.height * 0.8);
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (Math.min(data[i], data[i + 1], data[i + 2]) < 150) n++;
    return n / (data.length / 4);
  }, shot);
}

/** Zoom in → the model covers more of the viewer; zoom out → less; Reset → back to the start. */
async function checkZoom(p: Page, viewer: Locator) {
  await expect(viewer.locator('.ofs-model-loading')).toBeHidden({ timeout: 20_000 });
  await p.waitForTimeout(600);
  const start = await modelCoverage(p, viewer);
  expect(start).toBeGreaterThan(0.02);
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await p.waitForTimeout(800);
  const bigger = await modelCoverage(p, viewer);
  expect(bigger).toBeGreaterThan(start * 1.3);
  for (let i = 0; i < 5; i++) await viewer.getByRole('button', { name: 'Zoom out' }).click();
  await p.waitForTimeout(800);
  const smaller = await modelCoverage(p, viewer);
  expect(smaller).toBeLessThan(start * 0.7);
  await viewer.getByRole('button', { name: 'Reset view' }).click();
  await p.waitForTimeout(1100);
  const reset = await modelCoverage(p, viewer);
  expect(Math.abs(reset - start)).toBeLessThan(start * 0.15);
  return { start, bigger, smaller, reset };
}

test('3D viewer: + zooms in and − zooms out (Preview and the exported file), Reset view restores', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await openExample(page, 'explorer');
  // Stop the auto-spin so the picture only changes because of zooming.
  await page.getByTestId('preview').click();
  const live = page.locator('.ed-preview .ofs-el[data-id="el_m_viewer"]');
  await expect(live.locator('canvas')).toHaveCount(1);
  await page.keyboard.press('s');
  await checkZoom(page, live);
  await page.keyboard.press('Escape');

  const file = await exportProject(page, 'v05-zoom.html');
  const ex = await openExported(browser, file);
  const viewer = ex.page.locator('.ofs-el[data-id="el_m_viewer"]');
  await ex.page.keyboard.press('s');
  await checkZoom(ex.page, viewer);
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();
});

/** True when every side of the element's outline (box-shadow ring) lies inside the scroll box. */
async function ringInside(list: Locator, item: Locator) {
  return list.evaluate(
    (l, btn) => {
      const a = l.getBoundingClientRect();
      const b = (btn as HTMLElement).getBoundingClientRect();
      const ring = 3; // the selected ring is a 3px box-shadow outside the button
      const cs = getComputedStyle(l);
      const top = a.top + parseFloat(cs.borderTopWidth);
      return b.top - ring >= top - 0.01 && b.left - ring >= a.left - 0.01 && b.right + ring <= a.right + 0.01;
    },
    await item.elementHandle(),
  );
}

test('Slides panel: the selected first slide shows its whole outline; later slides and scrolling still work', async ({ page }) => {
  await openExample(page, 'release');
  const list = page.locator('.ed-pages');
  const btn = (i: number) => page.locator('.ed-page-item').nth(i).locator('.ed-page-btn');
  await btn(0).click();
  await expect(page.locator('.ed-page-item').nth(0)).toHaveClass(/is-on/);
  expect(await ringInside(list, btn(0))).toBe(true);
  // The ring is drawn: the pixels just above the first thumbnail are the brand colour, not clipped background.
  const box = (await btn(0).boundingBox())!;
  const shot = await page.screenshot({ clip: { x: box.x + box.width / 2 - 20, y: box.y - 3, width: 40, height: 2 } });
  const purple = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i + 1] < 120 && d[i] < 150) n++;
    return n / (d.length / 4);
  }, shot.toString('base64'));
  expect(purple).toBeGreaterThan(0.8);
  await page.screenshot({ path: 'test-results/v05-first-slide-ring.png', clip: { x: 0, y: 40, width: 420, height: 360 } });

  // Middle and last slides keep their outline too (scrolled into view).
  for (const i of [2, 4]) {
    await btn(i).scrollIntoViewIfNeeded();
    await btn(i).click();
    await expect(page.locator('.ed-page-item').nth(i)).toHaveClass(/is-on/);
    await expect(page.locator('.ed-page-btn[aria-current="true"]')).toHaveCount(1);
  }
  // Scroll back to the top: the first slide's ring area is not clipped there either.
  await list.evaluate((n) => (n.scrollTop = 0));
  await btn(0).click();
  expect(await ringInside(list, btn(0))).toBe(true);
  // Reordering via the context menu still works.
  await page.locator('.ed-page-item').nth(0).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move down' }).click();
  await expect(page.locator('.ed-page-btn').nth(1)).toHaveAttribute('aria-label', 'Title');
});

test('Feed Puff!: the artwork has a single ring and no stray yellow stroke (editor, Preview, export)', async ({ page, browser }) => {
  await openExample(page, 'clicker');
  const svg = await page.evaluate(() => {
    const p = (window as unknown as { __ofsStudio: { project(): { assets: Record<string, { name: string; data: string }> } } }).__ofsStudio.project();
    const a = Object.values(p.assets).find((x) => /puff/i.test(x.name));
    return a ? atob(a.data.split(',')[1]) : '';
  });
  expect(svg).toContain('<svg');
  expect(svg.match(/#ffd23f/g)?.length).toBe(1);
  const puffEl = page.locator('.ed-el img[src^="data:image/svg"]').first();
  await expect(puffEl).toBeVisible();
  await page.getByTestId('preview').click();
  await expect(page.locator('.ed-preview')).toBeVisible();
  await page.keyboard.press('Escape');
  const file = await exportProject(page, 'v05-puff.html');
  const ex = await openExported(browser, file);
  await expect(ex.page.locator('img[src^="data:image/svg"]').first()).toBeVisible();
  expect(ex.errors).toEqual([]);
  await ex.close();
});
