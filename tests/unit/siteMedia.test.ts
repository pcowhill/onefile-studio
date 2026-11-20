import { describe, expect, it } from 'vitest';
// Unit tests are typed for the browser (no Node types), but vitest runs them in Node.
// @ts-expect-error -- Node built-in, untyped here
import fs from 'node:fs';
// @ts-expect-error -- Node built-in, untyped here
import path from 'node:path';
import { SHOWCASES } from '../../src/showcase/meta';
import { TEMPLATES } from '../../src/templates';
import { LESSONS } from '../../src/editor/learn/lessons';
import { HERO_CHAPTERS } from '../../video/chapters';

/**
 * The committed promotional media (site/public/media) and the landing page that
 * uses it. The MP4s are parsed box by box (no ffprobe needed): browser-safe
 * codec and profile, the expected size and length, and "fast start" (index
 * before the data) so playback can begin while downloading.
 */

const root = path.resolve('.');
const media = path.join(root, 'site/public/media');
const html = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');

/** The parts of Node's Buffer used here. */
interface Buffer {
  length: number;
  [i: number]: number;
  readUInt32BE(offset: number): number;
  readBigUInt64BE(offset: number): bigint;
  toString(encoding: 'latin1', start: number, end: number): string;
}

interface Box {
  type: string;
  start: number;
  size: number;
  body: number;
}
function boxes(buf: Buffer, start = 0, end = buf.length): Box[] {
  const out: Box[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    let body = p + 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(p + 8));
      body = p + 16;
    } else if (size === 0) size = end - p;
    out.push({ type, start: p, size, body });
    p += size;
  }
  return out;
}
const child = (buf: Buffer, parent: Box, type: string) => boxes(buf, parent.body, parent.start + parent.size).find((b) => b.type === type);

function mp4Info(file: string) {
  const buf = fs.readFileSync(file);
  const top = boxes(buf);
  const moov = top.find((b) => b.type === 'moov')!;
  const mdat = top.find((b) => b.type === 'mdat')!;
  const mvhd = child(buf, moov, 'mvhd')!;
  const v = buf[mvhd.body];
  const timescale = v === 1 ? buf.readUInt32BE(mvhd.body + 20) : buf.readUInt32BE(mvhd.body + 12);
  const duration = v === 1 ? Number(buf.readBigUInt64BE(mvhd.body + 24)) : buf.readUInt32BE(mvhd.body + 16);
  const tracks = boxes(buf, moov.body, moov.start + moov.size).filter((b) => b.type === 'trak');
  const info = tracks.map((trak) => {
    const tkhd = child(buf, trak, 'tkhd')!;
    const tv = buf[tkhd.body];
    const wOff = tkhd.body + (tv === 1 ? 88 : 76);
    const mdia = child(buf, trak, 'mdia')!;
    const hdlr = child(buf, mdia, 'hdlr')!;
    const handler = buf.toString('latin1', hdlr.body + 8, hdlr.body + 12);
    const minf = child(buf, mdia, 'minf')!;
    const stbl = child(buf, minf, 'stbl')!;
    const stsd = child(buf, stbl, 'stsd')!;
    const entry = boxes(buf, stsd.body + 8, stsd.start + stsd.size)[0];
    const avcC = entry.type === 'avc1' ? boxes(buf, entry.body + 78, entry.start + entry.size).find((b) => b.type === 'avcC') : undefined;
    return {
      handler,
      codec: entry.type,
      width: buf.readUInt32BE(wOff) / 65536,
      height: buf.readUInt32BE(wOff + 4) / 65536,
      profile: avcC ? buf[avcC.body + 1] : -1,
    };
  });
  return { brand: buf.toString('latin1', 8, 12), fastStart: moov.start < mdat.start, seconds: duration / timescale, tracks: info, bytes: buf.length };
}

const isWebp = (file: string) => {
  const b = fs.readFileSync(file);
  return b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' && b.length > 2000;
};

