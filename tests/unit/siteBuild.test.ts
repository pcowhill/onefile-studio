import { describe, expect, it } from 'vitest';
// Unit tests are typed for the browser (no Node types), but vitest runs them in Node.
// @ts-expect-error -- Node built-in, untyped here
import fs from 'node:fs';
// @ts-expect-error -- Node built-in, untyped here
import path from 'node:path';
// @ts-expect-error -- Node built-in, untyped here
import { execFileSync } from 'node:child_process';
import { SHOWCASES } from '../../src/showcase/meta';

/**
 * v0.7: the complete website is committed in dist-site/ so it can be hosted
 * straight from a download. These checks run on the files git tracks (CI also
 * rebuilds the site and fails if it differs from what is committed).
 */
const root = path.resolve('.');
const tracked: string[] = String(execFileSync('git', ['ls-files', '-z', '--', 'dist-site'], { cwd: root, encoding: 'utf8' }))
  .split('\0')
  .filter(Boolean)
  .map((f: string) => f.slice('dist-site/'.length));

describe('committed website build (dist-site/)', () => {
  it('is in the repository with everything needed for static hosting', () => {
    const required = [
      'index.html',
      '.nojekyll',
      'studio/index.html',
      'examples/index.html',
      'media/hero.mp4',
      'media/hero.webp',
      'media/hero.vtt',
      ...SHOWCASES.flatMap((s) => [`showcase/${s.id}.html`, `media/showcase/${s.id}.mp4`, `media/showcase/${s.id}.webp`]),
    ];
    for (const f of required) expect(tracked, f).toContain(f);
    expect(tracked.some((f) => /^assets\/index-[\w-]+\.js$/.test(f))).toBe(true);
    expect(tracked.some((f) => /^assets\/index-[\w-]+\.css$/.test(f))).toBe(true);
    expect(tracked.some((f) => f.endsWith('.woff2'))).toBe(true);
  });

  it('holds only production files (no caches, recordings, reports or source maps)', () => {
    for (const f of tracked) {
      expect(f, f).not.toMatch(/(^|\/)(\.DS_Store|Thumbs\.db|\.cache|test-results|playwright-report)(\/|$)|\.map$|\.tmp$|\.log$|\.webm$|\.raw/);
    }
    // Every committed file is something the site references or serves directly.
    expect(tracked.length).toBeLessThan(120);
  });

  it('ships the same editor as dist/index.html and every landing-page media file unchanged', () => {
    const read = (p: string) => fs.readFileSync(path.join(root, p));
    expect(read('dist-site/studio/index.html').equals(read('dist/index.html'))).toBe(true);
    const media = tracked.filter((f) => f.startsWith('media/') || f.startsWith('examples/'));
    for (const f of media) expect(read(`dist-site/${f}`).equals(read(`site/public/${f}`)), f).toBe(true);
  });

  it('has no files larger than needed (largest: the hero video)', () => {
    const sizes = tracked.map((f) => ({ f, size: fs.statSync(path.join(root, 'dist-site', f)).size }));
    const total = sizes.reduce((n, s) => n + s.size, 0);
    expect(total).toBeLessThan(40 * 1024 * 1024);
    for (const s of sizes) expect(s.size, s.f).toBeLessThan(10 * 1024 * 1024);
  });

  it('every local reference in the landing page resolves to a committed file', () => {
    const html = fs.readFileSync(path.join(root, 'dist-site/index.html'), 'utf8');
    const re = /\b(?:src|href|poster)="([^"]+)"/g;
    const missing: string[] = [];
    for (let m = re.exec(html); m; m = re.exec(html)) {
      const ref = m[1].split('#')[0].split('?')[0];
      if (!ref || /^(?:[a-z]+:|\/\/)/i.test(ref)) continue;
      const file = path.posix.normalize(ref.replace(/^\.\//, '')).replace(/\/$/, '/index.html').replace(/^\.$/, 'index.html');
      if (!tracked.includes(file === '' ? 'index.html' : file)) missing.push(ref);
    }
    expect(missing).toEqual([]);
  });

  it('keeps the public build deterministic: exported showcases carry fixed dates', () => {
    for (const s of SHOWCASES) {
      const html = fs.readFileSync(path.join(root, 'dist-site/showcase', `${s.id}.html`), 'utf8');
      expect(html).toContain('"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"');
    }
  });
});
