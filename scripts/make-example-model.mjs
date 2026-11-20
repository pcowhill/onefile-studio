#!/usr/bin/env node
/**
 * Generates the ORIGINAL 3D model used by the "Interactive 3D Explorer"
 * example: a small, stylized six-wheeled planetary rover. Every part is built
 * procedurally from three.js primitive geometries in this script (no
 * third-party assets), and the result is written as a self-contained binary
 * glTF 2.0 file. Released under the MIT licence like the rest of the repo.
 *
 *   node scripts/make-example-model.mjs
 *
 * Output (committed):
 *   src/examples/media/rover.glb – Y-up, front faces +Z, wheels rest on y=0,
 *                                  flat PBR colours, no textures/extensions.
 *
 * The output is deterministic: re-running the script yields identical bytes.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'src', 'examples', 'media', 'rover.glb');

// ---------------------------------------------------------------------------
// Materials (colours given in sRGB hex, stored as linear baseColorFactor)
// ---------------------------------------------------------------------------
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const round = (v) => Math.round(v * 1e5) / 1e5;
function material(name, hex, metallic, roughness) {
  const rgb = [16, 8, 0].map((s) => round(srgbToLinear(((hex >> s) & 255) / 255)));
  return {
    name,
    pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: metallic, roughnessFactor: roughness },
  };
}
const MATERIALS = {
  body: material('Off-white shell', 0xeae4d8, 0.0, 0.55),
  accent: material('Coral accent', 0xf06a3c, 0.0, 0.45),
  graphite: material('Graphite', 0x2b2e33, 0.2, 0.75),
  brass: material('Brushed brass', 0xd4a64c, 1.0, 0.32),
  metal: material('Satin aluminium', 0xa7adb5, 0.85, 0.38),
  solar: material('Solar cells', 0x1b2d6b, 0.35, 0.22),
  lens: material('Lens glass', 0x07090d, 0.0, 0.06),
};
const MATERIAL_KEYS = Object.keys(MATERIALS);

// ---------------------------------------------------------------------------
// Part registry: group name -> material key -> list of BufferGeometries
// ---------------------------------------------------------------------------
const GROUPS = ['Chassis', 'Wheels', 'Mast camera', 'Solar panel', 'Antenna dish', 'Robotic arm'];
const parts = Object.fromEntries(GROUPS.map((g) => [g, {}]));
let group = 'Chassis';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const deg = THREE.MathUtils.degToRad;

/** Transform a geometry (position, Euler rotation in degrees, scale) and file it. */
function add(mat, geom, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(
    V(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(rot[0]), deg(rot[1]), deg(rot[2]))),
    V(...scale),
  );
  geom.applyMatrix4(m);
  (parts[group][mat] ??= []).push(geom);
  return geom;
}
/** Same as add() but with an explicit quaternion. */
function addQ(mat, geom, pos, quat) {
  geom.applyMatrix4(new THREE.Matrix4().compose(pos, quat, V(1, 1, 1)));
  (parts[group][mat] ??= []).push(geom);
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
const cyl = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Rectangular beam between two points (cross-section w x h). */
function beam(mat, a, b, w, h) {
  const dir = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir.clone().normalize());
  addQ(mat, rbox(w, h, dir.length() + w * 0.5, Math.min(w, h) * 0.35, 2), a.clone().add(b).multiplyScalar(0.5), q);
}
/** Round rod between two points. */
function rod(mat, a, b, r, seg = 16) {
  const dir = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  addQ(mat, cyl(r, r, dir.length(), seg), a.clone().add(b).multiplyScalar(0.5), q);
}
/** Cylinder whose axis runs along X (pivots, axles, wheel parts). */
const xcyl = (mat, r, len, pos, seg = 20) => add(mat, cyl(r, r, len, seg), pos, [0, 0, 90]);
/** Cylinder whose axis runs along Z (lenses). */
const zcyl = (mat, r, len, pos, seg = 20) => add(mat, cyl(r, r, len, seg), pos, [90, 0, 0]);

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------
const TIRE_R = 0.2;
const CLEAT = 0.024;
const WHEEL_Y = TIRE_R + CLEAT; // so the cleats touch y = 0
const WHEEL_W = 0.17;
const WHEEL_X = 0.75;
const WHEEL_Z = [0.82, 0, -0.82];
const ARM_X = 0.575; // plane of the rocker-bogie beams
const BODY = { w: 1.0, h: 0.34, d: 1.46, y: 0.68, z: -0.05 };
const BODY_TOP = BODY.y + BODY.h / 2;
const BODY_FRONT = BODY.z + BODY.d / 2;
const DECK_Y = BODY_TOP + 0.075; // top surface of the solar deck

