// The cast of the Yamaguchi short as lit flat cards in the 3D sets (the bridge short's card system: canvas pool,
// cardShade lighting, contact blobs, blinks) plus the one-off 2D effects of each shot. stage(id, t) is a pure function
// of the shot and the time, so every frame renders the same way in any order.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, YAMA, YAMA_BAND, YAMA_BAND2, YAMA_SOOT, BOSS, WORKER, WIFE, OLD, OFFICIAL, CAMPER, AUDIENCE, fxBurst, fxShadow, fxContact, fxStars,
  Outfit, Expr, FrontOpts, SideOpts, Prop,
} from "./toon";
import { fxThought, fxParachute, fxFire, fxSteam, fxSweat, fxRings, fxTiles, fxTarget, fxDash, fxCrane, fxPetal, fxDust, fxBack, fxHand, fxSparks, fxGull } from "./fx";
import { CAR0, CAR1, WELDERS } from "./vehicles";
import {
  FPS, SHOTS, V3, clamp01, smooth, trainZ, WIN_DZ, SHIP_AT, LOOK_AT, TARGETS, TARGET_R, TUNNEL, PODIUM, BENCH, AWARD, DESK_INSERT,
  walkHome, walkBack, camperDist, TRAIN_V,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool (with a small cache of recently used drawings, so blinks do not redraw) ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number; key: string; used: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h, key: "", used: 0 };
};
const IDLE_MAX = 28;
export class Pool {
  private live = new Map<string, Entry>();
  private idle = new Map<string, Entry>();
  private reqs: Req[] = [];
  private clock = 0;
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    this.clock++;
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); e.used = this.clock; this.idle.set(key, e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key) ?? this.idle.get(key);
      if (e) { this.idle.delete(key); }
      else {
        const r = rs[0];
        // recycle the oldest idle canvas of the same size, else make one
        let old: Entry | null = null;
        if (this.idle.size >= IDLE_MAX) for (const x of this.idle.values()) if (x.w === r.w && x.h === r.h && (!old || x.used < old.used)) old = x;
        if (old) { this.idle.delete(old.key); e = old; } else e = makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        e.key = key;
      }
      this.live.set(key, e);
      for (const r of rs) r.tex = e.tex;
    }
    // hard cap on idle memory
    if (this.idle.size > IDLE_MAX * 2) {
      const list = [...this.idle.values()].sort((a, b) => a.used - b.used);
      for (const x of list.slice(0, this.idle.size - IDLE_MAX * 2)) { this.idle.delete(x.key); x.tex.dispose(); }
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216;
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: cut-out ink drawing, soft see-through, glow (additive, HDR) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; add: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.add = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(p: FxPlace) {
    const m = p.additive ? this.add : p.soft ? this.soft : this.mat;
    this.mesh.material = m;
    m.color.setScalar(p.glow ?? 1);
    m.fog = !p.noFog && !p.additive;
    this.mesh.renderOrder = p.order ?? 0;
  }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.add.map = t; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number;
  soft?: boolean; additive?: boolean; glow?: number; noFog?: boolean; order?: number; yawOnly?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design], sized for a 1080 x 1920 frame */
const tier = (d: number): [number, number, number] =>
  d < 1.8 ? [1800, 3000, 3.0] : d < 3.4 ? [1350, 2250, 2.25] : d < 7 ? [810, 1350, 1.35] : d < 16 ? [360, 600, 0.6] : [180, 300, 0.3];
const tmp = new THREE.Vector3();
let LNAME = "day";
let SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = (who.i * 5 + 3) % 7 + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};
const FRONT = { side: false, mirror: false };

