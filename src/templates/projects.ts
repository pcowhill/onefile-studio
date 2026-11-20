import type { Interaction, Page, Project, SceneElement, ThemeId } from '../model/types';
import { createProject } from '../model/factory';
import { fadeUp, ix, kit } from '../examples/v2';
import { confettiGif } from '../examples/art2';
import { balloonsArt, giftArt, picnicArt, redesignArt, screenshotArt } from './art';

/**
 * The project templates. Each is an ordinary project built with the editor's
 * own factories and theme roles, so it is fully editable, re-themable and
 * exportable — nothing here bypasses the schema. Elements carry meaningful
 * names ("Presentation Title", "Feature Screenshot"…) so the Layers list and
 * the quick-start guide can point at them. Element ids are stable so guides
 * can find them; project ids are always fresh (see `instantiateTemplate`).
 */

type Props = Record<string, unknown>;
type Box = [number, number, number, number];
const key = (id: string, k: string, actions: Array<[string, Props]>, conditions: Interaction['conditions'] = []): Interaction => ({
  ...ix(id, 'key', actions, conditions),
  options: { key: k },
});

/** Slide-deck helpers shared by the slide templates. */
function deck(theme: ThemeId, prefix: string) {
  const k = kit(theme);
  const { el, text } = k;
  const progress = (n: number, onHero = false) =>
    el('progress', `el_${prefix}_progress${n}`, 'Progress bar', [0, 714, 1280, 6], onHero ? 'onHero' : undefined, { source: 'slides' });
  const next = (n: number, label = 'Next', box: Box = [1070, 624, 150, 52]) =>
    el('navButton', `el_${prefix}_next${n}`, 'Next button', box, 'primary', { label, icon: 'arrow-right', size: 18 });
  const back = (n: number, box: Box = [900, 624, 150, 52]) =>
    el('navButton', `el_${prefix}_back${n}`, 'Back button', box, 'secondary', {
      label: 'Back',
      icon: 'arrow-left',
      iconSide: 'left',
      target: 'prev',
      size: 18,
    });
  const heading = (n: number, kicker: string, title: string, width = 900) => [
    text(`el_${prefix}_kicker${n}`, 'Section label', [80, 60, 700, 30], 'kicker', kicker, { size: 15 }),
    text(`el_${prefix}_heading${n}`, 'Slide heading', [80, 92, width, 70], 'heading', title, { size: 44 }),
  ];
  const nav = (n: number) => [back(n), next(n), progress(n)];
  return { ...k, progress, next, back, heading, nav };
}

