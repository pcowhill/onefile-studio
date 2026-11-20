import { describe, expect, it } from 'vitest';
import runtime from 'virtual:ofs-runtime';
import { TEMPLATES, TEMPLATE_CATEGORIES, getTemplate, instantiateTemplate } from '../../src/templates';
import type { CoachContext } from '../../src/templates';
import { findElement, sampleEventDate, zonedInstant } from '../../src/templates/projects';
import { validateProject } from '../../src/model/validate';
import { THEME_IDS } from '../../src/model/theme';
import { buildStandaloneHtml, pruneUnusedAssets } from '../../src/io/exportHtml';
import { findAssetIssues } from '../../src/io/exportPlan';
import { importFromText } from '../../src/io/importHtml';
import { mountPlayer, tick } from './helpers';
import type { Project } from '../../src/model/types';

const ctx = (project: Project, initial: Project, events: string[] = []): CoachContext => ({
  project,
  initial,
  stepStart: initial,
  events: new Set(events),
  stepEvents: new Set(events),
  selection: [],
});

describe('template registry', () => {
  it('has the six templates with unique ids in known categories', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['feature-walkthrough', 'meeting', 'technical-explainer', 'before-after', 'event', 'greeting']);
    const cats = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const t of TEMPLATES) {
      expect(cats.has(t.category)).toBe(true);
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.description.length).toBeLessThan(140);
    }
    // Every category (besides All) has at least one template.
    for (const c of TEMPLATE_CATEGORIES.filter((c) => c.id !== 'all')) expect(TEMPLATES.some((t) => t.category === c.id)).toBe(true);
  });

  for (const def of TEMPLATES) {
    describe(def.title, () => {
      it('builds a valid project without validator warnings, in its declared kind and theme', () => {
        const p = def.build();
        const r = validateProject(JSON.parse(JSON.stringify(p)));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.warnings).toEqual([]);
        expect(p.kind).toBe(def.kind);
        expect(p.settings.theme).toBe(def.theme);
        expect(findAssetIssues(p)).toEqual({ problems: [], empty: [] });
      });

      it('has meaningful element names and guide targets that exist', () => {
        const p = def.build();
        for (const page of p.pages) for (const e of page.elements) expect(e.name).not.toMatch(/^(text|shape|image|button|Text \d+)$/);
        for (const step of def.guide) if (step.element) expect(findElement(p, step.element), step.id).not.toBeNull();
      });

      it('creates independent copies with fresh ids; the original never changes', () => {
        const pristine = JSON.stringify(def.build());
        const a = instantiateTemplate(def);
        const b = instantiateTemplate(def);
        expect(a.id).not.toBe(b.id);
        a.pages[0].elements[0].name = 'changed';
        expect(b.pages[0].elements[0].name).not.toBe('changed');
        const again = def.build();
        // Same structure every time (ids of the template are stable; dates may move for the countdown).
        expect(JSON.stringify(again).length).toBe(pristine.length);
        expect(getTemplate(def.id)).toBe(def);
      });

      it('guide steps start undone and complete from real edits/events', () => {
        const initial = instantiateTemplate(def);
        const project = JSON.parse(JSON.stringify(initial)) as Project;
        for (const s of def.guide) if (s.done) expect(s.done(ctx(project, initial)), s.id).toBe(false);
        // Simulate the edits each step asks for.
        for (const s of def.guide) {
          if (!s.element) continue;
          const f = findElement(project, s.element)!;
          const props = f.el.props as Record<string, unknown>;
          for (const k of ['text', 'label', 'assetId', 'before', 'after', 'series', 'target'])
            if (k in props) props[k] = k === 'series' ? [] : `${String(props[k])}-edited`;
        }
        project.settings.theme = project.settings.theme === 'playful' ? 'editorial' : 'playful';
        for (const s of def.guide) if (s.done) expect(s.done(ctx(project, initial, ['preview', 'export'])), s.id).toBe(true);
      });

      it('restyles in every theme and still validates', () => {
        for (const theme of THEME_IDS) {
          const p = instantiateTemplate(def, theme);
          expect(p.settings.theme).toBe(theme);
          const r = validateProject(JSON.parse(JSON.stringify(p)));
          expect(r.ok && r.warnings).toEqual([]);
        }
      });

      it('exports to standalone HTML and re-imports identically', async () => {
        const p = pruneUnusedAssets(instantiateTemplate(def));
        const html = buildStandaloneHtml(p, runtime);
        expect(html).not.toMatch(/(src|href)=["']https?:/);
        const back = importFromText(html);
        expect(back.warnings).toEqual([]);
        expect(back.project.pages).toEqual(p.pages);
        expect(back.project.variables).toEqual(p.variables);
      });

      it('plays in the runtime without errors', async () => {
        const { host, player } = mountPlayer(instantiateTemplate(def));
        await tick();
        expect(host.querySelectorAll('.ofs-el').length).toBeGreaterThan(3);
        player.destroy();
      });
    });
  }
});

describe('event countdown sample date', () => {
  it('is always a Saturday at noon, three to four weeks ahead', () => {
    for (const now of [Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 15, 23), Date.UTC(2030, 10, 20, 8)]) {
      const d = sampleEventDate(now, 'UTC');
      expect(d.getUTCDay()).toBe(6);
      expect(d.getUTCHours()).toBe(12);
      const days = (d.getTime() - now) / 86400000;
      expect(days).toBeGreaterThan(20);
      expect(days).toBeLessThan(29);
    }
  });
  it('respects the time zone (noon on the wall clock)', () => {
    const d = zonedInstant('America/New_York', 2026, 7, 4, 12, 0);
    expect(d.toISOString()).toBe('2026-07-04T16:00:00.000Z');
    const w = zonedInstant('Europe/Berlin', 2026, 1, 10, 12, 0);
    expect(w.toISOString()).toBe('2026-01-10T11:00:00.000Z');
  });
});
