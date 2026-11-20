import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from 'playwright';
import { Recorder, VirtualHand } from '../lib/recorder.ts';
import type { Hand } from '../lib/recorder.ts';
import type { SceneContext } from './types.ts';

/**
 * Footage for the six showcase clips. Each showcase has two recordings:
 *   <id>-play  the exported OneFile opened from disk in an offline browser
 *   <id>-edit  the same project opened in the editor ("Open in editor"),
 *              showing how one of its interactions is made
 */

const el = (page: Page, id: string) => page.locator(`.ofs-el[data-id="${id}"]`);
const edEl = (page: Page, id: string) => page.locator(`.ed-el[data-id="${id}"]`);

/**
 * Recordings start on a Tuesday afternoon (the clock then runs normally), so
 * the event's weekly "next Friday" countdown is genuinely ticking in the
 * footage whatever day the videos are regenerated.
 */
export async function pinClock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-17T14:12:20Z') });
  await page.clock.resume();
}

/** Opens dist-site/showcase/<id>.html from disk (file://) with the network switched off. */
export async function openPlay(ctx: SceneContext, id: string) {
  const { page, context } = await ctx.newPage({ offline: true });
  await pinClock(page);
  await page.goto(pathToFileURL(path.join(ctx.siteDir, 'showcase', `${id}.html`)).href);
  await page.waitForFunction(() => !!(window as unknown as { __ofs?: unknown }).__ofs);
  await page.waitForTimeout(400);
  return { page, context };
}

