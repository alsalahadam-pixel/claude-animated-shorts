// THE LAST HUMAN ALIVE (v2) — the shot timeline, 30 fps. 60.0 s film, then black and silence, then a quiet PART 2?
// Every shot: frame range, look, camera (locked unless the plan says otherwise), depth of field, and what the actors
// do. Voice lines land on these shots (voice/build_voice_v2.py SLOTS); reactions land 0-3 frames before their word.
// Story rules (SCRIPT_v2.md §1): the world froze at 06:12 on Day 1; only the sky, he, and "them" move.
import * as THREE from "three";
import { World, Look } from "./world/World";
import { drawCharacter, drawHand, drawHeadOnly, drawPigeon, drawWatcher, Face, FACE0, haloBehind, HandPts, inkOver, Light, Pose, possessedGlow, possessedGlowHead, stand, walk, watcherBody } from "./char/draw";
import { CITY } from "./world/city";

export const FPS = 30;
export const FILM_END = 1806;          // 60.2 s: hard cut to black
export const PROMPT_AT = 1836;         // 61.2 s: after black and silence, the quiet PART 2? prompt
export const TOTAL = 1875;             // 62.5 s
type V3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov: number; roll?: number; up?: V3 };
type Key = { f: number; pos: V3; look: V3; fov?: number; roll?: number };
export type Dof = { cInf: number; focus?: V3 };
export type Shot = {
  id: string; a: number; b: number; look: Look; grade: "warm" | "cool" | "night" | "dusk" | "cctv";
  cam: (f: number) => Cam; dof: (f: number) => Dof;
  act: (f: number, w: World, cam: THREE.PerspectiveCamera) => void;
  /** Part 2: per-frame post settings (glitch 0..1 tears the security-camera picture) */
  post?: (f: number) => { glitch?: number; noise?: number };
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ss = (x: number) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ramp = (f: number, a: number, b: number) => ss((f - a) / (b - a));
const V = (v: V3) => new THREE.Vector3(...v);
const D2R = Math.PI / 180;

function keys(K: Key[], f: number, fov0 = 35): Cam {
  if (f <= K[0].f) return { pos: K[0].pos, look: K[0].look, fov: K[0].fov ?? fov0, roll: K[0].roll ?? 0 };
  for (let i = 0; i < K.length - 1; i++) {
    const A = K[i], B = K[i + 1];
    if (f <= B.f) {
      const t = ss((f - A.f) / (B.f - A.f));
      return { pos: lerp3(A.pos, B.pos, t), look: lerp3(A.look, B.look, t), fov: lerp(A.fov ?? fov0, B.fov ?? fov0, t), roll: lerp(A.roll ?? 0, B.roll ?? 0, t) };
    }
  }
  const L = K[K.length - 1];
  return { pos: L.pos, look: L.look, fov: L.fov ?? fov0, roll: L.roll ?? 0 };
}
/** a deliberate dolly/zoom from A to B over [a, b]: near-constant speed with soft starts and stops */
function glide(a: number, b: number, A: { pos: V3; look: V3; fov: number; roll?: number }, B: { pos: V3; look: V3; fov: number; roll?: number }): (f: number) => Cam {
  return (f) => {
    const x = clamp((f - a) / (b - a)), t = 0.6 * x + 0.4 * ss(x);
    return { pos: lerp3(A.pos, B.pos, t), look: lerp3(A.look, B.look, t), fov: lerp(A.fov, B.fov, t), roll: lerp(A.roll ?? 0, B.roll ?? 0, t) };
  };
}
/** a locked-off shot with an imperceptible creep toward the subject (k = fraction of the distance over the shot) */
function locked(a: number, b: number, pos: V3, look: V3, fov: number, k = 0.04, roll = 0): (f: number) => Cam {
  return (f) => {
    const t = clamp((f - a) / (b - a));
    return { pos: lerp3(pos, look, k * t), look, fov, roll };
  };
}

// ---------------------------------------------------------------- character lights (screen-space directions)
const SUN_SIDE: Light = { key: "#ffbf8f", keyK: 1.05, amb: "#6260a6", ambK: 0.6, dir: 15, rim: { color: "#ff9a5a", k: 0.55, dir: 10, w: 0.8 } };
const SUN_BACK: Light = { key: "#ffb27a", keyK: 0.35, amb: "#5c58a0", ambK: 0.55, dir: 60, rim: { color: "#ffa060", k: 1.0, dir: 60, w: 1.6 } };
// S04 over the shoulder, out of focus: a thinner, softer rim (a strong one turned the hair-spike tips into glowing dots)
const SUN_BACK_OTS: Light = { ...SUN_BACK, rim: { color: "#e89a6a", k: 0.45, dir: 40, w: 0.7 } };
const SUN_FRONT: Light = { key: "#ffc596", keyK: 0.95, amb: "#5c58a0", ambK: 0.55, dir: 70, rim: { color: "#8a7aff", k: 0.35, dir: 160, w: 0.9 } };
const OVERCAST: Light = { key: "#d6dcea", keyK: 0.62, amb: "#7680a6", ambK: 0.72, dir: 100, rim: { color: "#b8c8e8", k: 0.18, dir: 30, w: 0.6 } };
// the close-up hand in S07: the same grey daylight, but a warmer key so skin reads as skin
const CAFE_HAND: Light = { ...OVERCAST, key: "#f6e4d8", keyK: Math.max(OVERCAST.keyK, 0.7) };
const DUSK: Light = { key: "#ffb080", keyK: 0.4, amb: "#6a5a9a", ambK: 0.58, dir: 80, rim: { color: "#ff8a4a", k: 0.95, dir: 70, w: 1.3 } };
const NEON: Light = { key: "#c9a6ff", keyK: 0.75, amb: "#3c4280", ambK: 0.5, dir: 160, rim: { color: "#3ff0e0", k: 0.85, dir: 15, w: 1.2 } };
const NEON_L: Light = { key: "#d0b0ff", keyK: 0.8, amb: "#3c4280", ambK: 0.48, dir: 150, rim: { color: "#ff6ab8", k: 0.7, dir: 20, w: 1.1 } };
const GLASS: Light = { key: "#b8a8ff", keyK: 0.62, amb: "#34407a", ambK: 0.46, dir: 30, rim: { color: "#5fd8ff", k: 0.45, dir: 160, w: 0.9 } };
const DARK: Light = { key: "#8a7ad8", keyK: 0.35, amb: "#2c3266", ambK: 0.45, dir: 30, rim: { color: "#6a5cff", k: 0.75, dir: 25, w: 1.1 } };
const NIGHT_ROOM: Light = { key: "#9a8ae8", keyK: 0.5, amb: "#2e3470", ambK: 0.5, dir: 20, rim: { color: "#4fd8d0", k: 0.6, dir: 15, w: 1.0 } };
const PHONE: Light = { key: "#bfe0ff", keyK: 0.78, amb: "#262c5c", ambK: 0.42, dir: -80, rim: { color: "#7a5cff", k: 0.4, dir: 20, w: 0.8 } };

const BODY = { x0: -62, y0: -8, w: 124, h: 198 };
const HEAD_CU = { x0: -34, y0: 118, w: 68, h: 72 };
const GLASS_CU = { x0: -42, y0: 92, w: 84, h: 100 };   // S15: taller card so the reflection fades out below frame, not on a hard edge

// ---------------------------------------------------------------- faces
const TIRED: Partial<Face> = { tired: 1, open: 0.92 };                      // Day 3: 68 hours without sleep
/** the reflection and the double: exactly his face, calm, unblinking, behaving on its own */
const SAME = (smile: number, look: [number, number] = [0, 0]): Face => ({ ...FACE0, tired: 1, open: 1.0, pupil: 0.9, brow: -0.05, browIn: 0.05, look, mouth: smile > 0.02 ? "smile" : "neutral", mouthOpen: smile, shine: true });

// ---------------------------------------------------------------- poses
function lieToSit(k: number, t: number, face: Partial<Face>, headPsi?: number): Pose {
  // side view in bed: torso from lying back (-86°) to upright (-2°); legs straight forward under the duvet
  const br = Math.sin(t * 2 * Math.PI * 0.35);
  return {
    psi: 90, headPsi, hip: [0, 93, 0], lean: lerp(-86, -2, k), headTilt: lerp(-6, 0, k), headNod: lerp(-14, 4, k),
    armL: [lerp(-70, 30, k), 6, lerp(20, 40, k)], armR: [lerp(-80, 25, k), 6, lerp(10, 50, k)],
    legL: [90, 2, 0], legR: [88, 3, 4], handL: "open", handR: "open", face: { ...FACE0, ...face }, breathe: br,
  };
}
/** sitting on the floor, back against the door, knees up, phone held between the knees */
function floorSit(t: number, face: Partial<Face>, o: { phone?: number; nod?: number; headPsi?: number; psi?: number; hands?: "phone" | "fist" } = {}): Pose {
  const br = Math.sin(t * 2 * Math.PI * 0.32);
  return {
    psi: o.psi ?? 0, headPsi: o.headPsi, hip: [0, 18, 0], lean: 6, headTilt: 0, headNod: o.nod ?? 0, legsFront: true,
    legL: [130, 12, 110], legR: [126, 16, 106], armL: [59, -14, 46], armR: [59, -14, 46],
    handL: o.hands ?? "phone", handR: o.hands ?? "phone", phoneGlow: o.phone,
    face: { ...FACE0, ...TIRED, ...face }, breathe: br,
  };
}
/** the double in his bed: upper body only (hip at the card origin), arms at its sides */
function doublePose(face: Face, headPsi = 0): Pose {
  return {
    psi: 0, headPsi, hip: [0, 0, 0], lean: 2, headTilt: 0, headNod: 0,
    armL: [6, 10, 18], armR: [6, 10, 18], legL: [0, 4, 0], legR: [0, 4, 0], handL: "open", handR: "open", face, breathe: 0,
  };
}
/** eye darts: hold a gaze, then snap to the next one in 2 frames (eyes never drift smoothly) */
function saccade(f: number, K: [number, [number, number]][]): [number, number] {
  let prev = K[0][1];
  for (let i = 1; i < K.length; i++) {
    const [fk, v] = K[i];
    if (f < fk) break;
    const t = clamp((f - fk) / 2);
    if (t < 1) return [lerp(prev[0], v[0], t), lerp(prev[1], v[1], t)];
    prev = v;
  }
  return prev;
}
/** a sudden 3-frame push toward the subject (a scare beat), then hold */
const snap = (base: (f: number) => Cam, f0: number, k: number) => (f: number): Cam => {
  const c = base(f), t = ss((f - f0) / 3) * (f >= f0 ? 1 : 0);
  return { ...c, pos: lerp3(c.pos, c.look, k * t) };
};
const STRIDE = 1.4;   // metres per walk cycle (two steps): feet stay planted
const blinkAt = (f: number, at: number[]) => { for (const b of at) { const d = f - b; if (d >= 0 && d < 4) return [0.45, 0.05, 0.1, 0.6][d]; } return 1; };

// ---------------------------------------------------------------- shared places
// S01: the camera sits back along the line from the spot through the pole camera, a little to one side
const S01_POS: V3 = [9.6, 1.45, -4.0], S01_LOOK: V3 = [11.67, 2.0, -12.0];
const S01_RIGHT = new THREE.Vector3(-(S01_LOOK[2] - S01_POS[2]), 0, S01_LOOK[0] - S01_POS[0]).normalize();
const SPOT = V([10.4, 0.15, -11.5]);        // Day 3: the pavement under the shop camera, where it looked before he got there
const SPOT_HEAD = V([10.4, 1.65, -11.5]);
// S09's camera right vector: he ends S09 one step to the right of the spot, and S10/S11 keep him there
const S09_POS: V3 = [9.6, 1.5, -6.0], S09_LOOK: V3 = [11.45, 2.0, -12.0];
const S09_RIGHT = new THREE.Vector3(-(S09_LOOK[2] - S09_POS[2]), 0, S09_LOOK[0] - S09_POS[0]).normalize();
const END9 = SPOT.clone().addScaledVector(S09_RIGHT, 0.55);
/** S09: his sideways steps under the camera (metres along S09_RIGHT): one to the left, then one to the right */
const s09lat = (g: number) => -0.35 * ramp(g, 606, 620) + 0.9 * ramp(g, 681, 697);
const GLASS_X = CITY.shopGlassX;            // the shop window (x = -12.9)
const Z5 = -78.2;                           // where he stops at the glass
const HERO_X5 = -11.75;
const HERO_X13 = -12.25;                    // S13-S15: he has stepped up to the glass
const mirrorX = (x: number) => 2 * GLASS_X - x;
const DOOR_SIT = V([-2.05, 0, 2.6]);        // on the floor, back against the door
const BED_HIP = V([1.55, 0.58, -1.62]);

// ---------------------------------------------------------------- S20-S21: him in the bed (the same guy, terrified) and the devil in the corner
const DEVIL_SPOT = V([-3.12, 0, -2.68]);   // the dark north-west corner, beside the wardrobe (as in the first cut)
const DEVIL_FRAME = { x0: -45, y0: -4, w: 90, h: 255 };
const BED_UP = { x0: -45, y0: -14, w: 90, h: 104 };   // his upper body in the bed, hip at the card origin
const CORNER_DIR = DEVIL_SPOT.clone().sub(BED_HIP).setY(0).normalize();
const S21_POS: V3 = [3.1, 1.5, -0.9], S21_LOOK: V3 = [-3.12, 1.62, -2.68];   // over his shoulder: his head low right, out of focus
/** torso pitch back from upright (rad): asleep under the duvet, then he jolts upright (the same jolt as S03), a settle */
function bedPitch(f: number) {
  if (f < 1665) return 1.35;
  const k = ss((f - 1665) / 8) * 1.05 - Math.max(0, ss((f - 1673) / 7)) * 0.05;
  return 1.35 * (1 - k);
}
function bedPose(f: number, cam: THREE.PerspectiveCamera): Pose {
  const body = World.psi(BED_HIP, V([0, 0, 1]), cam), corner = World.psi(BED_HIP, CORNER_DIR, cam);
  const up = f >= 1665, turn = ramp(f, 1700, 1721);
  const headPsi = lerp(body, corner, turn);
  // which way the corner is on screen, in his face's terms (the drawing mirrors the body when psi < 0, and the head again
  // when its own yaw is negative)
  const g = Math.sin(body * D2R) < -1e-3 ? -1 : 1, h = Math.sin(g * headPsi * D2R) < -1e-3 ? -1 : 1;
  const side = (Math.sign(Math.sin(corner * D2R)) || 1) * g * h;
  const dart = saccade(f, [[0, [0, 0]], [1673, [0.5, 0.15]], [1679, [-0.55, 0]], [1685, [0.25, -0.25]], [1690, [-0.3, 0.1]], [1695, [0, 0]], [1698, [0.9 * side, 0]]]);
  // he pants, then holds his breath when he senses the corner
  const pant = up ? Math.sin((f / FPS) * Math.PI * 2 * 1.5) * (1 - 0.8 * ramp(f, 1694, 1700)) : 0;
  const face: Face = {
    ...FACE0, tired: 1,
    open: !up ? 0 : (f < 1695 ? 1.25 : lerp(1.25, 1.38, turn)) * blinkAt(f, [1688]),
    pupil: up ? lerp(0.6, 0.45, turn) : 1, brow: up ? 0.9 : 0, browIn: up ? 1.25 : 0.3,
    mouth: !up ? "neutral" : f < 1679 ? "gasp" : "part", mouthOpen: f < 1679 ? 0.6 : 0.35 + 0.15 * turn,
    look: dart,
  };
  const p = doublePose(face, headPsi);
  p.psi = body; p.breathe = pant;
  const jolt = up ? Math.max(0, 1 - (f - 1665) / 10) : 0;   // hands shove back against the mattress, then come forward
  p.armL = [lerp(6, -28, jolt), 12, lerp(18, 26, jolt)]; p.armR = [lerp(6, -24, jolt), 12, lerp(18, 30, jolt)];
  p.handL = "open"; p.handR = "open";
  p.headNod = lerp(-6, 3, ramp(f, 1673, 1690)) * (up ? 1 : 0); p.headTilt = -4 * turn;
  return p;
}
/** S17-S19: the phone, held low, throws his shadow up the door behind him, bigger. The shadow's head is wrong: too long,
 *  on a neck too thin. It is the devil's shape. It never moves on its own; nothing points at it. */
const SHADOW_FRAME = { x0: -46, y0: 140, w: 92, h: 120 };
function wrongShadow(w: World, k: number, sway = 0) {
  const c = w.watcher;
  if (k <= 0) { c.visible = false; return; }
  c.resize(736, 960); c.setFrame(SHADOW_FRAME);
  c.draw((ctx) => {
    // the shadow shape, softened like a cast shadow from a small close light
    drawWatcher(ctx, SHADOW_FRAME, { eyes: 0, smile: 0, rim: 0, tilt: sway, lean: 0 });
    const t = document.createElement("canvas"); t.width = ctx.canvas.width; t.height = ctx.canvas.height; t.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
    const W = t.width, H = t.height;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    // the phone's cold light on the door: a soft pool...
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.5, W * 0.62);
    g.addColorStop(0, "rgba(150,175,255,0.30)"); g.addColorStop(0.55, "rgba(120,140,240,0.12)"); g.addColorStop(1, "rgba(100,120,220,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // ...and his shadow inside it, with the wrong head
    ctx.globalCompositeOperation = "destination-out"; ctx.filter = "blur(10px)"; ctx.globalAlpha = 0.95; ctx.drawImage(t, 0, 0);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 0.55; ctx.drawImage(t, 0, 0);
    ctx.restore();
  });
  c.mat.opacity = k; c.mat.color.setScalar(1);
  // the phone is held a little to his left, so the shadow falls to his right on the door, its head beside and just above
  // his (the door's inner face is at z = 2.945, facing into the room)
  c.pivot.position.set(-2.4, 0.97 - 2.195, 2.935); c.pivot.rotation.set(0, Math.PI, 0);
  c.visible = true; c.blob.visible = false;
}
/** his card pivots at his hips in the bed: lying back under the duvet, then sitting bolt upright */
function placeInBed(w: World, cam: THREE.PerspectiveCamera, f: number, L: Light) {
  const c = w.cu; c.setFrame(BED_UP); c.mat.opacity = 1;
  const pose = bedPose(f, cam);
  c.draw((ctx, F) => drawCharacter(ctx, pose, L, F));
  const yaw = Math.atan2(cam.position.x - BED_HIP.x, cam.position.z - BED_HIP.z);
  c.pivot.position.copy(BED_HIP); c.pivot.rotation.set(0, yaw, 0); c.pivot.rotateX(-bedPitch(f));
  c.visible = true; c.blob.visible = false;
}

/** neon practicals around the Day 3 spot */
function spotLights(w: World) {
  w.practical(0, [9.0, 3.6, -10.0], "#b07bff", 40, 12);
  w.practical(1, [11.8, 2.4, -13.5], "#3ff0e0", 25, 10);
}

// ---------------------------------------------------------------- shots
export const SHOTS: Shot[] = [
  // S01 — cold open: the camera turns to an empty spot, waits, and he walks into it
  {
    id: "S01", a: 0, b: 144, look: "night", grade: "night",
    cam: (f) => keys([{ f: 0, pos: [9.85, 2.3, -5.3], look: [12.0, 2.62, -11.5], fov: 36 }, { f: 36, pos: [9.84, 2.28, -5.27], look: [12.0, 2.6, -11.5], fov: 36 },
      { f: 100, pos: [9.6, 1.45, -4.0], look: [11.2, 1.55, -11.6], fov: 46 }, { f: 144, pos: [9.7, 1.47, -4.5], look: [11.22, 1.6, -11.6], fov: 44 }], f),
    dof: () => ({ cInf: 3, focus: [11.3, 2.2, -11.5] }),
    act: (f, w, cam) => {
      spotLights(w);
      // the camera turns 70° onto empty pavement (0.4-1.5 s), tilts down, blinks once
      w.aimCams(SPOT_HEAD, 0);                         // every other camera at rest...
      w.aimCams(SPOT_HEAD, ramp(f, 12, 45), [0]);       // ...then the laundry camera turns (after, so the rest call can't undo it)
      w.city.heroCam.led.visible = !(f >= 50 && f < 54);
      // he steps in from the left edge (f86) and stops exactly where it is looking (f107), then looks up at it
      const tStop = 107, speed = 1.15;
      const dist = f < tStop - 8 ? (speed * (tStop - 4 - f)) / FPS : 0.11 * (1 - ramp(f, tStop - 8, tStop));
      const p = SPOT.clone().add(V([-dist, 0, 0]));
      const moving = f < tStop;
      const face: Partial<Face> = { ...TIRED, browIn: 0.8, look: f > 113 ? [0.2, 0.7] : [0.3, 0], open: 0.92 * blinkAt(f, [129]) };
      const toCam = V([12.85, 0, -11.5]).sub(p).setY(0).normalize();
      const pose = moving ? walk(World.psi(p, V([1, 0, 0]), cam), -dist / 1.5, face, { amp: f > tStop - 10 ? 0.5 : 1 })
        : stand(World.psi(p, V([1, 0, 0]).lerp(V([0.5, 0, 0.87]), ramp(f, tStop, tStop + 10)).normalize(), cam), f / FPS, face);
      void toCam;
      if (!moving) pose.headNod = -18 * ramp(f, 110, 120);
      w.place(w.hero, pose, NEON, BODY, p, cam, { floorY: 0.15 });
    },
  },
  // S02 — Day 1: his eyes snap open (2 frames before "woke")
  {
    id: "S02", a: 144, b: 216, look: "sunrise", grade: "warm",
    cam: (f) => ({ ...keys([{ f: 144, pos: [1.62, 1.55, -2.28], look: [1.55, 0.7, -2.4], fov: 30 }, { f: 216, pos: [1.6, 1.41, -2.31], look: [1.55, 0.7, -2.41], fov: 30 }], f), up: [0, 0, -1] }),
    dof: () => ({ cInf: 10, focus: [1.55, 0.7, -2.38] }),
    act: (f, w) => {
      const open = f < 184 ? 0 : f < 186 ? [0.5, 1.3][f - 184] : f < 193 ? 1.25 : blinkAt(f, [206]) * 1.08;
      const face: Face = { ...FACE0, open, pupil: f > 186 ? 0.75 : 1, brow: f > 186 ? 0.5 : 0, browIn: f > 186 ? 0.7 : 0.2, look: f > 196 ? [0.7, 0.15] : [0, 0], mouth: "part", mouthOpen: 0.2 };
      const c = w.cu; c.setFrame({ x0: -18, y0: -24, w: 36, h: 42 });
      c.draw((ctx, F) => { drawHeadOnly(ctx, "front", face, SUN_SIDE, F, -10, 0.8); stripes(ctx, 0.5); });
      c.pivot.position.set(1.55, 0.7, -2.4); c.pivot.rotation.set(-Math.PI / 2, 0, 0); c.visible = true; c.blob.visible = false;
    },
  },
  // S03 — he jolts upright; the stopped clock reads 06:12; the dust in the light hangs still
  {
    id: "S03", a: 216, b: 267, look: "sunrise", grade: "warm",
    cam: locked(216, 267, [-0.55, 1.12, -0.95], [1.62, 1.1, -1.62], 40, 0.03),
    dof: () => ({ cInf: 7, focus: [1.55, 1.2, -1.75] }),
    act: (f, w, cam) => {
      const k = f < 219 ? 0 : ss((f - 219) / 8) * 1.04 - Math.max(0, ss((f - 227) / 7) * 0.04);
      const face: Partial<Face> = { open: 1.2, pupil: 0.65, brow: 0.8, browIn: 1.0, mouth: f < 232 ? "gasp" : "tight", mouthOpen: 0.4, look: [0.6, 0.1] };
      w.place(w.hero, lieToSit(clamp(k, 0, 1.04), f / FPS, face, f < 240 ? 90 : 108), SUN_BACK, { x0: -110, y0: 40, w: 220, h: 150 }, V([1.55, -0.37, -1.62]), cam, { blob: false });
    },
  },
  // S04 — the window: palm on the glass, "HELLO?!" — the city throws it back
  {
    id: "S04", a: 267, b: 342, look: "sunrise", grade: "warm",
    cam: glide(267, 342, { pos: [1.8, 1.86, 0.78], look: [40, -6, 2.0], fov: 40, roll: -0.6 }, { pos: [2.1, 1.84, 0.8], look: [40, -6, 2.0], fov: 37.5, roll: -0.6 }),
    dof: () => ({ cInf: 5, focus: [60, -18, -1.5] }),
    act: (f, w, cam) => {
      const p = V([3.12, 0, 0.62]);
      const pose = stand(World.psi(p, V([1, 0, -0.05]), cam), f / FPS, {});
      const reach = ramp(f, 268, 280);
      pose.armR = [lerp(4, 62, reach), lerp(6, 38, reach), lerp(8, 36, reach)];
      const shout = ramp(f, 279, 284) * (1 - 0.5 * ramp(f, 296, 310));
      pose.lean = 3 + 9 * shout; pose.headNod = -6 * shout - 2;
      w.place(w.hero, pose, SUN_BACK_OTS, BODY, p, cam);
    },
  },
  // S05 — his face at the glass: hope draining away. "I haven't slept since."
  {
    id: "S05", a: 342, b: 402, look: "sunrise", grade: "warm",
    cam: locked(342, 402, [3.98, 1.63, 0.42], [3.12, 1.6, 0.62], 30, 0.17),
    dof: () => ({ cInf: 9, focus: [3.12, 1.62, 0.62] }),
    act: (f, w, cam) => {
      const p = V([3.12, 0, 0.62]);
      const face: Partial<Face> = { open: blinkAt(f, [366]) * 1.12, pupil: 0.75, brow: 0.45, browIn: 1.25, mouth: f < 374 ? "part" : "tight", mouthOpen: 0.25, look: [0, 0.1] };
      const pose = stand(World.psi(p, V([1, 0, -0.05]), cam), f / FPS, face);
      pose.headNod = 4; pose.headTilt = -2;
      w.cu.setFrame(HEAD_CU);
      w.cu.draw((ctx, F) => drawCharacter(ctx, pose, SUN_FRONT, F, { lineK: 0.75 }));
      w.cu.stand(p, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
      (w.apt.fog.material as THREE.MeshBasicMaterial).opacity = lerp(0.34, 0.12, ramp(f, 342, 402));
    },
  },
  // S06 — Day 2: the empty avenue; a pigeon hangs in the air, mid-wingbeat
  {
    id: "S06", a: 402, b: 450, look: "overcast", grade: "cool",
    cam: glide(402, 450, { pos: [1.1, 5.95, 12.95], look: [-0.5, 0.9, -30], fov: 38 }, { pos: [1.0, 5.0, 12.1], look: [-0.5, 0.75, -30], fov: 37 }),
    dof: () => ({ cInf: 0 }),
    act: (f, w, cam) => {
      const d = 3.0 + ((f - 402) / FPS) * 1.25;
      const p = V([-0.6, 0, -1 - d]);
      w.place(w.hero, walk(World.psi(p, V([0.02, 0, -1]), cam), d / STRIDE, { ...TIRED }), OVERCAST, BODY, p, cam, { lineK: 1.4 });
      const b = w.pigeon; b.setFrame({ x0: -34, y0: -14, w: 64, h: 52 });
      b.draw((ctx, F) => drawPigeon(ctx, OVERCAST, F));
      b.stand(V([0.25, 5.05, 6.4]), cam.position); b.visible = true; b.blob.visible = false;
      // plant: far down the avenue, in the fog, something tall stands perfectly still (the only other figure in the film)
      const e = w.watcher; e.setFrame({ x0: -45, y0: -4, w: 90, h: 255 });
      e.draw((ctx, F) => drawWatcher(ctx, F, { eyes: 0, smile: 0, rim: 0.1, tilt: -3, lean: 0 }));
      e.stand(V([-2.4, 0, -47]), cam.position); e.visible = true; e.blob.visible = false;
    },
  },
  // S07 — the café: steam hangs over the cup like glass; his fingers pass through it and nothing moves
  {
    id: "S07", a: 450, b: 546, look: "overcast", grade: "cool",
    cam: locked(450, 546, [-9.6, 1.2, -0.6], [-10.22, 1.03, -1.28], 34, 0.11),
    dof: () => ({ cInf: 10, focus: [-10.22, 1.06, -1.28] }),
    act: (f, w, cam) => {
      const steam = w.city.steam.position.clone().add(V([0, 0.1, 0]));
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      const off = lerp(-0.42, -0.07, ramp(f, 465, 486)) + lerp(0, -0.38, ramp(f, 516, 540));
      const h = w.hand; h.setFrame({ x0: -62, y0: -12, w: 80, h: 24 });
      const curl = 0.12 + 0.28 * ramp(f, 482, 500) - 0.2 * ramp(f, 514, 530);   // fingers close gently inside the steam, open as they leave
      h.draw((ctx, F) => drawHand(ctx, CAFE_HAND, F, 0.35, curl));
      h.stand(steam.clone().addScaledVector(right, off).add(V([0, -0.035, 0])), cam.position); h.visible = true; h.blob.visible = false;
    },
  },
  // S08 — dusk: the light is red forever; the street clock says 06:12
  {
    id: "S08", a: 546, b: 591, look: "dusk", grade: "dusk",
    cam: glide(546, 591, { pos: [-3.6, 1.0, -18.6], look: [-5.6, 4.7, -30.6], fov: 56, roll: 1 }, { pos: [-3.8, 1.02, -19.6], look: [-5.6, 4.5, -30.6], fov: 54, roll: 1.6 }),
    dof: () => ({ cInf: 0 }),
    act: (f, w, cam) => {
      const d = ((f - 546) / FPS) * 1.1;
      const p = V([-4.4, 0, -20.5 - d]);
      w.place(w.hero, walk(World.psi(p, V([0, 0, -1]), cam), d / STRIDE, { ...TIRED }), DUSK, BODY, p, cam);
    },
  },
  // S09 — Day 3: he tests it. Step left: it follows. Step right: it follows.
  {
    id: "S09", a: 591, b: 744, look: "night", grade: "night",
    cam: (f) => {
      const k = 0.6 * clamp((f - 591) / 153) + 0.4 * ss((f - 591) / 153), l = s09lat(f) * 0.85;   // the pan follows his steps
      return { pos: lerp3([8.5, 0.86, -8.45], [8.72, 0.9, -8.8], k), look: [11.1 + S09_RIGHT.x * l, 2.05, -11.6 + S09_RIGHT.z * l], fov: lerp(48, 45, k) };
    },
    dof: () => ({ cInf: 3, focus: [10.4, 1.6, -11.5] }),
    act: (f, w, cam) => {
      spotLights(w);
      const right = S09_RIGHT;
      const lat = s09lat;
      const p = SPOT.clone().addScaledVector(right, lat(f));
      const stepping = (f >= 606 && f < 620) || (f >= 681 && f < 697);
      const toCctv = V([0.5, 0, 0.87]);
      const face: Partial<Face> = { ...TIRED, open: 1.1, browIn: 1.0, look: [0.2, 0.6] };
      let pose: Pose;
      if (stepping) {
        const dir = f < 650 ? right.clone().negate() : right.clone();
        const ph = f < 650 ? (f - 606) / 28 : (f - 681) / 32;
        pose = walk(World.psi(p, dir, cam), ph, face, { amp: 0.7 });
      } else pose = stand(World.psi(p, toCctv, cam), f / FPS, face);
      pose.headNod = -16;
      w.place(w.hero, pose, NEON, BODY, p, cam, { floorY: 0.15 });
      // it follows his head with an 8-frame servo lag
      const lagged = SPOT_HEAD.clone().addScaledVector(right, lat(f - 8));
      w.aimCams(lagged, 0);
      w.aimCams(lagged, 1, [0]);
    },
  },
  // S10 — every camera on the street turns to him at once
  {
    id: "S10", a: 744, b: 813, look: "night", grade: "night",
    cam: glide(744, 813, { pos: [9.15, 0.95, -11.55], look: [12.85, 7.2, -11.1], fov: 50, roll: -3 }, { pos: [9.45, 1.3, -11.52], look: [12.85, 7.2, -11.1], fov: 48, roll: -6 }),
    dof: () => ({ cInf: 0 }),
    act: (f, w, cam) => {
      spotLights(w);
      w.practical(2, [11.6, 5.0, -11.2], "#b07bff", 40, 10);
      const p = END9.clone();
      const pose = stand(World.psi(p, V([1, 0, 0.05]), cam), f / FPS, { ...TIRED, open: 1.2, pupil: 0.6, brow: 0.9, browIn: 1.1, look: [0, 0.6] });
      pose.headNod = -18; pose.armL = [5, 12, 15]; pose.armR = [5, 12, 15];
      w.place(w.hero, pose, NEON, BODY, p, cam, { floorY: 0.15 });
      const head = END9.clone().setY(1.65);
      w.city.cams.forEach((_, i) => { if (i > 0) w.aimCams(head, ramp(f, 753 + (i % 5) * 2, 780 + (i % 5) * 2), [i]); });
      w.aimCams(head, 1, [0]);
    },
  },
  // S11 — his face, looking up at them
  {
    id: "S11", a: 813, b: 849, look: "night", grade: "night",
    cam: locked(813, 849, [END9.x + 1.15, 1.56, END9.z - 0.35], [END9.x, 1.83, END9.z], 34, 0.15),
    dof: () => ({ cInf: 12, focus: [END9.x, 1.81, END9.z] }),
    act: (f, w, cam) => {
      spotLights(w); w.practical(2, [11.6, 5.0, -11.2], "#b07bff", 40, 10);
      const p = END9.clone();
      const pose = stand(World.psi(p, V([1, 0, 0.05]), cam), f / FPS, { ...TIRED, open: 1.3, pupil: 0.5, brow: 1.1, browIn: 1.3, mouth: "part", mouthOpen: 0.3, look: [0.25, 0.7] });
      const tr = Math.sin(f * 2.3) * 0.5 + Math.sin(f * 3.7 + 1) * 0.3;   // a fine fear tremble
      pose.headNod = -16 + tr * 0.6; pose.headTilt = 3 + tr * 0.5;
      pose.face = { ...pose.face, look: [0.25 + Math.sin(f * 1.9) * 0.03, 0.7 + Math.sin(f * 2.9) * 0.025] };
      w.cu.setFrame(HEAD_CU);
      w.cu.draw((ctx, F) => drawCharacter(ctx, pose, NEON_L, F, { lineK: 0.75 }));
      w.cu.stand(p, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
    },
  },
  // S12 — the shop window: his reflection walks with him, in perfect step
  {
    id: "S12", a: 849, b: 918, look: "night", grade: "night",
    cam: (f) => { const z = z12(f); return { pos: [-6.4, 1.5, z + 2.2], look: [-12.6, 1.3, z - 0.6], fov: 38 }; },
    dof: (f) => ({ cInf: 5, focus: [HERO_X5, 1.4, z12(f)] }),
    act: (f, w, cam) => {
      const z = z12(f), d = (f - 849) / FPS * 1.1;
      w.practical(0, [-11.0, 3.8, z - 1.5], "#b07bff", 30, 9); w.practical(1, [-8.6, 6.0, z + 4], "#3fd8d0", 22, 12);
      const p = V([HERO_X5, 0.15, z]), pr = V([mirrorX(HERO_X5), 0.15, z]);
      w.place(w.hero, walk(World.psi(p, V([0, 0, -1]), cam), d / STRIDE, { ...TIRED, look: [0.2, 0], browIn: 0.8, open: 0.92 * blinkAt(f, [876]) }), NEON, BODY, p, cam, { floorY: 0.15 });
      // his reflection blinks a beat after he does: the first thing that is wrong, easy to miss
      w.place(w.refl, walk(World.psi(pr, V([0, 0, -1]), cam), d / STRIDE, { ...TIRED, look: [0.2, 0], browIn: 0.8, open: 0.92 * blinkAt(f, [882]) }), GLASS, BODY, pr, cam, { blob: false });
      w.refl.mat.opacity = 0.7;
    },
  },
  // S13 — the mirror test: in sync, then 4 frames late, then 10, then 14
  {
    id: "S13", a: 918, b: 990, look: "night", grade: "night",
    cam: locked(918, 990, [-11.95, 1.5, -71.6], [-12.9, 1.35, -78.2], 40, 0.05),
    dof: () => ({ cInf: 3, focus: [-12.9, 1.45, Z5] }),
    act: (f, w, cam) => act13(f, w, cam),
  },
  // S13B — over his shoulder, onto its face in the glass: the head tilt comes late, the hand comes down late, it leans late
  {
    id: "S13B", a: 990, b: 1062, look: "night", grade: "night",
    cam: glide(990, 1062, { pos: [-11.56, 1.67, -77.7], look: [-13.55, 1.58, -78.44], fov: 33 }, { pos: [-11.66, 1.67, -77.76], look: [-13.55, 1.58, -78.42], fov: 31 }),
    dof: () => ({ cInf: 6, focus: [-13.55, 1.6, Z5] }),
    act: (f, w, cam) => act13(f, w, cam),
  },
  // S14 — he steps back; it steps back. He stops. It takes one more step.
  {
    id: "S14", a: 1062, b: 1152, look: "night", grade: "night",
    cam: locked(1062, 1152, [-12.4, 1.32, -70.4], [-12.95, 1.25, -78.2], 46, 0.1),
    dof: () => ({ cInf: 3, focus: [-12.9, 1.4, Z5] }),
    act: (f, w, cam) => act14(f, w, cam),
  },
  // S15 — close on the reflection: his face, blank; it goes black; his shape drains out of it and the entity is left; eyes, then the grin
  {
    id: "S15", a: 1152, b: 1311, look: "night", grade: "night",
    cam: locked(1152, 1311, [-12.45, 1.64, -76.4], [-13.55, 1.63, -78.2], 28, 0.1),
    dof: () => ({ cInf: 9, focus: [-13.55, 1.64, Z5] }),
    act: (f, w, cam) => {
      w.practical(0, [-12.2, 2.6, -77.6], "#b07bff", 14, 5);
      const pr = V([mirrorX(HERO_X13), 0.15, Z5]);
      const pose = stand(World.psi(pr, V([1, 0, 0.05]), cam), 0, { ...TIRED, open: 1.0, pupil: 0.9, brow: -0.05, browIn: 0.05, mouth: "neutral", look: [0, 0] });
      pose.breathe = 0; pose.headTilt = 0;
      const ink = ramp(f, 1186, 1200), morph = ramp(f, 1199, 1214), eyes = ramp(f, 1216, 1222), grin = ramp(f, 1258, 1292);
      const look = { eyes, smile: grin, rim: 0.45, tilt: -7 * ramp(f, 1236, 1290), lean: 0 };
      let head: DOMMatrix | null = null;
      w.cu.setFrame(GLASS_CU);
      w.cu.draw((ctx, F) => {
        drawCharacter(ctx, pose, GLASS, F, { lineK: 0.75, onHead: (m) => { head = m; } });
        glassTint(ctx); inkOver(ctx, ink * 0.97);
        const hm = head as DOMMatrix | null;
        if (hm && morph > 0) {
          // his shape narrows, stretches and fades while the entity's (eye line on his eye line) firms up out of it
          const him = copyCanvas(ctx.canvas), it = blankCanvas(ctx.canvas), c = hm.transformPoint(new DOMPoint(0, -3));
          const ix = it.getContext("2d")!; ix.setTransform(hm); entityOverHead(ix, morph); watcherBody(ix, look); glassTint(ix);
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.translate(c.x, c.y); ctx.scale(1 - 0.3 * morph, 1 + 0.16 * morph); ctx.translate(-c.x, -c.y);
          ctx.globalAlpha = 1 - morph; ctx.drawImage(him, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = morph; ctx.drawImage(it, 0, 0); ctx.restore();
        }
        if (ink > 0) haloBehind(ctx, `rgba(110, 92, 255, ${(0.85 * ink).toFixed(3)})`, 18);
        fadeBottom(ctx, 0.3);
      });
      w.cu.stand(pr, cam.position); w.cu.visible = true; w.cu.blob.visible = false; w.cu.mat.opacity = 0.9;
      const hm = head as DOMMatrix | null;
      if (hm && eyes > 0) w.glowOver(w.cu, (ctx) => { ctx.setTransform(hm); entityOverHead(ctx, 1); watcherBody(ctx, { ...look, glowOnly: true }); });
    },
  },
  // S16 — home: the door slams, the chain goes on, he slides down to the floor
  {
    id: "S16", a: 1311, b: 1377, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1311, pos: [-1.05, 0.42, 1.0], look: [-2.1, 1.15, 2.9], fov: 46 }, { f: 1348, pos: [-1.08, 0.42, 1.06], look: [-2.1, 1.14, 2.9], fov: 46 }, { f: 1370, pos: [-1.12, 0.42, 1.12], look: [-2.1, 0.86, 2.9], fov: 45 }, { f: 1377, pos: [-1.13, 0.42, 1.13], look: [-2.1, 0.85, 2.9], fov: 45 }], f),
    dof: () => ({ cInf: 5, focus: [-2.1, 1.0, 2.6] }),
    act: (f, w, cam) => {
      const p = V([-2.05, 0, 2.55]);
      w.apt.chainLocked.visible = f >= 1338; w.apt.chainLoose.visible = f < 1338;
      const turn = ramp(f, 1344, 1351);
      const face = V([0, 0, 1]).lerp(V([0.4, 0, -1]), turn).normalize();
      if (f < 1350) {
        const pose = stand(World.psi(p, face, cam), f / FPS, { ...TIRED, open: 1.2, browIn: 1.2 });
        const reach = ramp(f, 1324, 1331), drag = ramp(f, 1332, 1338), rel = ramp(f, 1341, 1348);
        const out: [number, number, number] = [lerp(5, 86, reach), lerp(6, 38, reach), lerp(8, 8, reach)];
        const across: [number, number, number] = [84, -8, 20];
        const held = out.map((v, i) => lerp(v, across[i], drag)) as [number, number, number];
        pose.armR = held.map((v, i) => lerp(v, [5, 6, 8][i], rel)) as [number, number, number];
        // the other hand braces flat on the door
        const brace = ramp(f, 1320, 1327) * (1 - rel);
        pose.armL = [lerp(5, 72, brace), lerp(7, 4, brace), lerp(10, 26, brace)]; pose.handL = brace > 0.5 ? "palm" : "open";
        pose.lean = lerp(2, 7, Math.max(reach, brace) * (1 - rel)); pose.twist = 8 * reach * (1 - drag) - 6 * drag * (1 - rel);
        w.place(w.hero, pose, NIGHT_ROOM, BODY, p, cam);
      } else {
        // he drops (accelerating), lands, and settles: weight, not a smooth tween
        const fall = clamp((f - 1350) / 13);
        const s = clamp(fall * fall * 1.06 - 0.06 * Math.sin(clamp((f - 1363) / 10) * Math.PI));
        const st = stand(World.psi(p, face, cam), f / FPS, { ...TIRED, open: 1.2, browIn: 1.2 });
        // he slides down clutching his phone (dark): the arms come in from his sides as he drops, no pop
        const fl = floorSit(f / FPS, { open: 1.2, browIn: 1.2 }, { psi: st.psi, hands: "phone", phone: 0 });
        const ak = ss(clamp((f - 1350) / 11));
        const armIn = (a: [number, number, number]): [number, number, number] => [lerp(5, a[0], ak), lerp(6, a[1], ak), lerp(8, a[2], ak)];
        const pose: Pose = { ...fl, armL: armIn(fl.armL), armR: armIn(fl.armR), handL: ak > 0.55 ? "phone" : "open", handR: ak > 0.55 ? "phone" : "open",
          hip: [0, lerp(93, 18, s), 0], legL: [lerp(0, 130, s), 12, lerp(2, 110, s)], legR: [lerp(0, 126, s), 16, lerp(2, 106, s)], lean: lerp(2, 6, s), legsFront: s > 0.5 };
        w.place(w.hero, pose, NIGHT_ROOM, BODY, V([-2.05, 0, lerp(2.55, 2.6, s)]), cam);
      }
    },
  },
  // S17 — on the floor in the dark; the phone buzzes for the first time in three days
  {
    id: "S17", a: 1377, b: 1437, look: "aptNight", grade: "night",
    cam: locked(1377, 1437, [-1.45, 0.78, 1.25], [-2.05, 0.55, 2.55], 40, 0.12),
    dof: () => ({ cInf: 6, focus: [-2.05, 0.7, 2.6] }),
    act: (f, w, cam) => {
      const lit = f >= 1407;
      const buzz = (f >= 1392 && f < 1397) || (f >= 1404 && f < 1409);
      const flinch = ramp(f, 1392, 1395) * (1 - ramp(f, 1400, 1410));
      const face: Partial<Face> = { open: lit ? 1.15 : blinkAt(f, [1384]) * 0.88, pupil: lit ? 0.7 : 0.9, browIn: 1.1, brow: lit ? 0.5 : 0, look: [0, -0.8], mouth: "tight" };
      const pose = floorSit(f / FPS, face, { phone: lit ? 1 : 0, nod: 14 - 8 * flinch, psi: World.psi(DOOR_SIT, V([0.6, 0, -1]), cam) });
      if (buzz) pose.hip = [((f % 2) - 0.5) * 0.6, 18, 0];
      w.place(w.hero, pose, lit ? PHONE : DARK, BODY, DOOR_SIT, cam);
      w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = lit ? 0.9 : 0; w.apt.phoneLight.distance = 1.6; w.apt.phoneLight.color.set("#bfe0ff");
      wrongShadow(w, lit ? ramp(f, 1407, 1412) : 0);
    },
  },
  // S18 — the photo: him, asleep in his bed. From: Me. 1 min ago.
  {
    id: "S18", a: 1437, b: 1563, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1437, pos: [-1.74, 0.98, 1.74], look: [-2.03, 0.62, 2.2], fov: 34 }, { f: 1563, pos: [-1.96, 0.74, 2.02], look: [-2.03, 0.62, 2.2], fov: 30 }], f),
    dof: () => ({ cInf: 8, focus: [-2.03, 0.62, 2.2] }),
    act: (f, w, cam) => {
      const pose = floorSit(f / FPS, { open: 1.1, look: [0, -0.8] }, { nod: 18, hands: "fist", psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
      w.place(w.hero, pose, PHONE, BODY, DOOR_SIT, cam);
      w.phone.visible = true; w.phone.position.set(-2.03, 0.62, 2.2); w.phone.lookAt(cam.position); w.phone.rotateZ(0.04);
      w.apt.phoneLight.position.set(-2.03, 0.75, 2.1); w.apt.phoneLight.intensity = 0.9; w.apt.phoneLight.distance = 1.6;
    },
  },
  // S19 — his eyes lift from the phone, then his head turns, slowly, toward the bed
  {
    id: "S19", a: 1563, b: 1635, look: "aptNight", grade: "night",
    cam: locked(1563, 1635, [-1.86, 0.9, 1.95], [-2.05, 0.86, 2.6], 32, 0.13),
    dof: () => ({ cInf: 12, focus: [-2.05, 0.88, 2.6] }),
    act: (f, w, cam) => {
      const lift = ramp(f, 1575, 1582);
      const turn = ss((f - 1594) / 26) + 0.06 * Math.sin(clamp((f - 1614) / 10) * Math.PI);   // the head follows the eyes, overshoots, settles
      const look = saccade(f, [[1563, [0, -0.8]], [1574, [0, -0.15]], [1589, [-0.95, 0.0]]]);
      const face: Partial<Face> = { open: f < 1589 ? 1.12 : 1.3, pupil: f < 1589 ? 0.7 : 0.5, brow: f < 1589 ? 0.5 : 1.0, browIn: 1.25, mouth: "part", mouthOpen: f < 1589 ? 0.2 : 0.35, look };
      const pose = floorSit(f / FPS, face, { phone: 1, nod: lerp(14, -2, lift), headPsi: lerp(0, -40, turn), psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
      pose.breathe = Math.sin((f / FPS) * Math.PI * 2 * 0.9);   // breathing faster now
      w.cu.setFrame({ x0: -36, y0: 52, w: 72, h: 76 });
      w.cu.draw((ctx, F) => drawCharacter(ctx, pose, PHONE, F, { lineK: 0.75 }));
      w.cu.stand(DOOR_SIT, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
      w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 0.8;
    },
  },
  // S20 — something moves under the duvet. It is him: the same guy jolts upright in his bed, panting, terrified; he holds
  // his breath, and turns, slowly, eyes first, to look over his shoulder into the dark corner
  {
    id: "S20", a: 1635, b: 1725, look: "aptNight", grade: "night",
    // the eye line from the floor by the door: holds on the breathing duvet, then a slow zoom closes on his face
    cam: (f) => keys([{ f: 1635, pos: [-1.75, 0.82, 2.05], look: [1.55, 0.72, -1.7], fov: 30 }, { f: 1660, pos: [-1.745, 0.82, 2.045], look: [1.55, 0.73, -1.7], fov: 29.2 },
      { f: 1698, pos: [-1.7, 0.83, 2.0], look: [1.55, 1.08, -1.62], fov: 17 }, { f: 1725, pos: [-1.67, 0.83, 1.97], look: [1.53, 1.1, -1.62], fov: 15 }], f),
    dof: () => ({ cInf: 4, focus: [1.55, 1.15, -1.62] }),
    act: (f, w, cam) => {
      const u = clamp((1.35 - bedPitch(f)) / 1.35);
      const stir = f >= 1657 && f < 1665 ? 0.18 * Math.sin(((f - 1657) / 8) * Math.PI) : 0;   // the lump shifts: someone is under there
      w.apt.setBody(Math.max(0.3, 1 - 0.7 * u) + stir, ((f - 1635) / FPS) * Math.PI * 2 * 0.55 * (1 - u));
      placeInBed(w, cam, f, NIGHT_ROOM);
    },
  },
  // S21 — over his shoulder, into the corner, as in the first cut. Darkness first: the shape is only just there. Its eyes
  // open, slowly. The camera begins to close in; the grin spreads; it leans toward us; it holds our eyes. Hard cut.
  {
    id: "S21", a: 1725, b: 1806, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1725, pos: S21_POS, look: S21_LOOK, fov: 30 }, { f: 1752, pos: [3.07, 1.505, -0.915], look: S21_LOOK, fov: 28.5 },
      { f: 1806, pos: [2.9, 1.54, -0.98], look: [-3.12, 2.12, -2.68], fov: 12 }], f),
    dof: () => ({ cInf: 7, focus: [-3.12, 1.9, -2.68] }),
    act: (f, w, cam) => {
      w.apt.setBody(0.3, 0);
      placeInBed(w, cam, f, DARK);
      cornerWash(w);
      const rim = lerp(0.2, 0.6, ramp(f, 1725, 1752));          // the shape surfaces as the eye adjusts to the dark
      const eyes = ramp(f, 1750, 1758), grin = ramp(f, 1766, 1794);
      // final cut: it holds us a while longer; the head keeps cocking, it keeps leaning in (1806-1859)
      const tilt = -2 - 8 * ramp(f, 1738, 1798) - 3.5 * ramp(f, 1806, 1859), lean = 1 + 2.5 * ramp(f, 1778, 1806) + 0.8 * ramp(f, 1806, 1859);
      const look = { eyes, smile: grin, rim, tilt, lean };
      const c = w.watcher; c.resize(1240, 3520); c.setFrame(DEVIL_FRAME);
      c.draw((ctx) => drawWatcher(ctx, DEVIL_FRAME, look));
      c.stand(DEVIL_SPOT, cam.position); c.visible = true; c.blob.visible = false;
      if (eyes > 0) w.glowOver(c, (ctx) => drawWatcher(ctx, DEVIL_FRAME, { ...look, rim: 0, glowOnly: true }));
    },
  },
  // END — black and silence (the PART 2? prompt is an overlay from PROMPT_AT)
  {
    id: "END", a: 1806, b: 1875, look: "aptNight", grade: "night",
    cam: () => ({ pos: [0.97, 1.27, -0.95], look: [1.55, 1.26, -1.62], fov: 30 }),
    dof: () => ({ cInf: 0 }),
    act: () => {},
  },
];

