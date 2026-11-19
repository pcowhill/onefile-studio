import type { Asset, Background, Page, Project, SceneElement, Variable } from '../model/types';
import { createElement, createVariable } from '../model/factory';
import { linear, solid } from '../model/paint';
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
  group: 'text' | 'shapes' | 'media' | 'interactive';
  /** Opens a file picker instead of inserting immediately. */
  needsImage?: boolean;
  build(ctx: BuildContext): Built;
}

const shape = (kind: ShapeKind, label: string, color: [string, string], w = 220, h = 220): CatalogItem => ({
  id: `shape-${kind}`,
  label,
  hint: `A ${label.toLowerCase()} with a soft gradient`,
  icon: 'shape',
  color: color[1],
  group: 'shapes',
  build: () => ({ element: createElement('shape', { w, h, props: { shape: kind, fill: linear(color[0], color[1]), radius: kind === 'rect' ? 28 : 0 } }) }),
});

export const CATALOG: CatalogItem[] = [
  {
    id: 'heading',
    label: 'Heading',
    hint: 'Big, bold title text',
    icon: 'text',
    color: '#6d4aff',
    group: 'text',
    build: () => ({ element: createElement('text', { w: 640, h: 80, props: { text: 'A bold heading', size: 60, weight: 800, letterSpacing: -0.02 } }) }),
  },
  {
    id: 'subheading',
    label: 'Subheading',
    hint: 'Medium text for subtitles',
    icon: 'text',
    color: '#6d4aff',
    group: 'text',
    build: () => ({ element: createElement('text', { w: 520, h: 50, props: { text: 'A friendly subheading', size: 32, weight: 700, color: '#4b4766' } }) }),
  },
  {
    id: 'body',
    label: 'Paragraph',
    hint: 'Regular reading text',
    icon: 'text',
    color: '#6d4aff',
    group: 'text',
    build: () => ({
      element: createElement('text', {
        w: 480,
        h: 120,
        props: { text: 'Write something wonderful here. Double-click to edit this text.', size: 22, weight: 500, lineHeight: 1.5, color: '#4b4766' },
      }),
    }),
  },
  {
    id: 'tag',
    label: 'Label',
    hint: 'A small coloured tag',
    icon: 'text',
    color: '#e84393',
    group: 'text',
    build: () => ({
      element: createElement('text', {
        w: 160,
        h: 40,
        props: {
          text: 'NEW',
          size: 16,
          weight: 800,
          align: 'center',
          valign: 'middle',
          color: '#d63384',
          background: '#ffe3f1',
          radius: 999,
          letterSpacing: 0.08,
        },
      }),
    }),
  },
  shape('rect', 'Rounded box', ['#8b6cff', '#5b3df5'], 300, 200),
  shape('ellipse', 'Circle', ['#ffb86c', '#ff6b6b']),
  shape('star', 'Star', ['#ffe66d', '#ffb100']),
  shape('heart', 'Heart', ['#ff9ac1', '#ff4d8d']),
  shape('triangle', 'Triangle', ['#7ef0c1', '#14b8a6']),
  shape('blob', 'Blob', ['#9be7ff', '#3d8bff']),
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
      element: createElement('arrow', { w: 280, h: 140, props: { bend: -0.45, start: { x: 0.05, y: 0.8 }, end: { x: 0.95, y: 0.7 }, color: '#6d4aff' } }),
    }),
  },
  {
    id: 'image',
    label: 'Image',
    hint: 'Upload a picture from your computer',
    icon: 'image',
    color: '#00b894',
    group: 'media',
    needsImage: true,
    build: () => ({ element: createElement('image', { w: 400, h: 300 }) }),
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
        props: { label: 'Back', icon: 'arrow-left', iconSide: 'left', variant: 'soft', target: 'prev', shadow: false },
      }),
    }),
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
        element: createElement('text', {
          w: 280,
          h: 64,
          props: {
            text: `${v.name}: {${v.name}}`,
            size: 36,
            weight: 800,
            align: 'center',
            valign: 'middle',
            color: '#ffffff',
            background: '#6d4aff',
            radius: 18,
            padding: 8,
          },
        }),
        variables: existing ? [] : [v],
      };
    },
  },
];

export const CATALOG_GROUPS: Array<{ id: CatalogItem['group']; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'media', label: 'Images & buttons' },
  { id: 'shapes', label: 'Shapes & arrows' },
  { id: 'interactive', label: 'Ready-made interactive' },
];

// ---------------- page & section templates ----------------

export interface PageTemplate {
  id: string;
  label: string;
  kind: Project['kind'];
  build(project: Project): { background: Background; elements: SceneElement[]; height?: number };
}

