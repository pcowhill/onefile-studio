import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * v0.7: the editor sizes itself to its mounting root, not to the viewport.
 *
 * The host page below is the documented embedding contract (docs/EMBEDDING.md):
 * the real built editor (dist/index.html, unchanged) with a host header and
 * footer around <div id="root"> and a few lines of host CSS that give #root
 * the space between them.
 */
const HOST_CSS = `
  html, body { height: 100%; margin: 0; }
  .app-shell { height: 100dvh; display: flex; flex-direction: column; }
  .header, .footer { flex: 0 0 auto; }
  .header { height: 96px; background: #123; color: #fff; }
  .footer { height: 72px; background: #321; color: #fff; }
  #root { flex: 1 1 auto; min-height: 0; min-width: 0; }
`;

/** Replaces the LAST occurrence (the inlined editor script contains HTML templates of its own). */
function replaceLast(s: string, find: string, by: string): string {
  const i = s.lastIndexOf(find);
  if (i < 0) throw new Error(`dist/index.html has no ${find}`);
  return s.slice(0, i) + by + s.slice(i + find.length);
}

function hostHtml(): string {
  const editor = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
  const withCss = replaceLast(editor, '</head>', `<style id="host-css">${HOST_CSS}</style></head>`);
  return replaceLast(
    withCss,
    '<div id="root"></div>',
    '<div class="app-shell"><header class="header" data-testid="host-header">Host header</header><div id="root"></div><footer class="footer" data-testid="host-footer">Host footer</footer></div>',
  );
}

async function openHost(page: Page, query = '?home') {
  const html = hostHtml();
  await page.route('**/embed-host.html*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto(`./embed-host.html${query}`);
}

interface Rects {
  vh: number;
  vw: number;
  docScroll: number;
  header: DOMRect;
  footer: DOMRect;
  root: DOMRect;
  app: DOMRect | null;
}

async function rects(page: Page, appSelector: string): Promise<Rects> {
  return page.evaluate((sel) => {
    const r = (s: string) => document.querySelector(s)?.getBoundingClientRect().toJSON() ?? null;
    return {
      vh: window.innerHeight,
      vw: window.innerWidth,
      docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      header: r('.header'),
      footer: r('.footer'),
      root: r('#root'),
      app: r(sel),
    };
  }, appSelector) as Promise<Rects>;
}

function expectFits(r: Rects, header = 96, footer = 72) {
  expect(r.docScroll).toBeLessThanOrEqual(0);
  expect(r.header.top).toBeCloseTo(0, 0);
  expect(r.header.height).toBeCloseTo(header, 0);
  expect(r.footer.height).toBeCloseTo(footer, 0);
  expect(r.footer.bottom).toBeCloseTo(r.vh, 0);
  expect(r.root.top).toBeCloseTo(header, 0);
  expect(r.root.height).toBeCloseTo(r.vh - header - footer, 0);
  expect(r.app).not.toBeNull();
  const app = r.app!;
  expect(app.top).toBeGreaterThanOrEqual(r.root.top - 0.5);
  expect(app.bottom).toBeLessThanOrEqual(r.root.bottom + 0.5);
  expect(app.height).toBeCloseTo(r.root.height, 0);
  expect(app.bottom).toBeLessThanOrEqual(r.footer.top + 0.5);
}

for (const vp of [
  { width: 1440, height: 900, dpr: 1 },
  { width: 1280, height: 720, dpr: 2 },
  { width: 1920, height: 1080, dpr: 1.5 },
]) {
  test.describe(`embedded at ${vp.width}×${vp.height} @${vp.dpr}x`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });

    test('start screen and editor fit between the host header and footer', async ({ page }) => {
      await openHost(page);
      await expect(page.getByText('What will you')).toBeVisible();
      await expect(page.getByTestId('host-header')).toBeVisible();
      await expect(page.getByTestId('host-footer')).toBeVisible();
      expectFits(await rects(page, '.st'));

      // The start screen scrolls inside its own box, never the host document.
      const st = await page.evaluate(() => {
        const el = document.querySelector('.st') as HTMLElement;
        el.scrollTop = 10_000;
        return { top: el.scrollTop, docTop: document.scrollingElement!.scrollTop };
      });
      expect(st.top).toBeGreaterThan(0);
      expect(st.docTop).toBe(0);

      await page.getByTestId('new-slides').click();
      await expect(page.locator('.ed-toolbar')).toBeVisible();
      expectFits(await rects(page, '.ed-app'));

      // Toolbar, panels and the canvas all live inside the allocated area.
      const inner = await page.evaluate(() => {
        const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const root = r('#root');
        return ['.ed-toolbar', '.ed-left', '.ed-center', '.ed-right', '.ed-zoom'].map((s) => {
          const b = r(s);
          return { s, ok: b.top >= root.top - 0.5 && b.bottom <= root.bottom + 0.5 && b.height > 0 };
        });
      });
      for (const i of inner) expect(i, i.s).toEqual({ s: i.s, ok: true });

      // The slide is fitted to the canvas actually available (zoom-to-fit).
      const fit = await page.evaluate(() => {
        const c = document.querySelector('.ed-center')!.getBoundingClientRect();
        const slide = document.querySelector('.ed-page, .ed-slide, .ed-stage')?.getBoundingClientRect();
        return { c: c.toJSON(), slide: slide?.toJSON() };
      });
      if (fit.slide) {
        expect(fit.slide.bottom).toBeLessThanOrEqual(fit.c.bottom + 1);
        expect(fit.slide.top).toBeGreaterThanOrEqual(fit.c.top - 1);
      }

      // The inspector's own panel scrolls (not the document).
      const scrolled = await page.evaluate(() => {
        const el = document.querySelector('.ed-insp-scroll') as HTMLElement | null;
        if (!el) return null;
        el.scrollTop = 10_000;
        return { can: el.scrollHeight > el.clientHeight, top: el.scrollTop, docTop: document.scrollingElement!.scrollTop };
      });
      expect(scrolled).not.toBeNull();
      if (scrolled!.can) expect(scrolled!.top).toBeGreaterThan(0);
      expect(scrolled!.docTop).toBe(0);
      expect((await rects(page, '.ed-app')).docScroll).toBeLessThanOrEqual(0);
    });
  });
}

