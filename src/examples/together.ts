import type { Action, Interaction, Project, SceneElement } from '../model/types';
import { createElement, createProject } from '../model/factory';
import { linear } from '../model/paint';

/**
 * "Three shapes, together" (v0.7): the smallest demonstration of Together steps.
 *
 *   When "Reveal" is clicked
 *     1. Together: pop Circle, pop Star, pop Heart   (start at the same time)
 *     2. Then: wait 0.5 seconds                       (after all three finish)
 *     3. Then: fade in "All together!"
 *
 * "Start over" hides all four at once — another Together group.
 */
export function threeShapes(): Project {
  const p = createProject('slides', 'Three shapes, together');
  p.id = 'prj_example_together';
  const slide = p.pages[0];
  slide.id = 'pg_together';
  slide.name = 'Together';
  slide.background = { paint: linear('#fdfbff', '#efe9ff', 160) };

  const el = (
    type: string,
    id: string,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    props: Record<string, unknown>,
    extra: Partial<SceneElement> = {},
  ) => createElement(type, { id, name, x, y, w, h, props, ...extra });
  const shape = (id: string, name: string, x: number, kind: string, from: string, to: string) =>
    el('shape', id, name, x, 250, 200, 200, { shape: kind, fill: linear(from, to, 135), shadow: 'lifted', radius: 24 }, { hidden: true });
  const act = (id: string, type: string, params: Action['params'], together = false): Action => ({ id, type, params, ...(together ? { together: true } : {}) });
  const click = (id: string, actions: Action[]): Interaction => ({ id, trigger: 'click', conditions: [], actions });

  slide.elements = [
    el('text', 'el_tg_title', 'Title', 140, 60, 1000, 80, { text: 'Three shapes, together', size: 52, weight: 900, color: '#2a1d6b', align: 'center' }),
    el('text', 'el_tg_sub', 'Subtitle', 190, 140, 900, 60, {
      text: 'One click pops all three at the same time — then, after they finish, the label appears.',
      size: 22,
      weight: 600,
      color: '#5d5684',
      align: 'center',
    }),
    shape('el_tg_circle', 'Circle', 250, 'ellipse', '#ff9a8b', '#ff4d8d'),
    shape('el_tg_star', 'Star', 540, 'star', '#ffd86b', '#ff9f1c'),
    shape('el_tg_heart', 'Heart', 830, 'heart', '#7ef0c1', '#12a36f'),
    el(
      'text',
      'el_tg_done',
      'Label',
      440,
      480,
      400,
      64,
      { text: 'All together!', size: 30, weight: 900, color: '#ffffff', background: '#6d4aff', radius: 32, align: 'center', valign: 'middle' },
      { hidden: true },
    ),
    el(
      'button',
      'el_tg_reveal',
      'Reveal button',
      430,
      590,
      200,
      64,
      { label: 'Reveal', icon: 'star', iconSide: 'left', color: '#6d4aff' },
      {
        interactions: [
          click('ix_tg_reveal', [
            act('ac_tg_pop1', 'show', { target: 'el_tg_circle', effect: 'pop' }),
            act('ac_tg_pop2', 'show', { target: 'el_tg_star', effect: 'pop' }, true),
            act('ac_tg_pop3', 'show', { target: 'el_tg_heart', effect: 'pop' }, true),
            act('ac_tg_wait', 'wait', { seconds: 0.5 }),
            act('ac_tg_label', 'show', { target: 'el_tg_done', effect: 'fade' }),
          ]),
        ],
      },
    ),
    el(
      'button',
      'el_tg_reset',
      'Start over button',
      650,
      590,
      200,
      64,
      { label: 'Start over', variant: 'soft', icon: 'refresh', iconSide: 'left', color: '#6d4aff' },
      {
        interactions: [
          click('ix_tg_reset', [
            act('ac_tg_hide1', 'hide', { target: 'el_tg_circle', effect: 'none' }),
            act('ac_tg_hide2', 'hide', { target: 'el_tg_star', effect: 'none' }, true),
            act('ac_tg_hide3', 'hide', { target: 'el_tg_heart', effect: 'none' }, true),
            act('ac_tg_hide4', 'hide', { target: 'el_tg_done', effect: 'none' }, true),
          ]),
        ],
      },
    ),
  ];
  p.settings.backdrop = '#1b1834';
  delete p.settings.backdropThemed;
  return p;
}