// contact shadow under the feet (+ a soft tail away from the sun by day)
const CONTACT: [number, number, number] = [0.2, 0.21, 0.33];
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day" || LNAME === "golden" || LNAME === "blast") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k * (LNAME === "day" ? 1 : 0.8));
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT, k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x, y: y + 0.022, z, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
/** one standing / sitting front-view person + contact shadow */
const put = (out: Stage, cam: CamInfo, t: number, i: number, o: Outfit, okey: string, at: V3, fo: FrontOpts, opt: { scale?: number; noBlob?: boolean; blinkless?: boolean } = {}) => {
  const fo2: FrontOpts = { mode: "stand", ...fo, blink: opt.blinkless ? 0 : fo.blink ?? lidAt(t, i) };
  out.places.push(person(cam, { i, o, okey }, at[0], at[1], at[2], FRONT, fo2, {}, opt.scale ?? 1));
  if (!opt.noBlob) blob(out, at[0], at[1], at[2], opt.scale ?? 1);
};
/** pop-in size: 0 -> overshoot -> 1 over ~6 frames from t0, and out over 4 frames before t1 */
const pop = (t: number, t0: number, t1 = 1e9) => {
  const a = (t - t0) * FPS, b = (t1 - t) * FPS;
  if (a < 0 || b < 0) return 0;
  const inK = a < 6 ? Math.sin((a / 6) * Math.PI * 0.75) / Math.sin(Math.PI * 0.75 * 0.999) * (a < 4 ? 1.12 * (a / 4) : 1) : 1;
  return Math.min(inK, b < 4 ? b / 4 : 1);
};
const W = (f: number) => f / FPS; // word frame -> seconds
const talk = (t: number, rate = 5.5) => (Math.floor(t * rate) % 2 ? "talk" : "smile") as Expr;
const thought = (out: Stage, cam: CamInfo, at: V3, kind: number, s: number, side = 1) => {
  if (s <= 0.01) return;
  out.fx.push({ key: `thought${kind}`, cw: 600, ch: 520, draw: (p) => fxThought(p, kind), x: at[0] + cam.right.x * 0.55 * side, y: at[1], z: at[2] + cam.right.z * 0.55 * side, w: 1.15 * s, h: 1.0 * s, order: 2 });
};
const sweat = (out: Stage, cam: CamInfo, at: V3, t: number, t0: number) => {
  if (t < t0) return;
  const u = Math.min(1, (t - t0) / 0.5);
  out.fx.push({ key: "sweat", cw: 120, ch: 160, draw: fxSweat, x: at[0] + cam.right.x * 0.24, y: at[1] - 0.06 * u, z: at[2] + cam.right.z * 0.24, w: 0.09, h: 0.12, order: 2 });
};
const steamAt = (out: Stage, at: V3, t: number, col = "#ffffff", s = 0.5, n = 2) => {
  for (let k = 0; k < n; k++) {
    const u = q((t * 0.8 + k * 0.5) % 1, 24);
    out.fx.push({ key: `steam${col}${u}`, cw: 300, ch: 400, draw: (p) => fxSteam(p, u, col), x: at[0] + (k - 0.5) * 0.25 * s, y: at[1] + 0.3 * s, z: at[2], w: s * 0.75, h: s, soft: true });
  }
};

// ---------------- staging per shot ----------------
const Y0 = (o: Outfit) => o; // (readability helper)

