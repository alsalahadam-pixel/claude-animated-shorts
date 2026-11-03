// The six sets of the Yamaguchi short, each its own group (world.ts shows only the shot's zone). Static geometry is
// merged per material (Batch, two-tone shading); moving parts (train, plane, hanko, lanterns) are returned as handles.
// Painted textures are our own Canvas2D designs in the paint.ts manner (flat colour, soft dabs, near-black seams).
import * as THREE from "three";
import { Batch, boxGeo, quad, tri, V, lam, prop, Kit } from "./build";
import { ctex, rep, rng, jit, planksHD, grassHD, roofHD } from "./paint";
import { twoTone } from "./shade";
import { NOINK } from "./ink";
import { Pen } from "./toon";
import { fxSeal } from "./fx";
import { SHIP_AT, CLOCK_AT, TARGETS, TUNNEL, PODIUM, BENCH, AWARD, DESK_INSERT, V3 } from "./story";

const M4 = (x: number, y: number, z: number, ry = 0, s: V3 = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(...s));
/** horizontal quad at height y over x0..x1, z0..z1, texture repeats u x v */
const ground = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number) => quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), u, v);
const cyl = (r0: number, r1: number, h: number, n = 12) => new THREE.CylinderGeometry(r1, r0, h, n).translate(0, h / 2, 0);
const solid = (key: string, color: string) => lam(key, () => ({ color }));
const phong = (color: string, spec = "#9a9a9a", shin = 40) => twoTone(new THREE.MeshPhongMaterial({ color, specular: spec, shininess: shin }), 0.15);
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });

// ---------------- painted textures ----------------
const dirtTex = () => ctex("dirtHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#c2b29a"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) { const x = r() * 1024, y = r() * 1024, s = 3 + r() * 14; g.fillStyle = jit(r, r() < 0.5 ? "#b2a08a" : "#d2c4ac", 0.1); g.beginPath(); g.ellipse(x, y, s, s * 0.6, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 80; i++) { const x = r() * 1024, y = r() * 1024; g.fillStyle = "rgba(90,70,50,0.35)"; g.beginPath(); g.ellipse(x, y, 4, 3, 0, 0, 7); g.fill(); }
});
const dustTex = () => ctex("dustHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#b58f6a"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 700; i++) { const x = r() * 1024, y = r() * 1024, s = 6 + r() * 30; g.fillStyle = jit(r, r() < 0.5 ? "#a37f5d" : "#c49e78", 0.12); g.globalAlpha = 0.6; g.beginPath(); g.ellipse(x, y, s, s * 0.5, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
});
const paddyTex = () => ctex("paddyHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#86c25a"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 32) for (let x = 0; x < 1024; x += 24) { g.fillStyle = jit(r, "#5f9e3f", 0.12); g.beginPath(); g.ellipse(x + 12 + (r() - 0.5) * 4, y + 16, 7, 10, 0, 0, 7); g.fill(); }
  g.fillStyle = "rgba(160,200,230,0.25)"; for (let y = 0; y < 1024; y += 32) g.fillRect(0, y, 1024, 6);
});
const gravelTex = () => ctex("gravelHD", 512, 512, (g, r) => {
  g.fillStyle = "#8d8378"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) { g.fillStyle = jit(r, r() < 0.5 ? "#a39888" : "#6f665c", 0.15); g.beginPath(); g.arc(r() * 512, r() * 512, 2 + r() * 4, 0, 7); g.fill(); }
});
const plasterTex = (key: string, col: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) { g.fillStyle = jit(r, col, 0.05); g.globalAlpha = 0.35; g.beginPath(); g.ellipse(r() * 512, r() * 512, 30 + r() * 60, 20 + r() * 40, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
});
/** Japanese town house front (machiya): dark timber lattice ground floor with sliding door, a tiled eave line,
 *  white plaster upper floor with a slatted window. Canvas 512 x 512 = w x h metres. */
