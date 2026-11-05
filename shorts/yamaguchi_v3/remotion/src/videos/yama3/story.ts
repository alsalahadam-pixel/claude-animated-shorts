// "Home Was Nagasaki": timeline of the Yamaguchi short. Every shot is timed to the narration
// (claude-animated-shorts/shorts/yamaguchi/voice/words.json, frame = word start x 30). One world with six sets
// (zones): rail (train + Nagasaki harbour), street (Hiroshima street, shipyard, sky, river), field (blast plain +
// shelter), office (Nagasaki drafting office + desk insert), camp (night campfire + distance targets), garden
// (golden: tunnel hill, bench under a blossom tree, podium). Only the shot's zone is shown.
// Camera grammar from the bridge short: smootherstep glides 18-40 f, every hold creeps in, impact kicks flip sign
// every frame and decay over 7 f, cuts on big reframes.
export const FPS = 30;
export const TOTAL = 2715;
export const D0 = 0;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

export type Zone = "rail" | "street" | "field" | "office" | "camp" | "garden";
export type Light = "day" | "golden" | "night" | "blast" | "office" | "fire";
export type ShotDef = { id: number; a: number; b: number; zone: Zone; light: Light; tau: (t: number) => number; sunAz?: number; sunEl?: number };

// ---------------- shots ----------------
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 60, zone: "rail", light: "day", tau: (t) => t + 2, sunAz: 160, sunEl: 40 },          // bandaged at the train window
  { id: 2, a: 60, b: 114, zone: "rail", light: "day", tau: (t) => t + 2, sunAz: 140, sunEl: 35 },                     // train through the fields
  { id: 3, a: 114, b: 160, zone: "rail", light: "day", tau: (t) => t + 13.8, sunAz: 150, sunEl: 40 },        // "Home was Nagasaki"
  { id: 4, a: 160, b: 328, zone: "street", light: "day", tau: (t) => t, sunAz: 150, sunEl: 40 },                      // shipyard, the ship designer
  { id: 5, a: 328, b: 405, zone: "street", light: "day", tau: (t) => t },                      // walking home, thinking of family
  { id: 6, a: 405, b: 467, zone: "street", light: "day", tau: (t) => t },                      // forgot his hanko
  { id: 7, a: 467, b: 510, zone: "office", light: "office", tau: (t) => t },                   // hanko insert
  { id: 8, a: 510, b: 565, zone: "street", light: "day", tau: (t) => t },                      // walks back to the shipyard
  { id: 9, a: 565, b: 599, zone: "street", light: "day", tau: (t) => t, sunAz: 140 },          // street clock 8:15
  { id: 10, a: 599, b: 624, zone: "street", light: "day", tau: (t) => t },                     // looks up
  { id: 11, a: 624, b: 754, zone: "street", light: "day", tau: (t) => t, sunAz: 30, sunEl: 60 },// plane + parachutes, sky turns white
  { id: 12, a: 754, b: 794, zone: "field", light: "blast", tau: (t) => t },                    // 3 km away: the cloud
  { id: 13, a: 794, b: 877, zone: "field", light: "blast", tau: (t) => t },                    // eardrums, burns
  { id: 14, a: 877, b: 915, zone: "field", light: "night", tau: (t) => t },                    // night in a shelter
  { id: 15, a: 915, b: 991, zone: "rail", light: "golden", tau: (t) => t - 30.5, sunAz: 150, sunEl: 12 },  // catches a train home
  { id: 16, a: 991, b: 1043, zone: "rail", light: "day", tau: (t) => t - 15.0, sunAz: 150, sunEl: 40 },    // "Home is Nagasaki"
  { id: 17, a: 1043, b: 1157, zone: "office", light: "office", tau: (t) => t },                // back to work, bandaged
  { id: 18, a: 1157, b: 1250, zone: "office", light: "office", tau: (t) => t },                // tells his boss
  { id: 19, a: 1250, b: 1291, zone: "office", light: "office", tau: (t) => t },                // "that's crazy"
  { id: 20, a: 1291, b: 1340, zone: "office", light: "office", tau: (t) => t },                // "no bomb could ever do that"
  { id: 21, a: 1340, b: 1423, zone: "office", light: "office", tau: (t) => t },                // the same white light
  { id: 22, a: 1423, b: 1526, zone: "field", light: "blast", tau: (t) => t },                  // the cloud followed him
  { id: 23, a: 1526, b: 1668, zone: "street", light: "night", tau: (t) => t },                 // lanterns: the cost
  { id: 24, a: 1668, b: 1799, zone: "camp", light: "night", tau: (t) => t },                   // both times 3 km
  { id: 25, a: 1799, b: 1960, zone: "camp", light: "fire", tau: (t) => t, sunAz: -55, sunEl: 22 },                   // campfire
  { id: 26, a: 1960, b: 2110, zone: "camp", light: "fire", tau: (t) => t, sunAz: -30, sunEl: 40 },                   // inverse square
  { id: 27, a: 2110, b: 2215, zone: "garden", light: "golden", tau: (t) => t, sunAz: 155, sunEl: 22 },     // close enough / far enough
  { id: 28, a: 2215, b: 2296, zone: "garden", light: "golden", tau: (t) => t, sunAz: 150, sunEl: 22 },     // wife and son, the tunnel
  { id: 29, a: 2296, b: 2364, zone: "garden", light: "day", tau: (t) => t },                   // 2009: recognised
  { id: 30, a: 2364, b: 2441, zone: "office", light: "office", tau: (t) => t },                // the stamp again
  { id: 31, a: 2441, b: 2549, zone: "garden", light: "golden", tau: (t) => t, sunAz: 160, sunEl: 20 },     // podium, never again
  { id: 32, a: 2549, b: TOTAL, zone: "garden", light: "golden", tau: (t) => t, sunAz: 150, sunEl: 18 },    // ninety-three
  // v2 edit only: the cloud over Nagasaki seen from the hills (rail zone; the train is hidden)
  { id: 33, a: 0, b: 90, zone: "rail", light: "blast", tau: () => 19.8, sunAz: 150, sunEl: 30 },
];
/** crossfades (frames) at place / time changes */
export const XFADE: Record<number, number> = { 14: 10, 15: 10, 23: 12, 24: 10, 27: 10, 28: 8, 29: 8, 31: 8, 32: 10 };
/** 4-frame white flash after the hook */
export const FLASH_AT = 160;
/** white-outs: [ramp start, full, hold end, clear] in frames (DOM overlay, the bomb flashes) */
export const WHITEOUTS: [number, number, number, number][] = [[706, 724, 754, 776], [1362, 1378, 1423, 1446]];
export const whiteAt = (f: number) => {
  let w = 0;
  for (const [a, b, c, d] of WHITEOUTS) {
    if (f >= a && f < b) w = Math.max(w, ((f - a) / (b - a)) ** 1.6);
    else if (f >= b && f < c) w = 1;
    else if (f >= c && f < d) w = Math.max(w, (1 - (f - c) / (d - c)) ** 2);
  }
  return w;
};

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- places (world coordinates per zone, metres) ----------------
// rail: track along z at x = 0, the train runs toward -z; Nagasaki's harbour lies ahead at z -560 .. -800
export const TRAIN_V = 17;
export const trainZ = (tau: number) => -TRAIN_V * tau; // z of the locomotive's nose
export const WIN_DZ = 25.1; // Yamaguchi's window (first carriage, +x side): z = trainZ + WIN_DZ
// street: Hiroshima street along z (x -4..4), shipyard beyond z -100, river across z 40..60
export const SHIP_AT: V3 = [-2, 0, -112];  // where Yamaguchi stands at the shipyard
export const CLOCK_AT: V3 = [-3.85, 0, -56]; // street clock pole
export const LOOK_AT: V3 = [0.4, 0, -60];   // where he stops and looks up
// camp: fire at the origin; targets at x 60 / 92
export const TARGETS: V3[] = [[77, 0, -17], [77, 0, 17]];
export const TARGET_R = 15;
// garden
export const BENCH: V3 = [0, 0, -2.5];
export const TUNNEL: V3 = [-28, 0, -12];
export const PODIUM: V3 = [30, 0, -10];

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
const tauOf = (id: number, f: number) => SHOTS[id - 1].tau(T(f));
/** push-in factor since f0 (subject grows ~rate per frame), punch raises it for n frames with 8 f soft edges */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// -- character paths (shared with cast.ts) --
/** shot 5: walking up the street toward the camera (from the shipyard, +z), stops at z -22 by f 418 */
export const walkHome = (f: number): V3 => [0.5, 0, -40 + 2.0 * Math.max(0, Math.min(T(f) - T(328), 3))];
/** shot 8: turns round and walks back toward the shipyard (-z) */
export const walkBack = (f: number): V3 => [0.6, 0, -34 - 1.3 * Math.max(0, T(f) - T(518))];
/** shot 25: camper's distance from the fire (m) */
export const camperDist = (f: number) => (f < 1846 ? 2.4 : f < 1896 ? 2.4 - 1.25 * smooth((f - 1846) / 12) : 1.15 + 2.6 * smooth((f - 1900) / 30));

