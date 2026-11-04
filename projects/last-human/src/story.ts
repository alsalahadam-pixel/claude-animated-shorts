// THE LAST HUMAN ALIVE (v2) — the shot timeline, 30 fps. 60.0 s film, then black and silence, then a quiet PART 2?
// Every shot: frame range, look, camera (locked unless the plan says otherwise), depth of field, and what the actors
// do. Voice lines land on these shots (voice/build_voice_v2.py SLOTS); reactions land 0-3 frames before their word.
// Story rules (SCRIPT_v2.md §1): the world froze at 06:12 on Day 1; only the sky, he, and "them" move.
import * as THREE from "three";
import { World, Look } from "./world/World";
import { drawCharacter, drawHand, drawHeadOnly, drawPigeon, Face, FACE0, Light, Pose, stand, walk } from "./char/draw";
import { CITY } from "./world/city";

export const FPS = 30;
export const FILM_END = 1800;          // 60.0 s: hard cut to black
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
const SUN_FRONT: Light = { key: "#ffc596", keyK: 0.95, amb: "#5c58a0", ambK: 0.55, dir: 70, rim: { color: "#8a7aff", k: 0.35, dir: 160, w: 0.9 } };
const OVERCAST: Light = { key: "#d6dcea", keyK: 0.62, amb: "#7680a6", ambK: 0.72, dir: 100, rim: { color: "#b8c8e8", k: 0.18, dir: 30, w: 0.6 } };
const DUSK: Light = { key: "#ffb080", keyK: 0.4, amb: "#6a5a9a", ambK: 0.58, dir: 80, rim: { color: "#ff8a4a", k: 0.95, dir: 70, w: 1.3 } };
const NEON: Light = { key: "#c9a6ff", keyK: 0.75, amb: "#3c4280", ambK: 0.5, dir: 160, rim: { color: "#3ff0e0", k: 0.85, dir: 15, w: 1.2 } };
const NEON_L: Light = { key: "#d0b0ff", keyK: 0.8, amb: "#3c4280", ambK: 0.48, dir: 150, rim: { color: "#ff6ab8", k: 0.7, dir: 20, w: 1.1 } };
const GLASS: Light = { key: "#b8a8ff", keyK: 0.62, amb: "#34407a", ambK: 0.46, dir: 30, rim: { color: "#5fd8ff", k: 0.45, dir: 160, w: 0.9 } };
const DARK: Light = { key: "#8a7ad8", keyK: 0.35, amb: "#2c3266", ambK: 0.45, dir: 30, rim: { color: "#6a5cff", k: 0.75, dir: 25, w: 1.1 } };
const NIGHT_ROOM: Light = { key: "#9a8ae8", keyK: 0.5, amb: "#2e3470", ambK: 0.5, dir: 20, rim: { color: "#4fd8d0", k: 0.6, dir: 15, w: 1.0 } };
const PHONE: Light = { key: "#bfe0ff", keyK: 0.78, amb: "#262c5c", ambK: 0.42, dir: -80, rim: { color: "#7a5cff", k: 0.6, dir: 20, w: 1.0 } };

