import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { SceneContext } from './types.ts';
import { pinClock } from './showcases.ts';

/**
 * Thumbnails of the real templates for the landing page: each template is
 * played in the template gallery's own Preview, its first slide/section is
 * screenshotted and written to site/public/media/templates/<id>.webp (640×360).
 */
export const TEMPLATE_THUMBS = ['feature-walkthrough', 'meeting', 'before-after', 'event', 'greeting'];

export async function templateThumbs(ctx: SceneContext) {
  const out = path.resolve(ctx.siteDir, '..', 'site', 'public', 'media', 'templates');
  fs.mkdirSync(out, { recursive: true });
  const { page, context } = await ctx.newPage({ cursor: false });
  await pinClock(page);
  for (const id of TEMPLATE_THUMBS) {
    await page.goto(`${ctx.site}studio/?panel=templates`);
    await page.getByTestId(`template-${id}`).getByRole('button', { name: /^Preview/ }).first().click();
    const stage = page.locator('.ed-preview-stage');
    await stage.locator('.ofs-el').first().waitFor();
    await page.mouse.move(5, 400);
    await page.waitForTimeout(2600); // entrance animations
    const slide = stage.locator('.ofs-slide').first();
    const png = path.join(ctx.downloads, `tpl-${id}.png`);
    if (await slide.count()) {
      await slide.screenshot({ path: png });
    } else {
      const b = (await stage.boundingBox())!;
      const h = Math.min(b.height, (b.width * 9) / 16);
      await page.screenshot({ path: png, clip: { x: b.x, y: b.y, width: (h * 16) / 9, height: h } });
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=640:360:force_original_aspect_ratio=increase,crop=640:360', '-c:v', 'libwebp', '-quality', '84', path.join(out, `${id}.webp`)]);
  }
  await context.close();
}
