/** Escapes text for HTML element content / attribute values. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Serialises JSON so it can sit inside <script type="application/json"> safely:
 * `<`, `>` and `&` become unicode escapes (so "</script>" or "<!--" can never
 * appear), as do the JS line separators. JSON.parse restores the exact values.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Makes a filesystem-friendly file name from a title. */
export function fileNameFor(title: string, ext = 'html'): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${base || 'onefile-project'}.${ext}`;
}
