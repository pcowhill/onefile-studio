import type { Interaction, Page, Project, SceneElement, ThemeId } from '../model/types';
import { createElement, createProject } from '../model/factory';
import { customize, getTheme, themeNewBackground, themeNewElement } from '../model/theme';
import { confettiGif, dashboardArt, iconArt, rooftopArt, walkthroughVideo } from './art2';

/**
 * v0.2 example projects. Like the originals they are ordinary projects built
 * with the editor's own factories and theme roles — every element follows the
 * project theme, so they are fully editable (and re-themable) in the editor.
 */

type Props = Record<string, unknown>;

export function kit(theme: ThemeId) {
  const t = getTheme(theme);
  /** Creates an element in theme role `role`; `custom` props become explicit (non-theme) choices. */
  const el = (
    type: string,
    id: string,
    name: string,
    box: [number, number, number, number],
    role?: string,
    props: Props = {},
    extra: Partial<SceneElement> = {},
    custom?: Props,
  ) => {
    const [x, y, w, h] = box;
    const e = themeNewElement(createElement(type, { id, name, x, y, w, h, props, ...extra }), t, role);
    if (custom) customize(e, custom);
    return e;
  };
  const text = (
    id: string,
    name: string,
    box: [number, number, number, number],
    role: string,
    value: string,
    props: Props = {},
    extra: Partial<SceneElement> = {},
    custom?: Props,
  ) => el('text', id, name, box, role, { text: value, ...props }, extra, custom);
  const page = (id: string, name: string, bgRole: string, elements: SceneElement[], height?: number): Page => ({
    id,
    name,
    background: themeNewBackground(t, bgRole),
    elements,
    ...(height ? { height } : {}),
  });
  return { t, el, text, page };
}

export const ix = (id: string, trigger: string, actions: Array<[string, Props]>, conditions: Interaction['conditions'] = []): Interaction => ({
  id,
  trigger,
  conditions,
  actions: actions.map(([type, params], i) => ({ id: `${id}_a${i}`, type, params: params as Interaction['actions'][number]['params'] })),
});

export const fadeUp = (delay = 0) => ({ entrance: { preset: 'slideIn', duration: 700, delay, direction: 'up' as const } });

