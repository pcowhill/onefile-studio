import { describe, expect, it } from 'vitest';
import { validateProject } from '../../src/model/validate';
import { createElement, createProject } from '../../src/model/factory';
import { EXAMPLES } from '../../src/examples';
import { SCHEMA_ID, SCHEMA_VERSION } from '../../src/model/types';

describe('project schema validation', () => {
  it('accepts every example project unchanged', () => {
    for (const ex of EXAMPLES) {
      const p = ex.build();
      const r = validateProject(JSON.parse(JSON.stringify(p)));
      expect(r.ok, ex.id).toBe(true);
      if (!r.ok) continue;
      expect(r.warnings).toEqual([]);
      expect(r.project).toEqual(p);
    }
  });

  it('rejects non-projects with readable errors', () => {
    expect(validateProject(null)).toEqual({ ok: false, errors: ['Project data is not an object.'] });
    expect(validateProject({ schema: 'something-else' }).ok).toBe(false);
    const r = validateProject({ ...createProject('slides'), version: SCHEMA_VERSION + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/newer version/);
    expect(validateProject({ schema: SCHEMA_ID, version: 1, kind: 'slides', pages: [] }).ok).toBe(false);
  });

  it('drops unknown element types, triggers and actions with warnings', () => {
    const p = createProject('slides');
    const btn = createElement('button');
    btn.interactions = [
      { id: 'ix1', trigger: 'teleport', conditions: [], actions: [] },
      { id: 'ix2', trigger: 'click', conditions: [], actions: [{ id: 'a1', type: 'runJavaScript', params: { code: 'alert(1)' } }, { id: 'a2', type: 'navigate', params: { page: 'next' } }] },
    ];
    p.pages[0].elements.push(btn, { ...createElement('text'), type: 'iframe' });
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const els = r.project.pages[0].elements;
    expect(els).toHaveLength(1);
    expect(els[0].interactions).toHaveLength(1);
    expect(els[0].interactions[0].actions.map((a) => a.type)).toEqual(['navigate']);
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('sanitises colours, numbers, ids and asset references', () => {
    const p = createProject('page');
    const t = createElement('text', { props: { color: 'red;background:url(http://evil)', size: 'huge' as unknown as number } });
    const img = createElement('image', { props: { assetId: 'as_missing' } });
    const dup = { ...createElement('shape'), id: t.id };
    p.pages[0].elements.push(t, img, dup, { ...createElement('shape'), id: '<script>' });
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [rt, ri, rd, rs] = r.project.pages[0].elements;
    expect((rt.props as { color: string }).color).toBe('#1d1b2c');
    expect((rt.props as { size: number }).size).toBe(32);
    expect((ri.props as { assetId: string }).assetId).toBe('');
    expect(rd.id).not.toBe(rt.id);
    expect(rs.id).toMatch(/^el_/);
  });

  it('only accepts embedded base64 image data for assets', () => {
    const p = createProject('slides');
    p.assets = {
      as_ok: { id: 'as_ok', name: 'ok', mime: 'image/png', data: 'data:image/png;base64,iVBORw0KGgo=', width: 1, height: 1, bytes: 8, hash: 'x' },
      as_remote: { id: 'as_remote', name: 'remote', mime: 'image/png', data: 'https://example.com/a.png', width: 1, height: 1, bytes: 8, hash: 'y' },
      as_html: { id: 'as_html', name: 'html', mime: 'text/html', data: 'data:text/html;base64,PHNjcmlwdD4=', width: 1, height: 1, bytes: 8, hash: 'z' },
    };
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.project.assets)).toEqual(['as_ok']);
  });

  it('fills missing element properties from registry defaults', () => {
    const p = createProject('slides');
    p.pages[0].elements.push({ id: 'el_x', type: 'gallery', props: { loop: false } } as never);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.project.pages[0].elements[0];
    expect(g.props).toMatchObject({ loop: false, transition: 'fade', advanceOnClick: true, images: [] });
    expect(g.w).toBe(100);
    expect(g.interactions).toEqual([]);
  });
});