// ---------------------------------------------------------------------------
// Chassis
// ---------------------------------------------------------------------------
group = 'Chassis';
add('body', rbox(BODY.w, BODY.h, BODY.d, 0.06, 3), [0, BODY.y, BODY.z]);
// coral belt wrapping the body
add('accent', rbox(BODY.w + 0.014, 0.065, BODY.d + 0.014, 0.035, 2), [0, BODY.y - 0.06, BODY.z]);
// graphite belly pan
add('graphite', rbox(BODY.w - 0.08, 0.06, BODY.d - 0.1, 0.02, 2), [0, BODY.y - BODY.h / 2 - 0.02, BODY.z]);
// front sensor bar with two hazard cameras
add('graphite', rbox(0.42, 0.09, 0.03, 0.012, 2), [-0.18, BODY.y + 0.06, BODY_FRONT + 0.01]);
for (const x of [-0.29, -0.07]) {
  zcyl('brass', 0.03, 0.02, [x, BODY.y + 0.06, BODY_FRONT + 0.03]);
  zcyl('lens', 0.021, 0.02, [x, BODY.y + 0.06, BODY_FRONT + 0.04]);
}
// gold thermal-blanket box and vents at the back
add('brass', rbox(0.56, 0.2, 0.08, 0.025, 2), [0, BODY.y + 0.01, BODY.z - BODY.d / 2 - 0.03]);
for (let i = 0; i < 4; i++) add('graphite', box(0.44, 0.012, 0.01), [0, BODY.y - 0.05 + i * 0.035, BODY.z - BODY.d / 2 - 0.07]);
// side access panels (slightly raised) with brass bolts
for (const s of [-1, 1]) {
  for (const z of [-0.42, 0.3]) {
    add('body', rbox(0.02, 0.13, 0.36, 0.008, 2), [s * (BODY.w / 2 + 0.006), BODY.y + 0.07, z]);
    for (const dz of [-0.15, 0.15]) xcyl('brass', 0.012, 0.012, [s * (BODY.w / 2 + 0.02), BODY.y + 0.07, z + dz], 10);
  }
}
// deck stand-offs
for (const x of [-0.38, 0.38]) for (const z of [-0.6, 0.0, 0.5]) add('metal', cyl(0.025, 0.025, 0.06, 12), [x, BODY_TOP + 0.03, z]);

// ---------------------------------------------------------------------------
// Solar panel deck: dark-blue cells with a raised silver grid
// ---------------------------------------------------------------------------
group = 'Solar panel';
const DECK = { w: 1.22, d: 1.62, z: -0.08 };
add('body', rbox(DECK.w, 0.04, DECK.d, 0.015, 2), [0, DECK_Y - 0.02, DECK.z]);
add('solar', box(DECK.w - 0.06, 0.008, DECK.d - 0.06), [0, DECK_Y + 0.004, DECK.z]);
{
  const cw = DECK.w - 0.06;
  const cd = DECK.d - 0.06;
  const cols = 6;
  const rows = 8;
  for (let i = 0; i <= cols; i++) add('metal', box(0.007, 0.005, cd), [-cw / 2 + (i * cw) / cols, DECK_Y + 0.0095, DECK.z]);
  for (let j = 0; j <= rows; j++) add('metal', box(cw, 0.005, 0.007), [0, DECK_Y + 0.0095, DECK.z - cd / 2 + (j * cd) / rows]);
  // a thin busbar halfway through each cell row
  for (let j = 0; j < rows; j++) add('metal', box(cw, 0.003, 0.003), [0, DECK_Y + 0.009, DECK.z - cd / 2 + ((j + 0.5) * cd) / rows]);
}
// coral edge trim at the front of the deck
add('accent', rbox(DECK.w + 0.01, 0.05, 0.05, 0.02, 2), [0, DECK_Y - 0.02, DECK.z + DECK.d / 2]);

