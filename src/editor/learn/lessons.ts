import type { Interaction, Project, SceneElement, ThemeId } from '../../model/types';
import { SELF_TARGET } from '../../model/types';
import { createProject } from '../../model/factory';
import { kit } from '../../examples/v2';
import { sampleAssets } from '../../examples/art';
import { roverModel } from '../../examples/v4';
import type { CoachContext, CoachStep } from '../../templates';

/**
 * Hands-on lessons. Each one starts a separate practice project (never a
 * user's draft) and walks through a few steps in the real editor. Steps are
 * declarative: a short instruction, an optional control or element to point
 * at, and an optional check against the project or editor events. Checks are
 * semantic (counts, props, interactions) so they survive layout changes, and
 * every step can be skipped.
 */

export type LessonLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Lesson {
  id: string;
  number: number;
  level: LessonLevel;
  title: string;
  summary: string;
  minutes: number;
  kind: Project['kind'];
  setup(): Project;
  steps: CoachStep[];
}

export const LEVELS: Array<{ id: LessonLevel; label: string; blurb: string; color: string }> = [
  { id: 'beginner', label: 'Beginner', blurb: 'Make, interact, share — the essentials in a few minutes.', color: '#2bb673' },
  { id: 'intermediate', label: 'Intermediate', blurb: 'Media, motion and numbers that change.', color: '#3d8bff' },
  { id: 'advanced', label: 'Advanced', blurb: 'Logic, challenges and the most playful components.', color: '#6d4aff' },
];

// ---------------------------------------------------------------- semantic helpers
type Ctx = CoachContext;
const all = (p: Project): SceneElement[] => p.pages.flatMap((pg) => pg.elements);
const ofType = (p: Project, type: string) => all(p).filter((e) => e.type === type);
const count = (p: Project, type: string) => ofType(p, type).length;
/** An element of `type` was added during this step. */
const added = (type: string) => (c: Ctx) => count(c.project, type) > count(c.stepStart, type);
const before = (c: Ctx, id: string) => all(c.stepStart).find((e) => e.id === id);
const interactions = (p: Project): Interaction[] => [
  ...all(p).flatMap((e) => e.interactions),
  ...p.pages.flatMap((pg) => pg.interactions ?? []),
  ...(p.interactions ?? []),
];
const hasAction = (ixs: Interaction[], type: string, pred: (params: Record<string, unknown>) => boolean = () => true) =>
  ixs.some((x) => x.actions.some((a) => a.type === type && pred(a.params as Record<string, unknown>)));
const stepEvent = (name: string) => (c: Ctx) => c.stepEvents.has(name);
const props = (e: SceneElement) => e.props as Record<string, unknown>;

const intro = (id: string, title: string, body: string): CoachStep => ({ id, title, body });
const preview = (body = 'Click Preview to try it like a viewer. Press Esc to come back.'): CoachStep => ({
  id: 'preview',
  title: 'Preview it',
  body,
  control: '[data-testid="preview"]',
  done: stepEvent('preview'),
});
const finale = (body: string): CoachStep => ({ id: 'finish', title: 'You did it! 🎉', body });

/** A practice project: clearly named, in its own draft, never a user's file. */
function practice(kind: Project['kind'], title: string, theme: ThemeId = 'playful', build?: (p: Project, k: ReturnType<typeof kit>) => void): Project {
  const p = createProject(kind, `Practice — ${title}`, theme);
  if (build) build(p, kit(theme));
  return p;
}