// rail framings
/** carriage rocking for the inside shot: a slow roll and a small bounce on the rail joints */
const rock = (f: number, c: Shot): Shot => {
  const t = T(f);
  return { ...c, pos: [c.pos[0], c.pos[1] + 0.012 * Math.sin(t * 21.4) + 0.006 * Math.sin(t * 9.1), c.pos[2]] as V3, roll: (c.roll ?? 0) + 0.011 * Math.sin(t * 10.7) };
};
const R1a = (f: number) => { const z = trainZ(tauOf(1, f)) + WIN_DZ; return rock(f, dolly([-0.95, 2.0, z + 0.55], [1.0, 2.22, z], pushK(f, 0, 0.0028), { fov: 54 })); };
const R1b = (f: number) => { const z = trainZ(tauOf(1, f)) + WIN_DZ; return rock(f, dolly([-0.35, 2.12, z + 0.3], [1.0, 2.28, z], pushK(f, 38, 0.002, 0.006, 22), { fov: 46, roll: 0.03 })); };
/** pass-by: low lens beside the track, the locomotive thunders past, whip pan with it */
const R2a = (f: number) => { const z = trainZ(tauOf(2, f)); return { pos: [4.0, 0.85, -93] as V3, look: [0, 2.3, z + 6] as V3, fov: 56, roll: -0.03 }; };
/** crane up from behind the cab to reveal the valley and Nagasaki harbour ahead */
const crane = (f: number, nose: number, f0: number): Shot => {
  const k = glide((f - f0) / 44), u = clamp01((f - f0) / 46);
  return { pos: [-3.2 + 11.2 * k, 5.4 + 15.6 * k, nose + 12 + 28 * k] as V3, look: [0, 3.2 - 2.7 * k, nose - 60 - 50 * k] as V3, fov: 50 - 6 * k, roll: 0.04 * Math.sin(u * Math.PI) };
};
const R3a = (f: number) => crane(f, trainZ(tauOf(3, f)), 114);
/** golden tracking shot: the lens runs ahead-right of the locomotive and arcs to its side; poles whip past between */
const R15a = (f: number) => { const z = trainZ(tauOf(15, f)), k = glide((f - 915) / 76); return { pos: [9.5, 2.7, z - 12 + 6 * k] as V3, look: [0, 2.4, z + 6 + 8 * k] as V3, fov: 48, roll: 0.02 }; };
const R16a = (f: number) => crane(f - 991 + 114, trainZ(tauOf(16, f)), 114);
// street framings
/** low sweep along the tanker on the slip, from under the raked bow to amidships (sparks, crane plate overhead) */
const S4a = (f: number): Shot => {
  const k = glide((f - 160) / 62);
  return { pos: [40 - 26 * k, 1.1 + 0.4 * k, -113 + 4.5 * k] as V3, look: [31 - 29 * k, 9.5 - 2 * k, -127 + 1 * k] as V3, fov: 56, roll: -0.03 + 0.05 * k };
};
const S4b = (f: number) => dolly([-0.6, 0.7, -106.9], add(SHIP_AT, [0, 2.3, 0]), pushK(f, 223, 0.0022), { fov: 50 });
const S4c = (f: number) => dolly([4.5, 1.6, -105.8], add(SHIP_AT, [0.4, 2.6, -1]), pushK(f, 272, 0.0022), { fov: 46, roll: 0.03 });
const S5a = (f: number) => { const p = walkHome(f); return dolly([p[0] + 1.2, 1.7, p[2] + 6.4], [p[0], 1.45, p[2]], pushK(f, 328, 0.0012), { fov: 40 }); };
const S5b = (f: number) => { const p = walkHome(f); return dolly([p[0] - 0.9, 1.75, p[2] + 4.6], [p[0] + 0.5, 1.75, p[2]], pushK(f, 365, 0.0018), { fov: 40 }); };
const S6a = (f: number) => { const p = walkHome(Math.min(f, 418)); return dolly([p[0] + 0.5, 1.7, p[2] + 3.4], [p[0], 1.62, p[2]], pushK(f, 405, 0.0022), { fov: 38 }); };
const S6b = (f: number) => { const p = walkHome(418); return dolly([p[0] + 0.25, 1.68, p[2] + 2.1], [p[0], 1.72, p[2]], pushK(f, 438, 0.002, 0.007, 22), { fov: 36, roll: -0.04 }); };
const S8a = (f: number) => { const p = walkBack(f); return dolly([p[0] + 4.6, 1.6, p[2] + 1.4], [p[0], 1.35, p[2] - 0.3], pushK(f, 510, 0.0015), { fov: 40 }); };
const S9a = (f: number) => dolly(add(CLOCK_AT, [3.2, 2.6, 1.8]), add(CLOCK_AT, [0.25, 3.45, 0]), pushK(f, 565, 0.003, 0.007, 25), { fov: 34, roll: 0.03 });
const S10a = (f: number) => dolly(add(LOOK_AT, [0.7, 0.55, 3.3]), add(LOOK_AT, [0, 1.85, 0]), pushK(f, 599, 0.003), { fov: 40, roll: -0.04 });
const planeAt = (f: number) => -150 + 70 * (T(f) - T(624));
const S11a = (f: number) => zoom(add(LOOK_AT, [0, 1.55, 0.2]), [planeAt(f) * 0.75 - 10, 290, -200], 48, pushK(f, 624, 0.0016));
const S11b = (f: number) => zoom(add(LOOK_AT, [0, 1.55, 0.2]), [planeAt(f) * 0.75 - 30, 270, -200], 42, pushK(f, 645, 0.0016, 0.0045, 30));
// field framings (mushroom cloud far down -z)
const F12a = (f: number) => zoom([0.55, 1.15, 6.2], [0, 62, -420], 46, pushK(f, 754, 0.0016));
const F13a = (f: number) => dolly([0.6, 1.1, 3.3], [0, 0.85, 0], pushK(f, 794, 0.0022), { fov: 38 });
const F13b = (f: number) => dolly([1.2, 1.05, 2.2], [0.15, 0.95, 0], pushK(f, 833, 0.0022, 0.006, 25), { fov: 36, roll: 0.04 });
const F14a = (f: number) => dolly([4.3, 1.35, 3.6], [6.6, 0.95, -2.3], pushK(f, 872, 0.0018), { fov: 44 });
const F22a = (f: number) => zoom([0.5, 1.25, 6.4], [0, 62, -420], 46, pushK(f, 1418, 0.0016, 0.004, 30));
const F22b = (f: number) => dolly([0.3, 1.0, 1.95], [0, 0.88, 0], pushK(f, 1475, 0.0025), { fov: 36, roll: -0.03 });
// office framings (room x -7..7, z -5..5, windows on the back wall z = -5; Yamaguchi's desk at x -2.5, the boss at x 2.6)
export const DESK_INSERT: V3 = [-5.0, 0.78, 2.6];
const O7a = (f: number) => dolly(add(DESK_INSERT, [0.55, 0.62, 0.62]), add(DESK_INSERT, [0, 0.07, 0]), pushK(f, 467, 0.0025, 0.007, 22), { fov: 36, roll: 0.03 });
const O17a = (f: number) => dolly([-1.6, 1.6, 2.7], [-2.6, 1.45, -0.2], pushK(f, 1043, 0.0022, 0.005, 30), { fov: 38 });
const O17b = (f: number) => dolly([0.6, 2.1, 4.2], [-2.4, 1.15, -0.9], pushK(f, 1092, 0.0016), { fov: 46 });
const O18a = (f: number) => dolly([1.15, 1.65, 4.7], [1.8, 1.5, 0.2], pushK(f, 1157, 0.0018), { fov: 42 });
const O19a = (f: number) => dolly([2.05, 1.62, 1.35], [2.4, 1.62, -0.55], pushK(f, 1250, 0.0025, 0.006, 25), { fov: 36, roll: 0.04 });
const O20a = (f: number) => dolly([2.5, 1.6, 4.6], [1.75, 1.5, 0.2], pushK(f, 1291, 0.002), { fov: 42, roll: -0.03 });
const O21a = (f: number) => dolly([1.35, 1.45, 4.9], [1.75, 1.25, -1.5], pushK(f, 1340, 0.0025, 0.0065, 30), { fov: 48 });
const O30a = (f: number) => dolly(add(DESK_INSERT, [0.55, 0.62, 0.62]), add(DESK_INSERT, [0, 0.07, 0]), pushK(f, 2364, 0.0025, 0.007, 22), { fov: 36, roll: -0.03 });
// river (street zone, night): lanterns drift along +x
const S23a = (f: number) => ({ pos: [-14 + 0.04 * (f - 1526), 1.9, 34.5] as V3, look: [-6 + 0.04 * (f - 1526), 0.2, 48] as V3, fov: 42 });
const S23b = (f: number) => dolly([1.6, 1.65, 31.5], [0, 1.4, 36.2], pushK(f, 1607, 0.0018), { fov: 40 });
// camp framings
const C24a = (f: number) => { const k = glide((f - 1668) / 70); return { pos: [77 + 3 * k, 62 - 8 * k, 46 - 4 * k] as V3, look: [77, 0, 1] as V3, fov: 46 }; };
const C24b = (f: number) => dolly([TARGETS[1][0] + 3.5, 12, TARGETS[1][2] + 20], [TARGETS[1][0] + 2.2, 0.5, TARGETS[1][2] + 5.2], pushK(f, 1752, 0.003, 0.007, 30), { fov: 46, roll: 0.03 });
const C25a = (f: number) => dolly([3.6, 1.55, 4.6], [0, 0.8, -1.4], pushK(f, 1799, 0.0015), { fov: 42 });
const C25b = (f: number) => dolly([1.5, 1.2, 1.0], [0, 1.0, -1.15], pushK(f, 1846, 0.0022, 0.007, 30), { fov: 38, roll: -0.04 });
const C25c = (f: number) => dolly([4.2, 1.75, 5.2], [0, 0.85, -2.2], pushK(f, 1896, 0.0016), { fov: 44 });
const C26a = (f: number) => dolly([0.2, 10, 9.0], [0, 0, 3.2], pushK(f, 1960, 0.0016), { fov: 46 });
const C26b = (f: number) => dolly([0.2, 7.5, 10.2], [0, 0, 5.4], pushK(f, 2063, 0.002, 0.006, 26), { fov: 44, roll: 0.03 });
// garden framings
const G27a = (f: number) => dolly([0.5, 1.7, 2.2], [0, 1.68, -0.3], pushK(f, 2110, 0.002), { fov: 38 });
const G27b = (f: number) => dolly([-0.4, 1.7, 1.9], [0, 1.7, -0.3], pushK(f, 2166, 0.0025, 0.006, 25), { fov: 36, roll: 0.03 });
const G28a = (f: number) => dolly(add(TUNNEL, [3.2, 1.6, 6.5]), add(TUNNEL, [0, 1.4, 3.6]), pushK(f, 2215, 0.002), { fov: 40 });
const G28b = (f: number) => dolly(add(TUNNEL, [5.5, 2.6, 13]), add(TUNNEL, [0, 2.4, 1]), pushK(f, 2258, 0.0018), { fov: 44 });
export const AWARD: V3 = [12, 0, -6];
const G29a = (f: number) => dolly(add(AWARD, [0.4, 1.6, 4.6]), add(AWARD, [0, 1.45, 0]), pushK(f, 2296, 0.002, 0.005, 30), { fov: 40 });
const G31a = (f: number) => dolly(add(PODIUM, [1.4, 1.8, 7.5]), add(PODIUM, [0, 1.9, 0]), pushK(f, 2441, 0.0018), { fov: 42 });
const G31b = (f: number) => dolly(add(PODIUM, [0.6, 1.95, 3.2]), add(PODIUM, [0, 1.95, 0]), pushK(f, 2500, 0.0022, 0.0055, 30), { fov: 38, roll: -0.03 });
const G32a = (f: number) => dolly(add(BENCH, [0.9, 1.25, 3.4]), add(BENCH, [0, 1.15, 0]), pushK(f, 2549, 0.0018, 0.004, 30), { fov: 40 });
/** final crane up to the blossom and the sky */
const G32b = (f: number): Shot => {
  const a = G32a(2650), s = glide((f - 2650) / 65);
  return { pos: [a.pos[0] + 1.5 * s, a.pos[1] + 5.5 * s, a.pos[2] + 6 * s] as V3, look: [a.look[0], a.look[1] + 6.5 * s, a.look[2] - 1.5 * s] as V3, fov: 40 + 6 * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: R1a }, { f: 38, dur: 22, s: R1b }],
  2: [{ f: 60, s: R2a }],
  3: [{ f: 114, s: R3a }],
  4: [{ f: 160, s: S4a }, { f: 223, cut: true, s: S4b }, { f: 272, cut: true, s: S4c }],
  5: [{ f: 328, s: S5a }, { f: 362, dur: 26, s: S5b }],
  6: [{ f: 405, s: S6a }, { f: 436, cut: true, s: S6b }],
  7: [{ f: 467, s: O7a }],
  8: [{ f: 510, s: S8a }],
  9: [{ f: 565, s: S9a }],
  10: [{ f: 599, s: S10a }],
  11: [{ f: 624, s: S11a }, { f: 640, dur: 40, s: S11b }],
  12: [{ f: 754, s: F12a }],
  13: [{ f: 794, s: F13a }, { f: 833, cut: true, s: F13b }],
  14: [{ f: 872, s: F14a }],
  15: [{ f: 905, s: R15a }],
  16: [{ f: 986, s: R16a }],
  17: [{ f: 1043, s: O17a }, { f: 1092, cut: true, s: O17b }],
  18: [{ f: 1157, s: O18a }],
  19: [{ f: 1250, s: O19a }],
  20: [{ f: 1291, s: O20a }],
  21: [{ f: 1340, s: O21a }],
  22: [{ f: 1418, s: F22a }, { f: 1475, cut: true, s: F22b }],
  23: [{ f: 1520, s: S23a }, { f: 1607, cut: true, s: S23b }],
  24: [{ f: 1663, s: C24a }, { f: 1752, dur: 30, s: C24b }],
  25: [{ f: 1794, s: C25a }, { f: 1846, cut: true, s: C25b }, { f: 1896, cut: true, s: C25c }],
  26: [{ f: 1960, s: C26a }, { f: 2050, dur: 30, s: C26b }],
  27: [{ f: 2105, s: G27a }, { f: 2166, dur: 24, s: G27b }],
  28: [{ f: 2211, s: G28a }, { f: 2258, dur: 30, s: G28b }],
  29: [{ f: 2292, s: G29a }],
  30: [{ f: 2364, s: O30a }],
  31: [{ f: 2437, s: G31a }, { f: 2500, dur: 28, s: G31b }],
  32: [{ f: 2545, s: G32a }, { f: 2650, s: G32b }],
  33: [{ f: 0, s: (f) => zoom([8, 30, -296], [-40, 118, -1500], 50, pushK(f, 0, 0.0016)) }],
};

