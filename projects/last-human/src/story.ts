// "YOU'RE THE LAST HUMAN ALIVE… BUT SOMETHING IS WATCHING YOU." — the shot timeline (30 fps, 1800 frames).
// Every shot: frame range, look, camera keys (smootherstep glides), depth of field, and what the actors do.
// Voice lines land on these shots (voice/build_voice.py SLOTS); reactions land 0-3 frames before their word.
import * as THREE from "three";
import { World, Look } from "./world/World";
import { drawCharacter, drawHeadOnly, drawWatcher, Face, FACE0, Light, Pose, stand, walk } from "./char/draw";
import { APT } from "./world/apartment";
import { CITY } from "./world/city";

export const FPS = 30;
export const TOTAL = 1800;
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

// ---------------------------------------------------------------- character lights (screen-space directions)
const SUN_SIDE: Light = { key: "#ffbf8f", keyK: 1.05, amb: "#6260a6", ambK: 0.6, dir: 15, rim: { color: "#ff9a5a", k: 0.55, dir: 10, w: 0.8 } };
const SUN_BACK: Light = { key: "#ffb27a", keyK: 0.35, amb: "#5c58a0", ambK: 0.55, dir: 60, rim: { color: "#ffa060", k: 1.0, dir: 60, w: 1.6 } };
const TV: Light = { key: "#c6eee8", keyK: 0.82, amb: "#56589a", ambK: 0.55, dir: 165, rim: { color: "#ff9a5a", k: 0.75, dir: 15, w: 1.1 } };
const OVERCAST: Light = { key: "#d6dcea", keyK: 0.62, amb: "#7680a6", ambK: 0.72, dir: 100, rim: { color: "#b8c8e8", k: 0.18, dir: 30, w: 0.6 } };
const DUSK: Light = { key: "#ffb080", keyK: 0.4, amb: "#6a5a9a", ambK: 0.58, dir: 80, rim: { color: "#ff8a4a", k: 0.95, dir: 70, w: 1.3 } };
const NEON: Light = { key: "#c9a6ff", keyK: 0.75, amb: "#3c4280", ambK: 0.5, dir: 160, rim: { color: "#3ff0e0", k: 0.85, dir: 15, w: 1.2 } };
const NEON_L: Light = { key: "#d0b0ff", keyK: 0.8, amb: "#3c4280", ambK: 0.48, dir: 150, rim: { color: "#ff6ab8", k: 0.7, dir: 20, w: 1.1 } };
const DARK: Light = { key: "#8a7ad8", keyK: 0.35, amb: "#2c3266", ambK: 0.45, dir: 30, rim: { color: "#6a5cff", k: 0.75, dir: 25, w: 1.1 } };
const PHONE: Light = { key: "#bfe0ff", keyK: 0.78, amb: "#262c5c", ambK: 0.42, dir: -80, rim: { color: "#7a5cff", k: 0.6, dir: 20, w: 1.0 } };

const BODY = { x0: -62, y0: -8, w: 124, h: 198 };

// ---------------------------------------------------------------- poses
function sitBed(t: number, face: Partial<Face>, o: { phone?: number; nod?: number; headPsi?: number; psi?: number } = {}): Pose {
  const br = Math.sin(t * 2 * Math.PI * 0.3);
  const hands = o.phone !== undefined ? "phone" : "open";
  return {
    psi: o.psi ?? 0, headPsi: o.headPsi, hip: [0, 56, 0], lean: 14, headTilt: 0, headNod: o.nod ?? 0,
    armL: o.phone !== undefined ? [30, -16, 78] : [20, 10, 30], armR: o.phone !== undefined ? [30, -16, 78] : [20, 10, 30],
    legL: [84, 6, 80], legR: [84, 6, 86], handL: hands, handR: hands, phoneGlow: o.phone,
    face: { ...FACE0, ...face }, breathe: br,
  };
}

function lieToSit(k: number, t: number, face: Partial<Face>, headPsi?: number): Pose {
  // side view in bed: torso from lying back (-86°) to upright (-4°); legs straight forward under the duvet
  const br = Math.sin(t * 2 * Math.PI * 0.35);
  return {
    psi: 90, headPsi, hip: [0, 93, 0], lean: lerp(-86, -2, k), headTilt: lerp(-6, 0, k), headNod: lerp(-14, 4, k),
    armL: [lerp(-70, 30, k), 6, lerp(20, 40, k)], armR: [lerp(-80, 25, k), 6, lerp(10, 50, k)],
    legL: [90, 2, 0], legR: [88, 3, 4], handL: "open", handR: "open", face: { ...FACE0, ...face }, breathe: br,
  };
}

