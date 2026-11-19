import { test, expect } from '@playwright/test';
import path from 'node:path';
import { embeddedProject, exportProject, importIntoStudio, normalise, openExported, openStudio, studioProject } from './helpers';

type AnyProject = {
  settings: { theme: string; backdrop: string };
  pages: Array<{
    background: { paint: { kind: string; color?: string; from?: string }; themed?: boolean };
    elements: Array<{ id: string; type: string; role?: string; themed?: string[]; props: Record<string, unknown> }>;
  }>;
};

const THEME_FONTS: Record<string, RegExp> = {
  playful: /Nunito/,
  professional: /Inter/,
  technical: /Space Grotesk/,
  editorial: /Fraunces/,
};

for (const theme of ['playful', 'professional', 'technical', 'editorial']) {
  test(`theme "${theme}" is applied, exported, works offline and survives reimport`, async ({ page, browser }) => {
    await openStudio(page);
    await page.getByTestId(`theme-${theme}`).click();
    await page.getByTestId('new-slides').click();
    await expect(page.locator('.ed-toolbar')).toBeVisible();
    await expect(page.getByTestId('theme-button')).toContainText(new RegExp(theme, 'i'));
    await page.getByTestId('tab-insert').click();
    await page.getByTestId('insert-heading').click();
    await page.getByTestId('insert-button').click();
    await page.getByTestId('insert-shape-rect').click();
    const before = (await studioProject(page)) as unknown as AnyProject;
    expect(before.settings.theme).toBe(theme);
    const heading = before.pages[0].elements.find((e) => e.type === 'text')!;
    expect(heading.role).toBe('heading');
    expect(heading.themed).toContain('color');

    const file = await exportProject(page, `theme-${theme}.html`);
    const html = (await import('node:fs')).readFileSync(file, 'utf8');
    expect(html).toMatch(THEME_FONTS[theme]); // the theme's font is embedded…
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/); // …and nothing remote is referenced

    const ex = await openExported(browser, file);
    const text = ex.page.locator(`.ofs-el[data-id="${heading.id}"] .ofs-text`);
    await expect(text).toBeVisible();
    expect(await text.evaluate((n) => getComputedStyle(n).fontFamily)).toMatch(THEME_FONTS[theme]);
    expect(await text.evaluate((n) => getComputedStyle(n).color)).not.toBe('');
    // The embedded font actually loaded (no fallback).
    const fontOk = await ex.page.evaluate(async (fam) => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => f.family.includes(fam) && f.status === 'loaded');
    }, THEME_FONTS[theme].source);
    expect(fontOk).toBe(true);
    expect(ex.requests).toEqual([]);
    expect(ex.errors).toEqual([]);
    await ex.close();

    await importIntoStudio(page, file);
    const after = await studioProject(page);
    expect(normalise(after)).toEqual(normalise(embeddedProject(file)));
    expect((after as unknown as AnyProject).settings.theme).toBe(theme);
    await expect(page.getByTestId('theme-button')).toContainText(new RegExp(theme, 'i'));
  });
}

test('switching themes restyles the canvas live and keeps explicit customisations', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('new-slides').click();
  await page.getByTestId('tab-insert').click();
  await page.getByTestId('insert-heading').click();
  await page.getByTestId('insert-body').click();
  // Customise the paragraph's colour in the inspector.
  await page.getByRole('button', { name: 'Colour #e84393' }).first().click();
  await expect(page.getByTestId('reset-theme')).toBeVisible();
  const canvasBg = () =>
    page
      .locator('.ed-page-bg, .ed-slide-frame, .ed-section-frame')
      .first()
      .evaluate((n) => getComputedStyle(n).backgroundColor);
  const bgBefore = await canvasBg();

  await page.getByTestId('theme-button').click();
  await page.getByTestId('theme-technical').click();
  await expect.poll(canvasBg).not.toBe(bgBefore);
  await page.getByTestId('theme-done').click();

  const p = (await studioProject(page)) as unknown as AnyProject;
  const [heading, body] = p.pages[0].elements;
  expect(p.settings.theme).toBe('technical');
  expect(heading.props.color).toBe('#e6edf7');
  expect(heading.props.font).toBe('grotesk');
  expect(body.props.color).toBe('#e84393'); // explicit choice kept
  expect(body.props.font).toBe('modern'); // non-customised props follow
  // Reset brings the paragraph back to the theme.
  await page.getByTestId('reset-theme').click();
  const p2 = (await studioProject(page)) as unknown as AnyProject;
  expect(p2.pages[0].elements[1].props.color).toBe('#9fb0c8');
  // Undo restores the custom colour.
  await page.getByTestId('undo').click();
  const p3 = (await studioProject(page)) as unknown as AnyProject;
  expect(p3.pages[0].elements[1].props.color).toBe('#e84393');
});

test('v0.1 exports import unchanged and can be restyled on request', async ({ page }) => {
  await importIntoStudio(page, path.resolve('tests/fixtures/v0.1/presentation.html'));
  const p = (await studioProject(page)) as unknown as AnyProject;
  expect(p.settings.theme).toBe('playful');
  expect(p.pages[0].background.paint).toEqual({ kind: 'linear', from: '#2b1b6b', to: '#6d4aff', angle: 135 });
  expect(p.pages.flatMap((pg) => pg.elements).every((e) => !e.themed)).toBe(true);
  await page.getByTestId('theme-button').click();
  await page.getByTestId('theme-editorial').click();
  // Nothing with pre-theme styling changes…
  const p2 = (await studioProject(page)) as unknown as AnyProject;
  expect(p2.pages[0].background.paint).toEqual(p.pages[0].background.paint);
  // …until the author asks to restyle everything.
  await page.getByTestId('theme-restyle-all').click();
  const p3 = (await studioProject(page)) as unknown as AnyProject;
  expect(p3.pages[0].background.themed).toBe(true);
  expect(p3.pages[0].background.paint).not.toEqual(p.pages[0].background.paint);
  const title = p3.pages[0].elements.find((e) => e.id === 'el_p_title')!;
  expect(title.props.font).toBe('elegant');
});
