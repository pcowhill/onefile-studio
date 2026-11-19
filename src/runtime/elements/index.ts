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

/** Runtime element registry. Add a new element type by registering its def here. */
export const elementRegistry = new Registry<AnyElementDef>('element');
for (const def of [textDef, imageDef, shapeDef, arrowDef, buttonDef, navButtonDef, beforeAfterDef, galleryDef, scrollTextDef, progressDef]) {
  elementRegistry.register(def);
}

export type { RuntimeElementDef, RenderCtx, ElementApi } from './types';