const blinkAt = (f: number, at: number[]) => { for (const b of at) { const d = f - b; if (d >= 0 && d < 4) return [0.45, 0.05, 0.1, 0.6][d]; } return 1; };

// ---------------------------------------------------------------- shots
const P = APT;
export const SHOTS: Shot[] = [
  // 1a — the hook: close on his face on the pillow, stripes of sunrise; eyes snap open on "wake"
  {
    id: "1a", a: 0, b: 54, look: "sunrise", grade: "warm",
    cam: (f) => ({ ...keys([{ f: 0, pos: [1.62, 1.55, -2.28], look: [1.55, 0.7, -2.4], fov: 30 }, { f: 54, pos: [1.59, 1.36, -2.32], look: [1.55, 0.7, -2.41], fov: 30 }], f), up: [0, 0, -1] }),
    dof: () => ({ cInf: 10, focus: [1.55, 0.7, -2.38] }),
    act: (f, w) => {
      const open = f < 17 ? 0 : f < 19 ? [0.5, 1.3][f - 17] : f < 26 ? 1.25 : blinkAt(f, [44]) * 1.08;
      const face: Face = { ...FACE0, open, pupil: f > 18 ? 0.7 : 1, brow: f > 18 ? 0.6 : 0, browIn: f > 18 ? 0.8 : 0.2, look: f > 30 ? [0.7, 0.15] : [0, 0], mouth: "part", mouthOpen: 0.2 };
      const c = w.cu; c.setFrame({ x0: -18, y0: -24, w: 36, h: 42 });
      c.draw((ctx, F) => { drawHeadOnly(ctx, "front", face, SUN_SIDE, F, -10, 0.8); stripes(ctx, 0.5); });
      c.pivot.position.set(1.55, 0.7, -2.4); c.pivot.rotation.set(-Math.PI / 2, 0, 0); c.visible = true; c.blob.visible = false;
    },
  },
  // 1b — he jolts upright; the camera pulls back and rises: the room, the window, the light
  {
    id: "1b", a: 54, b: 150, look: "sunrise", grade: "warm",
    cam: (f) => keys([{ f: 54, pos: [-0.35, 1.0, -1.45], look: [1.55, 0.95, -1.85], fov: 38 }, { f: 78, pos: [-0.5, 1.05, -1.3], look: [1.55, 1.0, -1.85], fov: 38 }, { f: 150, pos: [-2.4, 1.85, 0.9], look: [1.5, 1.0, -1.7], fov: 44 }], f),
    dof: (f) => ({ cInf: lerp(9, 3, ramp(f, 80, 150)), focus: [1.55, 1.2, -1.75] }),
    act: (f, w, cam) => {
      const k = f < 60 ? 0 : ss((f - 60) / 9) * 1.04 - Math.max(0, ss((f - 69) / 8) * 0.04);
      const hp = f < 96 ? 90 : f < 100 ? 70 : 50;
      const face: Partial<Face> = { open: blinkAt(f, [112]) * 1.2, pupil: 0.65, brow: 0.8, browIn: 1.0, mouth: f < 75 ? "gasp" : "tight", mouthOpen: 0.4, look: f > 100 ? [0.5, 0.1] : [0.2, 0] };
      w.place(w.hero, lieToSit(clamp(k, 0, 1.04), f / FPS, face, hp), SUN_BACK, { x0: -110, y0: 40, w: 220, h: 150 }, V([1.55, -0.37, -1.62]), cam, { blob: false });
    },
  },
  // 2a — over his shoulder at the window: a sunrise city, nothing moves
  {
    id: "2a", a: 150, b: 258, look: "sunrise", grade: "warm",
    cam: (f) => keys([{ f: 150, pos: [1.72, 1.74, 0.98], look: [60, -6, -2], fov: 42, roll: -1.2 }, { f: 258, pos: [2.08, 1.69, 0.88], look: [60, -7, -3], fov: 40, roll: -0.4 }], f),
    dof: () => ({ cInf: 6, focus: [60, -20, 6] }),
    act: (f, w, cam) => {
      const p = V([2.75, 0, 0.75]);
      const pose = stand(World.psi(p, V([1, 0, 0.12]), cam), f / FPS, {});
      pose.headNod = -3; pose.headTilt = -2;
      w.place(w.hero, pose, SUN_BACK, BODY, p, cam);
    },
  },
  // 2b — the TV: static, teal light on his face
  {
    id: "2b", a: 258, b: 360, look: "morning", grade: "cool",
    cam: (f) => keys([{ f: 258, pos: [-2.95, 1.45, 2.05], look: [-1.25, 1.32, 0.3], fov: 38 }, { f: 360, pos: [-2.75, 1.5, 1.6], look: [-1.25, 1.38, 0.32], fov: 35 }], f),
    dof: () => ({ cInf: 9, focus: [-1.25, 1.62, 0.35] }),
    act: (f, w, cam) => {
      const p = V([...[P.tvStand.x, 0, P.tvStand.z]] as V3);
      const pose = stand(World.psi(p, V([-1, 0, 0.15]), cam), f / FPS, { browIn: 1.1, brow: 0.3, mouth: "tight", look: [0.1, -0.1], open: blinkAt(f, [290, 336]) });
      pose.armL = [10, 8, 25]; pose.headNod = 4;
      w.place(w.hero, pose, TV, BODY, p, cam);
    },
  },
  // 3a — the empty avenue: tiny figure, long road, fog
  {
    id: "3a", a: 360, b: 462, look: "overcast", grade: "cool",
    cam: (f) => keys([{ f: 360, pos: [1.3, 6.8, 14.5], look: [-0.5, 0.6, -30], fov: 40 }, { f: 462, pos: [1.0, 5.2, 12.0], look: [-0.5, 0.9, -30], fov: 38 }], f),
    dof: () => ({ cInf: 0 }),
    act: (f, w, cam) => {
      const d = (f - 360) / FPS * 1.25;
      const p = V([-0.6, 0, -1 - d]);
      w.place(w.hero, walk(World.psi(p, V([0.02, 0, -1]), cam), d / 1.5), OVERCAST, BODY, p, cam, { lineK: 1.4 });
    },
  },
  // 3b — the café: a meal left half eaten; he passes behind it
  {
    id: "3b", a: 462, b: 558, look: "overcast", grade: "cool",
    cam: (f) => keys([{ f: 462, pos: [-11.75, 1.12, -0.35], look: [-8.8, 0.78, -1.75], fov: 34 }, { f: 558, pos: [-11.35, 1.04, -0.75], look: [-8.8, 0.76, -1.6], fov: 30 }], f),
    dof: () => ({ cInf: 11, focus: [-10.35, 0.82, -1.15] }),
    act: (f, w, cam) => {
      const d = (f - 462) / FPS * 1.0;
      const p = V([-6.0, 0, -3.9 + d]);
      w.place(w.hero, walk(World.psi(p, V([0.05, 0, 1]), cam), d / 1.5, { look: [-0.6, -0.2], browIn: 0.9 }), OVERCAST, BODY, p, cam);
    },
  },
  // 3c — red light forever; dusk; he walks between the waiting cars
  {
    id: "3c", a: 558, b: 678, look: "dusk", grade: "dusk",
    cam: (f) => keys([{ f: 558, pos: [0.9, 0.85, -9.0], look: [-2.2, 3.7, -30.6], fov: 42, roll: 2 }, { f: 678, pos: [0.7, 0.95, -11.0], look: [-2.5, 4.5, -30.6], fov: 38, roll: 1 }], f),
    dof: () => ({ cInf: 4, focus: [0.2, 1.5, -15] }),
    act: (f, w, cam) => {
      const d = (f - 558) / FPS * 1.1;
      const p = V([0.15, 0, -13 - d]);
      const pose = walk(World.psi(p, V([0, 0, -1]), cam), d / 1.5);
      if (f > 640) { pose.headNod = -10; }
      w.place(w.hero, pose, DUSK, BODY, p, cam);
    },
  },
  // 4a — night: neon, wet street; the first camera in the foreground
  {
    id: "4a", a: 678, b: 768, look: "night", grade: "night",
    cam: (f) => keys([{ f: 678, pos: [5.4, 1.7, -2.4], look: [3.4, 1.4, -14], fov: 36 }, { f: 768, pos: [5.5, 1.75, -0.6], look: [3.4, 1.45, -11], fov: 34 }], f),
    dof: (f) => ({ cInf: 8, focus: [3.4, 1.5, lerp(-15, -11, (f - 678) / 90)] }),
    act: (f, w, cam) => {
      const d = (f - 678) / FPS * 1.15;
      const p = V([3.4, 0, -15.5 + d]);
      w.practical(0, [3.0, 4.5, -10], "#b07bff", 60, 14); w.practical(1, [7.5, 3.0, -16], "#3ff0e0", 40, 12);
      const look: [number, number] = f > 730 ? [0.8, 0.3] : [-0.3, 0];
      w.place(w.hero, walk(World.psi(p, V([0.03, 0, 1]), cam), d / 1.5, { look, browIn: 0.9, brow: f > 735 ? 0.5 : 0 }), NEON, BODY, p, cam);
      w.aimCams(V([3.4, 1.6, -15.5 + d]), 0.35 * ramp(f, 735, 768), [0], () => ({ yaw: 1.2, pitch: 0.15 }));
      w.aimCams(V([3.4, 1.6, -15.5 + d]), 0); // everyone else at rest
    },
  },
  // 4b — close on the camera: it turns to follow him
  {
    id: "4b", a: 768, b: 852, look: "night", grade: "night",
    cam: (f) => keys([{ f: 768, pos: [7.95, 4.12, -7.15], look: [8.7, 4.5, -5.0], fov: 27 }, { f: 852, pos: [8.05, 4.16, -6.95], look: [8.7, 4.5, -4.95], fov: 24 }], f),
    dof: () => ({ cInf: 12, focus: [8.62, 4.5, -5.25] }),
    act: (f, w, cam) => {
      const d = (768 - 678) / FPS * 1.15 + (f - 768) / FPS * 1.15;
      const p = V([3.4, 0, -15.5 + d]);
      w.practical(0, [10.2, 6.2, -3.5], "#ffa050", 30, 8); w.practical(1, [7.0, 4.0, -7.0], "#b07bff", 25, 8);
      w.place(w.hero, walk(World.psi(p, V([0.03, 0, 1]), cam), d / 1.5, {}), NEON, BODY, p, cam);
      // slow servo follow: from where 4a left it, all the way onto him, with a small overshoot and settle
      const k = 0.35 + 0.65 * ramp(f, 776, 826) + 0.04 * Math.sin(Math.max(0, f - 826) * 0.35) * Math.exp(-Math.max(0, f - 826) * 0.12);
      w.aimCams(V([3.4, 1.5, -15.5 + d]), k, [0], () => ({ yaw: 1.2, pitch: 0.15 }));
    },
  },
  // 4c — low wide: every camera on the street turns toward him
  {
    id: "4c", a: 852, b: 912, look: "night", grade: "night",
    cam: (f) => keys([{ f: 852, pos: [1.4, 0.45, -0.5], look: [0.2, 4.2, -22], fov: 56, roll: -3 }, { f: 912, pos: [1.3, 0.5, -1.8], look: [0.2, 4.5, -22], fov: 54, roll: -4 }], f),
    dof: () => ({ cInf: 0 }),
    act: (f, w, cam) => {
      const p = V([0.4, 0, -9.5]);
      const pose = stand(World.psi(p, V([0, 0, 1]), cam), f / FPS, { open: 1.2, pupil: 0.6, brow: 0.9, browIn: 1.1, look: [0, 0.6] });
      pose.headNod = -18; pose.armL = [5, 12, 15]; pose.armR = [5, 12, 15];
      w.place(w.hero, pose, NEON, BODY, p, cam);
      w.practical(0, [0.4, 5.0, -12], "#b07bff", 50, 14); w.practical(1, [-5, 5.0, -28], "#ff3020", 60, 16);
      // all at once, a beat after the line lands, each a few frames apart
      w.city.cams.forEach((_, i) => w.aimCams(V([0.4, 1.6, -9.5]), ramp(f, 856 + (i % 5) * 3, 890 + (i % 5) * 3), [i]));
    },
  },
  // 4d — his face, looking up
  {
    id: "4d", a: 912, b: 960, look: "night", grade: "night",
    cam: (f) => keys([{ f: 912, pos: [0.15, 1.35, -8.25], look: [0.4, 1.68, -9.5], fov: 34 }, { f: 960, pos: [0.2, 1.38, -8.45], look: [0.4, 1.7, -9.5], fov: 32 }], f),
    dof: () => ({ cInf: 12, focus: [0.4, 1.66, -9.5] }),
    act: (f, w, cam) => {
      const p = V([0.4, 0, -9.5]);
      const pose = stand(World.psi(p, V([0, 0, 1]), cam), f / FPS, { open: 1.3, pupil: 0.5, brow: 1.1, browIn: 1.3, mouth: "gasp", mouthOpen: 0.3, look: [0.4 * Math.sin(f * 0.3), 0.7] });
      pose.headNod = -16; pose.headTilt = 3;
      w.cu.setFrame({ x0: -34, y0: 118, w: 68, h: 72 });
      w.cu.draw((ctx, F) => drawCharacter(ctx, pose, NEON_L, F, { lineK: 0.75 }));
      w.cu.stand(p, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
    },
  },
  // 5a — the shop window: his reflection walks with him
  {
    id: "5a", a: 960, b: 1080, look: "night", grade: "night",
    cam: (f) => { const z = heroZ5(f); return { pos: [-6.4, 1.5, z + 2.2], look: [-12.6, 1.3, z - 0.6], fov: 38 }; },
    dof: (f) => ({ cInf: 5, focus: [-11.6, 1.4, heroZ5(f)] }),
    act: (f, w, cam) => act5(f, w, cam),
  },
  // 5b — he stops; the reflection takes one more step, turns, smiles
  {
    id: "5b", a: 1080, b: 1200, look: "night", grade: "night",
    cam: (f) => keys([{ f: 1080, pos: [-6.4, 1.5, heroZ5(1080) + 2.2], look: [-12.6, 1.3, heroZ5(1080) - 0.6], fov: 38 }, { f: 1128, pos: [-7.0, 1.5, -78.6], look: [-12.9, 1.35, -78.45], fov: 36 }, { f: 1200, pos: [-7.9, 1.52, -79.3], look: [-13.2, 1.45, -78.55], fov: 33 }], f),
    dof: () => ({ cInf: 6, focus: [-11.6, 1.5, -78.2] }),
    act: (f, w, cam) => act5(f, w, cam),
  },
  // 5c — close on the reflection behind the glass: dead eyes, too-wide smile
  {
    id: "5c", a: 1200, b: 1260, look: "night", grade: "night",
    cam: (f) => keys([{ f: 1200, pos: [-11.9, 1.62, -78.0], look: [-14.3, 1.63, -78.95], fov: 30 }, { f: 1260, pos: [-12.1, 1.63, -78.3], look: [-14.3, 1.64, -78.95], fov: 27 }], f),
    dof: () => ({ cInf: 9, focus: [-14.3, 1.64, -78.95] }),
    act: (f, w, cam) => {
      const p = V([-14.2, 0.15, -78.95]);
      const sm = ramp(f, 1200, 1236);
      const face: Face = { ...FACE0, open: 1.05, pupil: 0.45, shine: false, brow: -0.3, browIn: -0.4, mouth: "creep", mouthOpen: sm, look: [0, 0] };
      const pose = stand(World.psi(p, V([1, 0, 0.35]), cam), 0, face); pose.headTilt = -4 - 6 * sm; pose.headNod = 5;
      w.cu.setFrame({ x0: -34, y0: 118, w: 68, h: 72 });
      w.cu.draw((ctx, F) => { drawCharacter(ctx, pose, { ...NEON, keyK: 0.6, ambK: 0.38 }, F, { lineK: 0.75 }); glassTint(ctx); });
      w.cu.stand(p, cam.position); w.cu.visible = true; w.cu.blob.visible = false;
      w.cu.mat.opacity = 0.8;
      w.practical(0, [-12.2, 2.6, -77.5], "#b07bff", 12, 5);
    },
  },
  // 6a — home: the chain goes on
  {
    id: "6a", a: 1260, b: 1356, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1260, pos: [-0.6, 1.6, 0.45], look: [-2.1, 1.25, 2.9], fov: 40 }, { f: 1356, pos: [-0.85, 1.55, 0.85], look: [-2.1, 1.3, 2.9], fov: 37 }], f),
    dof: () => ({ cInf: 6, focus: [-2.15, 1.4, 2.6] }),
    act: (f, w, cam) => {
      const p = V([-2.05, 0, 2.5]);
      const pose = stand(World.psi(p, V([-0.05, 0, 1]), cam), f / FPS, {});
      const reach = ramp(f, 1280, 1296) * (1 - ramp(f, 1318, 1332));
      pose.armR = [lerp(5, 112, reach), lerp(6, 14, reach), lerp(8, 34, reach)];
      pose.armL = [lerp(5, 60, reach * 0.6), 10, lerp(8, 40, reach)];
      pose.lean = lerp(2, 8, reach); pose.headNod = lerp(0, 8, ramp(f, 1330, 1350));
      w.apt.chainLocked.visible = f >= 1306; w.apt.chainLoose.visible = f < 1306;
      w.place(w.hero, pose, DARK, BODY, p, cam);
    },
  },
  // 6b — sitting on the bed in the dark; the phone buzzes
  {
    id: "6b", a: 1356, b: 1464, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1356, pos: [0.85, 1.12, 1.1], look: [1.55, 0.95, -0.8], fov: 36 }, { f: 1464, pos: [1.05, 1.1, 0.6], look: [1.55, 1.0, -0.8], fov: 32 }], f),
    dof: () => ({ cInf: 7, focus: [1.55, 1.15, -0.85] }),
    act: (f, w, cam) => {
      const buzz = f >= 1446;
      const glow = buzz ? 1 : 0.35;
      const jolt = buzz && f < 1452 ? (f % 2 ? 1 : -1) * 0.6 : 0;
      const face: Partial<Face> = { open: buzz ? 1.25 : blinkAt(f, [1390, 1428]) * 0.85, pupil: buzz ? 0.6 : 0.9, brow: buzz ? 0.8 : 0, browIn: 0.9, look: [0, -0.8], mouth: buzz ? "part" : "tight" };
      const pose = sitBed(f / FPS, face, { phone: glow, nod: 14 + jolt * 3, psi: World.psi(V([1.55, 0, -0.95]), V([0, 0, 1]), cam) });
      w.place(w.hero, pose, { ...PHONE, keyK: 0.45 + 0.4 * glow }, BODY, V([1.55, -0.04, -0.95]), cam, { floorY: 0 });
      w.apt.phoneLight.position.set(1.55, 1.05, -0.62); w.apt.phoneLight.intensity = 0.25 + glow * 0.8;
    },
  },
  // 6c — the photo: him, asleep, taken from inside this room
  {
    id: "6c", a: 1464, b: 1590, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1464, pos: [2.15, 1.8, -1.5], look: [1.55, 0.92, -0.5], fov: 40 }, { f: 1590, pos: [1.78, 1.36, -1.02], look: [1.55, 0.92, -0.5], fov: 34 }], f),
    dof: (f) => ({ cInf: 10, focus: [1.55, 0.94, -0.52] }),
    act: (f, w, cam) => {
      const pose = sitBed(f / FPS, { open: 1.1, look: [0, -0.8] }, { phone: 0, nod: 20, psi: World.psi(V([1.55, 0, -0.95]), V([0, 0, 1]), cam) });
      pose.handL = "fist"; pose.handR = "fist"; pose.phoneGlow = undefined;
      w.place(w.hero, pose, PHONE, BODY, V([1.55, -0.04, -0.95]), cam, { floorY: 0 });
      w.phone.visible = true; w.phone.position.set(1.55, 0.92, -0.5);
      w.phone.lookAt(cam.position); w.phone.rotateZ(0.06);
      w.apt.phoneLight.position.set(1.55, 1.05, -0.5); w.apt.phoneLight.intensity = 0.9;
    },
  },
  // 7a — close: he understands; slowly turns to look over his shoulder
  {
    id: "7a", a: 1590, b: 1686, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1590, pos: [1.35, 1.2, 0.08], look: [1.55, 1.2, -0.95], fov: 32 }, { f: 1686, pos: [1.38, 1.2, -0.12], look: [1.55, 1.21, -0.95], fov: 30 }], f),
    dof: () => ({ cInf: 13, focus: [1.55, 1.22, -0.95] }),
    act: (f, w, cam) => {
      const turn = ramp(f, 1640, 1684);
      const hp = turn < 0.25 ? 0 : turn < 0.55 ? -45 : turn < 0.8 ? -90 : -125;
      const face: Partial<Face> = { open: f < 1636 ? 0.95 : 1.32, pupil: f < 1636 ? 0.85 : 0.45, brow: f < 1636 ? 0.2 : 1.1, browIn: 1.2, look: f < 1636 ? [0, -0.7] : [-0.9, 0], mouth: f < 1636 ? "tight" : "part", mouthOpen: 0.3 };
      const pose = sitBed(f / FPS, face, { phone: 0.8, nod: lerp(14, 0, ramp(f, 1630, 1650)), headPsi: hp, psi: 0 });
      pose.headTilt = -3 * turn;
      w.cu.setFrame({ x0: -36, y0: 80, w: 72, h: 76 });
      w.cu.draw((ctx, F) => drawCharacter(ctx, pose, PHONE, F, { lineK: 0.75 }));
      w.cu.stand(V([1.55, -0.04, -0.95]), cam.position); w.cu.visible = true; w.cu.blob.visible = false;
      w.apt.phoneLight.position.set(1.55, 1.05, -0.62); w.apt.phoneLight.intensity = 0.8;
    },
  },
  // 7b — the dark corner. Eyes open. A smile.
  {
    id: "7b", a: 1686, b: 1767, look: "aptNight", grade: "night",
    cam: (f) => keys([{ f: 1686, pos: [0.9, 1.5, -0.35], look: [-3.05, 1.75, -2.65], fov: 38 }, { f: 1767, pos: [-0.9, 1.6, -1.55], look: [-3.05, 1.95, -2.65], fov: 34 }], f),
    dof: () => ({ cInf: 6, focus: [-3.05, 1.9, -2.65] }),
    act: (f, w, cam) => {
      const eyes = ramp(f, 1712, 1722);
      const smile = ramp(f, 1730, 1758);
      const c = w.watcher; c.setFrame({ x0: -40, y0: -4, w: 80, h: 255 });
      c.draw((ctx, F) => drawWatcher(ctx, F, { eyes, smile, rim: 0.35, tilt: -5 * smile, lean: 1 }));
      c.stand(V([-3.12, 0, -2.68]), cam.position); c.visible = true; c.blob.visible = false;
      // his head in the near foreground (back of the head, out of focus)
      const pose = sitBed(f / FPS, { open: 1.3 }, { phone: 0.6, nod: 0, headPsi: -135, psi: World.psi(V([1.55, 0, -0.95]), V([0, 0, 1]), cam) });
      w.place(w.hero, pose, PHONE, BODY, V([1.55, -0.04, -0.95]), cam, { floorY: 0 });
    },
  },
  // 7c — black; the title
  {
    id: "7c", a: 1767, b: 1800, look: "aptNight", grade: "night",
    cam: () => ({ pos: [-0.9, 1.6, -1.55], look: [-3.05, 1.95, -2.65], fov: 34 }),
    dof: () => ({ cInf: 0 }),
    act: () => {},
  },
];

