/**
 * OneFile Studio project model (schema version 4).
 *
 * Everything an experience needs — pages, elements, interactions, variables and
 * embedded assets — lives in a single JSON-serialisable `Project` object. The
 * same object is edited by the editor, executed by the playback runtime and
 * embedded verbatim in every exported HTML file.
 */

import type { MediaEdit } from './mediaEdit';

export const SCHEMA_ID = 'onefile-studio/project';
export const SCHEMA_VERSION = 4;

/** Built-in project themes (see src/model/theme). */
export type ThemeId = 'playful' | 'professional' | 'technical' | 'editorial';

export type ProjectKind = 'slides' | 'page';

export interface Project {
  schema: typeof SCHEMA_ID;
  version: number;
  id: string;
  kind: ProjectKind;
  meta: ProjectMeta;
  settings: ProjectSettings;
  /** Slides (kind = "slides") or vertically stacked sections (kind = "page"). */
  pages: Page[];
  variables: Variable[];
  /** Embedded assets keyed by asset id. */
  assets: Record<string, Asset>;
  /**
   * Project-wide interactions (v4): keyboard shortcuts that work on every
   * slide or section. Absent in older files.
   */
  interactions?: Interaction[];
}

export interface ProjectMeta {
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type SlideTransition = 'none' | 'fade' | 'slide';

export interface ProjectSettings {
  /** Logical canvas width. Slides: 1280. Pages: content column width. */
  width: number;
  /** Slides: logical canvas height (720). Pages: default height of a new section. */
  height: number;
  /** Transition between slides. */
  transition: SlideTransition;
  /** Show the built-in previous/next controls in slide playback. */
  showNavigation: boolean;
  /** Colour around the slide (letterbox) or behind a webpage. */
  backdrop: string;
  /** Project theme (v2). Projects from v1 are migrated to "playful". */
  theme: ThemeId;
  /** True when `backdrop` follows the theme (false = the author picked it). */
  backdropThemed?: boolean;
}

export type Paint = { kind: 'solid'; color: string } | { kind: 'linear'; from: string; to: string; angle: number };

export interface Background {
  paint: Paint;
  /** Optional background image asset. */
  imageId?: string;
  imageFit?: 'cover' | 'contain';
  /** 0..1 darkening overlay drawn above a background image. */
  imageDim?: number;
  /** Theme background slot ("base", "alt", "hero", "dark", "accent"). */
  role?: string;
  /** True when `paint` follows the project theme. */
  themed?: boolean;
}

export interface Page {
  id: string;
  name: string;
  background: Background;
  /** Section height (pages only). Slides use settings.height. */
  height?: number;
  /** Ordered back-to-front. */
  elements: SceneElement[];
  /**
   * Page-level interactions (v4): keyboard shortcuts, "when the slide opens",
   * "after a delay". They run while this slide/section is the current one.
   */
  interactions?: Interaction[];
}

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface AnimationRef {
  preset: string;
  /** Milliseconds. */
  duration: number;
  /** Milliseconds. */
  delay: number;
  direction?: Direction;
}

export interface DragBehavior {
  /** A registered drag mode id: "rigid", "floaty" or "weighted" (v4). */
  mode: string;
  /** v4, physics modes: playfulness (floaty) / weight (weighted), 0..1. Default 0.5. */
  amount?: number;
  /** v4, physics modes: settling speed, 0..1. Default 0.5. */
  settle?: number;
}

export interface SceneElement<P = Record<string, unknown>> {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees. */
  rotation: number;
  /** Initially hidden during playback (still visible, ghosted, in the editor). */
  hidden: boolean;
  locked: boolean;
  props: P;
  interactions: Interaction[];
  /** Entrance animation played when the element first appears. */
  entrance?: AnimationRef | null;
  drag?: DragBehavior | null;
  /** Theme style slot, e.g. "heading" or "body" for text (v2). */
  role?: string;
  /**
   * Prop keys whose values follow the project theme (v2). Their stored values
   * are always the current theme's values; any key NOT listed is an explicit
   * author choice and is never touched by a theme change.
   */
  themed?: string[];
}

/** WHEN trigger → IF conditions (all must pass) → DO actions (in order). */
export interface Interaction {
  id: string;
  trigger: string;
  /**
   * Trigger settings (v4), e.g. `{ key: "Space", shift: false }` for a key
   * press or `{ seconds: 3 }` for a delay. Absent for triggers without settings.
   */
  options?: Record<string, ParamValue>;
  conditions: Condition[];
  actions: Action[];
}

/** Who owns an interaction list: an element, a page (slide/section) or the whole project. */
export type InteractionOwner = 'element' | 'page' | 'project';

export type CompareOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';

export interface Condition {
  id: string;
  type: 'variable';
  variableId: string;
  op: CompareOp;
  value: number;
}

export type ParamValue = string | number | boolean;

export interface Action {
  id: string;
  type: string;
  params: Record<string, ParamValue>;
}

export interface Variable {
  id: string;
  name: string;
  type: 'number';
  initial: number;
}

export interface Asset {
  id: string;
  name: string;
  /** image/*, video/* (MP4, WebM), audio/* (MP3, WAV, OGG, M4A) or model/gltf-binary (GLB, v4). */
  mime: string;
  /** Base64 data URL. Never a blob: or remote URL. */
  data: string;
  /** Pixel size (images, video). 0 for audio. */
  width: number;
  height: number;
  /** Encoded byte size of the data. */
  bytes: number;
  /** Content hash used for de-duplication. */
  hash: string;
  /** Seconds (video, audio) when known. */
  duration?: number;
  /** True for animated GIFs (never re-encoded by optimisation). */
  animated?: boolean;
  /**
   * The media library's nondestructive edit of this file (v3): crop/rotate/flip
   * for images, crop/trim for videos, trim for sounds. The bytes in `data` are
   * always the untouched original. See src/model/mediaEdit.ts.
   */
  edit?: MediaEdit;
}

export type AssetKind = 'image' | 'video' | 'audio' | 'model';

export function assetKind(mime: string): AssetKind {
  return mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('model/') ? 'model' : 'image';
}

/** Special element target meaning "the element that owns this interaction". */
export const SELF_TARGET = '@self';