// ---------------------------------------------------------------- scene 5 choreography
const z12 = (f: number) => Z5 + ((918 - f) / FPS) * 1.1;   // walking -z, arriving at Z5 on the cut

/** S13: he faces the glass and tests it; the reflection answers with a growing delay */
function act13(f: number, w: World, cam: THREE.PerspectiveCamera) {
  w.practical(0, [-11.4, 3.6, -79.4], "#b07bff", 30, 9); w.practical(1, [-10.0, 3.0, -75.5], "#3fd8d0", 16, 10);
  const raise = (g: number, lagDown: number) => ramp(g, 948, 966) * (1 - ramp(g - lagDown, 1020, 1038));
  const tilt = (g: number) => 7 * ramp(g, 990, 1004);
  const lean = (g: number) => ramp(g, 1044, 1060);
  const turnH = ramp(f, 918, 930);
  const p = V([lerp(HERO_X5, HERO_X13, ramp(f, 920, 940)), 0.15, Z5]);
  const hface = V([0, 0, -1]).lerp(V([-1, 0, 0]), turnH).normalize();
  const hero = stand(World.psi(p, hface, cam), f / FPS, { ...TIRED, open: 1.15 * blinkAt(f, [936]), browIn: 1.1, look: [0, 0] });
  const r = raise(f, 0);
  hero.armR = [lerp(3, 58, r), lerp(6, 6, r), lerp(8, 58, r)]; hero.handR = r > 0.5 ? "palm" : "open";
  hero.headTilt = tilt(f); hero.lean = 2 + 8 * lean(f);
  w.place(w.hero, hero, NEON, BODY, p, cam, { floorY: 0.15 });
  // reflection: mirror position, mirror arm, same timing at first, then later and later
  const pr = V([mirrorX(p.x) - 0.25 * lean(f - 14), 0.15, Z5]);
  const rface = V([0, 0, -1]).lerp(V([1, 0, 0]), turnH).normalize();
  const refl = stand(World.psi(pr, rface, cam), (f - 4) / FPS, { ...TIRED, open: 1.15 * blinkAt(f, [941, 1012]), browIn: 1.1, look: [0, 0] });
  const rr = raise(f, 10);
  refl.armL = [lerp(3, 58, rr), lerp(6, 6, rr), lerp(8, 58, rr)]; refl.handL = rr > 0.5 ? "palm" : "open";
  refl.headTilt = -tilt(f - 4); refl.lean = 2 + 8 * lean(f - 14);
  w.place(w.refl, refl, GLASS, BODY, pr, cam, { blob: false });
  w.refl.mat.opacity = 0.74;
}

