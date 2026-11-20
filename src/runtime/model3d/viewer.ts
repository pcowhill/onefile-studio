/**
 * The 3D model viewer (three.js). Bundled as a separate add-on that exports
 * include only when a project contains a 3D model (see build/plugins.ts and
 * io/exportHtml.ts). GLB bytes come from the embedded data: URL; textures
 * load from blob: URLs through <img> (allowed by the export CSP) — nothing is
 * fetched, no workers, no decoders.
 */
import {
  ACESFilmicToneMapping,
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Sphere,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Model3dRuntime, ModelViewerHandle, ModelViewerOptions, ModelViewOptions, PosterOptions } from './contract';
import { MODEL_VIEWS, zoomedDistance } from './contract';

const FOV = 32;
const DEG = Math.PI / 180;

// ---------------- loading ----------------

function dataUrlToBuffer(data: string): ArrayBuffer {
  const comma = data.indexOf(',');
  if (comma < 0 || !/;base64$/.test(data.slice(0, comma))) throw new Error('The model data is damaged.');
  const b64 = data.slice(comma + 1);
  // Decode in chunks (multiple of 4 chars) to keep peak memory low for large models.
  const chunk = 4 * 1024 * 1024;
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < b64.length; i += chunk) {
    const bin = atob(b64.slice(i, i + chunk));
    const out = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
    parts.push(out);
    total += out.length;
  }
  const buf = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    buf.set(p, at);
    at += p.length;
  }
  return buf.buffer;
}

/** Parses GLB bytes. Textures load via <img> + blob: URLs (no fetch, which the export CSP forbids). */
function parseGlb(data: string): Promise<Object3D> {
  return new Promise((resolve, reject) => {
    let buffer: ArrayBuffer;
    try {
      buffer = dataUrlToBuffer(data);
    } catch (err) {
      reject(err);
      return;
    }
    const loader = new GLTFLoader();
    loader.register((parser) => {
      const p = parser as unknown as { textureLoader: TextureLoader; options: { manager: TextureLoader['manager'] } };
      p.textureLoader = new TextureLoader(p.options.manager);
      return { name: 'ofs_image_textures' };
    });
    loader.parse(
      buffer,
      '',
      (gltf) => resolve(gltf.scene),
      (err) => reject(new Error(friendlyLoadError(err))),
    );
  });
}

function friendlyLoadError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (/extension/i.test(msg)) return 'This model needs a feature (e.g. compression) the offline viewer cannot decode.';
  if (/JSON|Unexpected|magic|glTF/i.test(msg)) return 'This file is not a valid GLB model.';
  return 'The 3D model could not be loaded.';
}

/** Centres the model at the origin with its base on y = 0; returns its bounding sphere radius. */
function normalize(model: Object3D): { group: Group; radius: number; height: number } {
  const group = new Group();
  group.add(model);
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  if (box.isEmpty()) return { group, radius: 1, height: 1 };
  const center = box.getCenter(new Vector3());
  model.position.sub(new Vector3(center.x, box.min.y, center.z));
  const size = box.getSize(new Vector3());
  const sphere = new Box3(new Vector3(-size.x / 2, 0, -size.z / 2), new Vector3(size.x / 2, size.y, size.z / 2)).getBoundingSphere(new Sphere());
  return { group, radius: Math.max(1e-3, sphere.radius), height: size.y };
}

function disposeTree(root: Object3D) {
  const seen = new Set<unknown>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.geometry && !seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats as Material[]) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const v of Object.values(m)) {
        if (!v || !(v as Texture).isTexture || seen.has(v)) continue;
        seen.add(v);
        (v as Texture).dispose();
      }
      m.dispose();
    }
  });
}

// ---------------- staging (lights, shadow, camera) ----------------

interface Stage {
  scene: Scene;
  radius: number;
  height: number;
  dispose(): void;
}

const EXPOSURE: Record<string, number> = { studio: 1.0, soft: 1.08, dramatic: 0.95 };