/** Opens the editor on an independent copy of a showcase, exactly like the landing page link. */
export async function openEdit(ctx: SceneContext, id: string) {
  const { page, context } = await ctx.newPage();
  await pinClock(page);
  await page.goto(`${ctx.site}studio/?open=${id}`);
  await page.locator('.ed-el').first().waitFor();
  // The "Opened your own copy" toast would cover the canvas in the recording.
  await page.locator('.ed-toast-close').first().click({ timeout: 2000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  return { page, context };
}

/** Selects an element on the canvas and opens one of the inspector tabs. */
async function inspect(hand: Hand, page: Page, id: string, tab: 'behavior' | 'design', rec: Recorder) {
  await hand.click(edEl(page, id), { settle: 500 });
  rec.mark('selected');
  await hand.click(page.getByTestId(`tab-${tab}`), { settle: 900 });
  rec.mark('inspector');
}

export async function feedPuffPlay(ctx: SceneContext) {
  const { page, context } = await openPlay(ctx, 'feed-puff');
  const { rec, hand } = await ctx.record(page, 'feed-puff-play');
  await hand.moveTo(1100, 700, 300);
  await hand.wait(1600);
  rec.mark('intro');
  const puff = el(page, 'el_c_puff');
  for (let i = 0; i < 6; i++) await hand.click(puff, { dx: 0.45 + (i % 3) * 0.05, dy: 0.5, settle: 260 });
  rec.mark('clicks');
  for (let i = 0; i < 9; i++) await hand.click(puff, { dx: 0.5, dy: 0.55, button: 'right', settle: 330 });
  rec.mark('mega');
  await hand.wait(2200);
  rec.mark('win');
  await rec.end();
  await context.close();
}

export async function feedPuffEdit(ctx: SceneContext) {
  const { page, context } = await openEdit(ctx, 'feed-puff');
  const { rec, hand } = await ctx.record(page, 'feed-puff-edit');
  await hand.wait(800);
  rec.mark('editor');
  await inspect(hand, page, 'el_c_puff', 'behavior', rec);
  await hand.to(page.locator('[data-testid=interaction]').first(), 0.6, 0.3, 700);
  await hand.wait(1800);
  rec.mark('end');
  await rec.end();
  await context.close();
}

/** Smooth wheel scrolling with the pointer at (x, y). */
async function scrollBy(page: Page, hand: Hand, dy: number, ms = 1200) {
  const steps = Math.max(1, Math.round(ms / 16));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await hand.wait(ms / steps);
  }
}

/** Shows how a slide's own interactions (keys, "slide opens") are made: pick the slide, nothing selected, Behavior. */
async function slideBehavior(hand: Hand, page: Page, slideName: string, rec: Recorder) {
  await hand.click(page.locator('.ed-page-btn').and(page.getByRole('button', { name: slideName, exact: true })), { settle: 700 });
  rec.mark('slide');
  await hand.click(page.getByTestId('tab-behavior'), { settle: 900 });
  rec.mark('inspector');
}

// ---------------------------------------------------------------- Before & After
export async function beforeAfterPlay(ctx: SceneContext) {
  const { page, context } = await openPlay(ctx, 'before-after');
  const { rec, hand } = await ctx.record(page, 'before-after-play');
  await hand.moveTo(980, 640, 300);
  await hand.wait(1500);
  rec.mark('intro');
  await hand.click(page.getByText('See the change'), { settle: 1500 });
  rec.mark('compare');
  const ba = el(page, 'el_b_compare');
  const box = (await ba.boundingBox())!;
  const y = box.y + box.height * 0.55;
  await hand.drag({ x: box.x + box.width * 0.45, y }, { x: box.x + box.width * 0.86, y }, 1300);
  rec.mark('right');
  await hand.drag({ x: box.x + box.width * 0.86, y }, { x: box.x + box.width * 0.12, y }, 1700);
  rec.mark('left');
  await hand.drag({ x: box.x + box.width * 0.12, y }, { x: box.x + box.width * 0.55, y }, 1100);
  rec.mark('dragged');
  await hand.moveTo(box.x + box.width + 120, y, 400);
  await scrollBy(page, hand, 760, 1400);
  await hand.wait(500);
  rec.mark('story');
  const journal = el(page, 'el_b_journal');
  await hand.to(journal, 0.5, 0.6);
  await scrollBy(page, hand, 360, 1500);
  rec.mark('journal');
  await hand.wait(700);
  await rec.end();
  await context.close();
}

export async function beforeAfterEdit(ctx: SceneContext) {
  const { page, context } = await openEdit(ctx, 'before-after');
  const { rec, hand } = await ctx.record(page, 'before-after-edit');
  await hand.wait(700);
  rec.mark('editor');
  await hand.click(page.getByRole('button', { name: 'Compare', exact: true }), { settle: 900 });
  await inspect(hand, page, 'el_b_compare', 'design', rec);
  await hand.to(page.locator('.ed-inspector-body').first(), 0.5, 0.3, 700);
  await hand.wait(1600);
  rec.mark('end');
  await rec.end();
  await context.close();
}

// ---------------------------------------------------------------- 3D explorer
/**
 * Recorded in virtual time: software WebGL renders far below real time, so the
 * page clock is advanced one frame at a time and each frame is captured.
 */
export async function explorerPlay(ctx: SceneContext) {
  const { page, context } = await ctx.newPage({ offline: true });
  await page.clock.install();
  await page.goto(pathToFileURL(path.join(ctx.siteDir, 'showcase', '3d-explorer.html')).href);
  const viewer = el(page, 'el_m_viewer');
  // Let the runtime start and the model load (real async work + a little page time).
  for (let i = 0; i < 60; i++) {
    await page.clock.runFor(100);
    await page.waitForTimeout(100);
    if (await viewer.locator('canvas').count()) break;
  }
  for (let i = 0; i < 20; i++) {
    await page.clock.runFor(100);
    await page.waitForTimeout(100);
  }
  const rec = new Recorder(page, path.join(ctx.downloads, '..', 'captures', '3d-explorer-play'), '3d-explorer-play');
  const hand = new VirtualHand(page, rec);
  await hand.moveTo(1040, 700, 300);
  await hand.wait(1200);
  rec.mark('intro');
  const vb = (await viewer.boundingBox())!;
  const cx = vb.x + vb.width * 0.5;
  const cy = vb.y + vb.height * 0.5;
  await hand.drag({ x: cx - 140, y: cy }, { x: cx + 230, y: cy - 30 }, 1800);
  rec.mark('rotated');
  await hand.wait(900);
  await hand.click(page.getByRole('button', { name: 'Mast camera', exact: true }), { settle: 2200 });
  rec.mark('mast');
  await hand.click(page.getByRole('button', { name: 'Wheels', exact: true }), { settle: 2200 });
  rec.mark('wheels');
  await hand.click(el(page, 'el_m_reset'), { settle: 2000 });
  rec.mark('reset');
  await rec.end();
  await context.close();
}

export async function explorerEdit(ctx: SceneContext) {
  const { page, context } = await openEdit(ctx, '3d-explorer');
  const { rec, hand } = await ctx.record(page, '3d-explorer-edit');
  await hand.wait(900);
  rec.mark('editor');
  await inspect(hand, page, 'el_m_btn_mast', 'behavior', rec);
  await hand.to(page.locator('[data-testid=interaction]').first(), 0.6, 0.5, 700);
  await hand.wait(1700);
  rec.mark('end');
  await rec.end();
  await context.close();
}

// ---------------------------------------------------------------- Technical explainer
export async function explainerPlay(ctx: SceneContext) {
  const { page, context } = await openPlay(ctx, 'tech-explainer');
  const { rec, hand } = await ctx.record(page, 'tech-explainer-play');
  await hand.moveTo(1000, 640, 300);
  await hand.wait(1300);
  rec.mark('intro');
  await hand.click(el(page, 'el_x_start'), { settle: 1300 });
  rec.mark('diagram');
  await hand.park(400);
  for (let i = 0; i < 4; i++) {
    await hand.press(i % 2 ? 'Space' : 'ArrowRight', 1000);
  }
  rec.mark('stepped');
  await hand.click(el(page, 'el_x_node2'), { settle: 1300 });
  rec.mark('note');
  const pk = el(page, 'el_x_packet');
  const pb = (await pk.boundingBox())!;
  await hand.drag({ x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 }, { x: pb.x + 620, y: pb.y - 40 }, 1300);
  await hand.wait(1100);
  rec.mark('dragged');
  await hand.click(el(page, 'el_x_next2'), { settle: 1300 });
  rec.mark('notes');
  await hand.park(300);
  await hand.press('1', 1200);
  await hand.press('2', 1200);
  rec.mark('keys');
  const st = el(page, 'el_x_sticky2');
  const sbx = (await st.boundingBox())!;
  await hand.drag({ x: sbx.x + sbx.width * 0.3, y: sbx.y + sbx.height * 0.3 }, { x: sbx.x + 300, y: sbx.y - 120 }, 1100);
  await hand.wait(1300);
  rec.mark('sticky');
  await rec.end();
  await context.close();
}

export async function explainerEdit(ctx: SceneContext) {
  const { page, context } = await openEdit(ctx, 'tech-explainer');
  const { rec, hand } = await ctx.record(page, 'tech-explainer-edit');
  await hand.wait(700);
  rec.mark('editor');
  await slideBehavior(hand, page, 'The pipeline', rec);
  await hand.to(page.locator('[data-testid=interaction]').nth(1), 0.6, 0.5, 700);
  await hand.wait(1700);
  rec.mark('end');
  await rec.end();
  await context.close();
}

// ---------------------------------------------------------------- Feature walkthrough
export async function releasePlay(ctx: SceneContext) {
  const { page, context } = await openPlay(ctx, 'feature-walkthrough');
  const { rec, hand } = await ctx.record(page, 'feature-walkthrough-play');
  await hand.moveTo(1000, 640, 300);
  await hand.wait(1300);
  rec.mark('intro');
  await hand.click(el(page, 'el_r_start'), { settle: 3200 });
  rec.mark('video');
  await hand.click(el(page, 'el_r_next2'), { settle: 1400 });
  rec.mark('chart');
  // Hover the real bars: each shows its exact value in a tooltip.
  const bars = el(page, 'el_r_chart').locator('.ofs-chart-bar');
  for (const i of [4, 5, 6, 7]) {
    await hand.to(bars.nth(i), 0.5, 0.35, 450);
    await hand.wait(650);
  }
  rec.mark('hover');
  await hand.click(el(page, 'el_r_next3'), { settle: 1300 });
  rec.mark('table');
  const header = el(page, 'el_r_table').locator('th').nth(1);
  await hand.click(header, { settle: 1100 });
  await hand.click(header, { settle: 1100 });
  rec.mark('sorted');
  await hand.click(el(page, 'el_r_next4'), { settle: 1200 });
  rec.mark('cards');
  await hand.click(el(page, 'el_r_cardbtn1'), { settle: 1300 });
  rec.mark('detail');
  await rec.end();
  await context.close();
}

export async function releaseEdit(ctx: SceneContext) {
  const { page, context } = await openEdit(ctx, 'feature-walkthrough');
  const { rec, hand } = await ctx.record(page, 'feature-walkthrough-edit');
  await hand.wait(700);
  rec.mark('editor');
  await hand.click(page.getByRole('button', { name: 'Performance', exact: true }), { settle: 900 });
  await inspect(hand, page, 'el_r_chart', 'design', rec);
  await hand.to(page.locator('.ed-inspector-body').first(), 0.5, 0.35, 700);
  await hand.wait(1700);
  rec.mark('end');
  await rec.end();
  await context.close();
}

// ---------------------------------------------------------------- Event announcement
export async function eventPlay(ctx: SceneContext) {
  const { page, context } = await openPlay(ctx, 'event');
  const { rec, hand } = await ctx.record(page, 'event-play');
  await hand.moveTo(1000, 650, 300);
  await hand.wait(1500);
  rec.mark('intro');
  await hand.click(page.getByText('Count me in'), { settle: 3200 });
  rec.mark('countdown');
  await hand.moveTo(1300, 500, 400);
  await scrollBy(page, hand, 700, 1500);
  await hand.wait(900);
  rec.mark('details');
  await scrollBy(page, hand, 900, 1700);
  await hand.wait(900);
  rec.mark('roof');
  await scrollBy(page, hand, 1400, 1800);
  await hand.wait(600);
  rec.mark('end-scroll');
  await hand.click(el(page, 'el_e_rsvp'), { settle: 1600 });
  rec.mark('rsvp');
  await rec.end();
  await context.close();
}

export async function eventEdit(ctx: SceneContext) {
  const { page, context } = await openEdit(ctx, 'event');
  const { rec, hand } = await ctx.record(page, 'event-edit');
  await hand.wait(700);
  rec.mark('editor');
  await hand.click(page.getByRole('button', { name: 'Countdown', exact: true }), { settle: 900 });
  await inspect(hand, page, 'el_e_countdown', 'design', rec);
  await hand.to(page.locator('.ed-inspector-body').first(), 0.5, 0.35, 700);
  await hand.wait(1700);
  rec.mark('end');
  await rec.end();
  await context.close();
}
