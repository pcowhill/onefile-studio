import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectImagesLoaded, exportProject, importIntoStudio, openExported, openStudio, studioProject } from './helpers';

type El = { id: string; type: string; x: number; y: number; w: number; h: number; props: Record<string, unknown> };
async function elements(page: Page): Promise<El[]> {
  const p = (await studioProject(page)) as unknown as { pages: Array<{ elements: El[] }> };
  return p.pages.flatMap((pg) => pg.elements);
}

test('add, edit, move, resize, delete with undo/redo', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('quick-heading').click();
  const el = page.locator('.ed-el').first();
  await expect(el).toBeVisible();
  expect(await elements(page)).toHaveLength(1);

  // Inline text editing
  await el.dblclick();
  const ta = page.locator('textarea.ed-inline-text');
  await expect(ta).toBeVisible();
  await ta.fill('Hello world');
  await page.keyboard.press('Escape');
  await expect(el.locator('.ofs-text-body')).toHaveText('Hello world');

  // Drag to move
  const [before] = await elements(page);
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const [moved] = await elements(page);
  expect(moved.x).toBeGreaterThan(before.x + 100);
  expect(moved.y).toBeGreaterThan(before.y + 40);

  // Resize from the bottom-right handle
  const handle = page.locator('.ed-handle-se');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 80, hb.y + 40, { steps: 6 });
  await page.mouse.up();
  const [resized] = await elements(page);
  expect(resized.w).toBeGreaterThan(moved.w + 60);

  // Undo / redo
  await page.keyboard.press('Control+z');
  expect((await elements(page))[0].w).toBe(moved.w);
  await page.keyboard.press('Control+z');
  expect((await elements(page))[0].x).toBe(before.x);
  await page.keyboard.press('Control+Shift+z');
  expect((await elements(page))[0].x).toBe(moved.x);
  await page.getByTestId('redo').click();
  expect((await elements(page))[0].w).toBe(resized.w);

  // Keyboard nudge, duplicate and delete
  await page.keyboard.press('Shift+ArrowRight');
  expect((await elements(page))[0].x).toBe(resized.x + 10);
  await page.keyboard.press('Control+d');
  expect(await elements(page)).toHaveLength(2);
  await page.keyboard.press('Delete');
  expect(await elements(page)).toHaveLength(1);
  await page.getByTestId('undo').click();
  expect(await elements(page)).toHaveLength(2);
});

test('custom context menu on elements only', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('quick-shape-rect').click();
  const el = page.locator('.ed-el').first();
  await el.click({ button: 'right' });
  const menu = page.locator('.ed-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Add interaction/ })).toBeVisible();
  await menu.getByRole('menuitem', { name: /Duplicate/ }).click();
  await expect(menu).toBeHidden();
  expect(await elements(page)).toHaveLength(2);
  // Bring to front / send backward via the menu
  await page
    .locator('.ed-el')
    .first()
    .click({ button: 'right', position: { x: 4, y: 4 } });
  await page.getByRole('menuitem', { name: /Bring to front/ }).click();
  // Add interaction opens the trigger picker
  await page.locator('.ed-el').last().click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Add interaction/ }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a trigger' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'When…' })).toBeVisible();
  await page.keyboard.press('Escape');
  // Outside editor surfaces the native menu is not overridden.
  const prevented = await page.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.querySelector('.ed-toolbar')!.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test('build left- and right-click interactions with a variable, preview and export', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-score').click();
  await page.getByTestId('insert-shape-star').click();
  // Star is selected; add a click interaction that adds 1.
  await page.getByTestId('tab-behavior').click();
  await page.getByTestId('add-interaction').click();
  await page.getByTestId('trigger-click').click();
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-varAdd').click();
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-animate').click();
  // And a right-click interaction that subtracts 1.
  await page.getByTestId('add-interaction').click();
  await page.getByTestId('trigger-rightclick').click();
  await page.locator('[data-testid=interaction]').nth(1).getByTestId('add-action').click();
  await page.getByTestId('action-varSubtract').click();
  await expect(page.locator('[data-testid=interaction]')).toHaveCount(2);

  const star = (await elements(page)).find((e) => e.type === 'shape')!;
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  const s = stage.locator(`.ofs-el[data-id="${star.id}"]`);
  for (let i = 0; i < 3; i++) await s.click();
  await expect(stage.getByText('Score: 3')).toBeVisible();
  await s.click({ button: 'right' });
  await expect(stage.getByText('Score: 2')).toBeVisible();
  await page.getByTestId('close-preview').click();

  const file = await exportProject(page, 'built-in-editor.html');
  const ex = await openExported(browser, file);
  const es = ex.page.locator(`.ofs-el[data-id="${star.id}"]`);
  await es.click();
  await es.click();
  await es.click({ button: 'right' });
  await expect(ex.page.getByText('Score: 1')).toBeVisible();
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();
});

test('scrolling webpage: sections, templates and components', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-page').click();
  await expect(page.locator('.ed-section-frame')).toHaveCount(1);
  await page.getByTestId('add-page').click();
  await page.getByRole('button', { name: 'Hero' }).click();
  await expect(page.locator('.ed-section-frame')).toHaveCount(2);
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-scrollText').click();
  await page.getByTestId('insert-beforeAfter').click();
  await page.getByTestId('insert-gallery').click();
  const els = await elements(page);
  expect(els.map((e) => e.type)).toEqual(expect.arrayContaining(['scrollText', 'beforeAfter', 'gallery', 'navButton']));
  const file = await exportProject(page, 'webpage.html');
  const ex = await openExported(browser, file);
  await expect(ex.page.locator('.ofs-section')).toHaveCount(2);
  await expectImagesLoaded(ex.page);
  const gal = ex.page.locator('.ofs-gallery');
  await gal.scrollIntoViewIfNeeded();
  await gal.click();
  await expect(gal).toHaveAttribute('data-index', '1');
  expect(ex.requests).toEqual([]);
  await ex.close();
});

test('uploaded images are embedded, optimised on request, and reimported', async ({ page, browser }) => {
  await openStudio(page);
  // A real photo-sized PNG: a screenshot of the start screen.
  const png = await page.screenshot({ fullPage: false });
  await page.getByTestId('new-slides').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('quick-image').click()]);
  await chooser.setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.ed-el img')).toBeVisible();
  const p0 = (await studioProject(page)) as unknown as { assets: Record<string, { data: string; bytes: number }> };
  const [asset] = Object.values(p0.assets);
  expect(asset.data.startsWith('data:image/png;base64,')).toBe(true);

  const file = await exportProject(page, 'photo-optimised.html', 'optimized');
  const ex = await openExported(browser, file);
  await expectImagesLoaded(ex.page);
  const src = await ex.page.locator('img').first().getAttribute('src');
  expect(src!.startsWith('data:image/')).toBe(true);
  expect(ex.requests).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  const p1 = (await studioProject(page)) as unknown as { assets: Record<string, { data: string; bytes: number }> };
  const [back] = Object.values(p1.assets);
  expect(back.bytes).toBeLessThan(asset.bytes);
  await expect(page.locator('.ed-el img')).toBeVisible();
});

test('drafts are saved locally and reopen after a reload', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('quick-heading').click();
  await page.getByLabel('Project title').fill('My saved draft');
  await expect(page.locator('.ed-save')).toHaveText(/Saved/);
  await page.goto('./');
  await expect(page.getByLabel('Project title')).toHaveValue('My saved draft');
  expect(await elements(page)).toHaveLength(1);
  // It is listed on the start screen too.
  await page.locator('.ed-home').click();
  await expect(page.getByText('My saved draft')).toBeVisible();
});
