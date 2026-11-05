// The 30 storyboard shots of Episode 1, staged on one absolute timeline (seconds).
import * as THREE from 'three';
import { Person, makeMop, makePhone, mat, yawTo } from './people.js';
import { PhoneScreen } from './textures.js';

export const FPS = 24, DUR = 88.0;
export const SHOTS = [
  [1, 0.0, 2.6], [2, 2.6, 5.0], [3, 5.0, 7.6], [4, 7.6, 10.6], [5, 10.6, 13.4], [6, 13.4, 15.4], [7, 15.4, 19.4], [8, 19.4, 21.6],
  [9, 21.6, 23.2], [10, 23.2, 26.6], [11, 26.6, 28.2], [12, 28.2, 30.2], [13, 30.2, 36.2], [14, 36.2, 37.8], [15, 37.8, 40.8],
  [16, 40.8, 44.8], [17, 44.8, 48.0], [18, 48.0, 51.0], [19, 51.0, 52.6], [20, 52.6, 55.4], [21, 55.4, 60.4], [22, 60.4, 63.0],
  [23, 63.0, 65.2], [24, 65.2, 66.6], [25, 66.6, 68.8], [26, 68.8, 73.6], [27, 73.6, 76.0], [28, 76.0, 79.0], [29, 79.0, 82.6], [30, 82.6, 88.0],
];

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const fovL = (mm) => 2 * Math.atan(18 / mm) * 180 / Math.PI;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const flick = (t, seed, rate = 9, on = 0.8) => (hash(Math.floor(t * rate) + seed * 97) < on ? 1 : 0.15);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
export function eyeWorld(p) { p.root.updateMatrixWorld(true); const a = new THREE.Vector3(), b = new THREE.Vector3(); p.eyes[0].getWorldPosition(a); p.eyes[1].getWorldPosition(b); return a.add(b).multiplyScalar(0.5); }
export function worldOf(o) { o.updateMatrixWorld(true); return o.getWorldPosition(new THREE.Vector3()); }

function camKeys(cam, u, keys) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1].u) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const w = b === a ? 0 : ss((u - a.u) / (b.u - a.u));
  const p = V(a.p).lerp(V(b.p), w), l = V(a.l).lerp(V(b.l), w);
  cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(l);
  cam.fov = lerp(a.fov, b.fov, w); if (a.roll || b.roll) cam.rotateZ(lerp(a.roll || 0, b.roll || 0, w));
}
// creeping push: scale fov down by pct per second
const creep = (fov, lt, pctPerFrame) => fov * Math.max(0.6, 1 - pctPerFrame / 100 * lt * FPS);

// ---------------------------------------------------------------- cast
export function makeCast(scene) {
  const c = {};
  const add = (p) => { scene.add(p.root); return p; };
  c.kai = add(new Person({ height: 1.75, skin: 0x8d5a3b, shirt: 0x3a3d42, pants: 0x1f2a44, shoes: 0xeeeeee, hair: 'curly', hairColor: 0x15100c, vest: true, glasses: true, lace: true }));
  c.mop = makeMop(); c.mop.position.set(0, 0.32, 0.03); c.kai.armR.grip.add(c.mop);
  c.kaiScreen = new PhoneScreen(); c.kaiPhone = makePhone(c.kaiScreen.tex); c.kaiPhone.rotation.set(-0.2, Math.PI, 0); c.kaiPhone.position.set(0, 0.04, 0.03); c.kai.armL.grip.add(c.kaiPhone);
  c.phoneLight = new THREE.PointLight(0xdfe8ff, 0, 1.2, 2); c.kaiPhone.add(c.phoneLight); c.phoneLight.position.set(0, 0, -0.15);
  c.pocketGlow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.0, depthWrite: false }));
  c.pocketGlow.position.set(0.09, 0.12, 0.13); c.kai.spine.add(c.pocketGlow);
  c.earbud = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(0xf4f4f4)); c.earbud.position.set(-0.108, -0.01, 0.01); c.kai.head.add(c.earbud);
  c.wren = add(new Person({ child: true, height: 1.32, skin: 0xf1d3c2, coat: 0x9a9ea3, coatLen: 0.5, pants: 0x151515, boots: 0xe3b23c, shoes: 0xe3b23c, hair: 'bob', hairColor: 0xa0461f, clip: true, bandage: true }));
  c.tall = add(new Person({ height: 1.96, infected: true, coat: 0x1c2540, coatLen: 0.78, pants: 0x1c2540, hair: 'short', hairColor: 0x555555, cap: true }));
  c.comm = add(new Person({ height: 1.68, infected: true, coat: 0xb08850, coatLen: 0.62, pants: 0x2a2a2a, hair: 'bun', hairColor: 0x3a2618, lopsided: true }));
  c.commScreen = new PhoneScreen(); c.commScreen.draw('mum');
  c.commPhone = makePhone(c.commScreen.tex); c.commPhone.rotation.set(-1.2, 0, 0); c.comm.armR.grip.add(c.commPhone);
  { const eb = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(0xf4f4f4)); eb.position.set(-0.108, -0.01, 0.01); c.comm.head.add(eb); }
  c.run = add(new Person({ height: 1.8, infected: true, shirt: 0x1b2030, pants: 0x111111, hair: 'short', hairColor: 0x2a1a10, shoes: 0xdddddd }));
  for (const y of [0.15, 0.32]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.03, 18, 1, true), mat(0xe8eef2, { emissive: 0x9aa4aa, ei: 1.2, side: THREE.DoubleSide })); b.scale.set(1.15, 1, 0.76); b.position.y = y; c.run.spine.add(b); }
  { const hp = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 16), mat(0x111111)); hp.rotation.x = Math.PI / 2; hp.position.y = -0.02; c.run.neck.add(hp); }
  // passengers
  const pal = [[0xf2f2f2, 0x333333, 'short', 0x222222], [0x223355, 0x111111, 'short', 0x1a1a1a], [0x1d2b4a, 0x2a2a2a, 'long', 0x5a3a20], [0x2e8f8a, 0x2e8f8a, 'bun', 0x111111],
    [0x6b2d2d, 0x222222, 'short', 0x704020], [0x444b55, 0x1e1e1e, 'none', 0], [0x7a6a50, 0x2b2b2b, 'long', 0x2a1a10], [0x3b5a3b, 0x1b1b1b, 'short', 0x3a2a1a],
    [0x8a3c5a, 0x222233, 'bun', 0x1a1010], [0x2a2a2a, 0x3a3a3a, 'short', 0xaaaaaa]];
  c.pass = [];
  for (let i = 0; i < 18; i++) {
    const p = pal[i % pal.length];
    const coat = i % 4 === 1 ? 0x2f3a46 : null;
    c.pass.push(add(new Person({ height: 1.6 + hash(i) * 0.3, infected: true, shirt: p[0], pants: p[1], hair: p[2], hairColor: p[3], coat, coatLen: 0.55 })));
  }
  // flowers in one passenger's hand
  { const f = new THREE.Group(); f.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 6), mat(0x3e7a3a))); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), mat(0xc8323c)); b.position.set(Math.sin(k) * 0.04, 0.14, Math.cos(k) * 0.04); f.add(b); } f.rotation.x = Math.PI; c.pass[6].armR.grip.add(f); }
  c.all = [c.kai, c.wren, c.tall, c.comm, c.run, ...c.pass];
  // inside-carriage slots (facing -z)
  c.slots = [];
  for (let i = 0; i < c.pass.length; i++) {
    const row = i % 3, col = Math.floor(i / 3);
    let x = -3.9 + col * 1.35 + (hash(i + 5) - 0.5) * 0.5 + row * 0.35, z = -0.85 - row * 0.72 - hash(i + 9) * 0.2;
    if (Math.abs(x + 0.35) < 0.5 && row === 0) x += 0.8;
    c.slots.push([x, z]);
  }
  return c;
}