/** S14: he steps back; it steps back with him; he stops; it takes one more step toward the glass, then turns to us */
function act14(f: number, w: World, cam: THREE.PerspectiveCamera) {
  w.practical(0, [-11.4, 3.6, -79.4], "#b07bff", 30, 9); w.practical(1, [-10.0, 3.0, -75.5], "#3fd8d0", 16, 10);
  const back = ramp(f, 1074, 1089);
  const xh = HERO_X13 + 0.32 * back;
  const p = V([xh, 0.15, Z5]);
  const stepping = f >= 1074 && f < 1089;
  const hero = stepping ? walk(World.psi(p, V([-1, 0, 0]), cam), -back * 0.5, { ...TIRED, open: 1.25, pupil: 0.6, browIn: 1.2 }, { amp: 0.6 })
    : stand(World.psi(p, V([-1, 0, 0]), cam), f / FPS, { ...TIRED, open: 1.25, pupil: 0.6, browIn: 1.2, mouth: f > 1105 ? "part" : "tight" });
  w.place(w.hero, hero, NEON, BODY, p, cam, { floorY: 0.15 });
  // the reflection mirrors the step back... then steps forward on its own
  const extra = ramp(f, 1101, 1119);
  const xr = mirrorX(xh) + 0.32 * extra;
  const pr = V([xr, 0.15, Z5]);
  const rStep = (f >= 1074 && f < 1089) || (f >= 1101 && f < 1119);
  const headTurn = ramp(f, 1137, 1149);
  const rFace: Partial<Face> = f < 1101 ? { ...TIRED, open: 1.25, pupil: 0.6, browIn: 1.2 } : { ...TIRED, open: 1.0, brow: -0.05, browIn: 0.05, mouth: "neutral" };
  const refl = rStep ? walk(World.psi(pr, V([1, 0, 0]), cam), f < 1095 ? -back * 0.5 : extra * 0.5, rFace, { amp: 0.6 })
    : stand(World.psi(pr, V([1, 0, 0]), cam), 0, rFace);
  const camYaw = World.psi(pr, cam.position.clone().sub(pr).setY(0).normalize(), cam);
  if (!rStep) refl.headPsi = lerp(refl.psi, camYaw, headTurn);
  refl.breathe = 0;
  w.place(w.refl, refl, GLASS, BODY, pr, cam, { blob: false });
  w.refl.mat.opacity = 0.74;
}

