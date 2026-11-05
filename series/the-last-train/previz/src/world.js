// Halloran Cross sets. Set A = Platform 2 + train (around x=0). Set C = escalator + mezzanine + signal room + shutter (x 184..260).
import * as THREE from 'three';
import { mat } from './people.js';
import * as T from './textures.js';

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
const pos = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const emis = (c, i = 1) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i });

export function buildWorld(scene) {
  const W = {};
  const tile = T.tileWall();
  const floor = T.floorTex();

  // ======================= SET A: PLATFORM 2 =======================
  const A = new THREE.Group(); scene.add(A); W.A = A;
  const mFloor = std({ map: floor, roughness: 0.55 });
  const pf = pos(box(60, 1.2, 6, mFloor), 0, -0.6, 3); A.add(pf);
  const edge = pos(plane(60, 0.35, std({ map: T.edgeStrip() })), 0, 0.003, 0.175); edge.rotation.x = -Math.PI / 2; A.add(edge);
  const trench = pos(box(60, 0.2, 4, std({ color: 0x1b1a19 })), 0, -1.3, -2); A.add(trench);
  for (const z of [-0.9, -2.3]) A.add(pos(box(60, 0.12, 0.08, std({ color: 0x55504a, metalness: 0.7, roughness: 0.35 })), 0, -1.12, z));
  const wallTex = tile.clone(); wallTex.needsUpdate = true; wallTex.repeat.set(30, 1);
  const back = pos(plane(60, 3, std({ map: wallTex })), 0, 1.5, 6); back.rotation.y = Math.PI; A.add(back);
  const nb = T.nameBand('HALLORAN CROSS');
  for (const x of [-12, 0, 12]) { const b = pos(plane(5.2, 0.42, std({ map: nb, roughness: 0.4 })), x, 2.25, 5.98); b.rotation.y = Math.PI; A.add(b); }
  for (let i = 0; i < 6; i++) { const p = pos(plane(0.9, 1.35, std({ map: T.poster(i), roughness: 0.5 })), -15 + i * 6 + 3, 1.15, 5.97); p.rotation.y = Math.PI; A.add(p); }
  // vault
  const vt = tile.clone(); vt.needsUpdate = true; vt.repeat.set(30, 4);
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 60, 32, 1, true, 0, Math.PI), std({ map: vt, color: 0x8a857a, side: THREE.BackSide }));
  vault.rotation.z = Math.PI / 2; vault.scale.set(0.36, 1, 1); vault.position.set(0, 3.0, 1.2); A.add(vault); W.vaultA = vault;
  // platform lights
  W.tubesA = [];
  for (let x = -27; x <= 27; x += 3) { const tb = pos(box(1.4, 0.06, 0.12, emis(0xcfefea, 2.2)), x, 3.95, 2.6); A.add(tb); W.tubesA.push(tb); }
  W.lightsA = [];
  for (const x of [-9, -3, 3, 9]) { const l = new THREE.PointLight(0xcfefea, 9, 14, 1.6); l.position.set(x, 3.6, 2.6); A.add(l); W.lightsA.push(l); }
  W.redA = [];
  for (const x of [-6, 0, 6]) { const l = new THREE.PointLight(0xd7262e, 0, 16, 1.4); l.position.set(x, 3.2, 3.6); A.add(l); W.redA.push(l); const lamp = pos(box(0.3, 0.12, 0.12, emis(0xff1a1a, 0)), x, 3.6, 5.8); A.add(lamp); (W.redLampsA ||= []).push(lamp); }
  W.hemiA = new THREE.HemisphereLight(0x5a7a80, 0x1a1210, 0.55); A.add(W.hemiA);
  // benches
  for (const x of [-8, 8]) A.add(pos(box(2.4, 0.08, 0.5, std({ color: 0x3b2f2a })), x, 0.45, 5.4));
  // departure board (faces +z, toward the back wall)
  W.board = new T.Board();
  const bd = pos(box(1.38, 0.76, 0.14, std({ color: 0x111111 })), 0, 3.25, 2.25); A.add(bd);
  const bf = pos(plane(1.3, 0.677, new THREE.MeshBasicMaterial({ map: W.board.tex, toneMapped: false })), 0, 3.25, 2.322); A.add(bf);
  for (const s of [-0.6, 0.6]) A.add(pos(box(0.03, 0.6, 0.03, std({ color: 0x222222 })), s, 4.0, 2.25));

  // ---- train: centre car with interior, neighbours as shells
  const mExt = std({ map: T.trainSide(), roughness: 0.45, metalness: 0.3 });
  const mInt = std({ color: 0xc9cfd2, roughness: 0.7 });
  const mSeat = std({ color: 0x5b3f86, roughness: 0.9 });
  const train = new THREE.Group(); A.add(train); W.train = train;
  const zf = -0.15, zb = -2.95, H = 2.35;
  // platform-side wall with openings: door x -0.75..0.75 (y 0..2.0); windows y 0.95..1.9 at |x| 1.25..3.75 and 5.25..7.75
  const wallSeg = (x0, x1, y0, y1) => { const m = pos(box(x1 - x0, y1 - y0, 0.06, mExt), (x0 + x1) / 2, (y0 + y1) / 2, zf); train.add(m); };
  wallSeg(-9, 9, 1.9, 3.0); wallSeg(-9, 9, -0.25, 0.0);
  const cols = [[-9, -7.75], [-5.25, -3.75], [-1.25, -0.75], [0.75, 1.25], [3.75, 5.25], [7.75, 9]];
  for (const [a, b] of cols) wallSeg(a, b, 0, 1.9);
  for (const [a, b] of [[-7.75, -5.25], [-3.75, -1.25], [1.25, 3.75], [5.25, 7.75]]) { wallSeg(a, b, 0, 0.95); }
  W.glassA = [];
  const mGlass = std({ color: 0x9fc8d0, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2 });
  for (const [a, b] of [[-7.75, -5.25], [-3.75, -1.25], [1.25, 3.75], [5.25, 7.75]]) { const g = pos(plane(b - a, 0.95, mGlass), (a + b) / 2, 1.425, zf + 0.035); train.add(g); W.glassA.push(g); }
  // cracks
  W.cracks = [];
  const ct = T.crackTex();
  for (const [x, s] of [[2.3, 1.1], [-2.6, 1.0], [6.4, 0.9]]) { const c = pos(plane(s, s, new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.9 })), x, 1.45, zf + 0.04); c.visible = false; train.add(c); W.cracks.push(c); }
  // door leaves (slide along x). Each: lower panel + frame + glass
  W.leaves = [];
  for (const side of [-1, 1]) {
    const lf = new THREE.Group(); train.add(lf);
    lf.add(pos(box(0.75, 1.0, 0.04, mExt), 0, 0.5, 0));
    lf.add(pos(box(0.75, 0.1, 0.04, mExt), 0, 1.95, 0));
    lf.add(pos(box(0.08, 1.0, 0.04, mExt), side * 0.335, 1.45, 0));
    lf.add(pos(box(0.08, 1.0, 0.04, mExt), -side * 0.335, 1.45, 0));
    lf.add(pos(plane(0.6, 0.9, mGlass), 0, 1.45, 0.022));
    lf.add(pos(box(0.04, 2.0, 0.05, std({ color: 0x111111 })), -side * 0.375, 1.0, 0));
    lf.side = side; W.leaves.push(lf);
  }
  W.setDoors = (open) => { for (const lf of W.leaves) lf.position.set(lf.side * (0.375 + open * 0.72), 0, zf + 0.06); };
  W.setDoors(0);
  // interior
  train.add(pos(box(18, 0.05, 2.8, std({ color: 0x3a3a40, roughness: 0.9 })), 0, -0.02, (zf + zb) / 2));
  train.add(pos(box(18, 0.05, 2.8, mInt), 0, H + 0.02, (zf + zb) / 2));
  train.add(pos(box(18, 0.75, 0.06, mInt), 0, 0.37, zb)); train.add(pos(box(18, 0.5, 0.06, mInt), 0, 2.15, zb));
  train.add(pos(plane(18, 1.15, std({ color: 0x050708, roughness: 0.15, metalness: 0.5 })), 0, 1.33, zb + 0.04));
  for (let i = 0; i < 6; i++) train.add(pos(plane(1.6, 0.3, std({ map: T.adPanel(i), roughness: 0.5 })), -7.5 + i * 3, 2.12, zb + 0.04));
  for (const x of [-6, -3, 3, 6]) train.add(pos(box(2.2, 0.45, 0.45, mSeat), x, 0.23, zb + 0.28));
  const mPole = std({ color: 0xd0d4d8, metalness: 0.9, roughness: 0.2 });
  for (const x of [-4.2, -1.7, 1.7, 4.2]) train.add(pos(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H, 8), mPole), x, H / 2, -1.55));
  for (const z of [-0.85, -2.25]) { const r = pos(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 18, 8), mPole), 0, 1.95, z); r.rotation.z = Math.PI / 2; train.add(r); }
  W.tubesTrain = [];
  for (let x = -8; x <= 8; x += 2) for (const z of [-0.8, -2.3]) { const tb = pos(box(1.6, 0.04, 0.1, emis(0xd8f6f0, 2.4)), x, H - 0.03, z); train.add(tb); W.tubesTrain.push(tb); }
  W.lightsTrain = [];
  for (const x of [-4, 0, 4]) { const l = new THREE.PointLight(0xcff3ee, 6, 7, 1.5); l.position.set(x, 2.1, -1.55); train.add(l); W.lightsTrain.push(l); }
  W.speaker = pos(box(0.3, 0.03, 0.3, std({ color: 0x333333 })), 0.4, H - 0.01, -1.55); train.add(W.speaker);
  // roof + undercarriage + far exterior
  train.add(pos(box(18, 0.25, 2.95, std({ color: 0x8a8e92, metalness: 0.4, roughness: 0.5 })), 0, 3.08, (zf + zb) / 2));
  train.add(pos(box(18, 1.0, 2.6, std({ color: 0x151515 })), 0, -0.75, (zf + zb) / 2));
  for (const x0 of [-18.1, 18.1]) {
    const car = new THREE.Group(); car.position.x = x0; train.add(car);
    car.add(pos(box(17.8, 3.25, 2.85, mExt), 0, 1.38, (zf + zb) / 2 - 0.02));
    for (const wx of [-6, -2, 2, 6]) car.add(pos(plane(2.4, 0.95, std({ color: 0x0a0d10, roughness: 0.1, metalness: 0.4, emissive: 0x0d1416 })), wx, 1.425, zf + 0.04));
  }

  // ======================= SET C: ESCALATOR + MEZZANINE =======================
  const C = new THREE.Group(); scene.add(C); W.C = C;
  W.ceilings = new THREE.Group(); C.add(W.ceilings);
  const wt = tile.clone(); wt.needsUpdate = true; wt.repeat.set(1, 0.93);
  const mWall = std({ map: wt });
  const wallBox = (x0, x1, y0, y1, z, th = 0.15) => { const t = wt.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / 2, (y1 - y0) / 3); const m = pos(box(x1 - x0, y1 - y0, th, std({ map: t })), (x0 + x1) / 2, (y0 + y1) / 2, z); C.add(m); return m; };
  C.add(pos(box(56, 0.2, 4, mFloor), 228, -0.1, 0));
  // north wall (z=-2) with door gap 229.5..230.5
  wallBox(200, 229.5, 0, 2.8, -2.075); wallBox(230.5, 252, 0, 2.8, -2.075); wallBox(229.5, 230.5, 2.1, 2.8, -2.075);
  wallBox(200, 252, 0, 2.8, 2.075);
  W.ceilings.add(pos(box(56, 0.1, 4.3, std({ color: 0x6d6a62, roughness: 0.95 })), 226, 2.85, 0));
  for (let i = 0; i < 8; i++) { const p = pos(plane(0.8, 1.2, std({ map: T.poster(i + 2), roughness: 0.5 })), 206 + i * 6.3, 1.25, 1.99); p.rotation.y = Math.PI; C.add(p); if (i % 2) C.add(pos(plane(0.8, 1.2, std({ map: T.poster(i + 5), roughness: 0.5 })), 208 + i * 6, 1.25, -1.99)); }
  // vending machine + wet-floor sign
  C.add(pos(box(1.0, 1.9, 0.8, std({ color: 0x8a1c1c })), 238, 0.95, 1.55));
  { const vf = pos(plane(0.8, 1.2, emis(0xfff0d0, 0.6)), 238, 1.15, 1.14); vf.rotation.y = Math.PI; C.add(vf); }
  const wf = pos(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 4), std({ color: 0xf2c21b })), 244, 0.25, 0.8); wf.rotation.set(1.2, 0.4, 0); C.add(wf);
  // ceiling tubes (mostly dead) + red emergency lamps
  W.tubesC = [];
  for (let x = 203; x < 252; x += 6) { const tb = pos(box(1.2, 0.05, 0.1, emis(0xdff6f2, 0.0)), x, 2.78, 0); W.ceilings.add(tb); W.tubesC.push(tb); }
  W.redC = [];
  for (const x of [204, 214, 224, 234, 245]) { const l = new THREE.PointLight(0xd7262e, 7, 13, 1.4); l.position.set(x, 2.45, 0); C.add(l); W.redC.push(l); W.ceilings.add(pos(box(0.35, 0.1, 0.15, emis(0xff1a1a, 3)), x, 2.75, -1.6)); }
  W.hemiC = new THREE.HemisphereLight(0x4a3a40, 0x100606, 0.35); C.add(W.hemiC);
  W.flickC = new THREE.PointLight(0xdff6f2, 0, 8, 1.6); W.flickC.position.set(215, 2.6, 0); C.add(W.flickC);

  // escalator: bottom (189.6,-6) -> top (200,0), 30 deg
  W.escY = (x) => Math.max(-6, Math.min(0, (x - 200) * Math.tan(Math.PI / 6) + 0));
  const stepM = std({ color: 0x5a5d60, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 26; i++) { const top = -6 + (i + 1) * 0.2308; C.add(pos(box(0.4, 0.23, 2.0, stepM), 189.6 + i * 0.4 + 0.2, top - 0.115, 0)); }
  const slope = new THREE.Group(); slope.position.set(194.8, -3, 0); slope.rotation.z = Math.PI / 6; C.add(slope);
  for (const s of [-1, 1]) {
    slope.add(pos(box(12.2, 0.9, 0.06, std({ color: 0x8fb0b8, transparent: true, opacity: 0.25 })), 0, 0.55, s * 1.08));
    slope.add(pos(box(12.2, 0.07, 0.1, std({ color: 0x0a0a0a, roughness: 0.4 })), 0, 1.02, s * 1.08));
    slope.add(pos(box(12.2, 0.05, 0.05, emis(0xeaf6ff, 1.6)), 0, 0.12, s * 1.1));
    const sw = tile.clone(); sw.needsUpdate = true; sw.repeat.set(6, 1.2);
    slope.add(pos(box(12.4, 3.4, 0.15, std({ map: sw })), 0, 1.4, s * 2.0));
  }
  { const ec = pos(box(12.4, 0.1, 4.2, std({ color: 0x5d5a54 })), 194.8 - Math.sin(Math.PI / 6) * 2.9, -3 + Math.cos(Math.PI / 6) * 2.9, 0); ec.rotation.z = Math.PI / 6; W.ceilings.add(ec); }
  C.add(pos(box(6, 0.2, 4, mFloor), 186.6, -6.1, 0));
  W.escGlow = new THREE.PointLight(0xff3a2a, 10, 10, 1.4); W.escGlow.position.set(188, -4.6, 0); C.add(W.escGlow);
  W.escRed = new THREE.PointLight(0xd7262e, 6, 10, 1.4); W.escRed.position.set(196, -0.4, 0); C.add(W.escRed);
  for (const [x, y] of [[192.5, -2.6], [197.5, 0.6]]) { const l = new THREE.PointLight(0xffd9c0, 4, 7, 1.5); l.position.set(x, y, 0); C.add(l); }
  W.stairRed = new THREE.PointLight(0xd7262e, 6, 9, 1.4); W.stairRed.position.set(252.5, 2.6, 0); C.add(W.stairRed);
  // abandoned things on the escalator
  const sx = 198.2, sy = W.escY(sx + 0.2);
  const stroller = new THREE.Group(); stroller.position.set(sx, sy, 0.45); stroller.rotation.set(0.0, 0.5, 1.35); C.add(stroller);
  stroller.add(pos(box(0.55, 0.32, 0.38, std({ color: 0x2c4a6e })), 0, 0.35, 0));
  stroller.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0x23395a, side: THREE.DoubleSide })), -0.12, 0.5, 0));
  for (const [x, z] of [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]]) { const wh = pos(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 14), std({ color: 0x111111 })), x, 0.08, z); stroller.add(wh); }
  const rab = new THREE.Group(); rab.position.set(sx + 0.55, W.escY(sx + 0.75) + 0.08, -0.3); C.add(rab);
  rab.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), std({ color: 0xe8dcd0 })), 0, 0.06, 0));
  rab.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), std({ color: 0xe8dcd0 })), 0.1, 0.1, 0));
  for (const s of [-1, 1]) rab.add(pos(new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.1, 3, 6), std({ color: 0xf2c6c6 })), 0.12, 0.2, s * 0.03));
  const bq = new THREE.Group(); bq.position.set(196.5, W.escY(196.7) + 0.05, -0.55); bq.rotation.set(0, 0.8, 1.5); C.add(bq);
  bq.add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 8), std({ color: 0x3e7a3a })));
  for (let i = 0; i < 5; i++) bq.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std({ color: [0xc8323c, 0xf0f0f0, 0xe8a0b0][i % 3] })), Math.sin(i * 1.3) * 0.06, 0.2, Math.cos(i * 1.3) * 0.06));
  C.add(pos(box(0.06, 0.1, 0.22, std({ color: 0x8a1c1c })), 194.2, W.escY(194.4) + 0.05, 0.4));

  // signal room (behind north wall at x 228.5..232.5, z -2.15..-6)
  const R = new THREE.Group(); C.add(R); W.room = R;
  const mDark = std({ color: 0x2a2e31, roughness: 0.9 });
  R.add(pos(box(4.2, 0.1, 4.0, mDark), 230.5, -0.05, -4.1));
  W.ceilings.add(pos(box(4.2, 0.1, 4.0, mDark), 230.5, 2.85, -4.1));
  R.add(pos(box(4.2, 2.8, 0.1, mDark), 230.5, 1.4, -6.1));
  R.add(pos(box(0.1, 2.8, 4.0, mDark), 228.4, 1.4, -4.1)); R.add(pos(box(0.1, 2.8, 4.0, mDark), 232.6, 1.4, -4.1));
  const rk = T.rackTex();
  for (const [x, z, ry] of [[228.75, -3.4, Math.PI / 2], [228.75, -4.6, Math.PI / 2], [232.25, -3.2, -Math.PI / 2], [232.25, -4.4, -Math.PI / 2], [229.6, -5.75, 0]]) {
    const r = pos(box(0.6, 2.1, 0.7, std({ color: 0x14171a })), x, 1.05, z); r.rotation.y = ry; R.add(r);
    const f = pos(plane(0.55, 2.0, std({ map: rk, emissive: 0xffffff, emissiveMap: rk, emissiveIntensity: 1.3 })), 0, 0, 0.36); r.add(f);
  }
  W.roomLight = new THREE.PointLight(0x3a8aff, 3.5, 6, 1.5); W.roomLight.position.set(230.2, 2.2, -4.0); R.add(W.roomLight);
  W.roomLight2 = new THREE.PointLight(0x2aff9a, 1.2, 4, 1.5); W.roomLight2.position.set(229.3, 1.2, -5.2); R.add(W.roomLight2);
  W.windowLight = new THREE.PointLight(0x9fd8ff, 1.6, 1.4, 2); W.windowLight.position.set(230.05, 1.7, -2.2); R.add(W.windowLight);

  // door (hinge at x=229.5, z=-2)
  const dt = T.doorTex();
  W.door = new THREE.Group(); W.door.position.set(229.5, 0, -2.0); C.add(W.door);
  const doorMat = std({ map: dt, metalness: 0.35, roughness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide });
  // punch the window hole in the door texture canvas
  { const cv = dt.image, g = cv.getContext('2d'); g.clearRect(179, 282, 154, 204); dt.needsUpdate = true; }
  const dFront = pos(plane(1.0, 2.1, doorMat), 0.5, 1.05, 0.03); W.door.add(dFront);
  const dBack = pos(plane(1.0, 2.1, doorMat), 0.5, 1.05, -0.03); dBack.rotation.y = Math.PI; W.door.add(dBack);
  for (const [x, y, w, h] of [[0.5, 2.09, 1.0, 0.02], [0.01, 1.05, 0.02, 2.1], [0.99, 1.05, 0.02, 2.1]]) W.door.add(pos(box(w, h, 0.06, std({ color: 0x55595c })), x, y, 0));
  const glassW = pos(plane(0.3, 0.4, new THREE.MeshBasicMaterial({ map: T.meshGlass(), transparent: true, depthWrite: false })), 0.5, 1.35, 0.0); W.door.add(glassW); W.doorGlass = glassW;
  W.door.add(pos(box(0.04, 0.2, 0.06, std({ color: 0x999999, metalness: 0.9, roughness: 0.2 })), 0.88, 1.0, 0.06));
  // chain from handle (230.38, 1.0) to wall bracket (230.85)
  W.chain = new THREE.Group(); C.add(W.chain);
  const mCh = std({ color: 0x9a9a9a, metalness: 0.95, roughness: 0.25 });
  for (let i = 0; i < 9; i++) { const u = i / 8; const lk = pos(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12), mCh), 230.36 + u * 0.5, 1.0 - Math.sin(u * Math.PI) * 0.07, -1.9); lk.rotation.y = i % 2 ? Math.PI / 2 : 0; W.chain.add(lk); }
  W.chain.add(pos(box(0.05, 0.12, 0.05, std({ color: 0x777777 })), 230.88, 1.0, -1.97));
  W.padlock = pos(box(0.06, 0.07, 0.025, std({ color: 0xb08d3a, metalness: 0.8, roughness: 0.3 })), 230.6, 0.88, -1.89); W.chain.add(W.padlock);

  // exit stairs + shutter
  for (let i = 0; i < 5; i++) C.add(pos(box(0.8, 0.24 * (i + 1), 4, mFloor), 252.4 + i * 0.8, 0.12 * (i + 1), 0));
  C.add(pos(box(3, 1.2, 4, mFloor), 257.5, 0.6, 0));
  wallBox(252, 260, 0, 3.8, -2.075); wallBox(252, 260, 0, 3.8, 2.075);
  W.ceilings.add(pos(box(8, 0.1, 4.3, std({ color: 0x6d6a62 })), 256, 3.85, 0));
  W.ceilings.add(pos(box(0.1, 1.0, 4.2, std({ color: 0x6d6a62 })), 252, 3.3, 0));
  W.shutter = new THREE.Group(); C.add(W.shutter);
  const sh = pos(box(0.08, 2.7, 4.0, std({ map: T.shutterTex(), metalness: 0.05, roughness: 0.6 })), 256.6, 1.35, 0); W.shutter.add(sh);
  W.shutter.add(pos(box(0.1, 0.08, 4.0, std({ map: T.hazardTex() })), 256.58, 0.04, 0));
  W.setShutter = (yb) => { W.shutter.position.y = yb; };
  W.amber = new THREE.PointLight(0xff9a1f, 0, 12, 1.3); W.amber.position.set(255.5, 3.3, 0); C.add(W.amber);
  W.beacons = [];
  for (const z of [-1.85, 1.85]) { const b = pos(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), emis(0xff9a1f, 0)), 256.2, 3.35, z); C.add(b); W.beacons.push(b); }
  W.spots = [0, 1].map(() => { const l = new THREE.PointLight(0xff6a50, 0, 6, 1.5); C.add(l); return l; });
  { const ec = document.createElement('canvas'); ec.width = 256; ec.height = 96; const g = ec.getContext('2d'); g.fillStyle = '#0c8a3a'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#eafff0'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText('EXIT', 128, 72);
    const et = new THREE.CanvasTexture(ec); et.colorSpace = THREE.SRGBColorSpace; const sign = pos(plane(0.7, 0.26, new THREE.MeshBasicMaterial({ map: et, toneMapped: false })), 255.9, 3.5, 0); sign.rotation.y = -Math.PI / 2; C.add(sign);
    const gl = new THREE.PointLight(0x2aff7a, 4, 6, 1.5); gl.position.set(255.6, 3.3, 0); C.add(gl); }
  W.stairRed.intensity = 12;
  W.beyond = new THREE.PointLight(0xffb347, 3, 8, 1.5); W.beyond.position.set(258.6, 2.0, 0); C.add(W.beyond);

  return W;
}
