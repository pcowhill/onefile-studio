/**
 * "Made with OneFile Studio" — the showcase shown on the public landing page.
 *
 * This module is plain data with no imports, so the landing page can use it
 * without pulling in the editor, the runtime or any project artwork. Each entry
 * points at an ordinary example project (`src/examples`), which is what the
 * editor opens ("Open in Editor") and what the site build exports as a genuine
 * standalone OneFile ("Try it": `showcase/<id>.html`).
 */
export interface ShowcaseMeta {
  /** Stable id: used in URLs (`studio/?open=<id>`, `#try/<id>`) and media file names. */
  id: string;
  /** The example project this showcase is (see `EXAMPLES` in src/examples). */
  example: string;
  title: string;
  /** What it is, in a few words ("Before & after story"). */
  kind: string;
  /** One or two short sentences for the card. */
  description: string;
  /** What it demonstrates (three short chips). */
  chips: [string, string, string];
  /** What to try first in the live version. */
  tryHint: string;
  /** Slides or a scrolling webpage. */
  format: 'slides' | 'page';
  /** Accent colour of the card (matches the project). */
  accent: string;
  /** File name of the exported OneFile ("Download this file"). */
  file: string;
}

export const SHOWCASES: ShowcaseMeta[] = [
  {
    id: 'before-after',
    example: 'before-after',
    title: 'The Valley, Restored',
    kind: 'Before & after story',
    description: 'A scrolling story with a drag-to-compare slider, a scrolling field journal and a photo gallery.',
    chips: ['Scrolling webpage', 'Comparison slider', 'Scrolling text'],
    tryHint: 'Scroll down, then drag the slider handle left and right.',
    format: 'page',
    accent: '#1f9d5f',
    file: 'The-Valley-Restored.html',
  },
  {
    id: 'feed-puff',
    example: 'clicker',
    title: 'Feed Puff!',
    kind: 'Mini clicker game',
    description: 'Click Puff for a snack, right-click for a mega snack and fill the meter to win. A score variable drives it all.',
    chips: ['Variables', 'Click & right-click', 'Progress meter'],
    tryHint: 'Click Puff a few times — then try a right-click.',
    format: 'slides',
    accent: '#ff4d8d',
    file: 'Feed-Puff.html',
  },
  {
    id: '3d-explorer',
    example: 'explorer',
    title: 'Pathfinder R-2',
    kind: 'Interactive 3D explorer',
    description: 'Turn and zoom a 3D rover, press a part to fly the camera there, then flip to the spec sheet.',
    chips: ['3D model', 'Camera views', 'Keyboard keys'],
    tryHint: 'Drag the rover to turn it, or press “Mast camera”.',
    format: 'slides',
    accent: '#4f46e5',
    file: 'Pathfinder-R-2.html',
  },
  {
    id: 'tech-explainer',
    example: 'explainer',
    title: 'How an order travels',
    kind: 'Technical explainer',
    description: 'Step through an architecture diagram with the keyboard, click any box for notes and drag sticky notes around.',
    chips: ['Animated diagram', 'Keyboard steps', 'Playful dragging'],
    tryHint: 'Press Start, then → or Space to step through the diagram.',
    format: 'slides',
    accent: '#22d3ee',
    file: 'How-an-order-travels.html',
  },
  {
    id: 'feature-walkthrough',
    example: 'release',
    title: 'Tasklane 3.2',
    kind: 'Feature walkthrough',
    description: 'A release update with screenshots, an embedded demo video, an interactive chart and a sortable table.',
    chips: ['Video', 'Interactive chart', 'Sortable table'],
    tryHint: 'Use the arrow keys or the Next buttons, then hover the chart.',
    format: 'slides',
    accent: '#2563eb',
    file: 'Tasklane-3.2.html',
  },
  {
    id: 'event',
    example: 'event',
    title: 'The Autumn Social',
    kind: 'Event announcement',
    description: 'An editorial invitation page with a live countdown, an animated GIF and the evening’s programme.',
    chips: ['Live countdown', 'Animated GIF', 'Scrolling layout'],
    tryHint: 'Press “Count me in” and watch the countdown tick.',
    format: 'page',
    accent: '#b5532c',
    file: 'The-Autumn-Social.html',
  },
];

export function getShowcase(id: string): ShowcaseMeta | undefined {
  return SHOWCASES.find((s) => s.id === id);
}