const BODY = { x0: -62, y0: -8, w: 124, h: 198 };
const HEAD_CU = { x0: -34, y0: 118, w: 68, h: 72 };

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
    legL: [130, 12, 110], legR: [126, 16, 106], armL: [52, -18, 70], armR: [52, -18, 70],
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
const GLASS_X = CITY.shopGlassX;            // the shop window (x = -12.9)
const Z5 = -78.2;                           // where he stops at the glass
const HERO_X5 = -11.75;
const mirrorX = (x: number) => 2 * GLASS_X - x;
const DOOR_SIT = V([-2.05, 0, 2.6]);        // on the floor, back against the door
const BED_HIP = V([1.55, 0.58, -1.62]);

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
    cam: locked(0, 144, S01_POS, S01_LOOK, 46, 0.03),
    dof: () => ({ cInf: 3, focus: [11.3, 2.2, -11.5] }),
    act: (f, w, cam) => {
      spotLights(w);
      // the camera turns 70° onto empty pavement (0.4-1.5 s), tilts down, blinks once
      w.aimCams(SPOT_HEAD, ramp(f, 12, 45), [0], () => ({ yaw: -2.79, pitch: -0.05 }));
      w.aimCams(SPOT_HEAD, 0);
      w.city.heroCam.led.visible = !(f >= 50 && f < 54);
      // he steps in from the left edge (f86) and stops exactly where it is looking (f107), then looks up at it
      const tStop = 107, speed = 1.15;
      const dist = f < tStop - 8 ? (speed * (tStop - 4 - f)) / FPS : 0.11 * (1 - ramp(f, tStop - 8, tStop));
      const p = SPOT.clone().add(V([-dist, 0, 0]));
      const moving = f < tStop;
      const face: Partial<Face> = { ...TIRED, browIn: 0.8, look: f > 113 ? [0.2, 0.7] : [0.3, 0] };
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
    cam: locked(267, 342, [1.8, 1.86, 0.78], [40, -6, 2.0], 40, 0.0008, -0.6),
    dof: () => ({ cInf: 5, focus: [60, -18, -1.5] }),
    act: (f, w, cam) => {
      const p = V([3.12, 0, 0.62]);
      const pose = stand(World.psi(p, V([1, 0, -0.05]), cam), f / FPS, {});
      const reach = ramp(f, 268, 280);
      pose.armR = [lerp(4, 62, reach), lerp(6, 38, reach), lerp(8, 36, reach)];
      const shout = ramp(f, 279, 284) * (1 - 0.5 * ramp(f, 296, 310));
      pose.lean = 3 + 9 * shout; pose.headNod = -6 * shout - 2;
      w.place(w.hero, pose, SUN_BACK, BODY, p, cam);
    },
  },
  // S05 — his face at the glass: hope draining away. "I haven't slept since."
  {
    id: "S05", a: 342, b: 402, look: "sunrise", grade: "warm",
    cam: locked(342, 402, [3.98, 1.63, 0.42], [3.12, 1.6, 0.62], 30, 0.05),
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
    cam: locked(402, 450, [1.1, 5.6, 12.6], [-0.5, 0.8, -30], 38, 0.01),
    dof: () => ({ cInf: 0 }),
    act: (f, w, cam) => {
      const d = 3.0 + ((f - 402) / FPS) * 1.25;
      const p = V([-0.6, 0, -1 - d]);
      w.place(w.hero, walk(World.psi(p, V([0.02, 0, -1]), cam), d / 1.5, { ...TIRED }), OVERCAST, BODY, p, cam, { lineK: 1.4 });
      const b = w.pigeon; b.setFrame({ x0: -34, y0: -14, w: 64, h: 52 });
      b.draw((ctx, F) => drawPigeon(ctx, OVERCAST, F));
      b.stand(V([0.25, 5.05, 6.4]), cam.position); b.visible = true; b.blob.visible = false;
    },
  },
  // S07 — the café: steam hangs over the cup like glass; his fingers pass through it and nothing moves
  {
    id: "S07", a: 450, b: 546, look: "overcast", grade: "cool",
    cam: locked(450, 546, [-9.6, 1.2, -0.6], [-10.22, 1.03, -1.28], 34, 0.06),
    dof: () => ({ cInf: 10, focus: [-10.22, 1.06, -1.28] }),
    act: (f, w, cam) => {
      const steam = w.city.steam.position.clone().add(V([0, 0.1, 0]));
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      const off = lerp(-0.42, -0.07, ramp(f, 465, 486)) + lerp(0, -0.38, ramp(f, 516, 540));
      const h = w.hand; h.setFrame({ x0: -62, y0: -12, w: 80, h: 24 });
      h.draw((ctx, F) => drawHand(ctx, OVERCAST, F, 0.35));
      h.stand(steam.clone().addScaledVector(right, off).add(V([0, -0.035, 0])), cam.position); h.visible = true; h.blob.visible = false;
    },
  },
  // S08 — dusk: the light is red forever; the street clock says 06:12
  {
    id: "S08", a: 546, b: 591, look: "dusk", grade: "dusk",
    cam: locked(546, 591, [-3.6, 1.0, -18.6], [-5.6, 4.7, -30.6], 56, 0.01, 1),
    dof: () => ({ cInf: 0 }),
    act: (f, w, cam) => {
      const d = ((f - 546) / FPS) * 1.1;
      const p = V([-4.4, 0, -20.5 - d]);
      w.place(w.hero, walk(World.psi(p, V([0, 0, -1]), cam), d / 1.5, { ...TIRED }), DUSK, BODY, p, cam);
    },
  },
  // S09 — Day 3: he tests it. Step left: it follows. Step right: it follows.
  {
    id: "S09", a: 591, b: 744, look: "night", grade: "night",
    cam: locked(591, 744, S09_POS, S09_LOOK, 46, 0.02),
    dof: () => ({ cInf: 3, focus: [10.4, 1.6, -11.5] }),
    act: (f, w, cam) => {
      spotLights(w);
      const right = S09_RIGHT;
      const lat = (g: number) => -0.35 * ramp(g, 606, 620) + 0.9 * ramp(g, 681, 697);
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
      w.aimCams(lagged, 1, [0], () => ({ yaw: -2.79, pitch: -0.05 }));
      w.aimCams(lagged, 0);
    },
  },
  // S10 — every camera on the street turns to him at once
  {
    id: "S10", a: 744, b: 813, look: "night", grade: "night",
    cam: locked(744, 813, [9.15, 0.95, -11.55], [12.85, 7.2, -11.1], 50, 0.02, -3),
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
      w.aimCams(head, 1, [0], () => ({ yaw: -2.79, pitch: -0.05 }));
    },
  },
  // S11 — his face, looking up at them
  {
    id: "S11", a: 813, b: 849, look: "night", grade: "night",
    cam: locked(813, 849, [END9.x + 1.15, 1.56, END9.z - 0.35], [END9.x, 1.83, END9.z], 34, 0.04),
    dof: () => ({ cInf: 12, focus: [END9.x, 1.81, END9.z] }),
    act: (f, w, cam) => {
      spotLights(w); w.practical(2, [11.6, 5.0, -11.2], "#b07bff", 40, 10);
      const p = END9.clone();
      const pose = stand(World.psi(p, V([1, 0, 0.05]), cam), f / FPS, { ...TIRED, open: 1.3, pupil: 0.5, brow: 1.1, browIn: 1.3, mouth: "part", mouthOpen: 0.3, look: [0.25, 0.7] });
      pose.headNod = -16; pose.headTilt = 3;
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
      w.place(w.hero, walk(World.psi(p, V([0, 0, -1]), cam), d / 1.5, { ...TIRED, look: [0.2, 0], browIn: 0.8 }), NEON, BODY, p, cam, { floorY: 0.15 });
      w.place(w.refl, walk(World.psi(pr, V([0, 0, -1]), cam), d / 1.5, { ...TIRED, look: [0.2, 0], browIn: 0.8 }), GLASS, BODY, pr, cam, { blob: false });
      w.refl.mat.opacity = 0.7;
    },
  },
  // S13 — the mirror test: in sync, then 4 frames late, then 10, then 14
  {
    id: "S13", a: 918, b: 1062, look: "night", grade: "night",
    cam: locked(918, 1062, [-12.35, 1.5, -71.8], [-12.95, 1.35, -78.2], 42, 0.06),
    dof: () => ({ cInf: 3, focus: [-12.9, 1.45, Z5] }),
    act: (f, w, cam) => act13(f, w, cam),
  },
  // S14 — he steps back; it steps back. He stops. It takes one more step.
  {
    id: "S14", a: 1062, b: 1152, look: "night", grade: "night",
    cam: locked(1062, 1152, [-12.4, 1.32, -70.4], [-12.95, 1.25, -78.2], 46, 0.03),
    dof: () => ({ cInf: 3, focus: [-12.9, 1.4, Z5] }),
    act: (f, w, cam) => act14(f, w, cam),
  },
  // S15 — close on the reflection: his own face, smiling on its own
  {
    id: "S15", a: 1152, b: 1311, look: "night", grade: "night",
    cam: locked(1152, 1311, [-12.72, 1.64, -76.3], [-14.05, 1.63, -78.2], 28, 0.05),
    dof: () => ({ cInf: 9, focus: [-14.05, 1.64, Z5] }),
    act: (f, w, cam) => {
      w.practical(0, [-12.2, 2.6, -77.6], "#b07bff", 14, 5);
      const pr = V([mirrorX(HERO_X5) + 0.0, 0.15, Z5]);
      const pose = stand(World.psi(pr, V([1, 0, 0.05]), cam), 0, SAME(ramp(f, 1164, 1200)));
      pose.breathe = 0; pose.headTilt = -2 * ramp(f, 1164, 1200);
      w.cu.setFrame(HEAD_CU);
      w.cu.draw((ctx, F) => { drawCharacter(ctx, pose, GLASS, F, { lineK: 0.75 }); glassTint(ctx); });
      w.cu.stand(pr, cam.position); w.cu.visible = true; w.cu.blob.visible = false; w.cu.mat.opacity = 0.86;
    },
  },
  // S16 — home: the door slams, the chain goes on, he slides down to the floor
  {
    id: "S16", a: 1311, b: 1377, look: "aptNight", grade: "night",
    cam: locked(1311, 1377, [-0.65, 1.42, 0.6], [-2.1, 1.0, 2.9], 44, 0.03),
    dof: () => ({ cInf: 5, focus: [-2.1, 1.0, 2.6] }),
    act: (f, w, cam) => {
      const p = V([-2.05, 0, 2.55]);
      w.apt.chainLocked.visible = f >= 1338; w.apt.chainLoose.visible = f < 1338;
      const turn = ramp(f, 1344, 1351);
      const face = V([0, 0, 1]).lerp(V([0.4, 0, -1]), turn).normalize();
      if (f < 1350) {
        const pose = stand(World.psi(p, face, cam), f / FPS, { ...TIRED, open: 1.2, browIn: 1.2 });
        const reach = ramp(f, 1326, 1334) * (1 - ramp(f, 1340, 1347));
        pose.armR = [lerp(5, 112, reach), lerp(6, 14, reach), lerp(8, 34, reach)];
        pose.armL = [lerp(5, 60, reach * 0.6), 10, lerp(8, 40, reach)];
        pose.lean = lerp(2, 8, reach);
        w.place(w.hero, pose, NIGHT_ROOM, BODY, p, cam);
      } else {
        const s = ramp(f, 1350, 1373);
        const st = stand(World.psi(p, face, cam), f / FPS, { ...TIRED, open: 1.2, browIn: 1.2 });
        const fl = floorSit(f / FPS, { open: 1.2, browIn: 1.2 }, { psi: st.psi, hands: "fist" });
        const pose: Pose = { ...fl, hip: [0, lerp(93, 18, s), 0], legL: [lerp(0, 130, s), 12, lerp(2, 110, s)], legR: [lerp(0, 126, s), 16, lerp(2, 106, s)], lean: lerp(2, 6, s), legsFront: s > 0.5 };
        w.place(w.hero, pose, NIGHT_ROOM, BODY, V([-2.05, 0, lerp(2.55, 2.6, s)]), cam);
      }
    },
  },
  // S17 — on the floor in the dark; the phone buzzes for the first time in three days
  {
    id: "S17", a: 1377, b: 1437, look: "aptNight", grade: "night",
    cam: locked(1377, 1437, [-1.45, 0.78, 1.25], [-2.05, 0.55, 2.55], 40, 0.03),
    dof: () => ({ cInf: 6, focus: [-2.05, 0.7, 2.6] }),
    act: (f, w, cam) => {
      const lit = f >= 1407;
      const buzz = (f >= 1392 && f < 1397) || (f >= 1404 && f < 1409);
      const flinch = ramp(f, 1392, 1395) * (1 - ramp(f, 1400, 1410));
      const face: Partial<Face> = { open: lit ? 1.15 : blinkAt(f, [1384]) * 0.88, pupil: lit ? 0.7 : 0.9, browIn: 1.1, brow: lit ? 0.5 : 0, look: [0, -0.8], mouth: "tight" };
      const pose = floorSit(f / FPS, face, { phone: lit ? 1 : 0, nod: 14 - 8 * flinch, psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
      if (buzz) pose.hip = [((f % 2) - 0.5) * 0.6, 18, 0];
      w.place(w.hero, pose, lit ? PHONE : DARK, BODY, DOOR_SIT, cam);
      w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = lit ? 0.9 : 0; w.apt.phoneLight.distance = 1.6; w.apt.phoneLight.color.set("#bfe0ff");
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
    cam: locked(1563, 1635, [-1.86, 0.9, 1.95], [-2.05, 0.86, 2.6], 32, 0.04),
    dof: () => ({ cInf: 12, focus: [-2.05, 0.88, 2.6] }),
    act: (f, w, cam) => {
      const lift = ramp(f, 1575, 1584), turn = ramp(f, 1590, 1622);
      const face: Partial<Face> = { open: 1.18, pupil: 0.6, brow: 0.6, browIn: 1.2, mouth: "part", mouthOpen: 0.25, look: [lerp(0, -0.9, turn), lerp(-0.8, -0.1, lift)] };
      const pose = floorSit(f / FPS, face, { phone: 1, nod: lerp(14, 0, lift), headPsi: lerp(0, -38, turn), psi: World.psi(DOOR_SIT, V([0.15, 0, -1]), cam) });
      w.cu.setFrame({ x0: -36, y0: 52, w: 72, h: 76 });
      w.cu.draw((ctx, F) => drawCharacter(ctx, pose, PHONE, F, { lineK: 0.75 }));
      w.cu.stand(DOOR_SIT, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
      w.apt.phoneLight.position.set(-2.0, 0.6, 2.25); w.apt.phoneLight.intensity = 0.8;
    },
  },
  // S20 — his point of view: the duvet breathes. Then it sits up, slowly.
  {
    id: "S20", a: 1635, b: 1749, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1635, pos: [-2.0, 0.86, 2.3], look: [1.55, 0.78, -1.75], fov: 36 }, { f: 1749, pos: [-1.55, 0.87, 1.82], look: [1.55, 0.82, -1.7], fov: 34 }], f),
    dof: () => ({ cInf: 4, focus: [1.55, 0.9, -1.7] }),
    act: (f, w, cam) => {
      const u = ss((f - 1671) / 78);                       // 1.2 s of breathing, then 2.6 s rising
      w.apt.setBody(1 - 0.7 * u, ((f - 1635) / FPS) * Math.PI * 2 * 0.55);
      const c = w.hero; c.setFrame({ x0: -45, y0: -10, w: 90, h: 100 });
      c.draw((ctx, F) => drawCharacter(ctx, doublePose(SAME(0)), { ...NIGHT_ROOM, keyK: 0.62, ambK: 0.58 }, F));
      const yaw = Math.atan2(cam.position.x - BED_HIP.x, cam.position.z - BED_HIP.z);
      c.pivot.position.copy(BED_HIP); c.pivot.rotation.set(0, yaw, 0); c.pivot.rotateX(-(1 - u) * 0.95);
      c.visible = true; c.blob.visible = false;
    },
  },
  // S21 — the double: his face, looking straight at us, smiling. Hard cut to black at 60.0 s.
  {
    id: "S21", a: 1749, b: 1800, look: "aptNight", grade: "night",
    cam: locked(1749, 1800, [0.97, 1.27, -0.95], [1.55, 1.26, -1.62], 30, 0.04),
    dof: () => ({ cInf: 10, focus: [1.55, 1.27, -1.62] }),
    act: (f, w, cam) => {
      w.apt.setBody(0.3, 0);
      const pose = doublePose(SAME(ramp(f, 1761, 1785)), lerp(-25, 0, ramp(f, 1749, 1758)));
      w.cu.setFrame({ x0: -34, y0: 35, w: 68, h: 72 });
      w.cu.draw((ctx, F) => drawCharacter(ctx, pose, NIGHT_ROOM, F, { lineK: 0.75 }));
      w.cu.pivot.position.copy(BED_HIP); w.cu.pivot.rotation.set(0, Math.atan2(cam.position.x - BED_HIP.x, cam.position.z - BED_HIP.z), 0);
      w.cu.visible = true; w.cu.blob.visible = false;
    },
  },
  // END — black and silence (the PART 2? prompt is an overlay from PROMPT_AT)
  {
    id: "END", a: 1800, b: 1875, look: "aptNight", grade: "night",
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
  const p = V([HERO_X5, 0.15, Z5]);
  const hface = V([0, 0, -1]).lerp(V([-1, 0, 0]), turnH).normalize();
  const hero = stand(World.psi(p, hface, cam), f / FPS, { ...TIRED, open: 1.15, browIn: 1.1, look: [0, 0] });
  const r = raise(f, 0);
  hero.armR = [lerp(3, 72, r), lerp(6, 4, r), lerp(8, 34, r)];
  hero.headTilt = tilt(f); hero.lean = 2 + 8 * lean(f);
  w.place(w.hero, hero, NEON, BODY, p, cam, { floorY: 0.15 });
  // reflection: mirror position, mirror arm, same timing at first, then later and later
  const pr = V([mirrorX(HERO_X5) - 0.25 * lean(f - 14), 0.15, Z5]);
  const rface = V([0, 0, -1]).lerp(V([1, 0, 0]), turnH).normalize();
  const refl = stand(World.psi(pr, rface, cam), f / FPS, SAME(0));
  const rr = raise(f, 10);
  refl.armL = [lerp(3, 72, rr), lerp(6, 4, rr), lerp(8, 34, rr)];
  refl.headTilt = -tilt(f - 4); refl.lean = 2 + 8 * lean(f - 14);
  w.place(w.refl, refl, GLASS, BODY, pr, cam, { blob: false });
  w.refl.mat.opacity = 0.74;
}

/** S14: he steps back; it steps back with him; he stops; it takes one more step toward the glass, then turns to us */
function act14(f: number, w: World, cam: THREE.PerspectiveCamera) {
  w.practical(0, [-11.4, 3.6, -79.4], "#b07bff", 30, 9); w.practical(1, [-10.0, 3.0, -75.5], "#3fd8d0", 16, 10);
  const back = ramp(f, 1074, 1089);
  const xh = HERO_X5 + 0.32 * back;
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
  const refl = rStep ? walk(World.psi(pr, V([1, 0, 0]), cam), f < 1095 ? -back * 0.5 : extra * 0.5, SAME(0), { amp: 0.6 })
    : stand(World.psi(pr, V([1, 0, 0]), cam), 0, SAME(0));
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
    // head on the pillow, turned a little toward the lens; crown toward the headboard
    c.pivot.position.set(1.55, 0.72, -2.38); c.pivot.lookAt(cam.position); c.pivot.rotateX(-0.75);
    c.visible = true; c.blob.visible = false;
    w.apt.phoneLight.position.copy(cam.position); w.apt.phoneLight.intensity = 16; w.apt.phoneLight.distance = 10; w.apt.phoneLight.color.set("#e6eeff");
  },
};

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
