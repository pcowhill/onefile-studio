import type { Interaction, Page, Project, SceneElement } from '../model/types';
import { SELF_TARGET } from '../model/types';
import { createElement, createProject } from '../model/factory';
import { linear, solid } from '../model/paint';
import { bulb, puff, rocket, sampleAssets, SAMPLE_IDS, svgAsset } from './art';
import { eventAnnouncement, featureRelease, knowledgeCheck } from './v2';

/**
 * Example projects. They are ordinary projects built with the same factories
 * the editor uses — fully editable, previewable and exportable.
 */
export interface ExampleDef {
  id: string;
  title: string;
  description: string;
  kind: Project['kind'];
  color: string;
  build(): Project;
}

type Props = Record<string, unknown>;
const el = (
  type: string,
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  props: Props = {},
  extra: Partial<SceneElement> = {},
): SceneElement => createElement(type, { id, name, x, y, w, h, props, ...extra });
const text = (id: string, name: string, x: number, y: number, w: number, h: number, t: string, props: Props = {}, extra: Partial<SceneElement> = {}) =>
  el('text', id, name, x, y, w, h, { text: t, ...props }, extra);
const ix = (id: string, trigger: string, actions: Array<[string, Props]>, conditions: Interaction['conditions'] = []): Interaction => ({
  id,
  trigger,
  conditions,
  actions: actions.map(([type, params], i) => ({ id: `${id}_a${i}`, type, params: params as Interaction['actions'][number]['params'] })),
});
const page = (id: string, name: string, background: Page['background'], elements: SceneElement[], height?: number): Page => ({
  id,
  name,
  background,
  elements,
  ...(height ? { height } : {}),
});