// ------------------------------------------------------------ A: Feature walkthrough
export function featureWalkthrough(theme: ThemeId = 'professional'): Project {
  const p = createProject('slides', 'Smart Filters — feature walkthrough', theme);
  const { el, text, page, heading, nav, progress } = deck(theme, 'fw');
  const shot = screenshotArt();
  p.assets[shot.id] = shot;

  const s1 = page('pg_fw1', 'Title', 'hero', [
    text('el_fw_ticket', 'Ticket label', [80, 150, 330, 36], 'label', 'FEATURE WALKTHROUGH · BD-482', { size: 14, align: 'center', valign: 'middle' }),
    text('el_fw_title', 'Presentation Title', [80, 206, 560, 100], 'display', 'Smart Filters', { size: 78, lineHeight: 1.05 }, fadeUp(0)),
    text(
      'el_fw_summary',
      'Summary',
      [80, 318, 540, 110],
      'displaySub',
      'Find the right ticket in seconds — filters that remember what your team searches for most.',
      { size: 24, lineHeight: 1.45 },
      fadeUp(150),
    ),
    el('navButton', 'el_fw_start', 'Start button', [80, 466, 230, 58], 'hero', { label: 'Take the tour', icon: 'arrow-right', size: 19 }),
    text('el_fw_meta', 'Author and date', [80, 604, 600, 30], 'displaySub', 'Priya N. · Brightdesk web team · Sprint 42', { size: 16 }),
    el('shape', 'el_fw_glow', 'Background shape', [700, 120, 520, 440], 'tone0', { shape: 'blob', opacity: 0.35 }),
    el(
      'image',
      'el_fw_hero_shot',
      'Feature Screenshot',
      [680, 170, 540, 338],
      undefined,
      { assetId: shot.id, alt: 'The new Smart Filters panel in Brightdesk', fit: 'cover' },
      { entrance: { preset: 'zoomIn', duration: 800, delay: 250 } },
    ),
    progress(1, true),
  ]);

  const card = (i: number, title: string, body: string) => {
    const x = 80 + i * 380;
    return [
      el('shape', `el_fw_card${i}`, `${title} card`, [x, 200, 350, 290], 'card', { shape: 'rect' }, fadeUp(100 + i * 150)),
      el('shape', `el_fw_dot${i}`, `${title} badge`, [x + 28, 228, 52, 52], `tone${i}`, { shape: 'ellipse' }, fadeUp(100 + i * 150)),
      text(
        `el_fw_dotn${i}`,
        `${title} number`,
        [x + 28, 228, 52, 52],
        'heading',
        String(i + 1),
        { size: 24, align: 'center', valign: 'middle' },
        fadeUp(100 + i * 150),
        {
          color: '#ffffff',
        },
      ),
      text(`el_fw_cardt${i}`, `${title} title`, [x + 28, 300, 294, 40], 'subheading', title, { size: 26 }, fadeUp(100 + i * 150)),
      text(`el_fw_cardb${i}`, `${title} text`, [x + 28, 348, 294, 120], 'body', body, { size: 19, lineHeight: 1.55 }, fadeUp(100 + i * 150)),
    ];
  };
  const s2 = page('pg_fw2', 'Overview', 'base', [
    ...heading(2, 'OVERVIEW', 'What changed — and why'),
    ...card(0, 'The problem', 'Agents spent minutes re-typing the same searches to find urgent, unassigned tickets.'),
    ...card(1, 'The change', 'A filter panel with one-click chips, saved views and filters that remember your last choice.'),
    ...card(2, 'The result', 'In testing, finding a ticket dropped from 41 to 9 seconds on average.'),
    ...nav(2),
  ]);

  const s3 = page('pg_fw3', 'See it in action', 'alt', [
    ...heading(3, 'SEE IT IN ACTION', 'The new filter panel', 640),
    text(
      'el_fw_explain',
      'Main Explanation',
      [80, 190, 400, 210],
      'body',
      'Filters now live in a panel next to the ticket list. Pick a chip, tick a team, and the list updates instantly — no search box required.',
      { size: 21, lineHeight: 1.6 },
    ),
    text(
      'el_fw_tip',
      'Replace hint',
      [80, 420, 400, 80],
      'caption',
      'Tip: select the screenshot and choose “Replace” to show your own — or insert a video recording instead.',
      { size: 16, lineHeight: 1.45 },
    ),
    el(
      'image',
      'el_fw_shot',
      'Feature Screenshot (large)',
      [520, 150, 690, 431],
      undefined,
      { assetId: shot.id, alt: 'The Smart Filters panel', fit: 'cover' },
      fadeUp(100),
    ),
    ...nav(3),
  ]);

  // Annotated tour: numbered markers over the screenshot reveal one note each.
  // Marker centres sit on the part of the screenshot each note describes.
  const notes = [
    ['Filter chips', 'Most-used filters are one click away. The blue chips are switched on.', [726, 306]],
    ['Team filter', 'Tick teams to narrow the list. Your choice is remembered next time.', [726, 462]],
    ['Live results', 'The list updates as you click — the highlighted row matches every filter.', [1176, 344]],
  ] as const;
  const hideNotes = (except: number): Array<[string, Props]> =>
    notes.map((_, j) => (j === except ? ['show', { target: `el_fw_note${j}`, effect: 'pop' }] : ['hide', { target: `el_fw_note${j}`, effect: 'none' }]));
  const s4 = page('pg_fw4', 'Guided tour', 'base', [
    ...heading(4, 'GUIDED TOUR', 'Click the numbers to explore', 700),
    el('image', 'el_fw_tour_shot', 'Annotated Screenshot', [470, 150, 740, 462], undefined, {
      assetId: shot.id,
      alt: 'Annotated Smart Filters panel',
      fit: 'cover',
    }),
    text(
      'el_fw_tour_intro',
      'Tour introduction',
      [80, 190, 340, 150],
      'body',
      'Three things make Smart Filters faster. Click each number on the screenshot to read about it.',
      { size: 20, lineHeight: 1.55 },
    ),
    ...notes.flatMap(([title, body, [x, y]], i) => [
      el(
        'button',
        `el_fw_marker${i}`,
        `Callout ${i + 1} marker`,
        [x - 24, y - 24, 48, 48],
        'primary',
        { label: String(i + 1), size: 20 },
        {
          entrance: { preset: 'zoomIn', duration: 500, delay: 300 + i * 200 },
          interactions: [ix(`ix_fw_marker${i}`, 'click', [...hideNotes(i), ['animate', { target: '@self', preset: 'pulse' }]])],
        },
      ),
      text(
        `el_fw_note${i}`,
        `Callout ${i + 1}: ${title}`,
        [80, 360, 340, 120],
        'label',
        `${i + 1} · ${title.toUpperCase()}\n${body}`,
        { size: 16, padding: 16, lineHeight: 1.5, align: 'left', valign: 'top', letterSpacing: 0 },
        { hidden: true },
      ),
    ]),
    ...nav(4),
  ]);

  const s5 = page('pg_fw5', 'Design choices', 'alt', [
    ...heading(5, 'DESIGN CHOICES', 'Decisions we made along the way', 760),
    text(
      'el_fw_choices_intro',
      'Design choices summary',
      [80, 190, 470, 200],
      'body',
      'We tried three layouts with twelve agents. The side panel won because it keeps the ticket list visible while you filter.\n\nScroll the decision log to see the trade-offs.',
      { size: 20, lineHeight: 1.6 },
    ),
    el('scrollText', 'el_fw_log', 'Decision log', [600, 170, 600, 420], undefined, {
      title: 'Decision log',
      text: '# Side panel, not a pop-up\nA pop-up hid the very list you were filtering. A panel keeps both in view.\n\n# Chips for the top five filters\nUsage data showed five filters cover **80 %** of searches, so they get one-click chips.\n\n# Remember the last filter\nAgents return to the same queue all day. Remembering their choice saves a click every visit.\n\n# What we left out\n- Natural-language search (next quarter)\n- Sharing saved views with a team\n- Filter by customer plan',
      size: 18,
    }),
    ...nav(5),
  ]);

  const s6 = page('pg_fw6', 'Summary', 'hero', [
    text('el_fw_sum_kicker', 'Section label', [80, 110, 270, 36], 'label', 'SUMMARY & NEXT STEPS', { size: 14, align: 'center', valign: 'middle' }),
    text('el_fw_sum_title', 'Summary heading', [80, 160, 760, 80], 'display', 'Ready to ship in 3.8', { size: 56 }, fadeUp(0)),
    text(
      'el_fw_sum_list',
      'Next steps',
      [80, 270, 640, 200],
      'displaySub',
      '✓  Code reviewed and merged behind a flag\n✓  Usability test with 12 agents\n→  Roll out to all teams on Monday\n→  Collect feedback for two weeks',
      { size: 22, lineHeight: 1.75 },
      fadeUp(150),
    ),
    el(
      'button',
      'el_fw_link',
      'Ticket link',
      [80, 520, 260, 58],
      'hero',
      { label: 'Open the ticket', icon: 'arrow-right', size: 18 },
      { interactions: [ix('ix_fw_link', 'click', [['openLink', { url: 'https://example.com/tickets/BD-482', newTab: true, label: 'Open ticket BD-482' }]])] },
    ),
    el('navButton', 'el_fw_again', 'Start over button', [360, 520, 220, 58], 'heroGhost', {
      label: 'Start over',
      icon: 'refresh',
      iconSide: 'left',
      target: 'first',
      size: 18,
    }),
    progress(6, true),
  ]);
  p.pages = [s1, s2, s3, s4, s5, s6];
  return p;
}

