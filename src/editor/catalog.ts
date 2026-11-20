import type { Asset, Page, Project, SceneElement, Variable } from '../model/types';
import { createElement, createVariable } from '../model/factory';
import { SAMPLE_IDS, sampleAssets } from '../examples/art';
import type { ShapeKind } from '../runtime/elements/shape';
import { uid } from '../model/ids';

/** Editor-side metadata for each element type (labels, icons, behaviour in the canvas). */
export interface EditorElementDef {
  type: string;
  label: string;
  icon: string;
  color: string;
  /** Resize keeps the aspect ratio by default (Shift toggles). */
  keepAspect?: boolean;
  /** Prop edited inline on double-click. */
  inlineText?: 'text' | 'label';
  /** The element has built-in interactive behaviour. */
  builtIn?: string;
}

export const EDITOR_ELEMENTS: Record<string, EditorElementDef> = {
  text: { type: 'text', label: 'Text', icon: 'text', color: '#6d4aff', inlineText: 'text' },
  image: { type: 'image', label: 'Image', icon: 'image', color: '#00b894', keepAspect: true },
  shape: { type: 'shape', label: 'Shape', icon: 'shape', color: '#ff7a59' },
  arrow: { type: 'arrow', label: 'Arrow', icon: 'arrow', color: '#ff5d73' },
  button: { type: 'button', label: 'Button', icon: 'button', color: '#3d8bff', inlineText: 'label' },
  navButton: {
    type: 'navButton',
    label: 'Navigation button',
    icon: 'next',
    color: '#3d8bff',
    inlineText: 'label',
    builtIn: 'Goes to another slide or section when clicked.',
  },
  beforeAfter: {
    type: 'beforeAfter',
    label: 'Before & After',
    icon: 'compare',
    color: '#f39c12',
    builtIn: 'Viewers drag the divider to compare the two images.',
  },
  gallery: { type: 'gallery', label: 'Gallery', icon: 'gallery', color: '#e84393', builtIn: 'Click the gallery to show the next image.' },
  scrollText: { type: 'scrollText', label: 'Scrolling text', icon: 'scroll', color: '#0abde3', builtIn: 'Readers can scroll inside this panel.' },
  progress: { type: 'progress', label: 'Progress', icon: 'progress', color: '#8e44ad', builtIn: 'Fills up automatically as viewers progress.' },
  video: {
    type: 'video',
    label: 'Video',
    icon: 'video',
    color: '#ef4444',
    keepAspect: true,
    builtIn: 'Plays your video file. It is embedded in the export, so it works offline.',
  },
  audio: { type: 'audio', label: 'Audio', icon: 'audio', color: '#10b981', builtIn: 'Viewers press play to listen. The sound file is embedded in the export.' },
  chart: {
    type: 'chart',
    label: 'Chart',
    icon: 'chart',
    color: '#3d8bff',
    builtIn: 'Viewers hover for exact values and can click the legend to show or hide series.',
  },
  table: { type: 'table', label: 'Table', icon: 'table', color: '#0abde3', builtIn: 'Viewers can sort by clicking a column header.' },
  countdown: {
    type: 'countdown',
    label: 'Countdown',
    icon: 'timer',
    color: '#f39c12',
    builtIn: "Counts down live on each viewer's clock — even months later.",
  },
  quiz: { type: 'quiz', label: 'Quiz', icon: 'quiz', color: '#e84393', builtIn: 'Checks the answer and shows feedback by itself.' },
};

export function elementLabel(type: string) {
  return EDITOR_ELEMENTS[type]?.label ?? type;
}

export interface BuildContext {
  project: Project;
  page: Page;
}

export interface Built {
  element: SceneElement;
  assets?: Asset[];
  variables?: Variable[];
}

export interface CatalogItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  color: string;
  group: 'text' | 'media' | 'shapes' | 'data' | 'interactive';
  build(ctx: BuildContext): Built;
}

const text = (role: string, w: number, h: number, props: Record<string, unknown>) => createElement('text', { w, h, role, props });

