// The two hero machines of the Yamaguchi short, built for close cameras:
//  * a 2-8-2 steam locomotive in the JNR D51 manner (smoke deflectors, long top dome, headlamp, red running gear with
//    spinning spoked wheels, coupling + main rods driven by the crank angle), tender, and two carriages; the first
//    carriage has a full interior (long bench seats under the windows, luggage racks, lamps) for the inside shot.
//  * an oil tanker on the building slip (parametric hull with a raked bow and a cruiser stern, deck pipes, aft
//    bridge house + funnel), staging with welders, a gantry crane carrying a swinging steel plate, a hammerhead
//    tower crane slewing, a tugboat in the harbour.
// Moving parts are updated per frame by world.ts (pure functions of the story time).
import * as THREE from "three";
import { Batch, boxGeo, quad, V, lam } from "./build";
import { ctex, jit } from "./paint";
import { twoTone } from "./shade";
import { V3 } from "./story";

const M4 = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: V3 = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(...s));
const solid = (key: string, color: string) => lam(key, () => ({ color }));
const phong = (key: string, color: string, spec = "#9a9a9a", shin = 40) => {
  const m = twoTone(new THREE.MeshPhongMaterial({ color, specular: spec, shininess: shin }), 0.15);
  m.name = key;
  return m;
};
const PH = new Map<string, THREE.Material>();
const ph = (key: string, color: string, spec?: string, shin?: number) => { let m = PH.get(key); if (!m) { m = phong(key, color, spec, shin); PH.set(key, m); } return m; };
/** cylinder along z, centre (x, y, zc), length L */
const cylZ = (r: number, L: number, n = 20) => new THREE.CylinderGeometry(r, r, L, n).rotateX(Math.PI / 2);
/** cylinder along x */
const cylX = (r: number, L: number, n = 20) => new THREE.CylinderGeometry(r, r, L, n).rotateZ(Math.PI / 2);

// ================================================================ train
export const CAR0 = 17.6, CAR_LEN = 15, CAR1 = 33.2;      // carriage starts (m behind the nose)
export const DRIVERS = [2.6, 4.15, 5.7, 7.25], DRIVER_R = 0.75, WHEEL_Y = 0.78;
const CRANK = 0.32;

/** spoked wheel group (axis = x), radius r, thickness th; drawn so its rotation reads (spokes, counterweight, crank pin) */
const wheel = (r: number, th: number, big: boolean) => {
  const g = new THREE.Group(), b = new Batch();
  const tire = ph("tire", "#1c1c21", "#7a7a80", 50), red = solid("wheelRed", "#b23a2e"), dark = solid("spoke", "#6e1f19");
  b.add(cylX(r, th, 28), tire);
  b.add(cylX(r * 0.86, th + 0.02, 28), red);
  b.add(cylX(r * 0.24, th + 0.08, 14), tire);
  const n = big ? 12 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.add(boxGeo(V(-(th / 2 + 0.015), -0.025, 0), V(th / 2 + 0.015, 0.025, r * 0.84)), dark, M4(0, 0, 0, a, 0, 0));
  }
  if (big) { // counterweight opposite the crank
    const cw = new THREE.CylinderGeometry(r * 0.84, r * 0.84, th + 0.03, 20, 1, false, -0.55, 1.1).rotateZ(Math.PI / 2);
    b.add(cw, tire, M4(0, 0, 0, Math.PI, 0, 0));
  }
  b.add(cylX(0.06, th + 0.2, 10), ph("pin", "#d0d4da", "#ffffff", 80), M4(0, CRANK * (big ? 1 : 0.0001), 0));
  b.build(g, true);
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.matrixAutoUpdate = true; m.frustumCulled = false; } });
  return g;
};

export type Train = {
  g: THREE.Group;
  /** put the nose at z; dist = metres travelled (wheel angle) */
  update: (z: number, dist: number) => void;
  /** crank angle of the drivers (rad) at the last update, for steam puffs */
  crank: () => number;
};

