import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import { SHOWCASES } from '../../../src/showcase/meta';
import { embeddedProject, exportProject, normalise, openExported, studioProject } from '../helpers';

/**
 * Every landing-page showcase is a genuine OneFile. For each one:
 *  1. load the published file (what "Try it" plays) and exercise an interaction,
 *  2. "Open in editor", 3. change an element, 4. Preview it,
 *  5. export through the real Export dialog, 6. open the download from disk
 *     (file://) in an offline browser: no requests, no errors, interactions
 *     still work and the change is there, 7. re-import it and compare.
 */

const el = (page: Page, id: string) => page.locator(`.ofs-el[data-id="${id}"]`);

/** A representative interaction per showcase (works in the published file and in fresh exports). */
const EXERCISE: Record<string, { title: string; run(page: Page): Promise<void> }> = {
  'feed-puff': {
    title: 'el_c_title',
    async run(page) {
      const puff = el(page, 'el_c_puff');
      for (let i = 0; i < 3; i++) await puff.click();
      await expect(page.getByText('Score: 3')).toBeVisible();
      await puff.click({ button: 'right' });
      await expect(page.getByText('Score: 8')).toBeVisible();
      await expect(el(page, 'el_c_meter')).toContainText('8 / 50');
    },
  },
  'before-after': {
    title: 'el_b_title',
    async run(page) {
      await page.getByText('See the change').click();
      const knob = el(page, 'el_b_compare').getByRole('slider');
      await expect(knob).toBeInViewport();
      await expect(knob).toHaveAttribute('aria-valuenow', '45');
      const box = (await el(page, 'el_b_compare').boundingBox())!;
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.45, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.85, y, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => Number(await knob.getAttribute('aria-valuenow'))).toBeGreaterThan(75);
      await expect(el(page, 'el_b_journal')).toContainText('Field journal');
    },
  },
  '3d-explorer': {
    title: 'el_m_title',
    async run(page) {
      await expect(el(page, 'el_m_viewer').locator('canvas')).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Mast camera', exact: true }).click();
      await expect(el(page, 'el_m_info_mast')).toBeVisible();
      await page.getByRole('button', { name: 'Wheels', exact: true }).click();
      await expect(el(page, 'el_m_info_wheels')).toBeVisible();
      await expect(el(page, 'el_m_info_mast')).toBeHidden();
    },
  },
  'tech-explainer': {
    title: 'el_x_title',
    async run(page) {
      await el(page, 'el_x_start').locator('button').click();
      await expect(page.locator('.ofs-nav-count')).toHaveText('2 / 3');
      await expect(el(page, 'el_x_arrow0')).toBeHidden();
      await page.keyboard.press('ArrowRight');
      await expect(el(page, 'el_x_arrow0')).toBeVisible();
      await page.keyboard.press('Space');
      await expect(el(page, 'el_x_arrow1')).toBeVisible();
      await expect(page.locator('.ofs-nav-count')).toHaveText('2 / 3'); // the slide's keys win over navigation
      await page.keyboard.press('r');
      await expect(el(page, 'el_x_arrow0')).toBeHidden();
      // The box's label sits on top of it and has the same "show the note" interaction.
      await el(page, 'el_x_nodet2').click();
      await expect(el(page, 'el_x_call2')).toBeVisible();
    },
  },
  'feature-walkthrough': {
    title: 'el_r_name',
    async run(page) {
      await el(page, 'el_r_start').locator('button').click();
      const video = el(page, 'el_r_video').locator('video');
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.2);
      await el(page, 'el_r_next2').locator('button').click();
      await el(page, 'el_r_chart').locator('.ofs-chart-hit[data-k="6"]').hover();
      await expect(el(page, 'el_r_chart').locator('.ofs-show')).toContainText('5,000 tasks');
      await el(page, 'el_r_next3').locator('button').click();
      // Viewers sort by clicking a column header: ascending, then descending.
      const areas = () => el(page, 'el_r_table').locator('tbody tr td:first-child').allTextContents();
      const sorted = (xs: string[], dir: 1 | -1) => [...xs].sort((x, y) => dir * x.localeCompare(y));
      await el(page, 'el_r_table').locator('th').first().click();
      await expect
        .poll(async () => {
          const xs = await areas();
          return JSON.stringify(xs) === JSON.stringify(sorted(xs, 1));
        })
        .toBe(true);
      await el(page, 'el_r_table').locator('th').first().click();
      await expect
        .poll(async () => {
          const xs = await areas();
          return JSON.stringify(xs) === JSON.stringify(sorted(xs, -1));
        })
        .toBe(true);
    },
  },
  event: {
    title: 'el_e_title',
    async run(page) {
      const cd = el(page, 'el_e_countdown').locator('.ofs-countdown');
      await expect(cd).toHaveAttribute('data-done', 'false');
      const a = Number(await cd.getAttribute('data-remaining'));
      await expect.poll(async () => Number(await cd.getAttribute('data-remaining')), { timeout: 5000 }).toBeLessThan(a);
      expect(a).toBeLessThanOrEqual(7 * 86400);
      await el(page, 'el_e_rsvp').locator('button').click();
      await expect(el(page, 'el_e_thanks')).toBeVisible();
    },
  },
};