const shape = (kind: ShapeKind, label: string, tone: number, color: string, w = 220, h = 220): CatalogItem => ({
  id: `shape-${kind}`,
  label,
  hint: `A ${label.toLowerCase()} in your theme's colours`,
  icon: 'shape',
  color,
  group: 'shapes',
  build: () => ({ element: createElement('shape', { w, h, role: `tone${tone}`, props: { shape: kind } }) }),
});

/** The viewer's (author's) time zone, for countdowns. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const CATALOG: CatalogItem[] = [
  {
    id: 'heading',
    label: 'Heading',
    hint: 'Big, bold title text',
    icon: 'text',
    color: '#6d4aff',
    group: 'text',
    build: () => ({ element: text('heading', 640, 80, { text: 'A bold heading', size: 60 }) }),
  },
  {
    id: 'subheading',
    label: 'Subheading',
    hint: 'Medium text for subtitles',
    icon: 'text',
    color: '#6d4aff',
    group: 'text',
    build: () => ({ element: text('subheading', 520, 50, { text: 'A friendly subheading', size: 32 }) }),
  },
  {
    id: 'body',
    label: 'Paragraph',
    hint: 'Regular reading text',
    icon: 'text',
    color: '#6d4aff',
    group: 'text',
    build: () => ({
      element: text('body', 480, 120, { text: 'Write something wonderful here. Double-click to edit this text.', size: 22, lineHeight: 1.5 }),
    }),
  },
  {
    id: 'tag',
    label: 'Label',
    hint: 'A small coloured tag',
    icon: 'text',
    color: '#e84393',
    group: 'text',
    build: () => ({ element: text('label', 160, 40, { text: 'NEW', size: 16, align: 'center', valign: 'middle' }) }),
  },
  shape('rect', 'Rounded box', 0, '#5b3df5', 300, 200),
  shape('ellipse', 'Circle', 1, '#ff6b6b'),
  shape('star', 'Star', 2, '#ffb100'),
  shape('heart', 'Heart', 3, '#ff4d8d'),
  shape('triangle', 'Triangle', 4, '#14b8a6'),
  shape('blob', 'Blob', 5, '#3d8bff'),
  {
    id: 'arrow',
    label: 'Arrow',
    hint: 'Point at anything',
    icon: 'arrow',
    color: '#ff5d73',
    group: 'shapes',
    build: () => ({ element: createElement('arrow', { w: 280, h: 80 }) }),
  },
  {
    id: 'arrow-curved',
    label: 'Curved arrow',
    hint: 'A playful swoosh',
    icon: 'arrow',
    color: '#ff5d73',
    group: 'shapes',
    build: () => ({
      element: createElement('arrow', { w: 280, h: 140, props: { bend: -0.45, start: { x: 0.05, y: 0.8 }, end: { x: 0.95, y: 0.7 } } }),
    }),
  },
  {
    id: 'image',
    label: 'Image',
    hint: 'A picture, screenshot or animated GIF',
    icon: 'image',
    color: '#00b894',
    group: 'media',
    // Like Video and Audio: a placeholder first, then choose the picture in the inspector.
    build: () => ({ element: createElement('image', { w: 480, h: 320 }) }),
  },
  {
    id: 'video',
    label: 'Video',
    hint: 'Embed an MP4 or WebM video',
    icon: 'video',
    color: '#ef4444',
    group: 'media',
    build: () => ({ element: createElement('video', { w: 640, h: 360 }) }),
  },
  {
    id: 'audio',
    label: 'Audio',
    hint: 'Music, narration or a sound effect',
    icon: 'audio',
    color: '#10b981',
    group: 'media',
    build: () => ({ element: createElement('audio', { w: 420, h: 96 }) }),
  },
  {
    id: 'button',
    label: 'Button',
    hint: 'Add actions to it in the Behavior tab',
    icon: 'button',
    color: '#3d8bff',
    group: 'media',
    build: () => ({ element: createElement('button', { w: 220, h: 64 }) }),
  },
  {
    id: 'chart-bar',
    label: 'Bar chart',
    hint: 'Compare values side by side',
    icon: 'chart',
    color: '#8b6cff',
    group: 'data',
    build: () => ({ element: createElement('chart', { w: 640, h: 400, props: { chartType: 'bar' } }) }),
  },
  {
    id: 'chart-line',
    label: 'Line chart',
    hint: 'Show a trend over time',
    icon: 'chart',
    color: '#3d8bff',
    group: 'data',
    build: () => ({
      element: createElement('chart', {
        w: 640,
        h: 400,
        props: {
          chartType: 'line',
          title: 'Weekly active users',
          labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
          series: [
            { name: 'Web', values: [120, 135, 150, 148, 172, 190, 205, 230] },
            { name: 'Mobile', values: [80, 96, 104, 130, 141, 166, 180, 214] },
          ],
        },
      }),
    }),
  },
  {
    id: 'table',
    label: 'Table',
    hint: 'Rows and columns viewers can sort',
    icon: 'table',
    color: '#0abde3',
    group: 'data',
    build: () => ({ element: createElement('table', { w: 600, h: 260 }) }),
  },
  {
    id: 'next',
    label: 'Next button',
    hint: 'Goes to the next slide — works instantly',
    icon: 'next',
    color: '#3d8bff',
    group: 'interactive',
    build: ({ project }) => ({
      element: createElement('navButton', {
        w: 190,
        h: 60,
        props: { label: project.kind === 'page' ? 'Keep reading' : 'Next', icon: project.kind === 'page' ? 'chevron-down' : 'arrow-right' },
      }),
    }),
  },
  {
    id: 'back',
    label: 'Back button',
    hint: 'Returns to the previous slide',
    icon: 'next',
    color: '#3d8bff',
    group: 'interactive',
    build: () => ({
      element: createElement('navButton', {
        w: 170,
        h: 60,
        role: 'secondary',
        props: { label: 'Back', icon: 'arrow-left', iconSide: 'left', target: 'prev' },
      }),
    }),
  },
  {
    id: 'quiz',
    label: 'Quiz question',
    hint: 'Multiple choice with instant feedback',
    icon: 'quiz',
    color: '#e84393',
    group: 'interactive',
    build: () => ({ element: createElement('quiz', { w: 560, h: 420 }) }),
  },
  {
    id: 'countdown',
    label: 'Countdown',
    hint: 'Counts down to a date and time',
    icon: 'timer',
    color: '#f39c12',
    group: 'interactive',
    build: () => ({ element: createElement('countdown', { w: 560, h: 190, props: { timezone: localTimeZone() } }) }),
  },
  {
    id: 'beforeAfter',
    label: 'Before & After',
    hint: 'Drag a divider to compare two images',
    icon: 'compare',
    color: '#f39c12',
    group: 'interactive',
    build: () => {
      const s = sampleAssets();
      return {
        element: createElement('beforeAfter', { w: 600, h: 400, props: { before: SAMPLE_IDS.before, after: SAMPLE_IDS.after } }),
        assets: [s[SAMPLE_IDS.before], s[SAMPLE_IDS.after]],
      };
    },
  },
  {
    id: 'gallery',
    label: 'Gallery',
    hint: 'Click through a set of images',
    icon: 'gallery',
    color: '#e84393',
    group: 'interactive',
    build: () => {
      const s = sampleAssets();
      const ids = [SAMPLE_IDS.ocean, SAMPLE_IDS.desert, SAMPLE_IDS.aurora];
      return { element: createElement('gallery', { w: 600, h: 400, props: { images: ids } }), assets: ids.map((i) => s[i]) };
    },
  },
  {
    id: 'scrollText',
    label: 'Scrolling text',
    hint: 'A panel that scrolls on its own',
    icon: 'scroll',
    color: '#0abde3',
    group: 'interactive',
    build: () => ({ element: createElement('scrollText', { w: 420, h: 340 }) }),
  },
  {
    id: 'progress',
    label: 'Progress bar',
    hint: 'Shows how far along viewers are',
    icon: 'progress',
    color: '#8e44ad',
    group: 'interactive',
    build: ({ project }) => ({
      element: createElement('progress', { w: 420, h: 16, props: { source: project.kind === 'page' ? 'scroll' : 'slides' } }),
    }),
  },
  {
    id: 'score',
    label: 'Score counter',
    hint: 'Shows a number variable, e.g. a score',
    icon: 'score',
    color: '#8e44ad',
    group: 'interactive',
    build: ({ project }) => {
      const existing = project.variables[0];
      const v = existing ?? createVariable('Score', 0);
      return {
        element: text('score', 280, 64, { text: `${v.name}: {${v.name}}`, size: 36, align: 'center', valign: 'middle', padding: 8 }),
        variables: existing ? [] : [v],
      };
    },
  },
];

export const CATALOG_GROUPS: Array<{ id: CatalogItem['group']; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'media', label: 'Media & buttons' },
  { id: 'shapes', label: 'Shapes & arrows' },
  { id: 'data', label: 'Charts & tables' },
  { id: 'interactive', label: 'Ready-made interactive' },
];

// ---------------- page & section templates ----------------

export interface PageTemplate {
  id: string;
  label: string;
  kind: Project['kind'];
  /** Elements carry theme roles; the theme supplies their colours, fonts and the background. */
  build(project: Project): { backgroundRole: string; elements: SceneElement[]; height?: number };
}