// ---------------------------------------------------------------- per-frame state
let vo = [];
export function setTiming(t) { vo = t; }
function speaking(who, t) {
  for (const l of vo) if (l.who === who && !l.fx.startsWith('vo') && !['radio', 'radio_loud', 'phone', 'pa', 'steel', 'steel_w'].includes(l.fx) && t >= l.start && t <= l.end) return 0.35 + 0.65 * Math.abs(Math.sin(t * 22 + l.id));
  return 0;
}
function blink(p, t, seed) { const ph = (t * 0.55 + hash(seed) * 3) % 2.7; p.setBlink(ph < 0.11 ? 1 : 0); }

const shutterY = (t) => t < 48 ? 3.6 : t < 66 ? lerp(3.3, 2.5, (t - 48) / 18) : t < 76 ? lerp(2.5, 1.78, (t - 66) / 10) : lerp(1.78, 1.62, clamp((t - 76) / 12));
const doorsOpen = (t) => t < 0.9 ? ss(t / 0.9) : t < 27.7 ? 1 : lerp(1, 0.17, ss(seg(t, 27.7, 28.75)));
const T_HIT = 29.0;
const packX = (t) => t < 60.4 ? 196 : t < 62.3 ? lerp(196.5, 208, ss(seg(t, 60.4, 62.3))) : t < 66.9 ? 208 : 208 + (t - 66.9) * 0.35;

export function boardState(t) {
  const clock = t < 36.9 ? '02:17' : '02:18';
  const base = ['7  ASHFORD PARK     DUE', '7  RIVERSIDE     4 MIN', '7  EASTBANK      9 MIN', '7  KINGSWAY     12 MIN'];
  const rows = base.map((txt, i) => {
    const ft = 15.9 + i * 0.6;
    if (t < ft) return { text: txt };
    if (t < ft + 0.18) return { text: '', flip: true };
    return { text: '   SUSPENDED', color: '#ff5a2a' };
  });
  rows.push({ text: '0417  NOT IN SERVICE', color: '#ffb000' });
  const closing = t >= 36.55;
  return { header: closing ? 'STATION CLOSING 02:21' : 'HALLORAN CROSS  PL 2', headerColor: closing ? '#ff3b2f' : '#ffb000', clock, rows };
}

export function frameState(t, W, c, cam) {
  const out = { set: 'A', kick: 0, slow: false, split: null, shot: 1, black: false, tAnim: t };
  const sh = SHOTS.find(s => t >= s[1] && t < s[2]) || SHOTS[SHOTS.length - 1];
  const [id, a, b] = sh; const lt = t - a, u = (t - a) / (b - a); out.shot = id;
  for (const p of c.all) { p.root.visible = false; p.reset(); }
  c.kaiPhone.visible = false; c.phoneLight.intensity = 0; c.pocketGlow.material.opacity = 0; c.earbud.visible = t < 6.3; c.mop.visible = true;
  out.set = id <= 14 ? 'A' : 'C';
  W.board.draw(boardState(t));
  lightA(t, W, id); lightC(t, W);
  W.setDoors(doorsOpen(t)); W.setShutter(shutterY(t));
  W.cracks.forEach((cr, i) => { cr.visible = t > T_HIT + i * 0.25; });
  W.ceilings.visible = id !== 27;
  W.door.rotation.y = 0;
  STAGE[id](t, lt, u, W, c, cam, out);
  for (const p of c.all) { if (!p.root.visible) continue; const dx = p.root.position.x - cam.position.x, dz = p.root.position.z - cam.position.z; if (Math.hypot(dx, dz) < 0.3 && cam.position.y < p.root.position.y + 2.0 && cam.position.y > p.root.position.y) p.root.visible = false; }
  // lip flap + blinks
  for (const [p, who, s] of [[c.kai, 'kai', 1], [c.wren, 'wren', 2]]) { if (p.root.visible) { p.setMouth(speaking(who, t)); blink(p, t, s); } }
  cam.updateProjectionMatrix();
  return out;
}

