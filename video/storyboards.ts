import fs from 'node:fs';
import path from 'node:path';
import type { Cam, Storyboard } from './compositor/types.ts';
import { HERO_CHAPTERS } from './chapters.ts';

/**
 * Storyboards of every promotional video. Times are output seconds; `from`
 * points into a recording by mark name (see video/scenes). Speeds above 1 play
 * real footage faster — nothing is staged or simulated.
 */

const clip = (s: Omit<Storyboard, 'width' | 'height' | 'fps' | 'fade' | 'captionScale' | 'loop' | 'palette'>): Storyboard => ({
  width: 1280,
  height: 720,
  fps: 30,
  fade: 0.35,
  captionScale: 1.45,
  loop: true,
  palette: 'night',
  ...s,
});

/** Camera helpers (x, y: centre of the view as a fraction of the frame; z: zoom). */
const still = (z = 1, x = 0.5, y = 0.5): Cam[] => [{ at: 0, x, y, z }];
const drift = (z0: number, z1: number, x = 0.5, y = 0.5): Cam[] => [
  { at: 0, x, y, z: z0 },
  { at: 1, x, y, z: z1 },
];
/** Whole editor first, then a zoom into the inspector so its text is readable on a small card. */
const toInspector = (at = 0.45, y = 0.36): Cam[] => [
  { at: 0, x: 0.5, y: 0.5, z: 1 },
  { at, x: 0.5, y: 0.5, z: 1 },
  { at: at + 0.2, x: 0.87, y, z: 2.1 },
  { at: 1, x: 0.87, y, z: 2.1 },
];

// ---------------------------------------------------------------- showcase clips (1280×720, ~15 s, looping)

export const feedPuff = clip({
  name: 'showcase-feed-puff',
  accent: '#ff4d8d',
  poster: 1.2,
  shots: [
    { type: 'clip', dur: 2.6, scene: 'feed-puff-play', from: 0.4, frame: 'full', cam: drift(1, 1.05) },
    { type: 'clip', dur: 5.2, scene: 'feed-puff-edit', from: 'editor+0.1', frame: 'full', cam: toInspector(0.42) },
    { type: 'clip', dur: 7.4, scene: 'feed-puff-play', from: 'intro-0.2', speed: 2.2, frame: 'full', cam: drift(1.04, 1) },
  ],
  captions: [
    { from: 0.3, to: 2.6, text: 'Feed Puff!', badge: '▶' },
    { from: 2.6, to: 7.8, text: 'When clicked → add 1 to Score', badge: '⚡' },
    { from: 7.8, to: 14.8, text: 'A game in one HTML file', badge: '✓' },
  ],
});

export const beforeAfter = clip({
  name: 'showcase-before-after',
  accent: '#1f9d5f',
  poster: 1.2,
  shots: [
    { type: 'clip', dur: 2.3, scene: 'before-after-play', from: 0.3, frame: 'full', cam: drift(1, 1.05) },
    { type: 'clip', dur: 5.0, scene: 'before-after-edit', from: 'selected-1.7', speed: 1.2, frame: 'full', cam: toInspector(0.4, 0.33) },
    { type: 'clip', dur: 8.2, scene: 'before-after-play', from: 'intro', speed: 1.65, frame: 'full', cam: still() },
  ],
  captions: [
    { from: 0.3, to: 2.3, text: 'A before & after story', badge: '▶' },
    { from: 2.3, to: 7.3, text: 'Two pictures, one slider', badge: '⚡' },
    { from: 7.3, to: 15.1, text: 'Drag to compare', badge: '✓' },
  ],
});

export const explorer = clip({
  name: 'showcase-3d-explorer',
  accent: '#4f46e5',
  poster: 1.0,
  shots: [
    { type: 'clip', dur: 2.2, scene: '3d-explorer-play', from: 0.1, frame: 'full', cam: drift(1, 1.05, 0.55) },
    { type: 'clip', dur: 4.8, scene: '3d-explorer-edit', from: 'selected-1.1', frame: 'full', cam: toInspector(0.38, 0.4) },
    { type: 'clip', dur: 9.2, scene: '3d-explorer-play', from: 'intro', speed: 1.25, frame: 'full', cam: still() },
  ],
  captions: [
    { from: 0.3, to: 2.2, text: 'A 3D model in a web page', badge: '▶' },
    { from: 2.2, to: 7.0, text: 'When clicked → turn the 3D view', badge: '⚡' },
    { from: 7.0, to: 15.9, text: 'Drag to turn · pick a part', badge: '✓' },
  ],
});

