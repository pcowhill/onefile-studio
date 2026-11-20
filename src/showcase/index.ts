import type { Project } from '../model/types';
import { EXAMPLES } from '../examples';
import { getShowcase, SHOWCASES } from './meta';

export { SHOWCASES, getShowcase } from './meta';
export type { ShowcaseMeta } from './meta';

/**
 * Builds the project behind a showcase: the very same factory the start
 * screen's example uses, so the showcase, the example and the editor copy can
 * never drift apart. Returns a fresh project every call.
 */
export function buildShowcase(id: string): Project | undefined {
  const meta = getShowcase(id);
  const ex = meta && EXAMPLES.find((e) => e.id === meta.example);
  return ex?.build();
}

/** Every showcase id refers to a registered example (checked by the unit tests). */
export function showcaseExamples(): string[] {
  return SHOWCASES.map((s) => s.example);
}