// ---------------------------------------------------------------- scene 5 choreography
// he walks -z along the shop window at x = -11.6 and stops at z = -78.2 (frame ~1128, "reflection takes");
// the reflection (mirrored behind the glass, x = -14.2) keeps walking one more step and stops at -78.95 (~1166)
const SPEED5 = 1.1;
const STOP5 = 1128;
function heroZ5(f: number) {
  if (f <= STOP5 - 10) return -72.0 - ((f - 960) / FPS) * SPEED5;
  const z0 = -72.0 - ((STOP5 - 10 - 960) / FPS) * SPEED5; // decelerate over 10 frames
  const t = clamp((f - (STOP5 - 10)) / 10);
  return z0 - (SPEED5 / FPS) * 10 * (t - t * t / 2);
}
function reflZ5(f: number) {
  const z1 = heroZ5(STOP5);
  if (f <= STOP5) return heroZ5(f);
  const t = ramp(f, STOP5, 1166);
  return z1 - 0.75 * t;
}
function act5(f: number, w: World, cam: THREE.PerspectiveCamera) {
  const z = heroZ5(f), zr = reflZ5(f);
  w.practical(0, [-11.0, 3.8, z - 1.5], "#b07bff", 30, 9); w.practical(1, [-8.6, 6.0, z + 4], "#ffa050", 40, 12);
  const p = V([-11.6, 0.15, z]), pr = V([2 * CITY.shopGlassX + 11.6, 0.15, zr]);
  const dist = (-72 - z), distR = (-72 - zr);
  const moving = f < STOP5;
  const reflWalk = f < 1166;
  const sawIt = f > 1150;
  const face: Partial<Face> = sawIt ? { open: 1.3, pupil: 0.55, brow: 1, browIn: 1.1, mouth: "part", look: [-0.8, 0] } : { look: [0.2, 0], browIn: 0.8 };
  const heroPose = moving ? walk(World.psi(p, V([0, 0, -1]), cam), dist / 1.5, face, { amp: f > STOP5 - 12 ? 0.6 : 1 }) : stand(World.psi(p, V([0, 0, -1]), cam), f / FPS, face);
  if (!moving) heroPose.headPsi = f < 1150 ? 90 : f < 1156 ? 125 : 150;
  w.place(w.hero, heroPose, NEON, BODY, p, cam, { floorY: 0.15 });
  // reflection: same drawing, no shine, its own timing; turns its head toward us, then smiles
  const turn = f >= 1172 ? (f < 1178 ? 50 : 15) : 90;
  const sm = ramp(f, 1182, 1200);
  const rface: Partial<Face> = { shine: false, pupil: 0.7, look: f >= 1176 ? [-0.3, 0] : [0.2, 0], brow: f >= 1176 ? -0.2 : 0, browIn: f >= 1176 ? -0.3 : 0.8, mouth: sm > 0.05 ? "creep" : "neutral", mouthOpen: sm };
  const reflPose = reflWalk ? walk(World.psi(pr, V([0, 0, -1]), cam), distR / 1.5, rface, { amp: f > 1150 ? 0.6 : 1 }) : stand(World.psi(pr, V([0, 0, -1]), cam), 0, rface);
  if (!reflWalk) { reflPose.headPsi = turn; reflPose.breathe = 0; }
  w.place(w.refl, reflPose, { ...NEON, keyK: 0.55, ambK: 0.4, rim: { color: "#5fd8ff", k: 0.4, dir: 160, w: 0.8 } }, BODY, pr, cam, { blob: false });
  w.refl.mat.opacity = 0.62;
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
  ctx.fillStyle = "rgba(30,50,110,0.28)"; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(120,160,255,0.06)";
  ctx.translate(W / 2, H / 2); ctx.rotate(0.5); ctx.fillRect(-W, -H * 0.4, W * 2, H * 0.12); ctx.fillRect(-W, H * 0.1, W * 2, H * 0.05);
  ctx.restore();
}