// ---------------------------------------------------------------- canvas overlays
function stripes(ctx: CanvasRenderingContext2D, k: number) {
  // sunrise light through the blinds across the face: warm bands + cool shadow bands, kept to the drawing's alpha
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.translate(W / 2, H / 2); ctx.rotate(-0.42);
  for (let i = -12; i < 12; i++) {
    const y = i * H * 0.085;
    ctx.fillStyle = `rgba(20,16,60,${0.38 * k})`; ctx.fillRect(-W, y, W * 2, H * 0.042);
    ctx.fillStyle = `rgba(255,170,100,${0.12 * k})`; ctx.fillRect(-W, y + H * 0.045, W * 2, H * 0.036);
  }
  ctx.restore();
}
/** from his head space (eye line at y -0.6, y up) into the entity's own units; k < 1 is mid-morph (wider, shorter) */
function entityOverHead(ctx: CanvasRenderingContext2D, k: number) {
  const K = 0.8;
  ctx.translate(0, -0.6); ctx.scale(K * (1 + 0.28 * (1 - k)), K * (1 - 0.14 * (1 - k))); ctx.translate(0, -224);
}
/** the reflection dissolves into the dark glass toward the card's bottom edge */
function fadeBottom(ctx: CanvasRenderingContext2D, k: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height, g = ctx.createLinearGradient(0, H, 0, H * (1 - k));
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function blankCanvas(src: HTMLCanvasElement) { const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; return c; }
function copyCanvas(src: HTMLCanvasElement) { const c = blankCanvas(src); c.getContext("2d")!.drawImage(src, 0, 0); return c; }

function glassTint(ctx: CanvasRenderingContext2D) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save(); ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(30,50,110,0.22)"; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(120,160,255,0.05)";
  ctx.translate(W / 2, H / 2); ctx.rotate(0.5); ctx.fillRect(-W, -H * 0.4, W * 2, H * 0.12); ctx.fillRect(-W, H * 0.1, W * 2, H * 0.05);
  ctx.restore();
}

// the photo on the phone: standing over his bed, flash, him asleep (the double), the stopped clock beside him
export const PHOTO_SHOT: Shot = {
  id: "photo", a: 0, b: 1, look: "photo", grade: "night",
  cam: () => ({ pos: [2.3, 1.55, -1.5], look: [1.6, 0.66, -2.42], fov: 42, roll: -4 }),
  dof: () => ({ cInf: 0 }),
  act: (f, w, cam) => {
    w.apt.setBody(1, 0);
    const c = w.cu; c.setFrame({ x0: -26, y0: -40, w: 52, h: 60 });
    c.draw((ctx, F) => drawHeadOnly(ctx, "front", { ...FACE0, open: 0, mouth: "neutral", tired: 1 }, { ...PHONE, key: "#e6eeff", keyK: 1.0, ambK: 0.5, dir: 100 }, F, -12, 0.8, true));
    // him, asleep: head on the pillow, turned a little toward the lens; crown toward the headboard
    c.pivot.position.set(1.55, 0.72, -2.38); c.pivot.lookAt(cam.position); c.pivot.rotateX(-0.75);
    c.visible = true; c.blob.visible = false;
    w.apt.phoneLight.position.copy(cam.position); w.apt.phoneLight.intensity = 16; w.apt.phoneLight.distance = 10; w.apt.phoneLight.color.set("#e6eeff");
  },
};

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ================================================================ THE FINAL CUT (V1 x V3), second person, 1:48
// The film is rebuilt as an edit of shots. Each FinalShot shows `src` (an existing or new Shot) starting at its source
// frame `from`, optionally with its own camera; `reuse` shots come from the polished V3 render untouched; `black` shots
// are plain black (the title cards live in the overlay pass). Captions, labels and titles are a separate overlay pass.
export type FinalShot = { id: string; a: number; b: number; src?: Shot; from?: number; cam?: (f: number) => Cam; dof?: (f: number) => Dof; reuse?: string; black?: boolean };

const HOOK_EYE: V3 = [10.75, 2.35, -10.3];
/** the hook's button ("...that's what you think"): the laundry camera, close, turns until it stares down the lens */
const HOOKCAM: Shot = {
  id: "HOOKCAM", a: 0, b: 52, look: "night", grade: "night",
  cam: glide(0, 52, { pos: HOOK_EYE, look: [12.05, 2.82, -11.45], fov: 32 }, { pos: [10.93, 2.41, -10.48], look: [12.05, 2.84, -11.48], fov: 29 }),
  dof: () => ({ cInf: 9, focus: [12.1, 2.85, -11.5] }),
  act: (f, w, cam) => {
    spotLights(w);
    w.aimCams(SPOT_HEAD, 0);
    w.aimCams(cam.position.clone(), ramp(f, 3, 33), [0]);
  },
};

/** Day 1: the phone on the nightstand (no signal, stuck at 06:12) beside the stopped clock */
const P1: Shot = {
  id: "P1", a: 0, b: 132, look: "sunrise", grade: "warm",
  cam: glide(0, 132, { pos: [2.385, 0.95, -2.065], look: [2.885, 0.53, -2.445], fov: 34 }, { pos: [2.48, 0.88, -2.14], look: [2.885, 0.53, -2.445], fov: 32 }),
  dof: () => ({ cInf: 7, focus: [2.9, 0.52, -2.45] }),
  act: (f, w) => {
    w.apt.setBody(0.3, 0);
    w.apt.phoneOnStand.visible = false;
    w.lockScreen();
    w.phone.visible = true; w.phone.position.set(2.95, 0.511, -2.47); w.phone.rotation.set(-Math.PI / 2, 0, -0.85);   // beside the clock, reading upright to the lens
  },
};

/** Day 2: close on the pigeon, frozen mid-wingbeat; the camera drifts round it and nothing in the frame moves */
const PIGEON: Shot = {
  ...SHOTS.find((s) => s.id === "S06")!, id: "PIGEON",
  cam: (f) => glide(464, 560, { pos: [1.55, 4.45, 8.75], look: [0.25, 5.05, 6.4], fov: 30 }, { pos: [2.0, 4.6, 8.35], look: [0.22, 5.02, 6.38], fov: 28 })(f),
  dof: () => ({ cInf: 9, focus: [0.25, 5.05, 6.4] }),
};

const CORNER_HEAD: V3 = [-3.12, 1.95, -2.68];
/** the faint violet bounce of the city glow on the far walls: just enough to see the corner, and that it is empty */
function cornerWash(w: World, k = 1) {
  const l = w.apt.tvLight; l.color.set("#6f63d6"); l.position.set(-1.7, 2.1, -1.3); l.distance = 5.5; l.decay = 1.6; l.intensity = 2.2 * k;
}
/** the ending (V1): from the bed, the corner he is staring at. Empty. Nothing moves. */
const E1: Shot = {
  id: "E1", a: 0, b: 72, look: "aptNight", grade: "night",
  cam: glide(0, 72, { pos: [3.14, 1.49, -0.87], look: S21_LOOK, fov: 30.6 }, { pos: S21_POS, look: S21_LOOK, fov: 30 }),
  dof: () => ({ cInf: 7, focus: [-3.12, 1.9, -2.68] }),
  act: (f, w, cam) => { w.apt.setBody(0.3, 0); placeInBed(w, cam, 1725, DARK); cornerWash(w); },
};

