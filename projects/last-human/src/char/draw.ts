// Hand-drawn 2D character, drawn procedurally with Canvas2D every frame.
// Character space: centimetres, x right, y up, origin on the ground between the feet. A tiny 3D rig (body x = the
// character's left, y up, z forward) is posed per frame and projected for a yaw `psi` (0 = facing the camera,
// 90 = profile facing screen-right, 180 = back). Silhouettes of the torso come from elliptical cross-sections, so any
// yaw works; heads and face details are hand-built for 5 key views (front, q3, side, q3back, back) like a 2D
// turnaround. Shading is two-tone cel shading (shape ∩ shape shifted toward the light) plus an optional rim light.
// Everything is deterministic: the same pose always draws the same picture.

export type Vec = [number, number];
export type V3 = [number, number, number];
export type HeadView = "front" | "q3" | "side" | "q3back" | "back";
export type Mouth = "neutral" | "tight" | "open" | "gasp" | "creep" | "part";

export type Face = {
  open: number;          // eye openness 0 (closed) .. 1 (normal) .. 1.35 (wide)
  look: Vec;             // iris offset, -1..1
  pupil: number;         // pupil scale (fear: 0.55)
  brow: number;          // brow raise (cm), + = up
  browIn: number;        // inner-end raise (cm), + = worried, - = angry
  mouth: Mouth;
  mouthOpen: number;     // 0..1
  shine: boolean;        // eye highlights (off = dead eyes)
};

export type Pose = {
  psi: number;           // body yaw (deg)
  headPsi?: number;      // head yaw (deg), default psi
  hip: V3;               // pelvis centre (cm, body space x/z offsets, y height)
  lean: number;          // torso pitch (deg, + forward)
  twist?: number;        // shoulder yaw relative to hips (deg)
  headTilt: number;      // head roll in screen (deg, + = toward facing side)
  headNod: number;       // head pitch (deg, + = down)
  armL: [number, number, number];   // shoulder forward swing, abduction, elbow bend (deg) — character's left arm
  armR: [number, number, number];
  legL: [number, number, number];   // hip forward swing, abduction, knee bend (deg)
  legR: [number, number, number];
  handL?: "open" | "fist" | "pocket" | "phone" | "hidden";
  handR?: "open" | "fist" | "pocket" | "phone" | "hidden";
  face: Face;
  breathe?: number;      // -1..1
  phoneGlow?: number;    // 0..1 phone screen brightness when holding a phone
};

export type Light = {
  key: string; keyK: number;     // key light colour and strength
  amb: string; ambK: number;     // shadow (ambient) colour and strength
  dir: number;                   // direction TOWARD the key light, screen degrees (0 = right, 90 = up)
  rim?: { color: string; k: number; dir: number; w: number };
  ink?: string;
  shade?: number;                // cel offset scale (default 1)
};

export const PAL = {
  skin: "#f0d2bd", lip: "#c98a80", hair: "#1c1e2e", hairHi: "#45507a",
  hood: "#b9532b", hoodIn: "#7d3019", string: "#ece4d6", jeans: "#2c3447", shoe: "#dcd8cf", sole: "#f4f1ea",
  sclera: "#f5f2ef", iris: "#c07a33", irisDk: "#5b2e14", pupil: "#120b10", ink: "#1a1222", bag: "#b78f9a",
};

