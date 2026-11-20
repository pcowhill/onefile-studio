import { describe, expect, it } from 'vitest';
import runtime from 'virtual:ofs-runtime';
import model3d from 'virtual:ofs-runtime-3d';
import { SHOWCASES, buildShowcase, getShowcase } from '../../src/showcase';
import { exportShowcase } from '../../src/showcase/export';
import { EXAMPLES } from '../../src/examples';
import { validateProject } from '../../src/model/validate';
import { importFromText } from '../../src/io/importHtml';
import { findAssetIssues } from '../../src/io/exportPlan';
import { usesModels } from '../../src/io/exportHtml';
import { readDeepLink, siteHomeUrl, withoutOpenParam } from '../../src/editor/deepLink';
import { mountPlayer, tick } from './helpers';

describe('showcase registry', () => {
  it('has six showcases with unique ids, each backed by a registered example', () => {
    expect(SHOWCASES).toHaveLength(6);
    expect(new Set(SHOWCASES.map((s) => s.id)).size).toBe(6);
    expect(new Set(SHOWCASES.map((s) => s.file)).size).toBe(6);
    for (const s of SHOWCASES) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(
        EXAMPLES.some((e) => e.id === s.example),
        s.id,
      ).toBe(true);
      expect(s.file).toMatch(/^[A-Za-z0-9.-]+\.html$/);
      expect(s.description.length).toBeLessThan(140);
      expect(getShowcase(s.id)).toBe(s);
    }
    expect(getShowcase('nope')).toBeUndefined();
    expect(buildShowcase('nope')).toBeUndefined();
  });

  for (const s of SHOWCASES) {
    describe(s.title, () => {
      it('is an ordinary, valid project in the declared format with every file present', () => {
        const p = buildShowcase(s.id)!;
        const r = validateProject(JSON.parse(JSON.stringify(p)));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.warnings).toEqual([]);
        expect(p.kind).toBe(s.format);
        // The card's title is (the start of) the project's own title.
        expect(p.meta.title).toContain(s.title);
        expect(findAssetIssues(p)).toEqual({ problems: [], empty: [] });
      });

      it('builds a fresh copy every time (editing one never changes the showcase)', () => {
        const a = buildShowcase(s.id)!;
        const b = buildShowcase(s.id)!;
        expect(a).not.toBe(b);
        a.pages[0].elements[0].name = 'changed';
        expect(buildShowcase(s.id)!.pages[0].elements[0].name).not.toBe('changed');
      });

      it('exports a standalone OneFile that re-imports to the same project and plays', async () => {
        const html = exportShowcase(s.id, { core: runtime, model3d });
        expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
        expect(html).not.toMatch(/\b(src|href)="https?:/);
        const project = buildShowcase(s.id)!;
        // The 3D add-on is embedded only when the project shows a model.
        expect(html.includes(model3d.slice(0, 200))).toBe(usesModels(project));
        const { project: back, warnings } = importFromText(html);
        expect(warnings).toEqual([]);
        expect(back.pages.map((pg) => pg.elements.map((e) => [e.id, e.type, e.interactions.length]))).toEqual(
          project.pages.map((pg) => pg.elements.map((e) => [e.id, e.type, e.interactions.length])),
        );
        expect(back.variables).toEqual(project.variables);
        const { host, player } = mountPlayer(back);
        await tick();
        expect(host.querySelectorAll('.ofs-el').length).toBeGreaterThan(3);
        player.destroy();
      });
    });
  }
});

describe('editor deep links', () => {
  it('reads open / panel / home and ignores anything unsafe', () => {
    expect(readDeepLink('')).toBeNull();
    expect(readDeepLink('?open=feed-puff')).toEqual({ kind: 'open', id: 'feed-puff' });
    expect(readDeepLink('?panel=templates')).toEqual({ kind: 'panel', panel: 'templates' });
    expect(readDeepLink('?panel=learn')).toEqual({ kind: 'panel', panel: 'learn' });
    expect(readDeepLink('?home')).toEqual({ kind: 'home' });
    // A malformed link still shows the start screen rather than re-opening a draft.
    expect(readDeepLink('?open=<script>')).toEqual({ kind: 'home' });
    expect(readDeepLink('?panel=admin')).toEqual({ kind: 'home' });
    expect(readDeepLink('?utm=x')).toBeNull();
  });

  it('removes only the open parameter from the address', () => {
    expect(withoutOpenParam('https://x.io/app/studio/?open=feed-puff')).toBe('/app/studio/');
    expect(withoutOpenParam('https://x.io/studio/?open=a&lang=en#k')).toBe('/studio/?lang=en#k');
  });

  it('links back to the site only from its /studio/ folder over http(s)', () => {
    expect(siteHomeUrl({ protocol: 'https:', pathname: '/onefile-studio/studio/' })).toBe('../');
    expect(siteHomeUrl({ protocol: 'https:', pathname: '/onefile-studio/studio/index.html' })).toBe('../');
    expect(siteHomeUrl({ protocol: 'https:', pathname: '/onefile-studio/' })).toBeNull();
    expect(siteHomeUrl({ protocol: 'file:', pathname: '/home/me/studio/index.html' })).toBeNull();
  });
});
