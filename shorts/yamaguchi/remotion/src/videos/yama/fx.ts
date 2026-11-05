// 2D effect drawings for the Yamaguchi short (flat cards, our own designs): thought bubbles, parachute, mushroom
// cloud, campfire flames, steam, sweat, sound rings, heat-tile diagram, distance target, dashes, hanko seal,
// paper crane, petals, lantern glow, plane silhouette. Each draws into its own canvas size (noted per function).
import { Pen, INK, mix } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const ell = (cx: number, cy: number, rx: number, ry: number, n = 40): P2[] =>
  Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)] as P2);
/** union of circles as one puffy outline (sampled hull): used for clouds and bubbles */
const puff = (circles: [number, number, number][], n = 160): P2[] => {
  let cx = 0, cy = 0;
  for (const [x, y] of circles) { cx += x / circles.length; cy += y / circles.length; }
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let best = 0;
    for (const [x, y, r] of circles) { // farthest exit of the ray from (cx, cy) through each circle
      const ox = cx - x, oy = cy - y, b = ox * dx + oy * dy, c = ox * ox + oy * oy - r * r, d = b * b - c;
      if (d >= 0) best = Math.max(best, -b + Math.sqrt(d));
    }
    out.push([cx + dx * best, cy + dy * best]);
  }
  return out;
};

/** thought bubble on a 600 x 520 canvas; kind 0 = wife + baby, 1 = city + mushroom cloud */
export const fxThought = (p: Pen, kind: number) => {
  const body = puff([[300, 200, 150], [180, 230, 105], [420, 225, 110], [240, 120, 95], [370, 115, 100], [300, 290, 100]]);
  p.poly(body, "#ffffff", 10);
  p.ell(150, 410, 34, 28, "#ffffff", 9); p.ell(100, 470, 20, 17, "#ffffff", 8);
  if (kind === 0) {
    // wife (bun) and the baby, two little faces
    p.ell(255, 135, 26, 22, "#1d181c", 6);
    p.ell(255, 205, 62, 58, "#f8dcc0", 8);
    p.clip(ell(255, 205, 64, 60), () => p.ell(255, 160, 70, 34, "#1d181c", 0));
    p.arc(232, 210, 9, 6, 200, 340, 6); p.arc(278, 210, 9, 6, 200, 340, 6); p.arc(255, 236, 14, 8, 20, 160, 6, "#5a1e28");
    p.ell(370, 240, 52, 40, "#f2ece0", 8);
    p.ell(362, 232, 30, 28, "#ffe2c8", 6);
    p.arc(352, 232, 6, 4, 20, 160, 4); p.arc(372, 232, 6, 4, 20, 160, 4); p.ell(362, 246, 4, 4, "#5a1e28", 0);
    // a small heart
    const h: P2[] = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2; h.push([330 + 16 * Math.sin(t) ** 3 * 1.2, 120 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 1.2]); }
    p.poly(h, "#e2453c", 5);
  } else {
    // little city skyline + mushroom cloud above it
    for (const [x, w, h] of [[150, 46, 60], [196, 40, 86], [236, 52, 54], [288, 44, 96], [332, 50, 66], [382, 46, 80], [428, 40, 58]] as const)
      p.poly([[x, 300], [x + w, 300], [x + w, 300 - h], [x, 300 - h]], mix("#c9b28a", "#8f7e66", (x % 3) / 3), 5);
    p.poly([[285, 290], [315, 290], [312, 170], [288, 170]], "#d8b48a", 5);
    p.poly(puff([[300, 140, 46], [262, 150, 34], [338, 150, 34], [300, 110, 36]]), "#f1d4ac", 6);
    p.stroke([[130, 302], [470, 302]], 6);
  }
};

/** parachute with a dangling canister on a 300 x 420 canvas */
export const fxParachute = (p: Pen) => {
  const dome: P2[] = []; for (let i = 0; i <= 30; i++) { const a = Math.PI + (i / 30) * Math.PI; dome.push([150 + 120 * Math.cos(a), 120 + 90 * Math.sin(a)]); }
  const hem: P2[] = []; for (let i = 0; i <= 6; i++) hem.push([270 - i * 40, 120 + (i % 2 ? 14 : 0)]);
  p.poly([...dome, ...hem], "#f4efe2", 7);
  for (const x of [70, 110, 150, 190, 230]) p.stroke([[x, 118], [150 + (x - 150) * 0.15, 40 + 0.4 * Math.abs(x - 150)]], 3, "#c9c0ad");
  for (const x of [30, 70, 110, 150, 190, 230, 270]) p.stroke([[x, 124], [150, 330]], 3);
  p.poly([[128, 330], [172, 330], [168, 400], [132, 400]], "#5b5f68", 6);
};

