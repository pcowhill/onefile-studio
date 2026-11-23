import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { embeddedProject, exportProject, importIntoStudio, openExported, openStudio, studioProject } from './helpers';

/**
 * v0.7: Together steps — actions that start at the same time, built entirely
 * in the Behavior inspector, then played in Preview, in an exported file
 * opened offline (file://) and after re-importing that file.
 */

interface El {
  id: string;
  type: string;
  name: string;
  hidden: boolean;
  props: Record<string, unknown>;
  interactions: Array<{ actions: Array<{ id: string; type: string; params: Record<string, unknown>; together?: boolean }> }>;
}

async function elements(page: Page): Promise<El[]> {
  const p = (await studioProject(page)) as unknown as { pages: Array<{ elements: El[] }> };
  return p.pages.flatMap((pg) => pg.elements);
}

/** Records when each element's animations start (Web Animations API), in page time. */
const RECORD_ANIMATIONS = () => {
  const w = window as unknown as { __anims: Array<{ id: string; t: number; preview: boolean }> };
  w.__anims = [];
  const original = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
    const el = this.closest?.('.ofs-el') as HTMLElement | null;
    if (el?.dataset.id) w.__anims.push({ id: el.dataset.id, t: performance.now(), preview: !!this.closest('[data-testid=preview-stage]') });
    return original.apply(this, args);
  };
};

async function anims(page: Page): Promise<Array<{ id: string; t: number; preview: boolean }>> {
  return page.evaluate(() => (window as unknown as { __anims: Array<{ id: string; t: number; preview: boolean }> }).__anims);
}

/** Checks the play-back timing: three pops in the same frame, the label ≥ pop + 0.5 s later. */
async function expectTogetherTiming(page: Page, ids: { shapes: string[]; label: string }, filter: (a: { preview: boolean }) => boolean) {
  await expect.poll(async () => (await anims(page)).filter((a) => filter(a) && a.id === ids.label).length, { timeout: 5000 }).toBeGreaterThan(0);
  const all = (await anims(page)).filter(filter);
  const starts = ids.shapes.map((id) => all.find((a) => a.id === id)?.t);
  for (const s of starts) expect(s).toBeDefined();
  const first = Math.min(...(starts as number[]));
  const last = Math.max(...(starts as number[]));
  // The same animation frame — not one after another (each Pop lasts 600 ms).
  expect(last - first).toBeLessThan(17);
  const label = all.find((a) => a.id === ids.label)!.t;
  // Pop (600 ms) + Wait 0.5 s, then the label.
  expect(label - first).toBeGreaterThanOrEqual(600 + 500 - 30);
  expect(label - first).toBeLessThan(600 + 500 + 1500);
}

async function pickTarget(page: Page, row: Locator, name: string) {
  await row.locator('.ed-elpick-btn').click();
  // Options read "<name>" or "<name> hidden".
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.getByRole('option', { name: new RegExp(`^\\s*${escaped}(\\s*hidden)?\\s*$`) }).click();
}

async function select(page: Page, id: string) {
  await page.locator(`.ed-el[data-id="${id}"]`).click({ force: true });
}

