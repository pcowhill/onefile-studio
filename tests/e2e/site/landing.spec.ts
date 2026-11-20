import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SHOWCASES } from '../../../src/showcase/meta';

/**
 * v0.6 public site: the landing page (dist-site/index.html), its links into the
 * editor (studio/), "Try it" (the exported showcase OneFiles), "Open in
 * editor", browser history, direct routes and draft preservation.
 * Needs `npm run build:site`.
 */

const studioProject = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ofsStudio: { project(): { id: string; meta: { title: string } } | null } }).__ofsStudio.project());

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test('the landing page loads: hero, value strip, six showcase cards, templates, lessons, no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await expect(page).toHaveTitle(/OneFile Studio/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Make it interactive\.\s*Share it as\s*one file\./);
  await expect(page.locator('h1')).toHaveCount(1);
  // Primary actions
  await expect(page.getByTestId('hero-start')).toHaveAttribute('href', 'studio/');
  await expect(page.getByTestId('hero-examples')).toHaveAttribute('href', '#examples');
  // Hero video: poster, MP4 source, captions track, controls, muted.
  const hero = page.getByTestId('hero-video');
  await expect(hero).toHaveAttribute('poster', 'media/hero.webp');
  await expect(hero.locator('source')).toHaveAttribute('src', 'media/hero.mp4');
  await expect(hero.locator('track[kind=captions]')).toHaveAttribute('src', 'media/hero.vtt');
  expect(await hero.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  await expect(page.getByRole('group', { name: 'Video controls' }).getByRole('button')).toHaveCount(3);
  // Showcase gallery: one card per registry entry, each with poster, Try it and Open in editor.
  const cards = page.locator('.sc-card');
  await expect(cards).toHaveCount(SHOWCASES.length);
  for (const s of SHOWCASES) {
    const card = page.locator(`#sc-${s.id}`);
    await expect(card.locator('h3')).toHaveText(s.title);
    await expect(card.locator('video')).toHaveAttribute('poster', `media/showcase/${s.id}.webp`);
    await expect(card.getByRole('link', { name: 'Try it' })).toHaveAttribute('href', `#try/${s.id}`);
    await expect(card.getByRole('link', { name: /Open in editor/ })).toHaveAttribute('href', `studio/?open=${s.id}`);
  }
  await expect(page.getByTestId('template-row').locator('li')).toHaveCount(5);
  await expect(page.getByTestId('lesson-levels').locator('li')).toHaveCount(8);
  await expect(page.getByTestId('download-editor')).toHaveAttribute('download', 'OneFile-Studio.html');
  // A first-time visitor (fresh browser) is not greeted as a returning user.
  await expect(page.getByTestId('welcome-back')).toBeHidden();
  await expect(page.getByTestId('nav-start')).toHaveText('Start creating');
  // Every image has alt text and every button an accessible name.
  for (const img of await page.locator('img').all()) expect(await img.getAttribute('alt')).toBeTruthy();
  for (const b of await page.locator('button').all()) expect((await b.getAttribute('aria-label')) ?? (await b.innerText()).trim()).toBeTruthy();
  // Every media file the page references exists.
  const urls = await page.evaluate(() =>
    [...document.querySelectorAll('[poster],[data-src],source[src],track[src],img[src]')].flatMap((n) =>
      ['poster', 'data-src', 'src'].map((a) => n.getAttribute(a)).filter((v): v is string => !!v && !v.startsWith('data:')),
    ),
  );
  for (const u of new Set(urls)) expect((await page.request.get(u)).status(), u).toBe(200);
  expect(errors).toEqual([]);
});

test('navigation: section links, Start creating, Learn and Templates open the right places; back returns', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Examples' }).click();
  await expect(page).toHaveURL(/#examples$/);
  await expect(page.getByRole('heading', { name: 'Try one. Then make it yours.' })).toBeInViewport();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'How it works' }).click();
  await expect(page.locator('#how h2')).toBeInViewport();

  // Start creating → the editor's start screen.
  await page.getByTestId('nav-start').click();
  await expect(page).toHaveURL(/\/studio\/$/);
  await expect(page.getByText('What will you')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Learn → the Learn hub, ready to start a lesson.
  await page.getByTestId('hero-learn').click();
  await expect(page).toHaveURL(/studio\/\?panel=learn$/);
  await expect(page.getByRole('dialog', { name: 'Learn' })).toBeVisible();
  await expect(page.getByTestId('lesson-first-onefile')).toBeVisible();
  await page.goBack();

  // Templates → the template gallery.
  await page.getByTestId('browse-templates').click();
  await expect(page).toHaveURL(/studio\/\?panel=templates$/);
  await expect(page.getByTestId('template-grid')).toBeVisible();
  // From the editor's start screen, "Showcase" leads back to the landing page.
  await page.getByRole('dialog', { name: 'Templates' }).press('Escape');
  await page.getByTestId('site-home').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);
});