// ---------------------------------------------------------------- A
function presentation(): Project {
  const p = createProject('slides', 'Project Lift-Off');
  p.id = 'prj_example_presentation';
  p.settings.transition = 'slide';
  p.settings.backdrop = '#14112a';
  p.assets.as_rocket = svgAsset('as_rocket', 'Rocket', rocket(), 800, 800);
  p.assets.as_bulb = svgAsset('as_bulb', 'Light bulb', bulb(), 800, 800);
  const progress = (n: number) =>
    el('progress', `el_p_progress${n}`, 'Progress', 0, 712, 1280, 8, {
      source: 'slides',
      track: 'rgba(255,255,255,0.18)',
      fill: linear('#ffd23f', '#ff7eb3', 90),
    });
  const next = (n: number, label = 'Next') =>
    el('navButton', `el_p_next${n}`, 'Next button', 1060, 620, 170, 58, { label, color: '#ffd23f', icon: 'arrow-right' });
  const back = (n: number) =>
    el('navButton', `el_p_back${n}`, 'Back button', 50, 620, 150, 58, {
      label: 'Back',
      variant: 'ghost',
      color: '#ffffff',
      icon: 'arrow-left',
      iconSide: 'left',
      target: 'prev',
      shadow: false,
    });

  const s1 = page('pg_p1', 'Title', { paint: linear('#2b1b6b', '#6d4aff', 135) }, [
    el('shape', 'el_p_blob', 'Glow', 640, 60, 600, 600, { shape: 'blob', fill: linear('#ff7eb3', '#b06bff'), shadow: 'none', opacity: 0.35 }),
    el(
      'image',
      'el_p_rocket',
      'Rocket',
      720,
      120,
      460,
      460,
      { assetId: 'as_rocket', radius: 230, shadow: 'lifted', alt: 'A rocket taking off' },
      { entrance: { preset: 'zoomIn', duration: 900, delay: 200 } },
    ),
    text('el_p_kicker', 'Kicker', 90, 200, 400, 40, 'TEAM KICK-OFF · 2026', { size: 20, weight: 800, color: '#ffd23f', letterSpacing: 0.12 }),
    text(
      'el_p_title',
      'Title',
      90,
      250,
      620,
      200,
      'Project\nLift-Off',
      { size: 96, weight: 900, color: '#ffffff', lineHeight: 1.02, letterSpacing: -0.02 },
      { entrance: { preset: 'slideIn', duration: 800, delay: 0, direction: 'left' } },
    ),
    text('el_p_sub', 'Subtitle', 90, 470, 560, 80, 'How we go from idea to launch in three friendly steps.', {
      size: 28,
      weight: 600,
      color: '#e3dbff',
      lineHeight: 1.35,
    }),
    next(1, 'Start'),
    progress(1),
  ]);

  const step = (i: number, x: number, title: string, body: string, color: [string, string]) => [
    el(
      'shape',
      `el_p_card${i}`,
      `Card ${i}`,
      x,
      230,
      320,
      300,
      { fill: linear(color[0], color[1]), radius: 32, shadow: 'lifted' },
      { entrance: { preset: 'slideIn', duration: 700, delay: 150 + i * 250, direction: 'up' } },
    ),
    text(
      `el_p_num${i}`,
      `Step ${i} number`,
      x + 32,
      258,
      100,
      70,
      `0${i}`,
      { size: 56, weight: 900, color: 'rgba(255,255,255,0.85)' },
      { entrance: { preset: 'fadeIn', duration: 600, delay: 300 + i * 250 } },
    ),
    text(
      `el_p_head${i}`,
      `Step ${i} title`,
      x + 32,
      340,
      260,
      50,
      title,
      { size: 34, weight: 800, color: '#ffffff' },
      { entrance: { preset: 'fadeIn', duration: 600, delay: 300 + i * 250 } },
    ),
    text(
      `el_p_body${i}`,
      `Step ${i} text`,
      x + 32,
      395,
      260,
      110,
      body,
      { size: 21, weight: 600, color: 'rgba(255,255,255,0.92)', lineHeight: 1.4 },
      { entrance: { preset: 'fadeIn', duration: 600, delay: 300 + i * 250 } },
    ),
  ];
  const s2 = page('pg_p2', 'Three steps', { paint: solid('#fbfaff') }, [
    text('el_p_s2title', 'Heading', 90, 80, 1100, 80, 'Three steps to launch', { size: 60, weight: 900, color: '#1d1b2c', letterSpacing: -0.02 }),
    ...step(1, 90, 'Dream', 'Collect every wild idea. No idea is too big.', ['#8b6cff', '#5b3df5']),
    ...step(2, 480, 'Design', 'Pick the best one and sketch how it works.', ['#ff9ac1', '#ff4d8d']),
    ...step(3, 870, 'Deliver', 'Build it, test it, and ship it to the world.', ['#ffc36b', '#ff8a3c']),
    el(
      'arrow',
      'el_p_arrow1',
      'Arrow 1',
      405,
      350,
      80,
      60,
      { color: '#6d4aff', width: 7, start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } },
      { entrance: { preset: 'draw', duration: 700, delay: 600 } },
    ),
    el(
      'arrow',
      'el_p_arrow2',
      'Arrow 2',
      795,
      350,
      80,
      60,
      { color: '#ff4d8d', width: 7, start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } },
      { entrance: { preset: 'draw', duration: 700, delay: 850 } },
    ),
    back(2),
    { ...next(2), props: { ...next(2).props, color: '#6d4aff' } },
    { ...progress(2), props: { ...progress(2).props, track: 'rgba(109,74,255,0.14)', fill: linear('#ff7eb3', '#6d4aff', 90) } },
  ]);
  (s2.elements.find((e) => e.id === 'el_p_back2')!.props as Props).color = '#6d4aff';

  const s3 = page('pg_p3', 'The big idea', { paint: linear('#fff3d6', '#ffe1ec', 160) }, [
    text('el_p_s3title', 'Heading', 90, 90, 620, 140, 'What makes it\nspecial?', { size: 60, weight: 900, color: '#1d1b2c', lineHeight: 1.05 }),
    text('el_p_s3hint', 'Hint', 90, 260, 520, 80, 'Click the light bulb to reveal the big idea.', { size: 28, weight: 700, color: '#c2338a', lineHeight: 1.3 }),
    el(
      'arrow',
      'el_p_s3arrow',
      'Pointer arrow',
      470,
      330,
      250,
      160,
      { color: '#c2338a', width: 7, bend: 0.45, start: { x: 0.08, y: 0.15 }, end: { x: 0.92, y: 0.8 } },
      { entrance: { preset: 'draw', duration: 900, delay: 300 } },
    ),
    el(
      'image',
      'el_p_bulb',
      'Light bulb',
      740,
      140,
      380,
      380,
      { assetId: 'as_bulb', radius: 48, shadow: 'lifted', alt: 'A glowing light bulb' },
      {
        interactions: [
          ix('ix_p_bulb', 'click', [
            ['animate', { target: SELF_TARGET, preset: 'wiggle' }],
            ['toggle', { target: 'el_p_idea', effect: 'pop' }],
          ]),
        ],
      },
    ),
    text(
      'el_p_idea',
      'Big idea card',
      90,
      380,
      560,
      200,
      '💡 Everyone can build interactive stories — no code, one file, works offline.',
      { size: 30, weight: 800, color: '#ffffff', background: '#6d4aff', radius: 28, padding: 32, lineHeight: 1.3, valign: 'middle', shadow: 'lifted' },
      { hidden: true },
    ),
    back(3),
    { ...next(3), props: { ...next(3).props, color: '#6d4aff' } },
    { ...progress(3), props: { ...progress(3).props, track: 'rgba(109,74,255,0.14)', fill: linear('#ff7eb3', '#6d4aff', 90) } },
  ]);
  (s3.elements.find((e) => e.id === 'el_p_back3')!.props as Props).color = '#6d4aff';

  const s4 = page('pg_p4', 'Thank you', { paint: linear('#1b1834', '#3a2a7a', 160) }, [
    el(
      'shape',
      'el_p_star1',
      'Star',
      160,
      120,
      70,
      70,
      { shape: 'star', fill: linear('#ffe66d', '#ffb100'), shadow: 'none' },
      { entrance: { preset: 'zoomIn', duration: 700, delay: 300 } },
    ),
    el(
      'shape',
      'el_p_star2',
      'Star',
      1040,
      520,
      90,
      90,
      { shape: 'star', fill: linear('#ff9ac1', '#ff4d8d'), shadow: 'none' },
      { entrance: { preset: 'zoomIn', duration: 700, delay: 500 } },
    ),
    text(
      'el_p_thanks',
      'Thanks',
      140,
      230,
      1000,
      130,
      'Let’s launch together!',
      { size: 88, weight: 900, color: '#ffffff', align: 'center', letterSpacing: -0.02 },
      { entrance: { preset: 'zoomIn', duration: 800, delay: 0 } },
    ),
    text('el_p_contact', 'Contact', 240, 380, 800, 50, 'Questions? Grab a snack and come find us.', {
      size: 30,
      weight: 600,
      color: '#d9d2ff',
      align: 'center',
    }),
    el('navButton', 'el_p_restart', 'Start over', 520, 490, 240, 64, {
      label: 'Start over',
      icon: 'refresh',
      iconSide: 'left',
      target: 'first',
      color: '#ffd23f',
    }),
    progress(4),
  ]);
  p.pages = [s1, s2, s3, s4];
  return p;
}