// the photo on the phone: taken from the dark corner, him asleep, flash
export const PHOTO_SHOT: Shot = {
  id: "photo", a: 0, b: 1, look: "photo", grade: "night",
  cam: () => ({ pos: [-2.95, 2.05, -2.55], look: [1.45, 0.6, -2.1], fov: 30, roll: -6 }),
  dof: () => ({ cInf: 0 }),
  act: (f, w, cam) => {
    const c = w.cu; c.setFrame({ x0: -18, y0: -24, w: 36, h: 42 });
    c.draw((ctx, F) => drawHeadOnly(ctx, "front", { ...FACE0, open: 0, mouth: "neutral" }, { ...PHONE, key: "#dfe8ff", keyK: 0.9, dir: 120 }, F, -14, 0.8));
    // head turned toward the corner on the pillow: face the camera, lean back, crown toward the headboard
    c.pivot.position.set(1.52, 0.76, -2.5); c.pivot.lookAt(cam.position); c.pivot.rotateX(-0.55); c.pivot.rotateZ(1.25);
    c.visible = true; c.blob.visible = false;
    w.apt.phoneLight.position.copy(cam.position); w.apt.phoneLight.intensity = 14; w.apt.phoneLight.distance = 12; w.apt.phoneLight.color.set("#dfe8ff");
  },
};

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
