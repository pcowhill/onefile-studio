import { describe, expect, it } from 'vitest';
import { createElement, createProject } from '../../src/model/factory';
import { validateProject } from '../../src/model/validate';
import { applyProjectTheme, countCustomized, getTheme, isThemeId } from '../../src/model/theme';
import { fontCssForProject } from '../../src/io/fonts';
import { buildStandaloneHtml } from '../../src/io/exportHtml';
import { addAssetDedup } from '../../src/io/assets';
import { svgAsset } from '../../src/examples/art';

/** Untrusted ids such as "constructor" or "__proto__" must never resolve to Object.prototype members. */
describe('prototype-key hardening', () => {
  it('rejects prototype keys as theme ids and background roles', () => {
    expect(isThemeId('constructor')).toBe(false);
    expect(isThemeId('toString')).toBe(false);
    const raw = JSON.parse(JSON.stringify(createProject('slides')));
    raw.settings.theme = 'constructor';
    raw.pages[0].background = { paint: { kind: 'solid', color: '#fff' }, role: 'constructor', themed: true };
    const r = validateProject(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.settings.theme).toBe('playful');
    expect(r.project.pages[0].background.role).toBeUndefined();
    applyProjectTheme(r.project, 'technical');
    expect(r.project.pages[0].background.paint).toEqual(getTheme('technical').backgrounds.base);
    expect(() => structuredClone(r.project)).not.toThrow();
    expect(() => countCustomized(r.project)).not.toThrow();
  });

  it('a "constructor" font id does not break export', () => {
    const p = createProject('slides');
    p.pages[0].elements.push(createElement('text', { props: { font: 'constructor' } }));
    expect(() => fontCssForProject(p)).not.toThrow();
    expect(() => buildStandaloneHtml(p, '')).not.toThrow();
  });

  it('drops an asset keyed "__proto__" instead of corrupting the asset map', () => {
    const p = createProject('slides');
    const a = svgAsset('x', 'x', '<svg xmlns="http://www.w3.org/2000/svg"/>', 1, 1);
    const raw = JSON.parse(JSON.stringify(p));
    raw.assets = JSON.parse(`{"__proto__": ${JSON.stringify({ ...a, id: '__proto__' })}}`);
    raw.pages[0].elements.push({ ...createElement('image'), props: { assetId: '__proto__' } });
    const r = validateProject(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.getPrototypeOf(r.project.assets)).toBe(Object.prototype);
    expect((r.project.pages[0].elements[0].props as { assetId: string }).assetId).toBe('');
  });

  it('de-duplication requires identical bytes, not just an equal stored hash', () => {
    const a = svgAsset('as_a', 'a', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', 1, 1);
    const b = { ...svgAsset('as_b', 'b', '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>', 1, 1), hash: a.hash };
    const assets = { [a.id]: a };
    expect(addAssetDedup(assets, b)).toBe('as_b');
    expect(addAssetDedup(assets, { ...a, id: 'as_c' })).toBe('as_a');
  });
});
