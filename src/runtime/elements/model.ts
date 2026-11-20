import type { RuntimeElementDef } from './types';
import { h, icon, num, SHADOWS, svg } from './types';
import { contrastText, parseHex, withAlpha } from '../../model/paint';
import type { ModelLighting, ModelViewerHandle, ModelViewOptions } from '../model3d/contract';
import { loadModelRuntime } from '../model3d/contract';

/** 3D model viewer (v4). The renderer lives in the 3D add-on; this element is the frame, states and controls. */
export interface ModelProps {
  assetId: string;
  /** Description for screen readers. */
  alt: string;
  lighting: ModelLighting;
  backdrop: 'gradient' | 'solid' | 'none';
  background: string;
  accent: string;
  autoRotate: boolean;
  /** 0.2..3; 1 ≈ one turn in 20 s. */
  rotateSpeed: number;
  allowRotate: boolean;
  allowZoom: boolean;
  allowPan: boolean;
  /** Overlay buttons: reset view, zoom, fullscreen. */
  controls: boolean;
  groundShadow: boolean;
  /** Starting view (degrees around / above, zoom factor). */
  yaw: number;
  pitch: number;
  zoom: number;
  radius: number;
  shadow: string;
}

const LIGHTING = new Set(['studio', 'soft', 'dramatic']);

export function modelViewOptions(p: ModelProps): ModelViewOptions {
  return {
    lighting: (LIGHTING.has(p.lighting) ? p.lighting : 'studio') as ModelLighting,
    autoRotate: !!p.autoRotate,
    rotateSpeed: Math.max(0.2, Math.min(3, num(p.rotateSpeed, 1))),
    allowRotate: p.allowRotate !== false,
    allowZoom: p.allowZoom !== false,
    allowPan: p.allowPan !== false,
    groundShadow: p.groundShadow !== false,
    yaw: num(p.yaw, 30),
    pitch: Math.max(-80, Math.min(85, num(p.pitch, 15))),
    zoom: Math.max(0.4, Math.min(2.5, num(p.zoom, 1))),
    accent: p.accent,
  };
}

/** CSS background for the viewer's backdrop style. */
export function modelBackdrop(p: Pick<ModelProps, 'backdrop' | 'background' | 'accent'>): string {
  if (p.backdrop === 'none') return 'transparent';
  if (p.backdrop === 'solid' || !parseHex(p.background)) return p.background;
  const glow = parseHex(p.accent) ? `radial-gradient(70% 60% at 50% 38%, ${withAlpha(p.accent, 0.2)}, rgba(0,0,0,0) 70%), ` : '';
  return `${glow}radial-gradient(120% 100% at 50% 0%, ${withAlpha(p.background, 1)}, ${withAlpha(p.background, 1)} 45%, ${shade(p.background)})`;
}

function shade(hex: string): string {
  const c = parseHex(hex);
  if (!c) return hex;
  const [r, g, b] = c;
  const k = (r + g + b) / 3 > 128 ? 0.86 : 0.7;
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

function cubeArt(doc: Document): SVGSVGElement {
  const s = svg(doc, 'svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true', class: 'ofs-model-cube' });
  s.appendChild(svg(doc, 'path', { d: 'M32 6l22 12.5v27L32 58 10 45.5v-27z', fill: 'currentColor', opacity: '.16' }));
  s.appendChild(svg(doc, 'path', { d: 'M32 6l22 12.5L32 31 10 18.5z', fill: 'currentColor', opacity: '.55' }));
  s.appendChild(svg(doc, 'path', { d: 'M32 31v27L10 45.5v-27z', fill: 'currentColor', opacity: '.8' }));
  s.appendChild(svg(doc, 'path', { d: 'M32 31v27l22-12.5v-27z', fill: 'currentColor', opacity: '.38' }));
  return s;
}

function message(doc: Document, text: string, small?: string, retry?: () => void): HTMLElement {
  const box = h(doc, 'div', 'ofs-model-msg');
  box.appendChild(cubeArt(doc));
  const t = h(doc, 'strong');
  t.textContent = text;
  box.appendChild(t);
  if (small) {
    const s = h(doc, 'small');
    s.textContent = small;
    box.appendChild(s);
  }
  if (retry) {
    const b = h(doc, 'button', 'ofs-model-retry');
    b.type = 'button';
    b.textContent = 'Try again';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      retry();
    });
    box.appendChild(b);
  }
  return box;
}

