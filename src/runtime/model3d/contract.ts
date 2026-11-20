/**
 * Contract between the core runtime (always in exports) and the 3D add-on
 * (src/runtime/model3d/addon.ts, bundled into an export only when the project
 * contains a 3D model). The add-on registers itself on `window.__ofsModel3d`;
 * the core `model` element never imports three.js.
 */

export type ModelLighting = 'studio' | 'soft' | 'dramatic';

/** The viewer-relevant subset of the model element's props. */
export interface ModelViewOptions {
  lighting: ModelLighting;
  autoRotate: boolean;
  /** 0.2..3 (1 = a full turn in about 20 s). */
  rotateSpeed: number;
  allowRotate: boolean;
  allowZoom: boolean;
  allowPan: boolean;
  groundShadow: boolean;
  /** Starting view: degrees around (0 = front), degrees above, zoom factor. */
  yaw: number;
  pitch: number;
  zoom: number;
  /** Accent colour (dramatic rim light). */
  accent: string;
}

export interface ModelViewerOptions extends ModelViewOptions {
  /** The GLB bytes as a base64 data: URL (decoded locally; never fetched). */
  data: string;
  /** Wheel zoom only after the viewer was touched (scrolling webpages). */
  wheelNeedsFocus: boolean;
  onStatus(status: 'loading' | 'ready'): void;
  /** `retry` is offered for recoverable failures (lost graphics context). */
  onError(message: string, retry?: () => void): void;
}

export interface ModelViewerHandle {
  view(name: string): void;
  spin(on?: boolean): void;
  zoomBy(factor: number): void;
  destroy(): void;
}

export interface PosterOptions extends ModelViewOptions {
  data: string;
  /** CSS pixels. */
  width: number;
  height: number;
}

export interface Model3dRuntime {
  /** Interactive viewer (Preview and exported files): one WebGL context per viewer. */
  create(container: HTMLElement, opts: ModelViewerOptions): ModelViewerHandle;
  /**
   * Still image (PNG data: URL) from one shared renderer — the editor canvas
   * and thumbnails use these, so editing never piles up WebGL contexts.
   */
  poster(opts: PosterOptions): Promise<string>;
}

declare global {
  interface Window {
    __ofsModel3d?: Model3dRuntime;
    /** Set by the editor: loads the add-on on demand (it is embedded in the editor as a string). */
    __ofsModel3dLoad?: () => Promise<void>;
  }
}

/** Named camera views for the "Turn 3D view" action. */
export const MODEL_VIEWS: Record<string, { yaw: number; pitch: number } | undefined> = {
  front: { yaw: 0, pitch: 8 },
  back: { yaw: 180, pitch: 8 },
  left: { yaw: -90, pitch: 8 },
  right: { yaw: 90, pitch: 8 },
  top: { yaw: 0, pitch: 82 },
};

/** The add-on, loading it first when the host (the editor) knows how. Null when unavailable. */
export async function loadModelRuntime(win: Window): Promise<Model3dRuntime | null> {
  if (win.__ofsModel3d) return win.__ofsModel3d;
  if (win.__ofsModel3dLoad) {
    try {
      await win.__ofsModel3dLoad();
    } catch {
      return null;
    }
  }
  return win.__ofsModel3d ?? null;
}