const machiyaTex = (key: string, wood: string, plaster: string, noren: string) => ctex(key, 512, 512, (g, r) => {
  const ink = "rgba(30,20,25,0.9)";
  g.fillStyle = plaster; g.fillRect(0, 0, 512, 512);
  // upper floor: plaster with a slatted window (mushiko mado)
  g.fillStyle = jit(r, plaster, 0.04); g.fillRect(0, 0, 512, 250);
  g.fillStyle = "#3a2e2a"; g.fillRect(150, 70, 212, 110);
  g.fillStyle = plaster; for (let x = 160; x < 360; x += 26) g.fillRect(x, 70, 12, 110);
  g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(150, 70, 212, 110);
  // eave shadow band
  g.fillStyle = "rgba(40,30,40,0.35)"; g.fillRect(0, 250, 512, 26);
  // ground floor: dark timber, lattice (koshi) both sides of a door
  g.fillStyle = wood; g.fillRect(0, 276, 512, 236);
  g.fillStyle = "#2a201e"; g.fillRect(28, 300, 170, 170); g.fillRect(314, 300, 170, 170);
  g.fillStyle = jit(r, wood, 0.08); for (let x = 32; x < 198; x += 16) g.fillRect(x, 300, 9, 170); for (let x = 318; x < 484; x += 16) g.fillRect(x, 300, 9, 170);
  g.fillStyle = "#e9dcc0"; g.fillRect(208, 296, 96, 196); // paper sliding door
  g.strokeStyle = "rgba(60,45,40,0.8)"; g.lineWidth = 4;
  for (let y = 320; y < 492; y += 34) { g.beginPath(); g.moveTo(208, y); g.lineTo(304, y); g.stroke(); }
  g.beginPath(); g.moveTo(256, 296); g.lineTo(256, 492); g.stroke();
  g.fillStyle = noren; g.fillRect(204, 290, 104, 62); // noren curtain (no lettering)
  g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(254, 290, 4, 62);
  g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(204, 290, 104, 62); g.strokeRect(208, 296, 96, 196);
  g.lineWidth = 8; g.beginPath(); g.moveTo(0, 276); g.lineTo(512, 276); g.stroke();
});
const tileRoofTex = () => roofHD("#5d6273", true);
const hullTex = () => ctex("hullHD", 1024, 256, (g, r) => {
  g.fillStyle = "#3a4250"; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = "#c4533a"; g.fillRect(0, 150, 1024, 106);
  g.fillStyle = "#e8e2d4"; g.fillRect(0, 140, 1024, 10);
  g.strokeStyle = "rgba(10,10,14,0.55)"; g.lineWidth = 3;
  for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 40; y < 256; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(120,60,40,0.35)"; g.fillRect(r() * 1024, 160 + r() * 90, 3 + r() * 6, 8 + r() * 20); }
});
const clockFace = () => ctex("clock815", 256, 256, (g) => {
  g.fillStyle = "#f7f1e1"; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
  g.strokeStyle = "#221f2e"; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.lineWidth = 8; g.beginPath(); g.moveTo(128 + 78 * Math.cos(a), 128 + 78 * Math.sin(a)); g.lineTo(128 + 96 * Math.cos(a), 128 + 96 * Math.sin(a)); g.stroke(); }
  // 8:15: minute hand at 3, hour hand a quarter past 8
  const hA = (-90 + (8.25 / 12) * 360) * (Math.PI / 180);
  g.lineWidth = 13; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 52 * Math.cos(hA), 128 + 52 * Math.sin(hA)); g.stroke();
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(206, 128); g.stroke();
  g.fillStyle = "#221f2e"; g.beginPath(); g.arc(128, 128, 10, 0, 7); g.fill();
});
/** office window view: sky, harbour hills and rooftops (unlit backdrop) */
const viewTex = () => ctex("officeView", 2048, 1024, (g, r) => {
  const sky = g.createLinearGradient(0, 0, 0, 640); sky.addColorStop(0, "#5f9ae0"); sky.addColorStop(1, "#cfe2f4");
  g.fillStyle = sky; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(255,255,255,0.85)"; const x = r() * 2048, y = 80 + r() * 200; g.beginPath(); g.ellipse(x, y, 120, 36, 0, 0, 7); g.ellipse(x + 70, y - 20, 70, 40, 0, 0, 7); g.fill(); }
  g.fillStyle = "#6e9f62"; g.beginPath(); g.moveTo(0, 620); for (let x = 0; x <= 2048; x += 64) g.lineTo(x, 520 - 120 * Math.sin(x / 400) - 40 * Math.sin(x / 130)); g.lineTo(2048, 1024); g.lineTo(0, 1024); g.fill();
  g.fillStyle = "#5a8a54"; g.beginPath(); g.moveTo(0, 700); for (let x = 0; x <= 2048; x += 64) g.lineTo(x, 640 - 70 * Math.sin(x / 260 + 1)); g.lineTo(2048, 1024); g.lineTo(0, 1024); g.fill();
  for (let i = 0; i < 70; i++) { const x = r() * 2048, y = 700 + r() * 300, w = 50 + r() * 50; g.fillStyle = jit(r, "#e9dcc0", 0.1); g.fillRect(x, y, w, 34); g.fillStyle = "#4f5566"; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + w / 2, y - 22); g.lineTo(x + w + 6, y); g.fill(); }
});
const paperTex = (cert: boolean) => ctex(cert ? "certPaper" : "notePaper", 512, 360, (g) => {
  g.fillStyle = "#f8f2e2"; g.fillRect(0, 0, 512, 360);
  g.strokeStyle = cert ? "#b08a3e" : "#c9bfa9"; g.lineWidth = cert ? 14 : 4; g.strokeRect(14, 14, 484, 332);
  if (cert) { g.lineWidth = 3; g.strokeRect(34, 34, 444, 292); }
  g.fillStyle = "#8f8576"; for (let i = 0; i < (cert ? 5 : 7); i++) g.fillRect(cert ? 90 : 50, (cert ? 90 : 60) + i * 36, cert ? 330 - (i === 4 ? 140 : 0) : 380 - (i % 3) * 60, 7);
});

// ---------------- reusable pieces ----------------
/** Japanese town house: facade on local +z (width w along x), depth d, two storeys (h), gabled tile roof along x */
const machiya = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number) => {
  const woods = ["#5a3d2c", "#4a3226", "#6a4a34"], plasters = ["#efe6d2", "#e8dcc2", "#f2ead8", "#dccfb5"], norens = ["#2f4f7a", "#7a2f34", "#3b5a3a", "#6a4a6a"];
  const st = { wood: woods[si % 3], plaster: plasters[si % 4], noren: norens[si % 4] };
  const front = lam(`mf${si % 12}`, () => ({ map: machiyaTex(`mf${si % 12}`, st.wood, st.plaster, st.noren) }));
  const sideM = lam(`ms${si % 4}`, () => ({ map: rep(plasterTex(`pl${si % 4}`, st.plaster), 2, 1) }));
  const m = M4(x, 0, z, yaw), hw = w / 2, hd = d / 2;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), sideM, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), sideM, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), sideM, m);
  // mid eave (hisashi) over the ground floor
  const roofM = lam("jroof", () => ({ map: rep(tileRoofTex(), 1, 1), side: THREE.DoubleSide }));
  const ey = h * 0.47;
  b.add(quad(V(-hw - 0.1, ey, hd + 0.9), V(hw + 0.1, ey, hd + 0.9), V(hw + 0.1, ey + 0.55, hd), V(-hw - 0.1, ey + 0.55, hd), w / 3, 0.4), roofM, m);
  // main gabled roof, ridge along x
  const rh = d * 0.32, o = 0.7;
  b.add(quad(V(-hw - o, h - 0.2, hd + o), V(hw + o, h - 0.2, hd + o), V(hw + o, h + rh, 0), V(-hw - o, h + rh, 0), w / 3, 1.4), roofM, m);
  b.add(quad(V(hw + o, h - 0.2, -hd - o), V(-hw - o, h - 0.2, -hd - o), V(-hw - o, h + rh, 0), V(hw + o, h + rh, 0), w / 3, 1.4), roofM, m);
  const gable = solid("gable" + st.plaster, st.plaster);
  b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), gable, m);
  b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), gable, m);
  b.add(boxGeo(V(-hw - o, h + rh - 0.08, -0.22), V(hw + o, h + rh + 0.26, 0.22)), solid("ridge", "#3d414c"), m); // ridge tiles
  b.add(boxGeo(V(-hw - 0.05, 0, hd - 0.05), V(hw + 0.05, 0.25, hd + 0.12)), solid("sill", "#6f6458"), m);
};
/** simple far house: box + pyramid-ish roof (harbour slopes) */
const farHouse = (b: Batch, x: number, y: number, z: number, w: number, d: number, h: number, si: number) => {
  const walls = ["#efe6d2", "#e3d6bc", "#d9c7a6", "#f2ead8"];
  b.add(boxGeo(V(x - w / 2, y - 2, z - d / 2), V(x + w / 2, y + h, z + d / 2)), solid("fh" + (si % 4), walls[si % 4]));
  const rf = new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, h * 0.6, 4, 1); rf.rotateY(Math.PI / 4); rf.scale(w / Math.hypot(w, d) * 1.41, 1, d / Math.hypot(w, d) * 1.41);
  b.add(rf, solid("fhr" + (si % 3), ["#4f5566", "#5d6273", "#454a5a"][si % 3]), M4(x, y + h + h * 0.3, z));
};
const hill = (b: Batch, x: number, z: number, sx: number, sy: number, sz: number, col: string, y = -2) =>
  b.add(new THREE.SphereGeometry(1, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2), solid("hill" + col, col), M4(x, y, z, 0, [sx, sy, sz]));
