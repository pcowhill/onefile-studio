/**
 * Editor entry links (v0.6). The public site links into the editor with a few
 * query parameters; they are read once at startup:
 *
 * - `?open=<showcase id>` — open an independent, editable copy of a showcase
 *   project. The parameter is then removed from the address (replaceState), so
 *   a refresh keeps editing that copy instead of making another one.
 * - `?panel=templates` / `?panel=learn` — the start screen with the template
 *   gallery or the Learn hub open (the address is kept: a refresh shows the same).
 * - `?home` — the start screen, without re-opening the last draft (unchanged).
 *
 * Without any of these the editor behaves as before: it re-opens the project
 * that was open last, if there is one.
 */
export type DeepLink = { kind: 'open'; id: string } | { kind: 'panel'; panel: 'templates' | 'learn' } | { kind: 'home' } | null;

export function readDeepLink(search: string): DeepLink {
  const q = new URLSearchParams(search);
  const open = q.get('open');
  if (open && /^[a-z0-9-]{1,40}$/.test(open)) return { kind: 'open', id: open };
  const panel = q.get('panel');
  if (panel === 'templates' || panel === 'learn') return { kind: 'panel', panel };
  if (q.has('home') || q.has('open') || q.has('panel')) return { kind: 'home' };
  return null;
}

/** The current address without the `open` parameter (keeps everything else). */
export function withoutOpenParam(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('open');
  return u.pathname + (u.search === '?' ? '' : u.search) + u.hash;
}

/**
 * The public site's home page when the editor is served from its `/studio/`
 * folder over http(s) (GitHub Pages); null for the offline single file and the
 * development server, which have no landing page next to them.
 */
export function siteHomeUrl(loc: Pick<Location, 'protocol' | 'pathname'> = location): string | null {
  if (loc.protocol !== 'https:' && loc.protocol !== 'http:') return null;
  return /\/studio\/(index\.html)?$/.test(loc.pathname) ? '../' : null;
}
