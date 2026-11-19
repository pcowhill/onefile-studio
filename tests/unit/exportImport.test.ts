import { describe, expect, it } from 'vitest';
import runtime from 'virtual:ofs-runtime';
import { buildStandaloneHtml, pruneUnusedAssets, EXPORT_CSP } from '../../src/io/exportHtml';
import { extractProjectData, importFromText } from '../../src/io/importHtml';
import { jsonForScript } from '../../src/io/escape';
import { createElement, createProject } from '../../src/model/factory';
import { EXAMPLES } from '../../src/examples';
import { addAssetDedup, dataUrlBytes } from '../../src/io/assets';
import type { Project } from '../../src/model/types';

const strip = (p: Project) => ({ ...p, meta: { ...p.meta, updatedAt: '' } });

describe('standalone HTML export', () => {
  it('produces a single self-contained document', () => {
    const p = EXAMPLES[0].build();
    const html = buildStandaloneHtml(p, runtime);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<script type="application/json" id="ofs-project">');
    expect(html).toContain(EXPORT_CSP);
    // No external resources: no src=/href= attributes pointing anywhere.
    expect(html).not.toMatch(/\s(src|href)=["']?(https?:)?\/\//i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    // The runtime is embedded and the placeholder is gone.
    expect(runtime.length).toBeGreaterThan(10_000);
    expect(html).toContain(runtime.slice(0, 200));
  });

  it('round-trips every example through HTML export and import', () => {
    for (const ex of EXAMPLES) {
      const p = ex.build();
      const html = buildStandaloneHtml(p, runtime);
      const { project, warnings } = importFromText(html, 'x.html');
      expect(warnings, ex.id).toEqual([]);
      expect(strip(project)).toEqual(strip(p));
    }
  });

  it('cannot be broken by hostile text in the project', () => {
    const p = createProject('slides', '</title><script>alert(1)</script>');
    const evil = '</script><script>window.__pwned=1</script><!--   & <b>';
    p.pages[0].elements.push(createElement('text', { props: { text: evil } }));
    const html = buildStandaloneHtml(p, runtime);
    expect(html).not.toContain('</script><script>window.__pwned');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Exactly the two script elements we generated.
    expect(doc.querySelectorAll('script')).toHaveLength(2);
    expect(doc.title).toBe('</title><script>alert(1)</script>');
    const data = extractProjectData(html) as Project;
    expect((data.pages[0].elements[0].props as { text: string }).text).toBe(evil);
  });

  it('escapes JSON safely for script embedding', () => {
    const s = jsonForScript({ a: '</script>', b: '<!--', c: '&' });
    expect(s).not.toMatch(/[<>&]/);
    expect(JSON.parse(s)).toEqual({ a: '</script>', b: '<!--', c: '&' });
  });

  it('rejects HTML without project data and damaged data', () => {
    expect(() => importFromText('<html><body>Hello</body></html>', 'a.html')).toThrow(/doesn't contain OneFile Studio project data/);
    expect(() => importFromText('<script type="application/json" id="ofs-project">{nope</script>', 'a.html')).toThrow(/damaged/);
  });

  it('embeds and de-duplicates assets and prunes unused ones', () => {
    const p = createProject('slides');
    const data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const a = { id: 'as_a', name: 'a.png', mime: 'image/png', data, width: 1, height: 1, bytes: dataUrlBytes(data), hash: 'h1' };
    expect(addAssetDedup(p.assets, a)).toBe('as_a');
    expect(addAssetDedup(p.assets, { ...a, id: 'as_b' })).toBe('as_a');
    expect(Object.keys(p.assets)).toEqual(['as_a']);
    p.assets.as_unused = { ...a, id: 'as_unused', hash: 'h2' };
    p.pages[0].elements.push(createElement('image', { props: { assetId: 'as_a' } }));
    const pruned = pruneUnusedAssets(p);
    expect(Object.keys(pruned.assets)).toEqual(['as_a']);
    const html = buildStandaloneHtml(pruned, runtime);
    expect(html).toContain(data);
    const back = importFromText(html);
    expect(back.project.assets.as_a.data).toBe(data);
  });

  it('only embeds the font when a project uses it', () => {
    const p = createProject('slides');
    p.pages[0].elements.push(createElement('text', { props: { font: 'sans' } }));
    expect(buildStandaloneHtml(p, runtime)).not.toContain('@font-face');
    p.pages[0].elements.push(createElement('text', { props: { font: 'rounded' } }));
    expect(buildStandaloneHtml(p, runtime)).toContain("@font-face{font-family:'OFS Nunito'");
  });
});