describe('promotional videos', () => {
  const videos = [
    { file: 'hero.mp4', w: 1920, h: 1080, min: 35, max: 50, maxBytes: 10 * 1024 * 1024 },
    ...SHOWCASES.map((s) => ({ file: `showcase/${s.id}.mp4`, w: 1280, h: 720, min: 10, max: 20, maxBytes: 3 * 1024 * 1024 })),
  ];
  for (const v of videos) {
    it(`${v.file}: H.264 High, ${v.w}×${v.h}, ${v.min}–${v.max} s, fast start, no audio, reasonable size`, () => {
      const file = path.join(media, v.file);
      expect(fs.existsSync(file), file).toBe(true);
      const info = mp4Info(file);
      expect(info.fastStart).toBe(true);
      expect(info.tracks).toHaveLength(1);
      expect(info.tracks[0]).toMatchObject({ handler: 'vide', codec: 'avc1', width: v.w, height: v.h, profile: 100 });
      expect(info.seconds).toBeGreaterThan(v.min);
      expect(info.seconds).toBeLessThan(v.max);
      expect(info.bytes).toBeLessThan(v.maxBytes);
      expect(info.bytes).toBeGreaterThan(200 * 1024); // real footage, not a blank placeholder
      expect(isWebp(file.replace(/\.mp4$/, '.webp')), 'poster').toBe(true);
    });
  }

  it('the main video has captions that fit its length', () => {
    const vtt = fs.readFileSync(path.join(media, 'hero.vtt'), 'utf8');
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    const cues = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d\.\d{3}) --> (\d\d):(\d\d):(\d\d\.\d{3})/g)].map((m) => ({
      from: +m[1] * 3600 + +m[2] * 60 + +m[3],
      to: +m[4] * 3600 + +m[5] * 60 + +m[6],
    }));
    expect(cues.length).toBeGreaterThanOrEqual(8);
    const length = mp4Info(path.join(media, 'hero.mp4')).seconds;
    for (const c of cues) {
      expect(c.to).toBeGreaterThan(c.from);
      expect(c.to).toBeLessThanOrEqual(length + 0.01);
    }
    expect(vtt).toContain('Export one HTML file');
  });

  it('template thumbnails exist for every template shown on the landing page', () => {
    const shown = [...html.matchAll(/media\/templates\/([a-z-]+)\.webp/g)].map((m) => m[1]);
    expect(shown.length).toBe(5);
    for (const id of shown) {
      expect(
        TEMPLATES.some((t) => t.id === id),
        id,
      ).toBe(true);
      expect(isWebp(path.join(media, 'templates', `${id}.webp`)), id).toBe(true);
    }
  });
});

describe('landing page content matches the app', () => {
  it('chapter buttons match the main video storyboard', () => {
    const times = [...html.matchAll(/<button type="button" data-t="([\d.]+)"><b>([^<]+)<\/b><span>(\d):(\d\d)<\/span>/g)];
    expect(times.map((m) => [m[2].toLowerCase(), Number(m[1])])).toEqual(Object.entries(HERO_CHAPTERS));
    for (const m of times) expect(Number(m[3]) * 60 + Number(m[4])).toBe(Math.floor(Number(m[1])));
  });

  it('lists the real lessons and templates', () => {
    for (const l of LESSONS) expect(html, l.title).toContain(`${l.title} <small>${l.minutes} min</small>`);
    const shownTemplates = [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1].replace('&amp;', '&'));
    for (const t of TEMPLATES.filter((t) => html.includes(`media/templates/${t.id}.webp`))) expect(shownTemplates).toContain(t.title);
  });

  it('gets its showcase cards from the registry (no hand-written copies)', () => {
    expect(html).toContain('<!-- @showcase-cards -->');
    for (const s of SHOWCASES) expect(html).not.toContain(`sc-${s.id}"`);
  });
});
