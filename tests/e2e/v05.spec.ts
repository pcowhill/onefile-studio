import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import { embeddedProject, exportProject, importIntoStudio, normalise, openExported, openStudio, studioProject } from './helpers';
import type { OpenedExport } from './helpers';
import { makePng } from './png';

/**
 * v0.5 — Templates & Guided Creation. Real user workflows through the real
 * UI: the template gallery, every template exported and exercised offline
 * from file:// and re-imported, the quick-start guide, and lessons.
 */

type Proj = {
  id: string;
  meta: { title: string };
  settings: { theme: string };
  pages: Array<{ id: string; elements: Array<{ id: string; type: string; props: Record<string, unknown> }> }>;
  assets: Record<string, { name: string }>;
};
const proj = async (page: Page) => (await studioProject(page)) as unknown as Proj;
const findEl = (p: Proj, id: string) => p.pages.flatMap((pg) => pg.elements).find((e) => e.id === id);
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/v05-${name}.png` });
const rt = (p: Page, id: string) => p.locator(`.ofs-el[data-id="${id}"]`);
const selection = (page: Page) => page.evaluate(() => (window as unknown as { __ofsStudio: { selection(): string[] } }).__ofsStudio.selection());

async function useTemplate(page: Page, id: string) {
  await openStudio(page);
  await page.getByTestId('browse-templates').click();
  await expect(page.getByTestId('template-grid')).toBeVisible();
  await page.getByTestId(`use-template-${id}`).click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
}

/** Double-clicks a text element on the canvas (switching to its slide first) and replaces its text. */
async function editText(page: Page, id: string, value: string) {
  const p = await proj(page);
  const pg = p.pages.findIndex((x) => x.elements.some((e) => e.id === id));
  if (p.pages.length > 1) await page.locator('.ed-page-btn').nth(pg).click();
  const el = page.locator(`.ed-el[data-id="${id}"]`);
  await el.dblclick();
  const ta = page.locator('textarea.ed-inline-text');
  await expect(ta).toBeVisible();
  await ta.fill(value);
  await page.keyboard.press('Escape');
  await expect.poll(async () => findEl(await proj(page), id)?.props.text).toBe(value);
  await page.keyboard.press('Escape'); // deselect, like clicking away
}

async function roundTrip(page: Page, name: string): Promise<{ file: string; ex: OpenedExport; before: Record<string, unknown> }> {
  const before = await studioProject(page);
  const file = await exportProject(page, name);
  // Same project, except that files nothing uses any more are left out of the export.
  const embedded = embeddedProject(file);
  const kept = Object.keys(embedded.assets as object);
  const used = Object.fromEntries(Object.entries(before.assets as object).filter(([k]) => kept.includes(k)));
  expect(normalise(embedded)).toEqual(normalise({ ...before, assets: used }));
  const html = fs.readFileSync(file, 'utf8');
  expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=["']https?:/);
  const ex = await openExported(page.context().browser()!, file);
  return { file, ex, before };
}

async function finish(page: Page, r: { file: string; ex: OpenedExport; before: Record<string, unknown> }) {
  expect(r.ex.requests).toEqual([]);
  expect(r.ex.errors).toEqual([]);
  await r.ex.close();
  await importIntoStudio(page, r.file);
  expect(normalise(await studioProject(page))).toEqual(normalise(embeddedProject(r.file)));
}

// ------------------------------------------------------------------ start screen & gallery
test('start screen: blank projects, templates, Learn, examples and drafts are all reachable', async ({ page }) => {
  await openStudio(page);
  for (const id of ['new-slides', 'new-page', 'browse-templates', 'open-file', 'open-learn', 'start-learning', 'example-clicker'])
    await expect(page.getByTestId(id)).toBeVisible();
  await shot(page, 'start');
  // Category filter.
  await page.getByTestId('browse-templates').click();
  const cards = page.locator('.tg-card');
  await expect(cards).toHaveCount(6);
  await expect(page.locator('.tg-thumb .ofs-page, .tg-thumb .ed-thumb > *').first()).toBeVisible();
  await shot(page, 'gallery');
  await page.getByTestId('tpl-cat-announcements').click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId('template-event')).toBeVisible();
  await page.getByTestId('tpl-cat-presentations').click();
  await expect(cards).toHaveCount(2);
  await page.getByTestId('tpl-cat-all').click();
  await expect(cards).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('template-grid')).toHaveCount(0);
});

test('template Preview plays the real template, switches style, saves nothing, and can be used', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('browse-templates').click();
  await page.getByTestId('preview-template-greeting').click();
  const pv = page.getByTestId('template-preview');
  await expect(pv).toBeVisible();
  // Interactions work in the preview: open the present.
  await pv.locator('.ofs-el[data-id="el_gr_gift"]').click();
  await expect(pv.locator('.ofs-el[data-id="el_gr_message"]')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('preview-theme-technical').click();
  await expect(page.getByTestId('preview-theme-technical')).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'template-preview');
  // Back to the gallery; nothing was saved as a draft.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('template-grid')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.st-recent')).toHaveCount(0);
  // "Use this template" in the chosen style.
  await page.getByTestId('browse-templates').click();
  await page.getByTestId('preview-template-greeting').click();
  await page.getByTestId('preview-theme-editorial').click();
  await page.getByTestId('template-preview-use').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  expect((await proj(page)).settings.theme).toBe('editorial');
  await expect(page.getByTestId('coach')).toBeVisible();
});

// ------------------------------------------------------------------ Workflow A — new user
test('Workflow A: Feature Walkthrough — change the title, replace the screenshot, preview, export (guide ticks itself)', async ({ page }) => {
  test.setTimeout(90_000);
  await useTemplate(page, 'feature-walkthrough');
  const coach = page.getByTestId('coach');
  await expect(coach).toContainText('Customize your Feature Walkthrough');
  await expect(coach).toContainText('0 of 5 done');
  await shot(page, 'guide');
  const first = await proj(page);
  expect(first.meta.title).toMatch(/Smart Filters/);

  await editText(page, 'el_fw_title', 'Dark Mode');
  await expect(page.getByTestId('guide-title')).toHaveAttribute('data-done', 'true');

  // "Show me" selects the screenshot; upload a picture from its inspector.
  await page.getByTestId('guide-screenshot').click();
  await page.getByTestId('coach-show-me').click();
  await expect.poll(() => selection(page)).toEqual(['el_fw_hero_shot']);
  const png = makePng(640, 400, (x) => [20 + (x % 200), 120, 200]);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('.ed-right').getByRole('button', { name: 'Upload', exact: true }).first().click(),
  ]);
  await chooser.setFiles({ name: 'dark-mode.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByTestId('guide-screenshot')).toHaveAttribute('data-done', 'true');
  // The same placeholder appears on two more slides: replace those too, in one step.
  const toast = page.locator('.ed-toast').filter({ hasText: 'other pictures still show' });
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Replace them too' }).click();
  const after = await proj(page);
  const newId = findEl(after, 'el_fw_hero_shot')!.props.assetId as string;
  expect(after.assets[newId].name).toBe('dark-mode.png');
  for (const id of ['el_fw_shot', 'el_fw_tour_shot']) expect(findEl(after, id)!.props.assetId).toBe(newId);
  // Layout and interactions of the replaced pictures are unchanged.
  for (const id of ['el_fw_shot', 'el_fw_tour_shot']) {
    const a = first.pages.flatMap((p) => p.elements).find((e) => e.id === id) as unknown as Record<string, unknown>;
    const b = after.pages.flatMap((p) => p.elements).find((e) => e.id === id) as unknown as Record<string, unknown>;
    expect([b.x, b.y, b.w, b.h]).toEqual([a.x, a.y, a.w, a.h]);
  }

  await editText(page, 'el_fw_explain', 'Dark mode follows your system setting and remembers your choice.');
  await page.getByTestId('preview').click();
  await expect(page.locator('.ed-preview')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('guide-preview')).toHaveAttribute('data-done', 'true');

  const r = await roundTrip(page, 'v05-workflow-a.html');
  await expect(page.getByTestId('coach')).toContainText('All set');
  const p = r.ex.page;
  await expect(rt(p, 'el_fw_title')).toContainText('Dark Mode');
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await expect(p.locator('.ofs-nav-count')).toHaveText('4 / 6');
  await expect(rt(p, 'el_fw_note0')).toBeHidden();
  await rt(p, 'el_fw_marker0').locator('button').click();
  await expect(rt(p, 'el_fw_note0')).toBeVisible();
  await rt(p, 'el_fw_marker1').locator('button').click();
  await expect(rt(p, 'el_fw_note1')).toBeVisible();
  await expect(rt(p, 'el_fw_note0')).toBeHidden();
  await expect.poll(() => p.evaluate(() => [...document.images].filter((i) => i.naturalWidth > 0).length)).toBeGreaterThan(0);
  await finish(page, r);
  expect(findEl(await proj(page), 'el_fw_title')!.props.text).toBe('Dark Mode');

  // The template itself never changed: a fresh copy still has the original title.
  await useTemplate(page, 'feature-walkthrough');
  expect(findEl(await proj(page), 'el_fw_title')!.props.text).toBe('Smart Filters');
  expect((await proj(page)).id).not.toBe(first.id);
});

// ------------------------------------------------------------------ every template, offline
test('Meeting Presentation: agenda links, chart, table and quiz work offline and survive re-import', async ({ page }) => {
  await useTemplate(page, 'meeting');
  await editText(page, 'el_mt_title', 'Team offsite review');
  const r = await roundTrip(page, 'v05-meeting.html');
  const p = r.ex.page;
  await expect(rt(p, 'el_mt_title')).toContainText('Team offsite review');
  await p.keyboard.press('ArrowRight');
  await rt(p, 'el_mt_ag2').locator('button').click();
  await expect(p.locator('.ofs-nav-count')).toHaveText('5 / 8');
  await expect(rt(p, 'el_mt_table').locator('tbody tr')).toHaveCount(4);
  await p.keyboard.press('ArrowLeft');
  await expect(rt(p, 'el_mt_chart').locator('svg')).toBeVisible();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await expect(p.locator('.ofs-nav-count')).toHaveText('7 / 8');
  await rt(p, 'el_mt_quiz').getByText('On-time delivery').click();
  await expect(rt(p, 'el_mt_quiz')).toContainText('Right!');
  await finish(page, r);
});

test('Technical Explainer: click/number-key reveals, Space steps with a variable, R restarts — offline', async ({ page }) => {
  await useTemplate(page, 'technical-explainer');
  const r = await roundTrip(page, 'v05-technical.html');
  const p = r.ex.page;
  await p.keyboard.press('ArrowRight');
  await expect(p.locator('.ofs-nav-count')).toHaveText('2 / 4');
  await expect(rt(p, 'el_tx_call1')).toBeHidden();
  await p.keyboard.press('2');
  await expect(rt(p, 'el_tx_call1')).toBeVisible();
  await rt(p, 'el_tx_node3').locator('button').click();
  await expect(rt(p, 'el_tx_call3')).toBeVisible();
  await expect(rt(p, 'el_tx_call1')).toBeHidden();
  await p.keyboard.press('ArrowRight');
  await expect(p.locator('.ofs-nav-count')).toHaveText('3 / 4');
  await p.keyboard.press('Space');
  await p.keyboard.press('Space');
  await expect(rt(p, 'el_tx_step0')).toBeVisible();
  await expect(rt(p, 'el_tx_step1')).toBeVisible();
  await expect(rt(p, 'el_tx_step2')).toBeHidden();
  await expect(rt(p, 'el_tx_counter')).toContainText('Step 2 of 4');
  await rt(p, 'el_tx_nextstep').locator('button').click();
  await expect(rt(p, 'el_tx_step2')).toBeVisible();
  await p.keyboard.press('r');
  await expect(rt(p, 'el_tx_step0')).toBeHidden();
  await expect(rt(p, 'el_tx_counter')).toContainText('Step 0 of 4');
  await finish(page, r);
});

test('Before & After Story: the slider compares the two pictures and the story panel scrolls — offline', async ({ page }) => {
  await useTemplate(page, 'before-after');
  await editText(page, 'el_ba_title', 'Our kitchen, reimagined');
  const r = await roundTrip(page, 'v05-before-after.html');
  const p = r.ex.page;
  await expect(rt(p, 'el_ba_title')).toContainText('Our kitchen, reimagined');
  const slider = rt(p, 'el_ba_slider');
  await slider.scrollIntoViewIfNeeded();
  await expect(slider.locator('img, image')).toHaveCount(2);
  const box = (await slider.boundingBox())!;
  const a = await slider.screenshot();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 8 });
  await p.mouse.up();
  expect((await slider.screenshot()).equals(a)).toBe(false);
  const scroller = rt(p, 'el_ba_story_scroll').locator('.ofs-scrolltext-body');
  await scroller.scrollIntoViewIfNeeded();
  expect(await scroller.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true);
  await finish(page, r);
});

test('Interactive Greeting: open the present, reveal three wishes, finale — offline', async ({ page }) => {
  await useTemplate(page, 'greeting');
  await editText(page, 'el_gr_name', 'Robin!');
  const r = await roundTrip(page, 'v05-greeting.html');
  const p = r.ex.page;
  await expect(rt(p, 'el_gr_name')).toContainText('Robin!');
  await expect(rt(p, 'el_gr_message')).toBeHidden();
  await rt(p, 'el_gr_gift').click();
  await expect(rt(p, 'el_gr_message')).toBeVisible({ timeout: 5000 });
  await expect(rt(p, 'el_gr_gift_open')).toBeVisible();
  await rt(p, 'el_gr_next').locator('button').click();
  await expect(p.locator('.ofs-nav-count')).toHaveText('2 / 3');
  for (let i = 0; i < 3; i++) {
    await expect(rt(p, 'el_gr_w_done')).toBeHidden();
    await rt(p, `el_gr_star${i}`).click();
    await expect(rt(p, `el_gr_wish${i}`)).toBeVisible();
  }
  await expect(rt(p, 'el_gr_w_done')).toBeVisible();
  await expect(rt(p, 'el_gr_w_count')).toContainText('3 of 3');
  await finish(page, r);
});

// ------------------------------------------------------------------ Workflow C — creative customization
test('Workflow C: Event Announcement — switch style, rename, adjust the countdown, export', async ({ page }) => {
  test.setTimeout(90_000);
  await useTemplate(page, 'event');
  const start = await proj(page);
  const target = findEl(start, 'el_ev_countdown')!.props.target as string;
  const days = (Date.parse(target) - Date.now()) / 86400000;
  expect(days).toBeGreaterThan(20); // the sample date is always in the future
  expect(days).toBeLessThan(29);

  await page.getByTestId('theme-button').click();
  await page.getByTestId('theme-editorial').click();
  await page.getByTestId('theme-done').click();
  expect((await proj(page)).settings.theme).toBe('editorial');
  await expect(page.getByTestId('guide-theme')).toHaveAttribute('data-done', 'true');
  await editText(page, 'el_ev_title', 'Winter Lights Walk');
  await editText(page, 'el_ev_date', 'Friday 15 January · 6:00 pm');

  // Adjust the countdown: a date in the inspector.
  await page.locator('.ed-el[data-id="el_ev_countdown"]').click();
  const date = page.getByTestId('countdown-date');
  await expect(date).toBeVisible();
  const next = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  await date.fill(next);
  await expect.poll(async () => findEl(await proj(page), 'el_ev_countdown')!.props.target).not.toBe(target);
  await expect(page.getByTestId('guide-date')).toHaveAttribute('data-done', 'true');
  await shot(page, 'workflow-c');

  const r = await roundTrip(page, 'v05-event.html');
  const p = r.ex.page;
  await expect(rt(p, 'el_ev_title')).toContainText('Winter Lights Walk');
  const cd = rt(p, 'el_ev_countdown');
  await cd.scrollIntoViewIfNeeded();
  const shown = Number((await cd.locator('.ofs-countdown-value').first().textContent())?.trim());
  expect(shown).toBeGreaterThanOrEqual(38);
  // The RSVP button is a safe mailto link.
  expect(JSON.stringify(embeddedProject(r.file))).toContain('mailto:events@example.com');
  await finish(page, r);
  expect((await proj(page)).settings.theme).toBe('editorial');
});

// ------------------------------------------------------------------ Workflow D — experienced user
test('Workflow D: a blank project never shows guides or lessons', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByTestId('quick-heading').click();
  await page.getByTestId('preview').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('coach')).toHaveCount(0);
  const file = await exportProject(page, 'v05-blank.html');
  const ex = await openExported(browser, file);
  expect(ex.errors).toEqual([]);
  await ex.close();
  // The canvas uses the full height when no coach is docked.
  expect(await page.locator('.ed-canvas').evaluate((n) => getComputedStyle(n).bottom)).toBe('0px');
});

// ------------------------------------------------------------------ Workflow B — learning
test('Workflow B: Beginner lesson 1 in the real editor; the user draft is untouched; progress is remembered', async ({ page }) => {
  test.setTimeout(90_000);
  // An existing user draft.
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('quick-heading').click();
  const mine = await proj(page);
  await page.locator('.ed-home').click();

  await page.getByTestId('open-learn').click();
  await shot(page, 'learn-hub');
  await page.getByTestId('lesson-first-onefile').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  const practice = await proj(page);
  expect(practice.id).not.toBe(mine.id);
  expect(practice.meta.title).toBe('Practice — Your first OneFile');
  const coach = page.getByTestId('coach');
  await expect(coach).toHaveAttribute('data-kind', 'lesson');
  await expect(page.getByTestId('coach-back')).toBeDisabled();
  await page.getByTestId('coach-next').click();

  // Step: add text (the toolbar button is highlighted).
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'text');
  await expect(page.getByTestId('coach-spotlight')).toBeVisible();
  await shot(page, 'lesson-beginner');
  await page.getByTestId('quick-heading').click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  // Type something.
  const textId = (await proj(page)).pages[0].elements[0].id;
  await editText(page, textId, 'Hello from my first OneFile');
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  // Add a shape, then move and resize it.
  await page.getByTestId('quick-shape-rect').click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  const shape = page.locator(`.ed-el[data-id="${(await selection(page))[0]}"]`);
  const b = (await shape.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 80, b.y + b.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  const hb = (await page.locator('.ed-handle-se').boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 60, hb.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  // Preview.
  await page.getByTestId('preview').click();
  await expect(page.locator('.ed-preview')).toContainText('Hello from my first OneFile');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'finish');
  await page.getByTestId('coach-more-lessons').click();

  // Back on the start screen with the Learn hub open; the lesson is completed.
  await expect(page.getByTestId('lesson-first-onefile')).toContainText('completed');
  await page.reload();
  await page.getByTestId('open-learn').click();
  await expect(page.getByTestId('lesson-first-onefile')).toContainText('completed');
  await page.keyboard.press('Escape');
  // Both drafts exist; the user's draft is unchanged.
  await expect(page.locator('.st-draft')).toHaveCount(2);
  await page.locator('.st-draft', { hasText: mine.meta.title }).click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  const reopened = await proj(page);
  expect(reopened.pages[0].elements.map((e) => e.id)).toEqual(mine.pages[0].elements.map((e) => e.id));
});

test('Lesson 2 (make it interactive): a button that reveals the secret, verified in Preview', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('open-learn').click();
  await page.getByTestId('lesson-interactive').click();
  await page.getByTestId('coach-next').click();
  await page.getByTestId('quick-button').click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  await expect(page.getByTestId('coach-spotlight')).toBeVisible();
  await page.getByTestId('quick-show').click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await expect(stage.locator('.ofs-el[data-id="el_l2_secret"]')).toBeHidden();
  await stage.locator('.ofs-button').last().click();
  await expect(stage.locator('.ofs-el[data-id="el_l2_secret"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('coach-next').click();
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'finish');
});

test('Intermediate lesson 4: add, choose and replace a picture, then a Before & After slider', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('open-learn').click();
  await page.getByTestId('lesson-media').click();
  await page.getByTestId('quick-image').click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  await page.locator('.ed-imgpick-item').nth(0).click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  await page.getByTestId('library-image').click();
  await page.locator('.ed-lib-item').nth(2).click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  await expect(page.getByTestId('coach-spotlight')).toBeVisible();
  await shot(page, 'lesson-intermediate');
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-beforeAfter').click();
  await expect(page.getByTestId('coach-success')).toBeVisible();
});

test('Advanced lesson 7: the prepared challenge, “Show me”, and building the key rule in the Behavior tab', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('open-learn').click();
  await page.getByTestId('lesson-challenge').click();
  const p = await proj(page);
  expect(p.pages[0].elements.map((e) => e.id)).toContain('el_l7_chest');
  await page.getByTestId('coach-next').click();
  await page.getByTestId('coach-show-me').click();
  await expect.poll(() => selection(page)).toEqual(['el_l7_key0']);
  await shot(page, 'lesson-advanced');
  // The step is skippable and never traps the learner.
  await expect(page.getByTestId('coach-skip')).toBeVisible();
  await page.getByTestId('coach-skip').click();
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'condition');
});

test('Lesson controls: Back/Next/Skip, minimise, restart (fresh practice project), exit keeps the work; keyboard works', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('open-learn').click();
  // Keyboard: start a lesson from the hub with Enter.
  await page.getByTestId('lesson-motion').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('coach')).toBeVisible();
  const first = await proj(page);
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'entrance');
  // Skip, then Back.
  await page.getByTestId('coach-skip').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'timing');
  await page.getByTestId('coach-back').click();
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'entrance');
  // "Show me" selects the star.
  await page.getByTestId('coach-show-me').click();
  await expect.poll(() => selection(page)).toEqual(['el_l5_star']);
  // Minimise and restore.
  await page.getByTestId('coach-minimise').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(page.locator('.ed-canvas')).toHaveCSS('bottom', '0px');
  await page.getByTestId('coach-pill').click();
  await expect(page.getByTestId('coach')).toBeVisible();
  // Restart = a fresh practice project; the previous one stays a separate draft.
  await page.getByTestId('coach-restart').click();
  const second = await proj(page);
  expect(second.id).not.toBe(first.id);
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'entrance');
  // Exit: the lesson closes, the editor and the practice project stay.
  await page.getByTestId('quick-heading').click();
  await page.getByTestId('coach-close').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  expect((await proj(page)).pages[0].elements.length).toBe(3);
});

test('Lessons work when browser storage is blocked (no progress saved, no errors)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', { get: deny });
  });
  await openStudio(page);
  await page.getByTestId('open-learn').click();
  await page.getByTestId('lesson-share').click();
  await expect(page.getByTestId('coach')).toBeVisible();
  await exportProject(page, 'v05-share-lesson.html');
  await expect(page.getByTestId('coach-success')).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByTestId(i === 3 ? 'coach-skip' : 'coach-next').click();
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'finish');
  await page.getByTestId('coach-more-lessons').click();
  await expect(page.getByTestId('lesson-share')).toContainText('completed');
  expect(errors).toEqual([]);
});

test('Lesson 3: export, then re-import the file — the lesson notices the import', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('open-learn').click();
  await page.getByTestId('lesson-share').click();
  const file = await exportProject(page, 'v05-lesson3.html');
  await expect(page.getByTestId('coach-success')).toBeVisible();
  await page.getByTestId('coach-next').click();
  await page.getByTestId('coach-next').click();
  await page.getByTestId('coach-next').click();
  await expect(page.getByTestId('coach-step')).toHaveAttribute('data-step', 'reimport');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open file' }).click()]);
  await chooser.setFiles(file);
  await expect(page.getByTestId('coach-success')).toBeVisible();
  expect((await proj(page)).meta.title).toBe('Practice — Share your creation');
});