const T = (text: string, x: number, y: number, w: number, h: number, role: string, props: Record<string, unknown> = {}) =>
  createElement('text', { x, y, w, h, role, props: { text, ...props } });

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'blank', label: 'Blank', kind: 'slides', build: () => ({ backgroundRole: 'base', elements: [] }) },
  {
    id: 'title',
    label: 'Title',
    kind: 'slides',
    build: () => ({
      backgroundRole: 'hero',
      elements: [
        T('Your big idea', 140, 250, 1000, 110, 'display', { size: 88, align: 'center' }),
        T('A short line that sets the scene', 240, 380, 800, 50, 'displaySub', { size: 30, align: 'center' }),
      ],
    }),
  },
  {
    id: 'titleText',
    label: 'Title + text',
    kind: 'slides',
    build: () => ({
      backgroundRole: 'base',
      elements: [
        createElement('shape', { x: 96, y: 96, w: 72, h: 10, role: 'line' }),
        T('Slide title', 96, 130, 1000, 80, 'heading', { size: 56 }),
        T('Add your main points here.\nKeep each one short and sweet.\nDouble-click any text to edit it.', 96, 250, 900, 260, 'body', {
          size: 30,
          lineHeight: 1.6,
        }),
      ],
    }),
  },
  {
    id: 'imageText',
    label: 'Image + text',
    kind: 'slides',
    build: () => ({
      backgroundRole: 'alt',
      elements: [
        createElement('image', { x: 80, y: 110, w: 520, h: 500 }),
        T('Tell the story', 680, 200, 520, 80, 'heading', { size: 52 }),
        T('Pair a picture with a few words. Select the image and choose "Replace image" to use your own.', 680, 300, 500, 200, 'body', {
          size: 26,
          lineHeight: 1.5,
        }),
      ],
    }),
  },
  {
    id: 'chartText',
    label: 'Chart + text',
    kind: 'slides',
    build: () => ({
      backgroundRole: 'base',
      elements: [
        T('The numbers', 80, 96, 420, 70, 'heading', { size: 48 }),
        T('Explain what the chart shows in a sentence or two. Viewers can hover the chart for exact values.', 80, 190, 400, 200, 'body', {
          size: 24,
          lineHeight: 1.5,
        }),
        createElement('chart', { x: 540, y: 120, w: 660, h: 460 }),
      ],
    }),
  },
  {
    id: 'statement',
    label: 'Big statement',
    kind: 'slides',
    build: () => ({
      backgroundRole: 'dark',
      elements: [
        T('“One sentence that everyone will remember.”', 140, 230, 1000, 260, 'quote', {
          size: 64,
          align: 'center',
          valign: 'middle',
          lineHeight: 1.2,
        }),
      ],
    }),
  },
  { id: 'blank-section', label: 'Blank', kind: 'page', build: (p) => ({ backgroundRole: 'base', elements: [], height: p.settings.height }) },
  {
    id: 'hero',
    label: 'Hero',
    kind: 'page',
    build: () => ({
      height: 560,
      backgroundRole: 'accent',
      elements: [
        T('Welcome to my page', 100, 150, 800, 90, 'display', { size: 68, align: 'center' }),
        T('A short introduction that makes people want to scroll.', 150, 260, 700, 70, 'displaySub', { size: 26, align: 'center', lineHeight: 1.4 }),
        createElement('navButton', { x: 390, y: 380, w: 220, h: 62, role: 'hero', props: { label: 'Keep reading', icon: 'chevron-down' } }),
      ],
    }),
  },
  {
    id: 'textImage',
    label: 'Text + image',
    kind: 'page',
    build: () => ({
      height: 520,
      backgroundRole: 'base',
      elements: [
        T('A section title', 60, 130, 420, 70, 'heading', { size: 44 }),
        T('Explain one idea per section. Short paragraphs and generous spacing make pages easy to read.', 60, 220, 400, 160, 'body', {
          size: 21,
          lineHeight: 1.6,
        }),
        createElement('image', { x: 520, y: 80, w: 420, h: 360 }),
      ],
    }),
  },
  {
    id: 'features',
    label: 'Three features',
    kind: 'page',
    build: () => {
      const els: SceneElement[] = [T('Why it works', 100, 60, 800, 64, 'heading', { size: 42, align: 'center' })];
      ['Simple', 'Playful', 'Portable'].forEach((title, i) => {
        const x = 60 + i * 300;
        els.push(createElement('shape', { x, y: 160, w: 280, h: 260, role: 'card' }));
        els.push(T(title, x + 28, 190, 224, 44, 'subheading', { size: 28 }));
        els.push(T('A sentence or two about this point.', x + 28, 245, 224, 120, 'body', { size: 19, lineHeight: 1.5 }));
      });
      return { height: 500, backgroundRole: 'alt', elements: els };
    },
  },
  {
    id: 'countdownSection',
    label: 'Countdown',
    kind: 'page',
    build: () => ({
      height: 460,
      backgroundRole: 'alt',
      elements: [
        T('Mark your calendar', 100, 70, 800, 64, 'heading', { size: 44, align: 'center' }),
        createElement('countdown', { x: 200, y: 170, w: 600, h: 200, props: { timezone: localTimeZone() } }),
      ],
    }),
  },
  {
    id: 'cta',
    label: 'Call to action',
    kind: 'page',
    build: () => ({
      height: 360,
      backgroundRole: 'dark',
      elements: [
        T('Ready to say hello?', 100, 90, 800, 70, 'display', { size: 48, align: 'center' }),
        createElement('button', { x: 380, y: 200, w: 240, h: 64, role: 'hero', props: { label: 'Get in touch' } }),
      ],
    }),
  },
];

export function templatesFor(kind: Project['kind']) {
  return PAGE_TEMPLATES.filter((t) => t.kind === kind);
}

/** Assigns friendly unique names ("Text 3") to new elements. */
export function nameFor(project: Project, type: string): string {
  const label = elementLabel(type);
  const used = new Set(project.pages.flatMap((p) => p.elements.map((e) => e.name)));
  let n = 1;
  while (used.has(`${label} ${n}`)) n++;
  return `${label} ${n}`;
}

export function freshIds<T extends { id: string }>(items: T[], prefix: string): T[] {
  return items.map((x) => ({ ...x, id: uid(prefix) }));
}