/** mushroom cloud on a 1000 x 1300 canvas: rising stem + rolling cap; t = growth 0..1. Cartoon, no ground damage. */
export const fxMushroom = (p: Pen, t: number) => {
  const g = p.g, k = Math.min(1, t), base = 1240;
  const capY = base - (300 + 700 * k), capR = 160 + 260 * k;
  // stem: tapered column with rolling bulges
  const sw = 70 + 60 * k;
  const stem: P2[] = [[500 - sw * 1.6, base], [500 - sw, base - 120], [500 - sw * 0.75, capY + capR * 0.5], [500 + sw * 0.75, capY + capR * 0.5], [500 + sw, base - 120], [500 + sw * 1.6, base]];
  p.poly(stem, "#c9a07a", 9);
  g.save(); p.clip(stem, () => { for (let i = 0; i < 6; i++) p.ell(500 + (i % 2 ? 20 : -24), base - 120 - i * (base - capY) / 7, sw * 0.9, 26, "rgba(255,236,206,0.35)", 0); }); g.restore();
  // base skirt of dust
  p.poly(puff([[330, base - 20, 90], [450, base - 40, 110], [560, base - 36, 104], [680, base - 18, 92], [500, base + 10, 120]]), "#b48d6c", 9);
  // cap: three tiers of puffs, lit from upper left
  const cap: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) { const a = rad(200 + i * 17.5); cap.push([500 + capR * 0.95 * Math.cos(a), capY + capR * 0.55 * Math.sin(a) + capR * 0.15, capR * 0.42]); }
  cap.push([500, capY, capR * 0.75], [500, capY + capR * 0.32, capR * 0.6]);
  const cp = puff(cap);
  p.shadedFill(cp, "#fbe3bd", "#c8936f", rad(-130), capR, 0.4, 0.75, 1.15);
  p.clip(cp, () => {
    for (let i = 0; i < 5; i++) p.arc(500 - capR * 0.5 + i * capR * 0.25, capY + capR * 0.05, capR * 0.2, capR * 0.12, 20, 160, 7, "rgba(150,100,80,0.45)");
    p.ell(500, capY + capR * 0.55, capR * 0.9, capR * 0.18, "rgba(150,96,78,0.45)", 0);
  });
  p.poly(cp, null, 10);
};

/** campfire flames on a 400 x 520 canvas; t = time (s) for the flicker */
export const fxFire = (p: Pen, t: number) => {
  const tongue = (cx: number, w: number, h: number, ph: number, col: string, ol: number) => {
    const sway = 14 * Math.sin(t * 9 + ph), top: P2 = [cx + sway, 470 - h * (0.92 + 0.08 * Math.sin(t * 13 + ph * 2))];
    const pts: P2[] = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI * (i / 20); pts.push([cx + w * Math.cos(a), 470 + w * 0.45 * Math.sin(a)]); }
    p.poly([[cx - w, 470], [cx - w * 0.75, 470 - h * 0.45], top, [cx + w * 0.75, 470 - h * 0.45], ...pts.reverse().slice(0, 1), [cx + w, 470], ...pts], col, ol);
  };
  tongue(200, 120, 400, 0, "#e8452c", 8); tongue(140, 60, 250, 1.3, "#e8452c", 7); tongue(265, 64, 280, 2.1, "#e8452c", 7);
  tongue(200, 88, 300, 0.7, "#f58a2a", 0); tongue(165, 40, 170, 2.6, "#f58a2a", 0);
  tongue(205, 52, 190, 1.9, "#ffd24a", 0); tongue(200, 26, 110, 0.3, "#fff4c0", 0);
  for (let i = 0; i < 4; i++) { const u = ((t * 0.9 + i * 0.27) % 1), x = 200 + 60 * Math.sin(i * 2.3 + t * 3) * u; p.ell(x, 430 - 420 * u, 7 * (1 - u) + 2, 7 * (1 - u) + 2, "#ffcf5a", 0); }
};