function lightA(t, W, id) {
  const hit = t >= T_HIT;
  const die = (x) => hit ? clamp(1 - (t - T_HIT - (12 - Math.abs(x)) * 0.03) / 0.15) : 1;
  W.tubesA.forEach((tb, i) => { const x = tb.position.x; tb.material.emissiveIntensity = 2.2 * die(x) * (i === 9 || i === 4 ? flick(t, i, 7, 0.75) : 1); });
  W.lightsA.forEach((l, i) => { l.intensity = 9 * die(l.position.x) * (i === 1 ? 0.6 + 0.4 * flick(t, 3, 7, 0.8) : 1); });
  const red = hit ? 1 : (id === 11 ? 0.15 * Math.max(0, Math.sin(t * 7)) : 0);
  W.redA.forEach((l, i) => { l.intensity = 14 * red * (0.85 + 0.15 * Math.sin(t * 3 + i)); });
  W.redLampsA.forEach((m) => { m.material.emissiveIntensity = 4 * red; });
  const fl = flick(t, 11, 11, 0.7);
  W.tubesTrain.forEach((tb, i) => { tb.material.emissiveIntensity = (hit ? 1.4 : 2.4) * (i % 5 === 2 ? fl : 1) * (hit ? flick(t, i, 6, 0.6) : 1); });
  W.lightsTrain.forEach((l, i) => { l.intensity = (hit ? 3.5 : 6) * (i === 1 ? 0.55 + 0.45 * fl : 1); });
  W.hemiA.color.set(hit ? 0x803030 : 0x5a7a80); W.hemiA.intensity = hit ? 0.3 : 0.55;
}
function lightC(t, W) {
  const strobe = t >= 48 ? Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)), 6) : 0;
  W.amber.intensity = 26 * strobe; W.beacons.forEach(b => { b.material.emissiveIntensity = 0.4 + 5 * strobe; });
  W.flickC.intensity = 4 * (flick(t, 21, 8, 0.25) > 0.5 ? 1 : 0);
  W.tubesC.forEach((tb, i) => { tb.material.emissiveIntensity = i === 2 ? 2 * (flick(t, 21, 8, 0.25) > 0.5 ? 1 : 0) : 0; });
  W.escGlow.intensity = 8 + 6 * flick(t, 31, 5, 0.6);
}