export const buildTrain = (): Train => {
  const g = new THREE.Group();
  const loco = new Batch(), body = new Batch(), inside = new Batch();
  const black = ph("locoBlack", "#25262c", "#8a8a92", 55), smoke = ph("smokebox", "#1b1c21", "#6a6a70", 30);
  const red = solid("frameRed", "#a8332a"), brass = ph("brass", "#c9a24a", "#fff2c0", 70), steel = ph("steelLoco", "#9aa0a8", "#ffffff", 70);
  // --- locomotive (nose at z 0, runs toward -z) ---
  loco.add(boxGeo(V(-1.35, 0.72, -0.05), V(1.35, 1.18, 0.28)), red);                                   // buffer beam
  for (const s of [-1, 1]) { loco.add(cylZ(0.13, 0.32, 12), steel, M4(s * 0.85, 0.95, -0.2)); loco.add(cylZ(0.2, 0.04, 14), steel, M4(s * 0.85, 0.95, -0.36)); }
  loco.add(boxGeo(V(-1.15, 0, 0), V(1.15, 0.1, 0.95)), black, M4(0, 0.18, -0.55, -0.75, 0, 0));         // pilot (cowcatcher)
  loco.add(boxGeo(V(-0.95, 0.55, 0.2), V(0.95, 1.12, 11.0)), red);                                      // frames
  for (const s of [-1, 1]) {
    loco.add(boxGeo(V(s * 1.0 - 0.18, 0.82, 0.55), V(s * 1.0 + 0.32, 1.6, 2.05)), black);                 // cylinders
    loco.add(boxGeo(V(s * 1.05 - 0.2, 1.5, 0.4), V(s * 1.05 + 0.42, 1.56, 7.4)), black);                  // running boards
    loco.add(boxGeo(V(s * 1.36 - 0.03, 1.6, 0.55), V(s * 1.36 + 0.03, 3.25, 2.4)), black);                // smoke deflectors
    loco.add(boxGeo(V(s * 1.05, 2.35, 2.4), V(s * 1.3, 2.4, 6.8)), brass);                                // handrails
  }
  loco.add(cylZ(1.02, 1.1, 28), smoke, M4(0, 2.4, 1.05));                                               // smokebox
  loco.add(new THREE.CylinderGeometry(0.88, 0.95, 0.12, 28).rotateX(Math.PI / 2), smoke, M4(0, 2.4, 0.46)); // door
  loco.add(cylZ(0.06, 0.1, 10), steel, M4(0, 2.4, 0.38));                                               // door handle
  loco.add(boxGeo(V(-0.32, 1.95, 0.36), V(0.32, 2.12, 0.42)), brass);                                   // plate (no lettering)
  loco.add(cylZ(0.98, 5.9, 28), black, M4(0, 2.4, 4.55));                                               // boiler
  for (const z of [2.9, 4.5, 6.1]) loco.add(cylZ(1.0, 0.06, 28), brass, M4(0, 2.4, z));                 // boiler bands
  loco.add(new THREE.CylinderGeometry(0.34, 0.4, 0.75, 16), black, M4(0, 3.65, 1.25));                   // chimney
  loco.add(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16), black, M4(0, 4.04, 1.25));                 // chimney lip
  const dome = new THREE.CapsuleGeometry(0.36, 2.2, 6, 14).rotateX(Math.PI / 2); dome.scale(1, 0.85, 1);
  loco.add(dome, black, M4(0, 3.35, 4.3));                                                              // long top dome
  loco.add(cylZ(0.19, 0.38, 14), black, M4(0, 3.62, 0.72));                                            // headlamp body
  loco.add(boxGeo(V(-1.45, 1.5, 7.4), V(1.45, 4.25, 10.4)), black);                                    // cab
  for (const s of [-1, 1]) loco.add(boxGeo(V(s * 1.46 - 0.02, 2.9, 7.8), V(s * 1.46 + 0.02, 3.8, 9.0)), solid("cabGlass", "#3a3f52")); // cab windows
  loco.add(new THREE.CylinderGeometry(2.4, 2.4, 3.6, 24, 1, false, -0.66, 1.32).rotateX(-Math.PI / 2), black, M4(0, 2.0, 8.9)); // cab roof
  loco.add(cylZ(0.05, 0.4, 8), brass, M4(0.5, 4.35, 7.6));                                              // whistle
  // tender
  loco.add(boxGeo(V(-1.4, 1.2, 11.0), V(1.4, 3.5, 17.0)), black);
  for (let i = 0; i < 14; i++) loco.add(new THREE.SphereGeometry(0.55, 10, 8), solid("coal", "#141417"), M4(-0.8 + (i % 4) * 0.55, 3.45, 11.6 + Math.floor(i / 4) * 1.3, 0, 0, 0, [1, 0.45, 1]));
  loco.add(boxGeo(V(-1.0, 0.5, 11.2), V(1.0, 1.2, 16.8)), black);
  // --- carriages: deep grape-brown bodies, cream band, light wood window frames ---
  const bodyM = solid("carBody", "#3f2421"), band = solid("carBand", "#d9c27a"), frameW = solid("winFrame", "#c79e66"), roof = solid("carRoof", "#34343a"), under = ph("under", "#1f1f24", "#555", 20);
  for (const z0 of [CAR0, CAR1]) {
    const z1 = z0 + CAR_LEN, wy0 = 1.75, wy1 = 2.65;
    if (z0 === CAR1) {
      body.add(boxGeo(V(-1.4, 1.1, z0), V(1.4, wy0, z1)), bodyM);
      body.add(boxGeo(V(-1.4, wy1, z0), V(1.4, 3.4, z1)), bodyM);
    } else for (const sd of [-1, 1]) { // hollow: thin side walls so the inside shot sees the bench, racks and ceiling
      body.add(boxGeo(V(sd > 0 ? 1.36 : -1.4, 1.1, z0), V(sd > 0 ? 1.4 : -1.36, wy0, z1)), bodyM);
      body.add(boxGeo(V(sd > 0 ? 1.36 : -1.4, wy1, z0), V(sd > 0 ? 1.4 : -1.36, 3.4, z1)), bodyM);
    }
    for (const zz of [z0, z1 - 0.1]) body.add(boxGeo(V(-1.4, 1.1, zz), V(1.4, 3.4, zz + 0.1)), bodyM); // end walls
    for (let zz = z0; zz < z1 - 0.05; zz += 1.6) for (const s of [-1, 1]) {
      body.add(boxGeo(V(s * 1.4 - 0.05, wy0, zz), V(s * 1.4 + 0.05, wy1, zz + 0.6)), bodyM);              // piers
      if (zz + 1.6 < z1) { // window frame + sash bar
        body.add(boxGeo(V(s * 1.42 - 0.02, wy0 - 0.05, zz + 0.6), V(s * 1.42 + 0.02, wy0 + 0.02, zz + 1.6)), frameW);
        body.add(boxGeo(V(s * 1.42 - 0.02, wy1 - 0.03, zz + 0.6), V(s * 1.42 + 0.02, wy1 + 0.04, zz + 1.6)), frameW);
        body.add(boxGeo(V(s * 1.41 - 0.015, 2.2, zz + 0.6), V(s * 1.41 + 0.015, 2.24, zz + 1.6)), frameW);
      }
    }
    for (const sd of [-1, 1]) body.add(boxGeo(V(sd > 0 ? 1.39 : -1.43, wy0 - 0.2, z0), V(sd > 0 ? 1.43 : -1.39, wy0 - 0.08, z1)), band);
    const rf = new THREE.CylinderGeometry(2.0, 2.0, CAR_LEN + 0.2, 24, 1, false, -0.8, 1.6).rotateX(-Math.PI / 2);
    body.add(rf, roof, M4(0, 2.0, z0 + CAR_LEN / 2));
    for (let k = 1; k < 5; k++) body.add(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 12), roof, M4(0, 4.0, z0 + k * 3));     // roof vents
    body.add(boxGeo(V(-1.2, 0.55, z0 + 0.3), V(1.2, 1.1, z1 - 0.3)), under);
    body.add(boxGeo(V(-0.7, 1.1, z1), V(0.7, 3.0, z1 + 0.6)), under);                                    // gangway
    if (z0 === CAR1) {
      body.add(boxGeo(V(-1.38, 1.15, z0 + 0.05), V(-1.3, 3.35, z1 - 0.05)), solid("cabin", "#2a2224"));
      body.add(boxGeo(V(1.3, 1.15, z0 + 0.05), V(1.38, 3.35, z1 - 0.05)), solid("cabin", "#2a2224"));
    } else {
      // interior of the first carriage: wood walls, cream ceiling, long green bench seats, luggage racks, lamps
      const wood = solid("inWood", "#c99a68"), seat = solid("seatGreen", "#3f6b5a"), ceil = solid("inCeil", "#eadbb8"), floor = solid("inFloor", "#7a5a3e");
      inside.add(boxGeo(V(-1.3, 1.1, z0 + 0.1), V(1.3, 1.15, z1 - 0.1)), floor);
      inside.add(boxGeo(V(-1.3, 3.3, z0 + 0.1), V(1.3, 3.36, z1 - 0.1)), ceil);
      for (const s of [-1, 1]) {
        inside.add(boxGeo(V(s * 1.33 - 0.03, 1.15, z0 + 0.1), V(s * 1.33 + 0.03, 1.75, z1 - 0.1)), wood);   // wall below the windows
        inside.add(boxGeo(V(s * 1.33 - 0.03, 2.65, z0 + 0.1), V(s * 1.33 + 0.03, 3.3, z1 - 0.1)), wood);    // wall above
        inside.add(boxGeo(V(s * 0.85, 1.15, z0 + 0.3), V(s * 1.3, 1.55, z1 - 0.3)), seat);                  // bench
        inside.add(boxGeo(V(s * 1.18, 1.55, z0 + 0.3), V(s * 1.3, 1.8, z1 - 0.3)), seat);                    // back cushion
        inside.add(boxGeo(V(s * 0.95, 2.95, z0 + 0.3), V(s * 1.3, 2.98, z1 - 0.3)), solid("rack", "#c9b28a")); // luggage rack
        for (let zz = z0 + 0.6; zz < z1 - 0.3; zz += 1.2) inside.add(boxGeo(V(s * 0.95 - 0.02, 2.9, zz), V(s * 0.95 + 0.02, 3.3, zz + 0.03)), solid("rackBar", "#6e5a40"));
      }
      for (let k = 0; k < 4; k++) inside.add(new THREE.SphereGeometry(0.12, 12, 8), solid("lampShade", "#f4ecd2"), M4(0, 3.22, z0 + 2 + k * 3.6));
      for (const zz of [z0 + 0.1, z1 - 0.16]) inside.add(boxGeo(V(-1.3, 1.15, zz), V(1.3, 3.3, zz + 0.06)), wood);
    }
  }
  const lg = new THREE.Group(), bg = new THREE.Group(), ig = new THREE.Group();
  loco.build(lg, true); body.build(bg, false); inside.build(ig, false);
  g.add(lg, bg, ig);
  // headlamp lens (glows)
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.2), fog: false }));
  lens.position.set(0, 3.62, 0.52); lens.rotation.y = Math.PI; g.add(lens);
  // wheels: pony, 4 drivers, trailing, tender + carriage bogies
  const spin: { w: THREE.Group; r: number; ph: number }[] = [];
  const addW = (x: number, y: number, z: number, r: number, th: number, big: boolean) => { const w = wheel(r, th, big); w.position.set(x, y, z); g.add(w); spin.push({ w, r, ph: big && x < 0 ? Math.PI / 2 : 0 }); };
  for (const s of [-1, 1]) {
    addW(s * 1.12, 0.45, 0.95, 0.43, 0.14, false);
    for (const z of DRIVERS) addW(s * 1.12, WHEEL_Y, z, DRIVER_R, 0.16, true);
    addW(s * 1.12, 0.5, 9.1, 0.5, 0.14, false);
    for (const z of [11.9, 13.0, 15.0, 16.1]) addW(s * 1.08, 0.45, z, 0.43, 0.12, false);
    for (const z0 of [CAR0, CAR1]) for (const z of [z0 + 1.6, z0 + 2.9, z0 + CAR_LEN - 2.9, z0 + CAR_LEN - 1.6]) addW(s * 1.05, 0.45, z, 0.43, 0.12, false);
  }
  // rods (outside the drivers): coupling rod + main rod to the crosshead, per side
  const rodM = ph("rod", "#c8ccd2", "#ffffff", 90);
  const rods = [-1, 1].map((s) => {
    const coup = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, DRIVERS[3] - DRIVERS[0]), rodM);
    const main = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 1), rodM);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.3), rodM);
    for (const m of [coup, main, head]) { m.castShadow = true; m.frustumCulled = false; g.add(m); }
    return { s, coup, main, head };
  });
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.frustumCulled = false; });
  let crankA = 0;
  const update = (z: number, dist: number) => {
    g.position.set(0, 0, z); g.updateMatrixWorld();
    for (const { w, r, ph } of spin) w.rotation.x = -(dist / r + ph);  // rolling toward -z (tops move forward)
    crankA = dist / DRIVER_R;
    for (const { s, coup, main, head } of rods) {
      const ph0 = s > 0 ? 0 : Math.PI / 2;                          // quartered cranks
      const a = crankA + ph0, dy = CRANK * Math.cos(a), dz = -CRANK * Math.sin(a), x = s * 1.27;
      coup.position.set(x, WHEEL_Y + dy, (DRIVERS[0] + DRIVERS[3]) / 2 + dz);
      const pin = V(x, WHEEL_Y + dy, DRIVERS[1] + dz);
      const L = 2.25, cz = pin.z - Math.sqrt(Math.max(0.01, L * L - (pin.y - 1.2) ** 2));
      const cross = V(x, 1.2, cz);
      head.position.copy(cross);
      main.position.copy(cross).add(pin).multiplyScalar(0.5);
      main.scale.set(1, 1, cross.distanceTo(pin));
      main.lookAt(g.localToWorld(pin.clone()));
    }
  };
  return { g, update, crank: () => crankA };
};