/** The event's weekly countdown is "done" for a while each Friday evening: tests run on a pinned Tuesday afternoon. */
async function pinClock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-17T14:00:00Z') });
  await page.clock.resume();
}
test.beforeEach(async ({ page }) => pinClock(page));

for (const s of SHOWCASES) {
  test(`showcase "${s.title}": try it, open in editor, change, preview, export, offline, re-import`, async ({ page, browser }) => {
    test.setTimeout(120_000);
    const ex = EXERCISE[s.id];
    expect(ex, `an exercise for ${s.id}`).toBeTruthy();

    // 1. The published file ("Try it").
    await page.goto(`./showcase/${s.id}.html`);
    await page.waitForFunction(() => !!(window as unknown as { __ofs?: unknown }).__ofs);
    await ex.run(page);

    // 2. Open in editor → an independent copy.
    await page.goto(`./studio/?open=${s.id}`);
    await expect(page.locator('.ed-toolbar')).toBeVisible();
    const opened = await studioProject(page);
    expect((opened.meta as { title: string }).title).toContain(s.title);

    // 3. Change an element.
    const title = page.locator(`.ed-el[data-id="${ex.title}"]`);
    await title.dblclick();
    const edited = `Edited: ${s.title}`;
    await page.locator('textarea.ed-inline-text').fill(edited);
    await page.keyboard.press('Escape');
    await expect(title.locator('.ofs-text-body')).toHaveText(edited);

    // 4. Preview.
    await page.getByTestId('preview').click();
    await expect(page.getByTestId('preview-stage').getByText(edited)).toBeVisible();
    await page.getByTestId('close-preview').click();

    // 5. Export.
    const file = await exportProject(page, `showcase-${s.id}.html`);
    const exported = embeddedProject(file);
    expect(normalise(exported)).toEqual(normalise(await studioProject(page)));

    // 6. Offline, from disk.
    const off = await openExported(browser, file, { setup: pinClock });
    await expect(off.page.getByText(edited)).toBeVisible();
    await ex.run(off.page);
    expect(off.requests).toEqual([]);
    expect(off.errors).toEqual([]);
    await off.close();

    // 7. Re-import into the editor.
    await page.goto('./studio/?home');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('open-file').click()]);
    await chooser.setFiles(file);
    await expect(page.locator('.ed-toolbar')).toBeVisible();
    expect(normalise(await studioProject(page))).toEqual(normalise(exported));
    await expect(page.locator(`.ed-el[data-id="${ex.title}"] .ofs-text-body`)).toHaveText(edited);
    fs.rmSync(file, { force: true });
  });
}