const PATHS: Record<string, string> = {
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
};

function ctrl(doc: Document, name: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = h(doc, 'button', 'ofs-model-btn');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  const s = icon(doc, 'plus', 18);
  s.querySelector('path')!.setAttribute('d', PATHS[name]);
  b.appendChild(s);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export const modelDef: RuntimeElementDef<ModelProps> = {
  id: 'model',
  defaults: () => ({
    assetId: '',
    alt: '',
    lighting: 'studio',
    backdrop: 'gradient',
    background: '#f3f1fa',
    accent: '#6d4aff',
    autoRotate: false,
    rotateSpeed: 1,
    allowRotate: true,
    allowZoom: true,
    allowPan: true,
    controls: true,
    groundShadow: true,
    yaw: 30,
    pitch: 15,
    zoom: 1,
    radius: 18,
    shadow: 'soft',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const win = doc.defaultView ?? window;
    const node = h(doc, 'div', 'ofs-model', {
      background: modelBackdrop(p),
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: p.backdrop === 'none' ? 'none' : (SHADOWS[p.shadow] ?? 'none'),
      color: p.backdrop === 'none' ? '#4b4766' : contrastText(p.background),
    });
    node.setAttribute('role', 'img');
    const asset = Object.prototype.hasOwnProperty.call(env.project.assets, p.assetId) ? env.project.assets[p.assetId] : undefined;
    const data = asset && asset.mime.startsWith('model/') ? asset.data : '';
    node.setAttribute('aria-label', p.alt || asset?.name || '3D model');
    if (!data) {
      node.appendChild(message(doc, env.mode === 'edit' ? 'Add a 3D model' : '3D model', env.mode === 'edit' ? 'GLB file · choose one on the right' : undefined));
      return { node };
    }
    const view = modelViewOptions(p);
    let alive = true;
    onCleanup(() => (alive = false));

    if (env.mode !== 'play') {
      // Editor canvas and thumbnails: a still from one shared renderer (no WebGL context per element).
      const img = h(doc, 'img', 'ofs-model-poster');
      img.alt = '';
      img.draggable = false;
      node.appendChild(img);
      if (env.mode === 'edit') {
        const badge = h(doc, 'span', 'ofs-model-badge');
        badge.textContent = '3D';
        node.appendChild(badge);
      }
      void loadModelRuntime(win).then((rt) => {
        if (!alive) return;
        if (!rt) return void node.appendChild(message(doc, asset!.name));
        rt.poster({ ...view, data, width: el.w, height: el.h }).then(
          (url) => alive && (img.src = url),
          (err: Error) => alive && node.appendChild(message(doc, 'Can’t show this model', err.message)),
        );
      });
      return { node };
    }

    // Playback: the interactive viewer.
    const stage = h(doc, 'div', 'ofs-model-stage');
    node.appendChild(stage);
    const status = h(doc, 'div', 'ofs-model-loading');
    status.appendChild(h(doc, 'span', 'ofs-model-spinner'));
    node.appendChild(status);
    let handle: ModelViewerHandle | null = null;
    let errorBox: HTMLElement | null = null;
    const pending: Array<(h: ModelViewerHandle) => void> = [];

    const start = () => {
      errorBox?.remove();
      errorBox = null;
      void loadModelRuntime(win).then((rt) => {
        if (!alive) return;
        if (!rt) {
          status.remove();
          node.appendChild(message(doc, 'The 3D viewer is missing from this file.', 'Export it again from OneFile Studio.'));
          return;
        }
        handle = rt.create(stage, {
          ...view,
          data,
          wheelNeedsFocus: env.project.kind === 'page',
          onStatus(s) {
            status.style.display = s === 'loading' ? '' : 'none';
            if (s === 'ready' && handle) for (const fn of pending.splice(0)) fn(handle);
          },
          onError(msg, retry) {
            status.style.display = 'none';
            errorBox?.remove();
            errorBox = message(doc, msg, retry ? undefined : 'The rest of this page still works.', retry);
            node.appendChild(errorBox);
          },
        });
      });
    };
    start();
    onCleanup(() => handle?.destroy());

    if (p.controls) {
      const bar = h(doc, 'div', 'ofs-model-ctrls');
      bar.appendChild(ctrl(doc, 'reset', 'Reset view', () => handle?.view('reset')));
      if (view.allowZoom) {
        bar.appendChild(ctrl(doc, 'plus', 'Zoom in', () => handle?.zoomBy(1.25)));
        bar.appendChild(ctrl(doc, 'minus', 'Zoom out', () => handle?.zoomBy(0.8)));
      }
      if (typeof node.requestFullscreen === 'function' && doc.fullscreenEnabled !== false)
        bar.appendChild(
          ctrl(doc, 'full', 'Full screen', () => {
            if (doc.fullscreenElement) void doc.exitFullscreen?.();
            else void node.requestFullscreen?.().catch(() => undefined);
          }),
        );
      node.appendChild(bar);
    }

    // Orbiting is the viewer's own gesture: it must not drag the element or count as a click.
    if (view.allowRotate || view.allowPan || view.allowZoom) {
      let down: { x: number; y: number } | null = null;
      let moved = false;
      stage.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        down = { x: e.clientX, y: e.clientY };
        moved = false;
      });
      stage.addEventListener('pointermove', (e) => {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) moved = true;
      });
      stage.addEventListener(
        'click',
        (e) => {
          if (moved) e.stopPropagation();
          down = null;
        },
        true,
      );
      node.classList.add('ofs-model-live');
    }

    const whenReady = (fn: (h: ModelViewerHandle) => void) => (handle ? fn(handle) : pending.push(fn));
    return {
      node,
      api: {
        view: (name) => whenReady((x) => x.view(name)),
        spin: (on) => whenReady((x) => x.spin(on)),
        reset: () => whenReady((x) => x.view('reset')),
      },
    };
  },
  css: `.ofs-model{position:relative;width:100%;height:100%;overflow:hidden;user-select:none}
.ofs-model-stage,.ofs-model-poster{position:absolute;inset:0;width:100%;height:100%}
.ofs-model-poster{object-fit:cover;pointer-events:none}
.ofs-model-poster:not([src]){display:none}
.ofs-model-canvas{display:block;width:100%!important;height:100%!important;outline:none}
.ofs-model-live .ofs-model-canvas{cursor:grab}
.ofs-model-live .ofs-model-canvas:active{cursor:grabbing}
.ofs-model-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px;text-align:center;font:800 15px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif}
.ofs-model-msg::before{content:'';position:absolute;inset:8px;border:2px dashed currentColor;border-radius:inherit;opacity:.2;pointer-events:none}
.ofs-model-msg small{font-weight:600;font-size:12px;opacity:.7;max-width:36em}
.ofs-model-cube{width:clamp(34px,18%,84px);height:auto;color:inherit}
.ofs-model-retry{margin-top:4px;border:0;border-radius:999px;padding:7px 14px;font:800 13px system-ui,sans-serif;background:currentColor;cursor:pointer}
.ofs-model-retry{color:inherit;background:rgba(127,127,127,.18)}
.ofs-model-badge{position:absolute;right:10px;top:10px;padding:3px 8px;border-radius:999px;background:rgba(20,16,40,.6);color:#fff;font:900 11px/1.2 system-ui,sans-serif;letter-spacing:.06em;pointer-events:none}
.ofs-model-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.ofs-model-spinner{width:34px;height:34px;border-radius:50%;border:4px solid currentColor;border-right-color:transparent;opacity:.45;animation:ofs-model-spin .9s linear infinite}
@keyframes ofs-model-spin{to{transform:rotate(360deg)}}
.ofs-model-ctrls{position:absolute;right:10px;bottom:10px;display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(20,16,40,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:.72;transition:opacity .2s}
.ofs-model:hover .ofs-model-ctrls,.ofs-model-ctrls:focus-within{opacity:1}
.ofs-model-btn{width:32px;height:32px;border:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:transparent;color:#fff;cursor:pointer;padding:0}
.ofs-model-btn:hover{background:rgba(255,255,255,.18)}
.ofs-model-btn:focus-visible{outline:2px solid #fff;outline-offset:1px}
.ofs-model:fullscreen{border-radius:0!important}`,
};