export const explainer = clip({
  name: 'showcase-tech-explainer',
  accent: '#0e7490',
  poster: 1.0,
  shots: [
    { type: 'clip', dur: 2.0, scene: 'tech-explainer-play', from: 0.3, frame: 'full', cam: drift(1, 1.05, 0.45) },
    { type: 'clip', dur: 5.0, scene: 'tech-explainer-edit', from: 'slide-1.0', frame: 'full', cam: toInspector(0.4, 0.4) },
    { type: 'clip', dur: 9.2, scene: 'tech-explainer-play', from: 'diagram-0.5', speed: 2.35, frame: 'full', cam: still() },
  ],
  captions: [
    { from: 0.3, to: 2.0, text: 'An architecture walkthrough', badge: '▶' },
    { from: 2.0, to: 7.0, text: 'When → is pressed → next step', badge: '⚡' },
    { from: 7.0, to: 15.9, text: 'Step through with the keyboard', badge: '✓' },
  ],
});

export const release = clip({
  name: 'showcase-feature-walkthrough',
  accent: '#2563eb',
  poster: 1.0,
  shots: [
    { type: 'clip', dur: 2.1, scene: 'feature-walkthrough-play', from: 0.3, frame: 'full', cam: drift(1, 1.05, 0.45) },
    { type: 'clip', dur: 5.0, scene: 'feature-walkthrough-edit', from: 'selected-1.4', frame: 'full', cam: toInspector(0.4, 0.52) },
    { type: 'clip', dur: 9.4, scene: 'feature-walkthrough-play', from: 'intro', speed: 2.3, frame: 'full', cam: still() },
  ],
  captions: [
    { from: 0.3, to: 2.1, text: 'A feature walkthrough', badge: '▶' },
    { from: 2.1, to: 7.1, text: 'Chart data, edited like a spreadsheet', badge: '⚡' },
    { from: 7.1, to: 16.2, text: 'Video, chart, sortable table', badge: '✓' },
  ],
});

export const event = clip({
  name: 'showcase-event',
  accent: '#b5532c',
  poster: 1.2,
  shots: [
    { type: 'clip', dur: 2.3, scene: 'event-play', from: 0.3, frame: 'full', cam: drift(1, 1.05) },
    { type: 'clip', dur: 4.8, scene: 'event-edit', from: 'selected-1.5', frame: 'full', cam: toInspector(0.4, 0.36) },
    { type: 'clip', dur: 9.6, scene: 'event-play', from: 'intro-0.1', speed: 2.0, frame: 'full', cam: still() },
  ],
  captions: [
    { from: 0.3, to: 2.3, text: 'An event invitation', badge: '▶' },
    { from: 2.3, to: 7.1, text: 'A countdown to every Friday', badge: '⚡' },
    { from: 7.1, to: 16.4, text: 'Live countdown & programme', badge: '✓' },
  ],
});

// ---------------------------------------------------------------- the main product video (1920×1080, ~43 s)

/** Size of the file the hero scene really exported (shown on the "one file" card). */
function exportedSize(): string {
  try {
    const file = fs.readFileSync(path.join(import.meta.dirname, '.cache', 'downloads', 'hero-file.txt'), 'utf8').trim();
    return `${Math.round(fs.statSync(file).size / 1024)} KB`;
  } catch {
    return 'one file';
  }
}

const CANVAS: Cam[] = [
  { at: 0, x: 0.5, y: 0.5, z: 1 },
  { at: 0.35, x: 0.47, y: 0.45, z: 1.3 },
  { at: 1, x: 0.47, y: 0.45, z: 1.3 },
];