// ================================================================ ship on the slip
const hullTex = () => ctex("tankerHull", 2048, 512, (g, r) => {
  g.fillStyle = "#2f343e"; g.fillRect(0, 0, 2048, 512);                    // topsides
  g.fillStyle = "#c4533a"; g.fillRect(0, 300, 2048, 212);                   // bottom
  g.fillStyle = "#ece6d6"; g.fillRect(0, 286, 2048, 16);                    // boot-top line
  g.strokeStyle = "rgba(12,12,16,0.5)"; g.lineWidth = 3;
  for (let x = 0; x < 2048; x += 96) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }  // plate seams
  for (let y = 60; y < 512; y += 74) { g.beginPath(); g.moveTo(0, y); g.lineTo(2048, y); g.stroke(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)"; g.fillRect(r() * 2048, r() * 512, 20 + r() * 70, 6 + r() * 20); } // weld marks / primer patches
  for (let i = 0; i < 70; i++) { g.fillStyle = "rgba(150,70,40,0.35)"; g.fillRect(r() * 2048, 300 + r() * 200, 3 + r() * 5, 10 + r() * 30); }   // rust streaks
});
const houseTex = () => ctex("bridgeWin", 512, 256, (g) => {
  g.fillStyle = "#efe9dc"; g.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) { g.fillStyle = row === 0 ? "#3c4a5e" : "#596a80"; g.fillRect(20 + i * 62, 30 + row * 76, 40, row === 0 ? 34 : 24); }
  g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, 100, 512, 4); g.fillRect(0, 176, 512, 4);
});