function lightRig(scene: Scene, opts: ModelViewOptions, radius: number) {
  const r = radius;
  if (opts.lighting === 'dramatic') {
    scene.environmentIntensity = 0.32;
    const key = new DirectionalLight(0xffffff, 3.2);
    key.position.set(r * 2.2, r * 3, r * 1.2);
    const rim = new DirectionalLight(new Color(safeColor(opts.accent)), 2.4);
    rim.position.set(-r * 2.5, r * 1.6, -r * 2.6);
    scene.add(key, rim);
  } else if (opts.lighting === 'soft') {
    scene.environmentIntensity = 1.05;
    scene.add(new HemisphereLight(0xffffff, 0xd8d4e8, 0.9));
  } else {
    scene.environmentIntensity = 0.9;
    const key = new DirectionalLight(0xffffff, 1.4);
    key.position.set(r * 2, r * 3.2, r * 2.4);
    scene.add(key);
  }
}

const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c.slice(0, 7) : '#6d4aff');

function contactShadow(radius: number): Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(20,16,40,0.42)');
    grad.addColorStop(0.55, 'rgba(20,16,40,0.16)');
    grad.addColorStop(1, 'rgba(20,16,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const tex = new CanvasTexture(c);
  const mesh = new Mesh(new PlaneGeometry(radius * 2.4, radius * 2.4), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002 * radius;
  mesh.renderOrder = -1;
  return mesh;
}

function buildStage(renderer: WebGLRenderer, model: Object3D, opts: ModelViewOptions): Stage {
  const scene = new Scene();
  const { group, radius, height } = normalize(model);
  scene.add(group);
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.traverse((o) => {
    const m = o as Mesh;
    m.geometry?.dispose();
    (m.material as Material | undefined)?.dispose?.();
  });
  pmrem.dispose();
  scene.environment = env;
  lightRig(scene, opts, radius);
  const shadow = opts.groundShadow ? contactShadow(radius) : null;
  if (shadow) scene.add(shadow);
  return {
    scene,
    radius,
    height,
    dispose() {
      env.dispose();
      if (shadow) disposeTree(shadow);
      disposeTree(group);
    },
  };
}

/** Distance at which a sphere of `radius` fits the view (both axes). */
function fitDistance(radius: number, aspect: number): number {
  const v = (FOV * DEG) / 2;
  const h = Math.atan(Math.tan(v) * Math.max(0.2, aspect));
  // A bounding sphere overestimates most models, so come in a little closer than an exact fit.
  return (radius / Math.sin(Math.min(v, h))) * 0.9;
}

function placeCamera(camera: PerspectiveCamera, target: Vector3, dist: number, yaw: number, pitch: number) {
  const p = Math.max(-85, Math.min(85, pitch)) * DEG;
  const y = yaw * DEG;
  camera.position.set(target.x + dist * Math.sin(y) * Math.cos(p), target.y + dist * Math.sin(p), target.z + dist * Math.cos(y) * Math.cos(p));
  camera.lookAt(target);
}

function makeRenderer(canvas: HTMLCanvasElement | undefined, opts: ModelViewOptions, preserve = false): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: preserve, powerPreference: 'default' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE[opts.lighting] ?? 1;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

function webglMessage(err: unknown): string {
  return /webgl|context/i.test(String((err as Error)?.message ?? err))
    ? 'This browser or device can’t show 3D graphics (WebGL is unavailable or turned off).'
    : 'The 3D view could not start on this device.';
}

// ---------------- interactive viewer ----------------

function createViewer(container: HTMLElement, opts: ModelViewerOptions): ModelViewerHandle {
  const doc = container.ownerDocument;
  const win = doc.defaultView ?? window;
  const canvas = doc.createElement('canvas');
  canvas.className = 'ofs-model-canvas';
  container.appendChild(canvas);
  let destroyed = false;
  let renderer: WebGLRenderer;
  try {
    renderer = makeRenderer(canvas, opts);
  } catch (err) {
    canvas.remove();
    opts.onError(webglMessage(err));
    return { view() {}, spin() {}, zoomBy() {}, destroy() {} };
  }
  const camera = new PerspectiveCamera(FOV, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.8;
  controls.enableRotate = opts.allowRotate;
  controls.enablePan = opts.allowPan;
  controls.enableZoom = opts.allowZoom && !opts.wheelNeedsFocus;
  controls.autoRotate = opts.autoRotate;
  controls.autoRotateSpeed = 3 * Math.max(0.1, Math.min(3, opts.rotateSpeed || 1));
  if (opts.wheelNeedsFocus) canvas.style.touchAction = 'pan-y';
  if (!opts.allowRotate && !opts.allowPan && !opts.allowZoom) canvas.style.pointerEvents = 'none';

  let stage: Stage | null = null;
  let baseDist = 1;
  let frame = 0;
  let last = 0;
  let visible = true;
  let tween: { from: Vector3; to: Vector3; fromT: Vector3; toT: Vector3; start: number; dur: number } | null = null;
  const home = new Vector3();

  const size = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    // Render at the size actually on screen (slides are scaled), capped for performance.
    const shown = canvas.getBoundingClientRect().width || w;
    const ratio = Math.max(0.5, Math.min(2, (win.devicePixelRatio || 1) * (shown / w)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  };

  function tick(now: number) {
    frame = 0;
    if (destroyed || !stage) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    let moving = false;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      if (t >= 1) tween = null;
      moving = true;
    }
    if (controls.update(dt)) moving = true;
    renderer.render(stage.scene, camera);
    if ((moving || (controls.autoRotate && visible)) && visible) invalidate();
    else last = 0;
  }
  function invalidate() {
    if (!frame && !destroyed) frame = win.requestAnimationFrame(tick);
  }
  controls.addEventListener('change', invalidate);
  controls.addEventListener('start', () => {
    tween = null;
    invalidate();
  });

  // Wheel zoom on scrolling webpages only after the viewer was touched, so the page still scrolls.
  const arm = () => {
    if (opts.wheelNeedsFocus && opts.allowZoom) controls.enableZoom = true;
  };
  const disarm = () => {
    if (opts.wheelNeedsFocus) controls.enableZoom = false;
  };
  canvas.addEventListener('pointerdown', arm);
  canvas.addEventListener('pointerleave', disarm);

  const RO = (win as typeof window).ResizeObserver;
  const ro = RO ? new RO(() => size()) : null;
  ro?.observe(container);
  const IO = (win as typeof window).IntersectionObserver;
  const io = IO
    ? new IO((entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) invalidate();
      })
    : null;
  io?.observe(container);

  const lost = (e: Event) => {
    e.preventDefault();
    if (destroyed) return;
    opts.onError('The 3D view was paused by the graphics driver.', () => restart());
  };
  canvas.addEventListener('webglcontextlost', lost);
  let restart = () => {};

  opts.onStatus('loading');
  parseGlb(opts.data).then(
    (model) => {
      if (destroyed) {
        disposeTree(model);
        return;
      }
      try {
        stage = buildStage(renderer, model, opts);
      } catch (err) {
        disposeTree(model);
        opts.onError(webglMessage(err));
        return;
      }
      const target = new Vector3(0, stage.height / 2, 0);
      controls.target.copy(target);
      size();
      baseDist = fitDistance(stage.radius, camera.aspect);
      camera.near = baseDist / 100;
      camera.far = baseDist * 20;
      camera.updateProjectionMatrix();
      controls.minDistance = baseDist * 0.3;
      controls.maxDistance = baseDist * 3.5;
      placeCamera(camera, target, baseDist / Math.max(0.3, Math.min(3, opts.zoom || 1)), opts.yaw, opts.pitch);
      home.copy(camera.position);
      controls.update();
      opts.onStatus('ready');
      invalidate();
    },
    (err: Error) => opts.onError(err.message || 'The 3D model could not be loaded.'),
  );

  const handle: ModelViewerHandle = {
    view(name) {
      if (!stage) return;
      const target = new Vector3(0, stage.height / 2, 0);
      const to = new Vector3();
      if (name === 'reset' || !MODEL_VIEWS[name]) to.copy(home);
      else {
        const v = MODEL_VIEWS[name]!;
        const dist = camera.position.distanceTo(controls.target);
        const tmp = new PerspectiveCamera();
        placeCamera(tmp, target, Math.min(Math.max(dist, baseDist * 0.8), baseDist * 1.4), v.yaw, v.pitch);
        to.copy(tmp.position);
      }
      tween = { from: camera.position.clone(), to, fromT: controls.target.clone(), toT: target, start: win.performance.now(), dur: 750 };
      invalidate();
    },
    spin(on) {
      controls.autoRotate = on === undefined ? !controls.autoRotate : on;
      invalidate();
    },
    zoomBy(factor) {
      if (!stage) return;
      // Move the camera along its line of sight (smoothly, like the named views);
      // the same distance limits as wheel zooming apply.
      const fromT = tween ? tween.toT.clone() : controls.target.clone();
      const fromP = tween ? tween.to.clone() : camera.position.clone();
      const offset = fromP.clone().sub(fromT);
      const dist = offset.length() || baseDist;
      offset.setLength(zoomedDistance(dist, factor, controls.minDistance, controls.maxDistance));
      tween = {
        from: camera.position.clone(),
        to: fromT.clone().add(offset),
        fromT: controls.target.clone(),
        toT: fromT,
        start: win.performance.now(),
        dur: 280,
      };
      invalidate();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) win.cancelAnimationFrame(frame);
      ro?.disconnect();
      io?.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointerdown', arm);
      canvas.removeEventListener('pointerleave', disarm);
      canvas.removeEventListener('webglcontextlost', lost);
      stage?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
  restart = () => {
    handle.destroy();
    const fresh = createViewer(container, opts);
    Object.assign(handle, fresh);
  };
  return handle;
}

// ---------------- posters (editor canvas, thumbnails) ----------------

let shared: { renderer: WebGLRenderer; canvas: HTMLCanvasElement } | null = null;
const models = new Map<string, Promise<Object3D>>();
const posters = new Map<string, Promise<string>>();
const MAX_POSTERS = 40;

function sharedRenderer(opts: ModelViewOptions) {
  if (!shared || shared.renderer.getContext().isContextLost()) {
    const canvas = document.createElement('canvas');
    shared = { renderer: makeRenderer(canvas, opts, true), canvas };
  }
  shared.renderer.toneMappingExposure = EXPOSURE[opts.lighting] ?? 1;
  return shared.renderer;
}

async function poster(opts: PosterOptions): Promise<string> {
  const w = Math.max(16, Math.round(opts.width));
  const h = Math.max(16, Math.round(opts.height));
  const key = JSON.stringify([opts.data.length, opts.data.slice(-64), w, h, opts.lighting, opts.groundShadow, opts.yaw, opts.pitch, opts.zoom, opts.accent]);
  const hit = posters.get(key);
  if (hit) return hit;
  const job = (async () => {
    const modelKey = `${opts.data.length}:${opts.data.slice(-96)}`;
    let model = models.get(modelKey);
    if (!model) {
      model = parseGlb(opts.data);
      models.set(modelKey, model);
      model.catch(() => models.delete(modelKey));
      if (models.size > 6) models.delete(models.keys().next().value!);
    }
    const source = await model;
    let renderer: WebGLRenderer;
    try {
      renderer = sharedRenderer(opts);
    } catch (err) {
      throw new Error(webglMessage(err), { cause: err });
    }
    // Render a clone (shares geometry/materials) so the cached original stays untouched.
    const stage = buildStage(renderer, source.clone(true), opts);
    const scale = Math.min(2, Math.max(1, 900 / Math.max(w, h)));
    renderer.setPixelRatio(scale);
    renderer.setSize(w, h, false);
    const camera = new PerspectiveCamera(FOV, w / h, 0.01, 1000);
    const dist = fitDistance(stage.radius, w / h);
    camera.near = dist / 100;
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    placeCamera(camera, new Vector3(0, stage.height / 2, 0), dist / Math.max(0.3, Math.min(3, opts.zoom || 1)), opts.yaw, opts.pitch);
    renderer.render(stage.scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    // Only dispose what the clone created (environment, shadow); geometry/materials are shared with the cache.
    stage.scene.environment?.dispose();
    stage.scene.traverse((o) => {
      if ((o as Mesh).isMesh && (o as Mesh).geometry instanceof PlaneGeometry) disposeTree(o);
    });
    return url;
  })();
  posters.set(key, job);
  job.catch(() => posters.delete(key));
  if (posters.size > MAX_POSTERS) posters.delete(posters.keys().next().value!);
  return job;
}

export const model3dRuntime: Model3dRuntime = { create: createViewer, poster };