export const LESSONS: Lesson[] = [
  {
    id: 'first-onefile',
    number: 1,
    level: 'beginner',
    title: 'Your first OneFile',
    summary: 'Add text and a shape, move and resize them, then preview.',
    minutes: 3,
    kind: 'slides',
    setup: () => practice('slides', 'Your first OneFile'),
    steps: [
      intro('welcome', 'Welcome!', 'This is a practice project, saved separately from your work. Follow the steps — or skip any of them.'),
      { id: 'text', title: 'Add some text', body: 'Click Text in the toolbar.', control: '[data-testid="quick-heading"]', done: added('text') },
      {
        id: 'type',
        title: 'Make it yours',
        body: 'Double-click the new text on the slide and type something — your name, a title, anything.',
        done: (c) => ofType(c.project, 'text').some((e) => before(c, e.id) && props(e).text !== props(before(c, e.id)!).text),
      },
      { id: 'shape', title: 'Add a shape', body: 'Click Shape in the toolbar.', control: '[data-testid="quick-shape-rect"]', done: added('shape') },
      {
        id: 'move',
        title: 'Move and resize',
        body: 'Drag the shape to a new spot, then pull a round corner handle to change its size.',
        done: (c) =>
          ofType(c.project, 'shape').some((e) => {
            const b = before(c, e.id);
            return !!b && (b.x !== e.x || b.y !== e.y) && (b.w !== e.w || b.h !== e.h);
          }),
      },
      preview(),
      finale('You made your first OneFile. Next, try “Make it interactive” — or keep playing here.'),
    ],
  },
  {
    id: 'interactive',
    number: 2,
    level: 'beginner',
    title: 'Make it interactive',
    summary: 'A button that reveals a hidden message when clicked.',
    minutes: 3,
    kind: 'slides',
    setup: () =>
      practice('slides', 'Make it interactive', 'playful', (p, { text }) => {
        p.pages[0].elements.push(
          text('el_l2_title', 'Heading', [80, 80, 900, 80], 'heading', 'Click the button…', { size: 52 }),
          text('el_l2_secret', 'Secret message', [80, 360, 700, 90], 'heading', 'Surprise! You made this happen. 🎉', { size: 40 }, { hidden: true }),
        );
      }),
    steps: [
      intro(
        'welcome',
        'A hidden message',
        'There is a “Secret message” on this slide. It looks faded because it starts hidden. Let’s make a button that reveals it.',
      ),
      { id: 'button', title: 'Add a button', body: 'Click Button in the toolbar.', control: '[data-testid="quick-button"]', done: added('button') },
      {
        id: 'when',
        title: 'Choose what happens',
        body: 'With the button selected, find “When clicked” in the Design panel and choose “Show an element”.',
        control: '[data-testid="quick-click"]',
        done: (c) => hasAction(interactions(c.project), 'show') || hasAction(interactions(c.project), 'toggle'),
      },
      {
        id: 'target',
        title: 'Pick the secret',
        body: 'Choose “Secret message” as the element to show. (In the Behavior tab you can add more actions later.)',
        control: '[data-testid="tab-behavior"]',
        done: (c) =>
          hasAction(interactions(c.project), 'show', (a) => a.target === 'el_l2_secret') ||
          hasAction(interactions(c.project), 'toggle', (a) => a.target === 'el_l2_secret'),
      },
      preview('Preview, then click your button — the secret appears!'),
      finale('That’s an interaction: WHEN something happens → DO something. Everything in OneFile Studio works like this.'),
    ],
  },
  {
    id: 'share',
    number: 3,
    level: 'beginner',
    title: 'Share your creation',
    summary: 'Export one HTML file, open it anywhere, and bring it back to edit.',
    minutes: 3,
    kind: 'slides',
    setup: () =>
      practice('slides', 'Share your creation', 'playful', (p, { text, el }) => {
        p.pages[0].elements.push(
          text('el_l3_title', 'Heading', [80, 160, 900, 100], 'heading', 'Made with OneFile Studio', { size: 60 }),
          text('el_l3_body', 'Text', [80, 280, 700, 80], 'body', 'This whole presentation lives in a single HTML file.', { size: 26 }),
          el('shape', 'el_l3_star', 'Star', [980, 220, 200, 200], 'tone1', { shape: 'star' }, { entrance: { preset: 'zoomIn', duration: 800, delay: 200 } }),
        );
      }),
    steps: [
      {
        id: 'export',
        title: 'Export',
        body: 'Click Export, then Download. You get one .html file.',
        control: '[data-testid="export"]',
        done: stepEvent('export'),
      },
      intro(
        'inside',
        'What’s inside?',
        'Everything: your slides, pictures, videos and sounds, fonts, interactions and the player. No internet needed — and the full project, so it can be edited again.',
      ),
      intro(
        'open',
        'Open it anywhere',
        'Find the file in your downloads and double-click it. It opens in any modern browser, even offline. E-mail it or attach it to a ticket.',
      ),
      {
        id: 'reimport',
        title: 'Bring it back',
        body: 'To keep editing later, click the folder button (Open file) and choose the file you exported.',
        control: '[aria-label="Open file"], [data-testid="open-file"]',
        done: stepEvent('import'),
      },
      finale('Export and re-import are all you need: one file to share, and the same file to keep working on.'),
    ],
  },
  {
    id: 'media',
    number: 4,
    level: 'intermediate',
    title: 'Interactive media',
    summary: 'Add and replace a picture, then build a Before & After slider.',
    minutes: 4,
    kind: 'slides',
    setup: () =>
      practice('slides', 'Interactive media', 'playful', (p) => {
        Object.assign(p.assets, sampleAssets());
      }),
    steps: [
      {
        id: 'image',
        title: 'Add an image',
        body: 'Click Image in the toolbar. It starts as a placeholder.',
        control: '[data-testid="quick-image"]',
        done: added('image'),
      },
      {
        id: 'choose',
        title: 'Choose a picture',
        body: 'In the Design panel choose Library and pick a sample picture — or upload your own.',
        done: (c) => ofType(c.project, 'image').some((e) => !!props(e).assetId && c.project.assets[String(props(e).assetId)]),
      },
      {
        id: 'replace',
        title: 'Replace it',
        body: 'Pick a different picture for the same element. Its size, style and interactions stay as they are.',
        done: (c) =>
          ofType(c.project, 'image').some((e) => {
            const b = before(c, e.id);
            return !!b && !!props(b).assetId && props(b).assetId !== props(e).assetId;
          }),
      },
      {
        id: 'ba',
        title: 'Add a Before & After slider',
        body: 'Open Insert (left) and choose Before & After. It comes with sample pictures you can swap.',
        control: '[data-testid="tab-insert"], [data-testid="insert-beforeAfter"]',
        done: added('beforeAfter'),
      },
      preview('Preview and drag the slider. Components like this work by themselves — no interactions needed.'),
      finale('Galleries, videos, sounds and sliders all have built-in interactions. Replace their media any time from the Design panel.'),
    ],
  },
  {
    id: 'motion',
    number: 5,
    level: 'intermediate',
    title: 'Animations and navigation',
    summary: 'Entrance animations, a button that animates, and moving between slides.',
    minutes: 4,
    kind: 'slides',
    setup: () =>
      practice('slides', 'Animations and navigation', 'playful', (p, { text, el, page }) => {
        p.pages[0].elements.push(
          text('el_l5_title', 'Heading', [80, 80, 800, 80], 'heading', 'Things that move', { size: 52 }),
          el('shape', 'el_l5_star', 'Star', [880, 220, 240, 240], 'tone0', { shape: 'star' }),
        );
        p.pages.push(
          page('pg_l5_2', 'Slide 2', 'alt', [
            text('el_l5_s2', 'Heading', [80, 260, 1100, 120], 'heading', 'You made it to slide 2!', { size: 60, align: 'center' }),
          ]),
        );
      }),
    steps: [
      {
        id: 'entrance',
        title: 'Add an entrance',
        body: 'Select the star, open the Behavior tab and pick an entrance animation such as Pop.',
        element: 'el_l5_star',
        control: '[data-testid="tab-behavior"]',
        done: (c) => all(c.project).some((e) => e.entrance && !before(c, e.id)?.entrance),
      },
      {
        id: 'timing',
        title: 'Play with timing',
        body: 'Under the animation, change its length or add a delay. Use the small Preview button to watch it.',
        done: (c) =>
          all(c.project).some((e) => {
            const b = before(c, e.id)?.entrance;
            return !!e.entrance && !!b && (b.duration !== e.entrance.duration || b.delay !== e.entrance.delay);
          }),
      },
      {
        id: 'animate',
        title: 'Animate on click',
        body: 'Add a button. In “When clicked” choose “Something else…”, then add the action Animate → the star.',
        control: '[data-testid="quick-button"]',
        done: (c) => hasAction(interactions(c.project), 'animate'),
      },
      {
        id: 'nav',
        title: 'Go to the next slide',
        body: 'Open Insert and add a Next button — or give a button the “Go to next slide” action.',
        control: '[data-testid="tab-insert"]',
        done: (c) => count(c.project, 'navButton') > count(c.stepStart, 'navButton') || hasAction(interactions(c.project), 'navigate'),
      },
      preview(),
      finale('Entrance animations play when a slide appears; “Animate” plays on demand. Arrow keys and Next buttons move between slides.'),
    ],
  },
  {
    id: 'variables',
    number: 6,
    level: 'intermediate',
    title: 'Variables and data',
    summary: 'Count clicks with a variable, show it in text and a progress bar.',
    minutes: 5,
    kind: 'slides',
    setup: () =>
      practice('slides', 'Variables and data', 'playful', (p, { text }) => {
        p.pages[0].elements.push(text('el_l6_title', 'Heading', [80, 80, 900, 80], 'heading', 'Click counter', { size: 52 }));
      }),
    steps: [
      {
        id: 'create',
        title: 'Create a variable',
        body: 'Open Variables (left) and click “Add variable”. Name it Clicks.',
        control: '[data-testid="tab-variables"], [data-testid="add-variable"]',
        done: (c) => c.project.variables.length > c.stepStart.variables.length,
      },
      {
        id: 'add',
        title: 'Count clicks',
        body: 'Add a button. In the Behavior tab add an interaction: When clicked → Add 1 to your variable.',
        control: '[data-testid="tab-behavior"]',
        done: (c) => hasAction(interactions(c.project), 'varAdd'),
      },
      {
        id: 'show',
        title: 'Show the number',
        body: 'Add a text and type the variable’s name in curly brackets, for example: You clicked {Clicks} times.',
        done: (c) => ofType(c.project, 'text').some((e) => c.project.variables.some((v) => String(props(e).text).includes(`{${v.name}}`))),
      },
      {
        id: 'progress',
        title: 'Fill a progress bar',
        body: 'Insert a Progress bar, set “Follows” to your variable and pick a maximum such as 10.',
        control: '[data-testid="tab-insert"], [data-testid="insert-progress"]',
        done: (c) => ofType(c.project, 'progress').some((e) => props(e).source === 'variable' && !!props(e).variableId),
      },
      preview('Preview and click your button — the text and the bar update together.'),
      finale('Variables remember numbers while someone views your file: scores, steps, votes, progress.'),
    ],
  },
  {
    id: 'challenge',
    number: 7,
    level: 'advanced',
    title: 'Build a small interactive challenge',
    summary: 'Collect three keys to open a treasure chest — with conditions and branching.',
    minutes: 6,
    kind: 'slides',
    setup: () =>
      practice('slides', 'Treasure challenge', 'playful', (p, { text, el }) => {
        p.variables = [{ id: 'var_l7_keys', name: 'Keys', type: 'number', initial: 0 }];
        p.pages[0].elements.push(
          text('el_l7_title', 'Heading', [80, 60, 900, 70], 'heading', 'Find the three keys', { size: 48 }),
          text('el_l7_count', 'Key counter', [80, 132, 600, 40], 'body', 'Keys found: {Keys} of 3', { size: 24 }),
          ...[0, 1, 2].map((i) =>
            el('shape', `el_l7_key${i}`, `Key ${i + 1}`, [120 + i * 220, 300 + (i % 2) * 120, 110, 110], `tone${i + 1}`, { shape: 'diamond' }),
          ),
          text('el_l7_chest', 'Treasure chest', [880, 300, 280, 200], 'score', '🔒 Treasure chest', { size: 30, align: 'center', valign: 'middle' }),
          text('el_l7_win', 'You win!', [700, 540, 520, 70], 'heading', 'You opened the chest! 🏆', { size: 38, align: 'center' }, { hidden: true }),
        );
      }),
    steps: [
      intro(
        'plan',
        'The plan',
        'Three keys (diamonds), a chest and a hidden “You win!”. A variable called Keys counts the keys found. You’ll wire it up with WHEN → IF → DO.',
      ),
      {
        id: 'keys',
        title: 'Collect a key',
        body: 'Select Key 1. Behavior tab → Add interaction → When clicked → Add 1 to Keys, then Hide → This element. Repeat for the other keys.',
        element: 'el_l7_key0',
        control: '[data-testid="add-interaction"]',
        done: (c) =>
          all(c.project).some(
            (e) =>
              /^el_l7_key/.test(e.id) &&
              hasAction(e.interactions, 'varAdd') &&
              hasAction(e.interactions, 'hide', (a) => a.target === SELF_TARGET || a.target === e.id),
          ),
      },
      {
        id: 'condition',
        title: 'Open with a condition',
        body: 'Select the chest. Add: When clicked → Show “You win!”, and add the condition “Keys is at least 3”.',
        element: 'el_l7_chest',
        done: (c) => {
          const chest = all(c.project).find((e) => e.id === 'el_l7_chest');
          return !!chest?.interactions.some((x) => x.conditions.some((k) => k.op === 'gte' || k.op === 'eq') && x.actions.some((a) => a.type === 'show'));
        },
      },
      {
        id: 'branch',
        title: 'Not yet? Shake it',
        body: 'Add a second interaction to the chest: When clicked, if Keys is less than 3 → Animate the chest with Shake.',
        element: 'el_l7_chest',
        done: (c) => {
          const chest = all(c.project).find((e) => e.id === 'el_l7_chest');
          return !!chest?.interactions.some((x) => x.conditions.some((k) => k.op === 'lt' || k.op === 'lte') && x.actions.some((a) => a.type === 'animate'));
        },
      },
      preview('Preview: click the chest too early (it shakes), collect all the keys, then open it.'),
      finale('Triggers, conditions and variables together make games, quizzes and branching stories — still without code.'),
    ],
  },
  {
    id: 'advanced-components',
    number: 8,
    level: 'advanced',
    title: 'Explore advanced components',
    summary: 'A 3D model, playful dragging and keyboard shortcuts on one slide.',
    minutes: 5,
    kind: 'slides',
    setup: () =>
      practice('slides', 'Advanced components', 'professional', (p) => {
        const rover = roverModel();
        p.assets[rover.id] = rover;
      }),
    steps: [
      {
        id: 'model',
        title: 'Add a 3D model',
        body: 'Open Insert and choose 3D model.',
        control: '[data-testid="tab-insert"], [data-testid="insert-model"]',
        done: added('model'),
      },
      {
        id: 'choose',
        title: 'Pick the sample rover',
        body: 'In the Design panel choose “From project” and pick the rover (or upload your own GLB file).',
        done: (c) => ofType(c.project, 'model').some((e) => !!props(e).assetId),
      },
      {
        id: 'drag',
        title: 'Make something draggable',
        body: 'Add a shape. In its Behavior tab choose a drag mode: Floaty wobbles, Weighted swings like a real object.',
        control: '[data-testid="quick-shape-rect"]',
        done: (c) => all(c.project).some((e) => e.drag?.mode === 'floaty' || e.drag?.mode === 'weighted'),
      },
      {
        id: 'key',
        title: 'Add a keyboard shortcut',
        body: 'Click an empty part of the slide, open Behavior and add: When a key is pressed (e.g. R) → Turn 3D view → Reset.',
        control: '[data-testid="tab-behavior"]',
        done: (c) =>
          c.project.pages.some((pg) => (pg.interactions ?? []).some((x) => x.trigger === 'key' && !!(x.options as { key?: string } | undefined)?.key)),
      },
      preview('Preview: turn the model, drag your shape and press your key.'),
      finale('3D, physics dragging and keyboard rules all export into the same single file. Explore the Insert panel for more.'),
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
