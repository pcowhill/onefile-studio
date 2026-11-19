import { describe, expect, it } from 'vitest';
import presentationHtml from '../fixtures/v0.1/presentation.html?raw';
import clickerHtml from '../fixtures/v0.1/clicker.html?raw';
import { createElement, createProject } from '../../src/model/factory';
import { validateProject } from '../../src/model/validate';
import { extractProjectData, importFromText } from '../../src/io/importHtml';
import { buildStandaloneHtml } from '../../src/io/exportHtml';
import {
  THEMES,
  THEME_IDS,
  applyProjectTheme,
  countCustomized,
  customize,
  customizedKeys,
  getTheme,
  resetElementToTheme,
  setElementRole,
  themeNewElement,
  themeValues,
} from '../../src/model/theme';
import { elementRegistry } from '../../src/runtime/elements';
import { renderContent } from '../../src/runtime/mount';
import { createStaticEnv } from '../../src/runtime/env';
import { parseHex } from '../../src/model/paint';
import type { Project, SceneElement } from '../../src/model/types';
import { SCHEMA_VERSION } from '../../src/model/types';

const FIXTURES: Record<string, string> = { 'presentation.html': presentationHtml, 'clicker.html': clickerHtml };
const fixture = (name: string) => FIXTURES[name];

function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const rgb = parseHex(c)!;
    const [r, g, bl] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const firstColor = (p: { kind: string; color?: string; from?: string }) => (p.kind === 'solid' ? p.color! : p.from!);

