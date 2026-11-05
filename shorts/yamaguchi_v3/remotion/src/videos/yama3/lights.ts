// Light presets per time of day. The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = sun straight ahead = backlight, +90 = screen right,
// 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
type C3 = [number, number, number];
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
};
export type LightName = "day" | "golden" | "night" | "blast" | "office" | "fire";
export const LIGHTS: Record<LightName, LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.5, 1.33], shade: [0.3, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 25, fogFar: 300, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 6, el: 7,
    lit: [1.5, 0.68, 0.24], shade: [0.15, 0.15, 0.3], lift: [0.04, 0.06, 0.17], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 50, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.5, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  // moonlit night: cool key, deep blue shade; faces stay readable (card tint is normalised in cardshade)
  night: {
    az: 60, el: 35,
    lit: [0.62, 0.7, 1.05], shade: [0.13, 0.15, 0.3], lift: [0.03, 0.045, 0.1], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [0.78, 0.84, 1.0], charShade: 0.84, charGrad: 0.09, bodyGrad: 0.22, sideTint: [0.8, 0.84, 1.0],
    blob: [0.6, 0.62, 0.8], actorShadow: false,
    top: "#0e1838", hor: "#33467a", skyCurve: [0.0, 0.5, 0.6], fog: "#28386a", fogNear: 18, fogFar: 170, sunDisc: "#000000",
    sunCol: "#c8d6ff", sunI: 1.6, sky: "#3a4f8a", ground: "#20253a", hemiI: 0.4,
    bias: -0.0004, normalBias: 0.02,
  },
  // campfire: warm key from the fire side, deep blue night shade
  fire: {
    az: -55, el: 22,
    lit: [0.15, 0.17, 0.32], shade: [0.11, 0.12, 0.26], lift: [0.03, 0.04, 0.1], lambert: 0.4, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.78, 0.58], charShade: 0.84, charGrad: 0.12, bodyGrad: 0.25, sideTint: [0.78, 0.8, 1.0],
    blob: [0.55, 0.5, 0.6], actorShadow: false,
    top: "#0e1838", hor: "#2c3d70", skyCurve: [0.0, 0.5, 0.6], fog: "#1f2c58", fogNear: 14, fogFar: 120, sunDisc: "#000000",
    sunCol: "#ffb36b", sunI: 2.0, sky: "#3a4f8a", ground: "#20253a", hemiI: 0.35,
    bias: -0.0004, normalBias: 0.02,
  },
  // after the flash: dusty orange-brown air, low backlight from the cloud side
  blast: {
    az: 10, el: 14,
    lit: [1.45, 0.98, 0.64], shade: [0.3, 0.23, 0.3], lift: [0.05, 0.04, 0.07], lambert: 0.35, sideK: 0.82, term: 0.12,
    charTint: [1.0, 0.84, 0.7], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.24, sideTint: [0.86, 0.8, 0.9],
    blob: [0.7, 0.62, 0.62], actorShadow: false,
    top: "#5d4458", hor: "#e7a36c", skyCurve: [0.05, 0.6, 1.0], fog: "#d4986b", fogNear: 40, fogFar: 700, sunDisc: "#000000",
    sunCol: "#ffb070", sunI: 3.0, sky: "#d8a080", ground: "#7a5a4a", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  // drafting office interior: soft daylight, gentle shade
  office: {
    az: 150, el: 35,
    lit: [1.5, 1.44, 1.32], shade: [0.46, 0.44, 0.52], lift: [0.05, 0.05, 0.08], lambert: 0.35, sideK: 0.86, term: 0.25,
    charTint: [1.0, 0.96, 0.92], charShade: 0.88, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.9, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 60, fogFar: 400, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.0004, normalBias: 0.012,
  },
};

/** world-only look per light (sky stops by elevation in degrees, river colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<LightName, WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.08,
  },
  golden: {
    // sunset, not dusk: #ffd08a horizon, peach/orange through ~10 deg, warm rose at 20, muted warm mauve only near the top
    // (the golden grade adds ~+11/255 blue to shadows/mids, so these lean warm)
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.1,
  },
  night: {
    sky: { c: ["#3a4c80", "#2c3d70", "#1f2e5c", "#16224a", "#0c1430"], e: [0, 4, 10, 20, 45] },
    water: { near: "#13254c", mid: "#1b3262", far: "#2c4170", crest: "#3d5a8f", trough: "#0b1733", glint: "#ffcf86", shade: [0.6, 0.62, 0.8] },
    cloud: { lit: "#56669a", mid: "#3c4a7a", shade: "#28345e" },
    bounce: [0, 0, 0], sat: 1.05,
  },
  fire: {
    sky: { c: ["#2c3d70", "#223463", "#1a2a56", "#131f45", "#0b1330"], e: [0, 4, 10, 20, 45] },
    water: { near: "#13254c", mid: "#1b3262", far: "#2c4170", crest: "#3d5a8f", trough: "#0b1733", glint: "#ffcf86", shade: [0.6, 0.62, 0.8] },
    cloud: { lit: "#56669a", mid: "#3c4a7a", shade: "#28345e" },
    bounce: [0.03, 0.015, 0], sat: 1.05,
  },
  blast: {
    sky: { c: ["#e7a36c", "#d88e64", "#b9786a", "#8a5f66", "#5d4458"], e: [0, 4, 10, 20, 45] },
    water: { near: "#6a5a6a", mid: "#7d6670", far: "#c99a7a", crest: "#d9a888", trough: "#4a3c4a", glint: "#ffe2b0", shade: [0.6, 0.55, 0.6] },
    cloud: { lit: "#f3c9a0", mid: "#c99682", shade: "#8a6a78" },
    bounce: [0.03, 0.015, 0], sat: 0.95,
  },
  office: {
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0.02, 0.015, 0.01], sat: 1.05,
  },
};
