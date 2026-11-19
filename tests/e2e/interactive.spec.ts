import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { exportProject, importIntoStudio, openExported, openStudio, studioProject } from './helpers';
import { addDays, utcToZonedParts, zonedTimeToUtc } from '../../src/runtime/time';

type El = { id: string; type: string; name: string; hidden: boolean; props: Record<string, unknown>; interactions: Array<{ trigger: string }> };
type Proj = { pages: Array<{ elements: El[] }>; variables: Array<{ id: string; name: string }> };
const project = async (page: Page) => (await studioProject(page)) as unknown as Proj;
const elements = async (page: Page) => (await project(page)).pages.flatMap((p) => p.elements);
const byType = async (page: Page, type: string) => (await elements(page)).find((e) => e.type === type)!;

/** Moves the selected element via the inspector's exact position fields. */
async function placeSelected(page: Page, x: number, y: number) {
  await page.getByTestId('tab-design').click();
  const details = page.locator('details.ed-details');
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await details.locator('summary').click();
  for (const [k, v] of [
    ['x', x],
    ['y', y],
  ] as const) {
    const input = details.getByLabel(k, { exact: true });
    await input.fill(String(v));
    await input.press('Enter');
  }
}

test('countdown and quiz: configure, wire up, preview, export offline and re-import', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-insert').click();

  // ---- a hidden "well done" star, revealed by a correct answer ----
  await page.getByTestId('insert-shape-star').click();
  await placeSelected(page, 1040, 480);
  await page.getByTestId('tab-behavior').click();
  await page.getByText('Hidden when the page opens').click();
  const star = await byType(page, 'shape');
  expect(star.hidden).toBe(true);

  // ---- quiz ----
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-quiz').click();
  await placeSelected(page, 40, 40);
  const design = page.locator('.ed-inspector-body');
  await design.getByLabel('Question', { exact: true }).fill('What is 2 + 2?');
  await design.getByLabel('Remove answer D').click();
  await expect(page.getByTestId('quiz-answer')).toHaveCount(3);
  await design.getByLabel('Answer A', { exact: true }).fill('3');
  await design.getByLabel('Answer B', { exact: true }).fill('5');
  await design.getByLabel('Answer C', { exact: true }).fill('4');
  await page.getByTestId('quiz-mark-correct').nth(2).click();
  await expect(page.getByTestId('quiz-answer').nth(2)).toHaveClass(/is-correct/);
  await design.getByLabel('Feedback when correct').fill('Yes — four!');
  // Points: create and connect a Score variable in one click, then award 5.
  await design.getByRole('button', { name: 'Points', exact: true }).click();
  await page.getByTestId('quiz-create-score').click();
  await expect(design.getByLabel('Score variable')).toHaveValue(/var_/);
  const points = design.getByLabel('Points', { exact: true });
  await points.fill('5');
  await points.press('Enter');
  let quiz = await byType(page, 'quiz');
  expect(quiz.props).toMatchObject({ question: 'What is 2 + 2?', choices: ['3', '5', '4'], correct: 2, points: 5 });
  const vars = (await project(page)).variables;
  expect(vars.map((v) => v.name)).toEqual(['Score']);
  expect(quiz.props.scoreVariable).toBe(vars[0].id);
  // The canvas shows the quiz as viewers will see it.
  await expect(page.locator(`.ed-el[data-id="${quiz.id}"] .ofs-quiz-q`)).toHaveText('What is 2 + 2?');

  // "Answered correctly" → show the star.
  await page.getByTestId('tab-behavior').click();
  await page.getByTestId('add-interaction').click();
  await page.getByTestId('trigger-quizCorrect').click();
  await page.getByTestId('add-action').click();
  await page.getByTestId('action-show').click();
  await page.locator('.ed-elpick-btn').last().click();
  await page.locator('.ed-elpick-menu').getByRole('option', { name: star.name }).click();
  quiz = await byType(page, 'quiz');
  expect(quiz.interactions.map((i) => i.trigger)).toEqual(['quizCorrect']);

  // ---- score text ----
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-score').click();
  await placeSelected(page, 760, 480);

  // ---- countdown: 3 days from now at 18:00 in Berlin ----
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-countdown').click();
  await placeSelected(page, 660, 40);
  const tz = 'Europe/Berlin';
  const day = addDays(utcToZonedParts(Date.now(), tz), 3);
  const date = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
  await page.getByTestId('countdown-zone').selectOption(tz);
  await page.getByTestId('countdown-date').fill(date);
  await page.getByTestId('countdown-time').fill('18:00');
  const expected = new Date(zonedTimeToUtc({ ...day, hour: 18, minute: 0 }, tz)).toISOString();
  await expect.poll(async () => (await byType(page, 'countdown')).props.target).toBe(expected);
  expect((await byType(page, 'countdown')).props.timezone).toBe(tz);
  await expect(page.getByTestId('countdown-summary')).toContainText('in Europe/Berlin');
  await expect(page.getByTestId('countdown-summary')).toContainText(/that's in (2|3) days/);
  await page.getByTestId('countdown-style-digital').click();
  const countdown = await byType(page, 'countdown');
  expect(countdown.props.style).toBe('digital');

  // ---- preview ----
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await stage.locator('.ofs-quiz-choice', { hasText: '4' }).click();
  await expect(stage.getByText('Yes — four!')).toBeVisible();
  await expect(stage.getByText('Score: 5')).toBeVisible();
  await page.getByTestId('close-preview').click();

  // ---- export & open offline from disk ----
  const file = await exportProject(page, 'interactive.html');
  const ex = await openExported(browser, file);
  const p = ex.page;
  const cd = p.locator(`.ofs-el[data-id="${countdown.id}"] .ofs-countdown`);
  await expect(cd).toHaveAttribute('data-done', 'false');
  const first = Number(await cd.getAttribute('data-remaining'));
  expect(first).toBeGreaterThan(2 * 86400 - 3600);
  expect(first).toBeLessThan(4 * 86400);
  const vals = await cd.locator('.ofs-countdown-value').allTextContents();
  expect(vals).toHaveLength(4);
  expect(['02', '03']).toContain(vals[0]);
  vals.forEach((v) => expect(v).toMatch(/^\d{2}$/));
  await expect.poll(async () => Number(await cd.getAttribute('data-remaining')), { timeout: 4000 }).toBeLessThan(first);

  const q = p.locator(`.ofs-el[data-id="${quiz.id}"]`);
  const starEl = p.locator(`.ofs-el[data-id="${star.id}"]`);
  await expect(starEl).toBeHidden();
  await expect(p.getByText('Score: 0')).toBeVisible();
  // Wrong first…
  await q.locator('.ofs-quiz-choice', { hasText: '5' }).click();
  await expect(q.locator('.ofs-quiz-feedback')).toContainText('Not quite');
  await expect(q.locator('.ofs-quiz-choice.ofs-incorrect')).toHaveText(/5/);
  await expect(starEl).toBeHidden();
  // …try again (focus returns to the first answer)…
  await q.getByRole('button', { name: 'Try again' }).click();
  await expect(q.locator('.ofs-quiz-choice').first()).toBeFocused();
  await expect(q.locator('.ofs-quiz-incorrect')).toHaveCount(0);
  // …then right.
  await q.locator('.ofs-quiz-choice', { hasText: '4' }).click();
  await expect(q.locator('.ofs-quiz-feedback')).toContainText('Yes — four!');
  await expect(q.locator('.ofs-quiz-choice.ofs-correct')).toHaveText(/4/);
  await expect(p.getByText('Score: 5')).toBeVisible();
  await expect(starEl).toBeVisible();
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  // ---- re-import ----
  await importIntoStudio(page, file);
  const back = await project(page);
  const bq = back.pages[0].elements.find((e) => e.type === 'quiz')!;
  const bc = back.pages[0].elements.find((e) => e.type === 'countdown')!;
  expect(bq.props).toMatchObject({ question: 'What is 2 + 2?', choices: ['3', '5', '4'], correct: 2, points: 5, feedbackCorrect: 'Yes — four!' });
  expect(back.variables.find((v) => v.id === bq.props.scoreVariable)?.name).toBe('Score');
  expect(bq.interactions.map((i) => i.trigger)).toEqual(['quizCorrect']);
  expect(bc.props).toMatchObject({ target: expected, timezone: tz, style: 'digital' });
});

test('countdown inspector: presets, time-zone search and past-time warning', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-countdown').click();
  const summary = page.getByTestId('countdown-summary');
  await page.getByTestId('countdown-preset-hour').click();
  await expect(summary).toContainText(/that's in (59 minutes|1 hour)/);
  await page.getByTestId('countdown-preset-newyear').click();
  await expect(summary).toContainText('Fri 1 Jan 2027, 00:00');
  // Another zone via search keeps the wall-clock time.
  await page.getByTestId('countdown-zone').selectOption('@other');
  await page.getByLabel('Search time zones').fill('lima');
  await page.getByRole('option', { name: /America\/Lima|America\s*\/\s*Lima|Lima/ }).click();
  await expect(summary).toContainText('Fri 1 Jan 2027, 00:00 in America/Lima');
  expect((await byType(page, 'countdown')).props).toMatchObject({ timezone: 'America/Lima', target: '2027-01-01T05:00:00.000Z' });
  // A past date shows a gentle warning.
  await page.getByTestId('countdown-date').fill('2020-05-01');
  await expect(summary).toHaveClass(/is-past/);
  await expect(summary).toContainText('Pick a future time');
});