// ---------------------------------------------------------------- A: Feature Release Walkthrough
export function featureRelease(): Project {
  const p = createProject('slides', 'Tasklane 3.2 — Feature walkthrough', 'professional');
  p.id = 'prj_example_release';
  const { el, text, page, t } = kit('professional');
  const video = walkthroughVideo();
  const dash = dashboardArt();
  p.assets[video.id] = video;
  p.assets[dash.id] = dash;

  const progress = (n: number, onHero = false) =>
    el('progress', `el_r_progress${n}`, 'Progress', [0, 714, 1280, 6], onHero ? 'onHero' : undefined, { source: 'slides' });
  const next = (n: number, label = 'Next') =>
    el('navButton', `el_r_next${n}`, 'Next button', [1070, 620, 150, 54], 'primary', { label, icon: 'arrow-right', size: 18 });
  const back = (n: number) =>
    el('navButton', `el_r_back${n}`, 'Back button', [890, 620, 160, 54], 'secondary', {
      label: 'Back',
      icon: 'arrow-left',
      iconSide: 'left',
      target: 'prev',
      size: 18,
    });
  const title = (n: number, kicker: string, value: string) => [
    text(`el_r_kicker${n}`, 'Kicker', [80, 64, 600, 30], 'kicker', kicker, { size: 15 }),
    text(`el_r_title${n}`, 'Title', [80, 96, 760, 70], 'heading', value, { size: 44 }),
  ];

  const s1 = page('pg_r1', 'Title', 'hero', [
    text('el_r_tag', 'Release tag', [80, 170, 290, 40], 'label', 'RELEASE 3.2 · NOVEMBER 2026', { size: 14, align: 'center', valign: 'middle' }),
    text('el_r_name', 'Product name', [80, 230, 620, 110], 'display', 'Tasklane 3.2', { size: 84, lineHeight: 1.05 }, fadeUp(0)),
    text(
      'el_r_sub',
      'Summary',
      [80, 352, 560, 100],
      'displaySub',
      'Faster boards, one-file offline export and a brand-new Insights view.',
      { size: 26, lineHeight: 1.4 },
      fadeUp(150),
    ),
    el('navButton', 'el_r_start', 'Start button', [80, 490, 250, 60], 'hero', { label: "See what's new", icon: 'arrow-right', size: 19 }),
    el(
      'image',
      'el_r_dash',
      'Dashboard',
      [690, 160, 520, 338],
      undefined,
      { assetId: dash.id, alt: 'The new Tasklane dashboard' },
      { entrance: { preset: 'zoomIn', duration: 800, delay: 250 } },
    ),
    text('el_r_meta', 'Meta', [80, 600, 560, 30], 'displaySub', 'Product update for the delivery team · 5 slides', { size: 16 }),
    progress(1, true),
  ]);

  const s2 = page('pg_r2', 'See it in action', 'base', [
    ...title(2, 'WATCH THE TOUR', 'See it in action'),
    text(
      'el_r_vtext',
      'Intro',
      [80, 190, 420, 110],
      'body',
      'A seven-second tour of the new board: create a task, drag it to Done and get instant confirmation.',
      { size: 21, lineHeight: 1.5 },
    ),
    text(
      'el_r_bullets',
      'Highlights',
      [80, 316, 420, 150],
      'body',
      '•  New task in one click\n•  Drag cards between columns\n•  A toast confirms every change',
      {
        size: 21,
        lineHeight: 1.7,
      },
    ),
    el(
      'button',
      'el_r_replay',
      'Replay button',
      [80, 488, 190, 54],
      'primary',
      { label: 'Replay tour', icon: 'refresh', iconSide: 'left', size: 17 },
      {
        interactions: [ix('ix_r_replay', 'click', [['mediaRestart', { target: 'el_r_video' }]])],
      },
    ),
    el(
      'button',
      'el_r_pause',
      'Pause button',
      [286, 488, 150, 54],
      'secondary',
      { label: 'Pause', size: 17 },
      {
        interactions: [ix('ix_r_pause', 'click', [['mediaPause', { target: 'el_r_video' }]])],
      },
    ),
    el('video', 'el_r_video', 'Product tour', [550, 156, 650, 366], undefined, {
      assetId: video.id,
      frame: 'border',
      alt: 'Tasklane — Sprint board',
      autoplay: true,
      muted: true,
      loop: true,
      controls: true,
    }),
    back(2),
    next(2),
    progress(2),
  ]);

  const s3 = page('pg_r3', 'Performance', 'base', [
    ...title(3, 'PERFORMANCE', 'Boards load up to 3× faster'),
    text('el_r_stat', 'Big number', [80, 200, 380, 110], 'heading', '3.2×', { size: 96 }, {}, { color: t.colors.accentText }),
    text(
      'el_r_stattext',
      'Explanation',
      [80, 320, 380, 170],
      'body',
      'We rebuilt how boards fetch and render cards. Large boards (1,000+ tasks) now open in well under half a second. Hover the bars for exact numbers.',
      {
        size: 20,
        lineHeight: 1.55,
      },
    ),
    el('chart', 'el_r_chart', 'Load time chart', [500, 186, 700, 410], undefined, {
      chartType: 'bar',
      title: 'Board load time (lower is better)',
      labels: ['50 tasks', '200 tasks', '1,000 tasks', '5,000 tasks'],
      series: [
        { name: 'Version 3.1', values: [180, 420, 1250, 4100] },
        { name: 'Version 3.2', values: [90, 160, 390, 1300] },
      ],
      yLabel: 'Milliseconds',
      valueSuffix: ' ms',
      preset: 'clean',
    }),
    back(3),
    next(3),
    progress(3),
  ]);

  const s4 = page('pg_r4', 'What changed', 'alt', [
    ...title(4, 'AT A GLANCE', 'What changed in 3.2'),
    text('el_r_tablehint', 'Hint', [80, 168, 700, 30], 'caption', 'Click a column header to sort.', { size: 16 }),
    el('table', 'el_r_table', 'Changes table', [80, 206, 1120, 296], undefined, {
      rows: [
        ['Area', 'Version 3.1', 'Version 3.2', 'Change'],
        ['Board load (1,000 tasks)', '1,250 ms', '390 ms', '3.2× faster'],
        ['Keyboard shortcuts', '12', '31', '+19'],
        ['Offline export', '—', 'One HTML file', 'New'],
        ['Insights view', 'Basic counts', 'Charts & trends', 'Improved'],
        ['Open accessibility issues', '14', '2', '−86%'],
      ],
      size: 18,
      preset: 'lined',
    }),
    back(4),
    next(4),
    progress(4),
  ]);

  const card = (i: number, name: string, body: string, detail: string) => {
    const x = 80 + i * 380;
    return [
      el('shape', `el_r_card${i}`, `${name} card`, [x, 196, 350, 360], 'card', { shape: 'rect' }, fadeUp(100 + i * 150)),
      text(`el_r_cardt${i}`, `${name} title`, [x + 28, 226, 294, 40], 'subheading', name, { size: 26 }, fadeUp(100 + i * 150)),
      text(`el_r_cardb${i}`, `${name} text`, [x + 28, 276, 294, 90], 'body', body, { size: 18, lineHeight: 1.5 }, fadeUp(100 + i * 150)),
      text(
        `el_r_cardd${i}`,
        `${name} detail`,
        [x + 28, 380, 294, 90],
        'label',
        detail,
        { size: 15, padding: 12, lineHeight: 1.45, align: 'left', valign: 'middle' },
        { hidden: true },
      ),
      el(
        'button',
        `el_r_cardbtn${i}`,
        `${name} button`,
        [x + 28, 486, 200, 46],
        'secondary',
        { label: 'Show details', size: 15 },
        {
          ...fadeUp(100 + i * 150),
          interactions: [ix(`ix_r_card${i}`, 'click', [['toggle', { target: `el_r_cardd${i}`, effect: 'pop' }]])],
        },
      ),
    ];
  };
  const s5 = page('pg_r5', 'Try it', 'base', [
    ...title(5, 'NEW INSIGHTS VIEW', 'Three things to try today'),
    ...card(0, 'Trends', 'See how work flows week by week, per team or per label.', 'Open Insights → Trends and pick a date range.'),
    ...card(1, 'Hotspots', 'Spot the columns where cards wait the longest.', 'Columns turn amber when cards wait over 3 days.'),
    ...card(2, 'Share', 'Export any board as one offline HTML file.', 'Board menu → Export → “One HTML file”.'),
    el('navButton', 'el_r_restart', 'Start over', [1000, 620, 220, 54], 'primary', {
      label: 'Start over',
      icon: 'refresh',
      iconSide: 'left',
      target: 'first',
      size: 17,
    }),
    back(5),
    progress(5),
  ]);
  s5.elements.find((e) => e.id === 'el_r_back5')!.x = 770;

  p.pages = [s1, s2, s3, s4, s5];
  return p;
}

