import type { Project, ProjectKind, SceneElement, ThemeId } from '../model/types';
import { uid } from '../model/ids';
import { applyProjectTheme } from '../model/theme';
import { validateProject } from '../model/validate';
import {
  beforeAfterStory,
  eventAnnouncementTemplate,
  featureWalkthrough,
  findElement,
  interactiveGreeting,
  meetingPresentation,
  technicalExplainerTemplate,
} from './projects';

/**
 * Template registry. A template is metadata + a factory that returns an
 * ordinary project (see `projects.ts`) + an optional quick-start guide. Using a
 * template always builds a fresh copy, so the originals can never change.
 */

export type TemplateCategory = 'presentations' | 'tutorials' | 'announcements' | 'interactive' | 'personal';

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'presentations', label: 'Presentations' },
  { id: 'tutorials', label: 'Tutorials & Explanations' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'interactive', label: 'Interactive Experiences' },
  { id: 'personal', label: 'Personal & Creative' },
];

/** What the quick-start guide (and lessons) can check against. */
export interface CoachContext {
  project: Project;
  /** The project as it was when the guide/lesson started. */
  initial: Project;
  /** The project as it was when the current step started (lessons). */
  stepStart: Project;
  /** Editor events since the guide started ('preview', 'export', 'import', 'theme'…). */
  events: ReadonlySet<string>;
  /** Events since the current step started. */
  stepEvents: ReadonlySet<string>;
  selection: readonly string[];
  /** Editor panels currently shown (lessons point at tabs). */
  ui?: { inspectorTab: string; leftTab: string };
}

export interface CoachStep {
  id: string;
  title: string;
  /** One or two short sentences. */
  body: string;
  /** Element to reveal (select + scroll to its slide) on "Show me". */
  element?: string;
  /** Editor control to highlight (CSS selector of a stable data-testid). */
  control?: string;
  /** Done when this returns true. Steps without a check are confirmed by the user. */
  done?(ctx: CoachContext): boolean;
}

export interface TemplateDef {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  kind: ProjectKind;
  theme: ThemeId;
  difficulty: 'Easy' | 'Moderate';
  /** Short feature chips shown on the card ("Chart", "Quiz"…). */
  features: string[];
  build(theme?: ThemeId): Project;
  guide: CoachStep[];
}

// ---------------------------------------------------------------- check helpers
const el = (p: Project, id: string): SceneElement | undefined => findElement(p, id)?.el;
const prop = (p: Project, id: string, key: string) => (el(p, id)?.props as Record<string, unknown> | undefined)?.[key];
/** The element's prop differs from how the template started (or the element is gone). */
export const changed =
  (id: string, ...keys: string[]) =>
  (c: CoachContext) => {
    const now = el(c.project, id);
    if (!now) return el(c.initial, id) !== undefined;
    return keys.some((k) => JSON.stringify(prop(c.project, id, k)) !== JSON.stringify(prop(c.initial, id, k)));
  };
export const anyChanged =
  (...checks: Array<(c: CoachContext) => boolean>) =>
  (c: CoachContext) =>
    checks.some((f) => f(c));
export const happened = (event: string) => (c: CoachContext) => c.events.has(event);