test('build a Together step in the inspector; it plays together in Preview, offline and after re-import', async ({ page, browser }) => {
  await page.addInitScript(RECORD_ANIMATIONS);
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-insert').click();
  for (const kind of ['star', 'heart', 'ellipse']) {
    await page.getByTestId(`insert-shape-${kind}`).click();
    await page.getByTestId('tab-behavior').click();
    await page.getByText('Hidden when the page opens').click();
    await page.getByTestId('tab-insert').click();
  }
  await page.getByTestId('insert-tag').click();
  await page.getByTestId('tab-behavior').click();
  await page.getByText('Hidden when the page opens').click();
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-button').click();

  // Spread the shapes out so they can all be seen.
  const els = await elements(page);
  const shapes = els.filter((e) => e.type === 'shape');
  const label = els.find((e) => e.type === 'text')!;
  const button = els.find((e) => e.type === 'button')!;
  expect(shapes).toHaveLength(3);
  expect(shapes.every((s) => s.hidden) && label.hidden).toBe(true);

  // The button: When clicked → [pop A + pop B + pop C] → wait 0.5 s → fade in the label.
  await select(page, button.id);
  await page.getByTestId('tab-behavior').click();
  await page.getByTestId('add-interaction').click();
  await page.getByTestId('trigger-click').click();
  const card = page.getByTestId('interaction');
  for (const s of shapes) {
    await card.getByTestId('add-action').click();
    await page.getByTestId('action-show').click();
    const row = card.getByTestId('action-row').last();
    await pickTarget(page, row, s.name);
    await row.getByLabel('Effect').selectOption('pop');
  }
  await card.getByTestId('add-action').click();
  await page.getByTestId('action-wait').click();
  await card.getByTestId('action-row').last().getByLabel('Seconds').fill('0.5');
  await card.getByTestId('add-action').click();
  await page.getByTestId('action-show').click();
  await pickTarget(page, card.getByTestId('action-row').last(), label.name);

  // Five steps, run one after another (the default) …
  await expect(card.getByTestId('step')).toHaveCount(5);
  await expect(card.getByTestId('action-group')).toHaveCount(0);
  // … until "Together" joins steps 1–3 into one group (by keyboard, too).
  await card.getByTestId('join-step').first().click();
  const join = card.getByTestId('join-step').nth(0);
  await join.focus();
  await page.keyboard.press('Enter');
  await expect(card.getByTestId('action-group')).toHaveCount(1);
  await expect(card.getByTestId('step')).toHaveCount(3);
  await expect(card.getByTestId('action-group').getByTestId('action-row')).toHaveCount(3);
  await expect(card.locator('.ed-step-then-label').first()).toHaveText(/After these finish/);

  const stored = (await elements(page)).find((e) => e.id === button.id)!.interactions[0].actions;
  expect(stored.map((a) => [a.type, !!a.together])).toEqual([
    ['show', false],
    ['show', true],
    ['show', true],
    ['wait', false],
    ['show', false],
  ]);
  expect(stored.slice(0, 3).map((a) => a.params.target)).toEqual(shapes.map((s) => s.id));

  // Preview: the three pops start in the same frame; the label waits for them.
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await stage.locator(`.ofs-el[data-id="${button.id}"] button`).click();
  for (const s of shapes) await expect(stage.locator(`.ofs-el[data-id="${s.id}"]`)).toBeVisible();
  await expectTogetherTiming(page, { shapes: shapes.map((s) => s.id), label: label.id }, (a) => a.preview);
  await expect(stage.locator(`.ofs-el[data-id="${label.id}"]`)).toBeVisible();
  await page.getByTestId('close-preview').click();

  // Export → open offline from disk → the same behaviour.
  const file = await exportProject(page, 'together.html');
  const data = embeddedProject(file) as { version: number; pages: Array<{ elements: El[] }> };
  expect(data.version).toBe(5);
  const ex = await openExported(browser, file, { setup: async (p) => void (await p.addInitScript(RECORD_ANIMATIONS)) });
  await ex.page.locator(`.ofs-el[data-id="${button.id}"] button`).click();
  await expectTogetherTiming(ex.page, { shapes: shapes.map((s) => s.id), label: label.id }, () => true);
  await expect(ex.page.locator(`.ofs-el[data-id="${label.id}"]`)).toBeVisible();
  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  // Re-import: the grouping is preserved exactly (ids included).
  await importIntoStudio(page, file);
  const back = (await elements(page)).find((e) => e.id === button.id)!.interactions[0].actions;
  expect(back.map((a) => [a.id, !!a.together])).toEqual(stored.map((a) => [a.id, !!a.together]));
});

