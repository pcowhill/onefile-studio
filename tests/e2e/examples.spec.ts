import { test, expect } from '@playwright/test';
import { embeddedProject, expectImagesLoaded, exportProject, importIntoStudio, normalise, openExported, openStudio, studioProject } from './helpers';

/**
 * The critical workflow, for each example:
 * open → export via the UI → open the file from disk (file://, offline) →
 * verify interactions, images and zero network requests → import it back →
 * verify structure and behaviour survive the round trip.
 */

test('Example A: interactive presentation survives export → file:// → reimport', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('example-presentation').click();
  await expect(page.locator('.ed-el[data-id="el_p_rocket"]')).toBeVisible();
  const before = await studioProject(page);
  const file = await exportProject(page, 'presentation.html');
  expect(normalise(embeddedProject(file))).toEqual(normalise(before));

  const ex = await openExported(browser, file);
  const p = ex.page;
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 4');
  await expectImagesLoaded(p);
  await p.locator('.ofs-el[data-id="el_p_next1"] button').click();
  await expect(p.locator('.ofs-nav-count')).toHaveText('2 / 4');
  await expect(p.locator('.ofs-el[data-id="el_p_arrow1"]')).toBeVisible();
  await expect(p.locator('.ofs-el[data-id="el_p_arrow1"] .ofs-arrow-head')).toBeVisible();
  await p.keyboard.press('ArrowRight');
  await expect(p.locator('.ofs-nav-count')).toHaveText('3 / 4');
  const idea = p.locator('.ofs-el[data-id="el_p_idea"]');
  await expect(idea).toBeHidden();
  await p.locator('.ofs-el[data-id="el_p_bulb"]').click();
  await expect(idea).toBeVisible();
  await p.locator('.ofs-el[data-id="el_p_bulb"]').click();
  await expect(idea).toBeHidden();
  // Normal browser context menu is untouched where no right-click interaction exists.
  const prevented = await p.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.querySelector('.ofs-el[data-id="el_p_s3title"]')!.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await p.locator('.ofs-nav button[aria-label="Next slide"]').click();
  await expect(p.locator('.ofs-nav-count')).toHaveText('4 / 4');
  await p.locator('.ofs-el[data-id="el_p_restart"] button').click();
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 4');
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  // Round trip back into the editor.
  await importIntoStudio(page, file);
  const after = await studioProject(page);
  expect(normalise(after)).toEqual(normalise(embeddedProject(file)));
  await expect(page.locator('.ed-page-item')).toHaveCount(4);
  // Behaviour survives: Preview runs the same engine.
  await page.locator('.ed-page-item').nth(2).locator('.ed-page-btn').click();
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await expect(stage.locator('.ofs-el[data-id="el_p_idea"]')).toBeHidden();
  await stage.locator('.ofs-el[data-id="el_p_bulb"]').click();
  await expect(stage.locator('.ofs-el[data-id="el_p_idea"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(stage).toHaveCount(0);
});

test('Example B: before & after webpage survives export → file:// → reimport', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('example-before-after').click();
  await expect(page.locator('.ed-section-frame')).toHaveCount(5);
  const file = await exportProject(page, 'before-after.html');

  const ex = await openExported(browser, file);
  const p = ex.page;
  await expect(p.locator('.ofs-section')).toHaveCount(5);
  await expectImagesLoaded(p);

  // Navigation button scrolls the page to the next section.
  await p.locator('.ofs-el[data-id="el_b_go"] button').click();
  await expect.poll(() => p.locator('.ofs-player').evaluate((n) => n.scrollTop)).toBeGreaterThan(300);

  // Before/after: drag the divider.
  const ba = p.locator('.ofs-el[data-id="el_b_compare"] .ofs-ba');
  await ba.scrollIntoViewIfNeeded();
  await expect(ba).toHaveAttribute('data-position', '45');
  const box = (await ba.boundingBox())!;
  await p.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
  await p.mouse.up();
  const pos = Number(await ba.getAttribute('data-position'));
  expect(pos).toBeGreaterThan(15);
  expect(pos).toBeLessThan(25);

  // Scrolling text scrolls independently of the page.
  const body = p.locator('.ofs-el[data-id="el_b_journal"] .ofs-scrolltext-body');
  await body.scrollIntoViewIfNeeded();
  const dims = await body.evaluate((n) => ({ sh: n.scrollHeight, ch: n.clientHeight }));
  expect(dims.sh).toBeGreaterThan(dims.ch + 100);
  const pageTop = await p.locator('.ofs-player').evaluate((n) => n.scrollTop);
  const b = (await body.boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.wheel(0, 250);
  await expect.poll(() => body.evaluate((n) => n.scrollTop)).toBeGreaterThan(50);
  expect(await p.locator('.ofs-player').evaluate((n) => n.scrollTop)).toBe(pageTop);

  // Gallery cycles on click.
  const gal = p.locator('.ofs-el[data-id="el_b_gallery"] .ofs-gallery');
  await gal.scrollIntoViewIfNeeded();
  await expect(gal).toHaveAttribute('data-index', '0');
  await gal.click({ position: { x: 300, y: 150 } });
  await expect(gal).toHaveAttribute('data-index', '1');
  await gal.locator('.ofs-gallery-arrow-next').click();
  await expect(gal).toHaveAttribute('data-index', '2');
  await gal.click({ position: { x: 300, y: 150 } });
  await expect(gal).toHaveAttribute('data-index', '0');

  // Basic responsive viewing: a phone-sized viewport scales the page with no horizontal scroll.
  await p.setViewportSize({ width: 390, height: 800 });
  await expect.poll(() => p.locator('.ofs-player').evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
  const w = await p
    .locator('.ofs-section-inner')
    .first()
    .evaluate((n) => n.getBoundingClientRect().width);
  expect(w).toBeLessThanOrEqual(391);

  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  expect(normalise(await studioProject(page))).toEqual(normalise(embeddedProject(file)));
  await expect(page.locator('.ed-section-frame')).toHaveCount(5);
});

test('Example C: clicker game survives export → file:// → reimport', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('example-clicker').click();
  await expect(page.locator('.ed-el[data-id="el_c_puff"]')).toBeVisible();
  const file = await exportProject(page, 'clicker.html');

  const ex = await openExported(browser, file);
  const p = ex.page;
  await expectImagesLoaded(p);
  const puff = p.locator('.ofs-el[data-id="el_c_puff"]');
  const score = p.locator('.ofs-el[data-id="el_c_score"]');
  const meter = p.locator('.ofs-el[data-id="el_c_meter"]');
  await expect(score).toHaveText('Score: 0');
  for (let i = 0; i < 3; i++) await puff.click();
  await expect(score).toHaveText('Score: 3');
  await puff.click({ button: 'right' });
  await expect(score).toHaveText('Score: 8');
  await expect(meter).toHaveText('8 / 50');
  // The configured right-click suppresses the browser menu on Puff only.
  const prevented = await p.evaluate(() => {
    const test = (id: string) => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.querySelector(`.ofs-el[data-id="${id}"]`)!.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    return { puff: test('el_c_puff'), title: test('el_c_title') };
  });
  expect(prevented).toEqual({ puff: true, title: false });
  await expect(score).toHaveText('Score: 13');
  const win = p.locator('.ofs-el[data-id="el_c_win"]');
  await expect(win).toBeHidden();
  for (let i = 0; i < 8; i++) await puff.click({ button: 'right' });
  await expect(score).toHaveText('Score: 53');
  await expect(win).toBeVisible();
  await p.locator('.ofs-el[data-id="el_c_reset"] button').click();
  await expect(score).toHaveText('Score: 0');
  await expect(win).toBeHidden();
  await expect(meter).toHaveText('0 / 50');
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  const imported = await studioProject(page);
  expect(normalise(imported)).toEqual(normalise(embeddedProject(file)));
  // Re-export the imported project: identical project data.
  const again = await exportProject(page, 'clicker-again.html');
  expect(normalise(embeddedProject(again))).toEqual(normalise(embeddedProject(file)));
  // Preview behaves the same.
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await stage.locator('.ofs-el[data-id="el_c_puff"]').click();
  await stage.locator('.ofs-el[data-id="el_c_puff"]').click({ button: 'right' });
  await expect(stage.locator('.ofs-el[data-id="el_c_score"]')).toHaveText('Score: 6');
});