// ---------------------------------------------------------------- B
function beforeAfter(): Project {
  const p = createProject('page', 'The Valley, Restored');
  p.id = 'prj_example_beforeafter';
  p.settings.backdrop = '#f6f3ee';
  const art = sampleAssets();
  for (const id of Object.values(SAMPLE_IDS)) p.assets[id] = art[id];

  const hero = page(
    'pg_b1',
    'Hero',
    { paint: linear('#0f3d2e', '#2bb673', 150) },
    [
      text('el_b_kicker', 'Kicker', 100, 140, 800, 34, 'A RESTORATION STORY', {
        size: 18,
        weight: 800,
        color: '#b6f5d8',
        letterSpacing: 0.18,
        align: 'center',
      }),
      text(
        'el_b_title',
        'Title',
        60,
        185,
        880,
        160,
        'The valley,\nrestored',
        { size: 84, weight: 900, color: '#ffffff', align: 'center', lineHeight: 1.0, letterSpacing: -0.02 },
        { entrance: { preset: 'fadeIn', duration: 900, delay: 0 } },
      ),
      text(
        'el_b_lede',
        'Intro',
        170,
        370,
        660,
        70,
        'Three years, two thousand volunteers and one very patient river. Drag the slider below to see what changed.',
        { size: 21, weight: 600, color: '#e3fff2', align: 'center', lineHeight: 1.45 },
      ),
      el('navButton', 'el_b_go', 'See the change', 390, 470, 220, 60, { label: 'See the change', icon: 'chevron-down', color: '#ffd23f', target: 'next' }),
    ],
    600,
  );

  const compare = page(
    'pg_b2',
    'Compare',
    { paint: solid('#f6f3ee') },
    [
      text('el_b_cmp_title', 'Heading', 80, 70, 840, 60, 'Before & after', { size: 46, weight: 900, color: '#173b2e', align: 'center' }),
      text('el_b_cmp_sub', 'Instructions', 180, 135, 640, 36, 'Drag the handle left and right to compare winter 2023 with spring 2026.', {
        size: 19,
        weight: 600,
        color: '#5b6b63',
        align: 'center',
      }),
      el(
        'beforeAfter',
        'el_b_compare',
        'Valley comparison',
        80,
        200,
        840,
        560,
        { before: SAMPLE_IDS.before, after: SAMPLE_IDS.after, beforeLabel: 'Winter 2023', afterLabel: 'Spring 2026', radius: 28, position: 45 },
        { entrance: { preset: 'slideIn', duration: 900, delay: 0, direction: 'up' } },
      ),
    ],
    840,
  );

  const story = page(
    'pg_b3',
    'Story',
    { paint: solid('#ffffff') },
    [
      el('shape', 'el_b_story_bar', 'Accent bar', 80, 100, 64, 10, { fill: linear('#2bb673', '#0abde3', 90), radius: 5, shadow: 'none' }),
      text('el_b_story_title', 'Heading', 80, 130, 380, 130, 'What we did, season by season', { size: 40, weight: 900, color: '#173b2e', lineHeight: 1.12 }),
      text(
        'el_b_story_body',
        'Summary',
        80,
        280,
        380,
        200,
        'We cleared invasive scrub, re-shaped the riverbanks and planted more than 40,000 native seedlings. The full field journal is on the right — scroll inside the panel to read it.',
        { size: 19, weight: 500, color: '#4d5c55', lineHeight: 1.6 },
      ),
      el('scrollText', 'el_b_journal', 'Field journal', 520, 90, 400, 440, {
        title: 'Field journal',
        accent: '#1f9d5f',
        background: '#f3fbf6',
        size: 17,
        text: '# Winter 2023\nThe valley floor was bare and the river had cut deep, muddy channels. We started with a survey: **37 species** recorded, most of them hardy grasses.\n\n# Spring 2024\nVolunteers removed eleven tonnes of invasive scrub. We built 140 small stone weirs to slow the water down.\n\n- Weekend crews: 52\n- Litres of tea: unknown, but many\n- Rubber boots lost to the mud: 9\n\n# Autumn 2024\nThe first big planting. Alder, willow and wild cherry along the banks; wildflower seed across the meadow.\n\n# Summer 2025\nThe river began to braid again. Kingfishers returned for the first time in a decade.\n\n# Spring 2026\nA second survey counted **212 species**. The meadow is now one of the brightest places in the region — and it looks after itself.\n\nThank you to everyone who carried a spade, a seed tray or a flask of soup.',
      }),
    ],
    620,
  );

  const gallery = page(
    'pg_b4',
    'Next places',
    { paint: linear('#173b2e', '#0f2a20', 180) },
    [
      text('el_b_gal_title', 'Heading', 80, 80, 840, 60, 'Where we’re heading next', { size: 44, weight: 900, color: '#ffffff', align: 'center' }),
      text('el_b_gal_sub', 'Instructions', 180, 145, 640, 34, 'Click the picture to flip through our next three projects.', {
        size: 19,
        weight: 600,
        color: '#b6f5d8',
        align: 'center',
      }),
      el('gallery', 'el_b_gallery', 'Next projects', 200, 210, 600, 400, {
        images: [SAMPLE_IDS.ocean, SAMPLE_IDS.desert, SAMPLE_IDS.aurora],
        transition: 'slide',
        controls: 'both',
      }),
    ],
    700,
  );

  const footer = page(
    'pg_b5',
    'Footer',
    { paint: solid('#0b1f17') },
    [
      text('el_b_foot', 'Footer text', 100, 70, 800, 40, 'Made with OneFile Studio — one file, works offline.', {
        size: 18,
        weight: 600,
        color: '#8fb7a5',
        align: 'center',
      }),
      el('navButton', 'el_b_top', 'Back to top', 410, 130, 180, 54, {
        label: 'Back to top',
        icon: 'arrow-left',
        iconSide: 'left',
        variant: 'outline',
        color: '#b6f5d8',
        target: 'first',
        shadow: false,
      }),
    ],
    240,
  );
  (footer.elements[1].props as Props).icon = 'none';
  p.pages = [hero, compare, story, gallery, footer];
  return p;
}

