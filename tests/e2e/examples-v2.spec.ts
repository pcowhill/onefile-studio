import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { embeddedProject, expectImagesLoaded, exportProject, importIntoStudio, normalise, openExported, openStudio, studioProject } from './helpers';

/**
 * The v0.2 examples, each: open from the start screen → export through the
 * real dialog → open the file from disk (file://) OFFLINE → exercise the new
 * components → zero network requests / errors → reimport → same project.
 */

async function openExample(page: Page, id: string) {
  await openStudio(page);
  await page.getByTestId(`example-${id}`).click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
}

const el = (p: Page, id: string) => p.locator(`.ofs-el[data-id="${id}"]`);

test('Example: interactive knowledge check (quizzes, score, completion)', async ({ page, browser }) => {
  await openExample(page, 'knowledge');
  await expect(page.getByTestId('theme-button')).toContainText('Technical');
  const before = await studioProject(page);
  const file = await exportProject(page, 'knowledge-check.html');
  expect(normalise(embeddedProject(file))).toEqual(normalise(before));

  const ex = await openExported(browser, file);
  const p = ex.page;
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 6');
  await el(p, 'el_q_start').locator('button').click();
  // Explanations reveal on click.
  await expect(el(p, 'el_q_noded1')).toBeHidden();
  await el(p, 'el_q_nodeb1').locator('button').click();
  await expect(el(p, 'el_q_noded1')).toBeVisible();
  await el(p, 'el_q_next2').locator('button').click();

  // Q1: wrong first (no points with first-try-only), retry, then right.
  await expect(p.locator('.ofs-nav-count')).toHaveText('3 / 6');
  const q1 = el(p, 'el_q_quiz1');
  await q1.locator('.ofs-quiz-choice').nth(0).click();
  await expect(q1.locator('.ofs-quiz-feedback')).toContainText('Not quite');
  await q1.locator('.ofs-quiz-retry').click();
  await q1.locator('.ofs-quiz-choice').nth(1).click();
  await expect(q1.locator('.ofs-quiz-feedback')).toContainText('phone book');
  await expect(el(p, 'el_q_score1')).toContainText('Score: 0 / 3');
  await el(p, 'el_q_next3').locator('button').click();
  // Q2 + Q3 right first time.
  await el(p, 'el_q_quiz2').locator('.ofs-quiz-choice').nth(2).click();
  await expect(el(p, 'el_q_score2')).toContainText('Score: 1 / 3');
  await el(p, 'el_q_next4').locator('button').click();
  await el(p, 'el_q_quiz3').locator('.ofs-quiz-choice').nth(0).click();
  await expect(el(p, 'el_q_score3')).toContainText('Score: 2 / 3');
  await expect(el(p, 'el_q_ring3').locator('.ofs-progress')).toHaveAttribute('aria-valuenow', '67');
  await el(p, 'el_q_next5').locator('button').click();

  // Completion: conditional message.
  await expect(el(p, 'el_q_final')).toContainText('Your score: 2 out of 3');
  await el(p, 'el_q_reveal').locator('button').click();
  await expect(el(p, 'el_q_good')).toBeVisible();
  await expect(el(p, 'el_q_perfect')).toBeHidden();
  // Going back keeps answered state for the session.
  await p.keyboard.press('ArrowLeft');
  await expect(el(p, 'el_q_quiz3').locator('.ofs-quiz')).toHaveClass(/ofs-quiz-answered/);
  await p.keyboard.press('ArrowRight');
  // Try again resets score, quizzes and returns to the start.
  await el(p, 'el_q_again').locator('button').click();
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 6');
  expect(await p.evaluate(() => (window as unknown as { __ofs: { player: { vars: { get(id: string): number } } } }).__ofs.player.vars.get('var_score'))).toBe(
    0,
  );
  for (let i = 0; i < 2; i++) await p.keyboard.press('ArrowRight');
  await expect(el(p, 'el_q_quiz1').locator('.ofs-quiz')).not.toHaveClass(/ofs-quiz-answered/);
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  expect(normalise(await studioProject(page))).toEqual(normalise(embeddedProject(file)));
});