// ------------------------------------------------------------ B: Meeting presentation
export function meetingPresentation(theme: ThemeId = 'professional'): Project {
  const p = createProject('slides', 'Quarterly review', theme);
  const { el, text, page, heading, nav, progress, t } = deck(theme, 'mt');
  const pages: Page[] = [];
  const ids = ['pg_mt1', 'pg_mt2', 'pg_mt3', 'pg_mt4', 'pg_mt5', 'pg_mt6', 'pg_mt7', 'pg_mt8'];

  pages.push(
    page(ids[0], 'Title', 'hero', [
      text('el_mt_label', 'Meeting label', [80, 170, 260, 36], 'label', 'TEAM MEETING · Q3', { size: 14, align: 'center', valign: 'middle' }),
      text('el_mt_title', 'Presentation Title', [80, 224, 760, 110], 'display', 'Quarterly review', { size: 82, lineHeight: 1.05 }, fadeUp(0)),
      text(
        'el_mt_sub',
        'Subtitle',
        [80, 346, 620, 80],
        'displaySub',
        'Where we are, what we learned and what comes next.',
        { size: 26, lineHeight: 1.4 },
        fadeUp(150),
      ),
      text('el_mt_presenter', 'Presenter and date', [80, 600, 600, 30], 'displaySub', 'Presented by Alex Morgan · Operations team', { size: 17 }),
      el('navButton', 'el_mt_start', 'Start button', [80, 470, 200, 58], 'hero', { label: 'Begin', icon: 'arrow-right', size: 19 }),
      el(
        'shape',
        'el_mt_deco1',
        'Decoration circle',
        [880, 140, 300, 300],
        'tone0',
        { shape: 'ellipse', opacity: 0.85 },
        { entrance: { preset: 'zoomIn', duration: 800, delay: 200 } },
      ),
      el(
        'shape',
        'el_mt_deco2',
        'Decoration square',
        [1010, 360, 190, 190],
        'tone1',
        { shape: 'rect', opacity: 0.9 },
        { entrance: { preset: 'zoomIn', duration: 800, delay: 400 } },
      ),
      el(
        'shape',
        'el_mt_deco3',
        'Decoration diamond',
        [840, 420, 140, 140],
        'tone2',
        { shape: 'diamond', opacity: 0.9 },
        { entrance: { preset: 'zoomIn', duration: 800, delay: 600 } },
      ),
      progress(1, true),
    ]),
  );

  const agenda = ['Highlights', 'Results', 'Project status', 'How we work', 'Quick question'];
  pages.push(
    page(ids[1], 'Agenda', 'base', [
      ...heading(2, 'AGENDA', 'Today’s agenda'),
      text('el_mt_agenda_hint', 'Agenda hint', [80, 166, 700, 30], 'caption', 'Click a topic to jump straight to it.', { size: 16 }),
      ...agenda.flatMap((item, i) => [
        el('shape', `el_mt_ag_dot${i}`, `Agenda ${i + 1} number`, [80, 214 + i * 76, 56, 56], `tone${i}`, { shape: 'ellipse' }, fadeUp(i * 100)),
        text(
          `el_mt_ag_num${i}`,
          `Agenda ${i + 1} number text`,
          [80, 214 + i * 76, 56, 56],
          'heading',
          String(i + 1),
          { size: 24, align: 'center', valign: 'middle' },
          fadeUp(i * 100),
          {
            color: '#ffffff',
          },
        ),
        el(
          'button',
          `el_mt_ag${i}`,
          `Agenda item ${i + 1}`,
          [156, 216 + i * 76, 420, 52],
          'secondary',
          { label: item, size: 20 },
          {
            ...fadeUp(i * 100),
            interactions: [ix(`ix_mt_ag${i}`, 'click', [['navigate', { page: ids[i + 2] }]])],
          },
        ),
      ]),
      el('shape', 'el_mt_ag_card', 'Agenda side card', [700, 214, 500, 352], 'soft', { shape: 'rect' }, fadeUp(200)),
      text('el_mt_ag_goal', 'Meeting goal heading', [740, 250, 420, 40], 'subheading', 'Goal for today', { size: 26 }, fadeUp(300)),
      text(
        'el_mt_ag_note',
        'Meeting goal',
        [740, 300, 420, 230],
        'body',
        'Agree on the three priorities for next quarter and who owns each one.\n\n⏱  30 minutes · everyone welcome',
        { size: 21, lineHeight: 1.55 },
        fadeUp(300),
      ),
      ...nav(2),
    ]),
  );

  const stat = (i: number, value: string, label: string, note: string) => {
    const x = 80 + i * 380;
    return [
      el('shape', `el_mt_stat_card${i}`, `Highlight ${i + 1} card`, [x, 210, 350, 270], 'card', { shape: 'rect' }, fadeUp(i * 150)),
      text(`el_mt_stat${i}`, `Highlight ${i + 1} number`, [x + 30, 240, 290, 90], 'heading', value, { size: 64 }, fadeUp(i * 150), {
        color: t.colors.accentText,
      }),
      text(`el_mt_stat_label${i}`, `Highlight ${i + 1} label`, [x + 30, 336, 290, 40], 'subheading', label, { size: 24 }, fadeUp(i * 150)),
      text(`el_mt_stat_note${i}`, `Highlight ${i + 1} note`, [x + 30, 384, 290, 100], 'body', note, { size: 18, lineHeight: 1.5 }, fadeUp(i * 150)),
    ];
  };
  pages.push(
    page(ids[2], 'Highlights', 'base', [
      ...heading(3, 'HIGHLIGHTS', 'Three numbers that matter'),
      ...stat(0, '94%', 'On-time delivery', 'Up from 81% last quarter, after we moved to weekly planning.'),
      ...stat(1, '12', 'New customers', 'Including our first two in the healthcare sector.'),
      ...stat(2, '4.7', 'Satisfaction score', 'Out of 5, from 230 survey responses.'),
      ...nav(3),
    ]),
  );

  pages.push(
    page(ids[3], 'Results', 'base', [
      ...heading(4, 'RESULTS', 'Orders handled per month', 700),
      text(
        'el_mt_chart_text',
        'Chart takeaway',
        [80, 190, 360, 260],
        'body',
        'Volume grew every month while the team stayed the same size.\n\nHover the bars for exact numbers, or click the legend to compare years.',
        { size: 20, lineHeight: 1.6 },
      ),
      el('chart', 'el_mt_chart', 'Results chart', [480, 160, 720, 430], undefined, {
        chartType: 'bar',
        title: 'Orders per month',
        labels: ['July', 'August', 'September'],
        series: [
          { name: 'Last year', values: [820, 860, 900] },
          { name: 'This year', values: [1040, 1180, 1310] },
        ],
        legendToggle: true,
        preset: 'clean',
      }),
      ...nav(4),
    ]),
  );

  pages.push(
    page(ids[4], 'Project status', 'alt', [
      ...heading(5, 'PROJECT STATUS', 'Where each project stands'),
      text('el_mt_table_hint', 'Table hint', [80, 166, 700, 30], 'caption', 'Click a column header to sort.', { size: 16 }),
      el('table', 'el_mt_table', 'Status table', [80, 206, 1120, 250], undefined, {
        rows: [
          ['Project', 'Owner', 'Status', 'Due'],
          ['New supplier portal', 'Jordan', 'On track', 'October'],
          ['Warehouse layout', 'Sam', 'At risk', 'November'],
          ['Customer survey', 'Priya', 'Done', 'September'],
          ['Training videos', 'Lee', 'On track', 'December'],
        ],
        size: 19,
        preset: 'lined',
        sortable: true,
      }),
      ...nav(5),
    ]),
  );

  const steps = ['Request', 'Plan', 'Build', 'Deliver'];
  pages.push(
    page(ids[5], 'How we work', 'base', [
      ...heading(6, 'HOW WE WORK', 'From request to delivery'),
      ...steps.flatMap((s, i) => {
        const x = 80 + i * 290;
        return [
          el('shape', `el_mt_flow${i}`, `Step ${i + 1} box`, [x, 260, 220, 130], i === 3 ? 'accent' : 'card', { shape: 'rect' }, fadeUp(i * 350)),
          text(
            `el_mt_flowt${i}`,
            `Step ${i + 1} name`,
            [x + 10, 290, 200, 40],
            'subheading',
            s,
            { size: 26, align: 'center' },
            fadeUp(i * 350),
            i === 3 ? { color: '#ffffff' } : undefined,
          ),
          text(
            `el_mt_flowd${i}`,
            `Step ${i + 1} detail`,
            [x + 10, 330, 200, 40],
            'caption',
            ['Anyone can ask', 'Within 2 days', 'In small steps', 'And check in'][i],
            { size: 16, align: 'center' },
            fadeUp(i * 350),
            i === 3 ? { color: '#ffffff' } : undefined,
          ),
          ...(i < 3
            ? [
                el(
                  'arrow',
                  `el_mt_arrow${i}`,
                  `Arrow ${i + 1}`,
                  [x + 222, 300, 66, 50],
                  undefined,
                  { width: 5, start: { x: 0.05, y: 0.5 }, end: { x: 0.95, y: 0.5 } },
                  {
                    entrance: { preset: 'draw', duration: 500, delay: 250 + i * 350 },
                  },
                ),
              ]
            : []),
        ];
      }),
      text(
        'el_mt_flow_note',
        'Process note',
        [80, 440, 1100, 80],
        'body',
        'Every request gets an owner within two days, and we share progress every Friday.',
        { size: 21, lineHeight: 1.5, align: 'center' },
        fadeUp(1400),
      ),
      ...nav(6),
    ]),
  );

  pages.push(
    page(ids[6], 'Quick question', 'alt', [
      ...heading(7, 'QUICK QUESTION', 'Test yourself'),
      el('quiz', 'el_mt_quiz', 'Question', [180, 180, 920, 360], undefined, {
        question: 'Which number grew the most this quarter?',
        choices: ['Satisfaction score', 'On-time delivery', 'Team size'],
        correct: 1,
        layout: 'list',
        feedbackCorrect: 'Right! On-time delivery went from 81% to 94%.',
        feedbackIncorrect: 'Not quite — have another look at the highlights.',
        allowRetry: true,
      }),
      ...nav(7),
    ]),
  );

  pages.push(
    page(ids[7], 'Thank you', 'hero', [
      text('el_mt_end_label', 'Section label', [80, 140, 200, 36], 'label', 'SUMMARY', { size: 14, align: 'center', valign: 'middle' }),
      text('el_mt_end_title', 'Closing heading', [80, 194, 760, 90], 'display', 'Thank you!', { size: 72 }, fadeUp(0)),
      text(
        'el_mt_end_points',
        'Key takeaways',
        [80, 300, 680, 180],
        'displaySub',
        '1.  Delivery is faster and more predictable\n2.  Growth came without extra headcount\n3.  Next: finish the supplier portal by October',
        { size: 23, lineHeight: 1.75 },
        fadeUp(150),
      ),
      text('el_mt_end_q', 'Questions prompt', [80, 520, 600, 40], 'displaySub', 'Questions? This file stays interactive — share it after the meeting.', {
        size: 18,
      }),
      el('navButton', 'el_mt_again', 'Back to agenda', [80, 590, 230, 54], 'hero', {
        label: 'Back to agenda',
        icon: 'arrow-left',
        iconSide: 'left',
        target: ids[1],
        size: 17,
      }),
      el(
        'shape',
        'el_mt_end_deco',
        'Decoration circle',
        [900, 200, 300, 300],
        'tone0',
        { shape: 'ellipse', opacity: 0.6 },
        { entrance: { preset: 'zoomIn', duration: 900, delay: 200 } },
      ),
      progress(8, true),
    ]),
  );
  p.pages = pages;
  return p;
}