// ---------------------------------------------------------------------------
// Mast with the camera head ("eyes")
// ---------------------------------------------------------------------------
group = 'Mast camera';
const MAST = { x: -0.3, z: 0.46, top: 1.6 };
add('graphite', cyl(0.07, 0.085, 0.05, 24), [MAST.x, DECK_Y + 0.025, MAST.z]);
add('body', cyl(0.034, 0.04, MAST.top - DECK_Y, 20), [MAST.x, (MAST.top + DECK_Y) / 2, MAST.z]);
add('accent', new THREE.TorusGeometry(0.042, 0.012, 10, 24), [MAST.x, DECK_Y + 0.22, MAST.z], [90, 0, 0]);
add('brass', cyl(0.05, 0.05, 0.05, 20), [MAST.x, MAST.top, MAST.z]);
// pan/tilt yoke
for (const s of [-1, 1]) add('graphite', rbox(0.025, 0.12, 0.07, 0.01, 2), [MAST.x + s * 0.165, MAST.top + 0.075, MAST.z]);
add('graphite', rbox(0.35, 0.03, 0.07, 0.012, 2), [MAST.x, MAST.top + 0.025, MAST.z]);
xcyl('brass', 0.025, 0.37, [MAST.x, MAST.top + 0.12, MAST.z], 16);
{
  const hy = MAST.top + 0.14;
  add('body', rbox(0.29, 0.165, 0.18, 0.05, 3), [MAST.x, hy, MAST.z + 0.01]);
  // coral "brow"
  add('accent', rbox(0.31, 0.036, 0.2, 0.016, 2), [MAST.x, hy + 0.09, MAST.z + 0.01]);
  const fz = MAST.z + 0.01 + 0.09;
  for (const s of [-1, 1]) {
    const lx = MAST.x + s * 0.068;
    zcyl('graphite', 0.054, 0.04, [lx, hy - 0.005, fz + 0.012], 28);
    add('brass', new THREE.TorusGeometry(0.049, 0.008, 8, 28), [lx, hy - 0.005, fz + 0.033]);
    add('lens', new THREE.SphereGeometry(0.043, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), [lx, hy - 0.005, fz + 0.03], [90, 0, 0], [1, 0.45, 1]);
    // little highlight dot so the eyes read even in flat light
    add('body', new THREE.SphereGeometry(0.008, 10, 6), [lx + 0.016, hy + 0.012, fz + 0.047]);
  }
  // small whip antenna on the head
  rod('metal', V(MAST.x + 0.1, hy + 0.1, MAST.z - 0.04), V(MAST.x + 0.1, hy + 0.25, MAST.z - 0.04), 0.005, 8);
  add('accent', new THREE.SphereGeometry(0.014, 12, 8), [MAST.x + 0.1, hy + 0.255, MAST.z - 0.04]);
}