// impact kicks: image offset flips sign every frame, decays over 7 f
const KICKS: [number, number][] = [[103 / FPS, 0.9], [449 / FPS, 0.8], [496 / FPS, 0.7], [724 / FPS, 1.2], [1269 / FPS, 0.4], [1378 / FPS, 1.2], [1868 / FPS, 0.6], [2384 / FPS, 0.7]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
/** camera of a shot without the impact kicks (the v2 edit adds its kicks in output time) */
export const camBase = (id: number, f: number): Cam => run(CAMS[id], f);
export const applyKick = (c: Cam, a: number): Cam => {
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** kick amplitude at output frame o from a list of [frame, gain] (flips sign every frame, decays over 7 f) */
export const kickOut = (o: number, kicks: [number, number][]) => {
  let a = 0;
  for (const [o0, g] of kicks) { const n = Math.floor(o - o0 + 1e-6); if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5; }
  return a;
};
// ---- v2 edit: extra camera angles on the existing shots, by name (src frame f) ----
// office: Yamaguchi stands at (1.15, 0, 1.15) facing the boss (2.4, 0, -0.55); the windows are on the back wall (z -5)
export const CAM2: Record<string, { s: (f: number) => Shot; cInf?: number; focus?: (f: number) => V3 }> = {
  /** cold open: his bandaged face, the windows behind him starting to burn */
  coCU: { s: (f) => dolly([0.55, 1.62, 3.85], [1.3, 1.42, 1.15], pushK(f, 1330, 0.0032), { fov: 36, roll: 0.02 }), cInf: 12, focus: () => [1.15, 1.6, 1.15] },
  /** after the blast: low on the floor, he lies where it threw him */
  floor: { s: (f) => dolly([0.2, 2.35, 4.6], [1.5, 0.3, 1.2], pushK(f, 1390, 0.0028), { fov: 44, roll: -0.04 }), cInf: 8, focus: () => [1.4, 0.4, 1.25] },
  /** tells his boss: closer on him with the thought of the destroyed city beside him */
  tell: { s: (f) => dolly([0.4, 1.95, 3.6], [1.45, 1.75, 0.6], pushK(f, 1170, 0.0025), { fov: 40 }), cInf: 9, focus: () => [1.15, 1.6, 1.15] },
  /** the boss, unconvinced */
  doubt: { s: (f) => dolly([1.95, 1.62, 1.45], [2.4, 1.6, -0.55], pushK(f, 1250, 0.0028), { fov: 36, roll: -0.03 }), cInf: 13, focus: () => [2.4, 1.6, -0.55] },
  /** field CU: sitting, thinking of his wife and son */
  worry: { s: (f) => dolly([0.55, 1.12, 2.35], [0.22, 1.02, 0], pushK(f, 1470, 0.003), { fov: 38, roll: 0.03 }), cInf: 14, focus: () => [0, 0.9, 0] },
  /** lanterns: his face over the water */
  /** the end: pull back and up from the bench under the blossom to the evening sky */
  gardenEnd: { s: (f) => dolly([-2.0, 1.25, 5.2], [0.35, 2.3, -3.0], Math.exp(0.0024 * Math.max(0, f - 2600)), { fov: 46 }), cInf: 4, focus: () => [0, 1.1, -2.2] },
  lantCU: { s: (f) => dolly([0.9, 1.68, 33.4], [0, 1.6, 36.2], pushK(f, 1600, 0.0025), { fov: 36 }), cInf: 12, focus: () => [0, 1.6, 36.2] },
};
// ---- v3 angles for the first bomb (shots 10 / 11: the street, the plane at 300 m, the parachutes from f 636) ----
const nrm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** where the two parachutes are (their midpoint) at source frame f, else the plane */
const chutesAt = (f: number): V3 => {
  const u = Math.max(0, T(f) - T(636) - 0.125);
  return f < 636 ? [planeAt(f), 300, -200] : [planeAt(f) - 42 - 6 * u, 296 - 3.5 * u, -197];
};
/** low angle in front of him: his upturned face at the bottom of the frame, the bomber high in the sky above */
const lookUp = (f: number): Shot => {
  const head: V3 = add(LOOK_AT, [0, 1.62, 0]), k = pushK(f, 600, 0.0025);
  const c: V3 = add(LOOK_AT, [0.85 * k + 0.25, 0.45, 1.55 * k + 0.25]);
  const a = nrm([head[0] - c[0], head[1] - c[1], head[2] - c[2]]), p = chutesAt(f), b = nrm([p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
  const m = nrm([a[0] * 1.15 + b[0], a[1] * 1.15 + b[1], a[2] * 1.15 + b[2]]);
  return { pos: c, look: [c[0] + 10 * m[0], c[1] + 10 * m[1], c[2] + 10 * m[2]], fov: 66, roll: 0.05 };
};
/** a telephoto from his eyes: the two parachutes fill the frame, the lens creeping in */
const chuteTele = (f: number): Shot => zoom(add(LOOK_AT, [0, 1.55, 0.2]), chutesAt(f), 9.5, pushK(f, 640, 0.0022));
/** close on his face, eyes up, as the light grows */
const faceUp = (f: number): Shot => dolly(add(LOOK_AT, [0.42, 1.38, 2.25]), add(LOOK_AT, [0, 1.66, 0]), pushK(f, 625, 0.0035), { fov: 38, roll: -0.03 });
CAM2.lookUp = { s: lookUp, cInf: 0 };
CAM2.chutes = { s: chuteTele, cInf: 0 };
CAM2.faceUp = { s: faceUp, cInf: 13, focus: () => add(LOOK_AT, [0, 1.7, 0]) };
/** the old man on the bench, the years of silence: a slow push */
CAM2.benchSad = { s: (f) => dolly(add(BENCH, [0.6, 1.22, 2.7]), add(BENCH, [0, 1.12, 0]), pushK(f, 2470, 0.0024), { fov: 40, roll: 0.02 }), cInf: 11, focus: () => add(BENCH, [0, 1.15, 0.34]) };
export const camNamed = (name: string, f: number): Cam => full(CAM2[name].s(f));
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
/** cInf = blur-disc radius in px at 1080x1920 for things at infinity (0 = sharp); focus = world point, else the look point */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const yEyes = (p: V3, h = 1.62): V3 => [p[0], h, p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 9, focus: (f) => [1.0, 2.32, trainZ(tauOf(1, f)) + WIN_DZ] },
  { f: 60, cInf: 0 },
  { f: 160, cInf: 0 },
  { f: 223, cInf: 11, focus: () => yEyes(SHIP_AT) },
  { f: 328, cInf: 10, focus: (f) => yEyes(walkHome(f)) },
  { f: 405, cInf: 12, focus: (f) => yEyes(walkHome(Math.min(f, 418))) },
  { f: 467, cInf: 14 },
  { f: 510, cInf: 8, focus: (f) => yEyes(walkBack(f)) },
  { f: 565, cInf: 12 },
  { f: 599, cInf: 12, focus: () => yEyes(LOOK_AT) },
  { f: 624, cInf: 0 },
  { f: 794, cInf: 13, focus: () => [0, 0.95, 0] },
  { f: 877, cInf: 6 },
  { f: 915, cInf: 0 },
  { f: 1043, cInf: 12, focus: () => [-2.6, 1.55, -0.2] },
  { f: 1092, cInf: 6, focus: () => [-2.6, 1.3, -0.4] },
  { f: 1157, cInf: 8 },
  { f: 1250, cInf: 13, focus: () => [2.4, 1.62, -0.55] },
  { f: 1291, cInf: 8 },
  { f: 1423, cInf: 0 },
  { f: 1475, cInf: 14, focus: () => [0, 0.88, 0] },
  { f: 1526, cInf: 6, focus: (f) => [-6 + 0.04 * (f - 1526), 0.25, 44] },
  { f: 1607, cInf: 10, focus: () => [0, 1.6, 36.2] },
  { f: 1668, cInf: 0 },
  { f: 1799, cInf: 8, focus: (f) => [0, 0.95, -camperDist(f)] },
  { f: 1846, cInf: 13, focus: (f) => [0, 1.05, -camperDist(f)] },
  { f: 1896, cInf: 8, focus: (f) => [0, 0.95, -camperDist(f)] },
  { f: 1960, cInf: 0 },
  { f: 2110, cInf: 14, focus: () => [0, 1.68, -0.3] },
  { f: 2215, cInf: 10 },
  { f: 2296, cInf: 10 },
  { f: 2364, cInf: 14 },
  { f: 2441, cInf: 9, focus: () => add(PODIUM, [0, 1.9, 0]) },
  { f: 2549, cInf: 10, focus: () => add(BENCH, [0, 1.15, 0]) },
  { f: 2650, dur: 40, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