// ------------------------------------------------------------ C: Technical explainer
export function technicalExplainerTemplate(theme: ThemeId = 'technical'): Project {
  const p = createProject('slides', 'How a web request works', theme);
  p.variables = [{ id: 'var_tx_step', name: 'Step', type: 'number', initial: 0 }];
  const { el, text, page, heading, nav, progress } = deck(theme, 'tx');
  const nodes = [
    ['Browser', 'You click a link. The browser asks for the page over HTTPS.'],
    ['Edge cache', 'A nearby server answers straight away if it has a fresh copy.'],
    ['API server', 'Otherwise the request reaches our code, which checks who you are.'],
    ['Database', 'The API reads the data it needs and sends the answer back.'],
  ] as const;
  const nodeX = (i: number) => 70 + i * 296;

  const s1 = page('pg_tx1', 'Title', 'hero', [
    text('el_tx_label', 'Topic label', [80, 160, 280, 36], 'label', 'HOW IT WORKS', { size: 14, align: 'center', valign: 'middle' }),
    text('el_tx_title', 'Presentation Title', [80, 214, 700, 160], 'display', 'How a web request works', { size: 66, lineHeight: 1.08 }, fadeUp(0)),
    text(
      'el_tx_intro',
      'Introduction',
      [80, 390, 600, 90],
      'displaySub',
      'Four stops between a click and a page. Follow along while we talk — click any box to learn more.',
      { size: 22, lineHeight: 1.45 },
      fadeUp(150),
    ),
    el('navButton', 'el_tx_start', 'Start button', [80, 520, 200, 58], 'hero', { label: 'Start', icon: 'arrow-right', size: 19 }),
    ...[0, 1, 2].map((i) =>
      el(
        'shape',
        `el_tx_deco${i}`,
        `Decoration ${i + 1}`,
        [870 + i * 120, 170 + (i % 2) * 40, 90, 90],
        i === 1 ? 'accent' : 'card',
        { shape: i === 1 ? 'hexagon' : 'rect' },
        {
          entrance: { preset: 'zoomIn', duration: 600, delay: 200 + i * 150 },
        },
      ),
    ),
    text('el_tx_keys1', 'Keyboard hint 1', [870, 340, 330, 34], 'label', 'ARROW KEYS · PREVIOUS / NEXT SLIDE', { size: 13, align: 'center', valign: 'middle' }),
    text('el_tx_keys2', 'Keyboard hint 2', [870, 386, 330, 34], 'label', '1 – 4 · EXPLAIN A BOX', { size: 13, align: 'center', valign: 'middle' }),
    text('el_tx_keys3', 'Keyboard hint 3', [870, 432, 330, 34], 'label', 'SPACE · NEXT STEP    R · RESTART', { size: 13, align: 'center', valign: 'middle' }),
    progress(1, true),
  ]);

  // Slide 2: overview diagram; click (or press 1–4) to explain a box.
  const showOnly = (i: number): Array<[string, Props]> => [
    ['hide', { target: 'el_tx_callhint', effect: 'none' }],
    ...nodes.map((_, j): [string, Props] =>
      j === i ? ['show', { target: `el_tx_call${j}`, effect: 'pop' }] : ['hide', { target: `el_tx_call${j}`, effect: 'none' }],
    ),
  ];
  const s2 = page('pg_tx2', 'The big picture', 'base', [
    ...heading(2, 'THE BIG PICTURE', 'Four stops, one request'),
    text('el_tx_hint', 'Diagram hint', [80, 166, 800, 30], 'caption', 'Click a box (or press 1–4) to see what happens there.', { size: 16 }),
    el('shape', 'el_tx_callbg', 'Explanation area', [70, 400, 1140, 146], 'soft', { shape: 'rect' }),
    text('el_tx_callhint', 'Explanation placeholder', [90, 450, 1100, 40], 'caption', 'The explanation appears here.', {
      size: 18,
      align: 'center',
      valign: 'middle',
    }),
    ...nodes.flatMap(([name], i) => [
      el(
        'button',
        `el_tx_node${i}`,
        `${name} box`,
        [nodeX(i), 250, 230, 100],
        i === 0 ? 'primary' : 'secondary',
        { label: name, size: 22, radius: 'rounded' },
        { ...fadeUp(i * 150), interactions: [ix(`ix_tx_node${i}`, 'click', [...showOnly(i), ['animate', { target: '@self', preset: 'pulse' }]])] },
      ),
      ...(i < nodes.length - 1
        ? [
            el(
              'arrow',
              `el_tx_arrow${i}`,
              `Arrow ${i + 1}`,
              [nodeX(i) + 234, 274, 58, 52],
              undefined,
              { width: 5, start: { x: 0.05, y: 0.5 }, end: { x: 0.95, y: 0.5 } },
              {
                entrance: { preset: 'draw', duration: 400, delay: 200 + i * 150 },
              },
            ),
          ]
        : []),
      text(
        `el_tx_call${i}`,
        `${name} explanation`,
        [90, 418, 1100, 110],
        'label',
        `${name.toUpperCase()}\n${nodes[i][1]}`,
        { size: 18, padding: 18, lineHeight: 1.5, align: 'left', valign: 'top', letterSpacing: 0 },
        { hidden: true },
      ),
    ]),
    ...nav(2),
  ]);
  s2.interactions = nodes.map((_, i) => key(`ix_tx_key${i}`, String(i + 1), showOnly(i)));

  // Slide 3: step by step with a variable, conditions, Space and R.
  const stepTexts = [
    '1. The browser looks up the address and opens a secure connection.',
    '2. The edge cache checks for a fresh copy — a hit returns in milliseconds.',
    '3. On a miss, the API server checks your session and builds the answer.',
    '4. The database returns the data; the answer travels back the same way.',
  ];
  const stepIs = (n: number): Interaction['conditions'] => [{ id: `cd_tx_step${n}`, type: 'variable', variableId: 'var_tx_step', op: 'eq', value: n }];
  // One rule per step, newest first. Every action is instant (the animations
  // are not waited for), so each press completes at once and quick repeated
  // presses — or Restart in between — can never skip or repeat a step.
  const advance = (prefix: string): Interaction[] =>
    stepTexts
      .map((_, n) =>
        ix(
          `${prefix}_s${n}`,
          prefix.includes('key') ? 'key' : 'click',
          [
            ['varAdd', { variable: 'var_tx_step', amount: 1 }],
            ['show', { target: `el_tx_step${n}`, effect: 'none' }],
            ['animate', { target: `el_tx_step${n}`, preset: 'pop' }],
            ['animate', { target: `el_tx_snode${n}`, preset: 'bounce' }],
          ],
          stepIs(n),
        ),
      )
      .reverse();
  const reset: Array<[string, Props]> = [
    ['varReset', { variable: 'var_tx_step' }],
    ...stepTexts.map((_, n): [string, Props] => ['hide', { target: `el_tx_step${n}`, effect: 'none' }]),
  ];
  const s3 = page('pg_tx3', 'Step by step', 'base', [
    ...heading(3, 'STEP BY STEP', 'Follow one request'),
    ...nodes.flatMap(([name], i) => [
      el('shape', `el_tx_snode${i}`, `${name} step box`, [nodeX(i), 190, 230, 84], i === 0 ? 'accent' : 'card', { shape: 'rect' }),
      text(
        `el_tx_snodet${i}`,
        `${name} step label`,
        [nodeX(i) + 10, 212, 210, 40],
        'subheading',
        name,
        { size: 22, align: 'center', valign: 'middle' },
        {},
        i === 0 ? { color: '#ffffff' } : undefined,
      ),
      ...(i < nodes.length - 1
        ? [
            el('arrow', `el_tx_sarrow${i}`, `Step arrow ${i + 1}`, [nodeX(i) + 234, 208, 58, 48], 'muted', {
              width: 4,
              start: { x: 0.05, y: 0.5 },
              end: { x: 0.95, y: 0.5 },
            }),
          ]
        : []),
    ]),
    ...stepTexts.map((s, n) =>
      text(`el_tx_step${n}`, `Step ${n + 1} text`, [100, 310 + n * 62, 1080, 50], 'body', s, { size: 22, lineHeight: 1.4 }, { hidden: true }),
    ),
    el(
      'button',
      'el_tx_nextstep',
      'Next step button',
      [80, 624, 210, 52],
      'primary',
      { label: 'Next step', icon: 'plus', size: 18 },
      { interactions: advance('ix_tx_btn') },
    ),
    el(
      'button',
      'el_tx_restart',
      'Restart button',
      [306, 624, 170, 52],
      'secondary',
      { label: 'Restart', icon: 'refresh', iconSide: 'left', size: 18 },
      {
        interactions: [ix('ix_tx_restart', 'click', reset)],
      },
    ),
    text('el_tx_counter', 'Step counter', [500, 634, 300, 34], 'caption', 'Step {Step} of 4 · Space for the next one', { size: 16, valign: 'middle' }),
    ...nav(3),
  ]);
  s3.interactions = [
    ...advance('ix_tx_key').map((x) => ({ ...x, options: { key: 'Space' } })),
    { ...ix('ix_tx_key_r', 'key', reset), options: { key: 'r' } },
    ix('ix_tx_open', 'pageStart', reset),
  ];

  const s4 = page('pg_tx4', 'Conclusion', 'hero', [
    text('el_tx_end_label', 'Section label', [80, 150, 220, 36], 'label', 'IN SHORT', { size: 14, align: 'center', valign: 'middle' }),
    text(
      'el_tx_end_title',
      'Conclusion heading',
      [80, 204, 1100, 80],
      'display',
      'Fast when cached, correct when not',
      { size: 50, lineHeight: 1.1 },
      fadeUp(0),
    ),
    text(
      'el_tx_end_points',
      'Key points',
      [80, 310, 900, 170],
      'displaySub',
      '•  Most requests never reach the API — the edge answers.\n•  The API is the only place that checks permissions.\n•  The database is touched once per uncached request.',
      { size: 22, lineHeight: 1.7 },
      fadeUp(150),
    ),
    el(
      'button',
      'el_tx_docs',
      'Further reading link',
      [80, 540, 250, 56],
      'hero',
      { label: 'Read more', icon: 'arrow-right', size: 18 },
      {
        interactions: [
          ix('ix_tx_docs', 'click', [['openLink', { url: 'https://example.com/docs/requests', newTab: true, label: 'Read more about web requests' }]]),
        ],
      },
    ),
    el('navButton', 'el_tx_again', 'Start over button', [350, 540, 210, 56], 'heroGhost', {
      label: 'Start over',
      icon: 'refresh',
      iconSide: 'left',
      target: 'first',
      size: 18,
    }),
    progress(4, true),
  ]);
  p.pages = [s1, s2, s3, s4];
  return p;
}

