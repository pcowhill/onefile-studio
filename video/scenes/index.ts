import type { Scene } from './types.ts';
import * as S from './showcases.ts';
import { heroCreate } from './hero.ts';
import { templateThumbs } from './templates.ts';

/** Every capture scene, by name (recordings land in video/.cache/captures/<name>/). */
export const SCENES: Record<string, Scene> = {
  hero: heroCreate,
  templates: templateThumbs,
  'feed-puff-play': S.feedPuffPlay,
  'feed-puff-edit': S.feedPuffEdit,
  'before-after-play': S.beforeAfterPlay,
  'before-after-edit': S.beforeAfterEdit,
  '3d-explorer-play': S.explorerPlay,
  '3d-explorer-edit': S.explorerEdit,
  'tech-explainer-play': S.explainerPlay,
  'tech-explainer-edit': S.explainerEdit,
  'feature-walkthrough-play': S.releasePlay,
  'feature-walkthrough-edit': S.releaseEdit,
  'event-play': S.eventPlay,
  'event-edit': S.eventEdit,
};
