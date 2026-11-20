import type { Browser, BrowserContext, Page } from 'playwright';
import type { Hand, Recorder } from '../lib/recorder.ts';

export interface SceneContext {
  browser: Browser;
  /** Base URL of the built site (dist-site/): `${site}studio/`, `${site}showcase/x.html`. */
  site: string;
  /** Absolute path of dist-site/ (exported showcases are opened from disk via file://). */
  siteDir: string;
  /** Where downloads (exports) are saved. */
  downloads: string;
  /** Opens a new recording page (1440×810 at 4/3 → 1920×1080 frames) with the cursor overlay. */
  newPage(opts?: { offline?: boolean; cursor?: boolean }): Promise<{ page: Page; context: BrowserContext }>;
  /** Starts recording `page` into captures/<name>/; returns the recorder and a hand that drives the pointer. */
  record(page: Page, name: string): Promise<{ rec: Recorder; hand: Hand }>;
}

export type Scene = (ctx: SceneContext) => Promise<void>;