// ---------------------------------------------------------------- B: Event Announcement
/** UTC offset (minutes) of `tz` at `date`. */
function tzOffset(tz: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date);
    const get = (k: string) => Number(parts.find((x) => x.type === k)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/** Friday 2 January 2026, 17:30 in `tz` — a weekly countdown rolls forward to the next Friday from there. */
function fridayAnchor(tz: string): string {
  const guess = new Date(Date.UTC(2026, 0, 2, 17, 30));
  return new Date(guess.getTime() - tzOffset(tz, guess) * 60000).toISOString();
}

function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function eventAnnouncement(): Project {
  const p = createProject('page', 'The Autumn Social', 'editorial');
  p.id = 'prj_example_event';
  const { el, text, page } = kit('editorial');
  const gif = confettiGif();
  const roof = rooftopArt();
  const icons = (['calendar', 'pin', 'cake'] as const).map(iconArt);
  for (const a of [gif, roof, ...icons]) p.assets[a.id] = a;
  const tz = localZone();

  const hero = page(
    'pg_e1',
    'Invitation',
    'hero',
    [
      text('el_e_tag', 'Tag', [380, 110, 240, 40], 'label', 'YOU’RE INVITED', { size: 14, align: 'center', valign: 'middle' }),
      text('el_e_title', 'Title', [80, 172, 840, 110], 'display', 'The Autumn Social', { size: 80, align: 'center', lineHeight: 1.05 }, fadeUp(0)),
      text(
        'el_e_sub',
        'Subtitle',
        [160, 296, 680, 90],
        'displaySub',
        'An evening of good food, live music and rooftop views for everyone at Northwind & Co.',
        {
          size: 24,
          align: 'center',
          lineHeight: 1.45,
        },
        fadeUp(150),
      ),
      el('navButton', 'el_e_go', 'Count me in', [390, 420, 220, 60], 'hero', { label: 'Count me in', icon: 'chevron-down', size: 19 }),
      el(
        'image',
        'el_e_confetti1',
        'Confetti',
        [96, 360, 170, 170],
        undefined,
        { assetId: gif.id, alt: 'Confetti bursting from a party popper' },
        {},
        { radius: 85 },
      ),
      el('image', 'el_e_confetti2', 'Confetti 2', [734, 360, 170, 170], undefined, { assetId: gif.id, alt: '' }, {}, { radius: 85 }),
    ],
    600,
  );

  const countdown = page(
    'pg_e2',
    'Countdown',
    'alt',
    [
      text('el_e_when', 'When', [200, 70, 600, 30], 'kicker', 'EVERY FRIDAY · 5:30 PM', { size: 15, align: 'center' }),
      text('el_e_cdtitle', 'Countdown title', [150, 104, 700, 64], 'heading', 'Doors open in', { size: 48, align: 'center' }),
      el('countdown', 'el_e_countdown', 'Countdown', [150, 190, 700, 190], undefined, {
        target: fridayAnchor(tz),
        timezone: tz,
        repeat: 'weekly',
        holdMinutes: 210,
        style: 'cards',
        title: '',
        doneText: 'Doors are open — come on up! 🎉',
      }),
      text(
        'el_e_cdnote',
        'Note',
        [150, 398, 700, 50],
        'caption',
        'This example counts down to the next Friday at 5:30 pm on your clock, so it always stays current.',
        {
          size: 15,
          align: 'center',
          lineHeight: 1.4,
        },
      ),
    ],
    480,
  );

  const detail = (i: number, title: string, body: string) => {
    const x = 60 + i * 300;
    return [
      el('shape', `el_e_card${i}`, `${title} card`, [x, 150, 280, 320], 'card', { shape: 'rect' }, fadeUp(i * 120)),
      el('image', `el_e_icon${i}`, `${title} icon`, [x + 104, 180, 72, 72], undefined, { assetId: icons[i].id, alt: '' }, fadeUp(i * 120), {
        radius: 36,
        shadow: 'none',
      }),
      text(`el_e_ct${i}`, `${title} title`, [x + 24, 272, 232, 40], 'subheading', title, { size: 26, align: 'center' }, fadeUp(i * 120)),
      text(`el_e_cb${i}`, `${title} text`, [x + 24, 320, 232, 120], 'body', body, { size: 18, align: 'center', lineHeight: 1.5 }, fadeUp(i * 120)),
    ];
  };
  const details = page(
    'pg_e3',
    'Details',
    'base',
    [
      text('el_e_dtitle', 'Details title', [100, 56, 800, 64], 'heading', 'The details', { size: 46, align: 'center' }),
      ...detail(0, 'When', 'Friday from 5:30 pm until the lights go down.'),
      ...detail(1, 'Where', 'The rooftop terrace on the 9th floor — follow the string lights.'),
      ...detail(2, 'Bring', 'Your appetite, a friend, and a dish to share if you like.'),
    ],
    530,
  );

  const photo = page(
    'pg_e4',
    'The roof',
    'base',
    [
      el(
        'image',
        'el_e_roof',
        'Rooftop',
        [60, 60, 500, 350],
        undefined,
        { assetId: roof.id, alt: 'Illustration of the rooftop terrace at dusk with string lights' },
        { entrance: { preset: 'fadeIn', duration: 900, delay: 0 } },
      ),
      text('el_e_rooftitle', 'Roof title', [600, 96, 350, 120], 'heading', 'Golden hour on the roof', { size: 42, lineHeight: 1.12 }),
      text(
        'el_e_roofbody',
        'Roof text',
        [600, 232, 340, 170],
        'body',
        'Watch the sun set over the river while the band warms up. Blankets and heaters are on hand if the evening turns crisp.',
        {
          size: 19,
          lineHeight: 1.6,
        },
      ),
    ],
    470,
  );

  const programme = page(
    'pg_e5',
    'Programme',
    'alt',
    [
      text('el_e_ptitle', 'Programme title', [150, 56, 700, 64], 'heading', 'Programme', { size: 46, align: 'center' }),
      el('table', 'el_e_table', 'Programme', [180, 140, 640, 262], undefined, {
        rows: [
          ['Time', 'What’s happening'],
          ['5:30 pm', 'Doors open & welcome drinks'],
          ['6:15 pm', 'Tasting tables from every team'],
          ['7:00 pm', 'Live acoustic set'],
          ['8:30 pm', 'Dessert & lights over the city'],
        ],
        columnAlign: ['auto', 'auto'],
        preset: 'minimal',
        sortable: false,
        striped: true,
        size: 19,
      }),
    ],
    460,
  );

  const cta = page(
    'pg_e6',
    'See you there',
    'dark',
    [
      text('el_e_ctatitle', 'Closing title', [100, 80, 800, 70], 'display', 'See you on the roof', { size: 54, align: 'center' }),
      text('el_e_ctasub', 'Closing text', [150, 160, 700, 40], 'displaySub', 'Questions? Ask anyone on the People team.', { size: 21, align: 'center' }),
      el(
        'button',
        'el_e_rsvp',
        'RSVP button',
        [380, 228, 240, 60],
        'hero',
        { label: 'I’m coming!', icon: 'heart', size: 19 },
        {
          interactions: [
            ix('ix_e_rsvp', 'click', [
              ['animate', { target: '@self', preset: 'pop' }],
              ['show', { target: 'el_e_thanks', effect: 'pop' }],
            ]),
          ],
        },
      ),
      text(
        'el_e_thanks',
        'Thanks',
        [250, 306, 500, 40],
        'displaySub',
        'Wonderful — we’ll save you a seat. ✨',
        { size: 20, align: 'center' },
        { hidden: true },
      ),
    ],
    380,
  );

  p.pages = [hero, countdown, details, photo, programme, cta];
  return p;
}

// ---------------------------------------------------------------- C: Interactive Knowledge Check
export function knowledgeCheck(): Project {
  const p = createProject('slides', 'How the web works — knowledge check', 'technical');
  p.id = 'prj_example_quiz';
  p.settings.transition = 'slide';
  p.variables = [{ id: 'var_score', name: 'Score', type: 'number', initial: 0 }];
  const { el, text, page } = kit('technical');

  const progress = (n: number, role?: string) => el('progress', `el_q_progress${n}`, 'Progress', [0, 714, 1280, 6], role, { source: 'slides' });
  const next = (n: number, label = 'Next') =>
    el('navButton', `el_q_next${n}`, 'Next button', [1050, 620, 170, 56], 'primary', { label, icon: 'arrow-right', size: 18 });

  const s1 = page('pg_q1', 'Welcome', 'hero', [
    text('el_q_tag', 'Tag', [90, 170, 360, 40], 'label', 'KNOWLEDGE CHECK · 3 QUESTIONS', { size: 14, align: 'center', valign: 'middle' }),
    text('el_q_title', 'Title', [90, 230, 640, 180], 'display', 'How does the web load a page?', { size: 64, lineHeight: 1.08 }, fadeUp(0)),
    text(
      'el_q_sub',
      'Intro',
      [90, 420, 560, 90],
      'displaySub',
      'Learn the three big steps, then test yourself. No sign-up, no code — just click.',
      { size: 24, lineHeight: 1.45 },
      fadeUp(150),
    ),
    el('navButton', 'el_q_start', 'Start', [90, 540, 200, 60], 'hero', { label: 'Start', icon: 'arrow-right', size: 20 }),
    el(
      'shape',
      'el_q_hex',
      'Hexagon',
      [860, 150, 280, 300],
      'tone0',
      { shape: 'hexagon', opacity: 0.9 },
      { entrance: { preset: 'zoomIn', duration: 900, delay: 200 } },
    ),
    el(
      'shape',
      'el_q_dot',
      'Circle',
      [800, 420, 150, 150],
      'tone1',
      { shape: 'ellipse', opacity: 0.85 },
      { entrance: { preset: 'zoomIn', duration: 900, delay: 400 } },
    ),
    el(
      'arrow',
      'el_q_arrow',
      'Arrow',
      [930, 470, 230, 120],
      undefined,
      { bend: -0.4, start: { x: 0.05, y: 0.4 }, end: { x: 0.95, y: 0.75 }, dashed: true },
      { entrance: { preset: 'draw', duration: 900, delay: 700 } },
    ),
    progress(1),
  ]);

  const node = (i: number, name: string, body: string) => {
    const x = 80 + i * 400;
    return [
      el('shape', `el_q_node${i}`, `${name} box`, [x, 210, 320, 150], 'card', { shape: 'rect' }),
      text(`el_q_nodet${i}`, `${name} label`, [x + 24, 236, 272, 44], 'heading', name, { size: 32, align: 'center' }),
      el(
        'button',
        `el_q_nodeb${i}`,
        `${name} button`,
        [x + 50, 296, 220, 44],
        'secondary',
        { label: 'What does it do?', size: 15 },
        {
          interactions: [ix(`ix_q_node${i}`, 'click', [['toggle', { target: `el_q_noded${i}`, effect: 'slide' }]])],
        },
      ),
      text(`el_q_noded${i}`, `${name} explanation`, [x, 384, 320, 170], 'body', body, { size: 18, lineHeight: 1.5, padding: 16 }, { hidden: true }),
    ];
  };
  const s2 = page('pg_q2', 'Three steps', 'base', [
    text('el_q_s2k', 'Kicker', [80, 64, 600, 30], 'kicker', 'THE BIG PICTURE', { size: 15 }),
    text('el_q_s2t', 'Title', [80, 96, 900, 70], 'heading', 'From URL to page in three steps', { size: 44 }),
    text('el_q_s2h', 'Hint', [80, 162, 700, 30], 'caption', 'Click “What does it do?” under each step.', { size: 16 }),
    ...node(0, 'Browser', 'You type example.com. Before it can ask for the page, the browser needs the server’s address.'),
    ...node(1, 'DNS', 'The Domain Name System looks the name up and answers with an IP address such as 93.184.216.34.'),
    ...node(2, 'Server', 'The browser sends an HTTP request. The server replies with HTML, CSS and images — and the page appears.'),
    el('arrow', 'el_q_a1', 'Arrow 1', [404, 262, 72, 40], undefined, {}),
    el('arrow', 'el_q_a2', 'Arrow 2', [804, 262, 72, 40], undefined, {}),
    next(2, 'Test yourself'),
    progress(2),
  ]);
  s2.elements.find((e) => e.id === 'el_q_next2')!.w = 210;
  s2.elements.find((e) => e.id === 'el_q_next2')!.x = 1010;

  const question = (n: number, q: string, choices: string[], correct: number, ok: string, wrong: string, extra: Props = {}) =>
    page(`pg_q${n + 2}`, `Question ${n}`, 'base', [
      text(`el_q_qk${n}`, 'Kicker', [80, 64, 600, 30], 'kicker', `QUESTION ${n} OF 3`, { size: 15 }),
      el(
        'quiz',
        `el_q_quiz${n}`,
        `Question ${n}`,
        [80, 110, 720, 520],
        undefined,
        {
          question: q,
          choices,
          correct,
          feedbackCorrect: ok,
          feedbackIncorrect: wrong,
          allowRetry: true,
          revealAnswer: true,
          scoreVariable: 'var_score',
          points: 1,
          firstTryOnly: true,
          ...extra,
        },
        {
          interactions: [ix(`ix_q_correct${n}`, 'quizCorrect', [['animate', { target: `el_q_score${n}`, preset: 'pop' }]])],
        },
      ),
      text(`el_q_score${n}`, 'Score badge', [880, 130, 320, 70], 'score', 'Score: {Score} / 3', { size: 30, align: 'center', valign: 'middle', padding: 8 }),
      el('progress', `el_q_ring${n}`, 'Score ring', [950, 240, 180, 180], undefined, {
        source: 'variable',
        variableId: 'var_score',
        max: 3,
        style: 'ring',
        label: 'fraction',
      }),
      text(`el_q_tip${n}`, 'Tip', [880, 440, 320, 90], 'caption', 'Only your first try counts toward the score — but you can retry to learn.', {
        size: 16,
        align: 'center',
        lineHeight: 1.45,
      }),
      next(n + 2, n === 3 ? 'Finish' : 'Next'),
      progress(n + 2),
    ]);

  const q1 = question(
    1,
    'What does DNS do?',
    ['Encrypts your connection', 'Turns a domain name into an IP address', 'Stores the web page', 'Speeds up your Wi-Fi'],
    1,
    'Exactly — DNS is the internet’s phone book.',
    'Not quite. Think about how “example.com” becomes a number computers can route to.',
  );
  const q2 = question(
    2,
    'A server replies with status “404”. What does it mean?',
    ['Everything worked', 'You must log in first', 'The page was not found', 'The server moved'],
    2,
    'Right — 404 means “Not Found”. (200 means OK, 401 means log in.)',
    'Not this one. 4xx codes mean something was wrong with the request…',
  );
  const q3 = question(
    3,
    'Which part of https:// keeps your data private on the way?',
    ['The “s” — TLS encryption', 'The “www”', 'The “.com”', 'The two slashes'],
    0,
    'Yes! The “s” stands for secure: the connection is encrypted with TLS.',
    'Look at what changed between http:// and https://.',
    { layout: 'grid' },
  );

  const s6 = page('pg_q6', 'Results', 'hero', [
    text('el_q_done', 'Done title', [90, 120, 700, 80], 'display', 'You made it!', { size: 64 }, fadeUp(0)),
    text('el_q_final', 'Final score', [90, 214, 600, 60], 'displaySub', 'Your score: {Score} out of 3', { size: 30 }, fadeUp(120)),
    el('progress', 'el_q_finalring', 'Final ring', [880, 130, 260, 260], 'onHero', {
      source: 'variable',
      variableId: 'var_score',
      max: 3,
      style: 'ring',
      label: 'percent',
    }),
    el(
      'button',
      'el_q_reveal',
      'Reveal badge',
      [90, 320, 260, 60],
      'hero',
      { label: 'Reveal my badge', icon: 'star', size: 19 },
      {
        interactions: [
          ix(
            'ix_q_perfect',
            'click',
            [
              ['show', { target: 'el_q_star', effect: 'pop' }],
              ['show', { target: 'el_q_perfect', effect: 'fade' }],
              ['animate', { target: 'el_q_star', preset: 'spin' }],
            ],
            [{ id: 'cd_q_perfect', type: 'variable', variableId: 'var_score', op: 'gte', value: 3 }],
          ),
          ix(
            'ix_q_good',
            'click',
            [['show', { target: 'el_q_good', effect: 'fade' }]],
            [{ id: 'cd_q_good', type: 'variable', variableId: 'var_score', op: 'lt', value: 3 }],
          ),
        ],
      },
    ),
    el('shape', 'el_q_star', 'Star badge', [400, 300, 140, 140], 'tone2', { shape: 'star' }, { hidden: true }),
    text(
      'el_q_perfect',
      'Perfect message',
      [90, 460, 700, 90],
      'displaySub',
      '🏆  Perfect score! You know how the web loads a page.',
      { size: 26, lineHeight: 1.4 },
      { hidden: true },
    ),
    text(
      'el_q_good',
      'Good message',
      [90, 460, 700, 90],
      'displaySub',
      'Nice work! Go back through the three steps and try again for a perfect score.',
      { size: 24, lineHeight: 1.4 },
      { hidden: true },
    ),
    el(
      'button',
      'el_q_again',
      'Try again',
      [90, 590, 200, 54],
      'heroGhost',
      { label: 'Try again', icon: 'refresh', iconSide: 'left', size: 18 },
      {
        interactions: [
          ix('ix_q_again', 'click', [
            ['varReset', { variable: '@all' }],
            ['quizReset', { target: 'el_q_quiz1' }],
            ['quizReset', { target: 'el_q_quiz2' }],
            ['quizReset', { target: 'el_q_quiz3' }],
            ['hide', { target: 'el_q_star', effect: 'none' }],
            ['hide', { target: 'el_q_perfect', effect: 'none' }],
            ['hide', { target: 'el_q_good', effect: 'none' }],
            ['navigate', { page: 'first' }],
          ]),
        ],
      },
    ),
    progress(6, 'onHero'),
  ]);

  p.pages = [s1, s2, q1, q2, q3, s6];
  return p;
}