test('Try it plays the real exported OneFile in a dialog; Back closes it, Forward reopens it', async ({ page }) => {
  await page.goto('./');
  const card = page.locator('#sc-feed-puff');
  await card.getByRole('link', { name: 'Try it' }).click();
  const dialog = page.getByTestId('try-dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#try\/feed-puff$/);
  await expect(dialog.getByRole('heading', { name: 'Feed Puff!' })).toBeVisible();
  await expect(dialog.locator('#try-download')).toHaveAttribute('href', 'showcase/feed-puff.html');
  await expect(dialog.locator('#try-open')).toHaveAttribute('href', 'studio/?open=feed-puff');
  const frame = page.frameLocator('[data-testid=try-frame]');
  // The iframe is the exported file itself (its own CSP and embedded project).
  await expect(frame.locator('script#ofs-project')).toHaveCount(1);
  const puff = frame.locator('.ofs-el[data-id="el_c_puff"]');
  for (let i = 0; i < 3; i++) await puff.click();
  await expect(frame.getByText('Score: 3')).toBeVisible();
  await puff.click({ button: 'right' });
  await expect(frame.getByText('Score: 8')).toBeVisible();

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-testid=try-frame]')).toHaveCount(0);
  await page.goForward();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close and return to the gallery' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/#try/);
});

test('a #try/<id> link opens the showcase directly (deep link), including the 3D explorer', async ({ page }) => {
  await page.goto('./#try/3d-explorer');
  const dialog = page.getByTestId('try-dialog');
  await expect(dialog).toBeVisible();
  const frame = page.frameLocator('[data-testid=try-frame]');
  await expect(frame.locator('.ofs-el[data-id="el_m_viewer"] canvas')).toBeVisible({ timeout: 20_000 });
  await frame.getByRole('button', { name: 'Mast camera', exact: true }).click();
  await expect(frame.locator('.ofs-el[data-id="el_m_info_mast"]')).toBeVisible();
  // Esc closes the dialog, also while the OneFile has keyboard focus.
  await frame.locator('.ofs-el[data-id="el_m_title"]').click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Open in editor makes an independent, editable copy; a refresh keeps editing that copy', async ({ page }) => {
  await page.goto('./');
  await page
    .locator('#sc-before-after')
    .getByRole('link', { name: /Open in editor/ })
    .click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  await expect(page).toHaveURL(/\/studio\/$/); // the ?open parameter is consumed
  const first = (await studioProject(page))!;
  expect(first.meta.title).toBe('The Valley, Restored');
  expect(first.id).not.toBe('prj_example_before_after');
  await expect(page.locator('.ed-el[data-id="el_b_compare"]')).toHaveCount(1);
  // Edit it.
  const title = page.locator('.ed-el[data-id="el_b_title"]');
  await title.dblclick();
  await page.locator('textarea.ed-inline-text').fill('My valley');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ed-toolbar').getByText('Saved', { exact: true })).toBeVisible();
  // Refresh: the same copy (with the edit) is still open — no second copy.
  await page.reload();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  const again = (await studioProject(page))!;
  expect(again.id).toBe(first.id);
  await expect(page.locator('.ed-el[data-id="el_b_title"] .ofs-text-body')).toHaveText('My valley');
  // A second "Open in editor" makes another, separate copy.
  await page.goto('./');
  await page
    .locator('#sc-before-after')
    .getByRole('link', { name: /Open in editor/ })
    .click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  const second = (await studioProject(page))!;
  expect(second.id).not.toBe(first.id);
  await expect(page.locator('.ed-el[data-id="el_b_title"] .ofs-text-body')).not.toHaveText('My valley');
});

