/**
 * Hyperlinks (v4, the "Open link" action). Only web, e-mail and phone links
 * are allowed: `javascript:`, `data:`, `file:`, `blob:` and every other scheme
 * are rejected, so a link can never run code or read local files. The same
 * check runs when editing, when importing and at the moment a link opens.
 */

export const LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'] as const;

const MAX_URL = 2000;

/**
 * Turns what an author typed into a safe absolute URL, or null.
 * "example.com/docs" → "https://example.com/docs", "intranet:8080" →
 * "https://intranet:8080/", "localhost:3000" → "http://localhost:3000/",
 * "team@example.com" → "mailto:team@example.com".
 */
export function normalizeLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > MAX_URL) return null;
  // Control characters (incl. tabs/newlines browsers would strip to hide a scheme) are never valid.
  if (/[\u0000-\u001f\u007f]/.test(s)) return null;
  let candidate = s;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  if (s.startsWith('//')) candidate = `https:${s}`;
  else if (!scheme || /^[^:/?#]+:\d+(?:[/?#]|$)/.test(s)) {
    // No scheme ("example.com"), or host:port ("intranet:8080").
    if (/^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/.test(s)) candidate = `mailto:${s}`;
    else if (/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(s)) candidate = `http://${s}`;
    else candidate = `https://${s}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!(LINK_SCHEMES as readonly string[]).includes(url.protocol)) return null;
  if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.hostname) return null;
  if ((url.protocol === 'mailto:' || url.protocol === 'tel:') && !url.pathname) return null;
  return url.href;
}

/** Why a typed link cannot be used (for the editor), or null when it is fine. */
export function linkProblem(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'Enter a web address, like https://example.com';
  if (normalizeLink(raw)) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw.trim())?.[1]?.toLowerCase();
  if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme))
    return `“${scheme}:” links are not allowed. Use a web address (https://…) or an e-mail address (mailto:…).`;
  return 'This does not look like a web address.';
}

/** Short display form: "example.com/docs", "team@example.com". */
export function linkDisplay(raw: unknown): string {
  const href = normalizeLink(raw);
  if (!href) return typeof raw === 'string' ? raw : '';
  const u = new URL(href);
  if (u.protocol === 'mailto:' || u.protocol === 'tel:') return decodeURIComponent(u.pathname);
  const path = u.pathname === '/' ? '' : u.pathname;
  return `${u.host}${path}${u.search}${u.hash}`.slice(0, 80);
}

/** Opens in the same tab no matter what (mail and phone links hand over to an app). */
export function opensExternally(href: string): boolean {
  return href.startsWith('mailto:') || href.startsWith('tel:');
}