const T = (text: string, x: number, y: number, w: number, h: number, props: Record<string, unknown> = {}) =>
  createElement('text', { x, y, w, h, props: { text, ...props } });

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'blank', label: 'Blank', kind: 'slides', build: () => ({ background: { paint: solid('#ffffff') }, elements: [] }) },
  {
    id: 'title',
    label: 'Title',
    kind: 'slides',
    build: () => ({
      background: { paint: linear('#6d4aff', '#b06bff', 135) },
      elements: [
        T('Your big idea', 140, 250, 1000, 110, { size: 88, weight: 900, color: '#ffffff', align: 'center', letterSpacing: -0.02 }),
        T('A short line that sets the scene', 240, 380, 800, 50, { size: 30, weight: 600, color: '#e9e2ff', align: 'center' }),
      ],
    }),
  },
  {
    id: 'titleText',
    label: 'Title + text',
    kind: 'slides',
    build: () => ({
      background: { paint: solid('#fbfaff') },
      elements: [
        createElement('shape', { x: 96, y: 96, w: 72, h: 10, props: { fill: linear('#ff7eb3', '#6d4aff', 90), radius: 6, shadow: 'none' } }),
        T('Slide title', 96, 130, 1000, 80, { size: 56, weight: 800 }),
        T('Add your main points here.\nKeep each one short and sweet.\nDouble-click any text to edit it.', 96, 250, 900, 260, {
          size: 30,
          weight: 500,
          lineHeight: 1.6,
          color: '#4b4766',
        }),
      ],
    }),
  },
  {
    id: 'imageText',
    label: 'Image + text',
    kind: 'slides',
    build: () => ({
      background: { paint: solid('#fff8ef') },
      elements: [
        createElement('image', { x: 80, y: 110, w: 520, h: 500, props: { radius: 28 } }),
        T('Tell the story', 680, 200, 520, 80, { size: 52, weight: 800 }),
        T('Pair a picture with a few words. Select the image and choose "Replace image" to use your own.', 680, 300, 500, 200, {
          size: 26,
          weight: 500,
          lineHeight: 1.5,
          color: '#5b5570',
        }),
      ],
    }),
  },
  {
    id: 'statement',
    label: 'Big statement',
    kind: 'slides',
    build: () => ({
      background: { paint: linear('#1b1834', '#3a2a7a', 160) },
      elements: [
        T('“One sentence that everyone will remember.”', 140, 230, 1000, 260, {
          size: 64,
          weight: 800,
          color: '#ffffff',
          align: 'center',
          valign: 'middle',
          lineHeight: 1.2,
        }),
      ],
    }),
  },
  { id: 'blank-section', label: 'Blank', kind: 'page', build: (p) => ({ background: { paint: solid('#ffffff') }, elements: [], height: p.settings.height }) },
  {
    id: 'hero',
    label: 'Hero',
    kind: 'page',
    build: () => ({
      height: 560,
      background: { paint: linear('#6d4aff', '#ff7eb3', 135) },
      elements: [
        T('Welcome to my page', 100, 150, 800, 90, { size: 68, weight: 900, color: '#ffffff', align: 'center', letterSpacing: -0.02 }),
        T('A short introduction that makes people want to scroll.', 150, 260, 700, 70, {
          size: 26,
          weight: 600,
          color: '#f4eeff',
          align: 'center',
          lineHeight: 1.4,
        }),
        createElement('navButton', { x: 390, y: 380, w: 220, h: 62, props: { label: 'Keep reading', icon: 'chevron-down', color: '#ffffff' } }),
      ],
    }),
  },
  {
    id: 'textImage',
    label: 'Text + image',
    kind: 'page',
    build: () => ({
      height: 520,
      background: { paint: solid('#ffffff') },
      elements: [
        T('A section title', 60, 130, 420, 70, { size: 44, weight: 800 }),
        T('Explain one idea per section. Short paragraphs and generous spacing make pages easy to read.', 60, 220, 400, 160, {
          size: 21,
          weight: 500,
          lineHeight: 1.6,
          color: '#5b5570',
        }),
        createElement('image', { x: 520, y: 80, w: 420, h: 360, props: { radius: 24 } }),
      ],
    }),
  },
  {
    id: 'features',
    label: 'Three features',
    kind: 'page',
    build: () => {
      const cols = [
        ['Simple', '#ffe3f1', '#d63384'],
        ['Playful', '#e8e2ff', '#6d4aff'],
        ['Portable', '#dcfbef', '#0f9d6e'],
      ];
      const els: SceneElement[] = [T('Why it works', 100, 60, 800, 64, { size: 42, weight: 800, align: 'center' })];
      cols.forEach(([title, bg, fg], i) => {
        const x = 60 + i * 300;
        els.push(createElement('shape', { x, y: 160, w: 280, h: 260, props: { fill: solid(bg), radius: 24, shadow: 'none' } }));
        els.push(T(title, x + 28, 190, 224, 44, { size: 28, weight: 800, color: fg }));
        els.push(T('A sentence or two about this point.', x + 28, 245, 224, 120, { size: 19, weight: 500, lineHeight: 1.5, color: '#4b4766' }));
      });
      return { height: 500, background: { paint: solid('#fbfaff') }, elements: els };
    },
  },
  {
    id: 'cta',
    label: 'Call to action',
    kind: 'page',
    build: () => ({
      height: 360,
      background: { paint: solid('#1b1834') },
      elements: [
        T('Ready to say hello?', 100, 90, 800, 70, { size: 48, weight: 800, color: '#ffffff', align: 'center' }),
        createElement('button', { x: 380, y: 200, w: 240, h: 64, props: { label: 'Get in touch', color: '#ffd23f' } }),
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
