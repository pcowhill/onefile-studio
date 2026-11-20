/**
 * GLB (binary glTF 2.0) inspection for 3D model assets (v4). Pure functions on
 * bytes — used when a model is uploaded (full check with friendly errors) and
 * on import (cheap header check). The renderer itself (src/runtime/model3d)
 * still treats every file as untrusted and reports load errors gracefully.
 */

export const GLB_MIME = 'model/gltf-binary';

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** Extensions three.js' GLTFLoader handles without extra decoders, workers or network access. */
export const SUPPORTED_EXTENSIONS = new Set([
  'KHR_lights_punctual',
  'KHR_materials_anisotropy',
  'KHR_materials_clearcoat',
  'KHR_materials_dispersion',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_volume',
  'KHR_mesh_quantization',
  'KHR_texture_transform',
  'EXT_materials_bump',
  'EXT_mesh_gpu_instancing',
  'EXT_texture_webp',
  'EXT_texture_avif',
]);

const EXTENSION_NAMES: Record<string, string> = {
  KHR_draco_mesh_compression: 'Draco mesh compression',
  EXT_meshopt_compression: 'meshopt compression',
  KHR_meshopt_compression: 'meshopt compression',
  KHR_texture_basisu: 'KTX2 / Basis textures',
};

export interface GlbInfo {
  meshes: number;
  triangles: number;
  materials: number;
  textures: number;
  animations: number;
  nodes: number;
  /** Optional extensions that are ignored (the model still shows). */
  ignoredExtensions: string[];
}

export type GlbCheck = { ok: true; info: GlbInfo } | { ok: false; error: string };

const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** True when the bytes start like a GLB 2.0 file. */
export function hasGlbHeader(b: Uint8Array): boolean {
  return b.length >= 20 && u32(b, 0) === MAGIC && u32(b, 4) === 2;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Full structural check of a GLB file, with a message an author can act on. */
export function inspectGlb(bytes: Uint8Array, name = 'This file'): GlbCheck {
  const fail = (why: string): GlbCheck => ({ ok: false, error: `“${name}” can't be used as a 3D model: ${why}` });
  if (bytes.length >= 4 && new TextDecoder().decode(bytes.subarray(0, 1)) === '{')
    return fail('it is a text glTF (.gltf). Please export a binary .glb file (with textures embedded) instead.');
  if (!hasGlbHeader(bytes)) return fail('it is not a binary glTF 2.0 (.glb) file.');
  const total = u32(bytes, 8);
  if (total > bytes.length || total < 20) return fail('the file is incomplete or damaged.');
  const jsonLen = u32(bytes, 12);
  if (u32(bytes, 16) !== CHUNK_JSON || 20 + jsonLen > total) return fail('the file is damaged (no readable scene description).');
  let json: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
    if (!isObj(parsed)) throw new Error('not an object');
    json = parsed;
  } catch {
    return fail('the file is damaged (its scene description is not valid).');
  }
  let binLen = 0;
  const binAt = 20 + jsonLen + ((4 - (jsonLen % 4)) % 4);
  if (binAt + 8 <= total && u32(bytes, binAt + 4) === CHUNK_BIN) binLen = Math.min(u32(bytes, binAt), total - binAt - 8);

  const asset = isObj(json.asset) ? json.asset : {};
  if (!String(asset.version ?? '').startsWith('2')) return fail('only glTF 2.0 models are supported.');

  const required = list(json.extensionsRequired).filter((x): x is string => typeof x === 'string');
  const missing = required.filter((x) => !SUPPORTED_EXTENSIONS.has(x));
  if (missing.length)
    return fail(
      `it needs ${missing.map((x) => EXTENSION_NAMES[x] ?? x).join(', ')}, which offline files can't decode. Export it again without compression (plain GLB).`,
    );

  const buffers = list(json.buffers);
  for (const [i, buf] of buffers.entries()) {
    if (!isObj(buf)) return fail('the file is damaged (invalid buffer).');
    if (typeof buf.uri === 'string')
      return fail(
        buf.uri.startsWith('data:')
          ? 'it stores its data as text inside the file. Export it again as a binary .glb.'
          : `it refers to a separate file (“${buf.uri.slice(0, 60)}”). Export it again as a single .glb with everything embedded.`,
      );
    if (i > 0) return fail('it uses more than one data buffer. Export it again as a single .glb.');
    if (Number(buf.byteLength) > binLen) return fail('the file is incomplete or damaged (missing geometry data).');
  }
  for (const img of list(json.images)) {
    if (!isObj(img)) continue;
    if (typeof img.uri === 'string') {
      if (!/^data:image\/(png|jpeg|webp|avif);base64,/.test(img.uri))
        return fail(`a texture is a separate file (“${img.uri.slice(0, 60)}”). Export it again with textures embedded in the .glb.`);
    } else if (typeof img.bufferView !== 'number') return fail('a texture has no image data.');
  }
  const views = list(json.bufferViews);
  for (const v of views) {
    if (!isObj(v)) return fail('the file is damaged (invalid data view).');
    const end = Number(v.byteOffset ?? 0) + Number(v.byteLength);
    if (!Number.isFinite(end) || end > binLen) return fail('the file is incomplete or damaged (data out of range).');
  }

  const accessors = list(json.accessors);
  let triangles = 0;
  let meshes = 0;
  for (const m of list(json.meshes)) {
    if (!isObj(m)) continue;
    meshes++;
    for (const p of list(m.primitives)) {
      if (!isObj(p)) continue;
      const mode = p.mode ?? 4;
      const count = (i: unknown) => (typeof i === 'number' && isObj(accessors[i]) ? Number((accessors[i] as Record<string, unknown>).count) || 0 : 0);
      const n = p.indices !== undefined ? count(p.indices) : count(isObj(p.attributes) ? p.attributes.POSITION : undefined);
      if (mode === 4) triangles += Math.floor(n / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, n - 2);
    }
  }
  if (!meshes) return fail('it contains no visible geometry.');
  const used = list(json.extensionsUsed).filter((x): x is string => typeof x === 'string');
  return {
    ok: true,
    info: {
      meshes,
      triangles,
      materials: list(json.materials).length,
      textures: list(json.textures).length,
      animations: list(json.animations).length,
      nodes: list(json.nodes).length,
      ignoredExtensions: used.filter((x) => !SUPPORTED_EXTENSIONS.has(x) && !required.includes(x)),
    },
  };
}

/** Cheap check for a base64 GLB data URL (header only; no full decode). */
export function isGlbDataUrl(data: string): boolean {
  const head = `data:${GLB_MIME};base64,`;
  if (!data.startsWith(head)) return false;
  try {
    const bin = atob(data.slice(head.length, head.length + 28));
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return hasGlbHeader(b);
  } catch {
    return false;
  }
}