// ---------------------------------------------------------------- staging helpers
function kaiAt(c, x, z, ry) { c.kai.root.visible = true; c.kai.place(x, z, ry); }
function passInside(c, t, faceKaiFrom = Infinity, kaiPos = [0.15, 1.0]) {
  c.pass.forEach((p, i) => {
    const [x, z] = c.slots[i]; p.root.visible = true;
    let ry = Math.PI;
    if (t > faceKaiFrom) { // stuttering turn toward Kai, staggered front-to-back
      const st = faceKaiFrom + 0.15 + (i % 3) * 0.35 + hash(i) * 0.5;
      const tq = Math.floor(t * 12) / 12; // 2-frame holds
      const w = clamp((tq - st) / 0.9);
      const target = yawTo(x, z, kaiPos[0], kaiPos[1]);
      let d = target - Math.PI; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      ry = Math.PI + d * Math.round(w * 6) / 6;
    }
    p.place(x, z, ry); p.sway(t, 1, i);
    if (t >= 19.9 && t < 23.2 && faceKaiFrom === Infinity) { p.head.rotation.x = -0.55 * clamp((t - 19.9) / 0.17); p.neck.rotation.x = -0.25 * clamp((t - 19.9) / 0.17); }
    p.setMouth(0.15 + 0.1 * Math.sin(t * 3 + i));
  });
}
function commInside(c, t, twitch = 0) {
  c.comm.root.visible = true; c.comm.place(-0.35, -0.75, Math.PI); c.comm.sway(t, 0.6, 3);
  c.comm.armSwing(c.comm.armR, 0.5, 0.6); c.comm.armR.sh.rotation.y = 0.2;
  c.comm.head.rotation.y += twitch;
}
function passAtWindows(c, t, pound = true) {
  c.pass.forEach((p, i) => {
    p.root.visible = true; const x = -3.2 + i * 0.62, z = -0.48 - (i % 2) * 0.35;
    p.place(x, z, 0); p.sway(t, 0.5, i);
    if (pound) { const ph = t * 7 + i * 1.7; p.armSwing(p.armL, 2.3 + 0.35 * Math.sin(ph), 0.4); p.armSwing(p.armR, 2.3 + 0.35 * Math.sin(ph + 2), 0.4); }
    p.setMouth(0.6 + 0.4 * Math.sin(t * 9 + i)); p.spine.rotation.x = 0.15;
  });
}
function kaiCorridorDoor(c, t, lean = 0.25) {
  kaiAt(c, 230.3, -1.42, Math.PI); c.kai.spine.rotation.x = lean; c.kai.hips.rotation.x = 0.05; c.kai.neck.rotation.x = 0.1;
  c.kai.armR.sh.rotation.x = -0.15; c.kai.armR.el.rotation.x = -0.4;
}
function wrenInRoom(c, t, rise = 1) {
  c.wren.root.visible = true; c.wren.place(230.14, -2.36, -0.15, -0.45 * (1 - rise) + 0.03);
  c.wren.sway(t, 0.3, 7);
}
function tallInRoom(c, t, tilt = 0) {
  c.tall.root.visible = true; c.tall.place(231.3, -5.35, Math.PI - 0.15); c.tall.sway(t, 1.3, 9); c.tall.head.rotation.y += tilt; c.tall.head.rotation.z += tilt * 0.4;
}
function pack(c, t, opts = {}) {
  const X = packX(t);
  const members = [c.run, c.comm, ...c.pass.slice(0, 9)];
  members.forEach((p, i) => {
    p.root.visible = true;
    const lag = i === 0 ? -0.8 : i * 0.35;
    let x = X - lag - (i % 3) * 0.5, z = ((i % 4) - 1.5) * 0.8 + (hash(i + 3) - 0.5) * 0.4;
    const y = x < 200 ? Math.max(-6, (x - 200) * Math.tan(Math.PI / 6)) : 0;
    let ry = Math.PI / 2; // facing +x (toward Kai)
    const moving = t < 62.3 || t > 66.9;
    const tq = Math.floor(t * 12) / 12;
    if (i === 0 && t >= 60.4 && t < 61.6) { p.place(x, z, ry, y); p.crawl(tq * 14); return; }
    p.place(x, z, ry, y);
    if (t >= 62.3 && t < 66.9) { // searching: heads twitch
      p.head.rotation.y = (hash(Math.floor(t * 3) + i * 7) - 0.5) * 1.6; p.head.rotation.z = (hash(Math.floor(t * 2) + i) - 0.5) * 0.5;
      if (i === 0 && t > 64.0) { p.head.rotation.y = 0; p.head.rotation.x = -0.2; }
    } else if (moving) {
      if (t < 62.3) p.run(tq * 13 + i, 0.9); else { p.walk(tq * 5 + i, 0.5); p.spine.rotation.x = 0.35; if (i === 0) { p.body.position.y = -0.25; p.spine.rotation.x = 0.7; p.neck.rotation.x = -0.6; p.legSwing(p.legL, 0.6, 1.3); p.legSwing(p.legR, -0.2, 1.5); } }
    }
    p.sway(t, 0.8, i); p.setMouth(0.5);
  });
}

