/**
 * Records the raw footage for the promotional videos from the real app.
 *
 *   npm run video:capture [-- scene ...]
 *
 * Needs a fresh `npm run build:site` (it serves dist-site/: the landing page,
 * the editor under studio/ and the exported showcases). Every scene drives the
 * genuine editor or a genuine exported OneFile (opened from disk, offline) and
 * writes JPEG frames + timestamps + named marks to video/.cache/captures/.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { Hand, prepareContext, Recorder, SCALE, VIEWPORT } from './lib/recorder.ts';
import { serveStatic } from './lib/server.ts';
import { SCENES } from './scenes/index.ts';
import type { SceneContext } from './scenes/types.ts';

const root = path.resolve(import.meta.dirname, '..');
const siteDir = path.join(root, 'dist-site');
const cache = path.join(root, 'video', '.cache');
if (!fs.existsSync(path.join(siteDir, 'studio', 'index.html'))) {
  console.error('dist-site/ is missing — run `npm run build:site` first.');
  process.exit(1);
}
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(SCENES);
for (const n of names) if (!SCENES[n]) throw new Error(`Unknown scene "${n}". Known: ${Object.keys(SCENES).join(', ')}`);

const server = await serveStatic(siteDir);
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
const downloads = path.join(cache, 'downloads');
fs.mkdirSync(downloads, { recursive: true });

const ctx: SceneContext = {
  browser,
  site: server.url,
  siteDir,
  downloads,
  async newPage(opts = {}) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, acceptDownloads: true, reducedMotion: 'no-preference' });
    if (opts.cursor !== false) await prepareContext(context);
    if (opts.offline) await context.setOffline(true);
    const page = await context.newPage();
    page.on('pageerror', (e) => console.warn(`  [page error] ${e.message}`));
    return { page, context };
  },
  async record(page, name) {
    const rec = new Recorder(page, path.join(cache, 'captures', name), name);
    await rec.begin();
    return { rec, hand: new Hand(page) };
  },
};

try {
  for (const n of names) {
    const t0 = Date.now();
    process.stdout.write(`scene ${n} … `);
    await SCENES[n](ctx);
    console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
  await server.close();
}
