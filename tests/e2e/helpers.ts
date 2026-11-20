import { expect } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const OUT = path.resolve('test-results/exports');

/** Opens the editor on the start screen with clean storage. */
export async function openStudio(page: Page) {
  await page.goto('./?home');
  await expect(page.getByText('What will you')).toBeVisible();
}

/** Exports the open project through the real Export dialog and saves the file. */
export async function exportProject(page: Page, name: string, quality: 'original' | 'optimized' = 'original'): Promise<string> {
  await page.getByTestId('export').click();
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await expect(dialog).toBeVisible();
  if (quality === 'optimized') await dialog.getByRole('radio', { name: /Optimised/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('download-html').click()]);
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name);
  await download.saveAs(file);
  return file;
}

export interface OpenedExport {
  page: Page;
  requests: string[];
  errors: string[];
  close(): Promise<void>;
}

/**
 * Opens an exported file in a brand-new, OFFLINE browser context straight from
 * disk (file://) and records every network request and script error.
 */
export async function openExported(browser: Browser, file: string, opts: { setup?(page: Page): Promise<void> } = {}): Promise<OpenedExport> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.setOffline(true);
  const page = await context.newPage();
  await opts.setup?.(page);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) requests.push(u);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => !!(window as unknown as { __ofs?: unknown }).__ofs);
  return { page, requests, errors, close: () => context.close() };
}

/** Every <img> in the document decoded successfully. */
export async function expectImagesLoaded(page: Page) {
  const result = await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
    return imgs.map((i) => ({ ok: i.naturalWidth > 0, data: i.src.startsWith('data:image/') }));
  });
  expect(result.length).toBeGreaterThan(0);
  for (const r of result) {
    expect(r.ok).toBe(true);
    expect(r.data).toBe(true);
  }
}

export function embeddedProject(file: string): Record<string, unknown> {
  const html = fs.readFileSync(file, 'utf8');
  const m = /<script type="application\/json" id="ofs-project">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('no project data');
  return JSON.parse(m[1]);
}

/** Imports a file through the start screen's "Open a file" button. */
export async function importIntoStudio(page: Page, file: string) {
  await openStudio(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('open-file').click()]);
  await chooser.setFiles(file);
  await expect(page.locator('.ed-toolbar')).toBeVisible();
}

export async function studioProject(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => (window as unknown as { __ofsStudio: { project(): unknown } }).__ofsStudio.project() as Record<string, unknown>);
}

/** Project equality ignoring the id (re-imports may get a fresh one) and timestamps. */
export function normalise(p: Record<string, unknown>) {
  const meta = p.meta as Record<string, unknown>;
  return { ...p, id: '', meta: { ...meta, updatedAt: '', createdAt: '' } };
}

/** Pixels of a region that differ clearly from its corner colour (the backdrop), via an in-page canvas. */
export async function paintedFraction(page: Page, target: Locator): Promise<number> {
  const shot = (await target.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    // Compare against the colour at the vertical centre of the left edge (backdrop, outside the model).
    const at = (Math.floor(c.height / 2) * c.width + 3) * 4;
    const [r0, g0, b0] = [data[at], data[at + 1], data[at + 2]];
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) > 60) n++;
    return n / (data.length / 4);
  }, shot);
}