export const stage = (id: number, t: number, cam: CamInfo, sun: THREE.Vector3): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = Math.round(t * FPS), tau = s.tau(t);
  LNAME = s.light; SUN = sun.clone().normalize();
  switch (id) {
    case 1: { // inside the carriage: bandaged, on the bench under the window, the country flashing past behind him
      const z = trainZ(tau);
      put(out, cam, t, 1, YAMA_BAND, "yb", [1.0, 1.1, z + WIN_DZ], { mode: "bench", expr: f < 44 ? "smile_closed" : "relief", look: -1 }, { noBlob: true });
      put(out, cam, t, 2, WORKER(1), "w1", [1.0, 1.1, z + WIN_DZ + 2.6], { mode: "bench", expr: "neutral", look: -1 }, { noBlob: true });
      put(out, cam, t, 3, AUDIENCE(3), "a3", [1.0, 1.1, z + WIN_DZ - 2.4], { mode: "bench", expr: "smile" }, { noBlob: true });
      break;
    }
    case 2: case 15: { // from outside: heads at the windows, smoke and steam
      const z = trainZ(tau);
      put(out, cam, t, 1, YAMA_BAND, "yb", [1.12, 0.78, z + WIN_DZ], { expr: "relief", look: 1, wave: id === 15 ? q(Math.sin(t * 9), 20) : undefined }, { noBlob: true });
      put(out, cam, t, 2, WORKER(1), "w1", [0.95, 0.72, z + CAR0 + 0.6 + 1.6 * 2 + 0.5], { expr: "neutral" }, { noBlob: true });
      put(out, cam, t, 3, AUDIENCE(3), "a3", [0.95, 0.72, z + CAR1 + 0.6 + 1.6 * 3 + 0.5], { expr: "smile" }, { noBlob: true });
      trainSmoke(out, t, tau, id === 15 ? 1.3 : 1);
      break;
    }
    case 3: case 16: trainSmoke(out, t, tau, 1.2); break;
    case 4: { // shipyard: the tanker on the slip, welders' sparks, gulls; the designer with his drawing, then goodbye
      const wave = f >= 284 ? q(Math.sin(t * 9), 20) : undefined;
      const prop: Prop = f >= 223 && f < 278 ? "blueprint" : "suitcase";
      put(out, cam, t, 1, YAMA, "y", SHIP_AT, { expr: f < 223 ? "smile" : f < 278 ? (f < 250 ? "smile_closed" : "grin") : "grin", prop, wave, up: f >= 223 && f < 250 ? 0.6 : 0 });
      YARD_WELDERS.forEach((w, i) => {
        put(out, cam, t, 30 + i, WORKER(i), `w${i % 3}`, [w[0], w[1], w[2]], { expr: "stern" }, { noBlob: true });
        const u = q(t % 3, 12);
        out.fx.push({ key: `sparks${u}|${i}`, cw: 300, ch: 400, draw: (p) => fxSparks(p, u + i * 0.3), x: w[0] + 0.45, y: w[1] + 0.2, z: w[2] + 0.35, w: 2.0, h: 2.67, additive: true, glow: 3.2, order: 3 });
      });
      put(out, cam, t, 11, WORKER(0), "w0", [SHIP_AT[0] - 10, 0, SHIP_AT[2] - 4], { expr: "neutral" });
      put(out, cam, t, 12, WORKER(2), "w2", [SHIP_AT[0] + 16, 0, SHIP_AT[2] - 3], { expr: "smile" });
      for (let k = 0; k < 5; k++) {
        const ph = q((t * 2.4 + k * 0.31) % 1, 8), gx = -30 + ((t * (5 + k) + k * 23) % 90), gy = 20 + 8 * hh(k, 3) + 1.2 * Math.sin(t + k), gz = -112 - 20 * hh(k, 4);
        out.fx.push({ key: `gull${ph}`, cw: 300, ch: 160, draw: (p) => fxGull(p, ph), x: gx, y: gy, z: gz, w: 1.6, h: 0.85, noFog: true });
      }
      break;
    }
    case 5: { // walking home up the street, a thought of his wife and son
      const p = walkHome(f), ph = q(((p[2] + 40) / 1.4) % 1, 24);
      out.places.push(person(cam, { i: 1, o: YAMA, okey: "y" }, p[0], 0, p[2], FRONT, { mode: "stroll", phase: ph, expr: f < 369 ? "smile" : "smile_closed", prop: "suitcase", blink: lidAt(t, 1) }, {}));
      blob(out, p[0], 0, p[2]);
      thought(out, cam, [p[0], 2.35, p[2]], 0, pop(t, W(369), W(405) + 0.3));
      passersby(out, cam, t);
      break;
    }
    case 6: { // stops: forgot the hanko
      const p = walkHome(Math.min(f, 418)), moving = f < 418, ph = q(((p[2] + 40) / 1.4) % 1, 24);
      const expr: Expr = f < 436 ? "smile" : "shock";
      out.places.push(person(cam, { i: 1, o: YAMA, okey: "y" }, p[0], 0, p[2], FRONT, { mode: moving ? "stroll" : "stand", phase: moving ? ph : 0, expr, prop: "suitcase", blink: f >= 436 ? 0 : lidAt(t, 1) }, {}));
      blob(out, p[0], 0, p[2]);
      sweat(out, cam, [p[0], 1.82, p[2]], t, W(449));
      if (f >= 446 && f < 452) { const u = (f - 446) / 6; out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (pp) => fxBurst(pp, q(u, 30)), x: p[0] - cam.right.x * 0.42, y: 1.95, z: p[2] - cam.right.z * 0.42, w: 0.5, h: 0.5 }); }
      passersby(out, cam, t);
      break;
    }
    case 7: case 29: break; // (7: hanko insert, world.ts poses the stamp; 29 handled below)
    case 8: { // walks back toward the shipyard (side view, hurrying)
      const p = walkBack(f), ph = q(((-34 - p[2]) / 1.6) % 1, 24), view = viewOf(cam, p[0], p[2], 0, -1);
      out.places.push(person(cam, { i: 1, o: YAMA, okey: "y" }, p[0], 0, p[2], view, { mode: "march", phase: ph, expr: "nervous", prop: "suitcase", blink: lidAt(t, 1) },
        { mode: f < 518 ? "stand" : "march", phase: ph, expr: "nervous", stomp: 0.7, stride: 0.9 * view.fs, prop: "suitcase", blink: lidAt(t, 1) }));
      blob(out, p[0], 0, p[2]);
      passersby(out, cam, t);
      break;
    }
    case 9: break; // street clock
    case 10: { // looks up
      put(out, cam, t, 1, YAMA, "y", LOOK_AT, { expr: f < 606 ? "neutral" : "nervous", up: f < 604 ? 0 : 1.3, prop: "suitcase" });
      break;
    }
    case 11: { // the plane and two parachutes high over the street
      for (const k of [0, 1]) {
        const t0 = W(636) + k * 0.25;
        if (t < t0) continue;
        const u = t - t0, px = planeX(t) - 34 - k * 16 - 6 * u, py = 300 - 3.5 * u - 4, pz = -200 + 6 * k;
        out.fx.push({ key: "chute", cw: 300, ch: 420, draw: fxParachute, x: px + 2.5 * Math.sin(u * 1.4 + k), y: py, z: pz, w: 11 * Math.min(1, u * 3 + 0.2), h: 15.4 * Math.min(1, u * 3 + 0.2), rot: 0.12 * Math.sin(u * 1.8 + k), noFog: true });
      }
      break;
    }
    case 12: case 13: { // after the flash: sitting in the dust, dazed; ringing ears; smoke off the burnt side
      const at: V3 = [0, 0, 0];
      const expr: Expr = id === 12 ? "dazed" : f < 833 ? "dazed" : "pained";
      put(out, cam, t, 1, YAMA_SOOT, "ys", at, { mode: "sit", expr, blinkless: true } as FrontOpts, { blinkless: true });
      if (id === 13 && f >= 805 && f < 833) for (const sd of [-1, 1]) {
        const u = q((t * 1.6) % 1, 24);
        out.fx.push({ key: `rings${u}`, cw: 300, ch: 300, draw: (p) => fxRings(p, u), x: at[0] + cam.right.x * 0.32 * sd, y: 0.88, z: at[2] + cam.right.z * 0.32 * sd, w: 0.32, h: 0.32, rot: sd > 0 ? 0 : Math.PI });
      }
      if (id === 13 && f >= 833) steamAt(out, [at[0] + cam.right.x * 0.2, 0.75, at[2] + cam.right.z * 0.2], t, "#8a7a74", 0.55, 3);
      if (id === 13 && f < 833) { const u = q((t * 0.9) % 1, 30); out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: at[0], y: 1.42, z: at[2], w: 0.62, h: 0.31 }); }
      dust(out, t, id === 12 ? 1 : 0.6);
      break;
    }
    case 14: { // night at the shelter, first bandages
      const sx = 8.2, sz = -4.6, ry = Math.atan2(2.4 - sx, 8.5 - sz);
      put(out, cam, t, 1, YAMA_BAND, "yb", [sx + Math.sin(ry) * 3.7 - Math.cos(ry) * 1.25, 0, sz + Math.cos(ry) * 3.7 + Math.sin(ry) * 1.25], { mode: "sit", expr: "neutral" });
      break;
    }
    case 17: { // back at work, wrapped in bandages; colleagues stare
      const stare = f >= 1118;
      put(out, cam, t, 1, YAMA_BAND2, "yb2", [-2.6, 0, -0.2], { expr: f < 1092 ? "stern" : "neutral", facing: 0 });
      put(out, cam, t, 21, WORKER(0), "w0", [-5.2, 0, -2.3], { expr: stare ? "shock" : "neutral", look: stare ? 1 : 0, facing: stare ? 1 : 0 });
      put(out, cam, t, 22, WORKER(1), "w1", [-1.0, 0, -2.6], { expr: stare ? "shock" : "neutral", look: stare ? -1 : 0, facing: stare ? -1 : 0 });
      put(out, cam, t, 23, WORKER(2), "w2", [5.1, 0, -2.4], { expr: stare ? "nervous" : "neutral", look: stare ? -1 : 0, facing: stare ? -1 : 0 });
      put(out, cam, t, 24, BOSS, "boss", [2.4, 0, -0.55], { expr: "neutral", facing: -1 });
      break;
    }
    case 18: case 19: case 20: case 21: {
      const flash = f >= 1366;
      let yExpr: Expr = "neutral", bExpr: Expr = "stern", yProp: Prop = null, bWave: number | undefined;
      if (id === 18) { yExpr = f < 1245 ? talk(t) : "neutral"; if (f >= 1186 && f < 1212) yProp = "one"; }
      if (id === 19) { bExpr = f < 1262 ? "smile" : "laugh"; bWave = f >= 1262 ? q(Math.sin(t * 12), 20) : undefined; }
      if (id === 20) { bExpr = f < 1320 ? "smile_closed" : "smile"; bWave = q(0.6 * Math.sin(t * 10), 20); yExpr = "neutral"; }
      if (id === 21) { bExpr = flash ? "shock" : "smile"; yExpr = flash ? "shock" : "neutral"; }
      put(out, cam, t, 1, YAMA_BAND2, "yb2", [1.15, 0, 1.15], { expr: yExpr, facing: 1, look: 1, prop: yProp ?? undefined, blinkless: false } as FrontOpts);
      put(out, cam, t, 24, BOSS, "boss", [2.4, 0, -0.55], { expr: bExpr, facing: -1, look: -1, wave: bWave });
      if (id === 18) thought(out, cam, [1.85, 2.5, 0.3], 1, pop(t, W(1201), W(1250) + 0.1), 0);
      if (id === 18 || id === 20) { put(out, cam, t, 22, WORKER(1), "w1", [-1.0, 0, -2.6], { expr: "neutral", look: 1 }); put(out, cam, t, 23, WORKER(2), "w2", [5.1, 0, -2.4], { expr: "neutral", look: -1 }); }
      if (id === 21) { put(out, cam, t, 22, WORKER(1), "w1", [-1.0, 0, -2.6], { expr: flash ? "shock" : "neutral" }); }
      break;
    }
    case 22: { // the cloud over Nagasaki; deadpan
      put(out, cam, t, 1, YAMA_BAND2, "yb2", [0, 0, 0], { expr: f < 1475 ? "shock" : "neutral" });
      if (f >= 1475) sweat(out, cam, [0, 1.85, 0], t, W(1487));
      dust(out, t, 0.5);
      break;
    }
    case 23: { // lanterns at dusk; he stands on the bank
      if (f >= 1600) put(out, cam, t, 1, YAMA_BAND2, "yb2", [0, 0, 36.2], { expr: "neutral" });
      break;
    }
    case 24: { // both times ~3 km from the centre: two targets, a pin figure on the third ring of each, a dashed line out
      TARGETS.forEach(([tx, , tz], k) => {
        out.fx.push({ key: "target", cw: 1024, ch: 1024, draw: fxTarget, x: tx, y: 0.04, z: tz, w: 2 * TARGET_R, h: 2 * TARGET_R, flat: true, additive: true, glow: 1.5 });
        const r = 0.72 * TARGET_R, px = tx + r * 0.42, pz = tz + r * 0.9;
        put(out, cam, t, 40 + k, k ? YAMA_BAND2 : YAMA_SOOT, k ? "yb2" : "ys", [px, 0, pz], { expr: "neutral" }, { scale: 4 });
        const u = smooth((t - W(1719)) / 1.1);
        const ang = Math.atan2(0.9, 0.42);
        if (u > 0.01) out.fx.push({ key: "dash", cw: 1024, ch: 64, draw: (p) => fxDash(p), x: tx + Math.cos(ang) * (r * u) / 2, y: 0.06, z: tz + Math.sin(ang) * (r * u) / 2, w: r * u, h: 0.6, flat: true, rot: -ang, additive: true, glow: 1.6 });
      });
      break;
    }
    case 25: { // the campfire: close = scorched, a few steps back = just warm
      fire(out, t, 1);
      const d = camperDist(f), standing = f >= 1898, walking = f >= 1898 && f < 1932;
      const expr: Expr = f < 1846 ? "smile" : f < 1866 ? "nervous" : f < 1898 ? "pained" : walking ? "relief_open" : "relief";
      const ph = q(((d - 1.15) / 1.2) % 1, 24);
      put(out, cam, t, 50, CAMPER, "camper", [0, 0, -d], { mode: standing ? (walking ? "stroll" : "stand") : "sit", phase: walking ? ph : 0, expr }, {});
      if (f >= 1866 && f < 1898) { steamAt(out, [0, 1.0, -d + 0.05], t, "#ffffff", 0.45, 2); sweat(out, cam, [0, 1.1, -d], t, W(1868)); }
      break;
    }
    case 26: { // heat spreads out: rays, one tile at d, the same heat over four tiles at 2d
      fire(out, t, 0.9);
      const sweep = smooth((t - W(1963)) / 1.6), hi = f >= 2063 ? 1 : -1;
      out.fx.push({ key: `tiles${q(sweep, 30)}|${hi}`, cw: 900, ch: 520, draw: (p) => fxTiles(p, q(sweep, 30), hi), x: 0, y: 0.05, z: 3.8, w: 9.0, h: 5.2, flat: true, rot: -Math.PI / 2, soft: true, glow: 1.25, order: 1 });
      break;
    }
    case 27: { // close enough to hurt him, far enough to let him live
      put(out, cam, t, 1, YAMA_BAND2, "yb2", [0, 0, -0.3], { expr: f < 2140 ? "neutral" : f < 2166 ? "pained" : f < 2189 ? "smile" : "relief_open" });
      petals(out, t, BENCH, 0.6);
      break;
    }
    case 28: { // the tunnel: his wife walks out with their son
      const tx = TUNNEL[0], tz = TUNNEL[2], u = smooth((t - W(2215)) / 1.0);
      const wz = tz + 0.6 + 2.8 * u, walking = u > 0 && u < 1;
      out.places.push(person(cam, { i: 60, o: WIFE, okey: "wife" }, tx - 0.55, 0, wz, FRONT, { mode: walking ? "stroll" : "stand", phase: q((u * 3.5) % 1, 24), expr: f < 2236 ? "smile" : "relief_open", prop: "baby", facing: walking ? 0 : 1, blink: lidAt(t, 60) }, {}));
      blob(out, tx - 0.55, 0, wz);
      put(out, cam, t, 1, YAMA_BAND2, "yb2", [tx + 0.75, 0, tz + 3.7], { expr: f < 2236 ? "smile" : "relief_open", facing: -1 });
      break;
    }
    case 30: break; // stamp insert (world.ts)
    case 31: { // the podium: asking the world never to build another one; paper cranes
      put(out, cam, t, 70, OLD, "old", [PODIUM[0] - 0.05, 0.35, PODIUM[2] + 0.1], { expr: f < 2530 ? talk(t, 4.5) : "smile_closed" }, { noBlob: true });
      for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) {
        const cols = ["#e2453c", "#f3d35a", "#3f6fb5", "#f08a2c", "#2f8a4f", "#c25a7a", "#7b5ac9"], col = cols[(i + j * 3) % 7];
        const fl = q(0.5 + 0.5 * Math.sin(t * 2 + i + j), 6);
        out.fx.push({ key: `crane${col}${fl}`, cw: 400, ch: 300, draw: (p) => fxCrane(p, col, fl), x: PODIUM[0] - 3.3 + i * 1.1, y: 0.95 + j * 0.72, z: PODIUM[2] - 2.0, w: 0.55, h: 0.41, rot: 0.06 * Math.sin(t * 1.5 + i * 2 + j) });
      }
      for (let k = 0; k < 9; k++) {
        const col = ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"][k % 6], hair = ["#231d20", "#5a3b2a", "#2e2428", "#8a8580"][k % 4];
        out.fx.push({ key: `back${k % 6}${k % 4}`, cw: 300, ch: 300, draw: (p) => fxBack(p, col, hair), x: PODIUM[0] - 3.6 + (k % 5) * 1.6 + (k > 4 ? 0.8 : 0) + 0.3 * hh(k), y: 0.75 + (k > 4 ? 0.1 : 0), z: PODIUM[2] + 3.4 + (k > 4 ? 0.9 : 0), w: 0.7, h: 0.7, soft: false });
      }
      break;
    }
    case 32: { // ninety-three: on the bench under the blossom
      put(out, cam, t, 70, OLD, "old", [BENCH[0], 0, BENCH[2] + 0.34], { mode: "bench", expr: f < 2665 ? "smile" : "relief" });
      petals(out, t, BENCH, 1);
      break;
    }
  }
  if (id === 29) { // 2009: the certificate changes hands
    const handed = f >= 2343;
    put(out, cam, t, 71, OFFICIAL, "official", [AWARD[0] + 0.72, 0, AWARD[2]], { expr: "smile", facing: -1, prop: handed ? undefined : "paper" });
    put(out, cam, t, 70, OLD, "old", [AWARD[0] - 0.7, 0, AWARD[2] + 0.1], { expr: handed ? "relief" : "smile", facing: 1, prop: handed ? "paper" : undefined });
  }
  return out;
};