const hillY = (x: number, z: number, cx: number, cz: number, sx: number, sy: number, sz: number, y0 = -2) => {
  const k = 1 - ((x - cx) / sx) ** 2 - ((z - cz) / sz) ** 2;
  return k > 0 ? y0 + sy * Math.sqrt(k) : -Infinity;
};
const tree = (b: Batch, kit: Kit, x: number, z: number, h: number, kind = "tree_oak", y = 0) => prop(b, kit, kind, x, y, z, h, x * 0.37 + z);
/** blossom tree: trunk + pink lobes */
const blossom = (b: Batch, x: number, z: number, h: number, seed: number) => {
  const r = rng(seed), bark = solid("bark2", "#6e4a36");
  b.add(cyl(0.32, 0.22, h * 0.55, 10), bark, M4(x, 0, z));
  for (const [dx, dz, a] of [[0.6, 0.2, 0.7], [-0.7, -0.1, -0.8], [0.1, -0.6, 0.2]] as const)
    b.add(cyl(0.12, 0.08, h * 0.32, 8), bark, new THREE.Matrix4().compose(V(x + dx * 0.4, h * 0.45, z + dz * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(dz * 0.8, 0, -a * 0.8)), V(1, 1, 1)));
  const pinks = ["#f48fc0", "#f7a6d0", "#ec7fb5"];
  for (let i = 0; i < 11; i++) {
    const a = r() * 6.28, d = r() * h * 0.38, rad = h * (0.17 + r() * 0.1);
    b.add(new THREE.SphereGeometry(1, 18, 12), lam("blos" + (i % 3), () => ({ color: pinks[i % 3] })), M4(x + Math.cos(a) * d, h * (0.68 + r() * 0.22), z + Math.sin(a) * d, 0, [rad, rad * 0.82, rad]));
  }
};
const pole = (b: Batch, x: number, z: number, h: number) => {
  const wood = solid("pole", "#5b4636");
  b.add(cyl(0.13, 0.1, h, 8), wood, M4(x, 0, z));
  b.add(boxGeo(V(x - 0.9, h - 0.6, z - 0.06), V(x + 0.9, h - 0.48, z + 0.06)), wood);
  for (const dx of [-0.7, -0.25, 0.25, 0.7]) b.add(cyl(0.05, 0.05, 0.14, 6), solid("insul", "#e8e2d4"), M4(x + dx, h - 0.48, z));
};
const wire = (b: Batch, a: V3, c: V3, n = 10, sag = 0.5) => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push(V(a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (c[2] - a[2]) * u)); }
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[i + 1], L = p.distanceTo(q);
    const g = new THREE.CylinderGeometry(0.025, 0.025, L, 4).translate(0, L / 2, 0);
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), q.clone().sub(p).normalize()), V(1, 1, 1));
    b.add(g, solid("wire", "#1e1b22"), m);
  }
};

// ---------------- handles for moving parts ----------------
export type Train = { g: THREE.Group; smokeAt: () => THREE.Vector3; place: (z: number) => void };
export type Sets = {
  zones: Record<string, THREE.Group>;
  train: Train; plane: THREE.Group; hanko: THREE.Group; seal: THREE.Mesh; paper: THREE.Mesh; certTex: THREE.Texture; noteTex: THREE.Texture;
  lanterns: { m: THREE.Group; x0: number; z: number; k: number }[]; view: THREE.MeshBasicMaterial; fireGlow: THREE.Mesh; windowGlow: THREE.MeshBasicMaterial;
};