describe('theme definitions', () => {
  it('ships four distinct, complete themes', () => {
    expect(THEME_IDS).toEqual(['playful', 'professional', 'technical', 'editorial']);
    const signatures = new Set(THEME_IDS.map((id) => `${THEMES[id].colors.accent}|${THEMES[id].fonts.heading}|${THEMES[id].colors.bg}`));
    expect(signatures.size).toBe(4);
    for (const id of THEME_IDS) {
      const t = THEMES[id];
      expect(t.tones).toHaveLength(6);
      expect(t.chart.length).toBeGreaterThanOrEqual(6);
      for (const role of ['base', 'alt', 'hero', 'dark', 'accent'] as const) expect(t.backgrounds[role]).toBeTruthy();
    }
  });

  it('keeps text readable in every theme (WCAG contrast)', () => {
    for (const id of THEME_IDS) {
      const c = THEMES[id].colors;
      const bg = firstColor(THEMES[id].backgrounds.base);
      expect(contrast(c.text, bg), `${id} text`).toBeGreaterThanOrEqual(7);
      expect(contrast(c.muted, bg), `${id} muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.text, c.surface), `${id} text on surface`).toBeGreaterThanOrEqual(7);
      expect(contrast(c.heroText, firstColor(THEMES[id].backgrounds.hero)), `${id} hero text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.heroText, firstColor(THEMES[id].backgrounds.dark)), `${id} dark text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.onAccent, c.accent), `${id} button text`).toBeGreaterThanOrEqual(3);
      expect(contrast(c.accentText, bg), `${id} accent text`).toBeGreaterThanOrEqual(3);
    }
  });

  it('Playful equals the v0.1 element defaults, so the original look is preserved', () => {
    const t = getTheme('playful');
    const same = (type: string, role?: string, skip: string[] = []) => {
      const defaults = elementRegistry.get(type)!.defaults() as Record<string, unknown>;
      for (const [k, v] of Object.entries(themeValues(t, type, role))) if (!skip.includes(k)) expect(v, `${type}.${k}`).toEqual(defaults[k]);
    };
    same('image');
    same('button');
    same('navButton');
    same('shape', 'tone0', ['radius']);
    same('progress');
    same('arrow');
  });

  it('every element type renders in every theme', () => {
    for (const id of THEME_IDS) {
      const p = createProject('slides', 'T', id);
      for (const def of elementRegistry.all()) {
        const el = themeNewElement(createElement(def.id, { w: 400, h: 240 }), id);
        p.pages[0].elements.push(el);
        for (const mode of ['edit', 'play', 'thumb'] as const) {
          const r = renderContent(el, createStaticEnv(p, mode), document);
          expect(r.node).toBeInstanceOf(HTMLElement);
          r.destroy();
        }
      }
    }
  });
});

describe('theme provenance', () => {
  it('new elements follow the theme; switching restyles themed props only', () => {
    const p = createProject('slides', 'T', 'playful');
    const heading = themeNewElement(createElement<Record<string, unknown>>('text', { props: { text: 'Hi', size: 60 } }), 'playful', 'heading');
    const custom = themeNewElement(createElement<Record<string, unknown>>('text', { props: { text: 'Mine' } }), 'playful', 'body');
    customize(custom, { color: '#ff0000' });
    p.pages[0].elements.push(heading, custom);
    expect(heading.themed).toContain('color');
    expect(custom.themed).not.toContain('color');

    applyProjectTheme(p, 'technical');
    const t = getTheme('technical');
    expect(p.settings.theme).toBe('technical');
    expect(heading.props.color).toBe(t.colors.text);
    expect(heading.props.font).toBe(t.fonts.heading);
    expect(heading.props.size).toBe(60); // layout never follows the theme
    expect(custom.props.color).toBe('#ff0000'); // explicit choice preserved
    expect(custom.props.font).toBe(t.fonts.body); // ...but its other themed props still follow
    expect(p.pages[0].background.paint).toEqual(t.backgrounds.base);
    expect(p.settings.backdrop).toBe(t.colors.backdropSlides);
  });

  it('does not infer customisation from values that happen to match a theme', () => {
    const p = createProject('slides', 'T', 'playful');
    const el = themeNewElement(createElement('text'), 'playful', 'body');
    customize(el, { color: getTheme('playful').colors.muted }); // explicitly chosen, equal to the theme value
    p.pages[0].elements.push(el);
    applyProjectTheme(p, 'editorial');
    expect(el.props.color).toBe(getTheme('playful').colors.muted);
    expect(customizedKeys(el, getTheme('editorial'))).toEqual(['color']);
  });

  it('reset and role changes restore theme styling', () => {
    const t = getTheme('professional');
    const el = themeNewElement(createElement('button'), t);
    customize(el, { color: '#123456', radius: 'square' });
    expect(customizedKeys(el, t).sort()).toEqual(['color', 'radius']);
    resetElementToTheme(el, t);
    expect(customizedKeys(el, t)).toEqual([]);
    expect(el.props.color).toBe(t.colors.accent);
    setElementRole(el, 'secondary', t);
    expect((el.props as Record<string, unknown>).variant).toBe('soft');
  });

  it('theme, roles and provenance survive export → import', () => {
    const p = createProject('page', 'Round trip', 'editorial');
    const el = themeNewElement(createElement('text', { props: { text: 'Hello' } }), 'editorial', 'heading');
    customize(el, { color: '#112233' });
    p.pages[0].elements.push(el);
    const html = buildStandaloneHtml(p, '/* runtime */');
    const back = importFromText(html).project;
    expect(back.settings.theme).toBe('editorial');
    const e2 = back.pages[0].elements[0];
    expect(e2.role).toBe('heading');
    expect(e2.themed).toEqual(el.themed);
    expect(e2.props).toEqual(el.props);
    expect(back.pages[0].background).toEqual(p.pages[0].background);
  });

  it('rejects unknown themes and junk provenance on import', () => {
    const p = createProject('slides');
    const raw = JSON.parse(JSON.stringify(p));
    raw.settings.theme = 'evil<script>';
    raw.pages[0].elements.push({ ...createElement('text'), role: 'x y z <b>', themed: ['color', 'nope', 42, 'color'] });
    const r = validateProject(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.settings.theme).toBe('playful');
    const el = r.project.pages[0].elements[0];
    expect(el.role).toBeUndefined();
    expect(el.themed).toEqual(['color']);
  });
});

describe('v1 → v2 migration (real v0.1 exports)', () => {
  for (const name of ['presentation.html', 'clicker.html']) {
    it(`${name}: imports without changing appearance or content`, () => {
      const raw = extractProjectData(fixture(name)) as Record<string, unknown>;
      expect(raw.version).toBe(1);
      const r = validateProject(raw);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const p = r.project;
      expect(r.warnings).toEqual([]);
      expect(p.version).toBe(SCHEMA_VERSION);
      expect(p.settings.theme).toBe('playful');
      expect(p.settings.backdrop).toBe((raw.settings as Project['settings']).backdrop);
      const rawPages = raw.pages as Project['pages'];
      expect(p.pages.length).toBe(rawPages.length);
      p.pages.forEach((page, i) => {
        expect(page.background.paint).toEqual(rawPages[i].background.paint);
        expect(page.background.themed).toBeUndefined();
        expect(page.elements.length).toBe(rawPages[i].elements.length);
        page.elements.forEach((el, j) => {
          const before = rawPages[i].elements[j] as SceneElement;
          expect(el.themed).toBeUndefined();
          expect(el.interactions).toEqual(before.interactions);
          // Every stored prop is unchanged (new props only get defaults).
          for (const [k, v] of Object.entries(before.props)) expect((el.props as Record<string, unknown>)[k], `${el.id}.${k}`).toEqual(v);
        });
      });
      expect(Object.keys(p.assets)).toEqual(Object.keys(raw.assets as object));
      // Switching theme leaves explicit (pre-theme) styling alone…
      const kept = JSON.stringify(p.pages.map((pg) => pg.elements.map((e) => e.props)));
      applyProjectTheme(p, 'technical');
      expect(JSON.stringify(p.pages.map((pg) => pg.elements.map((e) => e.props)))).toBe(kept);
      expect(countCustomized(p)).toBeGreaterThan(0);
      // …until the author explicitly restyles everything.
      applyProjectTheme(p, 'technical', { resetCustom: true });
      expect(countCustomized(p)).toBe(0);
      expect(p.pages[0].background.themed).toBe(true);
    });
  }

  it('refuses files from a newer schema', () => {
    const p = createProject('slides');
    const r = validateProject({ ...p, version: SCHEMA_VERSION + 1 });
    expect(r.ok).toBe(false);
  });
});
