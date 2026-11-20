/**
 * Renders the storyboards into finished videos.
 *
 *   npm run video:render [-- name ...]
 *
 * For every frame the compositor page (video/compositor) lays out the
 * storyboard at time t from the captured footage (video/.cache/captures), the
 * frame is screenshotted and piped into ffmpeg (H.264 High, yuv420p,
 * +faststart). Outputs go to site/public/media/: the MP4, a WebP poster and,
 * for the main video, WebVTT captions.
 */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from './lib/server.ts';
import { STORYBOARDS } from './storyboards.ts';
import type { At, ResolvedStoryboard, Storyboard } from './compositor/types.ts';
import type { Manifest } from './lib/recorder.ts';

const root = path.resolve(import.meta.dirname, '..');
const captures = path.join(root, 'video', '.cache', 'captures');
const media = path.join(root, 'site', 'public', 'media');

function manifest(scene: string): Manifest {
  const file = path.join(captures, scene, 'manifest.json');
  if (!fs.existsSync(file)) throw new Error(`No footage for "${scene}" — run \`npm run video:capture -- ${scene.replace(/-(play|edit|create|file)$/, '')}…\` first.`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Seconds of a mark expression: 4.2, "intro", "intro+0.5", "intro-1". */
export function resolveAt(m: Manifest, at: At): number {
  if (typeof at === 'number') return at;
  const r = /^([a-zA-Z0-9_]+)\s*([+-]\s*[\d.]+)?$/.exec(at);
  if (!r || !(r[1] in m.marks)) throw new Error(`Unknown mark "${at}" in ${m.scene} (marks: ${Object.keys(m.marks).join(', ')})`);
  return m.marks[r[1]] + (r[2] ? Number(r[2].replace(/\s/g, '')) : 0);
}

function resolve(sb: Storyboard): ResolvedStoryboard {
  const footage: ResolvedStoryboard['footage'] = {};
  const shots = sb.shots.map((s) => {
    if (s.type !== 'clip') return s;
    const m = manifest(s.scene);
    footage[s.scene] ??= { base: `/video/.cache/captures/${s.scene}/`, frames: m.frames };
    const from = resolveAt(m, s.from);
    const end = from + (s.dur + sb.fade) * (s.speed ?? 1);
    if (end > m.duration + 0.5) console.warn(`  ! ${sb.name}: shot of ${s.scene} runs ${(end - m.duration).toFixed(1)} s past the recording`);
    return { ...s, from };
  });
  return { ...sb, shots, footage };
}

const duration = (sb: Storyboard) => sb.shots.reduce((a, s) => a + s.dur, 0);

function vtt(sb: Storyboard): string {
  const ts = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(3).padStart(6, '0');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec}`;
  };
  const cues = [
    ...(sb.headlines ?? []).map((h) => ({ from: h.from, to: h.to, text: [h.kicker, ...h.lines].filter(Boolean).join(' — ').replace(/<[^>]+>/g, '') })),
    ...sb.captions.map((c) => ({ from: c.from, to: c.to, text: c.sub ? `${c.text} — ${c.sub}` : c.text })),
  ].sort((a, b) => a.from - b.from);
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join('\n')}`;
}

async function main() {
  const wanted = process.argv.slice(2);
  const boards = wanted.length ? STORYBOARDS.filter((b) => wanted.includes(b.name)) : STORYBOARDS;
  if (!boards.length) throw new Error(`No storyboard matches ${wanted.join(', ')}. Known: ${STORYBOARDS.map((b) => b.name).join(', ')}`);
  const bundle = await build({
    entryPoints: [path.join(root, 'video', 'compositor', 'compositor.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
  });
  const code = bundle.outputFiles[0].text;
  const server = await serveStatic(root);
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  try {
    for (const sb of boards) {
      const t0 = Date.now();
      const resolved = resolve(sb);
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => console.error(`  [compositor] ${e.message}`));
      await page.goto(`${server.url}video/compositor/index.html`);
      await page.addScriptTag({ content: code });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((b) => (window as unknown as { __setup(b: unknown): void }).__setup(b), resolved);
      await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load())));

      const out = path.join(media, sb.name.startsWith('showcase-') ? `showcase/${sb.name.slice(9)}.mp4` : `${sb.name}.mp4`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const scale = sb.width !== 1920 ? ['-vf', `scale=${sb.width}:${sb.height}:flags=lanczos`] : [];
      const crf = sb.width >= 1920 ? '22' : '24';
      const ff = spawn(
        'ffmpeg',
        [
          '-y',
          '-loglevel', 'error',
          '-f', 'image2pipe',
          '-framerate', String(sb.fps),
          '-c:v', 'mjpeg',
          '-i', '-',
          ...scale,
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', crf,
          '-profile:v', 'high',
          '-level', '4.1',
          '-pix_fmt', 'yuv420p',
          '-g', String(sb.fps * 2),
          '-movflags', '+faststart',
          '-an',
          out,
        ],
        { stdio: ['pipe', 'inherit', 'inherit'] },
      );
      const done = new Promise<void>((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited with ${c}`)))));
      const total = Math.round(duration(sb) * sb.fps);
      for (let f = 0; f < total; f++) {
        const t = f / sb.fps;
        await page.evaluate((tt) => (window as unknown as { __renderAt(t: number): Promise<void> }).__renderAt(tt), t);
        const jpg = await page.screenshot({ type: 'jpeg', quality: 94 });
        if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
        if (f % (sb.fps * 5) === 0) process.stdout.write(`\r  ${sb.name}: ${f}/${total}`);
      }
      ff.stdin.end();
      await done;
      await page.close();

      // Poster: a frame of the finished video, as WebP.
      const poster = out.replace(/\.mp4$/, '.webp');
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(sb.poster), '-i', out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', poster]);
      if (!sb.name.startsWith('showcase-')) fs.writeFileSync(out.replace(/\.mp4$/, '.vtt'), vtt(sb));
      const kb = (f: string) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
      console.log(`\r  ${sb.name}: ${total} frames, ${duration(sb).toFixed(1)} s → ${path.relative(root, out)} (${kb(out)}), poster ${kb(poster)} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