// ---------------------------------------------------------------- C
function clicker(): Project {
  const p = createProject('slides', 'Feed Puff!');
  p.id = 'prj_example_clicker';
  p.settings.showNavigation = false;
  p.settings.backdrop = '#0d0a1f';
  p.assets.as_puff = svgAsset('as_puff', 'Puff', puff(), 600, 600);
  p.variables = [{ id: 'var_score', name: 'Score', type: 'number', initial: 0 }];
  const stars = [
    [36, 40, 30],
    [1150, 70, 26],
    [620, 40, 20],
    [1180, 610, 40],
    [60, 600, 24],
  ].map(([x, y, s], i) =>
    el('shape', `el_c_star${i}`, `Star ${i + 1}`, x, y, s, s, { shape: 'star', fill: solid(i % 2 ? '#ffd23f' : '#ffffff'), shadow: 'none', opacity: 0.8 }),
  );
  const slide = page('pg_c1', 'Game', { paint: linear('#1d1145', '#3b1a6e', 160) }, [
    ...stars,
    text('el_c_title', 'Title', 80, 70, 560, 90, 'Feed Puff!', { size: 76, weight: 900, color: '#ffffff', letterSpacing: -0.02 }),
    text('el_c_rules', 'How to play', 80, 165, 520, 110, 'Click Puff for a snack: +1\nRight-click for a mega snack: +5\nFill the meter to 50 to win!', {
      size: 24,
      weight: 700,
      color: '#d7c8ff',
      lineHeight: 1.5,
    }),
    text('el_c_score', 'Score display', 80, 310, 420, 96, 'Score: {Score}', {
      size: 52,
      weight: 900,
      color: '#1d1145',
      background: '#ffd23f',
      radius: 28,
      padding: 12,
      align: 'center',
      valign: 'middle',
      shadow: 'lifted',
    }),
    el('progress', 'el_c_meter', 'Snack meter', 80, 440, 420, 30, {
      source: 'variable',
      variableId: 'var_score',
      max: 50,
      label: 'fraction',
      labelColor: '#ffffff',
      fill: linear('#ff7eb3', '#ffd23f', 90),
      track: 'rgba(255,255,255,0.16)',
    }),
    el(
      'image',
      'el_c_puff',
      'Puff',
      700,
      150,
      440,
      440,
      { assetId: 'as_puff', radius: 0, shadow: 'none', alt: 'Puff, a round pink space critter' },
      {
        entrance: { preset: 'zoomIn', duration: 800, delay: 100 },
        interactions: [
          ix('ix_c_click', 'click', [
            ['varAdd', { variable: 'var_score', amount: 1 }],
            ['animate', { target: SELF_TARGET, preset: 'pop' }],
          ]),
          ix('ix_c_right', 'rightclick', [
            ['varAdd', { variable: 'var_score', amount: 5 }],
            ['animate', { target: SELF_TARGET, preset: 'spin' }],
          ]),
          ix(
            'ix_c_win',
            'click',
            [['show', { target: 'el_c_win', effect: 'pop' }]],
            [{ id: 'cd_c_win', type: 'variable', variableId: 'var_score', op: 'gte', value: 50 }],
          ),
          ix(
            'ix_c_win2',
            'rightclick',
            [['show', { target: 'el_c_win', effect: 'pop' }]],
            [{ id: 'cd_c_win2', type: 'variable', variableId: 'var_score', op: 'gte', value: 50 }],
          ),
        ],
      },
    ),
    el(
      'arrow',
      'el_c_arrow',
      'Hint arrow',
      560,
      470,
      170,
      120,
      { color: '#ffd23f', width: 6, bend: -0.4, start: { x: 0.1, y: 0.85 }, end: { x: 0.9, y: 0.2 }, dashed: true },
      { entrance: { preset: 'draw', duration: 900, delay: 600 } },
    ),
    text('el_c_tip', 'Click me', 520, 590, 200, 40, 'click me!', { size: 26, weight: 800, color: '#ffd23f', font: 'hand', align: 'center' }),
    el(
      'button',
      'el_c_reset',
      'Reset button',
      80,
      500,
      180,
      56,
      { label: 'Reset', icon: 'refresh', iconSide: 'left', variant: 'soft', color: '#ffffff', shadow: false },
      {
        interactions: [
          ix('ix_c_reset', 'click', [
            ['varReset', { variable: 'var_score' }],
            ['hide', { target: 'el_c_win', effect: 'fade' }],
          ]),
        ],
      },
    ),
    text(
      'el_c_win',
      'Winner banner',
      80,
      590,
      420,
      90,
      'You did it! Puff is full 🎉',
      { size: 30, weight: 900, color: '#1d1145', background: '#7ef0c1', radius: 36, align: 'center', valign: 'middle', shadow: 'lifted' },
      { hidden: true, interactions: [ix('ix_c_win_close', 'click', [['hide', { target: SELF_TARGET, effect: 'fade' }]])] },
    ),
  ]);
  p.pages = [slide];
  return p;
}