/** parametric hull: x from stern xs to bow xb, centreline z = zc, keel at y0, depth D, half beam W */
const hullGeo = (xs: number, xb: number, zc: number, y0: number, D: number, W: number) => {
  const NU = 60, NV = 14, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const half = (u: number, v: number) => {
    let w = W;
    if (u > 0.68) w *= Math.cos(((u - 0.68) / 0.32) * Math.PI / 2) ** 0.75;          // fine bow
    if (u < 0.1) w *= 0.78 + 0.22 * Math.sin((u / 0.1) * Math.PI / 2);                // cruiser stern
    const bilge = u > 0.68 ? v ** 0.75 : Math.min(1, (v / 0.22) ** 0.45);              // round bilge amidships, V at the bow
    return Math.max(0.02, w * bilge * (1 + 0.06 * v * (u > 0.75 ? 1 : 0)));            // slight bow flare
  };
  const xAt = (u: number, v: number) => xs + (xb - xs) * u + (u > 0.9 ? 2.6 * v * ((u - 0.9) / 0.1) : 0) - (u < 0.04 ? 1.4 * v * (1 - u / 0.04) : 0);
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = j / NV;
      pos.push(xAt(u, v), y0 + D * v + (u > 0.85 ? 0.9 * ((u - 0.85) / 0.15) ** 2 * v : 0), zc + side * half(u, v));
      uv.push(u * 6, v);
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = base + i * (NV + 1) + j, b = a + NV + 1;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // deck: a flat cap following the sheer line
  const dp: number[] = [], du: number[] = [], di: number[] = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, y = y0 + D + (u > 0.85 ? 0.9 * ((u - 0.85) / 0.15) ** 2 : 0), x = xAt(u, 1), w = half(u, 1);
    dp.push(x, y, zc + w, x, y, zc - w); du.push(u * 8, 0, u * 8, 1);
    if (i < NU) { const a = i * 2; di.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const d = new THREE.BufferGeometry();
  d.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
  d.setAttribute("uv", new THREE.Float32BufferAttribute(du, 2));
  d.setIndex(di); d.computeVertexNormals();
  return { hull: g, deck: d, half, xAt };
};

export const SHIP = { xs: -30, xb: 31, zc: -128, y0: 1.3, D: 9.4, W: 6.2 };
const SZ = SHIP.zc + SHIP.W + 2.2; // staging line
/** welders standing on the staging planks (feet positions) */
export const WELDERS: V3[] = [[SHIP.xb - 14, 6.32, SZ - 0.4], [SHIP.xb - 24, 9.32, SZ - 0.4], [SHIP.xb - 33, 3.32, SZ - 0.4], [SHIP.xb - 45, 6.32, SZ - 0.4]];
export type Yard = { g: THREE.Group; update: (t: number) => void; welders: V3[] };

export const buildYard = (): Yard => {
  const g = new THREE.Group(), b = new Batch(), S = SHIP;
  const { hull, deck, half } = hullGeo(S.xs, S.xb, S.zc, S.y0, S.D, S.W);
  b.add(hull, lam("tankerHullM", () => ({ map: hullTex(), side: THREE.DoubleSide })));
  b.add(deck, solid("tankDeck", "#7d6f60"));
  const yDeck = S.y0 + S.D;
  // slip: concrete ramp strip, keel blocks, shores
  b.add(boxGeo(V(S.xs - 6, 0, S.zc - 9), V(S.xb + 8, 0.06, S.zc + 9)), solid("slip", "#a69e92"));
  for (let x = S.xs + 2; x < S.xb - 3; x += 3) {
    b.add(boxGeo(V(x - 0.5, 0, S.zc - 1), V(x + 0.5, S.y0 + 0.05, S.zc + 1)), solid("keelBlock", "#6e4a32"));
    for (const s of [-1, 1]) b.add(boxGeo(V(x - 0.12, 0, S.zc + s * (half((x - S.xs) / (S.xb - S.xs), 0.25) + 1.6)), V(x + 0.12, 3.2, S.zc + s * (half((x - S.xs) / (S.xb - S.xs), 0.25) + 1.85))), solid("shore", "#7a5a3a"), M4(0, 0, 0));
  }
  // deck fittings: pipes along the deck, catwalk, masts, aft bridge house, funnel with a band
  for (const dz of [-1.6, -0.6, 0.6]) b.add(cylX(0.18, 34, 10), ph("pipe", "#6d7480", "#cccccc", 40), M4(4, yDeck + 0.5, S.zc + dz));
  b.add(boxGeo(V(-12, yDeck + 1.4, S.zc + 1.0), V(22, yDeck + 1.5, S.zc + 2.0)), solid("catwalk", "#5a5f68"));
  for (const x of [-11, 24]) b.add(new THREE.CylinderGeometry(0.22, 0.28, 9, 10), ph("mast", "#e8e2d4", "#fff", 30), M4(x, yDeck + 4.5, S.zc));
  const hx0 = S.xs + 1.5, hx1 = S.xs + 12;
  b.add(boxGeo(V(hx0, yDeck, S.zc - 5.2), V(hx1, yDeck + 7.5, S.zc + 5.2)), lam("bridgeHouseW", () => ({ map: houseTex() })));
  b.add(boxGeo(V(hx0 + 2, yDeck + 7.5, S.zc - 6.2), V(hx1 - 1, yDeck + 8.0, S.zc + 6.2)), solid("bridgeTop", "#d9d2c4"));
  b.add(new THREE.CylinderGeometry(1.5, 1.7, 6, 18), ph("funnel", "#2b2e36", "#777", 20), M4(hx0 + 4, yDeck + 11, S.zc));
  b.add(new THREE.CylinderGeometry(1.56, 1.6, 1.0, 18), solid("funnelBand", "#c8342c"), M4(hx0 + 4, yDeck + 11.2, S.zc));
  // staging on the camera side: poles, three plank decks, braces
  const sz = S.zc + S.W + 2.2, wood = solid("staging", "#8a6a48"), pole = solid("stagePole", "#6e5a44");
  for (let x = S.xs + 2; x < S.xb - 4; x += 7) b.add(boxGeo(V(x - 0.09, 0, sz - 0.09), V(x + 0.09, yDeck + 1.0, sz + 0.09)), pole);
  for (const y of [3.2, 6.2, 9.2]) b.add(boxGeo(V(S.xs + 2, y, sz - 0.9), V(S.xb - 5, y + 0.14, sz + 0.1)), wood);
  // gantry crane over the slip (legs at x 6, along z), red, with walkway; trolley + plate are animated
  const red = solid("gantry", "#c75a35"), cab = solid("gantryCab", "#e9e1cf");
  for (const z of [S.zc - 15, S.zc + 15]) for (const x of [4.6, 7.4]) b.add(boxGeo(V(x - 0.45, 0, z - 0.45), V(x + 0.45, 30, z + 0.45)), red);
  for (const z of [S.zc - 15, S.zc + 15]) b.add(boxGeo(V(3.8, 0, z - 0.8), V(8.2, 0.8, z + 0.8)), red);
  b.add(boxGeo(V(3.9, 30, S.zc - 16), V(8.1, 32.4, S.zc + 16)), red);
  for (let z = S.zc - 15; z < S.zc + 15; z += 2.5) b.add(boxGeo(V(3.85, 30.3, z), V(8.15, 32.1, z + 0.25)), solid("gantryDark", "#8f3c24"));
  // hammerhead tower crane at the bow (tower static, jib animated)
  const tx = S.xb + 9, tz = S.zc + 12;
  b.add(boxGeo(V(tx - 1, 0, tz - 1), V(tx + 1, 34, tz + 1)), solid("tower", "#2f5f8a"));
  for (let y = 2; y < 34; y += 3) b.add(boxGeo(V(tx - 1.05, y, tz - 1.05), V(tx + 1.05, y + 0.25, tz + 1.05)), solid("towerDark", "#1f3f5e"));
  // harbour quay edge
  b.add(boxGeo(V(-120, -0.8, -160.5), V(120, 0.05, -159.5)), solid("quay", "#8d867a"));
  b.build(g);
  // animated: gantry trolley + cable + plate; tower crane jib; tugboat
  const trolley = new THREE.Group();
  const tb = new Batch();
  tb.add(boxGeo(V(3.6, 29.2, -1.2), V(8.4, 30.2, 1.2)), cab);
  tb.add(boxGeo(V(5.2, 27.6, -0.8), V(6.8, 29.2, 0.8)), cab);
  tb.build(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6).translate(0, -0.5, 0), solid("cable", "#1e1b22"));
  const plate = new THREE.Group();
  const pb = new Batch();
  pb.add(boxGeo(V(-3.2, -0.12, -1.6), V(3.2, 0.12, 1.6)), ph("plate", "#6b7480", "#cfd6de", 50));
  for (const s of [-1, 1]) pb.add(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 6), solid("sling", "#1e1b22"), M4(s * 1.5, 1.55, 0, 0, 0, s * 0.42));
  pb.build(plate);
  const jib = new THREE.Group();
  const jb = new Batch();
  jb.add(boxGeo(V(-12, 0, -0.8), V(30, 2.0, 0.8)), solid("jib", "#2f5f8a"));
  jb.add(boxGeo(V(-12, 2.0, -1.4), V(-6, 4.5, 1.4)), solid("counterW", "#4a4f5a"));
  jb.add(boxGeo(V(-2, -2.5, -1.2), V(2, 0, 1.2)), cab);
  jb.add(new THREE.CylinderGeometry(0.04, 0.04, 14, 6).translate(0, -7, 0), solid("cable", "#1e1b22"), M4(24, 0, 0));
  jb.add(boxGeo(V(-0.4, -0.5, -0.4), V(0.4, 0, 0.4)), solid("hook", "#e0b030"), M4(24, -14, 0));
  jb.build(jib);
  jib.position.set(tx, 34, tz);
  const tug = new THREE.Group();
  const ub = new Batch();
  ub.add(boxGeo(V(-5, -0.6, -2), V(5, 1.4, 2)), solid("tugHull", "#7a2a24"));
  ub.add(boxGeo(V(-5.1, 1.2, -2.05), V(5.1, 1.6, 2.05)), solid("tugBand", "#1f1f24"));
  ub.add(boxGeo(V(-2.5, 1.6, -1.5), V(2, 4.0, 1.5)), solid("tugCabin", "#efe9dc"));
  ub.add(new THREE.CylinderGeometry(0.6, 0.7, 2.2, 12), solid("tugFunnel", "#c8342c"), M4(-0.5, 5.0, 0));
  ub.build(tug);
  for (const o of [trolley, cable, plate, jib, tug]) { g.add(o); o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; } }); }
  const welders = WELDERS;
  const update = (t: number) => {
    // gantry trolley crosses the slip carrying a plate that swings gently
    const zt = S.zc + 9 * Math.sin(t * 0.22 + 0.4);
    trolley.position.set(0, 0, zt);
    const sw = 0.09 * Math.sin(t * 1.25) + 0.03 * Math.sin(t * 2.7), L = 9.5;
    cable.position.set(6, 27.6, zt); cable.scale.set(1, L, 1); cable.rotation.set(sw, 0, 0);
    plate.position.set(6, 27.6 - L * Math.cos(sw) - 3.3, zt + L * Math.sin(sw) * 1.3);
    plate.rotation.set(sw * 1.3, 0.3 * Math.sin(t * 0.4), 0);
    jib.rotation.y = 0.9 + 0.12 * t;
    tug.position.set(-40 + 2.2 * t, -0.2, -182); tug.rotation.set(0.02 * Math.sin(t * 1.3), Math.PI, 0.03 * Math.sin(t * 1.1));
  };
  return { g, update, welders };
};
export { jit, quad };