test('drafts survive moving between the landing page and the editor; direct routes and old bookmarks work', async ({ page }) => {
  await page.goto('./studio/');
  await expect(page.getByText('What will you')).toBeVisible();
  await page.getByTestId('new-slides').click();
  await page.getByTestId('quick-heading').click();
  await page.getByLabel('Project title').fill('My draft');
  await expect(page.locator('.ed-toolbar').getByText('Saved', { exact: true })).toBeVisible();
  const id = (await studioProject(page))!.id;

  // Landing page: recognises a returning user.
  await page.goto('./');
  await expect(page.getByTestId('welcome-back')).toBeVisible();
  await expect(page.getByTestId('nav-start')).toHaveText('Open the studio');
  // Back to the editor: the draft re-opens.
  await page.getByTestId('nav-start').click();
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  expect((await studioProject(page))!.id).toBe(id);
  await expect(page.getByLabel('Project title')).toHaveValue('My draft');
  // The start screen still lists it after a showcase was opened.
  await page.goto('./studio/?open=feed-puff');
  await expect(page.locator('.ed-toolbar')).toBeVisible();
  await page.goto('./studio/?home');
  await expect(page.locator('.st-recent')).toContainText('My draft');
  await expect(page.locator('.st-recent')).toContainText('Feed Puff!');

  // Old bookmark of the editor at the site root.
  await page.goto('./?home');
  await expect(page).toHaveURL(/studio\/\?home$/);
  await expect(page.getByText('What will you')).toBeVisible();
  // A deep link with an unknown showcase falls back to the start screen.
  await page.goto('./studio/?open=nope');
  await expect(page.getByText('What will you')).toBeVisible();
  await expect(page.getByText('That showcase could not be found')).toBeVisible();
  // The examples route points at the gallery.
  await page.goto('./examples/');
  await expect(page).toHaveURL(/#examples$/);
});

test('videos: clips load only when asked to play, one plays at a time, and the hero respects reduced motion', async ({ page, browser }) => {
  await page.goto('./');
  const clips = page.locator('video.sc-video');
  // Nothing downloaded up front.
  for (const v of await clips.all()) expect(await v.getAttribute('src')).toBeNull();
  // The hero plays muted when visible.
  const hero = page.getByTestId('hero-video');
  await expect.poll(() => hero.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.3);
  const info = await hero.evaluate((v: HTMLVideoElement) => ({ w: v.videoWidth, h: v.videoHeight, d: v.duration }));
  expect(info).toMatchObject({ w: 1920, h: 1080 });
  expect(info.d).toBeGreaterThan(30);
  expect(info.d).toBeLessThan(50);
  // A chapter button seeks the tour.
  await page.getByRole('button', { name: /Export/ }).click();
  await expect.poll(() => hero.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(26);

  // Hovering a card plays its clip (and pauses the hero); the button toggles it.
  const card = page.locator('#sc-event');
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  const clip = card.locator('video');
  await expect(clip).toHaveAttribute('src', 'media/showcase/event.mp4');
  await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.2);
  expect(await hero.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  const dims = await clip.evaluate((v: HTMLVideoElement) => [v.videoWidth, v.videoHeight]);
  expect(dims).toEqual([1280, 720]);
  // The clip shows real pictures (not a blank frame).
  const spread = await clip.evaluate((v: HTMLVideoElement) => {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 90;
    const g = c.getContext('2d')!;
    g.drawImage(v, 0, 0, 160, 90);
    const d = g.getImageData(0, 0, 160, 90).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      min = Math.min(min, l);
      max = Math.max(max, l);
    }
    return max - min;
  });
  expect(spread).toBeGreaterThan(60);
  const btn = card.getByRole('button', { name: /demo clip/ });
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');

  // Reduced motion: nothing starts by itself (the poster shows); hovering does not autoplay clips.
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const p2 = await ctx.newPage();
  await p2.goto(page.url().replace(/#.*$/, ''));
  await p2.waitForTimeout(1500);
  expect(await p2.getByTestId('hero-video').evaluate((v: HTMLVideoElement) => v.paused && v.currentTime === 0)).toBe(true);
  // The tour starts when asked to, and the controls pause it and show captions.
  await p2.getByTestId('hero-play-big').click();
  await expect.poll(() => p2.getByTestId('hero-video').evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.2);
  await expect(p2.getByTestId('hero-play-big')).toBeHidden();
  await p2.getByTestId('hero-play').click();
  expect(await p2.getByTestId('hero-video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await p2.getByRole('button', { name: 'Captions' }).click();
  expect(await p2.getByTestId('hero-video').evaluate((v: HTMLVideoElement) => v.textTracks[0].mode)).toBe('showing');
  await p2.locator('#sc-event').hover();
  await p2.waitForTimeout(500);
  expect(await p2.locator('#sc-event video').getAttribute('src')).toBeNull();
  // …but the play button still works.
  await p2
    .locator('#sc-event')
    .getByRole('button', { name: /demo clip/ })
    .click();
  await expect.poll(() => p2.locator('#sc-event video').evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.2);
  await ctx.close();
});

for (const vp of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
]) {
  test(`responsive layout on a ${vp.name}: no sideways scrolling, the menu works`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: vp.width < 500 });
    const page = await ctx.newPage();
    await page.goto('./');
    // A mobile browser widens the layout viewport (and zooms out) if anything is too wide.
    expect(await page.evaluate(() => window.innerWidth)).toBe(vp.width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(nav.getByRole('link', { name: 'Templates' })).toBeVisible();
    await nav.getByRole('link', { name: 'Examples' }).click();
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.sc-card').first()).toBeInViewport();
    // Try it fills the screen on small devices.
    await page.locator('#sc-feed-puff').getByRole('link', { name: 'Try it' }).click();
    const box = (await page.getByTestId('try-dialog').boundingBox())!;
    expect(box.width).toBeGreaterThan(vp.width * 0.95);
    await ctx.close();
  });
}
