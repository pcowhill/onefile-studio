import type { BrowserContext, CDPSession, Locator, Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Real-time capture of a Playwright page with the Chrome DevTools screencast.
 *
 * Chromium sends a JPEG whenever the page repaints, with the wall-clock time it
 * was drawn. We store every frame plus its timestamp; the compositor later
 * picks "the newest frame at or before time t", so the footage keeps real
 * timing (animations, transitions, typing) without needing a fixed frame rate.
 * Scripts also drop named marks ("click-puff") so storyboards can cut to the
 * interesting moments without hard-coding seconds.
 */

export interface Manifest {
  scene: string;
  width: number;
  height: number;
  /** Seconds from the start of the recording. */
  frames: Array<{ t: number; file: string }>;
  marks: Record<string, number>;
  /** Length of the recording in seconds. */
  duration: number;
}

export const VIEWPORT = { width: 1440, height: 810 };
/** 1440×810 CSS px at 4/3 = 1920×1080 device px: crisp 1080p frames, UI at a readable size. */
export const SCALE = 4 / 3;

export class Recorder {
  private cdp: CDPSession | null = null;
  private start = 0;
  private n = 0;
  private writes: Promise<void>[] = [];
  readonly manifest: Manifest;
  readonly page: Page;
  readonly dir: string;

  constructor(page: Page, dir: string, scene: string) {
    this.page = page;
    this.dir = dir;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    this.manifest = { scene, width: Math.round(VIEWPORT.width * SCALE), height: Math.round(VIEWPORT.height * SCALE), frames: [], marks: {}, duration: 0 };
  }

  /** In virtual-time recordings, the page clock (seconds) replaces the wall clock. */
  clock: (() => number) | null = null;

  /** Seconds since recording started. */
  now() {
    return this.clock ? this.clock() : (Date.now() - this.start) / 1000;
  }

  /**
   * Virtual-time recording (for pages too heavy to record in real time, like
   * software-rendered WebGL): no screencast; the scene advances the page clock
   * one frame at a time and calls snap() for every frame.
   */
  beginManual(clock: () => number) {
    this.clock = clock;
    this.start = Date.now();
  }

  async snap() {
    const file = `f${String(this.n++).padStart(5, '0')}.jpg`;
    this.manifest.frames.push({ t: this.now(), file });
    const jpg = await this.page.screenshot({ type: 'jpeg', quality: 92 });
    this.writes.push(fs.promises.writeFile(path.join(this.dir, file), jpg));
  }

  async begin() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.start = Date.now();
    this.cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      const t = f.metadata.timestamp ? f.metadata.timestamp - this.start / 1000 : this.now();
      const file = `f${String(this.n++).padStart(5, '0')}.jpg`;
      this.manifest.frames.push({ t: Math.max(0, t), file });
      this.writes.push(fs.promises.writeFile(path.join(this.dir, file), Buffer.from(f.data, 'base64')));
      void this.cdp?.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
    });
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: this.manifest.width,
      maxHeight: this.manifest.height,
      everyNthFrame: 1,
    });
  }

  mark(name: string) {
    this.manifest.marks[name] = this.now();
  }

  async end() {
    this.manifest.duration = this.now();
    await this.cdp?.send('Page.stopScreencast').catch(() => undefined);
    await Promise.all(this.writes);
    this.manifest.frames.sort((a, b) => a.t - b.t);
    fs.writeFileSync(path.join(this.dir, 'manifest.json'), JSON.stringify(this.manifest, null, 1));
    return this.manifest;
  }
}

/**
 * A visible pointer for the recordings (headless browsers draw none). It is a
 * fixed, `pointer-events: none` element outside <body> that follows the real
 * mouse events Playwright sends, with a soft ring on every press — so viewers
 * see exactly where the scripted user clicked.
 */
export const CURSOR_SCRIPT = `(() => {
  if (window.__ofsCursor) return; window.__ofsCursor = true;
  const install = () => {
    const root = document.documentElement;
    const c = document.createElement('div');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);transition:opacity .2s;will-change:transform';
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 30 30" style="overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M4 2.5l18.5 13.2-8.6 1.4 5.2 9.3-3.6 2-5.2-9.4-6.3 5.9z" fill="#1d1145" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    root.appendChild(c);
    let x = -200, y = -200;
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; c.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 2) + 'px)'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;left:' + (e.clientX - 22) + 'px;top:' + (e.clientY - 22) + 'px;width:44px;height:44px;border-radius:50%;border:3px solid #6d4aff;background:rgba(109,74,255,.18);transform:scale(.3);opacity:1;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .5s';
      root.appendChild(r);
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = 'scale(1.25)'; r.style.opacity = '0'; }));
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.documentElement) install(); else addEventListener('DOMContentLoaded', install);
})();`;

