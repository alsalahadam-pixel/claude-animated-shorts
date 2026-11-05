// Procedural props: cars, CCTV cameras, street lamps, traffic lights, neon signs, café set, light shafts, dust.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { neonSign, radial, rng, streak } from "./paint";

export const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o });
export const glow = (color: string, k = 2.5) => {
  const m = new THREE.MeshBasicMaterial({ color }); m.color.multiplyScalar(k); return m;
};
export const rbox = (w: number, h: number, d: number, r = 0.08, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);

export function mesh(g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], shadow = true) {
  const o = new THREE.Mesh(g, m); o.position.set(...p); o.castShadow = shadow; o.receiveShadow = true; return o;
}

// ---------------------------------------------------------------- car
const CAR_COLS = ["#2b3550", "#5a5f6e", "#6b2b35", "#c9c6c0", "#2f5a5c", "#3b2f4a", "#8a8f99"];
export function car(seed: number, o: { doorOpen?: boolean; lights?: number; tail?: number } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const col = CAR_COLS[Math.floor(r() * CAR_COLS.length)];
  const paint = std(col, { roughness: 0.32, metalness: 0.35 });
  const glass = std("#0b0e18", { roughness: 0.08, metalness: 0.6 });
  const len = 4.2 + r() * 0.5, wid = 1.82, h = 0.72;
  g.add(mesh(rbox(len, h, wid, 0.18), paint, [0, 0.36 + h / 2, 0]));
  const cab = mesh(rbox(len * 0.52, 0.62, wid * 0.9, 0.2), glass, [-0.15, 0.36 + h + 0.27, 0]);
  g.add(cab);
  g.add(mesh(rbox(len * 0.5, 0.06, wid * 0.86, 0.03), paint, [-0.15, 0.36 + h + 0.6, 0]));
  const tyre = std("#121218", { roughness: 0.9 });
  const rim = std("#7a7f8a", { metalness: 0.7, roughness: 0.35 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18), tyre, [sx * len * 0.32, 0.34, sz * (wid / 2 - 0.08)]);
    w.rotation.x = Math.PI / 2; g.add(w);
    const hb = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 12), rim, [sx * len * 0.32, 0.34, sz * (wid / 2 - 0.07)]);
    hb.rotation.x = Math.PI / 2; g.add(hb);
  }
  // head and tail lights (front = +x)
  const hl = o.lights ?? 0, tl = o.tail ?? 0;
  for (const sz of [-1, 1]) {
    g.add(mesh(rbox(0.06, 0.12, 0.34, 0.03), hl > 0 ? glow("#ffe9c0", 1 + hl * 3) : std("#d8d8d0", { roughness: 0.2 }), [len / 2, 0.86, sz * 0.62], false));
    g.add(mesh(rbox(0.06, 0.12, 0.38, 0.03), tl > 0 ? glow("#ff3030", 0.6 + tl * 3) : std("#5a1418", { roughness: 0.3 }), [-len / 2, 0.88, sz * 0.62], false));
  }
  if (o.doorOpen) {
    const door = new THREE.Group();
    door.add(mesh(rbox(1.05, 0.62, 0.06, 0.03), paint, [0.52, 0.0, 0]));
    door.add(mesh(rbox(0.9, 0.42, 0.04, 0.03), glass, [0.5, 0.5, 0]));
    door.position.set(0.25, 0.36 + h / 2, wid / 2);
    door.rotation.y = -1.0;
    g.add(door);
  }
  return g;
}

// ---------------------------------------------------------------- CCTV
export type Cctv = { group: THREE.Group; pan: THREE.Group; tilt: THREE.Group; led: THREE.Mesh; rest: { yaw: number; pitch: number } };
/** A bullet security camera, mounted the way installers do it:
 *  - pole: on top of its own pole (height `pole`)
 *  - wall: wall plate, a horizontal arm out from the wall (local +z) with a diagonal brace, a swivel, and the cable
 *    looping back to the plate; the group sits on the wall surface with +z pointing out into the street
 *  - pendant: clamped under a horizontal arm (traffic-light / lamp arm), hanging below it
 *  `rest` is the head's resting aim in the group's local frame (yaw around +y from +z, pitch + = down). */