// ---------------------------------------------------------------------------
// High-gain antenna dish
// ---------------------------------------------------------------------------
group = 'Antenna dish';
{
  const base = V(0.3, DECK_Y, -0.5);
  const pivot = V(0.3, DECK_Y + 0.24, -0.5);
  add('graphite', cyl(0.06, 0.07, 0.04, 20), [base.x, base.y + 0.02, base.z]);
  rod('metal', base, pivot, 0.022, 16);
  add('brass', new THREE.SphereGeometry(0.04, 18, 12), [pivot.x, pivot.y, pivot.z]);

  // Dish: closed shallow paraboloid shell built with a lathe.
  const R = 0.25;
  const depth = 0.075;
  const t = 0.012;
  const N = 14;
  const prof = [];
  for (let i = 0; i <= N; i++) { const r = 0.001 + (R * i) / N; prof.push(new THREE.Vector2(r, depth * (r / R) ** 2 - t)); }
  prof.push(new THREE.Vector2(R + 0.006, depth - t * 0.4), new THREE.Vector2(R + 0.006, depth));
  for (let i = N; i >= 0; i--) { const r = 0.001 + (R * i) / N; prof.push(new THREE.Vector2(r, depth * (r / R) ** 2 + 0.0005)); }
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(-40), deg(-25), 0, 'YXZ'));
  const up = V(0, 1, 0).applyQuaternion(tilt);
  const dishC = pivot.clone().add(up.clone().multiplyScalar(0.05));
  addQ('body', new THREE.LatheGeometry(prof, 40), dishC, tilt);
  const rim = new THREE.TorusGeometry(R + 0.006, 0.01, 6, 40);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, depth, 0);
  addQ('accent', rim, dishC, tilt);
  // feed horn on three struts
  const feed = dishC.clone().add(up.clone().multiplyScalar(0.17));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const foot = V(Math.cos(a) * R * 0.85, depth * 0.72, Math.sin(a) * R * 0.85).applyQuaternion(tilt).add(dishC);
    rod('metal', foot, feed, 0.005, 6);
  }
  addQ('brass', cyl(0.018, 0.034, 0.05, 18), feed, tilt);
  addQ('graphite', cyl(0.012, 0.012, 0.03, 12), dishC.clone().add(up.clone().multiplyScalar(0.01)), tilt);
}

// ---------------------------------------------------------------------------
// Robotic arm (folded forward, tool pointing at the ground)
// ---------------------------------------------------------------------------
group = 'Robotic arm';
{
  const x = 0.26;
  const shoulder = V(x, BODY.y + 0.02, BODY_FRONT + 0.06);
  const elbow = V(x, BODY.y + 0.2, BODY_FRONT + 0.34);
  const wrist = V(x, BODY.y - 0.12, BODY_FRONT + 0.5);
  add('graphite', rbox(0.14, 0.12, 0.06, 0.02, 2), [x, shoulder.y, BODY_FRONT + 0.02]);
  xcyl('accent', 0.055, 0.13, [shoulder.x, shoulder.y, shoulder.z], 24);
  beam('body', shoulder, elbow, 0.065, 0.075);
  xcyl('accent', 0.048, 0.12, [elbow.x, elbow.y, elbow.z], 24);
  beam('body', elbow, wrist, 0.055, 0.065);
  xcyl('accent', 0.042, 0.1, [wrist.x, wrist.y, wrist.z], 24);
  // brass cable conduit alongside the arm
  rod('brass', shoulder.clone().add(V(0.05, 0.02, 0)), elbow.clone().add(V(0.05, 0, 0)), 0.008, 8);
  rod('brass', elbow.clone().add(V(0.05, 0, 0)), wrist.clone().add(V(0.05, 0, 0)), 0.008, 8);
  // tool turret: drill bit + small two-finger scoop
  const ty = wrist.y - 0.08;
  add('graphite', cyl(0.05, 0.05, 0.07, 20), [wrist.x, ty, wrist.z]);
  add('brass', cyl(0.056, 0.056, 0.015, 20), [wrist.x, ty + 0.03, wrist.z]);
  add('metal', cyl(0.018, 0.018, 0.04, 12), [wrist.x, ty - 0.055, wrist.z]);
  add('brass', new THREE.ConeGeometry(0.018, 0.08, 12), [wrist.x, ty - 0.115, wrist.z], [180, 0, 0]);
  for (const s of [-1, 1]) add('metal', box(0.012, 0.07, 0.022), [wrist.x + s * 0.04, ty - 0.06, wrist.z + 0.025], [0, 0, s * 12]);
}