/** you, on the floor by the door: your eyes leave the bed and go to the corner; your head follows, slowly */
const E2: Shot = {
  id: "E2", a: 0, b: 90, look: "aptNight", grade: "night",
  cam: locked(0, 90, [-1.86, 0.9, 1.95], [-2.05, 0.86, 2.6], 31, 0.16),
  dof: () => ({ cInf: 12, focus: [-2.05, 0.88, 2.6] }),
  act: (f, w, cam) => {
    const bodyPsi = World.psi(DOOR_SIT, V([0.15, 0, -1]), cam);
    const corner = V(CORNER_HEAD).sub(DOOR_SIT).setY(0).normalize();
    const cornerPsi = World.psi(DOOR_SIT, corner, cam);
    const turn = ss((f - 22) / 40);                                    // the head follows the eyes, slowly
    const look = saccade(f, [[0, [-0.95, 0.0]], [14, [0.9, 0.05]]]);   // the eyes go first
    const face: Partial<Face> = { open: 1.32 * blinkAt(f, [60]), pupil: 0.45, brow: 1.1, browIn: 1.3, mouth: "part", mouthOpen: 0.3, look };
    const pose = floorSit(f / FPS, face, { phone: 1, nod: -2, headPsi: lerp(-40, cornerPsi, turn), psi: bodyPsi });
    pose.breathe = Math.sin((f / FPS) * Math.PI * 2 * 0.5) * (1 - 0.7 * ss((f - 20) / 20));   // he stops breathing
    w.cu.setFrame({ x0: -36, y0: 52, w: 72, h: 76 });
    w.cu.draw((ctx, F) => drawCharacter(ctx, pose, PHONE, F, { lineK: 0.75 }));
    w.cu.stand(DOOR_SIT, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
    w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 0.8;
  },
};

/** the watcher's point of view: from the corner, high, looking down the dark room at you by the door. It breathes. */
const E3: Shot = {
  id: "E3", a: 0, b: 72, look: "aptNight", grade: "night",
  cam: (f) => {
    const k = 0.6 * clamp(f / 72) + 0.4 * ss(f / 72), br = Math.sin((f / FPS) * Math.PI * 2 * 0.28);
    return { pos: lerp3([-2.92, 2.28 + br * 0.012, -2.42], [-2.84, 2.22 + br * 0.012, -2.2], k), look: [-2.05, 0.82, 2.55], fov: lerp(30, 27, k), roll: -1.5 + br * 0.4 };
  },
  dof: () => ({ cInf: 5, focus: [-2.05, 0.85, 2.55] }),
  act: (f, w, cam) => {
    w.apt.setBody(0.3, 0);
    const toCam = cam.position.clone().sub(DOOR_SIT).setY(0).normalize();
    const face: Partial<Face> = { open: 1.35, pupil: 0.42, brow: 1.2, browIn: 1.35, mouth: "part", mouthOpen: 0.35, look: [0, 0.35] };
    const pose = floorSit(f / FPS, face, { phone: 1, nod: -4, headPsi: World.psi(DOOR_SIT, toCam, cam), psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
    pose.breathe = 0;
    w.place(w.hero, pose, PHONE, BODY, DOOR_SIT, cam);
    w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 0.8; w.apt.phoneLight.distance = 1.6;
    cornerWash(w);
  },
};

const S = (id: string) => SHOTS.find((s) => s.id === id)!;
/** build the edit: [id, frames, source] in order; frames are accumulated into absolute final frames */
function edit(rows: [string, number, Omit<FinalShot, "id" | "a" | "b">][]): FinalShot[] {
  let t = 0;
  return rows.map(([id, n, o]) => { const fs = { id, a: t, b: t + n, ...o }; t += n; return fs; });
}
export const FINAL: FinalShot[] = edit([
  // HOOK: you wake up; the window; the shout; nothing; "...that's what you think" -> the camera turns to the lens -> title
  ["F_S02", 56, { src: S("S02"), from: 160 }],
  ["F_S03", 51, { src: S("S03"), from: 216 }],
  ["F_S04", 172, { src: S("S04"), from: 170, cam: glide(170, 342, { pos: [1.8, 1.86, 0.78], look: [40, -6, 2.0], fov: 41, roll: -0.6 }, { pos: [2.12, 1.84, 0.8], look: [40, -6, 2.0], fov: 37.5, roll: -0.6 }) }],
  ["F_S05", 148, { src: S("S05"), from: 342, cam: locked(342, 490, [3.98, 1.63, 0.42], [3.12, 1.6, 0.62], 30, 0.22) }],
  ["F_CAM", 52, { src: HOOKCAM, from: 0 }],
  ["TITLE1", 60, { black: true }],
  // DAY 1-2: the frozen world
  ["F_P1", 132, { src: P1, from: 0 }],
  ["F_S06", 84, { src: S("S06"), from: 380, cam: glide(380, 464, { pos: [1.1, 5.95, 12.95], look: [-0.5, 0.9, -30], fov: 38 }, { pos: [1.02, 5.15, 12.25], look: [-0.5, 0.78, -30], fov: 37.2 }) }],
  ["F_PIGEON", 96, { src: PIGEON, from: 464 }],
  ["F_S07", 108, { src: S("S07"), from: 450, cam: locked(450, 558, [-9.6, 1.2, -0.6], [-10.22, 1.03, -1.28], 34, 0.13) }],
  ["F_S08", 102, { src: S("S08"), from: 546, cam: glide(546, 648, { pos: [-3.6, 1.0, -18.6], look: [-5.6, 4.7, -30.6], fov: 56, roll: 1 }, { pos: [-3.95, 1.03, -20.6], look: [-5.6, 4.4, -30.6], fov: 53, roll: 1.8 }) }],
  // DAY 3: the cameras (a crane down onto the street; the camera turns to the empty spot before you arrive)
  ["F_S01", 249, { src: S("S01"), from: -105, cam: (f) => keys([{ f: -105, pos: [8.6, 4.6, -1.2], look: [11.4, 2.3, -11.6], fov: 44 }, { f: 12, pos: [9.6, 1.6, -4.0], look: [11.35, 1.85, -11.6], fov: 46 }, { f: 144, pos: [9.72, 1.48, -4.6], look: [11.22, 1.6, -11.6], fov: 44 }], f) }],
  ["F_S09", 153, { src: S("S09"), from: 591 }],
  ["F_S10", 108, { src: S("S10"), from: 705, cam: glide(705, 813, { pos: [9.1, 0.92, -11.56], look: [12.85, 7.2, -11.1], fov: 51, roll: -2.5 }, { pos: [9.45, 1.3, -11.52], look: [12.85, 7.2, -11.1], fov: 48, roll: -6 }) }],
  ["F_S11", 36, { src: S("S11"), from: 813 }],
  // the reflection
  ["F_S12", 129, { src: S("S12"), from: 789 }],
  ["F_S13", 72, { reuse: "S13" }],
  ["F_S13B", 72, { reuse: "S13B" }],
  ["F_S14", 90, { reuse: "S14" }],
  ["F_S15", 159, { src: S("S15"), from: 1152 }],
  // home: the door, the phone, the photo, the bed
  ["F_S16", 66, { reuse: "S16" }],
  ["F_S17", 168, { src: S("S17"), from: 1269, cam: locked(1269, 1437, [-1.45, 0.78, 1.25], [-2.05, 0.55, 2.55], 40, 0.16) }],
  ["F_S18", 180, { src: S("S18"), from: 1437, cam: (f) => keys([{ f: 1437, pos: [-1.74, 0.98, 1.74], look: [-2.03, 0.62, 2.2], fov: 34 }, { f: 1617, pos: [-1.98, 0.72, 2.04], look: [-2.03, 0.62, 2.2], fov: 29 }], f) }],
  ["F_S19", 153, { src: S("S19"), from: 1482, cam: locked(1482, 1635, [-1.86, 0.9, 1.95], [-2.05, 0.86, 2.6], 32, 0.17) }],
  ["F_S20", 90, { src: S("S20"), from: 1635 }],
  // the ending (V1): the empty corner; you turn to it; something watching you from it; its eyes; black; the title
  ["F_E1", 72, { src: E1, from: 0 }],
  ["F_E2", 90, { src: E2, from: 0 }],
  ["F_E3", 72, { src: E3, from: 0 }],
  // the grin holds 1.8 s longer than in V3; the camera keeps creeping in, a little faster, right up to the hard cut
  ["F_S21", 135, { src: S("S21"), from: 1725, cam: (f) => {
    const c = S("S21").cam(Math.min(f, 1806));
    if (f <= 1806) return c;
    const k = ((f - 1806) / 53) ** 2;
    return { ...c, pos: lerp3([2.9, 1.54, -0.98], [2.84, 1.552, -1.0], k), fov: lerp(12, 10.2, k) };
  } }],
  ["BLACK", 42, { black: true }],
  ["TITLE2", 90, { black: true }],
  ["PART2", 75, { black: true }],
]);
export const FINAL_TOTAL = FINAL[FINAL.length - 1].b;
export const finalAt = (F: number) => FINAL.find((s) => F >= s.a && F < s.b) ?? FINAL[FINAL.length - 1];


// ================================================================ PART 2: "There are no cameras in your room."
// A 46 s loop for TikTok. Your phone shows a live night-vision feed of your own bedroom, from the corner where it stood.
// Shots use local frames (0 = their first frame). The last shot is the first shot again: the film loops on itself.

const IR: Light = { key: "#f2f2f2", keyK: 0.95, amb: "#8a8a92", ambK: 0.7, dir: 100, rim: { color: "#ffffff", k: 0.12, dir: 40, w: 0.6 } };
const IR_CLOSE: Light = { ...IR, keyK: 1.1, ambK: 0.8 };
const PHONE_P2: Light = { ...PHONE, keyK: 0.9, ambK: 0.5 };   // Part 2 is brighter: faces must read on a phone
const CAM_CORNER: V3 = [-3.28, 2.5, -2.78];       // the camera nobody installed, high in the corner where it stood
const CAM_BEHIND: V3 = [-2.3, 2.6, 2.93];         // the second one: right above the door, behind your head
const BED_SIDE = { x0: -110, y0: 40, w: 220, h: 150 };
const P2_BED_LOOK: V3 = [1.4, 0.7, -2.1];        // on the sleeper: the face on the pillow, the chest under the duvet
/** the camera's own infrared lamp: a white light at the lens (the picture is monochrome, so only its reach matters) */
function irLight(w: World, at: V3, k = 1) {
  const l = w.apt.lampLight; l.color.set("#ffffff"); l.position.set(...at); l.intensity = 10 * k; l.distance = 10; l.decay = 1.3;
}
/** a cold fill from the window over the bed, so the empty bed reads */
function bedFill(w: World, k = 1) {
  const l = w.apt.tvLight; l.color.set("#8a94e8"); l.position.set(1.3, 2.3, -0.6); l.distance = 4.5; l.decay = 1.4; l.intensity = 3.2 * k;
}
/** a point along the corner camera's view, on the floor, d metres out (for staging things in its picture) */
function alongCorner(d: number) {
  const dir = V(P2_BED_LOOK).sub(V(CAM_CORNER)).setY(0).normalize();
  return V(CAM_CORNER).setY(0).addScaledVector(dir, d);
}
/** the room in Part 2: door chained (he locked every door), his phone is in his hands, not on the nightstand */
function p2Room(w: World) {
  w.apt.chainLocked.visible = true; w.apt.chainLoose.visible = false;
  w.apt.phoneOnStand.visible = false;
}
const corner = (fov: number): Cam => ({ pos: CAM_CORNER, look: P2_BED_LOOK, fov });
/** asleep on his back in the bed, seen side-on (the same pose as waking in Part 1); breath period 4 s, phase 0 at f = 0 */
function sleeperPose(f: number, k: number, face: Partial<Face>, headPsi: number) {
  const pose = lieToSit(k, f / FPS, face, headPsi);
  pose.breathe = k > 0.02 ? 0 : Math.sin((f / FPS) * Math.PI * 2 * 0.25);
  return pose;
}

/** 0:00 / 0:43.0: the feed. Someone asleep in your bed. Also the last shot (negative frames), so the loop is seamless. */
const P2A: Shot = {
  id: "P2A", a: -90, b: 84, look: "aptNight", grade: "cctv",
  cam: () => ({ pos: CAM_CORNER, look: [1.25, 0.68, -2.3], fov: 29 }), dof: () => ({ cInf: 0 }),
  act: (f, w, cam) => {
    p2Room(w); irLight(w, CAM_CORNER); w.apt.setBody(0.22, 0);
    w.place(w.hero, sleeperPose(f, 0, { open: 0, mouth: "neutral", mouthOpen: 0 }, 90), IR, BED_SIDE, V([1.55, -0.37, -1.62]), cam, { blob: false });
  },
};
/** 0:02.8: you, on the floor by the door, lit by the phone, reading the feed */
const P2B: Shot = {
  id: "P2B", a: 0, b: 102, look: "aptNight", grade: "night",
  cam: locked(0, 102, [-1.86, 0.9, 1.95], [-2.05, 0.8, 2.6], 40, 0.12),     // face in the upper half: the captions sit on the hoodie
  dof: () => ({ cInf: 12, focus: [-2.05, 0.88, 2.6] }),
  act: (f, w, cam) => {
    p2Room(w);
    const look = saccade(f, [[0, [0.15, -0.8]], [40, [-0.25, -0.75]], [70, [0.1, -0.85]]]);
    const face: Partial<Face> = { open: 1.15 * blinkAt(f, [28]), pupil: 0.6, brow: 0.7, browIn: 1.3, mouth: "part", mouthOpen: 0.2, look };
    const pose = floorSit(f / FPS, face, { phone: 1, nod: 12, psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
    pose.breathe = Math.sin((f / FPS) * Math.PI * 2 * 0.7);
    w.cu.setFrame({ x0: -36, y0: 52, w: 72, h: 76 });
    w.cu.draw((ctx, F) => drawCharacter(ctx, pose, PHONE_P2, F, { lineK: 0.75 }));
    w.cu.stand(DOOR_SIT, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
    w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 1.0; w.apt.phoneLight.distance = 1.8;
  },
};
/** 0:06.2: the feed. It sits bolt upright, with no effort, like something pulled on a string, and turns to the lens */
const P2C: Shot = {
  id: "P2C", a: 0, b: 132, look: "aptNight", grade: "cctv",
  // starts exactly as the opening frame; when it sits up the camera pans and zooms onto it by itself (a PTZ camera)
  cam: (f) => { const k = ss((f - 53) / 14), z = ss((f - 84) / 44); return { pos: CAM_CORNER, look: lerp3([1.25, 0.68, -2.3], [1.5, 1.02, -1.75], k), fov: lerp(29, 21, z) }; },
  dof: () => ({ cInf: 0 }),
  post: (f) => ({ glitch: f >= 124 ? 0.9 : f >= 54 && f < 56 ? 0.35 : 0 }),
  act: (f, w, cam) => {
    p2Room(w); irLight(w, CAM_CORNER);
    const k = f < 54 ? 0 : 1.0 - Math.pow(1 - clamp((f - 54) / 5), 2);
    w.apt.setBody(0.22 * (1 - k), 0);
    const turn = f < 66 ? 0 : clamp((f - 66) / 4);
    const face: Partial<Face> = { open: f < 54 ? 0 : 1.12, pupil: 0.55, shine: false, brow: -0.1, browIn: 0, mouth: "neutral", mouthOpen: 0, look: [0, 0.1] };
    const pose = sleeperPose(f, k, face, lerp(90, 4, turn));
    pose.breathe = 0; pose.headNod = lerp(pose.headNod, -8, turn);
    w.place(w.hero, pose, IR, BED_SIDE, V([1.55, -0.37, -1.62]), cam, { blob: false });
  },
};
/** 0:10.6: you look up at the real bed. Empty. The duvet thrown back. */
const P2D: Shot = {
  id: "P2D", a: 0, b: 72, look: "aptNight", grade: "night",
  cam: (f) => { const c = locked(0, 72, [-1.75, 0.82, 2.05], [1.55, 0.72, -1.7], 30, 0.1)(f); const t = ss(f / 4); return { ...c, pos: lerp3([-1.8, 0.82, 2.12], c.pos, t) }; },
  dof: () => ({ cInf: 5, focus: [1.55, 0.7, -1.62] }),
  act: (f, w) => { p2Room(w); bedFill(w); w.apt.setBody(0, 0); w.apt.setThrownBack(1); },
};
/** 0:13.0: the feed. It is standing in the room now, looking up at the lens. Then, between two frames, it is closer. */
const P2E: Shot = {
  id: "P2E", a: 0, b: 108, look: "aptNight", grade: "cctv",
  cam: () => corner(34), dof: () => ({ cInf: 0 }),
  post: (f) => ({ glitch: f >= 68 && f < 76 ? 0.85 : 0 }),
  act: (f, w, cam) => {
    p2Room(w); irLight(w, CAM_CORNER); w.apt.setBody(0, 0); w.apt.setThrownBack(1);
    const near = f >= 72;
    const p = alongCorner(near ? 1.95 : 3.3);
    const toCam = V(CAM_CORNER).sub(p).setY(0).normalize();
    const face: Partial<Face> = { open: 1.1, pupil: 0.55, shine: false, brow: -0.1, browIn: 0, mouth: "neutral", look: [0, 0.4] };
    const pose = stand(World.psi(p, toCam, cam), 0, face);
    pose.headNod = near ? -22 : -14; pose.headTilt = near ? 10 : 4; pose.breathe = 0;
    pose.armL = [2, 4, 4]; pose.armR = [2, 4, 4];
    w.place(w.hero, pose, IR, BODY, p, cam);
  },
};
/** 0:16.6: you look at the corner where it stood in Part 1. Empty. */
const P2F: Shot = {
  id: "P2F", a: 0, b: 96, look: "aptNight", grade: "night",
  // the exact framing of Part 1's last shot (where it stood and grinned), from over the empty bed, pushing in
  cam: glide(0, 96, { pos: [3.14, 1.49, -0.87], look: S21_LOOK, fov: 30 }, { pos: S21_POS, look: S21_LOOK, fov: 25 }),
  dof: () => ({ cInf: 7, focus: [-3.12, 1.9, -2.68] }),
  act: (f, w) => { p2Room(w); cornerWash(w, 3.5); w.apt.setBody(0, 0); w.apt.setThrownBack(1); },
};
/** 0:19.8: the feed. A face fills the lens: yours. Its eyes go white. It grins. "It's done practising." */
const P2G: Shot = {
  id: "P2G", a: 0, b: 162, look: "aptNight", grade: "cctv",
  cam: () => corner(34), dof: () => ({ cInf: 0 }),
  post: (f) => ({ glitch: f >= 150 ? 0.4 + 0.6 * clamp((f - 150) / 8) : f >= 33 && f < 35 ? 0.5 : 0 }),
  act: (f, w, cam) => {
    p2Room(w); irLight(w, CAM_CORNER); w.apt.setBody(0, 0); w.apt.setThrownBack(1);
    const eyes = ramp(f, 30, 42), smile = ramp(f, 74, 114);
    const face: Face = { ...FACE0, tired: 1, open: 1.0, pupil: 0.85, shine: false, brow: -0.15, browIn: -0.1, mouth: "neutral", mouthOpen: 0, look: [0, 0], possessed: { eyes, smile } };
    const c = w.cu; c.resize(1400, 1520); c.setFrame({ x0: -24, y0: -33, w: 48, h: 52 });
    const tilt = lerp(-2, 8, ramp(f, 60, 150));
    c.draw((ctx, F) => drawHeadOnly(ctx, "front", face, IR_CLOSE, F, tilt, 0.85, true));
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const d = lerp(0.85, 0.58, ss(f / 155));
    c.pivot.position.copy(cam.position).addScaledVector(fwd, d).add(new THREE.Vector3(0, -0.02, 0));
    c.pivot.lookAt(cam.position);
    c.mat.opacity = 1; c.visible = true; c.blob.visible = false;
    if (eyes > 0.3 || smile > 0.02) w.glowOver(c, (ctx) => possessedGlow(ctx, c.frame, eyes, smile, tilt));   // IR eyeshine: they glow
  },
};
/** 0:25.2: the feed switches to a camera behind you: high in the corner over the door, looking down at you and your phone */
const P2H: Shot = {
  id: "P2H", a: 0, b: 114, look: "aptNight", grade: "cctv",
  cam: (f) => ({ pos: CAM_BEHIND, look: [-2.0, 0.35, 2.05], fov: lerp(50, 44, ss((f - 40) / 70)) }),
  dof: () => ({ cInf: 0 }),
  post: (f) => ({ glitch: f < 7 ? 1 - f / 7 : 0 }),
  act: (f, w, cam) => {
    p2Room(w); irLight(w, CAM_BEHIND, 0.8);
    const face: Partial<Face> = { open: 1.15, pupil: 0.6, brow: 0.7, browIn: 1.3, mouth: "part", mouthOpen: 0.2, look: [0, -0.8] };
    const pose = floorSit(f / FPS, face, { phone: 1, nod: 16, psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
    pose.breathe = Math.sin((f / FPS) * Math.PI * 2 * 0.7);
    w.place(w.hero, pose, IR, BODY, DOOR_SIT, cam, { blob: false });
    w.hero.pivot.rotateX(-0.85);   // a card seen from this high would foreshorten: lean it back toward the lens
    w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 1.0; w.apt.phoneLight.distance = 1.8;
  },
};
/** 0:29.0: you. You don't move. You don't breathe. */
const P2I: Shot = {
  id: "P2I", a: 0, b: 90, look: "aptNight", grade: "night",
  cam: glide(0, 90, { pos: [-1.86, 0.9, 1.95], look: [-2.05, 0.86, 2.6], fov: 32 }, { pos: [-1.9, 0.9, 2.08], look: [-2.05, 0.87, 2.6], fov: 27 }),
  dof: () => ({ cInf: 12, focus: [-2.05, 0.88, 2.6] }),
  act: (f, w, cam) => {
    p2Room(w);
    const face: Partial<Face> = { open: 1.34, pupil: 0.42, brow: 1.15, browIn: 1.45, mouth: "part", mouthOpen: 0.28, look: [0.02, -0.82] };
    const pose = floorSit(f / FPS, face, { phone: 1, nod: 10, psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
    pose.breathe = 0;
    w.cu.setFrame({ x0: -36, y0: 52, w: 72, h: 76 });
    w.cu.draw((ctx, F) => drawCharacter(ctx, pose, PHONE_P2, F, { lineK: 0.75 }));
    w.cu.stand(DOOR_SIT, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
    w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 1.0; w.apt.phoneLight.distance = 1.8;
  },
};
/** 0:32.0: the phone buzzes in his hands. A message from Me: "Don't turn around." and a photo of the back of his head */
const P2J: Shot = {
  id: "P2J", a: 0, b: 150, look: "aptNight", grade: "night",
  cam: (f) => keys([{ f: 0, pos: [-1.74, 0.98, 1.74], look: [-2.03, 0.62, 2.2], fov: 34 }, { f: 100, pos: [-1.9, 0.79, 1.96], look: [-2.03, 0.62, 2.2], fov: 30 }, { f: 150, pos: [-1.92, 0.775, 1.99], look: [-2.03, 0.62, 2.2], fov: 29 }], f),
  dof: () => ({ cInf: 8, focus: [-2.03, 0.62, 2.2] }),
  act: (f, w, cam) => {
    p2Room(w);
    const pose = floorSit(f / FPS, { open: 1.2, look: [0, -0.8] }, { nod: 18, hands: "fist", psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
    pose.breathe = 0;
    w.place(w.hero, pose, PHONE_P2, BODY, DOOR_SIT, cam);
    const buzz = (f >= 2 && f < 9) || (f >= 13 && f < 20) ? 0.0016 * Math.sin(f * 2.7) : 0;
    w.phone.visible = true; w.phone.position.set(-2.03 + buzz, 0.62, 2.2); w.phone.lookAt(cam.position); w.phone.rotateZ(0.04);
    w.msgScreen();
    w.apt.phoneLight.position.set(-2.03, 0.75, 2.1); w.apt.phoneLight.intensity = 1.0; w.apt.phoneLight.distance = 1.8;
  },
};
/** 0:37.0: above your head, the chain on the door starts to move. One link. Another. It drops out and swings. */
const CHAIN_TUGS = [18, 31, 41, 52, 60, 69, 77];
const P2K: Shot = {
  id: "P2K", a: 0, b: 135, look: "aptNight", grade: "night",
  cam: glide(0, 135, { pos: [-1.88, 0.8, 1.66], look: [-2.02, 1.12, 2.94], fov: 47 }, { pos: [-1.9, 0.8, 1.76], look: [-2.03, 1.14, 2.94], fov: 45 }),
  dof: () => ({ cInf: 4, focus: [-2.0, 1.3, 2.92] }),
  act: (f, w, cam) => {
    p2Room(w);
    let slide = 0;
    CHAIN_TUGS.forEach((t0) => { slide += clamp((f - t0) / 3) / CHAIN_TUGS.length; });
    w.apt.setChainSlide(slide, f >= 88 ? (f - 88) / FPS : -1);
    const up = ramp(f, 20, 23);       // his eyes go up at the first sound; his head does not move
    const face: Partial<Face> = { open: 1.34, pupil: 0.42, brow: 1.2, browIn: 1.45, mouth: "part", mouthOpen: 0.28, look: [0, lerp(-0.8, 0.55, up)] };
    const pose = floorSit(f / FPS, face, { phone: 1, nod: 10, psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
    pose.breathe = 0;
    w.place(w.hero, pose, PHONE_P2, BODY, DOOR_SIT, cam);
    w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 1.0; w.apt.phoneLight.distance = 1.8;
    const l = w.apt.tvLight; l.color.set("#aeb8ff"); l.position.set(-2.0, 0.95, 2.5); l.distance = 1.6; l.decay = 1.5; l.intensity = 2.2;   // the phone's glow up the door
  },
};
/** 0:41.5: you turn around. Cut before you see. */
const P2L: Shot = {
  id: "P2L", a: 0, b: 45, look: "aptNight", grade: "night",
  cam: (f) => ({ pos: lerp3([-1.86, 0.9, 1.95], [-1.9, 0.9, 2.05], ss(f / 45)), look: [-2.05, 0.88, 2.6], fov: 30 }),
  dof: () => ({ cInf: 12, focus: [-2.05, 0.88, 2.6] }),
  act: (f, w, cam) => {
    p2Room(w); w.apt.chainLocked.visible = false; w.apt.setChainSlide(1, 3);
    const turn = ss((f - 6) / 18);
    const look = saccade(f, [[0, [0, 0.5]], [3, [0.95, 0.35]]]);
    const face: Partial<Face> = { open: 1.36, pupil: 0.4, brow: 1.2, browIn: 1.45, mouth: "gasp", mouthOpen: 0.45, look };
    const pose = floorSit(f / FPS, face, { phone: 1, nod: lerp(8, -10, turn), headPsi: lerp(0, 130, turn), psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
    pose.breathe = 0;
    w.cu.setFrame({ x0: -36, y0: 52, w: 72, h: 76 });
    w.cu.draw((ctx, F) => drawCharacter(ctx, pose, PHONE_P2, F, { lineK: 0.75 }));
    w.cu.stand(DOOR_SIT, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
    w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 1.0; w.apt.phoneLight.distance = 1.8;
  },
};

export const P2: FinalShot[] = edit([
  ["P2_BED", 84, { src: P2A, from: 0 }],
  ["P2_FACE", 102, { src: P2B, from: 0 }],
  ["P2_SITUP", 132, { src: P2C, from: 0 }],
  ["P2_EMPTY", 72, { src: P2D, from: 0 }],
  ["P2_STAND", 108, { src: P2E, from: 0 }],
  ["P2_CORNER", 96, { src: P2F, from: 0 }],
  ["P2_GRIN", 162, { src: P2G, from: 0 }],
  ["P2_BEHIND", 114, { src: P2H, from: 0 }],
  ["P2_FREEZE", 90, { src: P2I, from: 0 }],
  ["P2_MSG", 150, { src: P2J, from: 0 }],
  ["P2_CHAIN", 135, { src: P2K, from: 0 }],
  ["P2_TURN", 45, { src: P2L, from: 0 }],
  ["P2_END", 90, { src: P2A, from: -90 }],
]);
export const P2_TOTAL = P2[P2.length - 1].b;
export const p2At = (F: number) => P2.find((s) => F >= s.a && F < s.b) ?? P2[P2.length - 1];


// ================================================================ PART 3: "It has your face."
// It is already inside. The window, the fire escape, the street where every camera wakes up, the rule (it can appear
// wherever a camera sees you), breaking them, the subway (no cameras), hundreds of them in the tunnel, the train, and
// the reflection. Shots use local frames from 0.

type Fr = { x0: number; y0: number; w: number; h: number };
const COPY_FACE: Partial<Face> = { open: 1.0, pupil: 0.85, shine: false, brow: -0.15, browIn: -0.1, mouth: "neutral", mouthOpen: 0 };
const HALL_BACK: Light = { key: "#aab6e0", keyK: 0.58, amb: "#343a6a", ambK: 0.52, dir: 70, rim: { color: "#e6efff", k: 1.2, dir: 75, w: 1.6 } };
const ROOM_P3: Light = { ...NIGHT_ROOM, keyK: 0.68, ambK: 0.58 };
const TORCH_L: Light = { key: "#eef2ff", keyK: 1.0, amb: "#181b2c", ambK: 0.32, dir: 30, rim: { color: "#6a7cff", k: 0.3, dir: 20, w: 0.7 } };
const BACKLIT_TORCH: Light = { key: "#3a4060", keyK: 0.35, amb: "#0c0e18", ambK: 0.3, dir: 90, rim: { color: "#e8eeff", k: 0.9, dir: 80, w: 1.2 } };
const TRAIN_L: Light = { key: "#c2ceff", keyK: 0.78, amb: "#2a3060", ambK: 0.52, dir: 95, rim: { color: "#6a7cff", k: 0.35, dir: 30, w: 0.8 } };
const P3_BODY: Fr = { x0: -70, y0: -8, w: 140, h: 210 };
const FIGURE_FR: Fr = { x0: -60, y0: -8, w: 120, h: 205 };

/** the copy: his body and hoodie, the entity's eyes and grin (glowing). Drawn on the refl card. */
function placeCopy(w: World, pose: Pose, L: Light, F: Fr, p: THREE.Vector3, cam: THREE.PerspectiveCamera, o: { eyes?: number; smile?: number; blob?: boolean; glow?: boolean } = {}) {
  const eyes = o.eyes ?? 1, smile = o.smile ?? 1;
  pose.face = { ...FACE0, ...TIRED, ...COPY_FACE, ...pose.face, possessed: { eyes, smile }, shine: false };
  let head: DOMMatrix | null = null;
  const c = w.refl; c.mat.opacity = 1;
  c.setFrame(F);
  c.draw((ctx, fr) => drawCharacter(ctx, pose, L, fr, { onHead: (m) => { head = m; } }));
  c.stand(p, cam.position); c.visible = true; c.blob.visible = o.blob ?? true;
  if (o.glow !== false && head) { const hm = head as DOMMatrix; w.glowOver(c, (ctx) => { ctx.save(); ctx.setTransform(hm); possessedGlowHead(ctx, eyes, smile); ctx.restore(); }); }
}
/** he places with an optional hands hook (the pipe, the torch) */
function placeHim(w: World, card: Card3, pose: Pose, L: Light, F: Fr, p: THREE.Vector3, cam: THREE.PerspectiveCamera, hands?: (ctx: CanvasRenderingContext2D, h: HandPts) => void, o: { blob?: boolean; lineK?: number } = {}) {
  card.setFrame(F);
  card.draw((ctx, fr) => drawCharacter(ctx, pose, L, fr, { onHands: hands, lineK: o.lineK }));
  card.stand(p, cam.position); card.visible = true; card.blob.visible = o.blob ?? true;
}
type Card3 = World["hero"];
/** a metal pipe in both hands: through the hands, along the line between them (or the forearm), well past the front hand */
const pipeHands = (ctx: CanvasRenderingContext2D, h: HandPts) => {
  let dx = h.wrR[0] - h.wrL[0], dy = h.wrR[1] - h.wrL[1], L = Math.hypot(dx, dy);
  if (L < 6) { dx = h.wrR[0] - h.elR[0]; dy = h.wrR[1] - h.elR[1]; L = Math.hypot(dx, dy) || 1; }
  const ux = dx / L, uy = dy / L, a = h.wrL, b = h.wrR;
  const p0: [number, number] = [a[0] - ux * 14, a[1] - uy * 14], p1: [number, number] = [b[0] + ux * 72, b[1] + uy * 72];
  const ln = (w: number, col: string, off = 0) => { ctx.beginPath(); ctx.moveTo(p0[0] - uy * off, p0[1] + ux * off); ctx.lineTo(p1[0] - uy * off, p1[1] + ux * off); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.stroke(); };
  ln(4.8, "#07060c"); ln(3.2, "#5e616c"); ln(0.9, "#b4b8c4", 0.7);
};
/** the phone held up as a torch in his near hand: the back of the phone, its light a hard white point */
const torchHand = (ctx: CanvasRenderingContext2D, h: HandPts) => {
  const w = h.wrR, e = h.elR; const dx = w[0] - e[0], dy = w[1] - e[1], L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L;
  ctx.save(); ctx.translate(w[0] + ux * 4, w[1] + uy * 4); ctx.rotate(Math.atan2(uy, ux) - Math.PI / 2);
  const r = new Path2D(); r.roundRect(-3.6, -2, 7.2, 14, 1.2); ctx.fillStyle = "#15141c"; ctx.fill(r); ctx.lineWidth = 0.6; ctx.strokeStyle = "#07060c"; ctx.stroke(r);
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-1.6, 9.8, 1.0, 0, 7); ctx.fill();
  ctx.restore();
};
function run(psi: number, phase: number, face: Partial<Face>): Pose {
  const p = walk(psi, phase, face, { amp: 1.35 });
  p.lean = 15; p.hip = [p.hip[0], p.hip[1] - 4, 0];
  const arm = (ph: number): [number, number, number] => [-38 * Math.cos(2 * Math.PI * (ph - 0.06)), 10, 72 + 14 * Math.cos(2 * Math.PI * ph)];
  p.armL = arm(phase); p.armR = arm(phase + 0.5); p.handL = "fist"; p.handR = "fist";
  p.headNod = -4; p.breathe = Math.sin(phase * 4 * Math.PI);
  return p;
}
function scramble(psi: number, t: number, face: Partial<Face>): Pose {
  const p = floorSit(t, face, { psi, hands: "fist" });
  const c = Math.sin(t * 2 * Math.PI * 1.7);
  p.lean = -16; p.hip = [0, 17, 0];
  p.legL = [112 + 16 * c, 14, 100 + 22 * c]; p.legR = [112 - 16 * c, 18, 100 - 22 * c];
  p.armL = [-52, 20, 8]; p.armR = [-52, 20, 8]; p.handL = "open"; p.handR = "open"; p.phoneGlow = 0;
  p.headNod = -12; p.breathe = Math.sin(t * 2 * Math.PI * 1.4);
  return p;
}
function crouch(psi: number, t: number, face: Partial<Face>): Pose {
  const p = stand(psi, t, face);
  p.hip = [0, 64, 0]; p.legL = [72, 10, 112]; p.legR = [56, 12, 102]; p.lean = 26; p.armL = [34, 14, 34]; p.armR = [14, 16, 22];
  return p;
}
function seated(psi: number, t: number, face: Partial<Face>): Pose {
  const p = stand(psi, t, face);
  p.hip = [0, 52, 0]; p.legL = [86, 9, 88]; p.legR = [82, 11, 84]; p.legsFront = true; p.lean = 6;
  p.armL = [32, 8, 58]; p.armR = [32, 8, 58]; p.handL = "open"; p.handR = "open";
  return p;
}
/** a jerky clock for the copy: it holds still, then is suddenly further along (it skips frames like a broken video) */
const stutter = (f: number, every = 4) => Math.floor(f / every) * every;
const SCARED: Partial<Face> = { open: 1.32, pupil: 0.45, brow: 1.15, browIn: 1.45, mouth: "gasp", mouthOpen: 0.45 };

// ---- the apartment: the door, the room
const DOORWAY = V([-2.15, 0, 3.22]);
const doorSwing = (f: number) => { const k = ss((f + 9) / 7); const bounce = f > -2 ? 0.09 * Math.sin((f + 2) * 0.9) * Math.exp(-(f + 2) / 6) : 0; return 1.72 * k - bounce; };
function p3Room(w: World, hall = 1) {
  w.apt.chainLocked.visible = false; w.apt.chainLoose.visible = true; w.apt.phoneOnStand.visible = false;
  w.hall.light.intensity = 7 * hall; w.apt.setBody(0, 0); w.apt.setThrownBack(1);
}
/** 0:00 the door flies open: in the doorway, your own face, grinning */
const T01: Shot = {
  id: "T01", a: 0, b: 90, look: "aptNight", grade: "night",
  cam: (f) => { const k = ss(f / 90), kick = f < 6 ? (1 - f / 6) * 0.05 : 0; return { pos: lerp3([-1.99, 0.74, 1.66 - kick], [-2.03, 0.76, 1.98], k), look: [-2.15, 1.52, 3.2], fov: lerp(46, 42, k) }; },
  dof: () => ({ cInf: 6, focus: [-2.15, 1.5, 3.2] }),
  act: (f, w, cam) => {
    p3Room(w); w.apt.doorPivot.rotation.y = doorSwing(f);
    const lunge = f < 8 ? 0.12 * (1 - f / 8) : 0;
    const pose = stand(0, f / FPS, {});
    pose.lean = 12 + 8 * ss((f - 20) / 50) + 18 * lunge / 0.12 * 0.5; pose.headTilt = lerp(-4, 12, ss((f - 30) / 50)); pose.headNod = -6; pose.breathe = 0;
    pose.armL = [10, 10, 10]; pose.armR = [24, 8, 30];
    placeCopy(w, pose, HALL_BACK, P3_BODY, DOORWAY.clone().add(V([0, 0, -lunge])), cam, { blob: false });
  },
};
/** 0:03 you scramble backwards across the floor; it steps in, in jerks */
const T02: Shot = {
  id: "T02", a: 0, b: 180, look: "aptNight", grade: "night",
  cam: glide(0, 180, { pos: [-0.85, 0.78, -0.35], look: [-2.1, 1.0, 2.9], fov: 44 }, { pos: [-0.8, 0.78, -0.55], look: [-2.05, 1.0, 2.7], fov: 42 }),
  dof: () => ({ cInf: 5, focus: [-2.1, 1.2, 2.6] }),
  act: (f, w, cam) => {
    p3Room(w); w.apt.doorPivot.rotation.y = 1.72;
    const t = f / FPS;
    const hp = V([-2.0, 0, 2.15]).lerp(V([-1.55, 0, 1.15]), ss(f / 150));
    const pose = scramble(World.psi(hp, V([-0.3, 0, 1]), cam), t, { ...SCARED, look: [0, 0.5] });
    pose.headPsi = World.psi(hp, V([-0.3, 0, 1]), cam);
    placeHim(w, w.hero, pose, ROOM_P3, P3_BODY, hp, cam);
    // it comes in, a step at a time, each step arriving all at once
    const g = stutter(f, 5) + (f > 118 ? 24 : 0);
    const cp = DOORWAY.clone().lerp(V([-2.05, 0, 1.95]), clamp(g / 165));
    const cpose = stand(World.psi(cp, V([0.3, 0, -1]), cam), g / FPS, {});
    cpose.lean = 8; cpose.headTilt = 10 + 4 * Math.sin(g * 0.3); cpose.headNod = 4; cpose.breathe = 0;
    cpose.armL = [8, 8, 8]; cpose.armR = [10, 8, 10];
    placeCopy(w, cpose, HALL_BACK, P3_BODY, cp, cam);
  },
};
/** 0:09 your face; its hand reaches into frame; you bolt */
const T03: Shot = {
  id: "T03", a: 0, b: 120, look: "aptNight", grade: "night",
  // in front of his face (it is behind us, at the door): its hand, his own hand, reaches in from the edge of frame
  cam: (f) => ({ pos: lerp3([-1.7, 0.98, 1.78], [-1.68, 0.97, 1.7], ss(f / 80)), look: [-1.55, 0.84, 1.15], fov: 40 }),
  dof: () => ({ cInf: 8, focus: [-1.55, 0.88, 1.15] }),
  act: (f, w, cam) => {
    p3Room(w); w.apt.doorPivot.rotation.y = 1.72;
    const hp = V([-1.55, 0, 1.15]);
    const bolt = ss((f - 84) / 7);
    const face: Partial<Face> = { ...SCARED, look: saccade(f, [[0, [0.05, 0.55]], [52, [0.85, 0.25]]]), mouthOpen: 0.4 + 0.15 * Math.sin(f * 0.7) };
    const toDoor = V([-0.25, 0, 1]).normalize();
    const pose = floorSit(f / FPS, face, { psi: World.psi(hp, toDoor, cam), hands: "fist", nod: -16 });
    pose.breathe = Math.sin((f / FPS) * Math.PI * 2 * 2.2); pose.lean = -10;
    pose.headPsi = lerp(World.psi(hp, toDoor, cam), -110, bolt);
    w.cu.setFrame({ x0: -36, y0: 52, w: 72, h: 76 });
    w.cu.draw((ctx, F) => drawCharacter(ctx, pose, ROOM_P3, F, { lineK: 0.75 }));
    w.cu.stand(hp.clone().add(V([-0.9 * bolt, 0, -0.4 * bolt])), cam.position); w.cu.visible = bolt < 0.98; w.cu.blob.visible = false;
    // its hand: in from the right edge, fingers first, toward his cheek; after he bolts it closes on nothing
    const reach = ss((f - 46) / 36);
    if (reach > 0) {
      const h = w.hand; h.setFrame({ x0: -62, y0: -12, w: 80, h: 24 });
      h.draw((ctx, F) => drawHand(ctx, ROOM_P3, F, 0.45, lerp(0.15, 0.85, ss((f - 86) / 8))));
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      const right = fwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      const face3 = hp.clone().add(V([0, 0.86, 0]));
      const at = face3.addScaledVector(fwd, -0.06).addScaledVector(right, lerp(0.36, 0.13, reach)).add(V([0, -0.03, 0]));
      h.mat.side = THREE.DoubleSide;   // mirrored (scale -1) the card would face away and be culled
      h.pivot.position.copy(at); h.pivot.lookAt(cam.position); h.pivot.scale.set(-1, 1, 1); h.visible = true; h.blob.visible = false;
    }
  },
};
/** 0:13 outside: you burst out of the window onto the fire escape and run down; it comes out after you, upside down */
const T04: Shot = {
  id: "T04", a: 0, b: 210, look: "aptNight", grade: "night",
  // outside, from the top of the stairs: he crashes through the window, crouches, runs at us and down past us.
  // Then the camera turns to the wall beside the window: it comes out, upside down, and crawls down after him.
  cam: (f) => { const k = ss((f - 100) / 36); return { pos: lerp3([4.6, 1.5, 2.3], [5.45, 1.35, -0.55], k), look: lerp3([3.6, 0.95, 0.25], [3.56, 1.55, -2.95], k), fov: lerp(56, 36, k) }; },
  dof: () => ({ cInf: 0 }),
  act: (f, w, cam) => {
    p3Room(w, 0.6); w.apt.doorPivot.rotation.y = 1.72;
    const fill = w.apt.tvLight; fill.color.set("#7f8ad8"); fill.position.set(5.6, 2.6, -1.6); fill.intensity = 5; fill.distance = 7; fill.decay = 1.4;
    const sp = w.sparks[0]; sp.glass = true;
    sp.burst(V([3.55, 1.3, 0.6]), (f - 1) / FPS);
    if (f < 100) {
      let p: THREE.Vector3, pose: Pose;
      if (f < 9) { p = V([3.1, 0.2, 0.55]).lerp(V([4.05, 0.02, 0.55]), f / 9); pose = crouch(World.psi(p, V([1, 0, 0.1]), cam), f / FPS, SCARED); pose.lean = 40; }
      else if (f < 30) { p = V([4.05, 0.02, 0.6]); pose = crouch(World.psi(p, V([0.3, 0, 1]), cam), f / FPS, SCARED); }
      else {
        const d = (f - 30) / FPS * 2.4;
        const z = 0.6 + Math.min(d, 1.35), drop = Math.max(0, d - 1.35);
        p = V([4.12, -drop * 0.7, z + drop * 0.72]);
        pose = run(World.psi(p, V([0, 0, 1]), cam), d / 2.0, SCARED);
      }
      placeHim(w, w.hero, pose, ROOM_P3, P3_BODY, p, cam, undefined, { blob: false });
    }
    // it: at the window from f 96, then out onto the wall beside it, upside down, crawling down in jerks
    if (f >= 96) {
      const g = stutter(f - 96, 5);
      const out = f >= 128;
      const pose = stand(0, g / FPS, {});
      pose.breathe = 0; pose.headTilt = out ? 0 : lerp(0, 70, ss((f - 104) / 16)); pose.headNod = out ? -20 : -8;
      if (out) { const ph = g / 10; pose.armL = [165 + 10 * Math.sin(ph), 18, 20]; pose.armR = [165 - 10 * Math.sin(ph), 18, 20]; pose.legL = [12 * Math.sin(ph), 10, 30]; pose.legR = [-12 * Math.sin(ph), 10, 30]; }
      const pw = out ? V([3.56, 2.95 - Math.min(0.9, (g - 32) * 0.012), -2.95]) : V([3.25, 0.32, -0.15]);
      placeCopy(w, pose, { ...ROOM_P3, keyK: 0.8 }, P3_BODY, pw, cam, { blob: false });
      if (out) { w.refl.pivot.rotation.set(0, Math.PI / 2, 0); w.refl.pivot.rotateZ(Math.PI); w.glow.pivot.quaternion.copy(w.refl.pivot.quaternion); w.glow.pivot.position.copy(w.refl.pivot.position); }
    }
  },
};

// ---- the street: the cameras wake up, it is already there
const p3Street = (w: World) => { spotLights(w); w.city.cams.forEach((c) => { c.led.visible = true; }); };
const T05: Shot = {
  id: "T05", a: 0, b: 210, look: "night", grade: "night",
  cam: (f) => ({ pos: [10.7, 0.55, -2.6], look: lerp3([10.4, 2.6, -16], [10.5, 1.9, -9], ss((f - 120) / 70)), fov: 44 }),
  dof: () => ({ cInf: 3, focus: [10.4, 1.5, -10] }),
  act: (f, w, cam) => {
    p3Street(w);
    const z = lerp(-24, -5.6, clamp(f / 168)), p = V([10.35, 0.15, z]);
    const pose = f < 168 ? run(World.psi(p, V([0, 0, 1]), cam), (z + 24) / 2.5, SCARED) : stand(World.psi(p, V([0, 0, 1]), cam), f / FPS, SCARED);
    if (f >= 168) { pose.lean = 18; pose.breathe = Math.sin(f * 0.5); }
    placeHim(w, w.hero, pose, NEON, P3_BODY, p, cam, undefined, { blob: true });
    const head = p.clone().add(V([0, 1.6, 0]));
    w.aimCams(head, ramp(f, 76, 81));
  },
};
const COPY_FAR = V([10.15, 0.15, -26]);
const T06: Shot = {
  id: "T06", a: 0, b: 120, look: "night", grade: "night",
  cam: (f) => ({ pos: lerp3([10.75, 1.72, -3.9], [10.72, 1.7, -4.3], ss(f / 120)), look: [10.35, 1.35, -26], fov: lerp(24, 19, ss(f / 120)) }),
  dof: () => ({ cInf: 6, focus: [10.15, 1.5, -26] }),
  act: (f, w, cam) => {
    p3Street(w);
    const me = V([10.98, 0.15, -6.4]);
    const pose = stand(World.psi(me, V([0, 0, -1]), cam), f / FPS, SCARED); pose.breathe = Math.sin(f * 0.5); pose.lean = 10;
    placeHim(w, w.hero, pose, NEON, P3_BODY, me, cam);
    w.aimCams(me.clone().add(V([0, 1.6, 0])), 1);
    const cpose = stand(World.psi(COPY_FAR, V([0, 0, 1]), cam), 0, {}); cpose.breathe = 0; cpose.headTilt = 8;
    placeCopy(w, cpose, NEON, P3_BODY, COPY_FAR, cam);
  },
};
const COPY_NEAR = V([10.55, 0.15, 2.4]);
const T07: Shot = {
  id: "T07", a: 0, b: 150, look: "night", grade: "night",
  cam: (f) => {
    const whip = ss((f - 8) / 9);
    const zMe = lerp(-6, -0.4, clamp((f - 12) / 40));
    return { pos: [lerp(10.9, 9.6, whip), 1.55, zMe - lerp(1.2, 2.8, whip)], look: lerp3([10.2, 1.45, -26], [10.5, 1.4, 4], whip), fov: lerp(30, 44, whip) };
  },
  dof: () => ({ cInf: 3, focus: [10.5, 1.4, 2] }),
  act: (f, w, cam) => {
    p3Street(w);
    const runK = clamp((f - 12) / 40), z = lerp(-6, -0.4, runK), me = V([10.4, 0.15, z]);
    const pose = f >= 12 && f < 52 ? run(World.psi(me, V([0, 0, 1]), cam), (z + 6) / 2.5, SCARED) : stand(World.psi(me, V([0, 0, f < 12 ? -1 : 1]), cam), f / FPS, SCARED);
    if (f >= 52) { pose.lean = -6; pose.breathe = Math.sin(f * 0.5); }
    placeHim(w, w.hero, pose, NEON, P3_BODY, me, cam);
    w.aimCams(me.clone().add(V([0, 1.6, 0])), 1);
    if (f >= 44) {
      const cpose = stand(World.psi(COPY_NEAR, V([0, 0, -1]), cam), 0, {}); cpose.breathe = 0; cpose.headTilt = -10;
      placeCopy(w, cpose, NEON, P3_BODY, COPY_NEAR, cam);
    }
  },
};
/** 0:36 the feed from the camera over the sidewalk: you run through; behind you it glitches into the picture */
const T08: Shot = {
  id: "T08", a: 0, b: 180, look: "night", grade: "cctv",
  cam: () => ({ pos: [12.55, 5.55, -10.0], look: [10.2, 0.6, -5.0], fov: 52 }),
  dof: () => ({ cInf: 0 }),
  post: (f) => ({ glitch: f >= 86 && f < 94 ? 0.9 : 0 }),
  act: (f, w, cam) => {
    p3Street(w); w.aimCams(V([10.4, 1.6, -6]), 1); irLight3(w, cam.position);
    const z = lerp(-14, 2, clamp((f - 10) / 120)), me = V([10.0, 0.15, z]);
    placeHim(w, w.hero, run(World.psi(me, V([0, 0, 1]), cam), z / 2.5, SCARED), NEON, P3_BODY, me, cam);
    if (f >= 90) {
      const cp = V([10.35, 0.15, -6.3]);
      const cpose = stand(World.psi(cp, V([0.2, 0, 1]), cam), 0, {}); cpose.breathe = 0; cpose.headNod = -24; cpose.headTilt = lerp(0, 14, ss((f - 120) / 40));
      placeCopy(w, cpose, NEON, P3_BODY, cp, cam);
    }
  },
};
function irLight3(w: World, at: THREE.Vector3) { w.practical(2, [at.x, at.y, at.z], "#ffffff", 30, 18); }
/** 0:42 the laundry camera's own picture: you, below it, a pipe raised. You swing. It dies. */
const LAUNDRY_LENS = V([12.55, 2.42, -11.35]);
const T09: Shot = {
  id: "T09", a: 0, b: 120, look: "night", grade: "cctv",
  cam: (f) => { const hit = f >= 78 ? Math.sin((f - 78) * 2.2) * Math.exp(-(f - 78) / 4) : 0; return { pos: [LAUNDRY_LENS.x, LAUNDRY_LENS.y, LAUNDRY_LENS.z], look: [11.1 + hit * 0.3, 1.0 - hit * 0.5, -10.4], fov: 56, roll: hit * 12 }; },
  dof: () => ({ cInf: 0 }),
  post: (f) => ({ glitch: f >= 76 ? Math.min(1, (f - 76) / 4) : f >= 30 && f < 33 ? 0.3 : 0, noise: f >= 82 ? 1 : f >= 78 ? (f - 78) / 4 : 0 }),
  act: (f, w, cam) => {
    p3Street(w); irLight3(w, cam.position);
    const me = V([11.25, 0.15, -10.55]);
    const raise = ramp(f, 34, 60), swing = ramp(f, 72, 79);
    const pose = stand(World.psi(me, V([0.6, 0, -0.5]), cam), f / FPS, { open: 1.2, pupil: 0.55, brow: -0.4, browIn: -0.6, mouth: "tight", look: [0, 0.6] });
    pose.headNod = -24; pose.headPsi = World.psi(me, V([0.55, 0, -0.6]), cam);
    const up = lerp(lerp(10, 158, raise), 42, swing);
    pose.armL = [up, 14, lerp(20, 40, raise)]; pose.armR = [up + 6, 10, lerp(20, 34, raise)]; pose.handL = "fist"; pose.handR = "fist";
    pose.lean = lerp(2, -8, raise) + 22 * swing;
    placeHim(w, w.hero, pose, NEON, P3_BODY, me, cam, pipeHands);
  },
};
// ---- breaking them
const GRID = [1, 2, 3, 4, 5, 6];   // the 2 x 3 array on the laundry facade, bottom to top
function droop(c: { pan: THREE.Group; tilt: THREE.Group; led: THREE.Mesh }, k: number, wob = 0) { c.tilt.rotation.x += 1.1 * k + wob; c.pan.rotation.y += 0.35 * k; c.led.visible = k < 0.5; }
/** 0:46 across the street: the laundry camera hangs dead, sparking; you rip the cable down the facade and the grid dies, pair by pair */
const T10A: Shot = {
  id: "T10A", a: 0, b: 120, look: "night", grade: "night",
  cam: glide(0, 120, { pos: [7.4, 1.25, -7.9], look: [12.5, 4.6, -11.6], fov: 52 }, { pos: [7.7, 1.3, -8.3], look: [12.5, 5.6, -11.6], fov: 50 }),
  dof: () => ({ cInf: 2, focus: [12.0, 4.0, -11.5] }),
  act: (f, w, cam) => {
    p3Street(w);
    const me = V([11.9, 0.15, -11.0]);
    const yank = ramp(f, 38, 50);
    const pose = stand(World.psi(me, V([1, 0, 0]), cam), f / FPS, { open: 1.2, brow: -0.4, browIn: -0.6, mouth: "tight" });
    pose.armL = [lerp(150, 100, yank), 20, 30]; pose.armR = [lerp(140, 95, yank), 14, 26]; pose.lean = lerp(-4, 14, yank); pose.handL = "fist"; pose.handR = "fist"; pose.headNod = -18;
    placeHim(w, w.hero, pose, NEON, P3_BODY, me, cam, pipeHands);
    w.aimCams(me.clone().add(V([0, 1.6, 0])), 1);
    const cams = w.city.cams;
    droop(cams[0], 1, 0.08 * Math.sin(f * 0.4));
    w.sparks[0].burst(LAUNDRY_LENS, f / FPS);
    GRID.forEach((ci, i) => {
      const t0 = 52 + i * 8, k = f >= t0 ? 1 : 0;
      droop(cams[ci], ss((f - t0) / 4) * k);
      if (i < 7) w.sparks[1 + (i % 7)].burst(cams[ci].group.position.clone().add(V([-0.3, 0, 0])), (f - t0) / FPS);
    });
  },
};
/** 0:50 you run north; at the crossing the cameras still alive swing to you, and under them it is already standing */
const COPY_CROSS = V([-1.2, 0.15, -29.4]);
const T10B: Shot = {
  id: "T10B", a: 0, b: 120, look: "night", grade: "night",
  cam: (f) => { const z = lerp(-12, -18.5, clamp(f / 64)); return { pos: [6.2, 2.15, z + 3.6], look: [0.6, 1.5, -29], fov: 40 }; },
  dof: () => ({ cInf: 2, focus: [-4.5, 2, -29] }),
  act: (f, w, cam) => {
    p3Street(w);
    const z = lerp(-12, -18.5, clamp(f / 64)), me = V([4.2, 0.15, z]);
    const pose = f < 64 ? run(World.psi(me, V([-0.25, 0, -1]), cam), -z / 2.5, SCARED) : stand(World.psi(me, V([-0.6, 0, -1]), cam), f / FPS, SCARED);
    if (f >= 64) { pose.lean = -8; pose.breathe = Math.sin(f * 0.5); }
    placeHim(w, w.hero, pose, NEON, P3_BODY, me, cam);
    const head = me.clone().add(V([0, 1.6, 0]));
    w.aimCams(head, 0, [18, 19, 20, 21, 12, 13, 14, 15, 16, 17, 7, 8, 9, 10, 11]);
    w.aimCams(head, ramp(f, 40, 46), [18, 19, 20, 21, 12, 13, 14, 15, 16, 17, 7, 8, 9, 10, 11]);
    w.aimCams(head, 0, [0, 1, 2, 3, 4, 5, 6]);
    for (const ci of [0, ...GRID]) droop(w.city.cams[ci], 1);
    if (f >= 54) {
      const cpose = stand(World.psi(COPY_CROSS, V([1, 0, 0.6]), cam), 0, {}); cpose.breathe = 0; cpose.headTilt = 9;
      placeCopy(w, cpose, NEON, P3_BODY, COPY_CROSS, cam);
    }
  },
};
/** 0:54 the subway entrance across the road: you run for it and down into the dark */
const SUB_ENTRY = V([-9.6, 0.15, -14.0]);
const T10C: Shot = {
  id: "T10C", a: 0, b: 120, look: "night", grade: "night",
  cam: (f) => ({ pos: [-4.0, 1.4, -6.5], look: lerp3([-7.5, 1.3, -14], [-9.6, 0.4, -14.5], ss((f - 50) / 60)), fov: 44 }),
  dof: () => ({ cInf: 2, focus: [-9.5, 0.8, -14] }),
  act: (f, w, cam) => {
    p3Street(w); w.subEntrance.visible = true;
    const k = clamp(f / 70), p = V([lerp(2.0, -9.4, k), 0.15 - Math.max(0, f - 70) * 0.04, lerp(-18.5, -14.3, k)]);
    const pose = run(World.psi(p, V([-1, 0, 0.35]), cam), k * 4.5, SCARED);
    if (f < 110) placeHim(w, w.hero, pose, NEON, P3_BODY, p, cam);
    for (const ci of [0, ...GRID]) droop(w.city.cams[ci], 1);
    w.aimCams(p.clone().add(V([0, 1.6, 0])), 1, [7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  },
};

// ---- the subway
const subTorch = (w: World, from: THREE.Vector3, to: THREE.Vector3, k = 1) => w.sub.aimTorch(from, to, k);
/** the crowd lit only where the torch points (and a little from its spill) */
function crowdLight(w: World, from: THREE.Vector3, to: THREE.Vector3) {
  const dir = to.clone().sub(from).normalize();
  return (p: THREE.Vector3) => {
    const q = p.clone().add(V([0, 1.5, 0])).sub(from); const d = q.length(); q.normalize();
    const cosA = q.dot(dir), cone = ss((cosA - Math.cos(0.42)) / (Math.cos(0.18) - Math.cos(0.42)));
    return cone * Math.min(1, 14 / (d + 2)) * 1.1;
  };
}
/** 0:58 down the stairs into the dark, toward us; the green EXIT sign the only light */
const T11: Shot = {
  id: "T11", a: 0, b: 210, look: "subway", grade: "night",
  cam: (f) => ({ pos: [3.3, 1.25, 16.4], look: lerp3([3.4, 4.6, 27], [3.4, 1.6, 22], ss((f - 90) / 80)), fov: 44 }),
  dof: () => ({ cInf: 3, focus: [3.4, 2.5, 22] }),
  act: (f, w, cam) => {
    const k = clamp(f / 150), z = lerp(29.5, 17.4, k), y = Math.max(0, (z - 18.3) / 0.55 * 0.25 + 0.25);
    const p = V([3.4, z > 18.3 ? y : 0, z]);
    const pose = run(World.psi(p, V([0, -0.4, -1]).normalize(), cam), (29.5 - z) / 2.0, SCARED);
    pose.lean = 10;
    const EXIT_L: Light = { key: "#7affb0", keyK: 0.62, amb: "#141c2a", ambK: 0.42, dir: 80, rim: { color: "#8a96ff", k: 0.7, dir: 100, w: 1.1 } };
    placeHim(w, w.hero, pose, EXIT_L, P3_BODY, p, cam, undefined, { blob: false });
    w.sub.exitLight.intensity = 3.2; w.sub.topGlow.intensity = 7;
    w.sub.lamp.color.set("#7a86d8"); w.sub.lamp.position.set(3.4, 3.4, 23); w.sub.lamp.intensity = 3.5; w.sub.lamp.distance = 9;
  },
};
const ME_PLAT = V([1.3, 0, 7.5]);   // near the platform edge, clear of the pillars, the train beside him
/** 1:05 the platform, pitch black: his torch sweeps tiles, pillars, the edge */
const T12: Shot = {
  id: "T12", a: 0, b: 210, look: "subway", grade: "night",
  cam: (f) => ({ pos: lerp3([1.75, 1.78, 10.4], [1.7, 1.75, 9.9], ss(f / 210)), look: [1.3, 1.25, -2], fov: 46 }),
  dof: () => ({ cInf: 2, focus: [1.3, 1.4, 6] }),
  act: (f, w, cam) => {
    w.sub.exitLight.intensity = 1.2;
    const sweep = Math.sin(f * 0.022) * 0.9;
    const to = V([1.4 + sweep * 2.8, 1.0 + 0.3 * Math.sin(f * 0.05), -4]);
    const hand = ME_PLAT.clone().add(V([0.05, 1.35, -0.35]));
    subTorch(w, hand, to, ramp(f, 4, 10));
    const pose = stand(World.psi(ME_PLAT, to.clone().sub(ME_PLAT).setY(0).normalize(), cam), f / FPS, SCARED);
    pose.armR = [86, 8, 18]; pose.handR = "fist"; pose.breathe = Math.sin(f * 0.3);
    placeHim(w, w.hero, pose, BACKLIT_TORCH, P3_BODY, ME_PLAT, cam, torchHand, { blob: false });
  },
};
/** 1:12 the phone buzzes in his hand: a live night-vision feed of him, from behind, on this platform */
const T13: Shot = {
  id: "T13", a: 0, b: 180, look: "subway", grade: "night",
  // from in front of him: the phone between us, its screen to us, his face above it lit by it
  cam: (f) => keys([{ f: 0, pos: [1.06, 1.58, 6.25], look: [1.28, 1.42, 7.4], fov: 42 }, { f: 40, pos: [1.07, 1.56, 6.3], look: [1.28, 1.4, 7.4], fov: 41 }, { f: 120, pos: [1.2, 1.36, 6.9], look: [1.28, 1.26, 7.32], fov: 32 }, { f: 180, pos: [1.22, 1.33, 6.97], look: [1.28, 1.25, 7.31], fov: 29 }], f),
  dof: () => ({ cInf: 5, focus: [1.28, 1.26, 7.32] }),
  act: (f, w, cam) => {
    const buzz = (f >= 2 && f < 9) || (f >= 14 && f < 21) ? 0.0018 * Math.sin(f * 2.9) : 0;
    w.phone.visible = true; w.phone.position.set(1.28 + buzz, 1.24, 7.3); w.phone.lookAt(cam.position); w.phone.rotateZ(-0.04);
    w.feedScreen(f % 30 < 15);
    const pose = stand(World.psi(ME_PLAT, V([0, 0, -1]), cam), f / FPS, { ...SCARED, look: [0, -0.75] });
    pose.armR = [52, 10, 80]; pose.armL = [48, 12, 80]; pose.handL = "fist"; pose.handR = "fist"; pose.headNod = 20;
    placeHim(w, w.hero, pose, { ...TORCH_L, key: "#cfe6ff", keyK: 0.85, dir: -70 }, P3_BODY, ME_PLAT, cam, undefined, { blob: false });
    w.sub.exitLight.intensity = 1.2;
    w.sub.lamp.color.set("#cfe8ff"); w.sub.lamp.position.set(1.28, 1.3, 7.2); w.sub.lamp.intensity = 1.6; w.sub.lamp.distance = 2.2;
  },
};
/** 1:18 he spins round with the light: nothing behind him. Then, slowly, he turns it on the tunnel. */
const T14: Shot = {
  id: "T14", a: 0, b: 150, look: "subway", grade: "night",
  // from in front of him: he spins to look behind (his back to us, the light sweeping the empty platform), then turns back
  // to us, the light coming up the platform toward the lens
  cam: (f) => ({ pos: [0.95, 1.4, 4.6], look: [1.3, 1.3, 7.5], fov: 44 }),
  dof: () => ({ cInf: 2, focus: [1.3, 1.4, 7.5] }),
  act: (f, w, cam) => {
    w.sub.exitLight.intensity = 1.2;
    const spin = ss(f / 10), back = ss((f - 62) / 30);
    const yaw = lerp(lerp(Math.PI, 0, spin), Math.PI - 0.05, back);
    const dir = V([Math.sin(yaw), 0, Math.cos(yaw)]);
    const hand = ME_PLAT.clone().add(dir.clone().multiplyScalar(0.35)).add(V([0, 1.35, 0]));
    const raise = ramp(f, 100, 140);
    const to = hand.clone().add(dir.clone().multiplyScalar(10)).add(V([0, lerp(-1.6, -0.25, raise), 0]));
    subTorch(w, hand, to, 1);
    const pose = stand(World.psi(ME_PLAT, dir, cam), f / FPS, SCARED);
    pose.armR = [lerp(60, 86, raise), 8, 18]; pose.handR = "fist"; pose.breathe = Math.sin(f * 0.35);
    placeHim(w, w.hero, pose, TORCH_L, P3_BODY, ME_PLAT, cam, torchHand, { blob: false });
  },
};
/** 1:23 the tunnel is full of them. Hundreds. All facing him. Their eyes open. They lean, all together. */
const T15: Shot = {
  id: "T15", a: 0, b: 150, look: "subway", grade: "night",
  // over his shoulder down the platform: the light finds them. The far end of the platform, the tracks, the tunnel.
  cam: (f) => ({ pos: lerp3([0.95, 1.7, 9.8], [1.0, 1.66, 9.1], ss(f / 150)), look: [1.4, 1.35, -12], fov: lerp(32, 25, ss(f / 150)) }),
  dof: () => ({ cInf: 2, focus: [1.4, 1.3, -12] }),
  act: (f, w, cam) => {
    w.sub.exitLight.intensity = 1.0;
    const shake = 0.05 * Math.sin(f * 1.7) + 0.035 * Math.sin(f * 2.9);
    const hand = ME_PLAT.clone().add(V([0.1, 1.38, -0.3]));
    const to = V([1.4 + shake * 3, 1.0 + shake * 2, -13]);
    subTorch(w, hand, to, 1);
    w.sub.poseCrowd(ME_PLAT.clone(), crowdLight(w, hand, to), f >= 12 ? 1 : 0, 0, "ABC");
    const lean = ss((f - 96) / 12) * 0.14;
    for (const fg of w.sub.figures) if (fg.body.visible) { fg.body.rotateZ(lean); fg.eyes.rotateZ(lean); }
    const pose = stand(World.psi(ME_PLAT, V([0, 0, -1]), cam), f / FPS, SCARED);
    pose.armR = [86, 8, 18]; pose.handR = "fist";
    placeHim(w, w.hero, pose, BACKLIT_TORCH, P3_BODY, ME_PLAT, cam, torchHand, { blob: false });
  },
};
/** 1:28 RUN: along the platform to the train standing in the dark, doors open; he dives in */
const T16A_FLASH = [62, 63, 74, 86, 87, 96, 104, 105, 112, 116, 117];
const T16A: Shot = {
  id: "T16A", a: 0, b: 120, look: "subway", grade: "night",
  cam: (f) => ({ pos: [2.1, 1.7, lerp(11.2, 9.6, ss(f / 120))], look: [0.6, 1.3, lerp(-4, -10, ss(f / 120))], fov: 46 }),
  dof: () => ({ cInf: 2, focus: [0.4, 1.2, 4] }),
  act: (f, w, cam) => {
    w.sub.trainLight.intensity = 3.2; w.sub.exitLight.intensity = 1.0;
    const k = clamp(f / 50), p = V([lerp(1.3, 0.15, ss(k)), 0, lerp(7.5, 4.5, k)]);
    const dive = f >= 50 ? ss((f - 50) / 10) : 0;
    const pose = run(World.psi(p, V([-0.4, 0, -1]), cam), k * 2.0, SCARED);
    pose.lean = 15 + 50 * dive;
    if (f < 64) placeHim(w, w.hero, pose, TRAIN_L, P3_BODY, p.clone().add(V([-0.9 * dive, -0.2 * dive, 0])), cam, undefined, { blob: false });
    subTorch(w, p.clone().add(V([0, 1.3, -0.2])), V([1.6, 1.0, -12]), f < 50 ? 0.7 : 0);
    // the far end of the platform: their eyes in the dark. Once he is in, the dead ceiling lights stutter on: in every
    // flash they are closer, surging down the platform toward the train
    const flash = T16A_FLASH.includes(f);
    if (flash) { w.sub.fill.intensity = 1.6; w.sub.lamp.color.set("#dfe6ff"); w.sub.lamp.position.set(2.9, 3.4, -6); w.sub.lamp.intensity = 40; w.sub.lamp.distance = 34; }
    w.sub.poseCrowd(p, () => (flash ? 0.85 : 0.05), 1, 0, "AB");
    const adv = f < 50 ? Math.floor(f / 18) * 0.5 : 1.0 + Math.floor((f - 50) / 11) * 1.5;
    for (const fg of w.sub.figures) { fg.body.position.z = fg.base.z + adv; fg.eyes.position.z = fg.base.z + adv + 0.001; }
  },
};
/** 1:32 inside the car: the doors slam shut by themselves; one of them presses its face to the door window */
const T16B: Shot = {
  id: "T16B", a: 0, b: 120, look: "subway", grade: "night",
  cam: (f) => ({ pos: [-2.35, 1.18, 5.55], look: [-0.2, 1.48, 4.5], fov: 36 }),
  dof: () => ({ cInf: 3, focus: [0.0, 1.5, 4.2] }),
  act: (f, w, cam) => {
    w.sub.trainLight.intensity = 3.2;
    w.sub.setDoors(ss((f - 8) / 4));
    const me = V([-1.85, 0.05, 5.15]);
    const pose = floorSit(f / FPS, { ...SCARED, look: [0.6, 0.2] }, { psi: World.psi(me, V([1, 0, -0.3]), cam), hands: "fist" });
    pose.breathe = Math.sin(f * 0.6); pose.lean = -6;
    placeHim(w, w.hero, pose, TRAIN_L, P3_BODY, me, cam, undefined, { blob: false });
    // outside the door glass, out of the dark: your face, grinning, pressed to the window
    if (f >= 50) {
      const k = ss((f - 50) / 10);
      const cp = V([0.18 - 0.1 * k, 0.0, 4.45]);   // its face lines up with the right-hand door window from where we sit
      const cpose = stand(World.psi(cp, V([-1, 0, 0]), cam), 0, {}); cpose.breathe = 0; cpose.headTilt = 6; cpose.lean = 8; cpose.headNod = 4;
      placeCopy(w, cpose, { ...TRAIN_L, keyK: 0.4 + 0.4 * k }, P3_BODY, cp, cam, { blob: false, smile: ramp(f, 58, 90) });
      w.refl.mat.opacity = k;
    }
  },
};
/** 1:36 the train lurches and moves: the first thing that has moved on its own since 06:12. The clock flips to 06:13. */
const trainZ = (f: number) => { const t = Math.max(0, (f - 50) / FPS); return -(0.5 * 2.4 * t * t); };
const CLOCK_AT = V([2.9, 3.05, 4]);
const T17: Shot = {
  id: "T17", a: 0, b: 360, look: "subway", grade: "night",
  // inside the car, looking out of the platform-side windows: first the station clock (it flips to 06:13), then the
  // platform edge sliding past, lined with them, then the tunnel walls lined with them, all turning their heads to follow
  cam: (f) => {
    const z = trainZ(f), jolt = f >= 50 && f < 60 ? Math.sin((f - 50) * 1.4) * 0.03 * (1 - (f - 50) / 10) : 0;
    const pos: V3 = [-3.25, 1.28 + jolt, -0.6 + z];
    const look = lerp3([CLOCK_AT.x, CLOCK_AT.y, CLOCK_AT.z], [2.0, 1.3, -4.0 + z], ss((f - 108) / 50));
    return { pos, look, fov: lerp(36, 52, ss((f - 108) / 50)) };
  },
  dof: () => ({ cInf: 2, focus: [1.0, 1.6, 0] }),
  act: (f, w, cam) => {
    w.sub.trainLight.intensity = 3.0 * (f % 47 === 0 ? 0.4 : 1); w.sub.setDoors(1);
    const z = trainZ(f); w.sub.train.position.z = z;
    w.sub.setClock(f >= 82 ? "06:13" : "06:12");
    w.sub.lamp.color.set("#9fb4ff"); w.sub.lamp.position.set(0.2, 1.6, -2 + z); w.sub.lamp.intensity = 4; w.sub.lamp.distance = 6;
    w.sub.poseCrowd(cam.position, (p) => Math.max(0, 0.9 - Math.abs(p.z - cam.position.z) * 0.06), 1, 0, "DE");
  },
};
/** 1:48 he collapses onto a seat. In the dark window opposite: his reflection, and another one sitting right next to it, grinning */
const SEAT_ME = V([-3.35, 0.05, 1.2]);
const REFL_X = -0.69;   // just outside the glass on the far side: the shell hides anything below or above the windows
function reflect(cam: THREE.PerspectiveCamera, q: THREE.Vector3) {
  // the mirror image of q in the glass plane x = -0.75, slid along the camera ray onto x = REFL_X (same size on screen)
  const m = V([-0.75 - (q.x + 0.75), q.y, q.z]);
  const t = (REFL_X - cam.position.x) / (m.x - cam.position.x);
  return { pos: cam.position.clone().lerp(m, t), scale: t };
}
const T19: Shot = {
  id: "T19", a: 0, b: 180, look: "subway", grade: "night",
  // over his shoulder at the dark window opposite: his reflection, and the other one beside it
  cam: (f) => ({ pos: [-3.02, 1.42, 1.62], look: [1.85, 1.28, 0.95], fov: lerp(30, 25, ss(f / 180)) }),
  dof: () => ({ cInf: 3, focus: [-0.75, 1.4, 1.0] }),
  act: (f, w, cam) => {
    w.sub.trainLight.intensity = 3.0; w.sub.setDoors(1);
    w.sub.train.position.z = 0;
    const face: Partial<Face> = { ...SCARED, mouth: "part", mouthOpen: 0.3, look: [0, 0] };
    // his real self in the near foreground, out of focus: the back of his head and shoulder
    const real = seated(World.psi(SEAT_ME, V([1, 0, 0]), cam), f / FPS, face); real.breathe = Math.sin(f * 0.25); real.lean = 14;
    w.cu.setFrame({ x0: -48, y0: 30, w: 96, h: 110 });
    w.cu.draw((ctx, F) => drawCharacter(ctx, real, TRAIN_L, F, { lineK: 0.8 }));
    w.cu.stand(SEAT_ME, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
    // his reflection, facing us out of the glass
    const r = reflect(cam, SEAT_ME);
    const refl = seated(-12, f / FPS, face); refl.breathe = Math.sin(f * 0.25); refl.lean = 14;
    const c = w.hero; c.setFrame(P3_BODY); c.draw((ctx, F) => drawCharacter(ctx, refl, TRAIN_L, F));
    c.pivot.position.copy(r.pos); c.pivot.scale.setScalar(r.scale); c.pivot.rotation.set(0, Math.atan2(cam.position.x - r.pos.x, cam.position.z - r.pos.z), 0);
    c.mat.opacity = 0.62; c.visible = true; c.blob.visible = false;
    // and the other one, sitting right next to him, only in the glass
    if (f >= 40) {
      const rc = reflect(cam, SEAT_ME.clone().add(V([0, 0, -0.6])));
      const cpose = seated(14, 0, {}); cpose.breathe = 0; cpose.headTilt = 8; cpose.lean = 10;
      const sm = ramp(f, 60, 110);
      cpose.face = { ...FACE0, ...TIRED, ...COPY_FACE, possessed: { eyes: 1, smile: sm }, shine: false };
      const cc = w.refl; let head: DOMMatrix | null = null;
      cc.setFrame(P3_BODY); cc.draw((ctx, F) => drawCharacter(ctx, cpose, TRAIN_L, F, { onHead: (m) => { head = m; } }));
      cc.pivot.position.copy(rc.pos); cc.pivot.scale.setScalar(rc.scale); cc.pivot.rotation.set(0, Math.atan2(cam.position.x - rc.pos.x, cam.position.z - rc.pos.z), 0);
      cc.mat.opacity = lerp(0, 0.66, ss((f - 40) / 20)); cc.visible = true; cc.blob.visible = false;
      if (head) { const hm = head as DOMMatrix; w.glowOver(cc, (ctx) => { ctx.save(); ctx.setTransform(hm); possessedGlowHead(ctx, 1, sm); ctx.restore(); }); w.glow.pivot.scale.setScalar(rc.scale); }
    }
  },
};
/** 1:54 he looks beside him: the seat is empty */
const T20A: Shot = {
  id: "T20A", a: 0, b: 45, look: "subway", grade: "night",
  cam: () => ({ pos: [-2.45, 1.2, 1.15], look: [-3.35, 0.62, 0.45], fov: 46 }),
  dof: () => ({ cInf: 3, focus: [-3.3, 0.6, 0.5] }),
  act: (f, w, cam) => {
    w.sub.trainLight.intensity = 3.0; w.sub.setDoors(1);
    // his knee and hand at the edge of frame; the seat beside him: empty
    const real = seated(World.psi(SEAT_ME, V([1, 0, 0]), cam), f / FPS, { ...SCARED });
    placeHim(w, w.hero, real, TRAIN_L, P3_BODY, SEAT_ME, cam, undefined, { blob: false });
  },
};
/** 1:55 back to the glass: it is leaning closer to his ear. Grinning wider. Hard cut. */
const T20B: Shot = {
  ...T19, id: "T20B", a: 0, b: 105,
  cam: (f) => ({ pos: [-3.02, 1.42, 1.62], look: [1.85, 1.3, 0.95], fov: lerp(25, 18, ss(f / 105)) }),
  act: (f, w, cam) => {
    T19.act(179, w, cam);
    const lean = ss(f / 70);
    const rc = reflect(cam, SEAT_ME.clone().add(V([0, 0, lerp(-0.6, -0.32, lean)])));
    w.refl.pivot.position.copy(rc.pos); w.refl.mat.opacity = 0.7;
    w.glow.pivot.position.copy(rc.pos).add(V([0.001, 0, 0]));
  },
};

export const P3: FinalShot[] = edit([
  ["T01", 90, { src: T01, from: 0 }],
  ["T02", 180, { src: T02, from: 0 }],
  ["T03", 120, { src: T03, from: 0 }],
  ["T04", 210, { src: T04, from: 0 }],
  ["T05", 210, { src: T05, from: 0 }],
  ["T06", 120, { src: T06, from: 0 }],
  ["T07", 150, { src: T07, from: 0 }],
  ["T08", 180, { src: T08, from: 0 }],
  ["T09", 120, { src: T09, from: 0 }],
  ["T10A", 120, { src: T10A, from: 0 }],
  ["T10B", 120, { src: T10B, from: 0 }],
  ["T10C", 120, { src: T10C, from: 0 }],
  ["T11", 210, { src: T11, from: 0 }],
  ["T12", 210, { src: T12, from: 0 }],
  ["T13", 180, { src: T13, from: 0 }],
  ["T14", 150, { src: T14, from: 0 }],
  ["T15", 150, { src: T15, from: 0 }],
  ["T16A", 120, { src: T16A, from: 0 }],
  ["T16B", 120, { src: T16B, from: 0 }],
  ["T17", 360, { src: T17, from: 0 }],
  ["T19", 180, { src: T19, from: 0 }],
  ["T20A", 45, { src: T20A, from: 0 }],
  ["T20B", 105, { src: T20B, from: 0 }],
  ["END3", 90, { black: true }],
]);
export const P3_TOTAL = P3[P3.length - 1].b;
export const p3At = (F: number) => P3.find((s) => F >= s.a && F < s.b) ?? P3[P3.length - 1];

/** the picture on his phone in T13: him on the platform from behind and above, through a camera that should not exist */
export const P3_FEED_SHOT: Shot = {
  id: "P3FEED", a: 0, b: 1, look: "subway", grade: "cctv",
  cam: () => ({ pos: [2.1, 3.25, 11.4], look: [1.3, 0.95, 7.2], fov: 50 }),
  dof: () => ({ cInf: 0 }),
  act: (f, w, cam) => {
    w.sub.exitLight.intensity = 2.0; w.sub.lamp.color.set("#ffffff"); w.sub.lamp.position.set(2.1, 3.1, 11.2); w.sub.lamp.intensity = 26; w.sub.lamp.distance = 16;
    const pose = stand(World.psi(ME_PLAT, V([0, 0, -1]), cam), 1.3, SCARED);
    pose.armR = [52, 10, 80]; pose.armL = [48, 12, 80]; pose.handL = "fist"; pose.handR = "fist"; pose.headNod = 20;
    placeHim(w, w.hero, pose, { ...TORCH_L, keyK: 0.9 }, P3_BODY, ME_PLAT, cam, undefined, { blob: false });
  },
};