// ------------------------------------------------------------ D: Before & after story
export function beforeAfterStory(theme: ThemeId = 'editorial'): Project {
  const p = createProject('page', 'Our homepage, reimagined', theme);
  const { el, text, page } = kit(theme);
  const before = redesignArt(false);
  const after = redesignArt(true);
  p.assets[before.id] = before;
  p.assets[after.id] = after;

  const hero = page(
    'pg_ba1',
    'Hero',
    'hero',
    [
      text('el_ba_label', 'Story label', [380, 120, 240, 38], 'label', 'BEFORE & AFTER', { size: 14, align: 'center', valign: 'middle' }),
      text(
        'el_ba_title',
        'Story Title',
        [100, 180, 800, 140],
        'display',
        'Our homepage, reimagined',
        { size: 70, align: 'center', lineHeight: 1.06 },
        fadeUp(0),
      ),
      text(
        'el_ba_sub',
        'Story summary',
        [170, 346, 660, 90],
        'displaySub',
        'Same content, half the clutter. Drag the slider below to see what changed.',
        { size: 24, align: 'center', lineHeight: 1.45 },
        fadeUp(150),
      ),
      el('navButton', 'el_ba_go', 'See the change button', [390, 466, 220, 58], 'hero', { label: 'See the change', icon: 'chevron-down', size: 18 }),
    ],
    600,
  );

  const slider = page(
    'pg_ba2',
    'Comparison',
    'base',
    [
      text('el_ba_cmp_kicker', 'Comparison label', [100, 56, 800, 30], 'kicker', 'DRAG TO COMPARE', { size: 15, align: 'center' }),
      text('el_ba_cmp_title', 'Comparison heading', [100, 88, 800, 64], 'heading', 'Before and after', { size: 46, align: 'center' }),
      el('beforeAfter', 'el_ba_slider', 'Before & After slider', [100, 180, 800, 533], undefined, {
        before: before.id,
        after: after.id,
        beforeLabel: 'Before',
        afterLabel: 'After',
        position: 50,
      }),
      text('el_ba_cmp_caption', 'Comparison caption', [100, 728, 800, 40], 'caption', 'Left: the old homepage. Right: the redesign that launched in May.', {
        size: 16,
        align: 'center',
      }),
    ],
    800,
  );

  const story = page(
    'pg_ba3',
    'The story',
    'alt',
    [
      text('el_ba_story_kicker', 'Story section label', [60, 70, 400, 30], 'kicker', 'THE STORY', { size: 15 }),
      text('el_ba_story_title', 'Story heading', [60, 104, 420, 130], 'heading', 'Why we started over', { size: 44, lineHeight: 1.1 }),
      text(
        'el_ba_story_body',
        'Main Explanation',
        [60, 250, 400, 220],
        'body',
        'Visitors told us they could not find the sign-up button. Nine menu links, three banners and two sidebars all competed for attention.\n\nScroll the panel on the right for the full story.',
        { size: 19, lineHeight: 1.6 },
      ),
      el('scrollText', 'el_ba_story_scroll', 'Full story (scrolling text)', [500, 70, 440, 420], undefined, {
        title: 'What we changed',
        text: '# One clear message\nThe hero now says what we do in one sentence, with one button.\n\n# Fewer links\nNine menu links became three. Everything else moved to the footer.\n\n# Calmer colours\nA single bright gradient replaces grey boxes and a red warning banner.\n\n# Cards with a purpose\nThree cards answer the three questions visitors ask most:\n- What does it cost?\n- How long does setup take?\n- Can I try it first?\n\n# Tested before launch\nWe tested five versions with **40 visitors** before picking this one.',
        size: 18,
      }),
    ],
    560,
  );

  const results = page(
    'pg_ba4',
    'Results',
    'base',
    [
      text('el_ba_res_kicker', 'Results label', [100, 56, 800, 30], 'kicker', 'THE RESULTS', { size: 15, align: 'center' }),
      text('el_ba_res_title', 'Results heading', [100, 88, 800, 64], 'heading', 'Small changes, big difference', { size: 42, align: 'center' }),
      ...[
        ['+42%', 'more sign-ups'],
        ['−35%', 'fewer support emails'],
        ['2.1s', 'faster to load'],
      ].flatMap(([n, l], i) => [
        text(`el_ba_stat${i}`, `Result ${i + 1} number`, [100 + i * 280, 180, 240, 70], 'heading', n, { size: 54, align: 'center' }, fadeUp(i * 150)),
        text(`el_ba_statl${i}`, `Result ${i + 1} label`, [100 + i * 280, 252, 240, 34], 'caption', l, { size: 18, align: 'center' }, fadeUp(i * 150)),
      ]),
      el('chart', 'el_ba_chart', 'Sign-ups chart', [100, 320, 800, 340], undefined, {
        chartType: 'line',
        title: 'Weekly sign-ups',
        labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
        series: [{ name: 'Sign-ups', values: [120, 118, 126, 122, 160, 171, 178, 174] }],
        showLegend: false,
        preset: 'soft',
      }),
    ],
    720,
  );

  const closing = page(
    'pg_ba5',
    'Closing',
    'hero',
    [
      text(
        'el_ba_quote',
        'Closing quote',
        [120, 90, 760, 150],
        'quote',
        '“It finally feels like it was designed for the people using it.”',
        { size: 38, align: 'center', lineHeight: 1.3 },
        fadeUp(0),
      ),
      text('el_ba_quote_by', 'Quote author', [120, 250, 760, 34], 'displaySub', '— A customer, two weeks after launch', { size: 18, align: 'center' }),
      text(
        'el_ba_summary',
        'Closing summary',
        [170, 310, 660, 90],
        'displaySub',
        'Clear message, fewer choices, faster pages. We will keep testing and improving.',
        { size: 21, align: 'center', lineHeight: 1.5 },
      ),
      el('navButton', 'el_ba_top', 'Back to top button', [400, 420, 200, 54], 'hero', {
        label: 'Back to top',
        icon: 'home',
        iconSide: 'left',
        target: 'first',
        size: 17,
      }),
    ],
    520,
  );
  p.pages = [hero, slider, story, results, closing];
  return p;
}