export function cctv(o: { pole?: number; mount?: "pole" | "wall" | "pendant"; rest?: { yaw: number; pitch: number } } = {}): Cctv {
  const group = new THREE.Group();
  const metal = std("#c9ccd3", { roughness: 0.4, metalness: 0.3 });
  const dark = std("#1a1c24", { roughness: 0.5, metalness: 0.4 });
  const mount = o.mount ?? (o.pole ? "pole" : "wall");
  const pan = new THREE.Group(); group.add(pan);
  if (mount === "pole") {
    const h = o.pole ?? 4.2;
    group.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 10), dark, [0, h / 2, 0]));
    group.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), dark, [0, h + 0.02, 0]));          // top cap
    pan.position.set(0, h + 0.05, 0);
    pan.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), dark, [0, 0.03, 0]));            // swivel
  } else if (mount === "wall") {
    group.add(mesh(rbox(0.17, 0.27, 0.035, 0.01), dark, [0, 0, 0.018]));                             // wall plate
    for (const [x, y] of [[-0.055, 0.1], [0.055, 0.1], [-0.055, -0.1], [0.055, -0.1]]) group.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6), metal, [x, y, 0.04], false).rotateX(Math.PI / 2));
    const arm = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.4, 10), dark, [0, 0.05, 0.23]); arm.rotation.x = Math.PI / 2; group.add(arm);
    const br0 = new THREE.Vector3(0, -0.11, 0.04), br1 = new THREE.Vector3(0, 0.04, 0.27);
    const brace = mesh(new THREE.CylinderGeometry(0.014, 0.014, br0.distanceTo(br1), 8), dark, [0, (br0.y + br1.y) / 2, (br0.z + br1.z) / 2]);
    brace.rotation.x = Math.atan2(br1.z - br0.z, br1.y - br0.y); group.add(brace);
    group.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12), dark, [0, 0.08, 0.43]));      // swivel at the arm's end
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 0.07, 0.4), new THREE.Vector3(0.05, -0.02, 0.33), new THREE.Vector3(0.04, -0.06, 0.16), new THREE.Vector3(0.03, -0.05, 0.04)]), 12, 0.008, 5);
    group.add(mesh(cable, dark, [0, 0, 0], false));
    pan.position.set(0, 0.11, 0.43);
  } else {
    // pendant: clamp on the arm above, a short drop pipe, the head below
    group.add(mesh(rbox(0.11, 0.07, 0.16, 0.02), dark, [0, 0.3, 0]));
    group.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.25, 8), dark, [0, 0.15, 0]));
    pan.position.set(0, 0.0, 0);
  }
  pan.add(mesh(rbox(0.16, 0.05, 0.16, 0.02), dark, [0, 0.0, 0]));
  const tilt = new THREE.Group(); tilt.position.set(0, mount === "pendant" ? -0.02 : 0.04, 0); pan.add(tilt);
  // housing points along +z
  const hy = mount === "pendant" ? 0.1 : 0.1;
  tilt.add(mesh(rbox(0.22, 0.2, 0.52, 0.05), metal, [0, hy, 0.12]));
  tilt.add(mesh(rbox(0.26, 0.03, 0.62, 0.02), metal, [0, hy + 0.115, 0.16]));      // sun hood
  tilt.add(mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.06, 20), dark, [0, hy, 0.39]).rotateX(Math.PI / 2));
  const lens = mesh(new THREE.SphereGeometry(0.055, 18, 12), std("#05060c", { roughness: 0.05, metalness: 0.9 }), [0, hy, 0.41], false);
  lens.scale.z = 0.5; tilt.add(lens);
  const led = mesh(new THREE.SphereGeometry(0.014, 10, 8), glow("#ff2a2a", 6), [0.075, hy + 0.06, 0.38], false);
  tilt.add(led);
  if (mount === "pendant") { pan.position.y = 0.0; tilt.position.y = -0.24; }
  const c: Cctv = { group, pan, tilt, led, rest: o.rest ?? { yaw: 0, pitch: 0.3 } };
  aimCctvRest(c);
  return c;
}
/** put a camera in its resting pose */
export function aimCctvRest(c: Cctv) { c.pan.rotation.set(0, c.rest.yaw, 0); c.tilt.rotation.set(c.rest.pitch, 0, 0); }
/** aim a CCTV head at a world point: k = 0 keeps the rest pose `from`, k = 1 looks straight at the target.
 *  Pure function of its inputs (no state carried between frames), so any frame renders the same on its own. */
export function aimCctv(c: Cctv, target: THREE.Vector3, k: number, from: { yaw: number; pitch: number } = { yaw: 0, pitch: 0.2 }) {
  c.pan.rotation.set(0, 0, 0); c.tilt.rotation.set(0, 0, 0);
  c.group.updateMatrixWorld(true);
  const p = new THREE.Vector3(); c.pan.getWorldPosition(p);
  const local = c.group.worldToLocal(target.clone()).sub(c.group.worldToLocal(p.clone()));
  const yaw = Math.atan2(local.x, local.z);
  const pitch = -Math.atan2(local.y, Math.hypot(local.x, local.z));
  let dy = yaw - from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  c.pan.rotation.y = from.yaw + dy * k;
  c.tilt.rotation.x = from.pitch + (pitch - from.pitch) * k;
}