export const EXAMPLES: ExampleDef[] = [
  {
    id: 'release',
    title: 'Feature release walkthrough',
    description: 'A professional update deck with an embedded video, a chart and a sortable table.',
    kind: 'slides',
    color: '#2563eb',
    build: featureRelease,
  },
  {
    id: 'event',
    title: 'Event announcement',
    description: 'An editorial invitation page with a live countdown, an animated GIF and a programme.',
    kind: 'page',
    color: '#b5532c',
    build: eventAnnouncement,
  },
  {
    id: 'knowledge',
    title: 'Interactive knowledge check',
    description: 'Explain, then quiz: three questions, a live score and a satisfying finish.',
    kind: 'slides',
    color: '#0891b2',
    build: knowledgeCheck,
  },
  {
    id: 'presentation',
    title: 'Interactive presentation',
    description: 'Slides with animations, arrows, navigation and a click-to-reveal idea.',
    kind: 'slides',
    color: '#6d4aff',
    build: presentation,
  },
  {
    id: 'before-after',
    title: 'Before & After story',
    description: 'A scrolling page with an image comparison, scrolling journal and gallery.',
    kind: 'page',
    color: '#1f9d5f',
    build: beforeAfter,
  },
  {
    id: 'clicker',
    title: 'Mini clicker game',
    description: 'Click Puff to score, right-click for a mega snack, fill the meter to win.',
    kind: 'slides',
    color: '#ff4d8d',
    build: clicker,
  },
];