// ---------------------------------------------------------------------------
// Wheels and rocker-bogie suspension
// ---------------------------------------------------------------------------
group = 'Wheels';
function wheel(s, z) {
  const cx = s * WHEEL_X;
  xcyl('graphite', TIRE_R, WHEEL_W, [cx, WHEEL_Y, z], 32);
  // tread cleats: chevron pairs around the rim
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = TIRE_R + CLEAT / 2 - 0.002;
    for (const side of [-1, 1]) {
      add('graphite', box(WHEEL_W * 0.52, CLEAT, 0.03),
        [cx + side * WHEEL_W * 0.24, WHEEL_Y + Math.cos(a) * r, z + Math.sin(a) * r],
        [THREE.MathUtils.radToDeg(a), side * 14, 0]);
    }
  }
  // outer face: aluminium disc, five spokes, brass hub cap
  const face = cx + s * (WHEEL_W / 2);
  xcyl('metal', TIRE_R * 0.78, 0.012, [face, WHEEL_Y, z], 32);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    add('graphite', box(0.016, TIRE_R * 0.62, 0.026),
      [face + s * 0.01, WHEEL_Y + Math.cos(a) * TIRE_R * 0.42, z + Math.sin(a) * TIRE_R * 0.42],
      [THREE.MathUtils.radToDeg(a), 0, 0]);
  }
  xcyl('brass', 0.05, 0.04, [face + s * 0.012, WHEEL_Y, z], 20);
  xcyl('graphite', 0.022, 0.02, [face + s * 0.04, WHEEL_Y, z], 16);
  // inner axle stub to the suspension leg
  xcyl('metal', 0.022, WHEEL_X - ARM_X, [s * (WHEEL_X + ARM_X) / 2 - s * 0.03, WHEEL_Y, z], 14);
}
for (const s of [-1, 1]) {
  for (const z of WHEEL_Z) wheel(s, z);
  const ax = s * ARM_X;
  const P = V(ax, 0.62, 0.06); // rocker pivot on the body
  const F = V(ax, 0.55, 0.8); // front knee
  const B = V(ax, 0.47, -0.4); // bogie pivot
  const M = V(ax, 0.43, 0.02);
  const Rr = V(ax, 0.43, -0.82);
  beam('graphite', P, F, 0.05, 0.065);
  beam('graphite', P, B, 0.05, 0.065);
  beam('graphite', B, M, 0.045, 0.055);
  beam('graphite', B, Rr, 0.045, 0.055);
  for (const [knee, wz] of [[F, WHEEL_Z[0]], [M, WHEEL_Z[1]], [Rr, WHEEL_Z[2]]]) {
    beam('graphite', knee, V(ax, WHEEL_Y, wz), 0.045, 0.045);
    xcyl('accent', 0.03, 0.07, [ax, knee.y, knee.z], 18);
  }
  // pivots: brass shaft into the body, coral caps
  xcyl('brass', 0.03, ARM_X - BODY.w / 2 + 0.04, [s * (ARM_X + BODY.w / 2) / 2, P.y, P.z], 18);
  xcyl('accent', 0.05, 0.08, [ax, P.y, P.z], 24);
  xcyl('accent', 0.042, 0.075, [ax, B.y, B.z], 24);
  xcyl('brass', 0.02, 0.09, [ax + s * 0.01, B.y, B.z], 14);
}