export const hero: Storyboard = {
  name: 'hero',
  width: 1920,
  height: 1080,
  fps: 30,
  fade: 0.3,
  palette: 'night',
  accent: '#6d4aff',
  poster: 1.3,
  shots: [
    // Explore: finished OneFiles responding to the viewer.
    { type: 'clip', dur: 2.0, scene: 'feed-puff-play', from: 'clicks-1.4', speed: 1.5, frame: 'full', cam: drift(1.0, 1.06, 0.5, 0.5) },
    { type: 'clip', dur: 2.0, scene: '3d-explorer-play', from: 'intro+0.4', speed: 1.3, frame: 'full', cam: drift(1.0, 1.06, 0.5, 0.5) },
    { type: 'clip', dur: 2.0, scene: 'before-after-play', from: 'compare+0.6', speed: 1.9, frame: 'full', cam: drift(1.08, 1.12, 0.5, 0.45) },
    // Create: a project built from a blank slide in the real editor.
    { type: 'clip', dur: 2.0, scene: 'hero-create', from: 'start-0.4', speed: 1.9, frame: 'window', cam: still() },
    { type: 'clip', dur: 2.7, scene: 'hero-create', from: 'background-0.9', speed: 2.2, frame: 'window', cam: CANVAS },
    { type: 'clip', dur: 2.1, scene: 'hero-create', from: 'star-1.2', speed: 2.8, frame: 'window', cam: CANVAS },
    {
      type: 'clip',
      dur: 3.6,
      scene: 'hero-create',
      from: 'triggers-2.0',
      speed: 3.2,
      frame: 'window',
      cam: [
        { at: 0, x: 0.75, y: 0.4, z: 1.35 },
        { at: 0.18, x: 0.5, y: 0.45, z: 1.3 },
        { at: 0.45, x: 0.5, y: 0.45, z: 1.3 },
        { at: 0.62, x: 0.82, y: 0.5, z: 1.45 },
        { at: 1, x: 0.82, y: 0.45, z: 1.45 },
      ],
    },
    { type: 'clip', dur: 2.2, scene: 'hero-create', from: 'themes-1.0', speed: 3.2, frame: 'window', cam: drift(1.3, 1.3, 0.36, 0.4) },
    // Interact: Preview, then two showcases.
    { type: 'clip', dur: 3.0, scene: 'hero-create', from: 'preview-0.4', speed: 1.3, frame: 'window', cam: still() },
    { type: 'clip', dur: 2.6, scene: '3d-explorer-play', from: 'rotated+0.6', speed: 1.4, frame: 'window', cam: still() },
    { type: 'clip', dur: 2.6, scene: 'tech-explainer-play', from: 'diagram-0.2', speed: 1.9, frame: 'window', cam: still() },
    // Export.
    { type: 'clip', dur: 3.2, scene: 'hero-create', from: 'exportDialog-1.6', speed: 1.3, frame: 'window', cam: drift(1, 1.25, 0.5, 0.5) },
    { type: 'file', dur: 2.6, name: 'Launch-Party.html', meta: `1 file · ${exportedSize()} · works offline` },
    // Share: the downloaded file, opened from disk with the network off.
    {
      type: 'clip',
      dur: 5.2,
      scene: 'hero-file',
      from: 'opened-0.9',
      frame: 'browser',
      url: 'file:///…/Downloads/Launch-Party.html',
      badge: 'Offline',
      cam: still(),
    },
    { type: 'outro', dur: 5.0, url: 'pcowhill.github.io/onefile-studio' },
  ],
  headlines: [{ from: 0.1, to: 5.9, kicker: 'Made with OneFile Studio', lines: ['Make it interactive.'] }],
  steps: [
    { label: 'Create', from: HERO_CHAPTERS.create },
    { label: 'Interact', from: HERO_CHAPTERS.interact },
    { label: 'Export', from: HERO_CHAPTERS.export },
    { label: 'Share', from: HERO_CHAPTERS.share },
  ],
  stepsVisible: [6.0, 37.8],
  captions: [
    { from: 6.15, to: 8.0, text: 'Start a slide presentation', badge: '1', color: '#6d4aff' },
    { from: 8.0, to: 10.7, text: 'Pick a background, type a heading', badge: '1', color: '#6d4aff' },
    { from: 10.7, to: 12.8, text: 'Drop in a shape and drag it into place', badge: '1', color: '#6d4aff' },
    { from: 12.8, to: 16.4, text: 'When clicked → spin it', sub: 'Pick from illustrated triggers and actions — no code', badge: '1', color: '#6d4aff' },
    { from: 16.4, to: 18.6, text: 'Try other styles, live', badge: '1', color: '#6d4aff' },
    { from: 18.6, to: 21.6, text: 'Preview: it really works', badge: '2', color: '#ff4d8d' },
    { from: 21.6, to: 24.2, text: 'Turn 3D models', badge: '2', color: '#ff4d8d' },
    { from: 24.2, to: 26.8, text: 'Step through with the keyboard', badge: '2', color: '#ff4d8d' },
    { from: 26.8, to: 30.0, text: 'Export one HTML file', sub: 'Media, fonts and the player — all inside', badge: '3', color: '#e09a00' },
    { from: 33.0, to: 37.6, text: 'Open it from disk — no internet needed', sub: 'Any modern browser. No install, no account.', badge: '4', color: '#1f9d5f' },
  ],
};

export const STORYBOARDS: Storyboard[] = [hero, feedPuff, beforeAfter, explorer, explainer, release, event];