test('editing Together groups: add, reorder, move, take out, split, remove, undo/redo, duplicate, reopen', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('example-together').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  await select(page, 'el_tg_reveal');
  await page.getByTestId('tab-behavior').click();
  const card = page.getByTestId('interaction');
  const group = card.getByTestId('action-group');
  await expect(group).toHaveCount(1);
  await expect(group.getByTestId('action-row')).toHaveCount(3);
  await expect(card.getByTestId('step')).toHaveCount(3);
  const ids = async () => (await elements(page)).find((e) => e.id === 'el_tg_reveal')!.interactions[0].actions.map((a) => `${a.id}${a.together ? '+' : ''}`);
  expect(await ids()).toEqual(['ac_tg_pop1', 'ac_tg_pop2+', 'ac_tg_pop3+', 'ac_tg_wait', 'ac_tg_label']);

  // Add an action to the group.
  await group.getByTestId('add-to-group').click();
  await page.getByTestId('action-animate').click();
  await expect(group.getByTestId('action-row')).toHaveCount(4);
  const added = (await ids())[3];
  expect(added.endsWith('+')).toBe(true);

  // Reorder inside the group: move the new action up.
  await group.getByTestId('action-row').nth(3).getByRole('button', { name: 'Move action up' }).click();
  expect((await ids())[2]).toBe(added);

  // Take it out of the group: it becomes its own step right after the group.
  await group.getByTestId('action-row').nth(2).getByTestId('take-out').click();
  expect(await ids()).toEqual(['ac_tg_pop1', 'ac_tg_pop2+', 'ac_tg_pop3+', added.replace('+', ''), 'ac_tg_wait', 'ac_tg_label']);

  // Move the group down below that step, then back up.
  await group.getByRole('button', { name: 'Move group down' }).click();
  expect((await ids())[0]).toBe(added.replace('+', ''));
  await card.getByTestId('action-group').getByRole('button', { name: 'Move group up' }).click();
  expect((await ids())[0]).toBe('ac_tg_pop1');

  // Remove the extra action.
  await card.getByTestId('step').nth(1).getByRole('button', { name: 'Remove action' }).click();
  expect(await ids()).toEqual(['ac_tg_pop1', 'ac_tg_pop2+', 'ac_tg_pop3+', 'ac_tg_wait', 'ac_tg_label']);

  // Back to "one after another" …
  await card.getByTestId('split-group').click();
  await expect(card.getByTestId('action-group')).toHaveCount(0);
  expect(await ids()).toEqual(['ac_tg_pop1', 'ac_tg_pop2', 'ac_tg_pop3', 'ac_tg_wait', 'ac_tg_label']);
  // … and undo / redo.
  await page.getByTestId('undo').click();
  await expect(card.getByTestId('action-group')).toHaveCount(1);
  expect(await ids()).toEqual(['ac_tg_pop1', 'ac_tg_pop2+', 'ac_tg_pop3+', 'ac_tg_wait', 'ac_tg_label']);
  await page.getByTestId('redo').click();
  await expect(card.getByTestId('action-group')).toHaveCount(0);
  await page.getByTestId('undo').click();
  await expect(card.getByTestId('action-group')).toHaveCount(1);

  // Conflicts get a friendly note: add "Hide Circle" to the group that shows it.
  await card.getByTestId('action-group').getByTestId('add-to-group').click();
  await page.getByTestId('action-hide').click();
  await pickTarget(page, card.getByTestId('action-group').getByTestId('action-row').last(), 'Circle');
  await expect(card.locator('.ed-group-hint')).toContainText('the lower one wins');
  await card.getByTestId('action-group').getByTestId('action-row').last().getByRole('button', { name: 'Remove action' }).click();
  await expect(card.locator('.ed-group-hint')).toHaveCount(0);

  // Duplicating the button copies its groups.
  await select(page, 'el_tg_reveal');
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await elements(page)).filter((e) => e.type === 'button').length).toBe(3);
  const copy = (await elements(page)).filter((e) => e.type === 'button').find((e) => e.id !== 'el_tg_reveal' && e.id !== 'el_tg_reset')!;
  expect(copy.interactions[0].actions.map((a) => !!a.together)).toEqual([false, true, true, false, false]);
  await page.getByTestId('undo').click(); // (the copy sits on top of the original)
  await expect.poll(async () => (await elements(page)).filter((e) => e.type === 'button').length).toBe(2);

  // Remove the whole group.
  await select(page, 'el_tg_reveal');
  await card.getByTestId('action-group').getByRole('button', { name: 'Remove group' }).click();
  expect(await ids()).toEqual(['ac_tg_wait', 'ac_tg_label']);
  await page.getByTestId('undo').click();
  expect(await ids()).toEqual(['ac_tg_pop1', 'ac_tg_pop2+', 'ac_tg_pop3+', 'ac_tg_wait', 'ac_tg_label']);

  // Saved as a draft: a reload re-opens the project with its groups.
  await page.waitForTimeout(1500);
  await page.goto('./'); // no ?home: re-opens the last project
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  await expect.poll(ids).toEqual(['ac_tg_pop1', 'ac_tg_pop2+', 'ac_tg_pop3+', 'ac_tg_wait', 'ac_tg_label']);
  await select(page, 'el_tg_reveal');
  await page.getByTestId('tab-behavior').click();
  await expect(page.getByTestId('interaction').getByTestId('action-group')).toHaveCount(1);
});

test('the Three shapes example plays together offline', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('example-together').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  const file = await exportProject(page, 'three-shapes.html');
  const ex = await openExported(browser, file, { setup: async (p) => void (await p.addInitScript(RECORD_ANIMATIONS)) });
  await ex.page.getByRole('button', { name: 'Reveal' }).click();
  await expectTogetherTiming(ex.page, { shapes: ['el_tg_circle', 'el_tg_star', 'el_tg_heart'], label: 'el_tg_done' }, () => true);
  await expect(ex.page.getByText('All together!')).toBeVisible();
  await ex.page.getByRole('button', { name: 'Start over' }).click();
  await expect(ex.page.getByText('All together!')).toBeHidden();
  expect(ex.errors).toEqual([]);
  await ex.close();
});