// ------------------------------------------------------------ E: Event announcement
/** Wall-clock parts of `date` in `tz`. */
function zoned(tz: string, date: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).formatToParts(date);
    const get = (k: string) => parts.find((x) => x.type === k)?.value ?? '';
    return {
      y: Number(get('year')),
      m: Number(get('month')),
      d: Number(get('day')),
      h: Number(get('hour')) % 24,
      min: Number(get('minute')),
      wd: get('weekday'),
    };
  } catch {
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), h: date.getUTCHours(), min: date.getUTCMinutes(), wd: '' };
  }
}

/** The UTC instant of a wall-clock time in `tz` (DST-safe to the minute). */
export function zonedInstant(tz: string, y: number, m: number, d: number, h: number, min = 0): Date {
  let guess = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i++) {
    const z = zoned(tz, new Date(guess));
    const shown = Date.UTC(z.y, z.m - 1, z.d, z.h, z.min);
    guess += Date.UTC(y, m - 1, d, h, min) - shown;
  }
  return new Date(guess);
}

/**
 * The sample event date: a Saturday at noon, three to four weeks after `now`
 * in `tz` — so a template opened any day still counts down to a future date.
 */
export function sampleEventDate(now = Date.now(), tz = localZone()): Date {
  const z = zoned(tz, new Date(now));
  const base = new Date(Date.UTC(z.y, z.m - 1, z.d + 21));
  const add = (6 - base.getUTCDay() + 7) % 7;
  const day = new Date(base.getTime() + add * 86400000);
  return zonedInstant(tz, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 12, 0);
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatEventDate(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true })
      .format(date)
      .replace(' at ', ' · ');
  } catch {
    return date.toUTCString();
  }
}