/** steam / smoke curls on a 300 x 400 canvas; t 0..1 loop; col fill */
export const fxSteam = (p: Pen, t: number, col = "#ffffff") => {
  p.g.globalAlpha = 0.6;
  for (let i = 0; i < 3; i++) {
    const u = (t + i / 3) % 1, x = 150 + 50 * Math.sin(u * 7 + i * 2), y = 360 - 300 * u, r = 22 + 34 * u;
    p.ell(x, y, r, r * 0.85, col, 0);
  }
  p.g.globalAlpha = 1;
};

/** sweat drop on a 120 x 160 canvas */
export const fxSweat = (p: Pen) => p.poly([[60, 14], [96, 92], [92, 122], [60, 146], [28, 122], [24, 92]], "#9fd4ff", 7);

/** sound rings (burst eardrums / ringing) on a 300 x 300 canvas, t 0..1 */
export const fxRings = (p: Pen, t: number) => {
  for (let k = 0; k < 3; k++) {
    const u = (t + k / 3) % 1;
    p.arc(60, 150, 40 + 200 * u, 50 + 200 * u, -50, 50, Math.max(2, 14 * (1 - u)));
  }
};

/** inverse-square tiles on a 900 x 520 canvas: one tile at distance 1, 2 x 2 tiles at distance 2; hi = which tile of the
 *  four is lit (0..3, -1 none); sweep 0..1 = how far the rays have reached */
export const fxTiles = (p: Pen, sweep: number, hi: number) => {
  const sx = 70, cy = 260;
  // source
  p.ell(sx, cy, 34, 34, "#ffd24a", 7);
  // rays as a widening wedge
  const reach = 70 + 760 * sweep;
  p.poly([[sx, cy], [Math.min(reach, 830), cy - 0.3 * Math.min(reach - sx, 760)], [Math.min(reach, 830), cy + 0.3 * Math.min(reach - sx, 760)]], "rgba(255,190,80,0.35)", 0);
  for (const s of [-1, 1]) p.stroke([[sx, cy], [Math.min(reach, 830), cy + s * 0.3 * Math.min(reach - sx, 760)]], 6, "#e8452c");
  // tile 1 at d (x 380): full heat; tiles at 2d (x 690): same heat spread over 4
  if (reach > 380) { p.poly([[365, cy - 92], [395, cy - 92], [395, cy + 92], [365, cy + 92]], "#ff7a2a", 7); }
  if (reach > 690) for (let i = 0; i < 4; i++) {
    const y0 = cy - 184 + i * 92;
    p.poly([[675, y0], [705, y0], [705, y0 + 92], [675, y0 + 92]], i === hi ? "#ff9a4a" : "#ffd9a8", 7);
  }
};

/** distance target on a 1024 x 1024 canvas (flat on the ground): rings out from a bright centre */
export const fxTarget = (p: Pen) => {
  const cols = ["rgba(255,120,60,0.55)", "rgba(255,170,90,0.45)", "rgba(255,210,140,0.35)", "rgba(255,235,190,0.25)"];
  for (let i = 3; i >= 0; i--) p.ell(512, 512, 120 + i * 125, 120 + i * 125, cols[i], 0);
  for (let i = 0; i < 4; i++) p.ell(512, 512, 120 + i * 125, 120 + i * 125, null, 9);
  p.ell(512, 512, 60, 60, "#fff4c0", 9);
};

/** dashed line along x on a 1024 x 64 canvas */
export const fxDash = (p: Pen, col = "#fff4c0") => { for (let x = 16; x < 1000; x += 80) p.poly([[x, 18], [x + 48, 18], [x + 48, 46], [x, 46]], col, 6); };

/** red hanko seal (abstract strokes, not real characters) on a 256 x 256 canvas */
export const fxSeal = (p: Pen) => {
  const red = "#cf2e2a";
  p.g.lineCap = "round";
  p.arc(128, 128, 104, 104, 0, 360, 16, red);
  p.stroke([[80, 84], [176, 84]], 14, red); p.stroke([[128, 84], [128, 176]], 14, red);
  p.stroke([[86, 128], [112, 160]], 12, red); p.stroke([[170, 128], [146, 162]], 12, red); p.stroke([[84, 186], [172, 186]], 12, red);
};