const previewStep: CoachStep = {
  id: 'preview',
  title: 'Preview your project',
  body: 'Click Preview to try it exactly as viewers will. Press Esc to come back.',
  control: '[data-testid="preview"]',
  done: happened('preview'),
};
const exportStep: CoachStep = {
  id: 'export',
  title: 'Export your OneFile',
  body: 'Export makes one HTML file you can e-mail, attach to a ticket or open offline — and re-open here to keep editing.',
  control: '[data-testid="export"]',
  done: happened('export'),
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'feature-walkthrough',
    title: 'Feature Walkthrough',
    description: 'Explain a finished feature or ticket: screenshot tour, clickable callouts, design choices and next steps.',
    category: 'presentations',
    kind: 'slides',
    theme: 'professional',
    difficulty: 'Easy',
    features: ['Clickable callouts', 'Scrolling notes', 'Link'],
    build: featureWalkthrough,
    guide: [
      {
        id: 'title',
        title: 'Change the title',
        body: 'Double-click “Smart Filters” on the first slide and type your feature’s name.',
        element: 'el_fw_title',
        done: changed('el_fw_title', 'text'),
      },
      {
        id: 'screenshot',
        title: 'Replace the screenshot',
        body: 'Select the screenshot, then Upload, Library or Screenshot in the Design panel. The other copies can follow in one click.',
        element: 'el_fw_hero_shot',
        done: changed('el_fw_hero_shot', 'assetId'),
      },
      {
        id: 'explain',
        title: 'Update the explanation',
        body: 'On “See it in action”, double-click the paragraph and describe your change.',
        element: 'el_fw_explain',
        done: changed('el_fw_explain', 'text'),
      },
      previewStep,
      exportStep,
    ],
  },
  {
    id: 'meeting',
    title: 'Meeting Presentation',
    description: 'A friendly alternative to a slide deck: clickable agenda, highlights, live chart, sortable table and a quick question.',
    category: 'presentations',
    kind: 'slides',
    theme: 'professional',
    difficulty: 'Easy',
    features: ['Chart', 'Table', 'Quiz', 'Agenda links'],
    build: meetingPresentation,
    guide: [
      {
        id: 'title',
        title: 'Change the title',
        body: 'Double-click “Quarterly review” and type your meeting’s name.',
        element: 'el_mt_title',
        done: changed('el_mt_title', 'text'),
      },
      {
        id: 'agenda',
        title: 'Edit the agenda',
        body: 'Select an agenda button and change its label in the Design panel. Each one already jumps to its slide.',
        element: 'el_mt_ag0',
        done: anyChanged(...[0, 1, 2, 3, 4].map((i) => changed(`el_mt_ag${i}`, 'label'))),
      },
      {
        id: 'chart',
        title: 'Put in your numbers',
        body: 'Select the chart and choose “Edit data” — type, paste from a spreadsheet or import a CSV.',
        element: 'el_mt_chart',
        done: changed('el_mt_chart', 'series', 'labels'),
      },
      previewStep,
      exportStep,
    ],
  },
  {
    id: 'technical-explainer',
    title: 'Technical Explainer',
    description: 'Walk someone through a system or process: a clickable diagram, step-by-step reveals with Space, and keyboard shortcuts.',
    category: 'tutorials',
    kind: 'slides',
    theme: 'technical',
    difficulty: 'Moderate',
    features: ['Diagram', 'Click to reveal', 'Keyboard', 'Variable'],
    build: technicalExplainerTemplate,
    guide: [
      {
        id: 'title',
        title: 'Change the title',
        body: 'Double-click the title on the first slide and name your topic.',
        element: 'el_tx_title',
        done: changed('el_tx_title', 'text'),
      },
      {
        id: 'boxes',
        title: 'Rename the boxes',
        body: 'On “The big picture”, select a box and change its label. Arrows and clicks stay connected.',
        element: 'el_tx_node0',
        done: anyChanged(...[0, 1, 2, 3].map((i) => changed(`el_tx_node${i}`, 'label'))),
      },
      {
        id: 'explain',
        title: 'Write the explanations',
        body: 'Each box reveals a note. Notes start hidden — find them in the slide’s layers or select one here.',
        element: 'el_tx_call0',
        done: anyChanged(...[0, 1, 2, 3].map((i) => changed(`el_tx_call${i}`, 'text'))),
      },
      previewStep,
      exportStep,
    ],
  },
  {
    id: 'before-after',
    title: 'Before & After Story',
    description: 'Show a transformation with a drag-to-compare slider, a scrolling story panel, results and a closing quote.',
    category: 'interactive',
    kind: 'page',
    theme: 'editorial',
    difficulty: 'Easy',
    features: ['Before/After slider', 'Scrolling text', 'Chart'],
    build: beforeAfterStory,
    guide: [
      {
        id: 'title',
        title: 'Change the headline',
        body: 'Double-click the big headline and tell your story in a few words.',
        element: 'el_ba_title',
        done: changed('el_ba_title', 'text'),
      },
      {
        id: 'before',
        title: 'Add your “before” picture',
        body: 'Select the slider, then choose the Before image in the Design panel (upload, library or screenshot).',
        element: 'el_ba_slider',
        done: changed('el_ba_slider', 'before'),
      },
      {
        id: 'after',
        title: 'Add your “after” picture',
        body: 'Same place: choose the After image.',
        element: 'el_ba_slider',
        done: changed('el_ba_slider', 'after'),
      },
      previewStep,
      exportStep,
    ],
  },
  {
    id: 'event',
    title: 'Event Announcement',
    description: 'Invite people with style: big title, live countdown, picture, details cards, schedule and an RSVP link.',
    category: 'announcements',
    kind: 'page',
    theme: 'playful',
    difficulty: 'Easy',
    features: ['Countdown', 'Animated GIF', 'Table', 'Link'],
    build: eventAnnouncementTemplate,
    guide: [
      {
        id: 'name',
        title: 'Name your event',
        body: 'Double-click “Riverside Summer Picnic” and type your event’s name.',
        element: 'el_ev_title',
        done: changed('el_ev_title', 'text'),
      },
      {
        id: 'date',
        title: 'Set the date',
        body: 'Select the countdown and pick the date and time. Then update the Event Date line under the title.',
        element: 'el_ev_countdown',
        done: anyChanged(changed('el_ev_countdown', 'target', 'timezone'), changed('el_ev_date', 'text')),
      },
      {
        id: 'picture',
        title: 'Use your own picture',
        body: 'Select the park picture and replace it with a photo.',
        element: 'el_ev_picture',
        done: changed('el_ev_picture', 'assetId'),
      },
      {
        id: 'theme',
        title: 'Try another style',
        body: 'Click the style button next to the title to restyle the whole page. Your text stays the same.',
        control: '[data-testid="theme-button"]',
        done: (c) => c.project.settings.theme !== c.initial.settings.theme,
      },
      previewStep,
      exportStep,
    ],
  },
  {
    id: 'greeting',
    title: 'Interactive Greeting',
    description: 'A birthday or thank-you card with a present to open, wishes to reveal, floaty balloons and confetti.',
    category: 'personal',
    kind: 'slides',
    theme: 'playful',
    difficulty: 'Easy',
    features: ['Surprise reveal', 'Floaty drag', 'Confetti'],
    build: interactiveGreeting,
    guide: [
      {
        id: 'name',
        title: 'Add their name',
        body: 'Double-click “Sam!” and type the name of the person you are celebrating.',
        element: 'el_gr_name',
        done: changed('el_gr_name', 'text'),
      },
      {
        id: 'message',
        title: 'Write your message',
        body: 'The message is hidden until the present opens. Select it here and double-click to edit.',
        element: 'el_gr_message',
        done: changed('el_gr_message', 'text'),
      },
      { id: 'from', title: 'Sign it', body: 'On the last slide, change who it’s from.', element: 'el_gr_from', done: changed('el_gr_from', 'text') },
      previewStep,
      exportStep,
    ],
  },
];

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Builds an independent, editable copy of a template: a fresh project id and
 * timestamps, optionally restyled in another theme, and normalised by the same
 * validator that checks imported files.
 */
export function instantiateTemplate(def: TemplateDef, theme?: ThemeId): Project {
  const p = def.build();
  if (theme && theme !== p.settings.theme) applyProjectTheme(p, theme);
  const r = validateProject(JSON.parse(JSON.stringify(p)));
  if (!r.ok) throw new Error(r.errors.join(' '));
  const now = new Date().toISOString();
  r.project.id = uid('prj');
  r.project.meta = { ...r.project.meta, createdAt: now, updatedAt: now };
  return r.project;
}