// ---------------------------------------------------------------- the shots
const STAGE = {};
STAGE[1] = (t, lt, u, W, c, cam) => {
  passInside(c, t); commInside(c, t);
  camKeys(cam, u, [{ u: 0, p: [0, 1.3, 2.5], l: [0, 1.3, -2], fov: fovL(28) }, { u: 1, p: [0, 1.28, 1.35], l: [0, 1.3, -2], fov: fovL(28) }]);
};
STAGE[2] = (t, lt, u, W, c, cam) => {
  passInside(c, t); commInside(c, t); kaiAt(c, 0.2, 3.0, Math.PI); c.kai.look(0.1, 0, 0.08 * ss(u));
  c.pass.forEach((p, i) => { const [x, z] = c.slots[i]; if (Math.abs(x) < 1.2 && z > -1.3) p.root.visible = false; });
  c.pass[1].root.visible = true; c.pass[1].place(-0.38, -0.66, 0); c.pass[4].root.visible = true; c.pass[4].place(0.52, -0.62, 0);
  c.comm.root.visible = false;
  camKeys(cam, u, [{ u: 0, p: [-0.05, 1.5, -1.05], l: [0.1, 1.45, 3], fov: fovL(50) }, { u: 1, p: [0.25, 1.5, -1.05], l: [0.2, 1.45, 3], fov: fovL(50) }]);
};
STAGE[3] = (t, lt, u, W, c, cam) => {
  kaiAt(c, 0.2, 3.0, Math.PI);
  const pull = seg(lt, 0.2, 0.9); c.kai.armL.sh.rotation.x = -2.2 * ss(pull) * (1 - seg(lt, 1.0, 1.6)); c.kai.armL.sh.rotation.z = 0.5 * ss(pull) * (1 - seg(lt, 1.0, 1.6)); c.kai.armL.el.rotation.x = -1.9 * ss(pull) * (1 - seg(lt, 1.0, 1.6));
  c.kai.setBrows(-0.3 + 0.6 * seg(lt, 1.9, 2.5)); c.kai.look(0.05, 0.05, 0);
  camKeys(cam, u, [{ u: 0, p: [0.2, 1.6, 1.85], l: [0.2, 1.58, 3.0], fov: fovL(65) }, { u: 1, p: [0.2, 1.6, 1.85], l: [0.2, 1.58, 3.0], fov: creep(fovL(65), lt, 0.25) }]);
};
STAGE[4] = (t, lt, u, W, c, cam) => {
  passInside(c, t); commInside(c, t);
  const z = lerp(3.0, 1.05, ss(seg(lt, 0, 2.8))); kaiAt(c, 0.15, z, Math.PI); c.kai.walk(lt * 5.2, 0.7 * (1 - seg(lt, 2.6, 3.0))); c.kai.look(0.1, 0.05);
  camKeys(cam, u, [{ u: 0, p: [1.7, 0.85, 3.4], l: [0.1, 1.0, 2.4], fov: fovL(28) }, { u: 1, p: [1.6, 0.85, 1.6], l: [0.1, 1.1, 0.4], fov: fovL(28) }]);
};
STAGE[5] = (t, lt, u, W, c, cam) => {
  passInside(c, t); commInside(c, t); kaiAt(c, 0.15, 1.05, Math.PI);
  camKeys(cam, u, [{ u: 0, p: [0.25, 1.55, -0.6], l: [-0.074, 0.93, -1.157], fov: fovL(85) }, { u: 0.25, p: [0.25, 1.55, -0.6], l: [-0.074, 0.93, -1.157], fov: fovL(85) }, { u: 1, p: [0.24, 1.63, -0.46], l: [-0.12, 1.48, -0.77], fov: fovL(85) }]);
};
STAGE[6] = (t, lt, u, W, c, cam) => {
  passInside(c, t); kaiAt(c, 0.15, 1.05, Math.PI); c.kai.setBrows(0.35); c.kai.look(-0.12, 0.05); c.kai.spine.rotation.x = 0.08;
  const tw = lt > 1.35 ? -0.18 : 0; commInside(c, t, tw);
  camKeys(cam, u, [{ u: 0, p: [0.02, 1.72, 1.95], l: [-0.3, 1.5, -0.75], fov: fovL(35) }, { u: 1, p: [0.02, 1.72, 1.9], l: [-0.3, 1.5, -0.75], fov: creep(fovL(35), lt, 0.2) }]);
};
STAGE[7] = (t, lt, u, W, c, cam) => {
  passInside(c, t); commInside(c, t); kaiAt(c, 0.15, 1.05, Math.PI); c.kai.look(0, -0.5 * seg(lt, 0.4, 1.0));
  camKeys(cam, u, [{ u: 0, p: [0.1, 3.0, 3.55], l: [0, 3.25, 2.2], fov: fovL(24) }, { u: 0.25, p: [0.1, 3.0, 3.55], l: [0, 3.2, 2.2], fov: fovL(24) }, { u: 1, p: [2.6, 3.7, 6.3], l: [0.1, 0.9, 0.8], fov: fovL(24) }]);
};
STAGE[8] = (t, lt, u, W, c, cam, out) => {
  passInside(c, t); commInside(c, t);
  [[0.15, -1.25], [1.25, -1.35], [0.4, -2.3], [1.3, -2.25], [0.0, -1.85]].forEach(([x, z], k) => { const p = c.pass[k + 10]; p.place(x, z, Math.PI + (k - 2) * 0.3); });
  W.tubesTrain.forEach((tb) => { tb.material.emissiveIntensity *= 0.3; }); W.lightsTrain.forEach((l) => { l.intensity *= 0.18; }); out.dim = 0.55;
  if (t >= 19.9) { c.comm.head.rotation.x = -0.55 * clamp((t - 19.9) / 0.17); }
  camKeys(cam, u, [{ u: 0, p: [0.72, 0.75, -1.8], l: [0.6, 1.6, -1.75], fov: fovL(18) }, { u: 1, p: [0.72, 0.75, -1.8], l: [0.6, 2.2, -1.75], fov: fovL(18) }]);
};
STAGE[9] = (t, lt, u, W, c, cam) => {
  passInside(c, t); commInside(c, t); kaiAt(c, 0.15, 1.05, Math.PI);
  const slap = seg(lt, 0.95, 1.12); c.kai.armR.sh.rotation.x = -1.3 * ss(slap); c.kai.armR.sh.rotation.z = 0.55 * ss(slap); c.kai.armR.el.rotation.x = -1.6 * ss(slap); c.mop.visible = slap < 0.5;
  camKeys(cam, u, [{ u: 0, p: [0.0, 1.42, 0.5], l: [0.07, 1.36, 0.93], fov: fovL(100) }, { u: 1, p: [0.0, 1.42, 0.51], l: [0.07, 1.36, 0.93], fov: fovL(100) }]);
};
STAGE[10] = (t, lt, u, W, c, cam) => {
  passInside(c, t, 23.2); kaiAt(c, 0.15, 1.05, Math.PI); c.kai.look(0, 0.05);
  c.comm.root.visible = true; c.comm.place(-0.35, -0.75, Math.PI + (Math.round(clamp((Math.floor(t * 12) / 12 - 23.4) / 0.8) * 6) / 6) * Math.PI * 0.94); c.comm.setMouth(0.4);
  c.mop.visible = false;
  camKeys(cam, u, [{ u: 0, p: [0.0, 1.76, 1.95], l: [-0.2, 1.4, -1.4], fov: fovL(40) }, { u: 1, p: [0.0, 1.76, 1.95], l: [-0.2, 1.4, -1.4], fov: creep(fovL(40), lt, 0.15) }]);
};
STAGE[11] = (t, lt, u, W, c, cam) => {
  passInside(c, t, 23.2); c.comm.root.visible = true; c.comm.place(-0.35, -0.75, 0.15);
  const z = lerp(1.05, 1.38, ss(seg(lt, 0.5, 1.0))); kaiAt(c, 0.15, z, Math.PI); c.kai.setBrows(0.6); c.kai.setPupils(0, 0.2);
  camKeys(cam, u, [{ u: 0, p: [0.15, 1.63, 0.1], l: [0.15, 1.63, 1.2], fov: fovL(85) }, { u: 1, p: [0.15, 1.63, 0.1], l: [0.15, 1.63, 1.2], fov: fovL(85) }]);
};
STAGE[12] = (t, lt, u, W, c, cam, out) => {
  const surge = ss(seg(t, 28.35, T_HIT));
  c.pass.forEach((p, i) => { const [x, z] = c.slots[i]; p.root.visible = true; p.place(lerp(x, x * 1.1, surge), lerp(z, -0.45 - (i % 3) * 0.25, surge), lerp(0.3, 0, surge)); p.armSwing(p.armL, 2.0 * surge, 0.3); p.armSwing(p.armR, 2.0 * surge, 0.3); p.setMouth(0.8); });
  c.comm.root.visible = true; const cz = lerp(-0.75, -0.3, ss(seg(t, 28.25, 28.6))); c.comm.place(0.2, cz, 0); c.comm.armSwing(c.comm.armR, 1.55 * ss(seg(t, 28.3, 28.6)), 0.05); c.comm.armR.sh.rotation.z = 0.0; c.comm.setMouth(1); c.comm.spine.rotation.x = 0.25; c.comm.armSwing(c.comm.armL, 0.4, 0.4);
  const kz = lerp(1.38, 1.6, ss(seg(t, 28.5, 28.8))); kaiAt(c, 0.15, kz, Math.PI); c.kai.spine.rotation.x = -0.18 * ss(seg(t, 28.5, 28.8)); c.kai.look(0.25, 0.1); c.kai.setBrows(0.7);
  out.kick = t >= T_HIT && t < T_HIT + 7 / FPS ? (1 - (t - T_HIT) * FPS / 7) * (Math.floor((t - T_HIT) * FPS) % 2 ? -1 : 1) : 0;
  camKeys(cam, u, [{ u: 0, p: [0.45, 2.55, 3.1], l: [0.05, 1.05, -0.3], fov: fovL(35) }, { u: 1, p: [0.45, 2.55, 3.05], l: [0.05, 1.05, -0.3], fov: creep(fovL(35), lt, 0.1) }]);
};
STAGE[13] = (t, lt, u, W, c, cam) => {
  passAtWindows(c, t);
  const runT = 35.75;
  if (t < runT) { const x = lerp(0.3, 2.9, ss(seg(t, 30.3, runT))); kaiAt(c, x, 1.55, Math.PI * 0.9); c.kai.walk(-lt * 3.2, 0.35); c.kai.armL.sh.rotation.x = -2.6; c.kai.armL.el.rotation.x = -2.2; c.kai.armL.sh.rotation.z = 0.35; c.kai.look(-0.2, 0.05); }
  else { const x = 2.9 + (t - runT) * 6.5; kaiAt(c, x, 1.6, Math.PI / 2); c.kai.run((t - runT) * 13, 1); }
  camKeys(cam, u, [{ u: 0, p: [0.3, 1.25, 4.6], l: [0.4, 1.2, 0.5], fov: fovL(40) }, { u: (runT - 30.2) / 6, p: [2.9, 1.25, 4.6], l: [3.0, 1.2, 0.5], fov: fovL(40) }, { u: 1, p: [3.15, 1.25, 4.6], l: [3.3, 1.2, 0.5], fov: fovL(40) }]);
};
STAGE[14] = (t, lt, u, W, c, cam) => {
  camKeys(cam, u, [{ u: 0, p: [0, 3.05, 5.7], l: [0, 3.25, 2.3], fov: fovL(50) }, { u: 1, p: [0, 3.07, 5.5], l: [0, 3.25, 2.3], fov: fovL(50) }]);
};
// ---- set C
STAGE[15] = (t, lt, u, W, c, cam) => {
  const x = lerp(191.0, 201.2, seg(lt, 0, 2.75)); const y = W.escY(x); kaiAt(c, x, 0.25, Math.PI / 2); c.kai.root.position.y = y; c.kai.run(lt * 12, 1);
  camKeys(cam, u, [{ u: 0, p: [200.6, 0.45, -0.25], l: [192, -4.6, 0.1], fov: fovL(24) }, { u: 0.78, p: [200.6, 0.45, -0.25], l: [194.5, -2.6, 0.1], fov: fovL(24) }, { u: 1, p: [200.6, 0.45, -0.25], l: [203, 2.4, 0.2], fov: fovL(24) }]);
};
STAGE[16] = (t, lt, u, W, c, cam) => {
  const d = clamp(lt - 2.3, 0, 0.8); const v = lt < 2.3 ? 5.0 : 5.0 * (1 - d / 0.8); const x = 201.5 + 5 * Math.min(lt, 2.3) + 5 * d - 5 * d * d / 1.6;
  kaiAt(c, x, 0.0, Math.PI / 2);
  if (v > 0.5) c.kai.run(lt * 12, v / 5); else c.kai.walk(lt * 2, 0.1);
  const lift = seg(lt, 0.4, 1.0); c.kai.armL.sh.rotation.x = -2.5 * ss(lift); c.kai.armL.sh.rotation.z = 0.45 * ss(lift); c.kai.armL.el.rotation.x = -2.5 * ss(lift);
  c.kaiPhone.visible = lt > 0.35; c.kaiScreen.draw('lucy_missed'); c.phoneLight.intensity = 1.2; c.kai.look(-0.2, 0.15);
  const cx = x + 2.4 + Math.max(0, lt - 2.3) * 0.9;
  cam.position.set(cx, 1.45, 0.05); cam.lookAt(x, 1.35, 0); cam.fov = fovL(50);
};
STAGE[17] = (t, lt, u, W, c, cam, out) => {
  const x = 215.0; kaiAt(c, x, 0, Math.PI / 2 + 0.25); c.kai.armL.sh.rotation.x = -1.35; c.kai.armL.el.rotation.x = -1.6; c.kai.armL.sh.rotation.z = -0.1;
  c.kaiPhone.visible = true; c.kaiScreen.draw('lock'); c.phoneLight.intensity = 0.5; c.kai.look(0.15, 0.18); c.kai.setBrows(-0.2 + 0.5 * seg(lt, 1.5, 2.5)); c.kai.setPupils(0.2, -0.6);
  const e = eyeWorld(c.kai); camKeys(cam, u, [{ u: 0, p: [e.x + 0.95, e.y - 0.18, e.z - 0.16], l: [e.x, e.y - 0.08, e.z], fov: fovL(85) }, { u: 1, p: [e.x + 0.95, e.y - 0.18, e.z - 0.16], l: [e.x, e.y - 0.08, e.z], fov: creep(fovL(85), lt, 0.3) }]); out.dim = 0.7;
};
STAGE[18] = (t, lt, u, W, c, cam) => {
  const x = 215.2 + lt * 3.8; kaiAt(c, x, 0.2, Math.PI / 2); c.kai.run(lt * 12, 1);
  cam.position.set(x - 2.6, 1.35, 0.85); cam.lookAt(x + 10, 1.1, -0.15); cam.fov = fovL(24);
};
STAGE[19] = (t, lt, u, W, c, cam) => {
  const x = lerp(226.6, 230.3, ss(seg(lt, 0, 0.7))); const turn = seg(lt, 0.55, 1.0);
  kaiAt(c, x, -1.0 - 0.42 * turn, lerp(Math.PI / 2, Math.PI, ss(turn))); if (lt < 0.6) c.kai.run(lt * 12, 1 - seg(lt, 0.3, 0.6)); else c.kai.look(0, 0.05);
  camKeys(cam, u, [{ u: 0, p: [229.0, 1.4, 1.65], l: [226.8, 1.2, -0.6], fov: fovL(35) }, { u: 0.55, p: [229.1, 1.4, 1.65], l: [229.6, 1.25, -1.2], fov: fovL(35) }, { u: 1, p: [229.2, 1.4, 1.6], l: [230.1, 1.3, -2.0], fov: fovL(35) }]);
};
STAGE[20] = (t, lt, u, W, c, cam) => {
  camKeys(cam, u, [{ u: 0, p: [230.0, 1.95, -0.85], l: [230.0, 1.85, -2.0], fov: fovL(65) }, { u: 1, p: [230.0, 1.05, -0.95], l: [230.0, 0.85, -2.0], fov: fovL(65) }]);
};
STAGE[21] = (t, lt, u, W, c, cam) => {
  kaiCorridorDoor(c, t, 0.32); c.kai.look(0.25, 0.2); c.kai.setBrows(lt > 2.6 ? 0.5 : 0.2);
  const rise = ss(seg(lt, 0.2, 1.1)); wrenInRoom(c, t, rise); c.wren.look(-0.15, 0.08);
  const shh = seg(lt, 0.8, 1.3) * (1 - seg(lt, 3.9, 4.4)); c.wren.armSwing(c.wren.armL, 2.0 * shh, 2.4 * shh); c.wren.armL.sh.rotation.z = -0.35 * shh;
  tallInRoom(c, t);
  c.wren.root.position.x = 230.2; c.kai.spine.rotation.x = 0.45;
  camKeys(cam, u, [{ u: 0, p: [229.45, 1.22, -1.2], l: [230.08, 1.42, -1.95], fov: fovL(50) }, { u: 1, p: [229.55, 1.24, -1.32], l: [230.08, 1.42, -1.95], fov: fovL(50) }]);
};
STAGE[22] = (t, lt, u, W, c, cam) => {
  kaiCorridorDoor(c, t, 0.25); pack(c, t);
  camKeys(cam, u, [{ u: 0, p: [231.1, 0.42, -1.05], l: [200, 1.0, 0.2], fov: fovL(35) }, { u: 1, p: [231.0, 0.42, -1.05], l: [200, 1.0, 0.2], fov: creep(fovL(35), lt, 0.12) }]);
};
STAGE[23] = (t, lt, u, W, c, cam) => {
  kaiCorridorDoor(c, t, 0.4); pack(c, t);
  c.kai.armL.sh.rotation.x = -0.9; c.kai.armL.sh.rotation.z = -0.5; c.kai.armL.el.rotation.x = -1.2; c.kai.armR.sh.rotation.x = -0.7; c.kai.armR.el.rotation.x = -1.0;
  c.kai.keys.position.set(0, 0.22, 0.3); c.kai.keys.scale.setScalar(1.6); c.kai.keys.rotation.set(Math.sin(t * 30) * 0.3, t * 3, Math.cos(t * 23) * 0.4);
  camKeys(cam, u, [{ u: 0, p: [230.62, 1.3, -1.95], l: [230.3, 1.15, -1.72], fov: fovL(100) }, { u: 0.5, p: [230.62, 1.3, -1.95], l: [230.3, 1.15, -1.72], fov: fovL(100) }, { u: 1, p: [230.62, 1.3, -1.95], l: [212, 1.0, 0.3], fov: fovL(60) }]);
};
STAGE[24] = (t, lt, u, W, c, cam) => {
  camKeys(cam, u, [{ u: 0, p: [251.6, 0.9, 0.9], l: [256.6, 2.35, 0], fov: fovL(35) }, { u: 1, p: [251.9, 0.9, 0.85], l: [256.6, 2.35, 0], fov: fovL(35) }]);
};
STAGE[25] = (t, lt, u, W, c, cam) => {
  kaiCorridorDoor(c, t, 0.15); c.kai.root.rotation.y = Math.PI / 2 + 0.35; c.kai.spine.rotation.x = 0.2; c.kai.neck.rotation.x = 0.05; pack(c, t);
  const crush = ss(seg(lt, 0.25, 0.55)); c.kai.armL.sh.rotation.x = -0.9 * crush; c.kai.armL.el.rotation.x = -1.7 * crush; c.kai.armR.sh.rotation.x = -0.8 * crush; c.kai.armR.el.rotation.x = -1.8 * crush; c.mop.visible = false;
  c.pocketGlow.material.opacity = 0.85 * (0.6 + 0.4 * Math.sin(t * 20)); c.kai.setBlink(1); c.kai.setBrows(0.7);
  const e = eyeWorld(c.kai); camKeys(cam, u, [{ u: 0, p: [e.x + 1.05, e.y - 0.12, e.z + 0.32], l: [e.x - 1.5, e.y - 0.35, e.z - 0.2], fov: fovL(65) }, { u: 1, p: [e.x + 1.05, e.y - 0.12, e.z + 0.32], l: [e.x - 1.5, e.y - 0.35, e.z - 0.2], fov: creep(fovL(65), lt, 0.2) }]);
};
STAGE[26] = (t, lt, u, W, c, cam) => {
  kaiCorridorDoor(c, t, 0.35); wrenInRoom(c, t, 1); c.wren.root.position.x = 229.9; c.wren.armSwing(c.wren.armL, 2.0, 2.4); c.wren.armL.sh.rotation.z = -0.35; c.wren.look(0, 0.05);
  tallInRoom(c, t, lt > 3.6 ? 0.5 * ss(seg(lt, 3.6, 4.6)) : 0);
  camKeys(cam, u, [{ u: 0, p: [229.95, 1.52, -1.0], l: [230.05, 1.36, -2.2], fov: fovL(50) }, { u: 0.7, p: [230.1, 1.44, -1.8], l: [230.8, 1.45, -4.5], fov: fovL(50) }, { u: 1, p: [230.11, 1.45, -1.99], l: [231.1, 1.5, -5.2], fov: fovL(50) }]);
};
STAGE[27] = (t, lt, u, W, c, cam, out) => {
  out.slow = true; const ta = 73.6 + lt * 0.5; out.tAnim = ta;
  kaiCorridorDoor(c, ta, 0.3); pack(c, ta);
  cam.position.set(235.6 - u * 0.4, 4.3, 0.9); cam.up.set(0, 1, 0); cam.lookAt(215, 0.2, -0.3); cam.rotateZ(0.05 * u - 0.025); cam.fov = fovL(24);
  W.redC.forEach((l) => { l.intensity *= 2.2; }); W.flickC.intensity = 0; out.spots = [[230.3, -1.4], [210, 0]];
};
STAGE[28] = (t, lt, u, W, c, cam) => {
  kaiCorridorDoor(c, t, 0.05); c.kai.look(0, 0); c.mop.visible = false;
  const seq = [[0.3, -1], [0.9, 1], [1.5, 0.2], [2.2, -0.6]]; let px = 0; for (const [tt, v] of seq) if (lt > tt) px = v; c.kai.setPupils(px, 0); c.kai.setBrows(0.6);
  const e = eyeWorld(c.kai); const cz = Math.max(e.z - 0.36, -1.9); camKeys(cam, u, [{ u: 0, p: [e.x - 0.02, e.y + 0.01, cz], l: [e.x, e.y, e.z], fov: fovL(50) }, { u: 1, p: [e.x - 0.02, e.y + 0.01, cz + 0.02], l: [e.x, e.y, e.z], fov: creep(fovL(50), lt, 0.15) }]);
};
STAGE[29] = (t, lt, u, W, c, cam) => {
  kaiCorridorDoor(c, t, 0.05); c.mop.visible = false;
  const turn = ss(seg(lt, 0.2, 1.1)); c.kai.root.rotation.y = Math.PI - 1.3 * turn; c.kai.look(-0.91 * turn, 0.02); c.kai.setBrows(0.55);
  camKeys(cam, u, [{ u: 0, p: [231.2, 1.6, -0.75], l: [230.3, 1.62, -1.42], fov: fovL(50) }, { u: 1, p: [231.2, 1.6, -0.75], l: [230.3, 1.62, -1.42], fov: creep(fovL(50), lt, 0.3) }]);
};
STAGE[30] = (t, lt, u, W, c, cam, out) => {
  out.black = t >= 86.8;
  out.split = { left: (cam2) => { // A: door window + chain
    kaiCorridorDoor(c, t, 0.3); c.kai.root.visible = false; wrenInRoom(c, t, 1); c.wren.root.position.x = 230.05; tallInRoom(c, t, 0.5);
    cam2.position.set(230.55, 1.22, -1.15); cam2.up.set(0, 1, 0); cam2.lookAt(230.2, 1.12, -2.0); cam2.fov = fovL(30);
  }, right: (cam2) => { // B: shutter gap
    cam2.position.set(253.4, 1.45, 0.4); cam2.up.set(0, 1, 0); cam2.lookAt(256.6, 1.85, 0); cam2.fov = fovL(35);
  } };
  // background = the frozen last frame of S29
  STAGE[29](82.59, 3.59, 1, W, c, cam, out);
};
