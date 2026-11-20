import type { ShowcaseMeta } from '../../src/showcase/meta';

/**
 * Static markup of the "Made with OneFile Studio" cards, generated at build
 * time from the showcase registry (vite.site.config.ts injects it where
 * index.html says `<!-- @showcase-cards -->`), so the gallery works without
 * JavaScript and can never list a showcase that does not exist.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function showcaseCard(s: ShowcaseMeta): string {
  const format = s.format === 'slides' ? 'Slides' : 'Webpage';
  return `<article class="sc-card reveal" id="sc-${s.id}" style="--accent:${esc(s.accent)}" data-showcase="${s.id}">
  <div class="sc-media">
    <video class="sc-video" muted playsinline loop preload="none" width="1280" height="720"
      poster="media/showcase/${s.id}.webp" data-src="media/showcase/${s.id}.mp4"
      aria-label="Demo clip of ${esc(s.title)}: the finished project, a glimpse of the editor and the project responding"></video>
    <button class="sc-play" type="button" aria-pressed="false" aria-label="Play the ${esc(s.title)} demo clip">
      <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>
      <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>
    </button>
    <span class="sc-format">${format}</span>
  </div>
  <div class="sc-body">
    <p class="sc-kind">${esc(s.kind)}</p>
    <h3>${esc(s.title)}</h3>
    <p class="sc-desc">${esc(s.description)}</p>
    <ul class="sc-chips" aria-label="What it shows">${s.chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <div class="sc-actions">
      <a class="btn btn-accent" href="#try/${s.id}" data-try="${s.id}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>Try it
      </a>
      <a class="btn btn-quiet" href="studio/?open=${s.id}" data-open="${s.id}">Open in editor
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </div>
  </div>
</article>`;
}

export function showcaseCards(list: ShowcaseMeta[]): string {
  return list.map(showcaseCard).join('\n');
}
