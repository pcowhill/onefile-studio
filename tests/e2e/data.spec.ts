import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { exportProject, importIntoStudio, openExported, openStudio, studioProject } from './helpers';

type El = { id: string; type: string; x: number; y: number; w: number; h: number; props: Record<string, unknown> };
async function elements(page: Page): Promise<El[]> {
  const p = (await studioProject(page)) as unknown as { pages: Array<{ elements: El[] }> };
  return p.pages.flatMap((pg) => pg.elements);
}

/** Moves the selected element via the "Exact size & position" fields. */
async function placeSelected(page: Page, x: number, y: number) {
  await page.getByText('Exact size & position').click();
  for (const [k, v] of [
    ['x', x],
    ['y', y],
  ] as const) {
    const input = page.getByRole('textbox', { name: k, exact: true });
    await input.fill(String(v));
    await input.press('Enter');
  }
}

/** Simulates pasting text copied from a spreadsheet into a grid cell. */
async function pasteInto(page: Page, selector: string, text: string) {
  await page.locator(selector).focus();
  await page.locator(selector).evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

test('charts and tables: insert, edit data (typing, paste, CSV), preview, export offline, re-import', async ({ page, browser }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-insert').click();

  // A line chart renders lines on the canvas.
  await page.getByTestId('insert-chart-line').click();
  await expect(page.locator('.ed-el .ofs-chart-line')).toHaveCount(2);
  await expect(page.getByTestId('chart-data-summary')).toHaveText('8 labels · 2 series');
  await page.keyboard.press('Delete');
  expect(await elements(page)).toHaveLength(0);

  // ---- Bar chart
  await page.getByTestId('insert-chart-bar').click();
  await expect(page.locator('.ed-el .ofs-chart-bar')).toHaveCount(12);
  await placeSelected(page, 20, 20);
  await page.getByTestId('chart-edit-data').click();
  const grid = page.getByTestId('data-grid');
  await expect(grid).toBeVisible();
  // Type an exact value and a non-number (flagged, counts as 0).
  await grid.locator('input[data-r="1"][data-c="1"]').fill('1234.5');
  await grid.locator('input[data-r="2"][data-c="1"]').fill('lots');
  await expect(grid.locator('td.is-invalid')).toHaveCount(1);
  await expect(page.getByTestId('dg-summary')).toContainText('1 cell not a number');
  await grid.locator('input[data-r="2"][data-c="1"]').fill('41');
  // Keyboard: Enter moves down.
  await grid.locator('input[data-r="1"][data-c="2"]').focus();
  await page.keyboard.press('Enter');
  await expect(grid.locator('input[data-r="2"][data-c="2"]')).toBeFocused();
  // Paste two new rows from a spreadsheet below the data: the grid grows.
  await pasteInto(page, 'input[data-r="6"][data-c="0"]', 'Jun\t70\t92\nJul\t80\t99\nAug\t85\t101\n');
  await expect(grid.locator('tbody tr')).toHaveCount(9);
  await expect(page.getByTestId('dg-summary')).toHaveText('8 labels · 2 series');
  await page.getByTestId('dg-done').click();
  await expect(grid).toBeHidden();
  await expect(page.getByTestId('chart-data-summary')).toHaveText('8 labels · 2 series');
  await expect(page.locator('.ed-el .ofs-chart-bar')).toHaveCount(16);
  // One undo step reverts the whole edit.
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('chart-data-summary')).toHaveText('6 labels · 2 series');
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('chart-data-summary')).toHaveText('8 labels · 2 series');
  await page.getByTestId('chart-preset-bold').click();
  const chart = (await elements(page)).find((e) => e.type === 'chart')!;
  expect(chart.props.labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
  expect((chart.props.series as Array<{ values: number[] }>)[0].values).toEqual([1234.5, 41, 38, 52, 61, 70, 80, 85]);

  // ---- Table
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-table').click();
  await placeSelected(page, 670, 420);
  await page.getByTestId('table-edit-cells').click();
  await expect(grid).toBeVisible();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('dg-import').click()]);
  await chooser.setFiles({
    name: 'scores.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Name,Score,Note\r\n"Zed, Z.",5,ok\r\nAmy,12,"said ""hi"""\r\nBob,9,\r\n'),
  });
  await expect(page.getByText('Imported 4 rows from scores.csv.')).toBeVisible();
  await grid.locator('input[data-r="3"][data-c="1"]').fill('100');
  await page.getByTestId('dg-done').click();
  await expect(page.getByTestId('table-data-summary')).toHaveText('3 rows · 3 columns');
  const table = (await elements(page)).find((e) => e.type === 'table')!;
  expect(table.props.rows).toEqual([
    ['Name', 'Score', 'Note'],
    ['Zed, Z.', '5', 'ok'],
    ['Amy', '12', 'said "hi"'],
    ['Bob', '100', ''],
  ]);
  expect(table.props.columnAlign).toEqual(['auto', 'auto', 'auto']);

  // ---- Preview runs the same engine
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await expect(stage.locator('.ofs-chart-bar')).toHaveCount(16);
  await expect(stage.locator('.ofs-table th button')).toHaveCount(3);
  await page.getByTestId('close-preview').click();

  // ---- Export and open offline from disk
  const file = await exportProject(page, 'charts-and-tables.html');
  const ex = await openExported(browser, file);
  const p = ex.page;
  const c = p.locator(`.ofs-el[data-id="${chart.id}"]`);
  await expect(c.locator('.ofs-chart-bar')).toHaveCount(16);
  await expect(c.locator('.ofs-chart-title')).toHaveText('Monthly visitors');
  // Hover the first bar: the tooltip shows the exact value.
  await c.locator('.ofs-chart-hit').first().hover();
  const tip = c.locator('.ofs-chart-tip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('1,234.5');
  await expect(tip).toContainText('Jan');
  await expect(tip).toContainText('2025');
  // The tooltip stays inside the chart.
  const cb = (await c.boundingBox())!;
  const tb = (await tip.boundingBox())!;
  expect(tb.x).toBeGreaterThanOrEqual(cb.x - 1);
  expect(tb.y).toBeGreaterThanOrEqual(cb.y - 1);
  expect(tb.x + tb.width).toBeLessThanOrEqual(cb.x + cb.width + 1);
  // Legend toggling hides and shows a series.
  const legend2026 = c.locator('button.ofs-chart-legend-item', { hasText: '2026' });
  await legend2026.click();
  await expect(legend2026).toHaveAttribute('aria-pressed', 'false');
  await expect(c.locator('.ofs-chart-bar')).toHaveCount(8);
  await legend2026.press('Enter');
  await expect(c.locator('.ofs-chart-bar')).toHaveCount(16);

  // Table sorting: numbers ascending, descending, then back to the original order.
  const t = p.locator(`.ofs-el[data-id="${table.id}"]`);
  const names = () => t.locator('tbody tr td:first-child').allTextContents();
  const score = t.locator('th', { hasText: 'Score' });
  await score.locator('button').click();
  await expect(score).toHaveAttribute('aria-sort', 'ascending');
  expect(await names()).toEqual(['Zed, Z.', 'Amy', 'Bob']);
  await score.locator('button').click();
  await expect(score).toHaveAttribute('aria-sort', 'descending');
  expect(await names()).toEqual(['Bob', 'Amy', 'Zed, Z.']);
  await score.locator('button').press('Enter');
  await expect(score).toHaveAttribute('aria-sort', 'none');
  expect(await names()).toEqual(['Zed, Z.', 'Amy', 'Bob']);
  await t.locator('th', { hasText: 'Name' }).locator('button').click();
  expect(await names()).toEqual(['Amy', 'Bob', 'Zed, Z.']);

  expect(ex.requests).toEqual([]);
  expect(ex.errors).toEqual([]);
  await ex.close();

  // ---- Re-import: the data survives
  await importIntoStudio(page, file);
  const back = await elements(page);
  const c2 = back.find((e) => e.type === 'chart')!;
  const t2 = back.find((e) => e.type === 'table')!;
  expect(c2.props.labels).toEqual(chart.props.labels);
  expect(c2.props.series).toEqual(chart.props.series);
  expect(c2.props.preset).toBe('bold');
  expect(t2.props.rows).toEqual(table.props.rows);
});
