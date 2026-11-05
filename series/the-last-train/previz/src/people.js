// Posable stylized figures for the previz. Built from primitives on a canonical 1.75 m skeleton.
// Figures face +z. Their RIGHT side is -x, LEFT is +x (before root rotation).
import * as THREE from 'three';

const cache = new Map();
export function mat(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.78, metalness: o.metal ?? 0,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
    }));
  }
  return cache.get(key);
}

const G = {
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 12),
  sph: (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  cyl: (a, b, h, s = 14, open = false) => new THREE.CylinderGeometry(a, b, h, s, 1, open),
  tor: (r, t) => new THREE.TorusGeometry(r, t, 6, 20),
};
const M = (g, m) => { const x = new THREE.Mesh(g, m); return x; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c); return blobTex;
}

const SKIN_INF = 0x8e9a8f;

export class Person {
  constructor(o) {
    this.o = o;
    const skin = o.infected ? SKIN_INF : o.skin;
    const mSkin = mat(skin, { rough: 0.6 });
    const mShirt = mat(o.coat ? o.coat : o.shirt);
    const mPants = mat(o.pants);
    const mShoe = mat(o.shoes ?? 0x222222);
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    const s = (o.height ?? 1.75) / (o.child ? 1.62 : 1.75);
    this.body.scale.setScalar(s);
    const hs = o.child ? 1.28 : (o.headScale ?? 1.0);

    // shadow blob
    const blob = M(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.005; blob.renderOrder = 1; this.root.add(blob); this.blob = blob;

    // hips / legs
    this.hips = at(new THREE.Group(), 0, 0.92, 0); this.body.add(this.hips);
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = at(new THREE.Group(), 0.09 * side, 0, 0); this.hips.add(hip);
      const th = at(M(G.cap(0.075, 0.3), mPants), 0, -0.21, 0); hip.add(th);
      const knee = at(new THREE.Group(), 0, -0.43, 0); hip.add(knee);
      const sh = at(M(G.cap(0.06, 0.3), o.boots ? mat(o.boots) : mPants), 0, -0.2, 0); knee.add(sh);
      const foot = at(M(G.box(0.1, 0.07, 0.22), mShoe), 0, -0.43, 0.05); knee.add(foot);
      if (o.lace && side === 1) { const l = at(M(G.box(0.06, 0.012, 0.1), mat(0xff6a13)), 0, -0.39, 0.08); knee.add(l); }
      this.legs.push({ hip, knee });
    }
    // torso
    this.spine = at(new THREE.Group(), 0, 0.02, 0); this.hips.add(this.spine);
    const torso = at(M(G.cap(0.15, 0.27), mShirt), 0, 0.27, 0); torso.scale.set(o.child ? 1.12 : 1.15, 1, 0.75); this.spine.add(torso);
    this.torso = torso;
    if (o.coat) { // skirt
      const len = o.coatLen ?? 0.55;
      const sk = at(M(G.cyl(0.19, 0.27, len, 16, true), mat(o.coat, { side: THREE.DoubleSide })), 0, -len / 2 + 0.06, 0); sk.scale.z = 0.8; this.hips.add(sk);
    }
    if (o.vest) {
      const v = at(M(G.cap(0.158, 0.25), mat(0xff6a13, { rough: 0.55, emissive: 0x401000, ei: 0.6 })), 0, 0.27, 0); v.scale.set(1.17, 1, 0.8); this.spine.add(v);
      for (const y of [0.17, 0.30]) { const b = at(M(G.cyl(0.181, 0.181, 0.035, 20, true), mat(0xd9dde0, { metal: 0.6, rough: 0.25, emissive: 0x5a5d60, ei: 0.8, side: THREE.DoubleSide })), 0, y, 0); b.scale.set(1.17, 1, 0.8); this.spine.add(b); }
      // radio LEFT chest (+x), badge RIGHT chest (-x)
      const radio = at(M(G.box(0.05, 0.09, 0.03), mat(0x111111)), 0.085, 0.42, 0.125); this.spine.add(radio); this.radio = radio;
      const led = at(M(G.sph(0.008), mat(0xff2020, { emissive: 0xff2020, ei: 2 })), 0.085, 0.475, 0.14); this.spine.add(led);
      const badge = at(M(G.box(0.05, 0.025, 0.01), mat(0xffffff, { emissive: 0x777777 })), -0.08, 0.40, 0.128); this.spine.add(badge);
      const reel = at(M(G.cyl(0.035, 0.035, 0.025), mat(0x333333)), -0.17, -0.02, 0.04); reel.rotation.z = Math.PI / 2; this.hips.add(reel);
      const keys = new THREE.Group(); at(keys, -0.18, -0.09, 0.05); this.hips.add(keys); this.keys = keys;
      for (let i = 0; i < 9; i++) { const k = at(M(G.box(0.012, 0.05, 0.004), mat(i % 3 ? 0xc9a24a : 0xb8b8b8, { metal: 0.8, rough: 0.3 })), Math.sin(i) * 0.02, -0.02 - (i % 3) * 0.008, Math.cos(i * 2) * 0.01); k.rotation.z = (i - 4) * 0.12; keys.add(k); }
    }
    // neck/head
    this.neck = at(new THREE.Group(), 0, 0.52, 0); this.spine.add(this.neck);
    const nk = at(M(G.cyl(0.045, 0.05, 0.1), mSkin), 0, 0.03, 0); this.neck.add(nk);
    this.head = at(new THREE.Group(), 0, 0.14 + (hs - 1) * 0.08, 0); this.head.scale.setScalar(hs); this.neck.add(this.head);
    const skull = M(G.sph(0.118, 20, 16), mSkin); skull.scale.set(0.93, 1.07, 1.0); this.head.add(skull);
    const chin = at(M(G.sph(0.08, 14, 10), mSkin), 0, -0.065, 0.035); chin.scale.set(1.0, 0.8, 0.9); this.head.add(chin);
    for (const side of [-1, 1]) { const e = at(M(G.sph(0.03, 10, 8), mSkin), 0.112 * side, 0, 0); e.scale.set(0.45, 1, 0.75); this.head.add(e); }
    this.head.add(at(M(G.sph(0.018, 10, 8), mSkin), 0, -0.012, 0.118)); // nose
    // eyes
    const mWhite = o.infected ? mat(0xd8dccf, { emissive: 0x30352f }) : mat(0xf4f1ea);
    const mPup = mat(o.infected ? 0x1a1a1a : 0x1b120c, { rough: 0.3 });
    this.eyes = []; this.pupils = [];
    for (const side of [-1, 1]) {
      const ey = at(M(G.sph(0.026, 12, 10), mWhite), 0.043 * side, 0.018, 0.098); ey.scale.z = 0.55; this.head.add(ey); this.eyes.push(ey);
      const pu = at(M(G.sph(o.infected ? 0.006 : 0.013, 10, 8), mPup), 0.043 * side, 0.018, 0.112); pu.scale.z = 0.5; this.head.add(pu); this.pupils.push(pu);
      const br = at(M(G.box(0.045, 0.009, 0.012), mat(o.hairColor ?? 0x1a1410)), 0.043 * side, 0.058, 0.108); this.head.add(br); (this.brows ||= []).push(br);
      if (o.infected) { // ear blood trail
        const tr = at(M(G.cyl(0.004, 0.003, 0.16), mat(0x4a0c10, { rough: 0.3 })), 0.108 * side, -0.075, -0.005); tr.rotation.z = 0.12 * side; this.head.add(tr);
        const vn = at(M(G.box(0.004, 0.06, 0.004), mat(0x2b1f2e)), 0.07 * side, -0.05, 0.085); vn.rotation.z = 0.5 * side; this.head.add(vn);
      }
    }
    this.mouth = at(M(G.sph(0.02, 12, 8), mat(o.infected ? 0x160405 : 0x4a1c1c, { rough: 0.5 })), 0, -0.058, 0.103); this.mouth.scale.set(1.15, 0.22, 0.45); this.head.add(this.mouth);
    this.addHair(o);
    if (o.glasses) {
      const mg = mat(0xc8a24a, { metal: 0.9, rough: 0.25 });
      for (const side of [-1, 1]) { const r = at(M(G.tor(0.031, 0.0035), mg), 0.043 * side, 0.018, 0.122); this.head.add(r); const arm = at(M(G.box(0.003, 0.003, 0.11), mg), 0.075 * side, 0.02, 0.07); this.head.add(arm); }
      this.head.add(at(M(G.box(0.025, 0.003, 0.003), mg), 0, 0.022, 0.125)); // bridge
      this.head.add(at(M(G.box(0.012, 0.012, 0.012), mat(0xf2f2f2)), 0.077, 0.02, 0.118)); // tape on LEFT hinge (+x)
      this.head.add(at(M(G.box(0.012, 0.004, 0.004), mat(0xe8d8cc)), 0.043, 0.075, 0.11)); // scar through LEFT brow
    }
    if (o.cap) {
      const c = at(M(G.cyl(0.105, 0.11, 0.07, 18), mat(0x1c2540)), 0, 0.105, 0); this.head.add(c);
      const brim = at(M(G.cyl(0.13, 0.13, 0.012, 18), mat(0x141a2c)), 0, 0.075, 0.04); brim.scale.z = 0.9; this.head.add(brim);
      this.head.add(at(M(G.sph(0.016), mat(0xc9a24a, { metal: 0.8, rough: 0.3 })), 0, 0.11, 0.105));
    }
    // arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const sh = at(new THREE.Group(), 0.205 * side, 0.43, 0); this.spine.add(sh);
      const ua = at(M(G.cap(0.055, 0.2), mShirt), 0, -0.14, 0); sh.add(ua);
      const el = at(new THREE.Group(), 0, -0.29, 0); sh.add(el);
      const fa = at(M(G.cap(0.047, 0.19), mShirt), 0, -0.13, 0); el.add(fa);
      const hand = at(M(G.sph(0.045, 12, 10), mSkin), 0, -0.29, 0); hand.scale.set(0.8, 1.1, 0.6); el.add(hand);
      const grip = at(new THREE.Group(), 0, -0.3, 0.01); el.add(grip);
      if (o.bandage && side === 1) el.add(at(M(G.cyl(0.05, 0.05, 0.05), mat(0xf4f4f0)), 0, -0.22, 0));
      this.arms.push({ sh, el, grip, hand });
    }
    this.armR = this.arms[0]; this.armL = this.arms[1]; this.legR = this.legs[0]; this.legL = this.legs[1];
    this.reset();
  }

  addHair(o) {
    const hc = mat(o.hairColor ?? 0x1a1410, { rough: 0.9 });
    const h = this.head;
    switch (o.hair) {
      case 'curly': {
        for (let i = 0; i < 26; i++) {
          const a = i * 2.39996, r = 0.03 + 0.07 * Math.sqrt(i / 26);
          const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9 - 0.01;
          h.add(at(M(G.sph(0.035, 8, 6), hc), x, 0.105 - r * 0.35, z));
        }
        h.add(at(M(G.sph(0.03, 8, 6), hc), 0.01, 0.075, 0.1)); // curl on forehead
        for (const side of [-1, 1]) { const sd = at(M(G.sph(0.06, 10, 8), hc), 0.085 * side, 0.04, -0.02); sd.scale.set(0.35, 0.8, 0.9); h.add(sd); }
        break;
      }
      case 'bob': {
        const cap = at(M(new THREE.SphereGeometry(0.128, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hc), 0, 0.005, -0.005); cap.scale.set(1, 1.05, 1.02); h.add(cap);
        for (const side of [-1, 1]) { const s = at(M(G.box(0.03, 0.15, 0.17), hc), 0.112 * side, -0.035, -0.015); h.add(s); }
        const back = at(M(G.box(0.22, 0.15, 0.04), hc), 0, -0.04, -0.105); h.add(back);
        const fr = at(M(G.box(0.17, 0.035, 0.03), hc), 0, 0.085, 0.1); fr.rotation.x = -0.3; h.add(fr);
        if (o.clip) h.add(at(M(G.box(0.035, 0.018, 0.012), mat(0xc9a24a, { metal: 0.85, rough: 0.25, emissive: 0x302008 })), -0.105, 0.06, 0.06));
        break;
      }
      case 'short': { const c = at(M(new THREE.SphereGeometry(0.124, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hc), 0, 0.012, -0.01); h.add(c); break; }
      case 'bun': { const c = at(M(new THREE.SphereGeometry(0.126, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hc), 0, 0.008, -0.01); h.add(c); h.add(at(M(G.sph(0.05), hc), 0, 0.09, -0.1)); break; }
      case 'long': { const c = at(M(new THREE.SphereGeometry(0.127, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hc), 0, 0.006, -0.01); h.add(c); h.add(at(M(G.box(0.2, 0.26, 0.05), hc), 0, -0.1, -0.1)); break; }
      default: break;
    }
  }

  reset() {
    this.root.rotation.set(0, this.root.rotation.y, 0);
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.hips.rotation.set(0, 0, 0); this.spine.rotation.set(0, 0, 0);
    this.neck.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0);
    for (const a of this.arms) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
    for (const l of this.legs) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
    // relaxed arms hang slightly out
    this.armL.sh.rotation.z = 0.08; this.armR.sh.rotation.z = -0.08;
    this.armL.el.rotation.x = -0.15; this.armR.el.rotation.x = -0.15;
    this.setMouth(0); this.setBlink(0); this.setPupils(0, 0);
    if (this.o.lopsided) this.body.rotation.z = 0.06;
  }
  // a>0 swings forward
  legSwing(l, a, knee = 0) { l.hip.rotation.x = -a; l.knee.rotation.x = knee; }
  armSwing(r, a, elbow = 0.2) { r.sh.rotation.x = -a; r.el.rotation.x = -elbow; }
  setMouth(v) { this.mouth.scale.y = 0.22 + v * 0.75; this.mouth.position.y = -0.058 - v * 0.006; }
  setBlink(v) { for (const e of this.eyes) e.scale.y = Math.max(0.08, 1 - v); for (const p of this.pupils) p.visible = v < 0.6; }
  setPupils(x, y) { this.pupils.forEach((p, i) => { p.position.x = 0.043 * (i ? 1 : -1) + x * 0.011; p.position.y = 0.018 + y * 0.008; }); }
  setBrows(v) { this.brows.forEach((b, i) => { b.rotation.z = v * (i ? -0.35 : 0.35); b.position.y = 0.058 + Math.abs(v) * 0.006; }); }

  walk(ph, amp = 1) {
    const s = Math.sin(ph), c = Math.cos(ph);
    this.legSwing(this.legL, 0.42 * s * amp, Math.max(0, -c) * 0.55 * amp + 0.05);
    this.legSwing(this.legR, -0.42 * s * amp, Math.max(0, c) * 0.55 * amp + 0.05);
    this.armSwing(this.armL, -0.32 * s * amp, 0.3); this.armSwing(this.armR, 0.32 * s * amp, 0.3);
    this.body.position.y = Math.abs(Math.cos(ph)) * 0.035 * amp - 0.02 * amp;
    this.spine.rotation.x = 0.04 * amp; this.spine.rotation.y = 0.08 * s * amp;
  }
  run(ph, amp = 1) {
    const s = Math.sin(ph), c = Math.cos(ph);
    this.legSwing(this.legL, 0.85 * s * amp, (0.25 + Math.max(0, -c) * 1.3) * amp);
    this.legSwing(this.legR, -0.85 * s * amp, (0.25 + Math.max(0, c) * 1.3) * amp);
    this.armSwing(this.armL, -0.8 * s * amp, 1.3); this.armSwing(this.armR, 0.8 * s * amp, 1.3);
    this.body.position.y = Math.abs(Math.cos(ph)) * 0.07 * amp - 0.04 * amp;
    this.spine.rotation.x = 0.28 * amp; this.spine.rotation.y = 0.12 * s * amp; this.neck.rotation.x = -0.18 * amp;
  }
  crawl(ph) { // Night Runner on all fours
    const s = Math.sin(ph);
    this.body.position.y = -0.38; this.hips.rotation.x = 1.1; this.neck.rotation.x = -0.9;
    this.legSwing(this.legL, -0.6 + 0.6 * s, 1.4); this.legSwing(this.legR, -0.6 - 0.6 * s, 1.4);
    this.armSwing(this.armL, 1.0 - 0.5 * s, 0.3); this.armSwing(this.armR, 1.0 + 0.5 * s, 0.3);
  }
  sway(t, amt = 1, seed = 0) {
    this.body.rotation.z += Math.sin(t * 0.9 + seed) * 0.03 * amt;
    this.body.rotation.x += Math.sin(t * 0.7 + seed * 1.7) * 0.02 * amt;
    this.head.rotation.z += Math.sin(t * 0.6 + seed * 2.3) * 0.05 * amt;
  }
  look(yaw = 0, pitch = 0, roll = 0) { this.neck.rotation.y = yaw * 0.4; this.head.rotation.y = yaw * 0.6; this.head.rotation.x = pitch; this.head.rotation.z += roll; }
  holdInRight(obj) { this.armR.grip.add(obj); }
  place(x, z, rotY, y = 0) { this.root.position.set(x, y, z); this.root.rotation.y = rotY; }
}

// face toward a point on the ground plane
export function yawTo(fromX, fromZ, toX, toZ) { return Math.atan2(toX - fromX, toZ - fromZ); }

export function makeMop() {
  const g = new THREE.Group();
  const stick = at(M(G.cyl(0.014, 0.014, 1.35), mat(0x9a8a6a)), 0, 0.1, 0); g.add(stick);
  const head = at(M(G.cyl(0.07, 0.11, 0.16, 10), mat(0xb8b0a0, { rough: 1 })), 0, -0.6, 0); g.add(head);
  return g;
}

export function makePhone(screenTex) {
  const g = new THREE.Group();
  g.add(M(G.box(0.07, 0.14, 0.008), mat(0x0a0a0a, { rough: 0.3 })));
  const scr = at(M(new THREE.PlaneGeometry(0.064, 0.13), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })), 0, 0, 0.0045);
  g.add(scr); g.screen = scr;
  return g;
}