// ---------------------------------------------------------------- street furniture
export function streetLamp(on: number) {
  const g = new THREE.Group();
  const dark = std("#22252e", { roughness: 0.55, metalness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.14, 7.2, 10), dark, [0, 3.6, 0]));
  const arm = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 8), dark, [0.8, 7.1, 0]); arm.rotation.z = Math.PI / 2; g.add(arm);
  g.add(mesh(rbox(0.75, 0.16, 0.34, 0.05), dark, [1.55, 7.05, 0]));
  const bulb = mesh(rbox(0.6, 0.04, 0.24, 0.02), on > 0 ? glow("#ffb060", 1.5 + on * 4) : std("#9a9480"), [1.55, 6.96, 0], false);
  g.add(bulb);
  if (on > 0) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6.8, 24, 1, true), shaftMat("#ffa050", 0.16 * on, 6.8, 0, 0.9));
    cone.position.set(1.55, 3.55, 0); g.add(cone);
  }
  return g;
}

export function trafficLight(state: "red" | "off", span = 6) {
  const g = new THREE.Group();
  const dark = std("#1d2028", { roughness: 0.5, metalness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 6, 10), dark, [0, 3, 0]));
  const arm = mesh(new THREE.CylinderGeometry(0.07, 0.07, span, 8), dark, [span / 2, 5.8, 0]); arm.rotation.z = Math.PI / 2; g.add(arm);
  const head = new THREE.Group(); head.position.set(span - 0.4, 5.2, 0); g.add(head);
  head.add(mesh(rbox(0.42, 1.25, 0.36, 0.06), std("#262a33", { roughness: 0.4 })));
  const cols: [string, number][] = [["#ff2a1a", 0.38], ["#ffb000", 0], ["#20ff90", -0.38]];
  for (const [c, y] of cols) {
    const lit = state === "red" && c === "#ff2a1a";
    const lamp = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 20), lit ? glow(c, 6) : std("#1a1414", { roughness: 0.2 }), [0, y, 0.19], false);
    lamp.rotation.x = Math.PI / 2; head.add(lamp);
    const visor = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 16, 1, true, 0, Math.PI), dark, [0, y + 0.02, 0.27]);
    visor.rotation.x = Math.PI / 2; visor.rotation.y = Math.PI; head.add(visor);
    if (lit) {
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: radial("rgba(255,60,40,0.55)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(0, y, 0.3); head.add(halo);
    }
  }
  return { group: g, head };
}

export function neon(text: string, color: string, w: number, h: number, k = 2.2, font?: string) {
  const g = new THREE.Group();
  const t = neonSign(text, color, 1024, 256, font);
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: true });
  m.color.setScalar(k);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); g.add(p);
  const back = mesh(rbox(w * 0.96, h * 0.86, 0.08, 0.03), std("#0d0d14", { roughness: 0.6 }), [0, 0, -0.06], false);
  g.add(back);
  return g;
}

/** fake wet-road reflection under a light source: an additive vertical streak lying on the road */
export function wetStreak(color: string, w: number, l: number, k = 1) {
  const m = new THREE.MeshBasicMaterial({ map: streak(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.color.multiplyScalar(k);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), m);
  p.rotation.x = -Math.PI / 2; p.position.y = 0.012;
  p.geometry.translate(0, -l / 2, 0);
  return p;
}

// ---------------------------------------------------------------- café
export function cafeSet() {
  const g = new THREE.Group();
  const metal = std("#2a2d36", { metalness: 0.6, roughness: 0.4 });
  const top = std("#d9d2c6", { roughness: 0.35 });
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 32), top, [0, 0.74, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), metal, [0, 0.37, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), metal, [0, 0.01, 0]));
  // plate with a half-eaten meal
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.015, 32), std("#f2efe8", { roughness: 0.2 }), [-0.1, 0.765, 0.05]));
  const food = std("#b5683a", { roughness: 0.7 });
  const bun = mesh(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 1.25), food, [-0.12, 0.78, 0.06]); bun.scale.y = 0.55; g.add(bun);
  for (let i = 0; i < 5; i++) g.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.07), std("#e2b84a"), [-0.02 + i * 0.012, 0.778, 0.0 + (i % 2) * 0.02]));
  const fork = mesh(new THREE.BoxGeometry(0.17, 0.004, 0.012), std("#c0c4cc", { metalness: 0.9, roughness: 0.2 }), [-0.02, 0.775, 0.16]); fork.rotation.y = 0.5; g.add(fork);
  // coffee cup + saucer
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.01, 24), std("#f2efe8", { roughness: 0.25 }), [0.18, 0.762, -0.08]));
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.075, 24), std("#f2efe8", { roughness: 0.25 }), [0.18, 0.805, -0.08]));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.005, 24), std("#3a2216", { roughness: 0.1 }), [0.18, 0.835, -0.08], false));
  const handle = mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16), std("#f2efe8"), [0.23, 0.805, -0.08]); g.add(handle);
  // chairs
  for (const [x, z, ry] of [[0.62, 0.1, -1.2], [-0.55, -0.4, 2.3]] as [number, number, number][]) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry;
    c.add(mesh(rbox(0.42, 0.04, 0.42, 0.015), metal, [0, 0.46, 0]));
    c.add(mesh(rbox(0.42, 0.42, 0.03, 0.015), metal, [0, 0.68, -0.2]));
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) c.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.46, 6), metal, [lx, 0.23, lz]));
    g.add(c);
  }
  return g;
}