/** origami paper crane on a 400 x 300 canvas */
export const fxCrane = (p: Pen, col = "#e2453c", flap = 0) => {
  const w = 110 * (1 - 0.6 * flap);
  p.poly([[200, 170], [200 - w - 40, 80 + 60 * flap], [180, 150]], mix(col, "#ffffff", 0.25), 6);
  p.poly([[60, 150], [200, 170], [330, 140], [250, 200], [150, 210]], col, 6);
  p.poly([[330, 140], [360, 70], [372, 74], [348, 150]], col, 5);
  p.poly([[60, 150], [30, 110], [100, 160]], col, 5);
  p.poly([[200, 170], [200 + w * 0.6 + 20, 70 + 70 * flap], [235, 160]], mix(col, "#000000", 0.15), 6);
};

/** cherry blossom petal on a 120 x 120 canvas */
export const fxPetal = (p: Pen) => p.poly([[60, 14], [96, 50], [80, 104], [60, 92], [40, 104], [24, 50]], "#f7b8c8", 5);

/** soft round glow (lantern halo / window bloom helper) on a 256 x 256 canvas */
export const fxGlow = (p: Pen, col = "#ffb04a") => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col + "aa"); gr.addColorStop(1, col + "00");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};

/** dust / smoke puff for the blast field on a 400 x 300 canvas, t 0..1 */
export const fxDust = (p: Pen, t: number, col = "#a88c74") => {
  p.g.globalAlpha = 0.32;
  for (let i = 0; i < 6; i++) {
    const a = rad(170 + i * 40), d = 30 + 110 * t, r = (60 + 20 * (i % 2)) * (1 - 0.5 * t);
    p.ell(200 + d * Math.cos(a), 200 + d * 0.4 * Math.sin(a) - 40 * t, r, r * 0.8, mix(col, "#ffffff", 0.15 * (i % 3)), 0);
  }
  p.g.globalAlpha = 1;
};

/** crowd silhouette head-and-shoulders on a 300 x 300 canvas (audience backs) */
export const fxBack = (p: Pen, col: string, hair: string) => {
  p.ell(150, 330, 130, 120, col, 8);
  p.ell(150, 140, 78, 82, hair, 8);
};
/** fist holding a stamp, sleeve from the top, on a 300 x 500 canvas (the stamp itself is 3D) */
export const fxHand = (p: Pen, sleeve: string, skin = "#f6d3b0") => {
  p.poly([[95, 0], [205, 0], [200, 250], [100, 250]], sleeve, 8);
  p.poly([[100, 236], [200, 236], [204, 262], [96, 262]], mix(sleeve, "#000000", 0.2), 7);
  p.ell(150, 320, 66, 72, skin, 8);
  for (let i = 0; i < 4; i++) p.arc(108 + i * 26, 362, 14, 10, 20, 160, 5);
  p.ell(204, 300, 22, 34, skin, 7, 0, 360, -20);
};
/** welding spark shower on a 300 x 400 canvas (source near the top), t = time (s) */
export const fxSparks = (p: Pen, t: number) => {
  const g = p.g;
  g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const ph = (t * 2.2 + i * 0.137) % 1, a = -Math.PI / 2 + (((i * 73) % 100) / 100 - 0.5) * 2.6;
    const v = 120 + ((i * 37) % 60), x = 150 + Math.cos(a) * v * ph, y = 60 + Math.sin(a) * v * ph + 330 * ph * ph;
    g.strokeStyle = ph < 0.35 ? "#fffbe0" : ph < 0.7 ? "#ffd25a" : "#ff8a2a"; g.lineWidth = 7 * (1 - ph) + 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * 14, y - Math.sin(a) * 14 - 10 * ph); g.stroke();
  }
  const gr = g.createRadialGradient(150, 60, 0, 150, 60, 60); gr.addColorStop(0, "rgba(255,255,240,1)"); gr.addColorStop(1, "rgba(255,220,120,0)");
  g.fillStyle = gr; g.fillRect(90, 0, 120, 120);
};
/** gull in flight on a 300 x 160 canvas, flap 0..1 */
export const fxGull = (p: Pen, flap: number) => {
  const up = 40 - 70 * flap;
  p.poly([[150, 90], [96, 90 - up * 0.6], [30, 60 - up], [80, 96 - up * 0.3], [150, 104], [220, 96 - up * 0.3], [270, 60 - up], [204, 90 - up * 0.6]], "#f4f1ea", 7);
  p.ell(150, 98, 18, 12, "#f4f1ea", 6);
  p.poly([[166, 96], [184, 100], [166, 103]], "#e8b030", 4);
};
export { INK };