export async function prepareContext(context: BrowserContext) {
  await context.addInitScript(CURSOR_SCRIPT);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Human-looking pointer: eased movement, small pauses, real mouse events. */
export class Hand {
  x = 720;
  y = 600;
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  /** Length of one pointer-movement step. */
  protected stepMs = 16;
  /** Lets time pass for one movement step (real time here; one video frame in VirtualHand). */
  protected async step(ms: number) {
    await sleep(ms);
  }

  async moveTo(x: number, y: number, ms?: number) {
    const dist = Math.hypot(x - this.x, y - this.y);
    const dur = ms ?? Math.min(900, 260 + dist * 0.6);
    const steps = Math.max(2, Math.round(dur / this.stepMs));
    const x0 = this.x;
    const y0 = this.y;
    // A gentle arc instead of a ruler-straight line.
    const bend = Math.min(60, dist * 0.12);
    const nx = -(y - y0) / (dist || 1);
    const ny = (x - x0) / (dist || 1);
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      const arc = Math.sin(Math.PI * k) * bend;
      await this.page.mouse.move(x0 + (x - x0) * k + nx * arc, y0 + (y - y0) * k + ny * arc);
      await this.step(dur / steps);
    }
    this.x = x;
    this.y = y;
  }

  async center(target: Locator, dx = 0.5, dy = 0.5) {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    const b = await target.boundingBox();
    if (!b) throw new Error('target has no box');
    return { x: b.x + b.width * dx, y: b.y + b.height * dy };
  }

  async to(target: Locator, dx = 0.5, dy = 0.5, ms?: number) {
    const p = await this.center(target, dx, dy);
    await this.moveTo(p.x, p.y, ms);
  }

  async click(target?: Locator, opts: { dx?: number; dy?: number; button?: 'left' | 'right'; settle?: number; double?: boolean } = {}) {
    if (target) await this.to(target, opts.dx, opts.dy);
    await this.wait(110);
    if (opts.double) {
      await this.page.mouse.dblclick(this.x, this.y, { delay: 40 });
    } else {
      await this.page.mouse.down({ button: opts.button ?? 'left' });
      await this.wait(70);
      await this.page.mouse.up({ button: opts.button ?? 'left' });
    }
    await this.wait(opts.settle ?? 350);
  }

  async drag(from: { x: number; y: number }, to: { x: number; y: number }, ms = 900) {
    await this.moveTo(from.x, from.y);
    await this.wait(120);
    await this.page.mouse.down();
    await this.wait(80);
    await this.moveTo(to.x, to.y, ms);
    await this.wait(80);
    await this.page.mouse.up();
  }

  async type(text: string, delay = 70) {
    await this.page.keyboard.type(text, { delay });
  }

  async press(key: string, settle = 300) {
    await this.page.keyboard.press(key);
    await this.wait(settle);
  }

  async wait(ms: number) {
    await sleep(ms);
  }

  /** Moves the pointer out of the way (bottom-right) so it doesn't cover content. */
  async park(ms = 500) {
    await this.moveTo(VIEWPORT.width - 40, VIEWPORT.height - 30, ms);
  }
}

/**
 * A hand for virtual-time recordings: the page clock (page.clock.install())
 * only moves when we advance it, one 1/30 s frame at a time, and every frame
 * is screenshotted. Smooth 30 fps footage however slow the page renders.
 */
export class VirtualHand extends Hand {
  t = 0;
  readonly rec: Recorder;
  readonly fps = 30;
  constructor(page: Page, rec: Recorder) {
    super(page);
    this.rec = rec;
    this.stepMs = 1000 / this.fps;
    rec.beginManual(() => this.t);
  }
  async tick() {
    await this.page.clock.runFor(1000 / this.fps);
    this.t += 1 / this.fps;
    await this.rec.snap();
  }
  protected override async step() {
    await this.tick();
  }
  override async wait(ms: number) {
    const n = Math.max(1, Math.round((ms / 1000) * this.fps));
    for (let i = 0; i < n; i++) await this.tick();
  }
  override async type(text: string) {
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await this.tick();
      await this.tick();
    }
  }
}