export function eventAnnouncementTemplate(theme: ThemeId = 'playful', now = Date.now()): Project {
  const p = createProject('page', 'Riverside Summer Picnic', theme);
  const { el, text, page } = kit(theme);
  const gif = confettiGif();
  const pic = picnicArt();
  p.assets[gif.id] = gif;
  p.assets[pic.id] = pic;
  const tz = localZone();
  const date = sampleEventDate(now, tz);
  const rsvp = (id: string, box: Box, role: string) =>
    el(
      'button',
      id,
      'RSVP button',
      box,
      role,
      { label: 'RSVP now', icon: 'arrow-right', size: 19 },
      {
        interactions: [
          ix(`ix_${id}`, 'click', [['openLink', { url: 'mailto:events@example.com?subject=RSVP%20Summer%20Picnic', newTab: true, label: 'Reply by e-mail' }]]),
        ],
      },
    );

  const hero = page(
    'pg_ev1',
    'Invitation',
    'hero',
    [
      text('el_ev_tag', 'Invitation label', [380, 100, 240, 40], 'label', 'YOU’RE INVITED', { size: 14, align: 'center', valign: 'middle' }),
      text('el_ev_title', 'Event Name', [80, 160, 840, 120], 'display', 'Riverside Summer Picnic', { size: 72, align: 'center', lineHeight: 1.05 }, fadeUp(0)),
      text('el_ev_date', 'Event Date', [200, 292, 600, 40], 'displaySub', formatEventDate(date, tz), { size: 24, align: 'center' }, fadeUp(120)),
      text(
        'el_ev_sub',
        'Event description',
        [230, 340, 540, 80],
        'displaySub',
        'Food, games and sunshine by the river — bring your family and your appetite.',
        { size: 21, align: 'center', lineHeight: 1.45 },
        fadeUp(200),
      ),
      rsvp('el_ev_rsvp', [270, 450, 220, 58], 'hero'),
      el('navButton', 'el_ev_more', 'Details button', [510, 450, 220, 58], 'heroGhost', { label: 'See details', icon: 'chevron-down', size: 18 }),
      el('image', 'el_ev_confetti1', 'Confetti (left)', [60, 410, 140, 140], undefined, { assetId: gif.id, alt: '' }, {}, { radius: 75, shadow: 'none' }),
      el('image', 'el_ev_confetti2', 'Confetti (right)', [800, 410, 140, 140], undefined, { assetId: gif.id, alt: '' }, {}, { radius: 75, shadow: 'none' }),
    ],
    600,
  );

  const countdown = page(
    'pg_ev2',
    'Countdown',
    'alt',
    [
      text('el_ev_cd_kicker', 'Countdown label', [200, 60, 600, 30], 'kicker', 'SAVE THE DATE', { size: 15, align: 'center' }),
      text('el_ev_cd_title', 'Countdown heading', [150, 94, 700, 64], 'heading', 'The fun starts in', { size: 46, align: 'center' }),
      el('countdown', 'el_ev_countdown', 'Event Countdown', [150, 180, 700, 190], undefined, {
        target: date.toISOString(),
        timezone: tz,
        repeat: 'none',
        style: 'cards',
        title: '',
        doneText: 'It’s picnic time — see you by the river! 🧺',
      }),
      text(
        'el_ev_cd_note',
        'Countdown note',
        [150, 390, 700, 50],
        'caption',
        'Change the date in the countdown’s Design panel — and update the Event Date text to match.',
        { size: 15, align: 'center', lineHeight: 1.4 },
      ),
    ],
    470,
  );

  const detail = (i: number, title: string, body: string) => {
    const x = 540 + (i % 2) * 220;
    const y = 120 + Math.floor(i / 2) * 200;
    return [
      el('shape', `el_ev_card${i}`, `${title} card`, [x, y, 200, 180], 'card', { shape: 'rect' }, fadeUp(i * 120)),
      text(`el_ev_ct${i}`, `${title} title`, [x + 20, y + 20, 160, 36], 'subheading', title, { size: 22 }, fadeUp(i * 120)),
      text(`el_ev_cb${i}`, `${title} details`, [x + 20, y + 60, 160, 104], 'body', body, { size: 16, lineHeight: 1.45 }, fadeUp(i * 120)),
    ];
  };
  const details = page(
    'pg_ev3',
    'Details',
    'base',
    [
      text('el_ev_d_title', 'Details heading', [60, 50, 440, 60], 'heading', 'The details', { size: 44 }),
      el(
        'image',
        'el_ev_picture',
        'Event Picture',
        [60, 120, 440, 380],
        undefined,
        { assetId: pic.id, alt: 'A sunny riverside park with bunting and a picnic blanket', fit: 'cover' },
        {
          entrance: { preset: 'fadeIn', duration: 900, delay: 0 },
        },
      ),
      ...detail(0, '📍 Where', 'Willow Meadow, by the old boathouse.'),
      ...detail(1, '🕛 When', 'From noon until the sun goes down.'),
      ...detail(2, '🧺 Bring', 'A blanket, a dish to share, sunscreen.'),
      ...detail(3, '🎈 For kids', 'Face painting, sack races and a treasure hunt.'),
    ],
    540,
  );

  const schedule = page(
    'pg_ev4',
    'Schedule',
    'alt',
    [
      text('el_ev_s_title', 'Schedule heading', [150, 56, 700, 64], 'heading', 'Schedule', { size: 46, align: 'center' }),
      el('table', 'el_ev_table', 'Event Schedule', [180, 140, 640, 262], undefined, {
        rows: [
          ['Time', 'What’s happening'],
          ['12:00', 'Welcome & lemonade'],
          ['13:00', 'Picnic lunch'],
          ['14:30', 'Games and treasure hunt'],
          ['17:00', 'Ice cream and goodbyes'],
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

  const footer = page(
    'pg_ev5',
    'RSVP',
    'hero',
    [
      text('el_ev_f_title', 'RSVP heading', [150, 80, 700, 70], 'display', 'Will you join us?', { size: 52, align: 'center' }),
      text('el_ev_f_body', 'RSVP details', [170, 160, 660, 60], 'displaySub', 'Let us know by e-mail so we bring enough food for everyone.', {
        size: 20,
        align: 'center',
        lineHeight: 1.45,
      }),
      rsvp('el_ev_rsvp2', [390, 250, 220, 58], 'hero'),
    ],
    380,
  );
  p.pages = [hero, countdown, details, schedule, footer];
  return p;
}

// ------------------------------------------------------------ F: Interactive greeting
export function interactiveGreeting(theme: ThemeId = 'playful'): Project {
  const p = createProject('slides', 'Happy birthday, Sam!', theme);
  p.settings.transition = 'fade';
  p.variables = [{ id: 'var_gr_wishes', name: 'Wishes', type: 'number', initial: 0 }];
  const { el, text, page, progress } = deck(theme, 'gr');
  const gift = giftArt(false);
  const giftOpen = giftArt(true);
  const balloons = balloonsArt();
  const gif = confettiGif();
  for (const a of [gift, giftOpen, balloons, gif]) p.assets[a.id] = a;

  const open: Array<[string, Props]> = [
    ['animate', { target: 'el_gr_gift', preset: 'shake', wait: true }],
    ['hide', { target: 'el_gr_gift', effect: 'none' }],
    ['hide', { target: 'el_gr_tap', effect: 'fade' }],
    ['show', { target: 'el_gr_gift_open', effect: 'pop' }],
    ['show', { target: 'el_gr_confetti', effect: 'fade' }],
    ['show', { target: 'el_gr_message', effect: 'pop' }],
    ['show', { target: 'el_gr_next', effect: 'fade' }],
  ];
  const s1 = page('pg_gr1', 'Surprise', 'hero', [
    el(
      'image',
      'el_gr_balloons',
      'Balloons',
      [60, 90, 250, 300],
      undefined,
      { assetId: balloons.id, alt: 'Three balloons', fit: 'contain' },
      {
        drag: { mode: 'floaty', amount: 0.6, settle: 0.5 },
        entrance: { preset: 'slideIn', duration: 900, delay: 300, direction: 'up' },
      },
      { shadow: 'none', radius: 0 },
    ),
    text('el_gr_hello', 'Greeting line', [340, 80, 600, 50], 'displaySub', 'Happy birthday,', { size: 32, align: 'center' }, fadeUp(0)),
    text(
      'el_gr_name',
      'Recipient Name',
      [340, 126, 600, 110],
      'display',
      'Sam!',
      { size: 96, align: 'center', lineHeight: 1 },
      {
        entrance: { preset: 'zoomIn', duration: 800, delay: 200 },
      },
    ),
    el(
      'image',
      'el_gr_gift',
      'Present (closed)',
      [530, 290, 220, 220],
      undefined,
      { assetId: gift.id, alt: 'A wrapped present — click to open', fit: 'contain' },
      { entrance: { preset: 'pop', duration: 700, delay: 600 }, interactions: [ix('ix_gr_open', 'click', open)] },
      { shadow: 'none', radius: 0 },
    ),
    el(
      'image',
      'el_gr_gift_open',
      'Present (open)',
      [530, 290, 220, 220],
      undefined,
      { assetId: giftOpen.id, alt: 'The present, opened', fit: 'contain' },
      { hidden: true },
      { shadow: 'none', radius: 0 },
    ),
    text('el_gr_tap', 'Click hint', [490, 530, 300, 40], 'displaySub', 'Click the present 🎁', { size: 22, align: 'center' }, fadeUp(900)),
    el('image', 'el_gr_confetti', 'Confetti', [980, 90, 220, 220], undefined, { assetId: gif.id, alt: '' }, { hidden: true }, { radius: 110, shadow: 'none' }),
    text(
      'el_gr_message',
      'Personal Message',
      [800, 330, 400, 200],
      'label',
      'Wishing you a year full of laughter, adventures and cake. You make every day brighter! 💛',
      { size: 20, padding: 22, lineHeight: 1.55, align: 'left', valign: 'middle', letterSpacing: 0 },
      { hidden: true },
    ),
    el('navButton', 'el_gr_next', 'Next button', [1010, 600, 200, 56], 'hero', { label: 'Make a wish', icon: 'star', size: 18 }, { hidden: true }),
    progress(1, true),
  ]);

  const wishes = ['More adventures', 'Endless cake', 'Great friends'];
  const s2 = page('pg_gr2', 'Three wishes', 'base', [
    text('el_gr_w_title', 'Wishes heading', [140, 60, 1000, 70], 'heading', 'Three wishes for you', { size: 52, align: 'center' }),
    text('el_gr_w_hint', 'Wishes hint', [140, 132, 1000, 36], 'caption', 'Click each star to reveal a wish.', { size: 20, align: 'center' }),
    ...wishes.flatMap((w, i) => {
      const x = 170 + i * 340;
      return [
        el(
          'shape',
          `el_gr_star${i}`,
          `Star ${i + 1}`,
          [x, 210, 260, 250],
          `tone${i}`,
          { shape: 'star' },
          {
            entrance: { preset: 'zoomIn', duration: 700, delay: 200 + i * 200 },
            interactions: [
              ix(`ix_gr_star${i}`, 'click', [
                ['hide', { target: '@self', effect: 'pop' }],
                ['varAdd', { variable: 'var_gr_wishes', amount: 1 }],
                ['show', { target: `el_gr_wish${i}`, effect: 'pop' }],
              ]),
              ix(
                `ix_gr_star${i}_all`,
                'click',
                [
                  ['show', { target: 'el_gr_w_done', effect: 'pop' }],
                  ['show', { target: 'el_gr_w_confetti', effect: 'fade' }],
                  ['show', { target: 'el_gr_w_next', effect: 'fade' }],
                ],
                [{ id: `cd_gr_all${i}`, type: 'variable', variableId: 'var_gr_wishes', op: 'gte', value: 3 }],
              ),
            ],
          },
        ),
        text(`el_gr_wish${i}`, `Wish ${i + 1}`, [x, 280, 260, 110], 'subheading', w, { size: 30, align: 'center', valign: 'middle' }, { hidden: true }),
      ];
    }),
    text('el_gr_w_count', 'Wish counter', [440, 490, 400, 36], 'caption', '{Wishes} of 3 wishes revealed', { size: 18, align: 'center' }),
    text(
      'el_gr_w_done',
      'All wishes message',
      [340, 540, 600, 60],
      'heading',
      'All your wishes are on their way! ✨',
      { size: 30, align: 'center' },
      { hidden: true },
    ),
    el(
      'image',
      'el_gr_w_confetti',
      'Confetti',
      [40, 440, 200, 200],
      undefined,
      { assetId: gif.id, alt: '' },
      { hidden: true },
      { radius: 100, shadow: 'none' },
    ),
    el(
      'navButton',
      'el_gr_w_next',
      'Next button',
      [1010, 620, 200, 56],
      'primary',
      { label: 'One more thing', icon: 'arrow-right', size: 17 },
      { hidden: true },
    ),
    progress(2),
  ]);
  s2.interactions = [ix('ix_gr_w_open', 'pageStart', [['varReset', { variable: 'var_gr_wishes' }]])];

  const s3 = page('pg_gr3', 'With love', 'hero', [
    text(
      'el_gr_end_title',
      'Closing message',
      [140, 190, 1000, 120],
      'display',
      'Have the best day ever!',
      { size: 76, align: 'center' },
      {
        entrance: { preset: 'zoomIn', duration: 800, delay: 0 },
      },
    ),
    text(
      'el_gr_from',
      'Signed by',
      [240, 330, 800, 50],
      'displaySub',
      'With love from Alex, Priya, Jordan and everyone at the studio',
      { size: 24, align: 'center' },
      fadeUp(300),
    ),
    el(
      'shape',
      'el_gr_heart',
      'Heart',
      [580, 410, 120, 110],
      'tone1',
      { shape: 'heart' },
      {
        entrance: { preset: 'pop', duration: 700, delay: 600 },
        interactions: [ix('ix_gr_heart', 'click', [['animate', { target: '@self', preset: 'pulse' }]])],
      },
    ),
    el('navButton', 'el_gr_again', 'Watch again button', [530, 580, 220, 56], 'heroGhost', {
      label: 'Watch again',
      icon: 'refresh',
      iconSide: 'left',
      target: 'first',
      size: 18,
    }),
    progress(3, true),
  ]);
  p.pages = [s1, s2, s3];
  return p;
}

/** Elements by id, for guides and tests. */
export function findElement(project: Project, id: string): { el: SceneElement; page: Page } | null {
  for (const page of project.pages) for (const el of page.elements) if (el.id === id) return { el, page };
  return null;
}
