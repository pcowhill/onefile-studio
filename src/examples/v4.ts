import type { Asset, Interaction, Project, SceneElement } from '../model/types';
import { createProject } from '../model/factory';
import { fnv } from './art';
import { fadeUp, ix, kit } from './v2';
import roverUrl from './media/rover.glb?inline';

/**
 * v0.4 example projects: keyboard shortcuts, slide-level triggers, links,
 * physics dragging and the 3D model viewer — built with the editor's own
 * factories and theme roles, so everything is editable in the editor.
 * The rover model is original (scripts/make-example-model.mjs).
 */

const GLB_HEAD = 'data:model/gltf-binary;base64,';

export function roverModel(): Asset {
  const data = GLB_HEAD + roverUrl.slice(roverUrl.indexOf(',') + 1);
  const bytes = Math.floor(((data.length - GLB_HEAD.length) * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  return { id: 'as_rover', name: 'pathfinder-rover.glb', mime: 'model/gltf-binary', data, width: 0, height: 0, bytes, hash: fnv(data) };
}

const key = (id: string, k: string, actions: Array<[string, Record<string, unknown>]>, conditions: Interaction['conditions'] = []): Interaction => ({
  ...ix(id, 'key', actions, conditions),
  options: { key: k },
});
const step = (id: string, value: number, op: 'eq' | 'gte' = 'eq') => [{ id, type: 'variable' as const, variableId: 'var_step', op, value }];

// ---------------------------------------------------------------- A: Interactive technical explainer
export function technicalExplainer(): Project {
  const p = createProject('slides', 'How an order travels through Relay', 'technical');
  p.id = 'prj_example_explainer';
  p.settings.transition = 'fade';
  p.variables = [{ id: 'var_step', name: 'Step', type: 'number', initial: 0 }];
  const { el, text, page } = kit('technical');
  const progress = (n: number) => el('progress', `el_x_progress${n}`, 'Progress', [0, 714, 1280, 6], undefined, { source: 'slides' });
  const chip = (id: string, x: number, y: number, w: number, label: string) =>
    text(id, `Hint: ${label}`, [x, y, w, 34], 'label', label, { size: 14, align: 'center', valign: 'middle' });

  // Slide 1 — title, keyboard hint, docs link.
  const s1 = page('pg_x1', 'Title', 'hero', [
    text('el_x_kicker', 'Kicker', [90, 150, 330, 36], 'label', 'ARCHITECTURE WALKTHROUGH', { size: 14, align: 'center', valign: 'middle' }),
    text('el_x_title', 'Title', [90, 205, 700, 170], 'display', 'How an order travels through Relay', { size: 62, lineHeight: 1.08 }, fadeUp(0)),
    text(
      'el_x_sub',
      'Intro',
      [90, 390, 600, 90],
      'displaySub',
      'Five stops, one diagram. Step through it with the keyboard while you talk — or click any box to learn more.',
      { size: 22, lineHeight: 1.45 },
      fadeUp(150),
    ),
    el('navButton', 'el_x_start', 'Start', [90, 520, 210, 60], 'hero', { label: 'Start', icon: 'arrow-right', size: 20 }),
    el(
      'button',
      'el_x_docs',
      'Docs link',
      [320, 520, 250, 60],
      'heroGhost',
      { label: 'API reference', icon: 'arrow-right', size: 18 },
      {
        interactions: [
          ix('ix_x_docs', 'click', [['openLink', { url: 'https://example.com/relay/docs', newTab: true, label: 'Open the Relay API reference in a new tab' }]]),
        ],
      },
    ),
    chip('el_x_k1', 860, 300, 260, '→ or Space: next step'),
    chip('el_x_k2', 860, 346, 260, 'R: replay the diagram'),
    chip('el_x_k3', 860, 392, 260, '1 2 3: design notes'),
    el(
      'shape',
      'el_x_hex',
      'Hexagon',
      [930, 140, 120, 130],
      'tone0',
      { shape: 'hexagon', opacity: 0.9 },
      { entrance: { preset: 'zoomIn', duration: 800, delay: 300 } },
    ),
    progress(1),
  ]);

  // Slide 2 — the step-by-step diagram.
  const stops = [
    ['Checkout', 'The shop sends the order as one HTTPS request.'],
    ['Gateway', 'Checks the API key, rate-limits, and stamps a request id.'],
    ['Queue', 'Absorbs bursts: the order waits safely even if workers are busy.'],
    ['Worker', 'Charges the card, reserves stock, and retries on hiccups.'],
    ['Ledger', 'Writes the final record. Exactly once, thanks to the request id.'],
  ];
  const nodeX = (i: number) => 60 + i * 238;
  const nodes = stops.flatMap(([name], i) => [
    el(
      'shape',
      `el_x_node${i}`,
      `${name} box`,
      [nodeX(i), 250, 200, 110],
      i === 0 ? 'accent' : 'card',
      { shape: 'rect' },
      {
        interactions: [
          ix(`ix_x_node${i}`, 'click', [
            ['animate', { target: '@self', preset: 'pulse' }],
            ['toggle', { target: `el_x_call${i}`, effect: 'pop' }],
          ]),
        ],
      },
    ),
    // The label covers the middle of the box, so it answers clicks too.
    text(
      `el_x_nodet${i}`,
      `${name} label`,
      [nodeX(i) + 10, 286, 180, 40],
      'heading',
      name,
      { size: 26, align: 'center', valign: 'middle' },
      {
        interactions: [
          ix(`ix_x_nodet${i}`, 'click', [
            ['animate', { target: `el_x_node${i}`, preset: 'pulse' }],
            ['toggle', { target: `el_x_call${i}`, effect: 'pop' }],
          ]),
        ],
      },
    ),
  ]);
  const arrows = [0, 1, 2, 3].map((i) =>
    el(
      'arrow',
      `el_x_arrow${i}`,
      `Arrow ${i + 1}`,
      [nodeX(i) + 200, 285, 38, 40],
      undefined,
      { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, bend: 0 },
      { hidden: true },
    ),
  );
  const callouts = stops.map(([, body], i) =>
    text(
      `el_x_call${i}`,
      `Callout ${i + 1}`,
      [Math.min(nodeX(i) - 10, 1280 - 300), 392, 260, 110],
      'body',
      body,
      {
        size: 17,
        lineHeight: 1.4,
        padding: 14,
        radius: 14,
      },
      { hidden: i > 0 },
    ),
  );
  const hideAll = [...arrows.map((a) => a.id), ...callouts.slice(1).map((c) => c.id)].map((t): [string, Record<string, unknown>] => [
    'hide',
    { target: t, effect: 'none' },
  ]);
  const reveal = (i: number): Interaction =>
    key(
      `ix_x_step${i}`,
      'ArrowRight',
      [
        // Count first, so a quick second key press already sees the new step.
        ['varSet', { variable: 'var_step', value: i + 1 }],
        ['hide', { target: `el_x_call${i}`, effect: 'none' }],
        ['show', { target: `el_x_arrow${i}`, effect: 'fade' }],
        ['show', { target: `el_x_call${i + 1}`, effect: 'pop' }],
        ['animate', { target: `el_x_node${i + 1}`, preset: 'bounce' }],
      ],
      step(`cd_x_step${i}`, i),
    );
  const packet = text(
    'el_x_packet',
    'Order token',
    [70, 560, 190, 56],
    'label',
    'Order #1042',
    { size: 18, align: 'center', valign: 'middle', radius: 28 },
    { drag: { mode: 'floaty' } },
  );
  const s2 = page('pg_x2', 'The pipeline', 'base', [
    text('el_x_h2', 'Heading', [60, 70, 820, 60], 'heading', 'The order pipeline', { size: 44 }),
    text('el_x_h2sub', 'Subheading', [60, 132, 900, 40], 'body', 'Press → or Space to follow the order. Click a box for its note. R starts over.', {
      size: 19,
    }),
    ...nodes,
    ...arrows,
    ...callouts,
    packet,
    text('el_x_packhint', 'Drag hint', [276, 568, 360, 40], 'caption', '← drag the order along the pipeline', { size: 16, valign: 'middle' }),
    el('navButton', 'el_x_next2', 'Next button', [1070, 626, 160, 54], 'primary', { label: 'Next', icon: 'arrow-right', size: 18 }),
    progress(2),
  ]);
  s2.interactions = [
    // "When the slide opens": start the story from the first stop every time.
    ix('ix_x_open', 'pageStart', [['varSet', { variable: 'var_step', value: 0 }], ...hideAll, ['show', { target: 'el_x_call0', effect: 'none' }]]),
    // Listed from the last step to the first so one key press advances exactly one step.
    key('ix_x_done', 'ArrowRight', [['navigate', { page: 'next' }]], step('cd_x_done', 4, 'gte')),
    reveal(3),
    reveal(2),
    reveal(1),
    reveal(0),
    { ...key('ix_x_space', 'Space', [['navigate', { page: 'next' }]], step('cd_x_sp', 4, 'gte')) },
    ...[3, 2, 1, 0].map((i) => ({ ...reveal(i), id: `ix_x_sp${i}`, options: { key: 'Space' } })),
    key('ix_x_reset', 'r', [['varSet', { variable: 'var_step', value: 0 }], ...hideAll, ['show', { target: 'el_x_call0', effect: 'pop' }]]),
  ];

  // Slide 3 — number keys pick a detail, a timed tip, links.
  const details = [
    ['Idempotency', 'Every request carries an id. If the shop retries, Relay recognises it and never charges twice.'],
    ['Back-pressure', 'When workers fall behind, the queue grows instead of failing. Dashboards alert at 2 minutes of lag.'],
    ['Observability', 'Each hop logs the request id, so one search shows the whole journey of an order.'],
  ];
  const cardX = (i: number) => 60 + i * 400;
  const cards: SceneElement[] = details.flatMap(([title, body], i) => [
    el('shape', `el_x_card${i}`, `${title} card`, [cardX(i), 210, 360, 300], 'card', { shape: 'rect' }),
    text(`el_x_cardn${i}`, `${title} number`, [cardX(i) + 24, 230, 60, 60], 'score', String(i + 1), { size: 30, align: 'center', valign: 'middle' }),
    text(`el_x_cardt${i}`, `${title} title`, [cardX(i) + 24, 304, 312, 44], 'heading', title, { size: 28 }),
    text(`el_x_cardb${i}`, `${title} text`, [cardX(i) + 24, 352, 312, 140], 'body', body, { size: 17, lineHeight: 1.45 }, { hidden: true }),
  ]);
  const s3 = page('pg_x3', 'Design notes', 'base', [
    text('el_x_h3', 'Heading', [60, 70, 900, 60], 'heading', 'Three design notes', { size: 44 }),
    text(
      'el_x_h3sub',
      'Subheading',
      [60, 132, 960, 40],
      'body',
      'Press 1, 2 or 3 to open a note — or click a card. Then sort the sticky notes by dragging them.',
      { size: 19 },
    ),
    ...cards,
    text(
      'el_x_tip',
      'Tip bubble',
      [60, 540, 400, 52],
      'label',
      'Tip: number keys open each note',
      { size: 16, align: 'center', valign: 'middle' },
      { hidden: true },
    ),
    ...[
      ['el_x_sticky1', 'Sticky: ready', 500, -5, 'Ready to ship'],
      ['el_x_sticky2', 'Sticky: review', 690, 4, 'Needs review'],
    ].map(([id, name, x, rot, label]) =>
      text(
        String(id),
        String(name),
        [Number(x), 528, 170, 66],
        'score',
        String(label),
        { size: 18, align: 'center', valign: 'middle', radius: 10 },
        {
          rotation: Number(rot),
          drag: { mode: 'weighted', amount: 0.55 },
        },
      ),
    ),
    el(
      'button',
      'el_x_mail',
      'Email link',
      [760, 620, 230, 54],
      'secondary',
      { label: 'Email the team', size: 17 },
      { interactions: [ix('ix_x_mail', 'click', [['openLink', { url: 'mailto:platform-team@example.com', newTab: false }]])] },
    ),
    el(
      'button',
      'el_x_runbook',
      'Runbook link',
      [1006, 620, 214, 54],
      'primary',
      { label: 'Runbook', icon: 'arrow-right', size: 17 },
      { interactions: [ix('ix_x_runbook', 'click', [['openLink', { url: 'https://example.com/relay/runbook', newTab: true }]])] },
    ),
    progress(3),
  ]);
  for (let i = 0; i < 3; i++) {
    const card = s3.elements.find((e) => e.id === `el_x_card${i}`)!;
    card.interactions = [ix(`ix_x_cardc${i}`, 'click', [['toggle', { target: `el_x_cardb${i}`, effect: 'fade' }]])];
  }
  s3.interactions = [
    ix('ix_x_tip', 'pageTimer', [
      ['show', { target: 'el_x_tip', effect: 'pop' }],
      ['animate', { target: 'el_x_tip', preset: 'wiggle' }],
    ]),
    ...[0, 1, 2].map((i) =>
      key(`ix_x_num${i}`, String(i + 1), [
        ['toggle', { target: `el_x_cardb${i}`, effect: 'fade' }],
        ['animate', { target: `el_x_card${i}`, preset: 'pulse' }],
      ]),
    ),
  ];
  s3.interactions[0].options = { seconds: 2.5 };
  p.pages = [s1, s2, s3];
  // Project-wide shortcut: "H" returns to the title from anywhere.
  p.interactions = [key('ix_x_home', 'h', [['navigate', { page: 'first' }]])];
  return p;
}

// ---------------------------------------------------------------- B: Interactive 3D explorer
export function modelExplorer(): Project {
  const p = createProject('slides', 'Pathfinder R-2 — interactive explorer', 'professional');
  p.id = 'prj_example_explorer';
  p.settings.transition = 'fade';
  const rover = roverModel();
  p.assets[rover.id] = rover;
  const { el, text, page } = kit('professional');

  const parts: Array<{ id: string; label: string; view: string; title: string; body: string }> = [
    {
      id: 'solar',
      label: 'Solar deck',
      view: 'top',
      title: 'Solar deck',
      body: '48 cells fold flat for launch and deliver 210 W at noon — enough to drive and phone home.',
    },
    { id: 'mast', label: 'Mast camera', view: 'front', title: 'Mast camera', body: 'Stereo eyes 2 m up give the team 3D panoramas to plan each day’s drive.' },
    {
      id: 'arm',
      label: 'Robotic arm',
      view: 'right',
      title: 'Robotic arm',
      body: 'A drill and a two-finger gripper collect samples; brass conduits carry power and data.',
    },
    {
      id: 'wheels',
      label: 'Wheels',
      view: 'left',
      title: 'Rocker-bogie wheels',
      body: 'Six wheels on rocking arms keep every tyre on the ground over rocks twice their height.',
    },
    {
      id: 'dish',
      label: 'Antenna dish',
      view: 'back',
      title: 'High-gain dish',
      body: 'Talks straight to Earth at up to 2 Mbit/s when the planet is above the horizon.',
    },
  ];
  const viewer = el('model', 'el_m_viewer', 'Rover viewer', [520, 70, 700, 560], undefined, {
    assetId: rover.id,
    alt: 'A six-wheeled planetary rover with a solar deck, a mast camera, a dish antenna and a robotic arm',
    autoRotate: true,
    rotateSpeed: 0.6,
    yaw: 35,
    pitch: 16,
  });
  const infoIds = parts.map((x) => `el_m_info_${x.id}`);
  const hideInfo = (except?: string) =>
    infoIds.filter((i) => i !== except).map((t): [string, Record<string, unknown>] => ['hide', { target: t, effect: 'none' }]);
  const buttons = parts.map((x, i) =>
    el(
      'button',
      `el_m_btn_${x.id}`,
      `${x.label} button`,
      [60 + (i % 2) * 210, 330 + Math.floor(i / 2) * 64, 196, 50],
      'secondary',
      { label: x.label, size: 16 },
      {
        interactions: [
          ix(`ix_m_${x.id}`, 'click', [
            ['modelSpin', { target: 'el_m_viewer', mode: 'stop' }],
            ['modelView', { target: 'el_m_viewer', view: x.view }],
            ...hideInfo(`el_m_info_${x.id}`),
            ['show', { target: `el_m_info_${x.id}`, effect: 'pop' }],
          ]),
        ],
      },
    ),
  );
  const infos = parts.map((x) =>
    text(
      `el_m_info_${x.id}`,
      `${x.title} note`,
      [60, 528, 420, 120],
      'body',
      `${x.title} — ${x.body}`,
      { size: 17, lineHeight: 1.45, padding: 16, radius: 16 },
      { hidden: true },
    ),
  );
  const s1 = page('pg_m1', 'Explore', 'base', [
    el('shape', 'el_m_glow', 'Backdrop glow', [480, 40, 780, 640], 'soft', { shape: 'blob', opacity: 0.55 }),
    text('el_m_kicker', 'Kicker', [60, 70, 300, 34], 'label', 'INTERACTIVE 3D', { size: 14, align: 'center', valign: 'middle' }),
    text('el_m_title', 'Title', [60, 118, 440, 120], 'heading', 'Meet Pathfinder R-2', { size: 52, lineHeight: 1.05 }, fadeUp(0)),
    text(
      'el_m_sub',
      'Intro',
      [60, 236, 430, 80],
      'body',
      'Drag the rover to turn it, scroll to zoom, right-drag to move. Pick a part to fly the camera there.',
      { size: 18, lineHeight: 1.45 },
      fadeUp(120),
    ),
    ...buttons,
    ...infos,
    el(
      'button',
      'el_m_reset',
      'Reset button',
      [60 + 210, 330 + 2 * 64, 196, 50],
      'primary',
      { label: 'Reset view', size: 16 },
      {
        interactions: [
          ix('ix_m_reset', 'click', [
            ['modelView', { target: 'el_m_viewer', view: 'reset' }],
            ['modelSpin', { target: 'el_m_viewer', mode: 'start' }],
            ...hideInfo(),
          ]),
        ],
      },
    ),
    viewer,
    text('el_m_keys', 'Keyboard hint', [720, 650, 500, 30], 'caption', 'Keys: S spin on/off · R reset · → next slide', { size: 14, align: 'right' }),
  ]);
  s1.interactions = [
    { ...ix('ix_m_key_s', 'key', [['modelSpin', { target: 'el_m_viewer', mode: 'toggle' }]]), options: { key: 's' } },
    { ...ix('ix_m_key_r', 'key', [['modelView', { target: 'el_m_viewer', view: 'reset' }], ...hideInfo()]), options: { key: 'r' } },
  ];

  const specs = el('table', 'el_m_specs', 'Spec sheet', [60, 200, 560, 330], undefined, {
    rows: [
      ['Spec', 'Value'],
      ['Mass', '185 kg'],
      ['Length × width', '2.3 × 1.8 m'],
      ['Top speed', '4 cm/s'],
      ['Power', '210 W solar'],
      ['Data link', '2 Mbit/s direct to Earth'],
    ],
    headerRow: true,
    columnAlign: ['auto', 'auto'],
    preset: 'lined',
  });
  const s2 = page('pg_m2', 'Spec sheet', 'alt', [
    text('el_m_h2', 'Heading', [60, 80, 600, 60], 'heading', 'Spec sheet', { size: 44 }),
    text('el_m_h2sub', 'Subheading', [60, 140, 560, 44], 'body', 'All numbers are for this fictional rover.', { size: 18 }),
    specs,
    el(
      'model',
      'el_m_viewer2',
      'Rover (dramatic)',
      [680, 90, 540, 500],
      undefined,
      {
        assetId: rover.id,
        alt: 'The rover under dramatic lighting',
        lighting: 'dramatic',
        backdrop: 'solid',
        autoRotate: true,
        rotateSpeed: 1,
        controls: false,
        yaw: -40,
        pitch: 10,
        zoom: 1.1,
      },
      {},
      { background: '#14182b' },
    ),
    el(
      'button',
      'el_m_more',
      'Learn more link',
      [60, 570, 260, 56],
      'primary',
      { label: 'Mission website', icon: 'arrow-right', size: 17 },
      { interactions: [ix('ix_m_more', 'click', [['openLink', { url: 'https://example.com/pathfinder-r2', newTab: true }]])] },
    ),
  ]);
  p.pages = [s1, s2];
  return p;
}
