import { Registry } from '../registry';
import type { AnyElementDef } from './types';
import { textDef } from './text';
import { imageDef } from './image';
import { shapeDef } from './shape';
import { arrowDef } from './arrow';
import { buttonDef, navButtonDef } from './button';
import { beforeAfterDef } from './beforeAfter';
import { galleryDef } from './gallery';
import { scrollTextDef } from './scrollText';
import { progressDef } from './progress';
import { videoDef } from './video';
import { audioDef } from './audio';
import { chartDef } from './chart';
import { tableDef } from './table';
import { countdownDef } from './countdown';
import { quizDef } from './quiz';
import { modelDef } from './model';

/** Runtime element registry. Add a new element type by registering its def here. */
export const elementRegistry = new Registry<AnyElementDef>('element');
for (const def of [
  textDef,
  imageDef,
  shapeDef,
  arrowDef,
  buttonDef,
  navButtonDef,
  beforeAfterDef,
  galleryDef,
  scrollTextDef,
  progressDef,
  videoDef,
  audioDef,
  chartDef,
  tableDef,
  countdownDef,
  quizDef,
  modelDef,
]) {
  elementRegistry.register(def);
}

export type { RuntimeElementDef, RenderCtx, ElementApi } from './types';