// ---------------------------------------------------------------- colour
const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const enc = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255).toString(16).padStart(2, "0")).join("");
/** base albedo lit by the ambient (shadow) or ambient + key (lit) light, done in linear light */
function litPair(base: string, L: Light, dim = 1): [string, string] {
  const b = hex(base).map(lin), a = hex(L.amb).map(lin), k = hex(L.key).map(lin);
  const sh = b.map((v, i) => v * a[i] * L.ambK * dim);
  const li = b.map((v, i) => v * (a[i] * L.ambK + k[i] * L.keyK) * dim);
  return [toHex(sh), toHex(li)];
}
export const mixHex = (a: string, b: string, t: number) => {
  const x = hex(a).map(lin), y = hex(b).map(lin);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

// ---------------------------------------------------------------- geometry helpers
const D = Math.PI / 180;
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s];
const len = (a: Vec) => Math.hypot(a[0], a[1]);
const norm = (a: Vec): Vec => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const perp = (a: Vec): Vec => [-a[1], a[0]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const rot = (p: Vec, a: number): Vec => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

/** closed (or open) Catmull-Rom spline through points, as a Path2D */
export function smooth(pts: Vec[], closed = true, t = 0.5, path = new Path2D()): Path2D {
  const n = pts.length;
  const P = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  path.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1: Vec = [p1[0] + ((p2[0] - p0[0]) * t) / 3, p1[1] + ((p2[1] - p0[1]) * t) / 3];
    const c2: Vec = [p2[0] - ((p3[0] - p1[0]) * t) / 3, p2[1] - ((p3[1] - p1[1]) * t) / 3];
    path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}

/** tapered limb outline through a chain of points with widths (round caps) */
function limbPath(pts: Vec[], w: number[]): Path2D {
  const L: Vec[] = [], R: Vec[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const n = perp(norm(sub(b, a)));
    L.push(add(pts[i], mul(n, w[i] / 2)));
    R.push(add(pts[i], mul(n, -w[i] / 2)));
  }
  const d0 = norm(sub(pts[0], pts[1])), d1 = norm(sub(pts[pts.length - 1], pts[pts.length - 2]));
  const cap0 = add(pts[0], mul(d0, w[0] * 0.42)), cap1 = add(pts[pts.length - 1], mul(d1, w[w.length - 1] * 0.42));
  return smooth([cap0, ...L, cap1, ...R.reverse()], true, 0.55);
}

// ---------------------------------------------------------------- painter
type Ctx = CanvasRenderingContext2D;

class Painter {
  constructor(public c: Ctx, public L: Light, public lw: number) {}
  /** two-tone cel fill + rim + ink outline */
  part(p: Path2D, base: string, o: { dim?: number; shade?: number; noLine?: boolean; lw?: number; rim?: number; flat?: boolean } = {}) {
    const c = this.c, L = this.L;
    const [sh, li] = litPair(base, L, o.dim ?? 1);
    c.fillStyle = o.flat ? li : sh;
    c.fill(p);
    if (!o.flat) {
      const d = 2.4 * (o.shade ?? 1) * (L.shade ?? 1);
      c.save(); c.clip(p);
      c.translate(Math.cos(L.dir * D) * d, Math.sin(L.dir * D) * d);
      c.fillStyle = li; c.fill(p);
      c.restore();
    }
    if (L.rim && L.rim.k > 0 && (o.rim ?? 1) > 0) {
      const r = L.rim.w * (o.rim ?? 1);
      c.save(); c.clip(p);
      c.translate(-Math.cos(L.rim.dir * D) * r, -Math.sin(L.rim.dir * D) * r);
      const band = new Path2D(); band.rect(-500, -500, 1000, 1000); band.addPath(p);
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = Math.min(1, L.rim.k);
      c.fillStyle = L.rim.color; c.fill(band, "evenodd");
      c.restore();
    }
    if (!o.noLine) this.line(p, o.lw ?? 1);
  }
  line(p: Path2D, k = 1, color?: string) {
    const c = this.c;
    c.lineWidth = this.lw * k; c.lineJoin = "round"; c.lineCap = "round";
    c.strokeStyle = color ?? this.L.ink ?? PAL.ink; c.stroke(p);
    if (k >= 0.8) {
      // second, offset pass away from the light: a brush line that swells on the shadow side
      const o = this.lw * k * 0.45;
      c.save(); c.translate(-Math.cos(this.L.dir * D) * o, -Math.sin(this.L.dir * D) * o);
      c.lineWidth = this.lw * k * 0.85; c.stroke(p); c.restore();
    }
  }
  fill(p: Path2D, color: string, alpha = 1) { const c = this.c; c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.fill(p); c.restore(); }
  /** same colour lit like a part, without outline (for details) */
  litFill(p: Path2D, base: string, lit = true) { const [s, l] = litPair(base, this.L); this.fill(p, lit ? l : s); }
}

// ---------------------------------------------------------------- rig
const HIP_W = 8.5, SH_W = 15.5, THIGH = 42, SHIN = 42, ANKLE = 9, UPPER = 29, FORE = 26, NECK_Y = 141;

type Rig = {
  proj: (p: V3) => Vec; depth: (p: V3) => number;
  hipL: V3; hipR: V3; shL: V3; shR: V3; neck: V3; headBase: V3;
  knL: V3; knR: V3; anL: V3; anR: V3; elL: V3; elR: V3; wrL: V3; wrR: V3; footL: V3; footR: V3;
  spineRot: (p: V3) => V3;
};

function buildRig(P: Pose): Rig {
  const s = Math.sin(P.psi * D), co = Math.cos(P.psi * D);
  const proj = (p: V3): Vec => [p[0] * co + p[2] * s, p[1]];
  const depth = (p: V3) => p[0] * s + p[2] * co;
  const H = P.hip;
  const lean = P.lean * D, tw = (P.twist ?? 0) * D;
  // upper-body points are rotated about the pelvis: twist (yaw) then lean (pitch)
  const spineRot = (p: V3): V3 => {
    let x = p[0], y = p[1] - H[1], z = p[2];
    [x, z] = [x * Math.cos(tw) + z * Math.sin(tw), -x * Math.sin(tw) + z * Math.cos(tw)];
    [y, z] = [y * Math.cos(lean) - z * Math.sin(lean), y * Math.sin(lean) + z * Math.cos(lean)];
    return [x + H[0], y + H[1], z + H[2]];
  };
  const br = P.breathe ?? 0;
  const shY = H[1] + 44.5 + br * 0.4;
  const shL = spineRot([H[0] + SH_W, shY, H[2]]), shR = spineRot([H[0] - SH_W, shY, H[2]]);
  const neck = spineRot([H[0], H[1] + NECK_Y - 93 + br * 0.3, H[2] + 0.5]);
  const headBase = spineRot([H[0], H[1] + NECK_Y - 93 + 6, H[2] + 1.2]);
  const hipL: V3 = [H[0] + HIP_W, H[1] - 2, H[2]], hipR: V3 = [H[0] - HIP_W, H[1] - 2, H[2]];
  const leg = (hip: V3, a: [number, number, number], side: number) => {
    const sw = a[0] * D, ab = a[1] * D * side, kn = a[2] * D;
    const dir1: V3 = [Math.sin(ab), -Math.cos(sw) * Math.cos(ab), Math.sin(sw) * Math.cos(ab)];
    const knee: V3 = [hip[0] + dir1[0] * THIGH, hip[1] + dir1[1] * THIGH, hip[2] + dir1[2] * THIGH];
    const sw2 = sw - kn;
    const dir2: V3 = [Math.sin(ab) * 0.6, -Math.cos(sw2), Math.sin(sw2)];
    const ankle: V3 = [knee[0] + dir2[0] * SHIN, knee[1] + dir2[1] * SHIN, knee[2] + dir2[2] * SHIN];
    const foot: V3 = [ankle[0] + side * 1.5, ankle[1] - ANKLE * 0.55, ankle[2] + 9];
    return { knee, ankle, foot };
  };
  const arm = (sh: V3, a: [number, number, number], side: number) => {
    const sw = a[0] * D, ab = a[1] * D * side, el = a[2] * D;
    const d1 = spineDir([Math.sin(ab), -Math.cos(sw) * Math.cos(ab), Math.sin(sw) * Math.cos(ab)]);
    const elbow: V3 = [sh[0] + d1[0] * UPPER, sh[1] + d1[1] * UPPER, sh[2] + d1[2] * UPPER];
    const sw2 = sw + el;
    const d2 = spineDir([Math.sin(ab) * 0.7, -Math.cos(sw2), Math.sin(sw2)]);
    const wrist: V3 = [elbow[0] + d2[0] * FORE, elbow[1] + d2[1] * FORE, elbow[2] + d2[2] * FORE];
    return { elbow, wrist };
  };
  // arm directions follow the torso lean (a forward lean carries the arms with it)
  const spineDir = (v: V3): V3 => {
    let [x, y, z] = v;
    [x, z] = [x * Math.cos(tw) + z * Math.sin(tw), -x * Math.sin(tw) + z * Math.cos(tw)];
    [y, z] = [y * Math.cos(lean) - z * Math.sin(lean), y * Math.sin(lean) + z * Math.cos(lean)];
    return [x, y, z];
  };
  const lL = leg(hipL, P.legL, 1), lR = leg(hipR, P.legR, -1);
  const aL = arm(shL, P.armL, 1), aR = arm(shR, P.armR, -1);
  return {
    proj, depth, hipL, hipR, shL, shR, neck, headBase, spineRot,
    knL: lL.knee, knR: lR.knee, anL: lL.ankle, anR: lR.ankle, footL: lL.foot, footR: lR.foot,
    elL: aL.elbow, elR: aR.elbow, wrL: aL.wrist, wrR: aR.wrist,
  };
}

// ---------------------------------------------------------------- body parts
function drawLeg(pt: Painter, R: Rig, P: Pose, side: "L" | "R", dim: number) {
  const hip = side === "L" ? R.hipL : R.hipR, kn = side === "L" ? R.knL : R.knR, an = side === "L" ? R.anL : R.anR;
  const ft = side === "L" ? R.footL : R.footR;
  const h = R.proj(hip), k = R.proj(kn), a = R.proj(an);
  // shoe first (under the jeans hem)
  const s = Math.abs(Math.sin(P.psi * D)), dirx = Math.sign(Math.sin(P.psi * D)) || 1;
  const f = R.proj(ft);
  const along = norm(sub(f, a));
  const shoeLen = 12 + 16 * s, shoeH = 9.5;
  const heel = add(a, mul(along, -4 * s - 1));
  const toe = add(heel, mul(norm([along[0] * s + (1 - s) * 0.0001 * dirx, Math.min(along[1], -0.15)]), 0));
  const fx = s > 0.35 ? along[0] : 0;
  const base: Vec = [a[0] + fx * 3, a[1] - shoeH * 0.75];
  const tip: Vec = [base[0] + fx * shoeLen * 0.62, base[1]];
  const back: Vec = [base[0] - fx * shoeLen * 0.38 - (1 - s) * 6.2, base[1]];
  const front: Vec = [base[0] + fx * shoeLen * 0.62 + (1 - s) * 6.2, base[1]];
  void heel; void toe; void tip;
  const shoe = smooth([
    [back[0], back[1] - 1.2], [front[0], front[1] - 1.2], [front[0] + fx * 1.2, front[1] + 2.2],
    [lerp(back[0], front[0], 0.6), base[1] + shoeH * 0.78], [a[0], a[1] + 1.5], [back[0] - fx * 0.5, base[1] + shoeH * 0.6],
  ], true, 0.45);
  pt.part(shoe, PAL.shoe, { dim, shade: 0.6 });
  const sole = new Path2D();
  sole.moveTo(back[0], back[1] + 0.6); sole.lineTo(front[0], front[1] + 0.6);
  pt.line(sole, 0.6);
  // jeans
  const wide = 15 - 2 * s;
  const jeans = limbPath([h, k, a], [wide, 11.5, 10.5]);
  pt.part(jeans, PAL.jeans, { dim, shade: 1 });
  // knee crease when bent
  const bend = Math.abs((side === "L" ? P.legL : P.legR)[2]);
  if (bend > 15) {
    const n = perp(norm(sub(a, h)));
    const cr = new Path2D(); const c0 = add(k, mul(n, 2.5));
    cr.moveTo(c0[0], c0[1]); cr.quadraticCurveTo(k[0] + 1, k[1] - 1, ...add(k, mul(n, -2.5)) as [number, number]);
    pt.line(cr, 0.45);
  }
}

function drawArm(pt: Painter, R: Rig, P: Pose, side: "L" | "R", dim: number) {
  const sh = side === "L" ? R.shL : R.shR, el = side === "L" ? R.elL : R.elR, wr = side === "L" ? R.wrL : R.wrR;
  const hand = (side === "L" ? P.handL : P.handR) ?? "open";
  const s = R.proj(sh), e = R.proj(el), w = R.proj(wr);
  const dir = norm(sub(w, e));
  // hand (under the cuff)
  if (hand !== "pocket" && hand !== "hidden") {
    const hc = add(w, mul(dir, 4.2));
    const n = perp(dir);
    const fist = hand === "fist" || hand === "phone";
    const pts: Vec[] = fist
      ? [add(w, mul(n, 3)), add(hc, add(mul(n, 3.4), mul(dir, 1.5))), add(hc, mul(dir, 4)), add(hc, add(mul(n, -3.2), mul(dir, 1.2))), add(w, mul(n, -3))]
      : [add(w, mul(n, 3)), add(hc, add(mul(n, 3.2), mul(dir, 2.5))), add(hc, mul(dir, 5.6)), add(hc, add(mul(n, -2.8), mul(dir, 3.2))), add(hc, mul(n, -3.6)), add(w, mul(n, -3))];
    pt.part(smooth(pts, true, 0.5), PAL.skin, { dim, shade: 0.5 });
  }
  const sleeve = limbPath([add(s, mul(norm(sub(e, s)), 2.5)), e, w], [12.5, 10.5, 9.5]);
  pt.part(sleeve, PAL.hood, { dim });
  // cuff band
  const n = perp(dir), c0 = add(w, mul(dir, -3.2));
  const cuff = new Path2D(); const a0 = add(c0, mul(n, 5)), a1 = add(c0, mul(n, -5));
  cuff.moveTo(a0[0], a0[1]); cuff.lineTo(a1[0], a1[1]);
  pt.line(cuff, 0.5);
  if (hand === "pocket") { /* forearm disappears into the pocket: nothing more */ }
}

/** torso silhouette from elliptical cross-sections: [height above hip, half-width, half-depth, z offset] */
const TORSO: [number, number, number, number][] = [
  [51.5, 7.5, 6.5, -0.5],  // collar
  [48.5, 15.5, 10, -1],    // trapezius slope
  [43, 20.5, 12, -0.5],    // shoulders (sleeve heads sit inside this)
  [33, 20.5, 13.5, 0.8],   // chest
  [18, 19, 13.5, 1.6],     // belly (hoodie hangs loose)
  [6, 17.5, 12.5, 1.2],    // hem band top
  [1.5, 16.5, 12, 0.6],    // hem
];

function drawTorso(pt: Painter, R: Rig, P: Pose) {
  const s = Math.sin(P.psi * D), c = Math.cos(P.psi * D);
  const H = P.hip, br = P.breathe ?? 0;
  const left: Vec[] = [], right: Vec[] = [];
  for (const [dy, a, b, z] of TORSO) {
    const aa = a * (1 + br * 0.008), bb = b * (1 + br * 0.012);
    const ctr = R.spineRot([H[0], H[1] + dy, H[2] + z]);
    const half = Math.sqrt((aa * c) ** 2 + (bb * s) ** 2);
    const p = R.proj(ctr);
    left.push([p[0] - half, p[1]]); right.push([p[0] + half, p[1]]);
  }
  const outline = smooth([...left, ...right.reverse()], true, 0.5);
  pt.part(outline, PAL.hood, { shade: 1.2 });
  const view = viewOf(P.psi);
  const ctrAt = (dy: number, z: number) => R.proj(R.spineRot([H[0], H[1] + dy, H[2] + z]));
  // hem band line
  const hemL = left[5], hemR = right[right.length - 1 - 5];
  const hem = new Path2D(); hem.moveTo(hemL[0] + 0.5, hemL[1]); hem.quadraticCurveTo((hemL[0] + hemR[0]) / 2, hemL[1] - 0.8, hemR[0] - 0.5, hemR[1]);
  pt.line(hem, 0.5);
  if (view === "front" || view === "q3") {
    // kangaroo pocket
    const off = s * 13.5 * (view === "q3" ? 0.9 : 1);
    const pc = ctrAt(13, 13);
    const w0 = 11 * Math.abs(c) + 2, w1 = 14 * Math.abs(c) + 2;
    const pocket = new Path2D();
    pocket.moveTo(pc[0] - w0 + off * 0.0, pc[1] + 7); pocket.lineTo(pc[0] + w0, pc[1] + 7);
    pocket.lineTo(pc[0] + w1, pc[1] - 6); pocket.lineTo(pc[0] - w1, pc[1] - 6); pocket.closePath();
    pt.line(pocket, 0.5);
    const sh = new Path2D(); sh.moveTo(pc[0] - w1 + 1, pc[1] - 5.5); sh.lineTo(pc[0] + w1 - 1, pc[1] - 5.5); sh.lineTo(pc[0] + w1 - 2, pc[1] - 3.5); sh.lineTo(pc[0] - w1 + 2, pc[1] - 3.5);
    pt.litFill(sh, PAL.hoodIn, false);
    // drawstrings
    const col = ctrAt(50, 9);
    for (const k of [-1, 1]) {
      const x0 = col[0] + k * 3.2 * Math.abs(c) + s * 1.5;
      const str = new Path2D(); str.moveTo(x0, col[1] - 1); str.quadraticCurveTo(x0 + k * 0.6, col[1] - 9, x0 + k * 0.2 + s * 0.8, col[1] - 15);
      pt.c.save(); pt.c.lineWidth = 1.0; pt.c.strokeStyle = litPair(PAL.string, pt.L)[1]; pt.c.lineCap = "round"; pt.c.stroke(str); pt.c.restore();
    }
  }
}

function drawHood(pt: Painter, R: Rig, P: Pose, behind: boolean) {
  // bunched hood around the neck: behind the head in front views, a hanging cowl on the back in back views
  const view = viewOf(P.psi);
  const n = R.proj(R.neck);
  const s = Math.sin(P.psi * D);
  if (behind && (view === "front" || view === "q3" || view === "side")) {
    const off = -s * 6;
    const hood = smooth([[n[0] - 11 + off, n[1] - 4], [n[0] - 10.5 + off * 1.3, n[1] + 5], [n[0] + off * 1.5, n[1] + 8.5], [n[0] + 10.5 + off * 0.7, n[1] + 5], [n[0] + 11 + off * 0.4, n[1] - 4], [n[0], n[1] - 1.5]], true, 0.5);
    pt.part(hood, PAL.hood, { shade: 0.8 });
    const inner = smooth([[n[0] - 7 + off * 0.6, n[1] - 1.5], [n[0] + off * 0.8, n[1] + 5], [n[0] + 7 + off * 0.4, n[1] - 1.5], [n[0], n[1] - 3]], true, 0.5);
    pt.litFill(inner, PAL.hoodIn, false);
  }
  if (!behind && (view === "back" || view === "q3back")) {
    const off = s * 3;
    const hood = smooth([[n[0] - 12 + off, n[1] + 1], [n[0] + off, n[1] + 4], [n[0] + 12 + off, n[1] + 1], [n[0] + 9 + off, n[1] - 10], [n[0] + off, n[1] - 17], [n[0] - 9 + off, n[1] - 10]], true, 0.5);
    pt.part(hood, PAL.hood, { shade: 0.9 });
    const seam = new Path2D(); seam.moveTo(n[0] + off, n[1] + 3); seam.lineTo(n[0] + off, n[1] - 16);
    pt.line(seam, 0.45);
  }
}

const viewOf = (psi: number): HeadView => {
  const f = Math.abs(((psi % 360) + 540) % 360 - 180); // 0 = front .. 180 = back
  if (f < 22) return "front";
  if (f < 66) return "q3";
  if (f < 114) return "side";
  if (f < 158) return "q3back";
  return "back";
};

// ---------------------------------------------------------------- head
const HAIR_LOCKS: Record<HeadView, [Vec, Vec, Vec][]> = {
  // [root, control, tip] in head space (cm), drawn as curved spikes on top of the hair mass
  front: [
    [[-7.5, 6], [-9.6, 2.5], [-9.2, -2.8]], [[-6, 7.5], [-7.4, 3.5], [-6.6, 0.8]], [[-4, 8.6], [-4.6, 4.2], [-3.3, 1.4]],
    [[-1.5, 9], [-1.2, 5.5], [-0.6, 2.3]], [[1.2, 9], [2.0, 5.5], [2.6, 1.6]], [[3.6, 8.6], [5.0, 4.5], [5.0, 0.9]],
    [[6.0, 7.6], [7.9, 4.0], [7.6, -0.2]], [[7.6, 5.6], [9.7, 2.0], [9.3, -3.2]],
    [[-3, 12], [-6, 14.6], [-8.8, 14.2]], [[0, 12.6], [1.5, 15.5], [3.5, 16.2]], [[3, 12], [6.5, 13.8], [9.4, 12.2]],
    [[-6, 10], [-9.5, 11.5], [-11.2, 9.4]], [[6, 10], [9.8, 10.8], [11.3, 8.2]],
  ],
  q3: [
    [[-8.5, 5], [-10.4, 1.5], [-9.8, -3.6]], [[-6, 8], [-7.2, 4], [-6.4, -0.4]], [[-3, 9], [-2.5, 5], [-1.2, 1.6]],
    [[0, 9.2], [1.8, 5.5], [2.8, 1.8]], [[2.5, 8.8], [4.8, 5.0], [6.0, 1.4]], [[4.8, 7.8], [7.2, 4.4], [8.6, 0.8]],
    [[-4, 12.4], [-7, 14.5], [-10, 13.2]], [[-1, 12.8], [0.5, 15.8], [2.6, 16.4]], [[2, 12], [5.5, 14], [8.6, 12.8]],
    [[-8, 9], [-11.4, 9.6], [-12.4, 6.4]], [[-9, 2], [-11, -1], [-10.2, -4.8]],
  ],
  side: [
    [[1, 9], [4.5, 7], [7.6, 4.2]], [[3, 8.5], [6.8, 6.4], [8.6, 2.4]], [[-1, 10], [2, 9.5], [5.5, 7.4]], [[4.5, 7.5], [7.6, 5.4], [8.9, 1.6]],
    [[-3, 12.4], [-0.5, 15.5], [2.6, 15.8]], [[-6, 11.5], [-7, 14.5], [-10.2, 14.4]], [[-9, 8], [-12.4, 8.6], [-13.2, 5.4]],
    [[-9.5, 3], [-12.2, 1.6], [-12, -2.8]], [[-8.6, -2], [-10, -5.2], [-8.4, -7.6]], [[-2, 12.8], [1.5, 13.6], [4.6, 12.0]],
  ],
  q3back: [
    [[-2, 12], [-4, 15.2], [-7, 15.0]], [[1, 12.2], [3.5, 15], [6.4, 14.4]], [[4, 10], [8, 11], [10.4, 8.4]],
    [[-5, 10], [-8.8, 11], [-10.6, 8]], [[-7, 4], [-9.6, 1], [-8.6, -4.6]], [[-3, 3], [-4.2, -1.5], [-2.6, -6.4]],
    [[1, 3], [1.4, -1.5], [3.2, -6.0]], [[5, 4], [7.4, 0], [7.8, -4.4]],
  ],
  back: [
    [[-3, 12], [-5.6, 15], [-8.6, 14.6]], [[0, 12.5], [1.6, 15.6], [4, 16]], [[3, 12], [6.6, 13.8], [9.6, 12.2]],
    [[-6, 9], [-9.6, 10.4], [-11.2, 7.6]], [[6, 9], [9.8, 10], [11.2, 7]], [[-6, 3], [-8.6, -1], [-7.4, -5.4]],
    [[-2, 3], [-2.6, -2], [-1.4, -6.6]], [[2, 3], [2.8, -2], [1.6, -6.4]], [[6, 3], [8.6, -1], [7.6, -5.4]],
  ],
};

function lockPath(root: Vec, ctl: Vec, tip: Vec, w: number): Path2D {
  const d = norm(sub(tip, root)), n = perp(d);
  const r0 = add(root, mul(n, w)), r1 = add(root, mul(n, -w));
  const c0 = add(ctl, mul(n, w * 0.7)), c1 = add(ctl, mul(n, -w * 0.7));
  const p = new Path2D();
  p.moveTo(r0[0], r0[1]); p.quadraticCurveTo(c0[0], c0[1], tip[0], tip[1]); p.quadraticCurveTo(c1[0], c1[1], r1[0], r1[1]); p.closePath();
  return p;
}

function drawEye(pt: Painter, cx: number, cy: number, w: number, h: number, side: number, F: Face, squash = 1) {
  const c = pt.c;
  const op = F.open;
  const inner: Vec = [cx - side * w * 0.5, cy - 0.1 * h];
  const outer: Vec = [cx + side * w * 0.5, cy + 0.06 * h];
  if (op < 0.14) {
    // closed: one soft arc with a lash flick
    const p = new Path2D();
    p.moveTo(inner[0], inner[1]); p.quadraticCurveTo(cx, cy - h * 0.38, outer[0], outer[1]);
    pt.line(p, 0.95);
    const fl = new Path2D(); fl.moveTo(outer[0], outer[1]); fl.lineTo(outer[0] + side * 0.7, outer[1] - 0.5); pt.line(fl, 0.6);
    return;
  }
  const up = h * 0.62 * op, lo = h * 0.42 * Math.min(1, op + 0.2);
  const top: Vec = [cx + side * w * 0.08, cy + up], bot: Vec = [cx - side * w * 0.05, cy - lo];
  const sclera = new Path2D();
  sclera.moveTo(inner[0], inner[1]);
  sclera.bezierCurveTo(inner[0] + side * w * 0.1, top[1], outer[0] - side * w * 0.25, top[1] + 0.1, outer[0], outer[1]);
  sclera.bezierCurveTo(outer[0] - side * w * 0.2, bot[1], inner[0] + side * w * 0.2, bot[1], inner[0], inner[1]);
  pt.fill(sclera, litPair(PAL.sclera, pt.L)[1]);
  // iris + pupil, clipped to the eye
  c.save(); c.clip(sclera);
  const ir = h * 0.47 * squash, ix = cx + F.look[0] * w * 0.22, iy = cy + F.look[1] * h * 0.18 + 0.05;
  const iris = new Path2D(); iris.ellipse(ix, iy, ir * squash, ir, 0, 0, Math.PI * 2);
  const [, irisLit] = litPair(PAL.iris, pt.L);
  c.fillStyle = irisLit; c.fill(iris);
  c.lineWidth = ir * 0.22; c.strokeStyle = litPair(PAL.irisDk, pt.L)[1]; c.stroke(iris);
  const pr = ir * 0.42 * F.pupil;
  c.fillStyle = PAL.pupil; c.beginPath(); c.ellipse(ix, iy, pr * squash, pr, 0, 0, Math.PI * 2); c.fill();
  // lid shadow across the top of the eye
  c.fillStyle = "rgba(40,20,50,0.28)"; c.fillRect(cx - w, top[1] - h * 0.32, w * 2, h);
  if (F.shine) {
    c.fillStyle = "#ffffff";
    c.beginPath(); c.ellipse(ix - ir * 0.35 * side, iy + ir * 0.38, ir * 0.24, ir * 0.24, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(ix + ir * 0.3 * side, iy - ir * 0.32, ir * 0.1, ir * 0.1, 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  // upper lid line (thick) with a small lash flick, lower lid thin
  const ul = new Path2D();
  ul.moveTo(inner[0], inner[1]);
  ul.bezierCurveTo(inner[0] + side * w * 0.1, top[1], outer[0] - side * w * 0.25, top[1] + 0.1, outer[0], outer[1]);
  ul.lineTo(outer[0] + side * 0.75, outer[1] + 0.35);
  pt.line(ul, 1.25);
  const ll = new Path2D();
  ll.moveTo(outer[0] - side * w * 0.05, outer[1] - 0.15);
  ll.bezierCurveTo(outer[0] - side * w * 0.25, bot[1], inner[0] + side * w * 0.35, bot[1], inner[0] + side * w * 0.12, inner[1] - 0.35);
  pt.line(ll, 0.38);
  // tired under-eye line
  const bag = new Path2D();
  bag.moveTo(cx - side * w * 0.25, bot[1] - 0.75); bag.quadraticCurveTo(cx + side * w * 0.05, bot[1] - 1.25, cx + side * w * 0.38, bot[1] - 0.6);
  pt.line(bag, 0.3, mixHex(PAL.bag, "#000000", 0.2));
}

function drawBrow(pt: Painter, cx: number, cy: number, w: number, side: number, F: Face, k = 1) {
  const i: Vec = [cx - side * w * 0.48, cy + 2.6 + F.brow + F.browIn];
  const m: Vec = [cx + side * w * 0.05, cy + 3.25 + F.brow + F.browIn * 0.35];
  const o: Vec = [cx + side * w * 0.6, cy + 2.75 + F.brow - F.browIn * 0.1];
  const th = 0.85 * k;
  const p = new Path2D();
  p.moveTo(i[0], i[1] - th * 0.5);
  p.quadraticCurveTo(m[0], m[1] - th * 0.3, o[0], o[1]);
  p.quadraticCurveTo(m[0], m[1] + th * 0.9, i[0], i[1] + th * 0.55);
  p.closePath();
  pt.fill(p, litPair(PAL.hair, pt.L)[1]);
  pt.line(p, 0.35);
}

function drawMouth(pt: Painter, cx: number, cy: number, w: number, F: Face, side = 0) {
  const c = pt.c;
  const m = F.mouth, o = F.mouthOpen;
  const hw = w / 2;
  if (m === "creep") {
    // too-wide thin smile with a row of teeth
    const p = new Path2D();
    p.moveTo(cx - hw * 1.9, cy + 1.6);
    p.quadraticCurveTo(cx, cy - 2.6 - o * 1.2, cx + hw * 1.9, cy + 1.6);
    p.quadraticCurveTo(cx, cy - 1.0, cx - hw * 1.9, cy + 1.6);
    pt.fill(p, "#e9e4dc");
    c.save(); c.clip(p);
    c.lineWidth = 0.18; c.strokeStyle = "#3a2a33";
    for (let k = -6; k <= 6; k++) { c.beginPath(); c.moveTo(cx + k * hw * 0.28, cy + 2); c.lineTo(cx + k * hw * 0.28, cy - 3); c.stroke(); }
    c.restore();
    pt.line(p, 0.55);
    return;
  }
  if (m === "gasp" || m === "open") {
    const h = (m === "gasp" ? 1.6 : 0.9) * (0.4 + o);
    const p = new Path2D(); p.ellipse(cx + side * 0.3, cy - h * 0.3, hw * (m === "gasp" ? 0.62 : 0.8), h, 0, 0, Math.PI * 2);
    pt.fill(p, "#3a1622");
    const t = new Path2D(); t.rect(cx - hw, cy + h * 0.25, w, h); c.save(); c.clip(p); pt.fill(t, "#e8ddd6"); c.restore();
    pt.line(p, 0.6);
    return;
  }
  const p = new Path2D();
  const down = m === "tight" ? 0.55 : m === "part" ? 0.15 : 0.2;
  p.moveTo(cx - hw, cy - down);
  p.quadraticCurveTo(cx, cy + (m === "tight" ? 0.25 : 0.1), cx + hw, cy - down);
  pt.line(p, 0.7);
  if (m === "part") { const q = new Path2D(); q.moveTo(cx - hw * 0.4, cy - 0.5); q.quadraticCurveTo(cx, cy - 0.9, cx + hw * 0.4, cy - 0.5); pt.line(q, 0.4); }
  // lower lip hint
  const l = new Path2D(); l.moveTo(cx - hw * 0.35, cy - 1.3); l.quadraticCurveTo(cx, cy - 1.75, cx + hw * 0.35, cy - 1.3);
  pt.line(l, 0.3, mixHex(PAL.lip, "#000000", 0.25));
}

function drawHead(pt: Painter, view: HeadView, F: Face, flipFace: boolean) {
  const c = pt.c;
  const L = pt.L;
  // hair mass behind the head
  const back = view === "front" ? smooth([[-9.6, 1], [-10.4, 7], [-6.5, 12.5], [0, 13.8], [6.5, 12.5], [10.4, 7], [9.6, 1], [0, 4]], true, 0.5)
    : view === "q3" ? smooth([[-11, -2], [-11.6, 6], [-7, 12.6], [0, 13.4], [6.5, 11.6], [8.5, 6], [3, 4], [-6, 1]], true, 0.5)
    : view === "side" ? smooth([[-11.6, -4], [-12.4, 4], [-8, 12], [0, 13.4], [6.4, 11], [8.4, 6.4], [7.2, 4.2], [3, 5.5], [-2, 3], [-5, -1], [-8, -6]], true, 0.5)
    : smooth([[-10, -6], [-11.2, 4], [-7, 12.6], [0, 13.6], [7, 12.6], [11.2, 4], [10, -6], [0, -8.5]], true, 0.5);
  const [hairSh, hairLi] = litPair(PAL.hair, L);
  pt.part(back, PAL.hair, { shade: 0.7 });

  if (view === "back" || view === "q3back") {
    // ears + neck stub visible around the hair
    const ex = view === "back" ? 8.3 : 7.2;
    for (const k of view === "back" ? [-1, 1] : [1]) {
      const ear = smooth([[k * ex, -4], [k * (ex + 1.6), -2.5], [k * (ex + 1.8), 1.5], [k * (ex + 0.3), 1.2]], true, 0.5);
      pt.part(ear, PAL.skin, { shade: 0.4 });
    }
    if (view === "q3back") {
      const cheek = smooth([[6.5, -2], [8.3, -5], [6.6, -10], [4, -9]], true, 0.5);
      pt.part(cheek, PAL.skin, { shade: 0.4 });
    }
    hairLocks(pt, view, hairSh, hairLi);
    return;
  }

  // face
  const face = view === "front"
    ? smooth([[0, 9.5], [6.8, 7.6], [8.4, 2], [8.1, -2.8], [6.4, -8], [3.0, -12.3], [0, -13.3], [-3.0, -12.3], [-6.4, -8], [-8.1, -2.8], [-8.4, 2], [-6.8, 7.6]], true, 0.5)
    : view === "q3"
    ? smooth([[0, 9.5], [6.5, 7.8], [8.2, 2.6], [8.0, -0.5], [8.6, -3.6], [7.4, -5.2], [7.0, -8.4], [4.6, -12.2], [1.4, -13.2], [-3.0, -11.8], [-6.4, -7.6], [-7.8, -2], [-7.8, 4], [-5.5, 8.4]], true, 0.5)
    : smooth([[-1, 9.6], [5.2, 8], [7.3, 4], [7.7, 1.4], [7.3, 0.1], [9.5, -4.0], [7.8, -5.3], [8.0, -7.2], [7.5, -8.2], [7.7, -9.3], [7.1, -11.4], [4.2, -13.4], [0.6, -12.6], [-2.6, -9.5], [-5.5, -4], [-7, 3]], true, 0.45);
  // ears
  if (view === "front") {
    for (const k of [-1, 1]) pt.part(smooth([[k * 7.9, -4.5], [k * 9.6, -3.2], [k * 9.9, 0.8], [k * 8.2, 1.6]], true, 0.5), PAL.skin, { shade: 0.4 });
  }
  pt.part(face, PAL.skin, { shade: 0.6 });
  if (view === "q3") pt.part(smooth([[-6.2, -4.3], [-8.4, -3.4], [-8.7, 0.6], [-6.4, 1.4], [-5.2, -1.4]], true, 0.5), PAL.skin, { shade: 0.4 });
  if (view === "side") {
    const ear = smooth([[-2.8, -3.6], [-1.0, -3.2], [-0.5, -0.4], [-1.2, 1.0], [-3.0, 0.8], [-3.5, -1.4]], true, 0.5);
    pt.part(ear, PAL.skin, { shade: 0.4 });
    const ein = new Path2D(); ein.moveTo(-1.6, -2.4); ein.quadraticCurveTo(-1.1, -0.9, -2.1, 0.0); pt.line(ein, 0.35);
  }
  // features
  if (view === "front") {
    drawBrow(pt, -3.9, -1.0, 4.6, -1, F); drawBrow(pt, 3.9, -1.0, 4.6, 1, F);
    drawEye(pt, -3.9, -1.0, 4.6, 3.0, -1, F); drawEye(pt, 3.9, -1.0, 4.6, 3.0, 1, F);
    const nose = new Path2D(); nose.moveTo(0.5, -2.6); nose.quadraticCurveTo(1.3, -4.8, 0.2, -5.6); pt.line(nose, 0.45);
    const nst = new Path2D(); nst.moveTo(-1.3, -5.5); nst.quadraticCurveTo(-0.6, -6.0, 0.0, -5.7); pt.line(nst, 0.35);
    drawMouth(pt, 0, -8.6, 3.8, F);
  } else if (view === "q3") {
    drawBrow(pt, -1.6, -1.0, 4.4, -1, F); drawBrow(pt, 4.7, -1.0, 3.0, 1, F, 0.85);
    drawEye(pt, -1.6, -1.0, 4.4, 3.0, -1, F); drawEye(pt, 4.8, -1.0, 2.9, 2.9, 1, F, 0.78);
    const nose = new Path2D(); nose.moveTo(5.9, -2.4); nose.quadraticCurveTo(7.1, -4.0, 7.4, -5.0); nose.quadraticCurveTo(6.9, -5.5, 6.1, -5.4); pt.line(nose, 0.45);
    const nst = new Path2D(); nst.moveTo(4.6, -5.3); nst.quadraticCurveTo(5.1, -5.7, 5.6, -5.5); pt.line(nst, 0.32);
    drawMouth(pt, 3.4, -8.6, 3.2, F, 1);
  } else {
    drawBrow(pt, 5.6, -1.0, 2.4, 1, F, 0.9);
    // profile eye: a wedge open toward the front
    const op = F.open;
    if (op < 0.14) { const p = new Path2D(); p.moveTo(4.3, -1.2); p.quadraticCurveTo(5.3, -1.9, 6.4, -1.1); pt.line(p, 0.9); }
    else {
      const top = -1.0 + 1.5 * op, bot = -1.0 - 1.1 * Math.min(1, op);
      const eye = new Path2D(); eye.moveTo(4.2, -1.0); eye.quadraticCurveTo(5.4, top + 0.4, 6.5, top - 0.2); eye.lineTo(6.6, bot + 0.6); eye.quadraticCurveTo(5.4, bot, 4.2, -1.0);
      pt.fill(eye, litPair(PAL.sclera, L)[1]);
      c.save(); c.clip(eye);
      const ix = 5.9 + F.look[0] * 0.4;
      c.fillStyle = litPair(PAL.iris, L)[1]; c.beginPath(); c.ellipse(ix, -1.0 + F.look[1] * 0.3, 0.75, 1.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = PAL.pupil; c.beginPath(); c.ellipse(ix + 0.15, -1.0, 0.35 * F.pupil, 0.6 * F.pupil, 0, 0, Math.PI * 2); c.fill();
      if (F.shine) { c.fillStyle = "#fff"; c.beginPath(); c.arc(ix + 0.1, -0.5, 0.22, 0, Math.PI * 2); c.fill(); }
      c.restore();
      const ul = new Path2D(); ul.moveTo(4.2, -1.0); ul.quadraticCurveTo(5.4, top + 0.4, 6.5, top - 0.2); ul.lineTo(6.9, top - 0.6); pt.line(ul, 1.2);
    }
    const mo = F.mouth === "gasp" || F.mouth === "open";
    if (mo) { const p = new Path2D(); p.moveTo(7.7, -7.6); p.quadraticCurveTo(6.6, -8.3, 7.5, -9.2); pt.line(p, 0.6); }
    else { const p = new Path2D(); p.moveTo(7.8, -8.3); p.lineTo(6.4, -8.5); pt.line(p, 0.55); }
  }
  // hair cap over the crown (profile and three-quarter views), then fringe + spikes on top
  if (view === "side") {
    const cap = smooth([[-11, -3], [-11.9, 5], [-7, 12], [0, 13.3], [5.6, 11], [8.1, 7.4], [7.5, 5.0], [5.6, 6.6], [4.2, 4.4], [2.4, 6.2], [0.6, 3.6], [-1.6, 4.4], [-3.6, 2.4], [-4.6, -1.5], [-7, -4.5]], true, 0.4);
    pt.part(cap, PAL.hair, { shade: 0.7 });
  } else if (view === "q3") {
    const cap = smooth([[-9.4, -2], [-10.6, 5], [-6.6, 11.8], [0, 13], [6, 11.2], [8.2, 7.4], [6.4, 6.2], [4.6, 7.4], [2.2, 6.0], [-0.6, 7.2], [-3.4, 5.6], [-5.8, 6.4], [-7.6, 3.6], [-8.2, -1.6]], true, 0.4);
    pt.part(cap, PAL.hair, { shade: 0.7 });
  }
  hairLocks(pt, view, hairSh, hairLi);
  void flipFace;
}

function hairLocks(pt: Painter, view: HeadView, sh: string, li: string) {
  const locks = HAIR_LOCKS[view];
  const c = pt.c;
  for (const [r, k, t] of locks) {
    const p = lockPath(r, k, t, 1.9);
    c.fillStyle = sh; c.fill(p);
    c.save(); c.clip(p); c.translate(Math.cos(pt.L.dir * D) * 1.0, Math.sin(pt.L.dir * D) * 1.0); c.fillStyle = li; c.fill(p); c.restore();
    pt.line(p, 0.85);
  }
  // a few sheen strokes
  c.save(); c.globalAlpha = 0.55; c.strokeStyle = litPair(PAL.hairHi, pt.L)[1]; c.lineWidth = 0.45; c.lineCap = "round";
  const sheen: Vec[][] = view === "side" ? [[[-6, 10.6], [-2, 11.6]], [[-9.4, 6], [-8.4, 9]]] : view === "back" || view === "q3back" ? [[[-4, 10.5], [1, 11.8]], [[4, 9.5], [6.8, 7.6]]] : [[[-5.2, 10.2], [-1.6, 11.6]], [[2.4, 11.2], [5.6, 9.6]]];
  for (const [a, b] of sheen) { c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.8, b[0], b[1]); c.stroke(); }
  c.restore();
  void view;
}

// ---------------------------------------------------------------- public draw
export type Frame = { x0: number; y0: number; w: number; h: number };   // character-space rect mapped to the canvas

export function drawCharacter(ctx: Ctx, P: Pose, L: Light, F: Frame, opts: { lineK?: number; clear?: boolean; phoneLight?: boolean } = {}) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  if (opts.clear !== false) ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  // mirror for left-facing yaws (psi < 0): the drawing is built facing right
  const flip = Math.sin(P.psi * D) < -1e-3;
  const Pm: Pose = flip ? { ...P, psi: -P.psi, headPsi: P.headPsi !== undefined ? -P.headPsi : undefined, armL: P.armR, armR: P.armL, legL: P.legR, legR: P.legL, handL: P.handR, handR: P.handL } : P;
  const Lm: Light = flip ? { ...L, dir: 180 - L.dir, rim: L.rim ? { ...L.rim, dir: 180 - L.rim.dir } : undefined } : L;
  if (flip) { ctx.translate(2 * P.hip[0] * Math.cos(P.psi * D), 0); ctx.scale(-1, 1); }
  const pt = new Painter(ctx, Lm, 0.62 * (opts.lineK ?? 1));
  const R = buildRig(Pm);
  // depth-sorted limbs: far limbs before the torso, near ones after
  const s = Math.sin(Pm.psi * D), c = Math.cos(Pm.psi * D);
  const dL = s + 0.001 * c, dR = -s + 0.001 * c; // depth of the character's left / right side
  const back = (Pm.psi % 360 + 360) % 360 > 100 && (Pm.psi % 360 + 360) % 360 < 260;
  const items: { d: number; fn: () => void }[] = [
    { d: dL - 0.6, fn: () => drawLeg(pt, R, Pm, "L", dL < dR ? 0.86 : 1) },
    { d: dR - 0.6, fn: () => drawLeg(pt, R, Pm, "R", dR < dL ? 0.86 : 1) },
    { d: 0, fn: () => { drawHood(pt, R, Pm, true); drawTorso(pt, R, Pm); } },
    { d: dL * 1.2 + (back ? -0.2 : 0.2) + (Pm.handL === "pocket" || Pm.handL === "phone" ? 2 : 0), fn: () => drawArm(pt, R, Pm, "L", dL < dR ? 0.86 : 1) },
    { d: dR * 1.2 + (back ? -0.2 : 0.2) + (Pm.handR === "pocket" || Pm.handR === "phone" ? 2 : 0), fn: () => drawArm(pt, R, Pm, "R", dR < dL ? 0.86 : 1) },
  ];
  // arms behind the body when seen from behind/side far side
  for (const it of items) if (it.d < 0 && it.fn) it.d -= 0.5;
  items.sort((a, b) => a.d - b.d);
  const headPsi = Pm.headPsi ?? Pm.psi;
  const neckP = R.proj(R.neck), hb = R.proj(R.headBase);
  const drawNeckHead = () => {
    const neck = limbPath([[neckP[0], neckP[1] - 4], [hb[0], hb[1] + 2]], [8.4, 7.6]);
    pt.part(neck, PAL.skin, { shade: 0.5 });
    // head
    ctx.save();
    ctx.translate(hb[0] + Math.sin(headPsi * D) * 1.5, hb[1] + 13.6);
    ctx.scale(1.1, 1.1);
    ctx.rotate(-Pm.headTilt * D + (Pm.lean * D) * 0.15 * Math.sign(s || 1) * -1);
    const nod = Pm.headNod * D;
    ctx.scale(1, Math.cos(nod * 0.6));
    const hv = viewOf(headPsi);
    const hflip = Math.sin(headPsi * D) < -1e-3;
    if (hflip) ctx.scale(-1, 1);
    const save = pt.L;
    if (hflip) pt.L = { ...pt.L, dir: 180 - pt.L.dir, rim: pt.L.rim ? { ...pt.L.rim, dir: 180 - pt.L.rim.dir } : undefined };
    drawHead(pt, hv, Pm.face, hflip);
    pt.L = save;
    ctx.restore();
  };
  const order = back ? "headFirst" : "headLast";
  if (order === "headFirst") drawNeckHead();
  for (const it of items) {
    it.fn();
    if (it.d === 0 && back) drawHood(pt, R, Pm, false);
  }
  if (order === "headLast") drawNeckHead();
  else drawHood(pt, R, Pm, false);
  // phone in hands
  if (Pm.handL === "phone" || Pm.handR === "phone") {
    const w = Pm.handL === "phone" ? R.proj(R.wrL) : R.proj(R.wrR);
    const w2 = Pm.handR === "phone" ? R.proj(R.wrR) : w;
    const m = lerpV(w, w2, 0.5);
    const ph = new Path2D(); ph.roundRect(m[0] - 4 + s * 2, m[1] + 1, 8 * Math.max(0.35, Math.abs(c)) , 14, 1.2);
    pt.fill(ph, "#0d0d14"); pt.line(ph, 0.6);
    if ((Pm.phoneGlow ?? 0) > 0) {
      const sc = new Path2D(); sc.roundRect(m[0] - 3.3 + s * 2, m[1] + 1.8, 6.6 * Math.max(0.35, Math.abs(c)), 12.4, 0.8);
      pt.fill(sc, mixHex("#0d0d14", "#cfefff", Pm.phoneGlow ?? 0));
    }
  }
  ctx.restore();
}

/** Just a head (and a little neck) — the pillow close-up. */
export function drawHeadOnly(ctx: Ctx, view: HeadView, face: Face, L: Light, F: Frame, tilt = 0, lineK = 0.7) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  ctx.rotate(tilt * D);
  const pt = new Painter(ctx, L, 0.62 * lineK);
  const neck = limbPath([[0, -22], [0, -9]], [8.4, 7.6]);
  pt.part(neck, PAL.skin, { shade: 0.5 });
  drawHead(pt, view, face, false);
  ctx.restore();
}

/** The thing in the corner: a tall, thin silhouette with pale eyes and a long smile. */
export function drawWatcher(ctx: Ctx, F: Frame, o: { eyes: number; smile: number; rim: number; tilt: number; lean: number }) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  ctx.translate(0, 0);
  ctx.rotate(o.lean * D);
  const body = smooth([
    [-9, 0], [-10, 60], [-13, 120], [-21, 168], [-14, 182], [-6, 186], [-5, 196], [-11, 214], [-9, 236], [0, 243], [9, 236], [11, 214], [5, 196], [6, 186], [14, 182], [21, 168], [13, 120], [10, 60], [9, 0],
  ], true, 0.5);
  ctx.fillStyle = "#06050b"; ctx.fill(body);
  // arms hanging to the knees
  for (const k of [-1, 1]) {
    const arm = limbPath([[k * 20, 172], [k * 25, 120], [k * 23, 70], [k * 22, 52]], [8, 6.5, 5.5, 4]);
    ctx.fillStyle = "#06050b"; ctx.fill(arm);
    for (let f = 0; f < 4; f++) {
      const fi = limbPath([[k * (20 + f * 1.4), 54], [k * (19 + f * 2.2), 40], [k * (18 + f * 2.6), 30]], [1.6, 1.3, 0.8]);
      ctx.fill(fi);
    }
  }
  if (o.rim > 0) {
    ctx.save(); ctx.clip(body); ctx.translate(-2.2, 0);
    const band = new Path2D(); band.rect(-300, -300, 600, 600); band.addPath(body);
    ctx.globalAlpha = o.rim; ctx.fillStyle = "#4b3f8a"; ctx.fill(band, "evenodd"); ctx.restore();
  }
  // the head tilts about its own centre (not the feet), so the face stays on the head
  ctx.save(); ctx.translate(0, 222); ctx.rotate(o.tilt * D); ctx.translate(0, -222);
  // eyes: pale, no pupils
  if (o.eyes > 0.02) {
    for (const k of [-1, 1]) {
      const e = new Path2D();
      const cx = k * 4.4, cy = 224 + (k > 0 ? 0.5 : 0);
      e.ellipse(cx, cy, 2.6, 1.5 * o.eyes, k * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "#eef3ff"; ctx.fill(e);
    }
  }
  if (o.smile > 0.02) {
    const s = o.smile;
    const p = new Path2D();
    p.moveTo(-8 * s - 1, 214 + 2 * s); p.quadraticCurveTo(0, 207 - 3 * s, 8 * s + 1, 214 + 2 * s);
    p.quadraticCurveTo(0, 210 - 1.5 * s, -8 * s - 1, 214 + 2 * s);
    ctx.fillStyle = "#e9edf5"; ctx.fill(p);
    ctx.save(); ctx.clip(p); ctx.lineWidth = 0.25; ctx.strokeStyle = "#1a1626";
    for (let k = -10; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(k * 0.9, 205); ctx.lineTo(k * 0.9, 216); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- poses
export const FACE0: Face = { open: 1, look: [0, 0], pupil: 1, brow: 0, browIn: 0.3, mouth: "neutral", mouthOpen: 0, shine: true };

export function stand(psi: number, t = 0, face: Partial<Face> = {}): Pose {
  const br = Math.sin(t * 2 * Math.PI * 0.25);
  return {
    psi, hip: [0, 93 + br * 0.15, 0], lean: 2, headTilt: 0, headNod: 0,
    armL: [3, 6, 8], armR: [3, 6, 8], legL: [0, 3, 2], legR: [0, 3, 2], handL: "open", handR: "open",
    face: { ...FACE0, ...face }, breathe: br,
  };
}

/** walk cycle, phase in cycles (1 cycle = 2 steps) */
export function walk(psi: number, phase: number, face: Partial<Face> = {}, o: { pockets?: boolean; amp?: number } = {}): Pose {
  const a = 2 * Math.PI * phase, A = o.amp ?? 1;
  const thighL = 24 * Math.sin(a) * A, thighR = -24 * Math.sin(a) * A;
  const kneeOf = (ph: number) => 8 + 34 * Math.max(0, Math.sin(ph - 0.9)) * A;
  const bob = -2.6 * Math.abs(Math.cos(a)) * A;
  const arm = (ph: number) => (o.pockets ? [8, 8, 62] : [-20 * Math.sin(ph) * A, 7, 14 + 10 * Math.max(0, Math.sin(ph))]) as [number, number, number];
  return {
    psi, hip: [0, 93 + bob + 1.3, 0], lean: 5, headTilt: 1.2 * Math.sin(a), headNod: 2,
    armL: arm(a), armR: arm(a + Math.PI),
    legL: [thighL, 2, kneeOf(a + Math.PI)], legR: [thighR, 2, kneeOf(a)],
    handL: o.pockets ? "pocket" : "open", handR: o.pockets ? "pocket" : "open",
    face: { ...FACE0, ...face }, breathe: Math.sin(a),
  };
}
