/** Font presets. Only system font stacks plus one font that is embedded on demand. */
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
  { id: 'hand', label: 'Playful', stack: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', 'Marker Felt', cursive" },
];

export function fontStack(id: unknown): string {
  return (FONT_PRESETS.find((f) => f.id === id) ?? FONT_PRESETS[0]).stack;
}