test('Example: event announcement (countdown, animated GIF, table, scrolling)', async ({ page, browser }) => {
  await openExample(page, 'event');
  await expect(page.getByTestId('theme-button')).toContainText('Editorial');
  await expect(page.locator('.ed-section-frame')).toHaveCount(6);
  const file = await exportProject(page, 'event.html');
  const project = embeddedProject(file) as { assets: Record<string, { mime: string; data: string; animated?: boolean }> };
  expect(project.assets.as_confetti.mime).toBe('image/gif');
  expect(project.assets.as_confetti.animated).toBe(true);

  const ex = await openExported(browser, file);
  const p = ex.page;
  await expect(p.locator('.ofs-section')).toHaveCount(6);
  await expectImagesLoaded(p);
  // The GIF is the original multi-frame file.
  const gifFrames = await p.evaluate(() => {
    const src = (document.querySelector('.ofs-el[data-id="el_e_confetti1"] img') as HTMLImageElement).src;
    const bin = atob(src.split(',')[1]);
    let n = 0;
    for (let i = 0; i < bin.length - 2; i++) if (bin.charCodeAt(i) === 0x21 && bin.charCodeAt(i + 1) === 0xf9 && bin.charCodeAt(i + 2) === 0x04) n++;
    return n;
  });
  expect(gifFrames).toBeGreaterThan(5);
  // Countdown: a weekly countdown always shows a future occurrence and ticks.
  const cd = el(p, 'el_e_countdown');
  await cd.scrollIntoViewIfNeeded();
  const read = () => cd.locator('.ofs-countdown-value').allTextContents();
  // Fridays 5:30–9 pm (the example's weekly "doors open" hold) the countdown shows its message instead.
  if (await cd.locator('.ofs-countdown-is-done').count()) {
    await expect(cd).toContainText('Doors are open');
  } else {
    const first = await read();
    expect(first.length).toBe(4);
    expect(Number(first[0])).toBeLessThanOrEqual(7);
    await expect.poll(read, { timeout: 4000 }).not.toEqual(first);
  }
  // Navigation button scrolls down; RSVP interaction reveals the thanks.
  await el(p, 'el_e_go').locator('button').click();
  await expect.poll(() => p.locator('.ofs-player').evaluate((n) => n.scrollTop)).toBeGreaterThan(300);
  await el(p, 'el_e_rsvp').scrollIntoViewIfNeeded();
  await el(p, 'el_e_rsvp').locator('button').click();
  await expect(el(p, 'el_e_thanks')).toBeVisible();
  await expect(el(p, 'el_e_table').locator('tbody tr')).toHaveCount(4);
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  expect(normalise(await studioProject(page))).toEqual(normalise(embeddedProject(file)));
});

test('Example: feature release walkthrough (video, chart, table, reveals)', async ({ page, browser }) => {
  await openExample(page, 'release');
  await expect(page.getByTestId('theme-button')).toContainText('Professional');
  const before = await studioProject(page);
  const file = await exportProject(page, 'release.html');
  expect(normalise(embeddedProject(file))).toEqual(normalise(before));
  const html = (await import('node:fs')).readFileSync(file, 'utf8');
  expect(html).toContain('data:video/webm;base64,');
  expect(html).not.toMatch(/"blob:/);

  const ex = await openExported(browser, file);
  const p = ex.page;
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 5');
  await expectImagesLoaded(p);
  await el(p, 'el_r_start').locator('button').click();
  // The embedded video really plays (muted autoplay) and the action buttons control it.
  const video = el(p, 'el_r_video').locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(5);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.3);
  await el(p, 'el_r_pause').locator('button').click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await el(p, 'el_r_replay').locator('button').click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime < 2)).toBe(true);
  // Chart: hover shows an exact value.
  await p.keyboard.press('ArrowRight');
  await expect(p.locator('.ofs-nav-count')).toHaveText('3 / 5');
  const chart = el(p, 'el_r_chart');
  await expect(chart.locator('.ofs-chart-bar')).toHaveCount(8);
  await chart.locator('.ofs-chart-hit').last().hover();
  await expect(chart.locator('.ofs-chart-tip')).toContainText('ms');
  // Table: sorting by a column.
  await p.keyboard.press('ArrowRight');
  const table = el(p, 'el_r_table');
  const firstCell = () => table.locator('tbody tr').first().locator('td').first().textContent();
  expect(await firstCell()).toBe('Board load (1,000 tasks)');
  await table.locator('th .ofs-table-sort').first().click();
  await expect.poll(firstCell).toBe('Board load (1,000 tasks)');
  await table.locator('th .ofs-table-sort').first().click();
  await expect.poll(firstCell).toBe('Open accessibility issues');
  // Reveal interactions on the last slide.
  await p.keyboard.press('ArrowRight');
  await expect(el(p, 'el_r_cardd1')).toBeHidden();
  await el(p, 'el_r_cardbtn1').locator('button').click();
  await expect(el(p, 'el_r_cardd1')).toBeVisible();
  await el(p, 'el_r_restart').locator('button').click();
  await expect(p.locator('.ofs-nav-count')).toHaveText('1 / 5');
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  await importIntoStudio(page, file);
  const after = await studioProject(page);
  expect(normalise(after)).toEqual(normalise(embeddedProject(file)));
});
