import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SHOWCASES } from '../../../src/showcase/meta';

/**
 * v0.7: the complete website as committed in dist-site/, hosted the way a
 * downloader would host it: a temporary COPY of the folder (nothing else from
 * the repository), served by a plain static file server, from a sub-directory
 * (/onefile-studio/). Every request that leaves that server is blocked and
 * recorded — the site must work on an isolated network.
 */

const SITE = path.resolve('dist-site');

/** Blocks every request that is not for the static server; returns the list of blocked URLs. */
async function isolate(page: Page) {
  const outside: string[] = [];
  const errors: string[] = [];
  await page.context().route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:' || (u.hostname === 'localhost' && u.pathname.startsWith('/onefile-studio/'))) return route.continue();
    outside.push(u.href);
    return route.abort();
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return { outside, errors };
}

/** Local references (src, href, poster, CSS url()) of a committed HTML or CSS file. */
function localRefs(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const refs = new Set<string>();
  const re = /\b(?:src|href|poster)="([^"]+)"|url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const ref = (m[1] ?? m[2]).trim();
    if (/^(?:[a-z]+:|#|\/\/)/i.test(ref) || ref.includes('${')) continue; // absolute, data:, anchors, template code
    refs.add(ref.split('#')[0]);
  }
  return [...refs].filter(Boolean);
}

test('every local link and asset of the committed site resolves under a sub-directory', async ({ request, baseURL }) => {
  const pages = [
    'index.html',
    'examples/index.html',
    ...fs
      .readdirSync(path.join(SITE, 'assets'))
      .filter((f) => f.endsWith('.css'))
      .map((f) => `assets/${f}`),
  ];
  const checked = new Set<string>();
  for (const p of pages) {
    for (const ref of localRefs(path.join(SITE, p))) {
      const url = new URL(ref, new URL(p, baseURL)).href;
      if (checked.has(url)) continue;
      checked.add(url);
      expect(url.startsWith(baseURL!), `${ref} in ${p} leaves the site folder`).toBe(true);
      const res = await request.get(url, { headers: { Range: 'bytes=0-1023' } });
      expect(res.ok(), `${ref} in ${p} → ${url} (${res.status()})`).toBe(true);
    }
  }
  // The landing page's videos, posters, captions, styles and scripts were among them.
  const all = [...checked].join('\n');
  for (const want of ['media/hero.mp4', 'media/hero.webp', 'media/hero.vtt', 'studio/', 'assets/']) expect(all).toContain(want);
  for (const s of SHOWCASES) expect(all).toContain(`media/showcase/${s.id}.mp4`);
  expect(checked.size).toBeGreaterThan(40);
  // Fonts referenced by the CSS are local files.
  expect([...checked].some((u) => u.endsWith('.woff2'))).toBe(true);
});

test('the hosted landing page works offline from a sub-directory', async ({ page }) => {
  const iso = await isolate(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.sc-card, [id^=sc-]').first()).toBeVisible();
  // Self-hosted fonts and the hero poster really loaded.
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some((f) => f.status === 'loaded'))).toBe(true);
  const poster = await page.evaluate(async () => {
    const v = document.querySelector('video[poster]') as HTMLVideoElement;
    const img = new Image();
    img.src = v.poster;
    await img.decode();
    return img.naturalWidth;
  });
  expect(poster).toBeGreaterThan(0);

  // "Try it" plays a showcase OneFile from showcase/.
  await page.locator('#sc-feed-puff').getByRole('link', { name: 'Try it' }).click();
  const frame = page.frameLocator('[data-testid=try-frame]');
  const puff = frame.locator('.ofs-el[data-id="el_c_puff"]');
  await puff.click();
  await expect(frame.getByText('Score: 1')).toBeVisible();
  expect(iso.outside).toEqual([]);
  expect(iso.errors).toEqual([]);
});

test('the hosted editor: start screen, templates, lessons and a Together interaction, all offline', async ({ page }) => {
  const iso = await isolate(page);
  await page.goto('./studio/?panel=templates');
  await expect(page.getByTestId('template-grid')).toBeVisible();
  const first = page.locator('[data-testid^=use-template-]').first();
  await first.click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();

  await page.goto('./studio/?panel=learn');
  await expect(page.getByRole('dialog', { name: 'Learn' })).toBeVisible();
  await page.getByTestId('lesson-first-onefile').click();
  await expect(page.getByTestId('coach')).toBeVisible();

  // The "Three shapes, together" example: the Together step plays in Preview.
  await page.goto('./studio/?home');
  await page.getByTestId('example-together').click();
  await page.getByTestId('preview').click();
  const stage = page.getByTestId('preview-stage');
  await stage.getByRole('button', { name: 'Reveal' }).click();
  for (const id of ['el_tg_circle', 'el_tg_star', 'el_tg_heart']) await expect(stage.locator(`.ofs-el[data-id="${id}"]`)).toBeVisible();
  await expect(stage.getByText('All together!')).toBeVisible();
  expect(iso.outside).toEqual([]);
  expect(iso.errors).toEqual([]);
});

for (const s of SHOWCASES) {
  test(`the hosted showcase file showcase/${s.id}.html opens with no network access`, async ({ page }) => {
    const iso = await isolate(page);
    await page.goto(`./showcase/${s.id}.html`);
    await page.waitForFunction(() => !!(window as unknown as { __ofs?: unknown }).__ofs);
    await expect(page.locator('.ofs-player')).toBeVisible();
    expect(iso.outside).toEqual([]);
    expect(iso.errors).toEqual([]);
  });
}