// ---------------------------------------------------------------- light shafts, dust, blobs
const shaftVS = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
#include <common>
#include <fog_pars_vertex>
void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const shaftFS = /* glsl */ `
uniform vec3 color; uniform float k; uniform float len; uniform float time; uniform float stripes; uniform float edge;
varying vec2 vUv; varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main() {
  float along = vUv.y;                                // 1 at the source, 0 at the far end
  float across = abs(vUv.x - 0.5) * 2.0;
  float a = smoothstep(1.0, 1.0 - edge, across) * pow(along, 0.8) * smoothstep(0.0, 0.25, 1.0 - along + 0.02);
  if (stripes > 0.0) a *= smoothstep(0.25, 0.6, sin(vUv.x * stripes * 6.2832) * 0.5 + 0.5);
  a *= 0.65 + 0.7 * vnoise(vec2(vUv.x * 9.0 + time * 0.05, vUv.y * 3.0 - time * 0.02));
  gl_FragColor = vec4(color * k * a, 1.0);
#include <fog_fragment>
}`;
export function shaftMat(color: string, k: number, len: number, stripes = 0, edge = 0.6) {
  return new THREE.ShaderMaterial({
    vertexShader: shaftVS, fragmentShader: shaftFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), color: { value: new THREE.Color(color) }, k: { value: k }, len: { value: len }, time: { value: 0 }, stripes: { value: stripes }, edge: { value: edge } },
  });
}
/** a flat shaft of light from `from` along `dir` (length `len`, width `w`), facing roughly toward `face` */
export function shaft(from: THREE.Vector3, dir: THREE.Vector3, len: number, w: number, color: string, k: number, stripes = 0) {
  const geo = new THREE.PlaneGeometry(w, len); geo.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(geo, shaftMat(color, k, len, stripes));
  m.position.copy(from);
  // plane's -y axis along dir
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  m.quaternion.copy(q);
  m.renderOrder = 5;
  return m;
}

export class Dust {
  points: THREE.Points; base: Float32Array; n: number; box: THREE.Box3;
  constructor(n: number, box: THREE.Box3, color = "#ffd2a8", size = 0.012, seed = 9) {
    this.n = n; this.box = box;
    const r = rng(seed); this.base = new Float32Array(n * 4);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.base[i * 4] = r(); this.base[i * 4 + 1] = r(); this.base[i * 4 + 2] = r(); this.base[i * 4 + 3] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size, map: radial("rgba(255,255,255,1)", "rgba(255,255,255,0)", 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    m.color.multiplyScalar(1.6);
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  update(t: number) {
    const p = this.points.geometry.attributes.position as THREE.BufferAttribute, b = this.box, s = new THREE.Vector3(); b.getSize(s);
    for (let i = 0; i < this.n; i++) {
      const u = this.base[i * 4], v = this.base[i * 4 + 1], w = this.base[i * 4 + 2], ph = this.base[i * 4 + 3];
      const x = b.min.x + ((u + 0.02 * Math.sin(t * 0.3 + ph * 20)) % 1) * s.x;
      const y = b.min.y + ((v + t * 0.004 * (0.5 + ph) + 1) % 1) * s.y;
      const z = b.min.z + ((w + 0.02 * Math.cos(t * 0.25 + ph * 13)) % 1) * s.z;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }
}

/** additive pool of light on the ground (night): radial gradient, tinted */
export function groundPool(color: string, r: number, k = 0.5) {
  const m = new THREE.MeshBasicMaterial({ map: radial("rgba(255,255,255,1)", "rgba(255,255,255,0)"), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.color.multiplyScalar(k);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m); p.rotation.x = -Math.PI / 2; p.renderOrder = 3;
  return p;
}

export function blob(w: number, d: number, alpha = 0.55) {
  const m = new THREE.MeshBasicMaterial({ map: radial(`rgba(5,4,12,${alpha})`, "rgba(5,4,12,0)"), transparent: true, depthWrite: false, toneMapped: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.renderOrder = 2;
  return p;
}
