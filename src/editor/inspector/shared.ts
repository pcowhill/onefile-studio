import type { Project, SceneElement } from '../../model/types';

/** Props every per-type inspector receives. `set` records author edits (they stop following the theme). */
export type P<T> = { el: SceneElement<T>; set(patch: Partial<T>, merge?: string): void; project: Project };

export const SHADOW_OPTS = [
  { value: 'none', label: 'None' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'soft', label: 'Soft' },
  { value: 'lifted', label: 'Lifted' },
  { value: 'glow', label: 'Glow' },
];