// ---------------------------------------------------------------------------
// Merge per group/material, centre the model, and write the GLB
// ---------------------------------------------------------------------------
/** Concatenate geometries into one indexed primitive, welding identical vertices. */
function mergeToArrays(geoms) {
  const pos = [];
  const nor = [];
  const idx = [];
  const seen = new Map();
  const q = (v) => Math.round(v * 1e5);
  for (const g of geoms) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const remap = new Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const nn = V(n.getX(i), n.getY(i), n.getZ(i)).normalize();
      const v = [p.getX(i), p.getY(i), p.getZ(i), nn.x, nn.y, nn.z];
      const key = v.map((c, k) => (k < 3 ? q(c) : Math.round(c * 1e3))).join(',');
      let id = seen.get(key);
      if (id === undefined) {
        id = pos.length / 3;
        seen.set(key, id);
        pos.push(v[0], v[1], v[2]);
        nor.push(v[3], v[4], v[5]);
      }
      remap[i] = id;
    }
    const count = g.index ? g.index.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const t = [0, 1, 2].map((k) => remap[g.index ? g.index.getX(i + k) : i + k]);
      if (t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) idx.push(...t); // drop degenerate triangles
    }
  }
  const nv = pos.length / 3;
  return {
    pos: new Float32Array(pos),
    nor: new Float32Array(nor),
    idx: nv > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
  };
}

// centre horizontally, rest on y = 0
const bbox = new THREE.Box3();
for (const gname of GROUPS) for (const list of Object.values(parts[gname])) for (const g of list) { g.computeBoundingBox(); bbox.union(g.boundingBox); }
const shift = V(-(bbox.min.x + bbox.max.x) / 2, -bbox.min.y, -(bbox.min.z + bbox.max.z) / 2);
for (const gname of GROUPS) for (const list of Object.values(parts[gname])) for (const g of list) g.translate(shift.x, shift.y, shift.z);

const chunks = [];
let byteOffset = 0;
const gltf = {
  asset: { version: '2.0', generator: 'OneFile Studio scripts/make-example-model.mjs' },
  scene: 0,
  scenes: [{ name: 'Scene', nodes: [0] }],
  nodes: [{ name: 'Rover', children: GROUPS.map((_, i) => i + 1) }],
  meshes: [],
  materials: MATERIAL_KEYS.map((k) => MATERIALS[k]),
  accessors: [],
  bufferViews: [],
  buffers: [],
};
function pushView(typed, target) {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (bytes.byteLength % 4)) % 4;
  chunks.push(bytes, new Uint8Array(pad));
  gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target });
  byteOffset += bytes.byteLength + pad;
  return gltf.bufferViews.length - 1;
}
function pushAccessor(def) {
  gltf.accessors.push(def);
  return gltf.accessors.length - 1;
}
let triangles = 0;
GROUPS.forEach((gname, gi) => {
  const primitives = [];
  for (const mkey of MATERIAL_KEYS) {
    const list = parts[gname][mkey];
    if (!list) continue;
    const { pos, nor, idx } = mergeToArrays(list);
    const count = pos.length / 3;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i++) {
      min[i % 3] = Math.min(min[i % 3], pos[i]);
      max[i % 3] = Math.max(max[i % 3], pos[i]);
    }
    const POSITION = pushAccessor({ bufferView: pushView(pos, 34962), componentType: 5126, count, type: 'VEC3', min, max });
    const NORMAL = pushAccessor({ bufferView: pushView(nor, 34962), componentType: 5126, count, type: 'VEC3' });
    const indices = pushAccessor({
      bufferView: pushView(idx, 34963),
      componentType: idx instanceof Uint32Array ? 5125 : 5123,
      count: idx.length,
      type: 'SCALAR',
    });
    triangles += idx.length / 3;
    primitives.push({ attributes: { POSITION, NORMAL }, indices, material: MATERIAL_KEYS.indexOf(mkey), mode: 4 });
  }
  gltf.meshes.push({ name: gname, primitives });
  gltf.nodes.push({ name: gname, mesh: gi });
});
gltf.buffers.push({ byteLength: byteOffset });

const bin = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
let json = Buffer.from(JSON.stringify(gltf), 'utf8');
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
const total = 12 + 8 + json.length + 8 + bin.length;
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(json.length, 0);
jsonHead.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(bin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([header, jsonHead, json, binHead, bin]));
const size = new THREE.Vector3();
bbox.getSize(size);
console.log(`wrote ${OUT}: ${total} bytes, ${triangles} triangles, ` +
  `size ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`);
