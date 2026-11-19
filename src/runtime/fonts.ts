/** Font presets: system font stacks plus a few OFL fonts that are embedded on demand. */
export interface FontPreset {
  id: string;
  label: string;
  stack: string;
  /** True when the font file is embedded into exports that use it. */
  embedded?: boolean;
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'rounded', label: 'Friendly', stack: "'OFS Nunito', ui-rounded, 'Segoe UI', system-ui, sans-serif", embedded: true },
  { id: 'sans', label: 'Clean', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
  { id: 'serif', label: 'Classic', stack: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Code', stack: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" },
  { id: 'hand', label: 'Playful', stack: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', 'OFS Nunito', cursive", embedded: true },
  { id: 'modern', label: 'Modern', stack: "'OFS Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", embedded: true },
  { id: 'grotesk', label: 'Technical', stack: "'OFS Space Grotesk', 'OFS Inter', system-ui, 'Segoe UI', sans-serif", embedded: true },
  { id: 'elegant', label: 'Elegant', stack: "'OFS Fraunces', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif", embedded: true },
];

/** Embedded font family names each preset needs (exports include only what is used). */
export const FONT_FILES: Record<string, string[]> = Object.assign(Object.create(null), {
  rounded: ['nunito'],
  hand: ['nunito'],
  modern: ['inter'],
  grotesk: ['spaceGrotesk', 'inter'],
  elegant: ['fraunces'],
});

export function fontStack(id: unknown): string {
  return (FONT_PRESETS.find((f) => f.id === id) ?? FONT_PRESETS[0]).stack;
}
