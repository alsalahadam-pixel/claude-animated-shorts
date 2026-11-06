// THE LAST HUMAN ALIVE (v2) — the shot timeline, 30 fps. 60.0 s film, then black and silence, then a quiet PART 2?
// Every shot: frame range, look, camera (locked unless the plan says otherwise), depth of field, and what the actors
// do. Voice lines land on these shots (voice/build_voice_v2.py SLOTS); reactions land 0-3 frames before their word.
// Story rules (SCRIPT_v2.md §1): the world froze at 06:12 on Day 1; only the sky, he, and "them" move.
import * as THREE from "three";
import { World, Look } from "./world/World";
import { drawCharacter, drawHand, drawHeadOnly, drawPigeon, drawWatcher, Face, FACE0, haloBehind, inkOver, Light, Pose, stand, walk, watcherBody } from "./char/draw";
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
  id: string; a: number; b: number; look: Look; grade: "warm" | "cool" | "night" | "dusk";
  cam: (f: number) => Cam; dof: (f: number) => Dof;
  act: (f: number, w: World, cam: THREE.PerspectiveCamera) => void;
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