test('the editor follows the host when the header and footer change height', async ({ page }) => {
  await openHost(page);
  await page.getByTestId('new-slides').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  expectFits(await rects(page, '.ed-app'));
  const zoomBefore = await page.evaluate(
    () => (window as unknown as { __ofsStudio: { project(): unknown } }).__ofsStudio && document.querySelector('.ed-zoom-val')!.textContent,
  );

  await page.evaluate(() => {
    (document.querySelector('.header') as HTMLElement).style.height = '300px';
    (document.querySelector('.footer') as HTMLElement).style.height = '180px';
  });
  await expect.poll(async () => (await rects(page, '.ed-app')).app!.height).toBeCloseTo(900 - 300 - 180, 0);
  expectFits(await rects(page, '.ed-app'), 300, 180);
  // Zoom-to-fit re-fitted the slide to the smaller canvas (no reload).
  await expect.poll(() => page.locator('.ed-zoom-val').textContent()).not.toBe(zoomBefore);

  await page.evaluate(() => {
    (document.querySelector('.header') as HTMLElement).style.height = '40px';
    (document.querySelector('.footer') as HTMLElement).style.height = '30px';
  });
  await expect.poll(async () => (await rects(page, '.ed-app')).app!.height).toBeCloseTo(900 - 40 - 30, 0);
  expectFits(await rects(page, '.ed-app'), 40, 30);

  // Resizing the browser window resizes the editor too.
  await page.setViewportSize({ width: 1300, height: 760 });
  await expect.poll(async () => (await rects(page, '.ed-app')).app!.height).toBeCloseTo(760 - 40 - 30, 0);
  expectFits(await rects(page, '.ed-app'), 40, 30);
});

test('embedded: a grid host layout works too', async ({ page }) => {
  const html = hostHtml().replace(
    '<style id="host-css">',
    '<style>.app-shell{display:grid!important;grid-template-rows:auto minmax(0,1fr) auto}#root{min-height:0}</style><style id="host-css">',
  );
  await page.route('**/embed-grid.html*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('./embed-grid.html?home');
  await page.getByTestId('new-slides').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  expectFits(await rects(page, '.ed-app'));
});

test('standalone editor still fills the viewport without document scrolling', async ({ page }) => {
  await page.goto('./?home');
  await expect(page.getByText('What will you')).toBeVisible();
  const st = await page.evaluate(() => ({
    h: document.querySelector('.st')!.getBoundingClientRect().height,
    vh: innerHeight,
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(st.h).toBeCloseTo(st.vh, 0);
  expect(st.docScroll).toBeLessThanOrEqual(0);
  await page.getByTestId('new-page').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  const ed = await page.evaluate(() => ({
    r: document.querySelector('.ed-app')!.getBoundingClientRect().toJSON(),
    vh: innerHeight,
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(ed.r.top).toBe(0);
  expect(ed.r.height).toBeCloseTo(ed.vh, 0);
  expect(ed.docScroll).toBeLessThanOrEqual(0);
  // Overlays still cover the whole window (Preview is deliberately full-screen).
  await page
    .getByRole('button', { name: /Preview/ })
    .first()
    .click();
  const pv = await page.evaluate(() => document.querySelector('.ed-preview')!.getBoundingClientRect().toJSON());
  expect(pv.height).toBeCloseTo(ed.vh, 0);
});
