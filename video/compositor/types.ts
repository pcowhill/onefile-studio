/** Storyboard data shared by the render script (Node) and the compositor page (browser). */

/** A point in a recording: seconds, a mark name, or "mark+1.2" / "mark-0.5". */
export type At = number | string;

/** Camera on the footage: centre (0–1 of the source frame) and zoom (1 = whole frame). */
export interface Cam {
  /** 0–1 position within the shot. */
  at: number;
  x: number;
  y: number;
  z: number;
}

export interface ClipShot {
  type: 'clip';
  /** Output seconds. */
  dur: number;
  scene: string;
  /** Where in the recording the shot starts. */
  from: At;
  /** Playback speed (2 = twice as fast). */
  speed?: number;
  /** full: edge to edge · window: a floating app window · browser: a window with an address bar. */
  frame?: 'full' | 'window' | 'browser';
  url?: string;
  badge?: string;
  cam?: Cam[];
}

export interface FileShot {
  type: 'file';
  dur: number;
  name: string;
  meta: string;
}

export interface OutroShot {
  type: 'outro';
  dur: number;
  url: string;
}

export interface TitleShot {
  type: 'title';
  dur: number;
  kicker?: string;
  title: string;
  sub?: string;
  accent?: string;
}

export type Shot = ClipShot | FileShot | OutroShot | TitleShot;

export interface Caption {
  from: number;
  to: number;
  text: string;
  sub?: string;
  /** A small coloured badge before the text ("1", "✓"…). */
  badge?: string;
  color?: string;
}

export interface Headline {
  from: number;
  to: number;
  kicker?: string;
  lines: string[];
}

export interface Storyboard {
  name: string;
  /** Output size (the compositor always lays out at 1920×1080 and is scaled). */
  width: number;
  height: number;
  fps: number;
  /** Crossfade between shots, in seconds. */
  fade: number;
  shots: Shot[];
  captions: Caption[];
  headlines?: Headline[];
  /** Step rail shown at the top left: labels and the time each step starts. */
  steps?: Array<{ label: string; from: number }>;
  stepsVisible?: [number, number];
  /** Accent colour (badges, rail). */
  accent?: string;
  /** Background palette for the stage. */
  palette?: 'night' | 'light';
  /** Caption size multiplier (clips shown small on cards use bigger captions). */
  captionScale?: number;
  /** Fade in from / out to the background at the very start and end (seamless loops). */
  loop?: boolean;
  /** Seconds at which the poster image is taken. */
  poster: number;
}

/** Storyboard with every mark resolved to seconds (what the compositor receives). */
export interface ResolvedStoryboard extends Omit<Storyboard, 'shots'> {
  shots: Array<Exclude<Shot, ClipShot> | (Omit<ClipShot, 'from'> & { from: number })>;
  /** Frame lists of the recordings in use. */
  footage: Record<string, { base: string; frames: Array<{ t: number; file: string }> }>;
}