// ---------------- recurring effects ----------------
/** B-29 x position at time t (s) for shot 11 */
export const planeX = (t: number) => -150 + 70 * (t - W(624));
/** chimney smoke left in the still air as the train runs on (so it streams back over the carriages), plus cylinder
 *  steam puffing low at the front twice per wheel turn */
const trainSmoke = (out: Stage, t: number, tau: number, k = 1) => {
  const nose = trainZ(tau);
  for (let i = 0; i < 26; i++) {
    const age = ((tau * 7.2) % 1) / 7.2 + i / 7.2;     // a puff every 0.14 s (one per chimney beat)
    const zEmit = trainZ(tau - age) + 1.25, rise = 4.3 + 1.9 * age + 0.35 * age * age;
    const sz = (1.1 + 1.9 * age) * k;
    out.fx.push({ key: `smoke${i % 3}`, cw: 400, ch: 300, draw: (p) => fxDust(p, 0.12 + 0.1 * (i % 3), i < 4 ? "#bdb8b0" : "#e2ded6"), x: 0.4 * Math.sin(i * 2.1) + 0.6 * age, y: rise, z: zEmit + 0.8 * age, w: sz * 1.33, h: sz, soft: true, order: 3 });
  }
  const cyc = (tau * TRAIN_V) / (2 * Math.PI * 0.75);
  for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) {
    const a = ((cyc * 2 + j / 3) % 1), ze = trainZ(tau - a * 0.25) + 1.3;
    if (j > 1) continue;
    out.fx.push({ key: `steamC${j}`, cw: 400, ch: 300, draw: (p) => fxDust(p, 0.3 + 0.2 * j, "#f4f2ee"), x: sd * (1.55 + 0.9 * a), y: 0.45 + 0.35 * a, z: ze, w: (0.35 + 1.1 * a) * 1.33, h: 0.35 + 1.1 * a, soft: true, order: 3 });
  }
};
const YARD_WELDERS = WELDERS;
const dust = (out: Stage, t: number, k: number) => {
  for (let i = 0; i < 6; i++) {
    const u = (t * 0.12 + i / 6) % 1, x = -6 + 12 * hh(i, 3), z = -3 - 8 * hh(i, 4);
    out.fx.push({ key: `dust${i % 3}`, cw: 400, ch: 300, draw: (p) => fxDust(p, 0.3 + 0.2 * (i % 3), "#b8937a"), x: x + 3 * u, y: 0.8 + 0.6 * u, z, w: 4 * k, h: 3 * k, soft: true });
  }
};
const fire = (out: Stage, t: number, k: number) => {
  const tt = q(t % 2, 15);
  out.fx.push({ key: `fire${tt}`, cw: 400, ch: 520, draw: (p) => fxFire(p, tt), x: 0, y: 0.72 * k, z: 0, w: 1.1 * k, h: 1.43 * k, glow: 2.2, order: 2 });
};
const petals = (out: Stage, t: number, at: V3, k: number) => {
  for (let i = 0; i < 14; i++) {
    const u = (t * 0.18 + hh(i, 1)) % 1, x = at[0] - 3 + 6 * hh(i, 2) + 0.6 * Math.sin(t * 1.3 + i), y = 4.8 - 4.8 * u, z = at[2] + 1.4 - 2.6 * hh(i, 3);
    out.fx.push({ key: "petal", cw: 120, ch: 120, draw: fxPetal, x, y, z, w: 0.09 * k + 0.05, h: 0.09 * k + 0.05, rot: t * 2 + i });
  }
};
/** two townsfolk strolling far up the street (shots 5, 6, 8) */
const passersby = (out: Stage, cam: CamInfo, t: number) => {
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 ? 1 : -1, z = -62 + 10 * hh(i, 5) + dir * 0.7 * (t - 14), x = i === 1 ? -2.9 : 2.9 - 0.8 * i;
    const view = viewOf(cam, x, z, 0, dir), ph = q((Math.abs(z) / 1.4) % 1, 24), o = AUDIENCE(i + 1);
    out.places.push(person(cam, { i: 80 + i, o, okey: `pb${i}` }, x, 0, z, view, { mode: "stroll", phase: ph, expr: "smile", blink: lidAt(t, 80 + i) }, { mode: "march", phase: ph, expr: "smile", stomp: 0.5, stride: 0.8 * view.fs }));
    blob(out, x, 0, z);
  }
};
export const hankoHand = (sleeve: string) => (p: Pen) => fxHand(p, sleeve);
export { Y0 };
