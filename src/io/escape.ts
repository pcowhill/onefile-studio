/** Escapes text for HTML element content / attribute values. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const SCRIPT_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/**
 * Serialises JSON so it can sit inside <script type="application/json"> safely:
 * `<`, `>` and `&` become unicode escapes (so "</script>" or "<!--" can never
 * appear), as do the JS line separators. JSON.parse restores the exact values.
 */
export function jsonForScript(value: unknown): string {
  // One pass (projects can hold large embedded media, so avoid repeated copies).
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => SCRIPT_ESCAPES[c]);
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