export function buildSets(kit: Kit): Sets {
  const zones: Record<string, THREE.Group> = {};
  for (const z of ["rail", "street", "field", "office", "camp", "garden"]) zones[z] = new THREE.Group();

  // ======== RAIL: fields, track, poles, hills, Nagasaki harbour ahead (-z) ========
  {
    const b = new Batch(), R = zones.rail, r = rng(5);
    b.add(ground(-1500, 1500, -1500, 400, 0, 600, 380), lam("grassR", () => ({ map: grassHD() })));
    const paddy = lam("paddy", () => ({ map: paddyTex() }));
    for (let z = 120; z > -540; z -= 46) for (const s of [-1, 1]) {
      const x0 = s * (6 + (Math.floor((z + 1000) / 46) % 2) * 2), x1 = s * (60 + r() * 30);
      b.add(ground(Math.min(x0, x1), Math.max(x0, x1), z - 42, z, 0.03, 4, 3), paddy);
      b.add(boxGeo(V(Math.min(x0, x1), 0, z - 0.5), V(Math.max(x0, x1), 0.25, z)), solid("dyke", "#7aa04e")); // paddy dyke
    }
    b.add(ground(-2.4, 2.4, -900, 300, 0.05, 2, 240), lam("gravel", () => ({ map: gravelTex() })));
    const sleeper = solid("sleeper", "#5a4434"), rail = phong("#6f737c", "#c8c8c8", 50);
    for (let z = 300; z > -900; z -= 0.9) b.add(boxGeo(V(-1.35, 0.06, z - 0.12), V(1.35, 0.2, z + 0.12)), sleeper);
    for (const x of [-0.72, 0.72]) b.add(boxGeo(V(x - 0.05, 0.2, -900), V(x + 0.05, 0.34, 300)), rail);
    for (let z = 100; z > -560; z -= 40) { pole(b, -4.6, z, 7.2); wire(b, [-5.3, 6.72, z], [-5.3, 6.72, z - 40], 8, 0.45); wire(b, [-3.9, 6.72, z], [-3.9, 6.72, z - 40], 8, 0.45); }
    for (const [x, z, sx, sy, sz, c] of [[-220, -150, 160, 70, 140, "#6aa24e"], [240, -90, 170, 80, 160, "#78b257"], [-300, 160, 200, 60, 160, "#8bbf63"],
      [300, 200, 180, 70, 140, "#6aa24e"], [-150, -420, 110, 55, 120, "#78b257"], [170, -380, 120, 60, 110, "#6aa24e"]] as const) hill(b, x, z, sx, sy, sz, c);
    for (let i = 0; i < 70; i++) { const s = r() < 0.5 ? -1 : 1, x = s * (14 + r() * 140), z = 150 - r() * 680; if (x > 10 && x < 45 && z > -40 && z < 20) continue; tree(b, kit, x, z, 6 + r() * 5, r() < 0.3 ? "tree_cone" : "tree_oak"); }
    for (let i = 0; i < 6; i++) { const z = 60 - i * 95, s = i % 2 ? 1 : -1; farHouse(b, s * (24 + r() * 30), 0, z, 6, 5, 3, i); }
    // Nagasaki: bay + hills + houses terraced up the slopes
    b.add(ground(-260, 260, -980, -640, -0.6, 40, 30), lam("bay", () => ({ color: "#2f86b8" })));
    b.add(ground(-80, 80, -650, -560, 0.02, 20, 12), lam("town", () => ({ map: rep(dirtTex(), 10, 6) })));
    const HL: [number, number, number, number, number, string][] = [[-150, -700, 120, 80, 150, "#6aa24e"], [150, -690, 120, 90, 150, "#78b257"], [0, -1050, 260, 120, 140, "#5d9446"], [-330, -900, 150, 100, 160, "#6aa24e"], [330, -880, 150, 110, 160, "#78b257"]];
    for (const h of HL) hill(b, h[0], h[1], h[2], h[3], h[4], h[5]);
    for (let i = 0; i < 260; i++) {
      const x = (r() - 0.5) * 360, z = -560 - r() * 260;
      let y = 0;
      for (const h of HL) y = Math.max(y, hillY(x, z, h[0], h[1], h[2], h[3], h[4]));
      if (y < 0.5 && (z < -640 || Math.abs(x) > 80)) continue; // the bay
      if (y > 45) continue;
      farHouse(b, x, y, z, 6 + r() * 4, 5 + r() * 3, 3 + r() * 2, i);
    }
    for (let i = 0; i < 60; i++) { const x = (r() - 0.5) * 500, z = -600 - r() * 400; let y = -1; for (const h of HL) y = Math.max(y, hillY(x, z, h[0], h[1], h[2], h[3], h[4])); if (y > 30) tree(b, kit, x, z, 9 + r() * 5, "tree_oak", y - 1); }
    b.build(R);
  }
  // the train (own group; place(z) puts the locomotive nose at z)
  const train: Train = (() => {
    const g = new THREE.Group(), b = new Batch();
    const black = phong("#2a2b31", "#7a7a80", 40), red = solid("wheelRed", "#a8352e"), body = solid("carriage", "#5a3428"), roof = solid("croof", "#3b3a40"), trim = solid("ctrim", "#d9c27a");
    // locomotive (nose at z 0, runs toward -z)
    const boiler = new THREE.CylinderGeometry(1.05, 1.05, 7.2, 20); boiler.rotateX(Math.PI / 2);
    b.add(boiler, black, M4(0, 2.35, 4.0));
    b.add(cyl(0.32, 0.38, 1.2, 12), black, M4(0, 3.3, 1.2)); // chimney
    b.add(cyl(0.42, 0.42, 0.55, 12), solid("dome", "#3a3b42"), M4(0, 3.3, 3.6));
    b.add(boxGeo(V(-1.5, 1.3, 7.4), V(1.5, 4.3, 10.6)), black); // cab
    b.add(boxGeo(V(-1.6, 4.3, 7.2), V(1.6, 4.5, 10.9)), roof);
    b.add(boxGeo(V(-1.45, 0.75, 0.2), V(1.45, 1.3, 11)), black); // frame
    b.add(boxGeo(V(-1.3, 0.3, -0.25), V(1.3, 1.0, 0.3)), red); // buffer beam
    for (const z of [2.2, 4.2, 6.2]) for (const s of [-1, 1]) { const w = new THREE.CylinderGeometry(0.75, 0.75, 0.22, 18); w.rotateZ(Math.PI / 2); b.add(w, red, M4(s * 1.18, 0.78, z)); }
    b.add(boxGeo(V(-1.25, 3.0, 7.9), V(1.25, 3.9, 8.0)), solid("cabwin", "#e6d9a0"));
    // two carriages: z 11.6..26.6 and 27.2..42.2, floor 1.1, windows 1.0 x 0.9 at y 1.75..2.65, every 1.6 m
    const winM = solid("cabin", "#2a2224");
    for (const z0 of [11.6, 27.2]) {
      const z1 = z0 + 15, wy0 = 1.75, wy1 = 2.65;
      b.add(boxGeo(V(-1.4, 1.1, z0), V(1.4, wy0, z1)), body);
      b.add(boxGeo(V(-1.4, wy1, z0), V(1.4, 3.4, z1)), body);
      b.add(boxGeo(V(-1.4, 1.1, z1 - 0.1), V(1.4, 3.4, z1)), body); b.add(boxGeo(V(-1.4, 1.1, z0), V(1.4, 3.4, z0 + 0.1)), body); // end walls
      for (let zz = z0; zz < z1 - 0.05; zz += 1.6) for (const s of [-1, 1]) b.add(boxGeo(V(s * 1.4 - 0.05, wy0, zz), V(s * 1.4 + 0.05, wy1, zz + 0.6)), body); // piers between windows
      b.add(boxGeo(V(-1.38, 1.15, z0 + 0.05), V(-1.3, 3.35, z1 - 0.05)), winM); // dark interior behind the -x windows only
      b.add(boxGeo(V(-1.25, 1.1, z0 + 0.1), V(1.25, 1.15, z1 - 0.1)), winM); // floor
      b.add(boxGeo(V(-1.25, 3.3, z0 + 0.1), V(1.25, 3.38, z1 - 0.1)), winM);
      b.add(boxGeo(V(-1.25, 1.15, z0 + 0.06), V(1.25, 3.3, z0 + 0.1)), winM); b.add(boxGeo(V(-1.25, 1.15, z1 - 0.1), V(1.25, 3.3, z1 - 0.06)), winM);
      b.add(boxGeo(V(-1.42, wy0 - 0.12, z0), V(1.42, wy0 - 0.02, z1)), trim);
      const rf = new THREE.CylinderGeometry(2.0, 2.0, 15.2, 20, 1, false, -0.8, 1.6); rf.rotateX(-Math.PI / 2);
      b.add(rf, roof, M4(0, 2.0, z0 + 7.5));
      b.add(boxGeo(V(-1.2, 0.5, z0 + 0.3), V(1.2, 1.1, z1 - 0.3)), black);
      for (const z of [z0 + 2, z0 + 3.4, z1 - 3.4, z1 - 2]) for (const s of [-1, 1]) { const w = new THREE.CylinderGeometry(0.45, 0.45, 0.2, 16); w.rotateZ(Math.PI / 2); b.add(w, red, M4(s * 1.05, 0.48, z)); }
    }
    b.build(g);
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.frustumCulled = false; });
    zones.rail.add(g);
    return { g, smokeAt: () => V(0, 4.0, g.position.z + 1.2), place: (z: number) => { g.position.set(0, 0, z); } };
  })();

  // ======== STREET: Hiroshima street (z +34..-96), shipyard (z < -100), river (z 40..60) ========
  {
    const b = new Batch(), R = zones.street, r = rng(9);
    b.add(ground(-600, 600, -100, 38, 0, 240, 28), lam("dirt", () => ({ map: dirtTex() })));
    b.add(ground(-4.2, 4.2, -100, 38, 0.02, 2, 34), lam("road", () => ({ map: rep(dirtTex(), 1, 1), color: "#d8c4a4" })));
    for (const s of [-1, 1]) b.add(boxGeo(V(s * 4.2 - 0.2, -0.05, -100), V(s * 4.2 + 0.2, 0.08, 38)), solid("gutter", "#8d8378"));
    for (const s of [-1, 1]) {
      let z = 34;
      let i = 0;
      while (z > -96) {
        const w = [6, 7, 8][Math.floor(r() * 3)], h = [5.6, 6.2, 6.6][Math.floor(r() * 3)];
        machiya(b, s * (4.5 + 4), z - w / 2, s < 0 ? Math.PI / 2 : -Math.PI / 2, w, 8, h, i * 3 + (s > 0 ? 1 : 0));
        z -= w + (r() < 0.15 ? 1.5 : 0.1); i++;
      }
      for (let z2 = 30; z2 > -96; z2 -= 18) { pole(b, s * 4.5, z2, 7.4); wire(b, [s * 4.5, 6.92, z2], [s * 4.5, 6.92, z2 - 18], 6, 0.35); }
    }
    // back rows of roofs (seen from the sky shot)
    for (let i = 0; i < 40; i++) { const s = r() < 0.5 ? -1 : 1, x = s * (18 + r() * 60), z = 30 - r() * 105; if (z < -78) continue; machiya(b, x, z, s < 0 ? Math.PI / 2 : -Math.PI / 2, 7, 8, 6, i + 5); }
    // street clock on a pole
    const clk = CLOCK_AT;
    b.add(cyl(0.09, 0.08, 3.1, 10), solid("clkpole", "#2f3238"), M4(clk[0], 0, clk[2]));
    b.add(boxGeo(V(clk[0] - 0.12, 3.0, clk[2] - 0.42), V(clk[0] + 0.12, 3.9, clk[2] + 0.42)), solid("clkbox", "#2f3238"));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.38, 32), new THREE.MeshBasicMaterial({ map: clockFace(), color: new THREE.Color(0.92, 0.92, 0.92) }));
    face.position.set(clk[0] + 0.13, 3.45, clk[2]); face.rotation.y = Math.PI / 2; R.add(face);
    // shipyard: concrete apron, ship on the slip (hull along x), gantry crane, harbour water
    b.add(ground(-120, 120, -160, -100, 0.01, 30, 8), lam("apron", () => ({ color: "#b9b2a6" })));
    const hullM = lam("hull", () => ({ map: hullTex() }));
    const hx0 = -24, hx1 = 30, hz = -128, hb = 5, hh = 9;
    b.add(quad(V(hx0, 0, hz + hb), V(hx1, 0, hz + hb), V(hx1, hh, hz + hb), V(hx0, hh, hz + hb), 3, 1), hullM);
    b.add(quad(V(hx1, 0, hz - hb), V(hx0, 0, hz - hb), V(hx0, hh, hz - hb), V(hx1, hh, hz - hb), 3, 1), hullM);
    b.add(quad(V(hx1, 0, hz + hb), V(hx1 + 9, 0.5, hz), V(hx1 + 9, hh + 1, hz), V(hx1, hh, hz + hb), 0.5, 1), hullM); // bow
    b.add(quad(V(hx1 + 9, 0.5, hz), V(hx1, 0, hz - hb), V(hx1, hh, hz - hb), V(hx1 + 9, hh + 1, hz), 0.5, 1), hullM);
    b.add(quad(V(hx0, 0, hz - hb), V(hx0, 0, hz + hb), V(hx0, hh, hz + hb), V(hx0, hh, hz - hb), 0.3, 1), hullM);
    b.add(ground(hx0, hx1, hz - hb, hz + hb, hh, 4, 1), solid("deck", "#8a7a66"));
    b.add(tri(V(hx1, hh, hz + hb), V(hx1 + 9, hh + 1, hz), V(hx1, hh, hz - hb)), solid("deck", "#8a7a66"));
    b.add(boxGeo(V(hx0 + 3, hh, hz - 3.5), V(hx0 + 13, hh + 5, hz + 3.5)), solid("bridgeHouse", "#efe9dc"));
    b.add(cyl(1.2, 1.1, 5, 14), solid("funnel", "#2b2e36"), M4(hx0 + 8, hh + 5, hz));
    for (let x = hx0; x < hx1; x += 5) b.add(boxGeo(V(x, 0, hz + hb + 1.2), V(x + 0.2, hh + 2, hz + hb + 1.4)), solid("scaff", "#7a6a58"));
    b.add(boxGeo(V(hx0, hh + 1.8, hz + hb + 1.15), V(hx1, hh + 2.0, hz + hb + 1.45)), solid("scaff", "#7a6a58"));
    const craneM = solid("crane", "#c75a35");
    for (const [x, z] of [[40, -112], [48, -112], [40, -142], [48, -142]]) b.add(boxGeo(V(x - 0.5, 0, z - 0.5), V(x + 0.5, 30, z + 0.5)), craneM);
    for (const z of [-112, -142]) b.add(boxGeo(V(39, 29, z - 0.6), V(49, 31, z + 0.6)), craneM);
    b.add(boxGeo(V(-20, 31, -128.8), V(52, 33, -126.2)), craneM);
    b.add(boxGeo(V(38, 31, -144), V(50, 35, -110)), craneM);
    b.add(boxGeo(V(41, 35, -131), V(47, 39, -125)), solid("craneCab", "#e9e1cf"));
    for (let x = -20; x < 52; x += 4) b.add(boxGeo(V(x, 30.6, -128.6), V(x + 0.3, 33.2, -126.4)), craneM);
    b.add(ground(-600, 600, -800, -160, -0.8, 60, 40), lam("harbour", () => ({ color: "#2f86b8" })));
    hill(b, -200, -520, 240, 110, 160, "#6aa24e"); hill(b, 220, -480, 220, 90, 150, "#78b257");
    // river across the top of the street + far bank
    b.add(ground(-600, 600, 40, 62, -1.3, 60, 4), lam("river", () => ({ color: "#1b4a72" })));
    for (const z0 of [38, 62]) b.add(boxGeo(V(-600, -1.4, z0 - (z0 > 50 ? 0 : 2)), V(600, 0, z0 + (z0 > 50 ? 2 : 0))), lam("embank", () => ({ map: rep(plasterTex("stoneP", "#b8ad9c"), 60, 1) })));
    b.add(ground(-600, 600, 64, 300, 0, 120, 40), lam("dirtFar", () => ({ map: dirtTex() })));
    for (let i = 0; i < 22; i++) machiya(b, -110 + i * 10, 72, Math.PI, 8, 8, 6, i + 30);
    for (let i = 0; i < 10; i++) tree(b, kit, -60 + i * 13 + r() * 4, 66, 6 + r() * 2);
    b.build(R);
  }
  // B-29 (silver, flying +x at ~300 m)
  const plane = (() => {
    const g = new THREE.Group(), b = new Batch(), sil = phong("#c9ced6", "#ffffff", 80);
    const fus = new THREE.CylinderGeometry(1.5, 1.2, 30, 16); fus.rotateZ(Math.PI / 2); b.add(fus, sil);
    const nose = new THREE.SphereGeometry(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2); nose.rotateZ(-Math.PI / 2); b.add(nose, sil, M4(15, 0, 0));
    b.add(boxGeo(V(-2.5, -0.25, -21.5), V(2.5, 0.25, 21.5)), sil, M4(2, -0.3, 0));
    b.add(boxGeo(V(-1.6, -0.15, -7), V(1.6, 0.15, 7)), sil, M4(-13.5, 0.5, 0));
    b.add(boxGeo(V(-2.5, 0, -0.18), V(1.5, 7, 0.18)), sil, M4(-13.5, 0.5, 0));
    for (const z of [-13, -6.5, 6.5, 13]) { const n = new THREE.CylinderGeometry(0.8, 0.8, 5, 12); n.rotateZ(Math.PI / 2); b.add(n, sil, M4(3, -0.4, z)); }
    b.build(g, false);
    g.visible = false; zones.street.add(g);
    return g;
  })();

  // ======== FIELD: open dusty plain, hills, a shelter mound ========
  {
    const b = new Batch(), R = zones.field, r = rng(13);
    b.add(ground(-2000, 2000, -2000, 400, 0, 600, 360), lam("dust", () => ({ map: dustTex() })));
    for (const [x, z, sx, sy, sz, c] of [[-260, -380, 220, 70, 160, "#8a8a52"], [260, -420, 240, 80, 170, "#7d8a4e"], [0, -620, 380, 110, 180, "#6f7e48"],
      [-460, -160, 200, 60, 170, "#8a8a52"], [440, -120, 180, 70, 160, "#7d8a4e"]] as const) hill(b, x, z, sx, sy, sz, c);
    for (let i = 0; i < 30; i++) { const x = (r() - 0.5) * 300, z = -30 - r() * 250; if (Math.abs(x) < 8 && z > -40) continue; tree(b, kit, x, z, 4 + r() * 4, r() < 0.5 ? "tree_fat" : "tree_oak"); }
    for (let i = 0; i < 26; i++) { const x = (r() - 0.5) * 40, z = 6 - r() * 40; const s = 0.2 + r() * 0.5; b.add(new THREE.SphereGeometry(1, 10, 8), solid("rock", "#8d7f70"), M4(x, 0, z, r() * 3, [s * 1.3, s * 0.7, s])); }
    // shelter: earth mound with a timber-framed entrance facing the camera of shot 14
    const sx = 8.2, sz = -4.6;
    b.add(new THREE.SphereGeometry(1, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2), lam("mound", () => ({ map: rep(dustTex(), 1, 1), color: "#9a8a6a" })), M4(sx, 0, sz, 0, [3.2, 2.2, 3.2]));
    const tim = solid("timber", "#5a4434");
    const ry = Math.atan2(2.4 - sx, 8.5 - sz), fr = M4(sx, 0, sz, ry);
    const fz = 2.6;
    b.add(boxGeo(V(-0.72, 0, fz - 0.1), V(-0.56, 1.25, fz + 0.1)), tim, fr); b.add(boxGeo(V(0.56, 0, fz - 0.1), V(0.72, 1.25, fz + 0.1)), tim, fr);
    b.add(boxGeo(V(-0.8, 1.22, fz - 0.12), V(0.8, 1.36, fz + 0.12)), tim, fr);
    b.add(quad(V(-0.56, 0, fz - 0.04), V(0.56, 0, fz - 0.04), V(0.56, 1.22, fz - 0.04), V(-0.56, 1.22, fz - 0.04)), solid("dark", "#141018"), fr);
    b.build(R);
  }

  // ======== OFFICE: drafting room x -7..7, z -5..5, y 0..3.4; windows in the back wall ========
  const officeView = new THREE.MeshBasicMaterial({ map: viewTex(), fog: false, toneMapped: true });
  const windowGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const hanko = new THREE.Group();
  let seal: THREE.Mesh, paper: THREE.Mesh;
  const noteTex = paperTex(false), certTex = paperTex(true);
  {
    const b = new Batch(), R = zones.office;
    const floor = lam("ofloor", () => ({ map: rep(planksHD(), 1.2, 1.2) }));
    b.add(ground(-7, 7, -5, 5, 0, 1, 1), floor);
    const wallM = lam("owall", () => ({ map: rep(plasterTex("owallP", "#ece0c4"), 3, 1) })), wain = solid("wain", "#6a4a34"), ceil = solid("ceil", "#f2ead8");
    // back wall with three windows (x centres -4.5, 0, 4.5; 2.6 wide; sill 0.9, head 2.9)
    const segs: [number, number][] = [[-7, -5.8], [-3.2, -1.3], [1.3, 3.2], [5.8, 7]];
    for (const [x0, x1] of segs) b.add(boxGeo(V(x0, 0, -5.2), V(x1, 3.4, -5)), wallM);
    for (const xc of [-4.5, 0, 4.5]) {
      b.add(boxGeo(V(xc - 1.3, 0, -5.2), V(xc + 1.3, 0.9, -5)), wallM);
      b.add(boxGeo(V(xc - 1.3, 2.9, -5.2), V(xc + 1.3, 3.4, -5)), wallM);
      const fr = solid("wframe", "#4a3226");
      b.add(boxGeo(V(xc - 1.32, 0.86, -5.25), V(xc + 1.32, 0.96, -4.9)), fr); b.add(boxGeo(V(xc - 1.32, 2.86, -5.25), V(xc + 1.32, 2.94, -4.95)), fr);
      b.add(boxGeo(V(xc - 0.04, 0.9, -5.12), V(xc + 0.04, 2.9, -5.08)), fr);
      for (const y of [1.55, 2.22]) b.add(boxGeo(V(xc - 1.3, y - 0.03, -5.12), V(xc + 1.3, y + 0.03, -5.08)), fr);
      for (const s of [-1, 1]) b.add(boxGeo(V(xc + s * 0.65 - 0.025, 0.9, -5.12), V(xc + s * 0.65 + 0.025, 2.9, -5.08)), fr);
    }
    for (const x of [-7, 7]) b.add(boxGeo(V(x - (x < 0 ? 0.2 : 0), 0, -5.2), V(x + (x > 0 ? 0.2 : 0), 3.4, 5.2)), wallM);
    b.add(boxGeo(V(-7, 0, 5), V(7, 3.4, 5.2)), wallM);
    b.add(boxGeo(V(-7, 3.4, -5.2), V(7, 3.6, 5.2)), ceil);
    for (const [x0, z0, x1, z1] of [[-7, -5.0, 7, -4.94], [-6.96, -5, -6.9, 5], [6.9, -5, 6.96, 5]] as const) b.add(boxGeo(V(x0, 0, z0), V(x1, 0.95, z1)), wain);
    for (const x of [-3.5, 0, 3.5]) { b.add(cyl(0.02, 0.02, 0.6, 6), solid("cord", "#222"), M4(x, 2.8, 0)); b.add(new THREE.ConeGeometry(0.32, 0.26, 16, 1, true), solid("shade", "#2f5f4a"), M4(x, 2.75, 0)); }
    // desks: drafting tables (tilted boards) and the boss's desk
    const deskM = solid("desk", "#7a5236"), board = solid("board", "#efe6cf"), leg = solid("leg", "#4a3226");
    const drafting = (x: number, z: number, ry: number) => {
      const m = M4(x, 0, z, ry);
      for (const [lx, lz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) b.add(boxGeo(V(lx - 0.04, 0, lz - 0.04), V(lx + 0.04, 0.95, lz + 0.04)), leg, m);
      b.add(boxGeo(V(-0.75, 0.0, -0.45), V(0.75, 0.05, 0.45)), board, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().compose(V(0, 1.0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0, 0)), V(1, 1, 1))));
    };
    drafting(-3.9, -1.7, 0.3); drafting(-5.4, -2.9, 0.2); drafting(5.3, -3.0, -0.2); drafting(-1.6, -3.4, 0); drafting(4.6, 1.4, -0.4);
    b.add(boxGeo(V(1.6, 0.74, -0.15), V(3.5, 0.8, 0.75)), deskM);
    for (const [x, z] of [[1.7, -0.05], [3.4, -0.05], [1.7, 0.65], [3.4, 0.65]]) b.add(boxGeo(V(x - 0.05, 0, z - 0.05), V(x + 0.05, 0.74, z + 0.05)), leg);
    b.add(boxGeo(V(1.62, 0.2, 0.6), V(3.48, 0.74, 0.72)), deskM); // modesty panel toward the room
    b.add(boxGeo(V(2.0, 0.8, 0.1), V(2.5, 0.84, 0.45)), solid("papers", "#f4efe2"));
    b.add(boxGeo(V(6.2, 0, -1), V(6.9, 1.6, 0.2)), solid("cab", "#5a6a5a")); // filing cabinet
    b.add(boxGeo(V(-6.9, 2.0, 1.5), V(-6.86, 2.6, 2.3)), lam("chart", () => ({ map: paperTex(false) })));
    // insert desk: desktop, ink pad, the paper
    const d = DESK_INSERT;
    b.add(boxGeo(V(d[0] - 0.8, d[1] - 0.06, d[2] - 0.5), V(d[0] + 0.8, d[1], d[2] + 0.5)), lam("insertDesk", () => ({ map: rep(planksHD(), 0.3, 0.3) })));
    for (const [lx, lz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) b.add(boxGeo(V(d[0] + lx - 0.04, 0, d[2] + lz - 0.04), V(d[0] + lx + 0.04, d[1] - 0.06, d[2] + lz + 0.04)), leg);
    b.add(boxGeo(V(d[0] + 0.22, d[1], d[2] - 0.2), V(d[0] + 0.4, d[1] + 0.025, d[2] - 0.08)), solid("pad", "#b8302c"));
    b.add(boxGeo(V(d[0] - 0.55, d[1], d[2] - 0.25), V(d[0] - 0.42, d[1] + 0.012, d[2] + 0.2)), solid("pencil", "#e0b040"));
    b.build(R);
    paper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), lam("paperM", () => ({ map: noteTex })));
    paper.rotation.x = -Math.PI / 2; paper.position.set(d[0] - 0.05, d[1] + 0.003, d[2] + 0.02); paper.receiveShadow = true; R.add(paper);
    seal = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshBasicMaterial({ map: ctex("sealTex", 256, 256, (g) => fxSeal(new Pen(g))), transparent: true, depthWrite: false }));
    seal.rotation.x = -Math.PI / 2; seal.position.set(d[0] + 0.08, d[1] + 0.005, d[2] + 0.06); seal.layers.set(NOINK); R.add(seal);
    // the hanko: ivory cylinder with a red base, positioned per frame by world.ts
    const hb = new Batch();
    hb.add(cyl(0.017, 0.016, 0.068, 18), phong("#efe6cf", "#ffffff", 30));
    hb.add(cyl(0.0175, 0.0175, 0.006, 18), solid("hankoRed", "#b8302c"));
    hb.build(hanko, true);
    R.add(hanko);
    const view = new THREE.Mesh(new THREE.PlaneGeometry(44, 22), officeView); view.position.set(0, 3.5, -14); view.layers.set(NOINK); R.add(view);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.4), windowGlow); gl.position.set(0, 1.9, -5.6); gl.layers.set(NOINK); gl.renderOrder = 6; R.add(gl);
  }

  // ======== CAMP: night clearing, fire at the origin, distance targets at x 60..94 ========
  let fireGlow: THREE.Mesh;
  {
    const b = new Batch(), R = zones.camp, r = rng(17);
    b.add(ground(-600, 600, -600, 600, 0, 240, 240), lam("grassC", () => ({ map: grassHD() })));
    for (let i = 0; i < 46; i++) { const a = r() * 6.28, d = 9 + r() * 16; if (Math.cos(a) > 0.55 && Math.abs(Math.sin(a)) < 0.7) continue; tree(b, kit, Math.cos(a) * d, Math.sin(a) * d, 6 + r() * 5, r() < 0.4 ? "tree_cone" : "tree_oak"); }
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; b.add(new THREE.SphereGeometry(1, 12, 8), solid("stone", "#8a8890"), M4(Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62, a, [0.2, 0.14, 0.17])); }
    for (const a of [0.3, 1.4, 2.5]) { const l = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 10); l.rotateZ(Math.PI / 2); b.add(l, solid("log", "#6e4a36"), M4(0, 0.12, 0, a)); }
    const lg = new THREE.CylinderGeometry(0.22, 0.22, 1.8, 14); lg.rotateZ(Math.PI / 2); b.add(lg, solid("log2", "#7a5236"), M4(3.3, 0.22, -2.6, 0.6));
    for (let i = 0; i < 14; i++) { const a = r() * 6.28; const x = 77 + Math.cos(a) * 44, z = Math.sin(a) * 50; if (z > 20) continue; tree(b, kit, x, z, 6 + r() * 4, "tree_cone"); }
    b.build(R);
    fireGlow = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), new THREE.MeshBasicMaterial({ map: ctex("fireGlowTex", 256, 256, (g) => {
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(255,170,80,0.9)"); gr.addColorStop(0.35, "rgba(255,120,50,0.45)"); gr.addColorStop(1, "rgba(255,90,40,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    fireGlow.rotation.x = -Math.PI / 2; fireGlow.position.y = 0.04; fireGlow.layers.set(NOINK); R.add(fireGlow);
  }

  // ======== GARDEN: golden lawn, blossom tree + bench, hill with a tunnel, podium with paper cranes ========
  {
    const b = new Batch(), R = zones.garden, r = rng(21);
    b.add(ground(-800, 800, -800, 400, 0, 320, 240), lam("grassG", () => ({ map: grassHD() })));
    blossom(b, BENCH[0] + 1.0, BENCH[2] - 1.6, 5.2, 3);
    blossom(b, BENCH[0] - 5.5, BENCH[2] - 4.5, 4.6, 7);
    const wood = solid("bench", "#8a5a34"), iron = solid("benchIron", "#2f3238");
    const bx = BENCH[0], bz = BENCH[2];
    b.add(boxGeo(V(bx - 0.95, 0.43, bz - 0.25), V(bx + 0.95, 0.49, bz + 0.25)), wood);
    b.add(boxGeo(V(bx - 0.95, 0.6, bz - 0.3), V(bx + 0.95, 0.9, bz - 0.25)), wood);
    for (const s of [-1, 1]) { b.add(boxGeo(V(bx + s * 0.85 - 0.04, 0, bz - 0.25), V(bx + s * 0.85 + 0.04, 0.43, bz + 0.25)), iron); b.add(boxGeo(V(bx + s * 0.85 - 0.04, 0.43, bz - 0.3), V(bx + s * 0.85 + 0.04, 0.9, bz - 0.25)), iron); }
    for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 14 + r() * 40; const x = bx + Math.cos(a) * d, z = bz - Math.abs(Math.sin(a)) * d - 4; if (Math.hypot(x - TUNNEL[0], z - TUNNEL[2]) < 16 || Math.hypot(x - PODIUM[0], z - PODIUM[2]) < 9 || Math.hypot(x - AWARD[0], z - AWARD[2]) < 6) continue; tree(b, kit, x, z, 6 + r() * 4, r() < 0.3 ? "tree_cone" : "tree_oak"); }
    for (let i = 0; i < 18; i++) { const x = -6 + r() * 12; prop(b, kit, "plant_bush", x, 0, bz - 7 - r() * 3, 0.9 + r() * 0.5); }
    // tunnel hill
    const tx = TUNNEL[0], tz = TUNNEL[2];
    b.add(new THREE.SphereGeometry(1, 34, 18, 0, Math.PI * 2, 0, Math.PI / 2), lam("tHill", () => ({ map: grassHD() })), M4(tx, -6, tz - 20.6, 0, [26, 20, 20]));
    const stone = lam("archStone", () => ({ map: rep(plasterTex("archP", "#b9b0a2"), 2, 2) }));
    b.add(boxGeo(V(tx - 2.6, 0, tz - 1.6), V(tx - 1.6, 3.2, tz + 0.3)), stone); b.add(boxGeo(V(tx + 1.6, 0, tz - 1.6), V(tx + 2.6, 3.2, tz + 0.3)), stone);
    const arch = new THREE.TorusGeometry(2.1, 0.5, 10, 24, Math.PI); arch.scale(1, 1, 1.4); b.add(arch, stone, M4(tx, 3.1, tz - 0.3));
    b.add(boxGeo(V(tx - 3.0, 4.7, tz - 1.6), V(tx + 3.0, 5.9, tz + 0.2)), stone);
    const hole = new THREE.Shape(); hole.moveTo(-1.6, 0); hole.lineTo(1.6, 0); hole.lineTo(1.6, 3.1); hole.absarc(0, 3.1, 1.6, 0, Math.PI, false); hole.lineTo(-1.6, 0);
    b.add(new THREE.ShapeGeometry(hole, 16), solid("tunnelDark", "#1a1418"), M4(tx, 0, tz + 0.1));
    // podium: wooden lectern + microphone, low stage
    const px = PODIUM[0], pz = PODIUM[2];
    b.add(boxGeo(V(px - 3.5, 0, pz - 2.2), V(px + 3.5, 0.35, pz + 1.6)), solid("stage", "#8a5a34"));
    b.add(boxGeo(V(px - 0.55, 0.35, pz + 0.55), V(px + 0.55, 1.2, pz + 1.0)), solid("lectern", "#8a5a34"));
    b.add(boxGeo(V(px - 0.62, 1.2, pz + 0.45), V(px + 0.62, 1.27, pz + 1.06)), solid("lecternTop", "#6e4630"));
    b.add(cyl(0.012, 0.012, 0.36, 6), solid("mic", "#2a2b31"), new THREE.Matrix4().compose(V(px + 0.42, 1.25, pz + 0.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0, 0.35)), V(1, 1, 1)));
    b.add(new THREE.SphereGeometry(0.04, 10, 8), solid("micHead", "#3a3b42"), M4(px + 0.3, 1.58, pz + 0.47));
    for (let i = 0; i < 7; i++) b.add(boxGeo(V(px - 3.3 + i * 1.1, 0.35, pz - 2.1), V(px - 3.27 + i * 1.1, 4.4, pz - 2.07)), solid("string", "#e8e2d4"));
    b.add(boxGeo(V(px - 3.5, 4.35, pz - 2.15), V(px + 3.5, 4.5, pz - 2.0)), solid("stage", "#8a5a34"));
    for (const s of [-1, 1]) b.add(boxGeo(V(px + s * 3.5 - 0.08, 0, pz - 2.15), V(px + s * 3.5 + 0.08, 4.5, pz - 2.0)), solid("stage", "#8a5a34"));
    // award spot: hedge row behind
    for (let x = AWARD[0] - 6; x < AWARD[0] + 7; x += 3.3) prop(b, kit, "hedge", x, 0, AWARD[2] - 2.6, 1.4);
    b.build(R);
  }

  // lanterns on the river (street zone): paper boxes glowing warm, drifting
  const lanterns: Sets["lanterns"] = [];
  {
    const r = rng(33), paperM = glow(2.4, 1.45, 0.62), baseM = solid("lanternBase", "#5a4434"), capM = solid("lanternCap", "#2a2224");
    const haloTex = ctex("lanternHalo", 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,190,110,0.7)"); gr.addColorStop(1, "rgba(255,150,60,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const haloM = new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.34), paperM); box.position.y = 0.24;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), baseM); base.position.y = 0.03;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.36), capM); cap.position.y = 0.44;
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), haloM); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; halo.layers.set(NOINK);
      m.add(box, base, cap, halo);
      const z = 40.8 + r() * 19, x0 = -70 + r() * 110;
      m.position.set(x0, -1.3, z); m.rotation.y = r() * 6.28;
      zones.street.add(m);
      lanterns.push({ m, x0, z, k: r() });
    }
  }
  return { zones, train, plane, hanko, seal: seal!, paper: paper!, certTex, noteTex, lanterns, view: officeView, fireGlow: fireGlow!, windowGlow };
}
