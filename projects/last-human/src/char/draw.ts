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
export type HandKind = "open" | "reach" | "palm" | "fist" | "pocket" | "phone" | "hidden";
export type Mouth = "neutral" | "tight" | "open" | "gasp" | "creep" | "part" | "smile";

export type Face = {
  open: number;          // eye openness 0 (closed) .. 1 (normal) .. 1.35 (wide)
  look: Vec;             // iris offset, -1..1
  pupil: number;         // pupil scale (fear: 0.55)
  brow: number;          // brow raise (cm), + = up
  browIn: number;        // inner-end raise (cm), + = worried, - = angry
  mouth: Mouth;
  mouthOpen: number;     // 0..1
  shine: boolean;        // eye highlights (off = dead eyes)
  tired?: number;        // 0..1: heavier under-eye lines, slightly lowered upper lids (days without sleep)
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
  handL?: HandKind;
  handR?: HandKind;
  footL?: number;        // foot pitch (deg, + = toe up, - = heel lifted)
  footR?: number;
  face: Face;
  breathe?: number;      // -1..1
  phoneGlow?: number;    // 0..1 phone screen brightness when holding a phone
  legsFront?: boolean;   // seated facing us: draw the legs in front of the body
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

/** tapered limb outline through a chain of points with widths (round caps; cap0/cap1 scale how far each end bulges) */
function limbPath(pts: Vec[], w: number[], cap0k = 0.42, cap1k = 0.42): Path2D {
  const L: Vec[] = [], R: Vec[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const n = perp(norm(sub(b, a)));
    L.push(add(pts[i], mul(n, w[i] / 2)));
    R.push(add(pts[i], mul(n, -w[i] / 2)));
  }
  const d0 = norm(sub(pts[0], pts[1])), d1 = norm(sub(pts[pts.length - 1], pts[pts.length - 2]));
  const cap0 = add(pts[0], mul(d0, w[0] * cap0k)), cap1 = add(pts[pts.length - 1], mul(d1, w[w.length - 1] * cap1k));
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
    const pitch = ((side > 0 ? P.footL : P.footR) ?? 0) * D;
    const foot: V3 = [0, Math.sin(pitch), Math.cos(pitch)];   // toe direction (unit), body space
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
  const fw = side === "L" ? R.footL : R.footR;
  const h = R.proj(hip), k = R.proj(kn), a = R.proj(an);
  // sneaker: a few points in foot space, projected, wrapped in a hull (reads from any yaw)
  const up: V3 = [0, fw[2], -fw[1]];
  const sx = side === "L" ? 1 : -1;
  const at = (f: number, u: number, l: number): V3 => [an[0] + fw[0] * f + up[0] * u + sx * l, an[1] + fw[1] * f + up[1] * u, an[2] + fw[2] * f + up[2] * u];
  const P3: V3[] = [at(-4.5, -8.6, 4.6), at(-4.5, -8.6, -4.6), at(19.5, -8.6, 4.8), at(19.5, -8.6, -4.6), at(21.5, -6.2, 0.5),
    at(18, -3.2, 4.2), at(18, -3.2, -4.0), at(-4.8, 0.5, 3.8), at(-4.8, 0.5, -3.8), at(3, 1.6, 4.2), at(3, 1.6, -4.2), at(-1, 2.2, 0)];
  const P2 = P3.map((q) => R.proj(q));
  const hull = convexHull(P2);
  const shoe = smooth(hull, true, 0.32);
  pt.part(shoe, PAL.shoe, { dim, shade: 0.6 });
  // sole band: the lowest 2.3 cm of the shoe in screen space, lighter
  const soleY = Math.min(...P2.map((q) => q[1]));
  pt.c.save(); pt.c.clip(shoe); pt.c.fillStyle = litPair(PAL.sole, pt.L, dim)[1]; pt.c.fillRect(-400, soleY - 1, 800, 3.3); pt.c.restore();
  const sl = new Path2D(); sl.moveTo(Math.min(...hull.map((q) => q[0])) + 0.8, soleY + 2.3); sl.lineTo(Math.max(...hull.map((q) => q[0])) - 0.8, soleY + 2.3);
  pt.c.save(); pt.c.clip(shoe); pt.line(sl, 0.4); pt.c.restore();
  // toe cap line (side views)
  const tc = R.proj(at(15, -3.6, 0)), tb = R.proj(at(15, -8.0, 0));
  if (Math.abs(tc[0] - tb[0]) + Math.abs(tc[1] - tb[1]) > 1) { const l = new Path2D(); l.moveTo(tc[0], tc[1]); l.quadraticCurveTo(tc[0] + (tc[0] - a[0]) * 0.08, (tc[1] + tb[1]) / 2, tb[0], tb[1] + 1.8); pt.c.save(); pt.c.clip(shoe); pt.line(l, 0.35); pt.c.restore(); }
  // jeans: thigh, knee, shin, slightly flared hem over the shoe
  const s = Math.abs(Math.sin(P.psi * D));
  const wide = 15.5 - 2.5 * s;
  const mid1 = lerpV(h, k, 0.5), mid2 = lerpV(k, a, 0.55);
  const jeans = limbPath([h, mid1, k, mid2, a], [wide, 13.2, 11.2, 10.6, 11.4]);
  pt.part(jeans, PAL.jeans, { dim, shade: 1 });
  // knee crease when bent, on the inside of the bend
  const bend = Math.abs((side === "L" ? P.legL : P.legR)[2]);
  if (bend > 12) {
    const d1 = norm(sub(k, h)), d2 = norm(sub(a, k));
    const cr = d1[0] * d2[1] - d1[1] * d2[0];
    const n = perp(norm(add(d1, d2))), sg = cr > 0 ? 1 : -1;
    const c0 = add(k, mul(n, sg * 3.6)), c1 = add(k, mul(n, sg * 1.2));
    const cl = new Path2D(); cl.moveTo(c0[0], c0[1]); cl.quadraticCurveTo(...(add(k, mul(n, sg * 2.6)) as [number, number]), c1[0] - d2[0] * 1.2, c1[1] - d2[1] * 1.2);
    pt.line(cl, 0.4);
  }
}

/** Andrew's monotone chain convex hull */
function convexHull(pts: Vec[]): Vec[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: Vec, a: Vec, b: Vec) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Vec[] = [], hi: Vec[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

function drawArm(pt: Painter, R: Rig, P: Pose, side: "L" | "R", dim: number) {
  const sh = side === "L" ? R.shL : R.shR, el = side === "L" ? R.elL : R.elR, wr = side === "L" ? R.wrL : R.wrR;
  const hand = (side === "L" ? P.handL : P.handR) ?? "open";
  const s = R.proj(sh), e = R.proj(el), w = R.proj(wr);
  const dir = norm(sub(w, e)), up = norm(sub(e, s));
  // which screen side the thumb is on: thumbs point forward and toward the body
  const t3: V3 = side === "L" ? [-0.45, 0, 0.9] : [0.45, 0, 0.9];
  const ps = Math.sin(P.psi * D), pc = Math.cos(P.psi * D);
  const tx = t3[0] * pc + t3[2] * ps;
  const thumb = (tx * perp(dir)[0] >= 0 ? 1 : -1) as 1 | -1;
  // a forearm pointing at (or away from) the lens is foreshortened: draw the hand end-on, not stretched along a guess
  const foreLen = len(sub(w, e)), endOn = foreLen < 9 && hand !== "phone" && hand !== "pocket" && hand !== "hidden";
  const towardLens = R.depth(wr) > R.depth(el);   // an end-on hand in front of its cuff is drawn last; one pointing away hides behind it
  if (hand !== "pocket" && hand !== "hidden" && !endOn) drawHandShape(pt, w, dir, thumb, hand, dim);
  // sleeve: the head starts a little down the arm with an almost flat top (it tucks under the shoulder slope instead of
  // bulging above it), upper arm, elbow, baggy forearm
  const upLen = len(sub(e, s));
  const head = add(s, mul(up, Math.min(3.2, upLen * 0.25)));
  const m1 = lerpV(s, e, 0.5), m2 = lerpV(e, w, 0.5);
  const sleeve = limbPath([head, m1, e, m2, add(w, mul(dir, -0.5))], [12.2, 11.4, 10.0, 10.4, 9.4], 0.16, 0.42);
  pt.part(sleeve, PAL.hood, { dim });
  // elbow: a crease on the inside of the bend
  const cr = up[0] * dir[1] - up[1] * dir[0];
  if (Math.abs(cr) > 0.35) {
    const n = perp(norm(add(up, dir))), sg = cr > 0 ? 1 : -1;
    const c0 = add(e, mul(n, sg * 3.4)), c1 = add(e, mul(n, sg * 0.8));
    const cl = new Path2D(); cl.moveTo(c0[0], c0[1]); cl.quadraticCurveTo(e[0] + dir[0] * 1.5 + n[0] * sg * 2, e[1] + dir[1] * 1.5 + n[1] * sg * 2, c1[0] + dir[0] * 2, c1[1] + dir[1] * 2);
    pt.line(cl, 0.42);
  }
  // ribbed cuff
  const nn = perp(dir);
  const seam = new Path2D(); const s0 = add(w, add(mul(dir, -3.2), mul(nn, 4.9))), s1 = add(w, add(mul(dir, -3.2), mul(nn, -4.9)));
  seam.moveTo(s0[0], s0[1]); seam.quadraticCurveTo(...(add(w, mul(dir, -2.6)) as [number, number]), s1[0], s1[1]); pt.line(seam, 0.4);
  for (const k of [-2.6, -0.9, 0.9, 2.6]) { const l = new Path2D(); const c = add(w, add(mul(dir, -1.5), mul(nn, k))); l.moveTo(...(add(c, mul(dir, -1.2)) as [number, number])); l.lineTo(...(add(c, mul(dir, 0.9)) as [number, number])); pt.line(l, 0.18); }
  if (endOn && towardLens) drawHandEndOn(pt, w, dim);
}

/** a hand seen along the forearm (pointing at or away from the lens): a rounded knuckle block with finger creases */
function drawHandEndOn(pt: Painter, w: Vec, dim: number) {
  const sk = { dim, shade: 0.45, lw: 0.8, rim: 0.3 };
  const blk = smooth([[w[0] - 4.2, w[1] + 0.6], [w[0] - 3.6, w[1] + 3.4], [w[0], w[1] + 4.0], [w[0] + 3.6, w[1] + 3.2], [w[0] + 4.3, w[1] + 0.2], [w[0] + 3.2, w[1] - 3.0], [w[0] - 0.4, w[1] - 3.5], [w[0] - 3.6, w[1] - 2.4]], true, 0.5);
  pt.part(blk, PAL.skin, sk);
  for (const x of [-1.8, 0.1, 2.0]) { const l = new Path2D(); l.moveTo(w[0] + x, w[1] - 2.8); l.lineTo(w[0] + x * 1.05, w[1] - 0.6); pt.line(l, 0.25); }
}

/** A hand at wrist w, pointing along dir, thumb on side `th` of perp(dir). Proportions in cm (palm 8, fingers 5.6-7.6). */
function drawHandShape(pt: Painter, w: Vec, dir: Vec, th: 1 | -1, kind: HandKind, dim: number) {
  const n = mul(perp(dir), th);
  const P = (u: number, v: number): Vec => add(w, add(mul(dir, u), mul(n, v)));
  const sk = { dim, shade: 0.45, lw: 0.8, rim: 0.3 };
  if (kind === "phone") return;   // drawn with the phone (palms on its sides, fingers round its back)
  if (kind === "fist") {
    // closed hand: palm block, knuckle row, thumb wrapped across
    const palm = smooth([P(-0.5, 2.9), P(4, 3.7), P(8.3, 3.2), P(9.4, 0.9), P(9.1, -2.4), P(7.4, -3.4), P(3, -3.1), P(-0.5, -2.7)], true, 0.5);
    pt.part(palm, PAL.skin, sk);
    for (const v of [1.6, -0.1, -1.8]) { const l = new Path2D(); const q0 = P(8.7, v), q1 = P(6.6, v - 0.3); l.moveTo(q0[0], q0[1]); l.lineTo(q1[0], q1[1]); pt.line(l, 0.3); }
    pt.part(limbPath([P(2.2, 3.0), P(5.6, 3.6), P(8.0, 1.8)], [2.6, 2.3, 2.0]), PAL.skin, sk);
    return;
  }
  if (kind === "open") {
    const palm = smooth([P(-0.6, 2.8), P(3.4, 3.9), P(7.9, 3.6), P(8.6, 0.3), P(8.0, -3.0), P(4, -3.4), P(-0.6, -2.7)], true, 0.5);
    pt.part(palm, PAL.skin, sk);
    const d1 = rot(dir, -0.28 * th);
    const grp = smooth([P(7.4, 3.5), add(P(11.2, 3.3), mul(d1, 0.6)), add(P(13.4, 1.6), mul(d1, 1.3)), add(P(13.6, -0.9), mul(d1, 1.0)), add(P(12.0, -3.0), mul(d1, 0.3)), P(7.6, -3.1)], true, 0.5);
    pt.part(grp, PAL.skin, sk);
    for (const v of [1.8, 0.0, -1.7]) { const l = new Path2D(); const q0 = P(8.4, v), q1 = add(P(11.4, v * 0.9), mul(d1, 0.8)); l.moveTo(q0[0], q0[1]); l.lineTo(q1[0], q1[1]); pt.line(l, 0.26); }
    pt.part(limbPath([P(2.4, 2.9), P(5.2, 4.1), P(7.4, 4.4)], [2.5, 2.1, 1.8]), PAL.skin, sk);
    return;
  }
  const spread = kind === "reach" ? 1 : kind === "palm" ? 0.35 : 0.12;
  const curl = kind === "palm" ? 0.0 : 0.08;
  const len = 1;
  // palm (with the thumb's fleshy base)
  const palm = smooth([P(-0.6, 2.8), P(3.4, 3.9), P(7.9, 3.5), P(8.4, 0.4), P(8.0, -3.0), P(4, -3.4), P(-0.6, -2.7)], true, 0.5);
  pt.part(palm, PAL.skin, sk);
  // fingers: index (thumb side) to pinky; two segments, the last one curls toward the palm
  const F: [number, number, number][] = [[2.55, 6.9, 1.8], [0.85, 7.5, 1.85], [-0.85, 7.0, 1.75], [-2.45, 5.6, 1.55]];
  F.forEach(([v, L, wd], i) => {
    const ang = (1.5 - i) * 0.09 * spread;
    const d0: Vec = rot(dir, ang * th);
    const base = P(7.6, v);
    const m: Vec = add(base, mul(d0, L * 0.55 * len));
    const d1: Vec = rot(d0, -curl * th);
    const tip: Vec = add(m, mul(d1, L * 0.45 * len));
    pt.part(limbPath([base, m, tip], [wd, wd * 0.95, wd * 0.82]), PAL.skin, sk);
  });
  // thumb
  const ta = kind === "reach" ? 0.75 : kind === "palm" ? 0.42 : 0.3;
  const t0 = P(2.4, 2.9), td = rot(dir, ta * th);
  const t1 = add(t0, mul(td, 3.2)), t2 = add(t1, mul(rot(td, -0.25 * th), 2.6));
  pt.part(limbPath([t0, t1, t2], [2.5, 2.1, 1.8]), PAL.skin, sk);
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
  const up = h * 0.62 * op * (1 - 0.12 * (F.tired ?? 0)), lo = h * 0.42 * Math.min(1, op + 0.2);
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
  pt.line(bag, 0.3 + 0.35 * (F.tired ?? 0), mixHex(PAL.bag, "#000000", 0.2 + 0.25 * (F.tired ?? 0)));
  if ((F.tired ?? 0) > 0.3) {
    const b2 = new Path2D();
    b2.moveTo(cx - side * w * 0.1, bot[1] - 1.55); b2.quadraticCurveTo(cx + side * w * 0.1, bot[1] - 1.9, cx + side * w * 0.32, bot[1] - 1.35);
    pt.line(b2, 0.22, mixHex(PAL.bag, "#000000", 0.35));
  }
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

/** the nose: a soft bridge line, a rounded tip and a hint of nostrils; small, centred, identical in every shot */
function drawNose(pt: Painter, view: "front" | "q3") {
  const c = pt.c;
  if (view === "front") {
    c.save(); c.globalAlpha = 0.2; c.fillStyle = litPair(PAL.skin, pt.L)[0];
    c.beginPath(); c.ellipse(0.35, -6.0, 1.1, 0.3, 0, 0, Math.PI * 2); c.fill(); c.restore();
    const br = new Path2D(); br.moveTo(0.45, -2.9); br.quadraticCurveTo(0.95, -4.1, 0.95, -5.05); pt.line(br, 0.36);
    const tip = new Path2D(); tip.moveTo(1.05, -5.05); tip.bezierCurveTo(1.25, -5.75, 0.3, -5.95, -0.15, -5.75); tip.moveTo(-0.55, -5.5); tip.quadraticCurveTo(-0.95, -5.6, -1.05, -5.25);
    pt.line(tip, 0.42);
    return;
  }
  c.save(); c.globalAlpha = 0.2; c.fillStyle = litPair(PAL.skin, pt.L)[0];
  c.beginPath(); c.ellipse(3.0, -6.0, 1.0, 0.28, -0.1, 0, Math.PI * 2); c.fill(); c.restore();
  const br = new Path2D(); br.moveTo(1.9, -2.6); br.quadraticCurveTo(3.3, -3.7, 4.05, -4.9); pt.line(br, 0.36);
  const tip = new Path2D(); tip.moveTo(4.1, -4.95); tip.bezierCurveTo(4.45, -5.55, 3.65, -5.9, 3.1, -5.65); tip.moveTo(2.55, -5.45); tip.quadraticCurveTo(2.2, -5.55, 2.1, -5.25);
  pt.line(tip, 0.42);
}

function drawMouth(pt: Painter, cx: number, cy: number, w: number, F: Face, side = 0) {
  const c = pt.c;
  const m = F.mouth, o = F.mouthOpen;
  const hw = w / 2;
  if (m === "smile") {
    // his own mouth, curved into a calm, closed smile; o = how far it has spread (0..1)
    const k = Math.max(0, Math.min(1, o));
    const ww = hw * (1 + 0.25 * k), lift = 0.25 + 1.0 * k;
    const p = new Path2D();
    p.moveTo(cx - ww, cy + lift * 0.6); p.quadraticCurveTo(cx, cy - 0.55 - lift * 0.35, cx + ww, cy + lift * 0.6);
    pt.line(p, 0.75);
    for (const sgn of [-1, 1]) { const d = new Path2D(); d.moveTo(cx + sgn * ww * 1.02, cy + lift * 0.6 + 0.35); d.quadraticCurveTo(cx + sgn * ww * 1.12, cy + lift * 0.6, cx + sgn * ww * 1.05, cy + lift * 0.6 - 0.35); pt.line(d, 0.35 * k); }
    const l = new Path2D(); l.moveTo(cx - hw * 0.35, cy - 1.35 - 0.2 * k); l.quadraticCurveTo(cx, cy - 1.8 - 0.25 * k, cx + hw * 0.35, cy - 1.35 - 0.2 * k);
    pt.line(l, 0.3, mixHex(PAL.lip, "#000000", 0.25));
    return;
  }
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
    ? smooth([[0, 9.5], [6.5, 7.8], [8.2, 2.6], [8.3, -1.4], [7.95, -4.8], [7.0, -8.4], [4.6, -12.2], [1.4, -13.2], [-3.0, -11.8], [-6.4, -7.6], [-7.8, -2], [-7.8, 4], [-5.5, 8.4]], true, 0.5)
    : smooth([[-1, 9.6], [5.2, 8], [7.3, 4], [7.7, 1.4], [7.3, 0.1], [9.5, -4.0], [7.8, -5.3], [8.0, -7.2], [7.5, -8.2], [7.7, -9.3], [7.1, -11.4], [4.2, -13.4], [0.6, -12.6], [-2.6, -9.5], [-5.5, -4], [-7, 3]], true, 0.45);
  // ears
  if (view === "front") {
    for (const k of [-1, 1]) pt.part(smooth([[k * 7.9, -4.5], [k * 9.6, -3.2], [k * 9.9, 0.8], [k * 8.2, 1.6]], true, 0.5), PAL.skin, { shade: 0.4 });
  }
  pt.part(face, PAL.skin, { shade: 0.6 });
  if (view === "q3") {
    pt.part(smooth([[-6.6, -3.8], [-8.2, -3.1], [-8.4, 0.2], [-6.9, 0.8], [-6.1, -1.4]], true, 0.5), PAL.skin, { shade: 0.3, rim: 0.3 });
    const ein = new Path2D(); ein.moveTo(-7.0, -2.6); ein.quadraticCurveTo(-7.8, -1.4, -7.1, -0.2); pt.line(ein, 0.3);
  }
  if (view === "side") {
    const ear = smooth([[-2.8, -3.6], [-1.0, -3.2], [-0.5, -0.4], [-1.2, 1.0], [-3.0, 0.8], [-3.5, -1.4]], true, 0.5);
    pt.part(ear, PAL.skin, { shade: 0.4 });
    const ein = new Path2D(); ein.moveTo(-1.6, -2.4); ein.quadraticCurveTo(-1.1, -0.9, -2.1, 0.0); pt.line(ein, 0.35);
  }
  // features
  if (view === "front") {
    drawBrow(pt, -3.9, -1.0, 4.6, -1, F); drawBrow(pt, 3.9, -1.0, 4.6, 1, F);
    drawEye(pt, -3.9, -1.0, 4.6, 3.0, -1, F); drawEye(pt, 3.9, -1.0, 4.6, 3.0, 1, F);
    drawNose(pt, "front");
    drawMouth(pt, 0, -8.6, 3.8, F);
  } else if (view === "q3") {
    drawBrow(pt, -1.7, -1.0, 4.4, -1, F); drawBrow(pt, 4.45, -1.0, 2.9, 1, F, 0.85);
    drawEye(pt, -1.7, -1.0, 4.4, 3.0, -1, F); drawEye(pt, 4.55, -1.0, 2.8, 2.9, 1, F, 0.78);
    drawNose(pt, "q3");
    drawMouth(pt, 2.9, -8.6, 3.2, F, 1);
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
    else if (F.mouth === "smile") { const p = new Path2D(); p.moveTo(7.8, -8.2); p.quadraticCurveTo(7.0, -8.6, 6.2, -7.9 + 0.3 * F.mouthOpen); pt.line(p, 0.55); }
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

export function drawCharacter(ctx: Ctx, P: Pose, L: Light, F: Frame, opts: { lineK?: number; clear?: boolean; phoneLight?: boolean; onHead?: (m: DOMMatrix) => void } = {}) {
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
  // depth of each limb from its own joints (cm toward the camera, relative to the pelvis): a reaching arm comes in front of
  // the chest, the far arm goes behind, seated thighs come forward of the hoodie; standing legs stay under the hem
  const hipD = R.depth([Pm.hip[0], Pm.hip[1], Pm.hip[2]]);
  const limbD = (a: V3, b: V3) => (R.depth(a) + R.depth(b)) / 2 - hipD;
  const legD = (k: V3, an: V3) => { const d = limbD(k, an); return d > 14 || Pm.legsFront ? d : d / 20 - 1; };
  const armD = (e: V3, wr: V3, hand?: string) => limbD(e, wr) + 0.6 + (hand === "pocket" || hand === "phone" ? 6 : 0);
  const items: { d: number; fn: () => void }[] = [
    { d: legD(R.knL, R.anL), fn: () => drawLeg(pt, R, Pm, "L", dL < dR ? 0.86 : 1) },
    { d: legD(R.knR, R.anR), fn: () => drawLeg(pt, R, Pm, "R", dR < dL ? 0.86 : 1) },
    { d: 0, fn: () => { drawHood(pt, R, Pm, true); drawTorso(pt, R, Pm); } },
    { d: armD(R.elL, R.wrL, Pm.handL), fn: () => drawArm(pt, R, Pm, "L", dL < dR ? 0.86 : 1) },
    { d: armD(R.elR, R.wrR, Pm.handR), fn: () => drawArm(pt, R, Pm, "R", dR < dL ? 0.86 : 1) },
  ];
  void back;
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
    if (opts.onHead) opts.onHead(ctx.getTransform());
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
  // the screen faces him, so from his front we see the phone's back: fingers of both hands curled round it, light leaking past its edges
  if (Pm.handL === "phone" || Pm.handR === "phone") {
    const wl = Pm.handL === "phone" ? R.proj(R.wrL) : R.proj(R.wrR);
    const wr = Pm.handR === "phone" ? R.proj(R.wrR) : wl;
    const m = lerpV(wl, wr, 0.5);
    const fx = Math.max(0.35, Math.abs(c)), hw = 3.7 * fx, y0 = m[1] + 1.5, h = 14.6, glow = Pm.phoneGlow ?? 0, back = c > 0;
    if (glow > 0) {
      // screen light leaking past the edges: a blurred glow, not a hard box
      const gp = new Path2D(); gp.roundRect(m[0] - hw - 0.8, y0 - 0.8, 2 * (hw + 0.8), h + 1.6, 2);
      const px = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
      ctx.save(); ctx.filter = `blur(${(2.2 * px).toFixed(1)}px)`; ctx.globalAlpha = 0.45 * glow; ctx.fillStyle = "#cfefff"; ctx.fill(gp); ctx.restore();
    }
    // palms: from each wrist up the phone's side
    const sides = [wl, wr].map((wq, i) => ({ wq, k: (wq[0] === m[0] ? (i === 0 ? 1 : -1) : Math.sign(wq[0] - m[0])) as 1 | -1 }));
    for (const { wq, k } of sides) pt.part(limbPath([wq, [m[0] + k * (hw + 0.2), y0 + 3.0], [m[0] + k * (hw - 0.3), y0 + 6.2]], [5.6, 5.2, 4.2]), PAL.skin, { dim: 1, shade: 0.35, lw: 0.6, rim: 0.2 });
    const ph = new Path2D(); ph.roundRect(m[0] - hw, y0, 2 * hw, h, 1.2);
    pt.fill(ph, back ? "#17161f" : "#0d0d14"); pt.line(ph, 0.6);
    if (back) {
      const lens = new Path2D(); lens.roundRect(m[0] - hw + 0.9 * fx, y0 + h - 4.3, 2.7 * fx, 3.3, 0.8); pt.fill(lens, "#26242f"); pt.line(lens, 0.3);
      // four curled fingers per hand on the back, index highest and longest, little finger shortest
      const FL = [2.5, 2.9, 2.6, 1.9], FW = [1.55, 1.6, 1.5, 1.3];
      for (const k of [-1, 1]) for (let j = 0; j < 4; j++) {
        const yy = y0 + 2.0 + j * 1.62 + (k > 0 ? 0.35 : 0), x0 = m[0] + k * (hw + 0.7), x1 = m[0] + k * (hw - FL[j] * fx);
        pt.part(limbPath([[x0, yy], [lerpV([x0, yy], [x1, yy], 0.55)[0], yy + 0.1], [x1, yy - 0.05]], [FW[j], FW[j] * 0.95, FW[j] * 0.82]), PAL.skin, { dim: 1, shade: 0.35, lw: 0.55, rim: 0.2 });
        const kn = new Path2D(); const kx = m[0] + k * (hw - 0.2 * fx); kn.moveTo(kx, yy - FW[j] * 0.32); kn.lineTo(kx + k * 0.15, yy + FW[j] * 0.3); pt.line(kn, 0.22);
      }
    } else if (glow > 0) {
      const sc = new Path2D(); sc.roundRect(m[0] - hw + 0.7 * fx, y0 + 0.8, 2 * hw - 1.4 * fx, h - 1.6, 0.8);
      pt.fill(sc, mixHex("#0d0d14", "#cfefff", glow));
    }
    if (!back) for (const { k } of sides) pt.part(limbPath([[m[0] + k * (hw + 0.6), y0 + 2.6], [m[0] + k * (hw - 1.4 * fx), y0 + 5.0], [m[0] + k * (hw - 2.6 * fx), y0 + 6.4]], [2.3, 2.0, 1.7]), PAL.skin, { dim: 1, shade: 0.35, lw: 0.55, rim: 0.2 });
  }
  ctx.restore();
}

/** Just a head (and a little neck) — the pillow close-up. */
export function drawHeadOnly(ctx: Ctx, view: HeadView, face: Face, L: Light, F: Frame, tilt = 0, lineK = 0.7, collar = false) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  ctx.rotate(tilt * D);
  const pt = new Painter(ctx, L, 0.62 * lineK);
  if (collar) {
    // shoulders in the rust hoodie and the bunched hood around the neck
    pt.part(smooth([[-24, -40], [-23, -26], [-15, -19], [0, -18], [15, -19], [23, -26], [24, -40]], true, 0.5), PAL.hood, { shade: 1 });
    pt.part(smooth([[-12, -24], [-11, -15], [0, -12.5], [11, -15], [12, -24], [0, -21]], true, 0.5), PAL.hood, { shade: 0.8 });
    pt.litFill(smooth([[-7.5, -21], [0, -16], [7.5, -21], [0, -23]], true, 0.5), PAL.hoodIn, false);
  }
  const neck = limbPath([[0, -22], [0, -9]], [8.4, 7.6]);
  pt.part(neck, PAL.skin, { shade: 0.5 });
  drawHead(pt, view, face, false);
  ctx.restore();
}

export type WatcherLook = { eyes: number; smile: number; rim: number; tilt: number; lean: number; glowOnly?: boolean };

/** The thing in the corner: a tall, thin silhouette with pale eyes and a long smile. */
export function drawWatcher(ctx: Ctx, F: Frame, o: WatcherLook) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  watcherBody(ctx, o);
  ctx.restore();
}

/** The entity in its own units (y up, feet at 0, eye line at 224), drawn with the current transform. */
export function watcherBody(ctx: Ctx, o: WatcherLook) {
  ctx.save();
  ctx.rotate(o.lean * D);
  const body = smooth([
    [-9, 0], [-10, 60], [-13, 120], [-21, 168], [-14, 182], [-6, 186], [-5, 196], [-11, 214], [-9, 236], [0, 243], [9, 236], [11, 214], [5, 196], [6, 186], [14, 182], [21, 168], [13, 120], [10, 60], [9, 0],
  ], true, 0.5);
  if (!o.glowOnly) ctx.fillStyle = "#06050b";
  if (!o.glowOnly) ctx.fill(body);
  // arms hanging to the knees
  for (const k of o.glowOnly ? [] : [-1, 1]) {
    const arm = limbPath([[k * 20, 172], [k * 25, 120], [k * 23, 70], [k * 22, 52]], [8, 6.5, 5.5, 4]);
    ctx.fillStyle = "#06050b"; ctx.fill(arm);
    for (let f = 0; f < 4; f++) {
      const fi = limbPath([[k * (20 + f * 1.4), 54], [k * (19 + f * 2.2), 40], [k * (18 + f * 2.6), 30]], [1.6, 1.3, 0.8]);
      ctx.fill(fi);
    }
  }
  if (o.rim > 0 && !o.glowOnly) {
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
      ctx.fillStyle = o.glowOnly ? "#9fb8ff" : "#eef3ff"; ctx.fill(e);
    }
  }
  if (o.smile > 0.02) {
    const s = o.smile;
    const p = new Path2D();
    p.moveTo(-8 * s - 1, 214 + 2 * s); p.quadraticCurveTo(0, 207 - 3 * s, 8 * s + 1, 214 + 2 * s);
    p.quadraticCurveTo(0, 210 - 1.5 * s, -8 * s - 1, 214 + 2 * s);
    ctx.fillStyle = o.glowOnly ? "#5a6a9a" : "#e9edf5"; ctx.fill(p);
    if (!o.glowOnly) {
      ctx.save(); ctx.clip(p); ctx.lineWidth = 0.25; ctx.strokeStyle = "#1a1626";
      for (let k = -10; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(k * 0.9, 205); ctx.lineTo(k * 0.9, 216); ctx.stroke(); }
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- poses
export const FACE0: Face = { open: 1, look: [0, 0], pupil: 1, brow: 0, browIn: 0.3, mouth: "neutral", mouthOpen: 0, shine: true };

export function stand(psi: number, t = 0, face: Partial<Face> = {}): Pose {
  // breathing (0.25 Hz) and a slow weight shift from foot to foot (0.11 Hz): never a dead-still mannequin
  const br = Math.sin(t * 2 * Math.PI * 0.25), ws = Math.sin(t * 2 * Math.PI * 0.11);
  return {
    psi, hip: [ws * 1.1, 92.6 + br * 0.15 - Math.abs(ws) * 0.3, 0], lean: 2.5, headTilt: -ws * 0.8, headNod: 0, twist: ws * 1.5,
    armL: [4 + br * 0.6, 7, 12], armR: [3 - br * 0.6, 7, 14], legL: [0, 3 - ws * 1.2, 2 + Math.max(0, -ws) * 6], legR: [0, 3 + ws * 1.2, 2 + Math.max(0, ws) * 6],
    handL: "open", handR: "open", face: { ...FACE0, ...face }, breathe: br,
  };
}

/** cosine-eased interpolation through [phase, value] keys (phase 0..1) */
function keyCurve(p: number, K: [number, number][]) {
  for (let i = 0; i < K.length - 1; i++) {
    if (p <= K[i + 1][0]) { const t = (p - K[i][0]) / (K[i + 1][0] - K[i][0]); return K[i][1] + (K[i + 1][1] - K[i][1]) * (0.5 - 0.5 * Math.cos(Math.PI * t)); }
  }
  return K[K.length - 1][1];
}

/** walk cycle, phase in cycles (1 cycle = 2 steps). Phase 0 = right heel strike.
 *  Contact -> down (knee absorbs, body lowest) -> passing (swing knee up, body highest) -> push-off (heel lifts) -> contact.
 *  Shoulders counter-rotate the hips; arms swing opposite the legs with follow-through on the forearm. */
export function walk(psi: number, phase: number, face: Partial<Face> = {}, o: { pockets?: boolean; amp?: number } = {}): Pose {
  const A = o.amp ?? 1;
  const leg = (ph: number) => {
    const p = ((ph % 1) + 1) % 1;
    const thigh = keyCurve(p, [[0, 22], [0.25, 3], [0.5, -19], [0.6, -16], [0.75, 3], [0.9, 19], [1, 22]]) * A;
    const knee = keyCurve(p, [[0, 4], [0.1, 15], [0.25, 5], [0.4, 8], [0.5, 22], [0.62, 46], [0.72, 56], [0.84, 30], [0.95, 6], [1, 4]]) * A;
    const foot = keyCurve(p, [[0, 14], [0.08, 0], [0.38, 0], [0.5, -18], [0.6, -36], [0.7, -6], [0.9, 6], [1, 14]]) * A;
    return { thigh, knee: Math.max(2, knee), foot };
  };
  const R = leg(phase), L = leg(phase + 0.5);
  const a = 2 * Math.PI * phase;
  const bob = 1.8 * Math.cos(4 * Math.PI * (phase - 0.3)) * A;
  const sway = 1.3 * Math.sin(a) * A;
  const arm = (ph: number) => {
    const sw = -19 * Math.cos(2 * Math.PI * (ph - 0.06)) * A;
    const el = 12 + 16 * Math.max(0, Math.cos(2 * Math.PI * (ph - 0.16))) * A;
    return (o.pockets ? [8, 8, 62] : [sw, 7, el]) as [number, number, number];
  };
  return {
    psi, hip: [sway, 92.2 + bob, 0], lean: 5, headTilt: -0.6 * sway, headNod: 2 - 0.6 * bob, twist: 6 * Math.cos(a) * A,
    armL: arm(phase), armR: arm(phase + 0.5),
    legL: [L.thigh, 2, L.knee], legR: [R.thigh, 2, R.knee], footL: L.foot, footR: R.foot,
    handL: o.pockets ? "pocket" : "open", handR: o.pockets ? "pocket" : "open",
    face: { ...FACE0, ...face }, breathe: Math.sin(a * 2),
  };
}

/** A forearm in the rust sleeve with an open hand reaching right (the frozen-steam close-up). */
/** His right hand, seen from the back, reaching to the right (the steam close-up). Palm, knuckles, four fingers of
 *  different lengths in three segments that fan and curl a little, nails, the thumb on the index side, the sleeve. */
export function drawHand(ctx: Ctx, L: Light, F: Frame, spread = 0.3, curl = 0.2) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  const pt = new Painter(ctx, L, 0.42);
  const nail = mixHex(PAL.skin, "#f6dcd6", 0.6);
  // fingers, little finger first (index on top): root on the knuckle line, segment lengths, width, fan angle
  const FING: [number, number, [number, number, number], number, number][] = [
    [-2.7, 7.0, [3.0, 2.0, 1.6], 1.55, -0.16],
    [-0.95, 7.7, [3.6, 2.5, 1.9], 1.75, -0.06],
    [0.85, 7.9, [3.9, 2.7, 2.0], 1.85, 0.03],
    [2.6, 7.6, [3.6, 2.4, 1.9], 1.8, 0.12],
  ];
  const tips: Vec[] = [];
  for (const [y, x, seg, w, fan] of FING) {
    let a = fan * (0.6 + spread), p: Vec = [x, y];
    const pts: Vec[] = [p];
    // curling fingers bend away from the lens: each segment turns a little and foreshortens
    seg.forEach((l, k) => { a -= curl * 0.05 * k; p = add(p, [l * Math.cos(a) * (1 - curl * 0.25 * k), l * Math.sin(a)]); pts.push(p); });
    pt.part(limbPath(pts, [w * 1.05, w, w * 0.92, w * 0.82]), PAL.skin, { shade: 0.45, lw: 0.75 });
    // joint creases and the nail
    // one soft crease over the middle joint (skin, not a hinge)
    { const c = pts[1], d = norm(sub(pts[2], pts[0])), n = perp(d); const l = new Path2D(); l.moveTo(c[0] + n[0] * w * 0.22, c[1] + n[1] * w * 0.22); l.quadraticCurveTo(c[0] + d[0] * 0.3, c[1] + d[1] * 0.3, c[0] - n[0] * w * 0.22, c[1] - n[1] * w * 0.22); pt.line(l, 0.13, mixHex(PAL.ink, PAL.skin, 0.45)); }
    const tip = pts[3], d = norm(sub(pts[3], pts[2])), n = perp(d);
    const nl = smooth([add(tip, add(mul(d, -1.35), mul(n, w * 0.3))), add(tip, add(mul(d, -0.3), mul(n, w * 0.3))), add(tip, mul(d, -0.15)), add(tip, add(mul(d, -0.3), mul(n, -w * 0.3))), add(tip, add(mul(d, -1.35), mul(n, -w * 0.3)))], true, 0.4);
    pt.fill(nl, litPair(nail, L)[1]); pt.line(nl, 0.18);
    tips.push(tip);
  }
  // thumb: from the base of the hand on the index side, angled forward and a little under the index finger
  const th: Vec[] = [[0.0, 2.6], [3.4, 5.0], [6.0, 6.3 - curl * 0.6], [7.9, 6.2 - curl * 0.9]];
  pt.part(limbPath(th, [3.0, 2.5, 2.2, 1.85]), PAL.skin, { shade: 0.45, lw: 0.75 });
  { const tip = th[3], d = norm(sub(th[3], th[2])), n = perp(d); const nl = smooth([add(tip, add(mul(d, -1.5), mul(n, 0.6))), add(tip, add(mul(d, -0.3), mul(n, 0.55))), add(tip, mul(d, -0.15)), add(tip, add(mul(d, -0.3), mul(n, -0.5))), add(tip, add(mul(d, -1.5), mul(n, -0.55)))], true, 0.4); pt.fill(nl, litPair(nail, L)[1]); pt.line(nl, 0.18); }
  const tc = new Path2D(); tc.moveTo(4.6, 5.1); tc.quadraticCurveTo(5.0, 5.8, 4.5, 6.5); pt.line(tc, 0.13, mixHex(PAL.ink, PAL.skin, 0.45));
  // back of the hand: wider at the knuckles than at the wrist, a soft knuckle ridge
  const back = smooth([[-5.5, 3.2], [0.5, 3.9], [5.2, 3.9], [8.1, 3.4], [8.6, 1.6], [8.4, -1.0], [7.6, -3.4], [4.8, -3.8], [0.0, -3.4], [-5.5, -3.0]], true, 0.5);
  pt.part(back, PAL.skin, { shade: 0.55, lw: 0.8 });
  for (const [x, y] of [[7.4, 2.6], [7.8, 0.85], [7.6, -0.95], [7.0, -2.7]] as Vec[]) { const k = new Path2D(); k.moveTo(x - 0.6, y + 0.65); k.quadraticCurveTo(x + 0.25, y, x - 0.6, y - 0.65); pt.line(k, 0.22); }
  const ten = new Path2D(); ten.moveTo(-2, 1.2); ten.quadraticCurveTo(2.5, 1.5, 6.4, 1.6); ten.moveTo(-2, -0.6); ten.quadraticCurveTo(2.5, -0.5, 6.2, -0.4); pt.line(ten, 0.14);
  // sleeve with a ribbed cuff
  pt.part(limbPath([[-60, 0.5], [-20, 0.3], [-5.0, 0]], [12.5, 11.5, 10.6]), PAL.hood, { shade: 1 });
  const cuff = new Path2D(); cuff.moveTo(-8.6, 5.0); cuff.lineTo(-8.6, -5.0); pt.line(cuff, 0.6);
  for (const y of [-3.4, -1.2, 1.0, 3.2]) { const r = new Path2D(); r.moveTo(-7.9, y); r.lineTo(-5.6, y); pt.line(r, 0.16); }
  void tips;
  ctx.restore();
}

/** A pigeon caught mid-wingbeat (frozen in the air over the avenue). */
export function drawPigeon(ctx: Ctx, L: Light, F: Frame) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  const pt = new Painter(ctx, L, 0.5);
  pt.part(smooth([[-4, 4], [-20, 22], [-30, 30], [-24, 18], [-14, 6]], true, 0.4), "#8a8f9e", { shade: 0.6 });   // far wing up
  pt.part(smooth([[-16, -2], [-4, -6], [8, -4], [14, 2], [10, 6], [-2, 6], [-12, 4]], true, 0.5), "#9aa0ae", { shade: 0.8 }); // body
  pt.part(smooth([[-16, 0], [-26, -3], [-27, 3], [-17, 4]], true, 0.4), "#6c7180", { shade: 0.5 });  // tail
  pt.part(smooth([[10, 4], [13, 9], [18, 9], [19, 5], [15, 2]], true, 0.5), "#6e7488", { shade: 0.6 }); // head
  pt.fill(smooth([[18.5, 7], [22.5, 6.2], [18.8, 5.6]], true, 0.3), "#2a2224");
  pt.fill(new Path2D("M 16.8 7.4 a 0.8 0.8 0 1 0 0.01 0"), "#ffb030");
  pt.part(smooth([[-2, 4], [4, 16], [14, 26], [10, 12], [6, 4]], true, 0.4), "#a3a9b6", { shade: 0.7 });    // near wing up
  ctx.restore();
}

/** The entity's features (from drawWatcher) drawn in a head space: centre (0,0), y up, head ~17 cm wide.
 *  eyes 0..1 (opening), smile 0..1 (grin spreading). glowOnly draws just the light parts (for the additive glow layer). */
export function drawEntityFeatures(ctx: Ctx, eyes: number, smile: number, glowOnly = false) {
  if (eyes > 0.02) {
    for (const k of [-1, 1]) {
      const e = new Path2D();
      e.ellipse(k * 4.2, -0.6 + (k > 0 ? 0.4 : 0), 2.5, 1.45 * eyes, k * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = glowOnly ? "#9fb8ff" : "#eef3ff"; ctx.fill(e);
    }
  }
  if (smile > 0.02) {
    const s = smile;
    const p = new Path2D();
    p.moveTo(-8 * s - 1, -9.4 + 2 * s); p.quadraticCurveTo(0, -16.4 - 3 * s, 8 * s + 1, -9.4 + 2 * s);
    p.quadraticCurveTo(0, -13.4 - 1.5 * s, -8 * s - 1, -9.4 + 2 * s);
    ctx.fillStyle = glowOnly ? "#5a6a9a" : "#e9edf5"; ctx.fill(p);
    if (!glowOnly) {
      ctx.save(); ctx.clip(p); ctx.lineWidth = 0.25; ctx.strokeStyle = "#1a1626";
      for (let k = -10; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(k * 0.9, -18); ctx.lineTo(k * 0.9, -7); ctx.stroke(); }
      ctx.restore();
    }
  }
}

/** A soft coloured halo behind everything drawn so far (keeps a black silhouette readable against a dark background). */
export function haloBehind(ctx: Ctx, color: string, px: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; tmp.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-over"; ctx.filter = `drop-shadow(0 0 ${px}px ${color})`;
  ctx.drawImage(tmp, 0, 0); ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

/** Darken everything already drawn on the canvas toward the entity's ink-black, keeping a thin purple rim. */
export function inkOver(ctx: Ctx, k: number) {
  if (k <= 0) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-atop"; ctx.globalAlpha = Math.min(1, k);
  ctx.fillStyle = "#06050b"; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------- the woman in the bed (a separate, ordinary human)
// Drawn waist-up (she is only ever seen in the bed) or, for the reference sheet, standing. Body space: cm, y up,
// origin at the hips. Same ink, cel shading and face construction as him, but her own build, hair, eyes and clothes.
export const PAL_W = { skin: "#f2ddd2", lip: "#c98b8b", hair: "#15131b", hairHi: "#3d4566", shirt: "#8e919e", shirtDk: "#5d6070", iris: "#7c8c84", irisDk: "#2c3833", shorts: "#3a3550" };

export type SleeperLook = {
  body: "front" | "q3";       // torso: facing us, or turned three-quarters toward screen-right
  head: "front" | "q3";       // head view (q3 = toward screen-right)
  headFlip?: boolean;         // mirror the head (q3 toward screen-left)
  headTilt: number;           // deg, screen roll
  headNod: number;            // deg, + = chin down
  face: Face;
  arms: "lap" | "push";       // hands resting in her lap on the duvet, or pushing down on the mattress beside her hips
  armK?: number;              // 0 = pushing .. 1 = in her lap (overrides arms; in-betweens move the arms between the two)
  breathe: number;            // -1..1
  sway?: number;              // hair lag, -1..1 (her hair swings a little behind the head as she moves)
  legs?: boolean;             // reference sheet only: draw her standing
};

export function drawSleeper(ctx: Ctx, F: Frame, L: Light, o: SleeperLook, lineK = 0.7) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  const pt = new Painter(ctx, L, 0.62 * lineK);
  const q = o.body === "q3", kx = q ? 0.86 : 1, cx = q ? 2.2 : 0;   // three-quarter torso: narrower, centre line toward the facing side
  const X = (x: number) => x * kx + (x > 0 ? cx * 0.3 : cx * 0.0);
  const br = o.breathe * 0.6;
  // head placement (body space) and a helper mapping head space -> body space
  const hs = 1.04, hx = cx * 0.9, hy = 59.8 + br * 0.5;
  const tilt = -o.headTilt * D, nodK = Math.cos(o.headNod * D * 0.6), nodY = -Math.sin(o.headNod * D) * 3.2;
  const flipH = o.headFlip ? -1 : 1;
  const H2B = (p: Vec): Vec => { const r = rot([p[0] * hs * flipH, p[1] * hs * nodK], tilt); return [hx + r[0], hy + nodY + r[1]]; };
  const sway = (o.sway ?? 0) * 2.2;

  // legs (reference only): bare legs under the long shirt, simple shorts
  if (o.legs) {
    for (const k of [-1, 1]) {
      pt.part(limbPath([[k * 7, -2], [k * 7.6, -40], [k * 6.6, -78]], [13, 9.6, 6.6]), PAL_W.skin, { shade: 0.6 });
      pt.part(smooth([[k * 5, -79], [k * 10.5, -80.5], [k * 11.2, -84], [k * 3.6, -84], [k * 3.2, -80.5]], true, 0.5), PAL_W.skin, { shade: 0.4 });
    }
    pt.part(smooth([[-14, 2], [-14.2, -12], [-1, -14], [1, -14], [14.2, -12], [14, 2]], true, 0.4), PAL_W.shorts, { shade: 0.8 });
  }
  // long hair behind the shoulders
  const backHair = smooth([H2B([-8.8, 6]), H2B([-9.6, -4]), [X(-14.5) + sway * 0.4, 30], [X(-15.5) + sway, 21], [X(-9), 19.5], [0, 22], [X(9), 19.5], [X(15.5) + sway, 21], [X(14.5) + sway * 0.4, 30], H2B([9.6, -4]), H2B([8.8, 6]), H2B([0, 14.2])], true, 0.45);
  pt.part(backHair, PAL_W.hair, { shade: 0.7, rim: 0.8 });
  // arms behind / at the sides
  const shoulder = (k: number): Vec => [X(k * 14.6), 38.5 + br * 0.4];
  const drawArm = (k: number) => {
    const s = shoulder(k);
    const t = o.armK ?? (o.arms === "lap" ? 1 : 0);
    const e = lerpV([X(k * 17.2), 17], [X(k * 17.2), 15.0], t), w = lerpV([X(k * 17.8), 0], [X(k * 10.4), 7.6], t), hand = lerpV([X(k * 18.2), -4.6], [X(k * 5.6), 5.2], t);
    const pushing = t < 0.5;
    pt.part(limbPath([s, lerpV(s, e, 0.5), e, lerpV(e, w, 0.5), w], [8.6, 7.4, 6.6, 6.0, 5.2]), PAL_W.skin, { shade: 0.6 });
    // hand
    if (pushing) {
      const hp = smooth([[w[0] - 3, w[1] + 0.5], [w[0] + 3, w[1] + 0.5], [hand[0] + 3.4, hand[1] - 1.2], [hand[0], hand[1] - 2.2], [hand[0] - 3.4, hand[1] - 1.2]], true, 0.5);
      pt.part(hp, PAL_W.skin, { shade: 0.4, lw: 0.7, rim: 0.3 });
      for (const v of [-1.3, 0, 1.3]) { const l = new Path2D(); l.moveTo(hand[0] + v, hand[1] + 0.2); l.lineTo(hand[0] + v * 1.15, hand[1] - 1.7); pt.line(l, 0.22); }
    } else {
      const d = norm(sub(hand, w)), n = perp(d);
      const P = (u: number, v: number): Vec => add(w, add(mul(d, u), mul(n, v * k)));
      // relaxed hand resting palm-down: palm, then fingers tapering to soft tips, thumb tucked along the inside
      pt.part(smooth([P(-0.4, 2.4), P(4.4, 2.9), P(8.6, 2.2), P(10.6, 0.8), P(10.9, -0.6), P(9.4, -2.0), P(4.6, -2.6), P(-0.4, -2.2)], true, 0.5), PAL_W.skin, { shade: 0.4, lw: 0.7, rim: 0.3 });
      for (const v of [1.1, 0.0, -1.1]) { const l = new Path2D(); const a = P(6.6, v), b = P(9.6, v * 0.75); l.moveTo(a[0], a[1]); l.lineTo(b[0], b[1]); pt.line(l, 0.2); }
      const th = new Path2D(); const t0 = P(2.6, -2.4), t1 = P(6.4, -2.9); th.moveTo(t0[0], t0[1]); th.quadraticCurveTo(...(P(4.8, -3.4) as [number, number]), t1[0], t1[1]); pt.line(th, 0.26);
    }
  };
  // shirt: oversized grey T, short sleeves, crew neck
  const shirt = smooth([[X(-13.6), -9], [X(-13.2), 6], [X(-12.4), 16], [X(-13.8), 28], [X(-15.4), 37], [X(-13.6), 41.6], [X(-6.4) + cx * 0.4, 44 + br * 0.4], [cx * 0.6, 43.2 + br * 0.4], [X(6.4) + cx * 0.4, 44 + br * 0.4], [X(13.6), 41.6], [X(15.4), 37], [X(13.8), 28], [X(12.4), 16], [X(13.2), 6], [X(13.6), -9]], true, 0.45);
  pt.part(shirt, PAL_W.shirt, { shade: 1 });
  // soft folds
  for (const [a, b, c] of [[[X(-9), 4], [X(-6), 14], [X(-7.5), 24]], [[X(8), 3], [X(6.5), 12], [X(8.5), 20]], [[X(-3), 30], [X(1), 27], [X(4.5), 31]]] as Vec[][]) { const p = new Path2D(); p.moveTo(a[0], a[1]); p.quadraticCurveTo(b[0], b[1], c[0], c[1]); pt.line(p, 0.3, litPair(PAL_W.shirtDk, L)[0]); }
  // neck, then the crew collar over its base
  pt.part(limbPath([[cx * 0.6, 40.6], [hx, 52.5]], [7.4, 6.6]), PAL_W.skin, { shade: 0.6 });
  const col = new Path2D(); col.moveTo(X(-6.2) + cx * 0.4, 43.8 + br * 0.4); col.quadraticCurveTo(cx * 0.6, 38.6 + br * 0.4, X(6.2) + cx * 0.4, 43.8 + br * 0.4);
  col.quadraticCurveTo(cx * 0.6, 40.4 + br * 0.4, X(-6.2) + cx * 0.4, 43.8 + br * 0.4); pt.part(col, PAL_W.shirtDk, { shade: 0.3, lw: 0.6, rim: 0 });
  // sleeves and arms (near-side arm last)
  for (const k of q ? [1, -1] : [-1, 1]) {
    drawArm(k);
    const s = shoulder(k);
    const sleeve = smooth([[s[0] - k * 3.6, s[1] + 4.2], [s[0] + k * 2.6, s[1] + 2.4], [X(k * 18.6), 25.5], [X(k * 17.4), 23.2], [X(k * 12.2), 25.5], [X(k * 11.8), 31]], true, 0.45);
    pt.part(sleeve, PAL_W.shirt, { shade: 0.9 });
  }
  // hair over the front of the shoulders: a curtain each side of the face; in 3/4 the far one hangs behind the cheek
  const curtain = (k: number) => {
    const far = o.head === "q3" && k > 0;
    const top = H2B([k * (o.head === "q3" ? 7.0 : 1.2), o.head === "q3" ? 9.6 : 10.4]), tem = H2B([k * (far ? 8.2 : 8.4), 4.0]), jaw = H2B([k * (far ? 9.0 : 9.4), -9.5]);
    const fx = (x: number) => (o.head === "q3" ? x : x);
    const sh: Vec = [fx(H2B([k * 10.6, -16])[0]) + sway * 0.5, 36 + br * 0.4];
    const tipA: Vec = [sh[0] + k * 0.6 + sway * 0.9, 26.5], tipB: Vec = [sh[0] - k * 2.0 + sway, 28.6];
    pt.part(smooth([top, tem, jaw, [sh[0] + k * 2.6, sh[1]], tipA, [sh[0] - k * 0.4, 30.5], tipB, [sh[0] - k * 2.4, sh[1] + 1], [jaw[0] - k * 3.2, jaw[1] + 0.5], [tem[0] - k * 2.6, tem[1] + 0.8]], true, 0.42), PAL_W.hair, { shade: 0.6, rim: 0.9 });
    for (const off of [-1.0, 0.8]) { const sp = new Path2D(); sp.moveTo(tem[0] - k * 1.2 + off * 0.5, tem[1]); sp.quadraticCurveTo(jaw[0] - k * 1.4 + off, jaw[1], sh[0] + off - k * 0.6, sh[1] - 5); pt.line(sp, 0.22, litPair(PAL_W.hairHi, L)[1]); }
  };
  if (o.head === "q3") curtain(1);
  // head
  ctx.save();
  ctx.translate(hx, hy + nodY); ctx.rotate(tilt); ctx.scale(hs * flipH, hs * nodK);
  const save = pt.L;
  if (o.headFlip) pt.L = { ...pt.L, dir: 180 - pt.L.dir, rim: pt.L.rim ? { ...pt.L.rim, dir: 180 - pt.L.rim.dir } : undefined };
  sleeperHead(pt, o.head, o.face);
  pt.L = save;
  ctx.restore();
  if (o.head === "q3") curtain(-1); else { curtain(-1); curtain(1); }
  ctx.restore();
}

function sleeperHead(pt: Painter, view: "front" | "q3", F: Face) {
  const c = pt.c;
  const face = view === "front"
    ? smooth([[0, 9.5], [6.4, 7.6], [7.9, 2], [7.6, -2.8], [5.9, -7.6], [3.0, -11.2], [0, -12.4], [-3.0, -11.2], [-5.9, -7.6], [-7.6, -2.8], [-7.9, 2], [-6.4, 7.6]], true, 0.5)
    : smooth([[0, 9.5], [6.3, 7.8], [8.0, 2.6], [8.0, -1.4], [7.6, -4.8], [6.5, -8.2], [4.2, -11.4], [1.3, -12.4], [-2.9, -11.0], [-6.2, -7.4], [-7.6, -2], [-7.6, 4], [-5.4, 8.4]], true, 0.5);
  pt.part(face, PAL_W.skin, { shade: 0.6 });
  // her features: thin brows, grey-green eyes with a longer lash flick, the same nose construction as his, soft lips
  const keep = [PAL.iris, PAL.irisDk, PAL.lip];
  PAL.iris = PAL_W.iris; PAL.irisDk = PAL_W.irisDk; PAL.lip = PAL_W.lip;
  const lash = (x: number, y: number, side: number) => { const l = new Path2D(); l.moveTo(x, y); l.quadraticCurveTo(x + side * 0.9, y + 0.2, x + side * 1.4, y + 0.9); pt.line(l, 0.5); };
  if (view === "front") {
    drawBrow(pt, -3.8, -0.8, 4.2, -1, F, 0.6); drawBrow(pt, 3.8, -0.8, 4.2, 1, F, 0.6);
    drawEye(pt, -3.8, -1.0, 4.4, 3.0, -1, F); drawEye(pt, 3.8, -1.0, 4.4, 3.0, 1, F);
    if (F.open > 0.14) { lash(-6.0, -0.7, -1); lash(6.0, -0.7, 1); }
    drawNose(pt, "front");
    drawMouth(pt, 0, -8.4, 3.4, F);
    pt.fill(smooth([[-1.3, -8.9], [0, -9.5], [1.3, -8.9], [0, -9.25]], true, 0.5), mixHex(PAL_W.lip, "#ffffff", 0.1), 0.55);
  } else {
    drawBrow(pt, -1.7, -0.8, 4.0, -1, F, 0.6); drawBrow(pt, 4.45, -0.8, 2.7, 1, F, 0.5);
    drawEye(pt, -1.7, -1.0, 4.2, 3.0, -1, F); drawEye(pt, 4.55, -1.0, 2.7, 2.9, 1, F, 0.78);
    if (F.open > 0.14) lash(-3.9, -0.8, -1);
    drawNose(pt, "q3");
    drawMouth(pt, 2.9, -8.4, 3.0, F, 1);
  }
  [PAL.iris, PAL.irisDk, PAL.lip] = keep;
  // hair over the crown: centre parting, hairline sweeping down to the temples (no fringe)
  const part = view === "front" ? 0 : 1.6;
  const cap = smooth([[-8.5, 2.4], [-9.4, 8.4], [-6.4, 13.2], [part, 14.8], [6.4, 13.2], [9.4, 8.4], [8.5, 2.4], [6.4, 6.0], [part + 2.6, 8.8], [part + 0.25, 9.8], [part - 0.25, 9.8], [part - 2.6, 8.8], [-6.4, 6.0]], true, 0.42);
  pt.part(cap, PAL_W.hair, { shade: 0.7, rim: 0.8 });
  const pl = new Path2D(); pl.moveTo(part, 9.8); pl.quadraticCurveTo(part + 0.2, 12.6, part - 0.4, 14.6); pt.line(pl, 0.3);
  c.save(); c.globalAlpha = 0.6; c.strokeStyle = litPair(PAL_W.hairHi, pt.L)[1]; c.lineWidth = 0.4; c.lineCap = "round";
  for (const [a, b] of [[[-6.2, 10.6], [-2.4, 13.2]], [[2.6, 13.0], [6.0, 10.8]]] as Vec[][]) { c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.9, b[0], b[1]); c.stroke(); }
  c.restore();
}

/** for the photo: the back of a sleeping head, nearly all under the duvet, only a little dark hair on the pillow */
export function drawHairOnPillow(ctx: Ctx, F: Frame, L: Light) {
  const W = ctx.canvas.width, Hc = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hc);
  ctx.save();
  const sx = W / F.w, sy = Hc / F.h;
  ctx.setTransform(sx, 0, 0, -sy, -F.x0 * sx, Hc + F.y0 * sy);
  const pt = new Painter(ctx, L, 0.45);
  // a few long strands spill over the pillow (only noticed on a second look)
  for (const [a, b, c2] of [[[7.0, 0.5], [11.5, -1.2], [15.4, -4.6]], [[7.8, 2.2], [12.4, 1.0], [16.0, -1.6]], [[6.2, -1.5], [9.4, -3.6], [11.8, -5.6]]] as Vec[][]) { const p = new Path2D(); p.moveTo(a[0], a[1]); p.quadraticCurveTo(b[0], b[1], c2[0], c2[1]); pt.line(p, 0.55, PAL_W.hair); }
  const head = smooth([[-9, -2], [-9.6, 5], [-5.5, 10.4], [1, 11.4], [7, 8.6], [9.4, 3], [8.6, -2], [3, -3.4], [-4, -3.2]], true, 0.45);
  pt.part(head, PAL_W.hair, { shade: 0.7 });
  // the flash catches the hair: a sheen band across the crown and strands running from the whorl
  const c = ctx; c.save(); c.clip(head);
  c.globalAlpha = 0.45; c.strokeStyle = litPair(PAL_W.hairHi, L)[1]; c.lineWidth = 2.2; c.lineCap = "round";
  c.beginPath(); c.moveTo(-6.8, 5.4); c.quadraticCurveTo(0, 10.2, 6.6, 5.6); c.stroke();
  c.globalAlpha = 0.32; c.lineWidth = 0.28;
  for (const [x0, bend, dx] of [[-6.2, 1.6, -2.6], [-3.1, 2.4, -3.4], [0.4, 1.2, -2.2], [3.3, 2.0, -3.0], [6.0, 1.0, -1.6]]) { c.beginPath(); c.moveTo(x0, 11.5); c.quadraticCurveTo(x0 + bend, 5, x0 + dx, -3.5); c.stroke(); }
  c.restore();
  ctx.restore();
}
