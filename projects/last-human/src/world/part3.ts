// Part 3 sets: the hallway behind his door, the fire escape outside his window, and the subway (stairs, platform,
// tunnel, a train) with the crowd of them standing in the dark. Plus sparks and a phone torch.
import * as THREE from "three";
import { canvas, tex, concrete } from "./paint";
import { mesh, rbox, std } from "./props";
import { clockText } from "./apartment";
import { drawWatcher } from "../char/draw";

// ---------------------------------------------------------------- textures
function brick(seed = 7) {
  const { c, x } = canvas(512, 512);
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = "#2a2226"; x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) for (let col = 0; col < 8; col++) {
    const ox = row % 2 ? 32 : 0, l = 30 + r() * 16;
    x.fillStyle = `rgb(${l + 40},${l + 12},${l + 8})`;
    x.fillRect(col * 64 + ox + 2, row * 32 + 2, 60, 28);
  }
  return tex(c, [3, 3]);
}
function tiles(base: string, seed = 3) {
  const { c, x } = canvas(512, 512);
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = "#3a3a36"; x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) for (let col = 0; col < 8; col++) {
    x.fillStyle = base; x.globalAlpha = 0.85 + r() * 0.15; x.fillRect(col * 64 + 2, row * 32 + 2, 60, 28);
  }
  x.globalAlpha = 1;
  // grime running down from the top
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, "rgba(20,18,16,0.0)"); g.addColorStop(1, "rgba(20,18,16,0.45)");
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(30,26,20,${0.08 + r() * 0.12})`; x.fillRect(r() * 512, r() * 512, 2 + r() * 6, 30 + r() * 120); }
  return tex(c, [4, 2]);
}
function grating() {
  const { c, x } = canvas(256, 256);
  x.clearRect(0, 0, 256, 256); x.fillStyle = "#cfcfd6";
  for (let i = 0; i < 256; i += 16) { x.fillRect(i, 0, 4, 256); x.fillRect(0, i, 256, 3); }
  const t = tex(c, [6, 6]); return t;
}
function signTex(text: string, bg: string, fg: string, w = 1024, h = 256, font = "700 150px sans-serif") {
  const { c, x } = canvas(w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, w / 2, h / 2 + 6);
  return tex(c);
}

const iron = () => std("#23232b", { roughness: 0.55, metalness: 0.6 });

// ---------------------------------------------------------------- hallway behind the apartment door
export function hallway() {
  const g = new THREE.Group();
  const wallM = std("#5a5e6a", { roughness: 0.9, side: THREE.DoubleSide });
  const floor = mesh(new THREE.PlaneGeometry(2.6, 3.6), std("#3a3a40", { map: concrete(9), roughness: 0.8 }), [-2.15, 0.001, 4.8]);
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  const w1 = mesh(new THREE.PlaneGeometry(3.6, 2.7), wallM, [-3.45, 1.35, 4.8], false); w1.rotation.y = Math.PI / 2; g.add(w1);
  const w2 = mesh(new THREE.PlaneGeometry(3.6, 2.7), wallM, [-0.85, 1.35, 4.8], false); w2.rotation.y = -Math.PI / 2; g.add(w2);
  const w3 = mesh(new THREE.PlaneGeometry(2.6, 2.7), wallM, [-2.15, 1.35, 6.6], false); w3.rotation.y = Math.PI; g.add(w3);
  const ce = mesh(new THREE.PlaneGeometry(2.6, 3.6), wallM, [-2.15, 2.7, 4.8], false); ce.rotation.x = Math.PI / 2; g.add(ce);
  const tube = mesh(new THREE.BoxGeometry(0.12, 0.05, 1.2), new THREE.MeshBasicMaterial({ color: "#e6f2ff" }), [-2.15, 2.66, 4.4], false); g.add(tube);
  const light = new THREE.PointLight("#cfe4ff", 0, 7, 1.6); light.position.set(-2.15, 2.4, 4.3); g.add(light);
  return { group: g, light, tube };
}

// ---------------------------------------------------------------- the building's outside wall + the fire escape (east window)
export function fireEscape() {
  const g = new THREE.Group();
  const bm = std("#ffffff", { map: brick(), roughness: 0.9 });
  const fac = (w: number, h: number, y: number, z: number) => { const m = mesh(new THREE.PlaneGeometry(w, h), bm, [3.53, y, z], false); m.rotation.y = Math.PI / 2; g.add(m); };
  fac(16, 6, 5.6, 0);             // above the window
  fac(16, 14, -6.7, 0);           // below it, down to the street
  fac(5.6, 2.3, 1.45, -5.2);      // beside it
  fac(6.4, 2.3, 1.45, 4.8);
  const im = iron();
  const plat = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.9), new THREE.MeshStandardMaterial({ color: "#2a2a32", map: grating(), alphaTest: 0.5, transparent: false, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
  const gt = plat.material.map!; gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
  plat.rotation.x = -Math.PI / 2; plat.position.set(4.16, 0.02, 0.5); g.add(plat);
  // frame and railing
  for (const z of [-0.95, 1.95]) g.add(mesh(new THREE.BoxGeometry(1.25, 0.05, 0.05), im, [4.16, 0.0, z]));
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 2.9), im, [4.78, 0.0, 0.5]));
  for (const z of [-0.95, -0.2, 0.55, 1.3, 1.95]) g.add(mesh(new THREE.BoxGeometry(0.035, 1.0, 0.035), im, [4.78, 0.5, z]));
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 2.95), im, [4.78, 1.0, 0.5]));
  g.add(mesh(new THREE.BoxGeometry(1.25, 0.05, 0.05), im, [4.16, 1.0, -0.95]));
  // stairs down from the south end to the floor below
  const st = new THREE.Group(); st.position.set(4.16, 0, 1.95);
  const n = 12;
  for (let i = 0; i < n; i++) st.add(mesh(new THREE.BoxGeometry(0.9, 0.03, 0.22), im, [0, -0.23 * (i + 1), 0.24 * (i + 0.5)]));
  for (const x of [-0.47, 0.47]) { const s = mesh(new THREE.BoxGeometry(0.04, 0.16, 3.9), im, [x, -1.4, 1.45]); s.rotation.x = Math.atan2(0.23, 0.24); st.add(s); }
  g.add(st);
  // a lower landing, then darkness
  const p2 = plat.clone(); p2.position.set(4.16, -2.8, 4.5); g.add(p2);
  return g;
}

// ---------------------------------------------------------------- the subway
export type Figure = { body: THREE.Mesh; eyes: THREE.Mesh; base: THREE.Vector3; h: number; group: string };

export class Subway {
  root = new THREE.Group();
  train = new THREE.Group();
  doors: THREE.Object3D[] = [];    // sliding leaves, in pairs: [left, right] per door
  doorRest: number[] = [];
  clockFace: THREE.Mesh;
  clockTex = new Map<string, THREE.Texture>();
  figures: Figure[] = [];
  torch: THREE.SpotLight;
  beam: THREE.Mesh;
  fill: THREE.HemisphereLight;
  exitLight: THREE.PointLight;
  trainLight: THREE.PointLight;
  topGlow: THREE.PointLight;
  lamp: THREE.PointLight;      // a work light for a shot: an IR lamp, the phone's glow
  streaks = new THREE.Group(); // tunnel lamps outside the far windows, for the moving train
  flare: THREE.Sprite;         // the torch seen head-on: a glare at the phone
  windows: THREE.Mesh[] = [];

  constructor() {
    const R = this.root;
    const conc = std("#ffffff", { map: concrete(17), roughness: 0.85 });
    const tileM = std("#ffffff", { map: tiles("#d9d2bd", 5), roughness: 0.6 });
    const tileD = std("#ffffff", { map: tiles("#8f8a7c", 11), roughness: 0.7 });
    const darkM = std("#16161b", { roughness: 0.9 });
    // platform (top at y = 0), from z -30 to +30, x 0..4.5
    R.add(mesh(new THREE.BoxGeometry(4.5, 1.2, 60), conc, [2.25, -0.6, 0]));
    R.add(mesh(new THREE.BoxGeometry(0.42, 0.012, 60), std("#d8b23a", { roughness: 0.6 }), [0.24, 0.006, 0], false));
    // track bed, rails, sleepers: one long run from the platform into the tunnel
    const bed = mesh(new THREE.PlaneGeometry(4.4, 200), std("#ffffff", { map: concrete(23), roughness: 0.95, color: "#5a5650" }), [-2.2, -1.2, -70]);
    bed.rotation.x = -Math.PI / 2; R.add(bed);
    const railM = std("#6b6a70", { roughness: 0.3, metalness: 0.8 });
    for (const x of [-1.48, -2.92]) R.add(mesh(new THREE.BoxGeometry(0.07, 0.14, 200), railM, [x, -1.13, -70]));
    for (let z = 29; z > -170; z -= 0.7) R.add(mesh(new THREE.BoxGeometry(2.6, 0.08, 0.22), darkM, [-2.2, -1.17, z], false));
    // walls: tiled behind the platform, darker across the tracks; the ceiling
    const back = mesh(new THREE.PlaneGeometry(60, 3.6), tileM, [4.5, 1.8, 0], false); back.rotation.y = -Math.PI / 2; R.add(back);
    const across = mesh(new THREE.PlaneGeometry(200, 4.8), tileD, [-4.4, 1.2, -70], false); across.rotation.y = Math.PI / 2; R.add(across);
    // the ceiling, open over the stairwell (x 2.38..4.42, z 18..30), which gets its own ceiling sloping up with the stairs
    const ceil = mesh(new THREE.PlaneGeometry(9, 48), darkM, [0.05, 3.6, -6], false); ceil.rotation.x = Math.PI / 2; R.add(ceil);
    const ceil2 = mesh(new THREE.PlaneGeometry(6.83, 12), darkM, [-1.035, 3.6, 24], false); ceil2.rotation.x = Math.PI / 2; R.add(ceil2);
    const rise = Math.atan2(8.5 - 3.6, 30.6 - 18), run = Math.hypot(8.5 - 3.6, 30.6 - 18);
    const sc = mesh(new THREE.PlaneGeometry(2.1, run), std("#16161b", { roughness: 0.9, side: THREE.DoubleSide }), [3.4, (3.6 + 8.5) / 2, (18 + 30.6) / 2], false); sc.rotation.x = Math.PI / 2 - rise;
    R.add(sc);
    // the platform's end wall, and the tunnel beyond it (only the track width)
    R.add(mesh(new THREE.BoxGeometry(4.5, 4.8, 0.3), tileM, [2.25, 1.2, -30.15]));
    const tw = mesh(new THREE.PlaneGeometry(140, 4.8), darkM, [0, 1.2, -100], false); tw.rotation.y = -Math.PI / 2; R.add(tw);
    const tc = mesh(new THREE.PlaneGeometry(4.4, 140), darkM, [-2.2, 3.6, -100], false); tc.rotation.x = Math.PI / 2; R.add(tc);
    // pillars down the platform
    const pm = std("#2c3a34", { roughness: 0.5, metalness: 0.4 });
    for (let z = -24; z <= 24; z += 6) R.add(mesh(new THREE.BoxGeometry(0.26, 3.6, 0.26), pm, [2.3, 1.8, z]));
    // dead fluorescent fittings along the ceiling
    for (let z = -27; z <= 27; z += 6) R.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 1.4), std("#3a3c44", { roughness: 0.4 }), [2.9, 3.55, z], false));
    // station name and a wall clock stopped like every other clock
    const name = mesh(new THREE.PlaneGeometry(3.2, 0.62), new THREE.MeshBasicMaterial({ map: signTex("CENTRAL", "#1b2a6a", "#f2efe9") }), [4.47, 2.5, -6], false);
    name.rotation.y = -Math.PI / 2; R.add(name);
    const box = mesh(rbox(0.12, 0.5, 1.3, 0.03), std("#101014", { roughness: 0.4 }), [2.9, 3.05, 4], true); R.add(box);
    R.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), iron(), [2.9, 3.45, 4]));
    this.clockFace = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.46), new THREE.MeshBasicMaterial({ map: this.clock("06:12"), transparent: true }));
    this.clockFace.position.set(2.83, 3.05, 4); this.clockFace.rotation.y = -Math.PI / 2; R.add(this.clockFace);
    const back2 = this.clockFace.clone(); back2.position.x = 2.97; back2.rotation.y = Math.PI / 2; R.add(back2);
    (back2 as THREE.Mesh).userData.twin = true; this.clockFace.userData.twin2 = back2;
    // stairs up to the street at the near end: a stairwell along the back wall, z 18 -> 30, rising 5.5 m
    const sg = new THREE.Group();
    for (let i = 0; i < 22; i++) sg.add(mesh(new THREE.BoxGeometry(2.0, 0.25, 0.55), conc, [3.4, 0.125 + 0.25 * i, 18.3 + 0.55 * i]));
    for (const x of [2.38, 4.42]) { const w = mesh(new THREE.PlaneGeometry(14, 7), tileM, [x, 3.0, 24], false); w.rotation.y = x < 3 ? Math.PI / 2 : -Math.PI / 2; (w.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; sg.add(w); }
    for (const x of [2.5, 4.3]) { const h = mesh(new THREE.CylinderGeometry(0.025, 0.025, 13, 8), std("#8a8c92", { metalness: 0.8, roughness: 0.3 }), [x, 3.6, 24.3]); h.rotation.x = Math.PI / 2 - Math.atan2(5.5, 12.1); sg.add(h); }
    const sky = mesh(new THREE.PlaneGeometry(2.2, 3), new THREE.MeshBasicMaterial({ color: "#2a3470" }), [3.4, 7.0, 30.6], false); sky.rotation.y = Math.PI; sg.add(sky);
    R.add(sg);
    // green EXIT sign over the stairs, and its faint light (the only light down here)
    const exit = mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: signTex("EXIT", "#0a3a1a", "#6aff9a", 512, 170, "700 120px sans-serif") }), [3.4, 3.2, 17.7], false);
    exit.rotation.y = Math.PI; R.add(exit);
    this.exitLight = new THREE.PointLight("#5aff8a", 0.9, 9, 1.6); this.exitLight.position.set(3.4, 3.0, 17.2); R.add(this.exitLight);
    this.topGlow = new THREE.PointLight("#6a78d8", 2.2, 9, 1.4); this.topGlow.position.set(3.4, 6.2, 29.5); R.add(this.topGlow);
    // a red signal deep in the tunnel
    R.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: "#ff2a2a" }), [-0.3, 2.4, -62], false));
    this.fill = new THREE.HemisphereLight("#2a3050", "#0a0a10", 0.12); R.add(this.fill);
    this.lamp = new THREE.PointLight("#ffffff", 0, 14, 1.4); R.add(this.lamp);
    // the phone torch
    this.torch = new THREE.SpotLight("#f4f6ff", 0, 34, 0.36, 0.55, 1.35);
    this.torch.castShadow = false; R.add(this.torch, this.torch.target);
    const bg = new THREE.ConeGeometry(1, 1, 32, 1, true); bg.translate(0, -0.5, 0); bg.rotateX(-Math.PI / 2);
    const bc = canvas(4, 256), bx = bc.x; const grd = bx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "rgba(220,230,255,0.0)"); grd.addColorStop(0.08, "rgba(220,230,255,0.22)"); grd.addColorStop(1, "rgba(220,230,255,0.0)");
    bx.fillStyle = grd; bx.fillRect(0, 0, 4, 256);
    this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ map: tex(bc.c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.5 }));
    this.beam.visible = false; R.add(this.beam);
    const fc = canvas(128, 128), fx = fc.x, fg = fx.createRadialGradient(64, 64, 0, 64, 64, 64);
    fg.addColorStop(0, "rgba(255,255,255,1)"); fg.addColorStop(0.12, "rgba(235,242,255,0.85)"); fg.addColorStop(0.4, "rgba(170,190,255,0.22)"); fg.addColorStop(1, "rgba(150,170,255,0)");
    fx.fillStyle = fg; fx.fillRect(0, 0, 128, 128);
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(fc.c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    (this.flare.material as THREE.SpriteMaterial).color.setScalar(2.2); this.flare.renderOrder = 46; this.flare.visible = false; R.add(this.flare);
    // tunnel lamps going past the far-side windows (the train is moving): small hard lights that bloom into streaks
    const lm = new THREE.MeshBasicMaterial({ color: "#d8e0ff" }); lm.color.multiplyScalar(2.2);
    for (let i = 0; i < 6; i++) this.streaks.add(mesh(new THREE.BoxGeometry(0.06, 0.05, 1.1), lm, [0.55, 1.95, 0], false));
    this.streaks.visible = false; R.add(this.streaks);
    // the train
    this.buildTrain();
    R.add(this.train);
    this.trainLight = new THREE.PointLight("#9fb4ff", 0, 12, 1.4); this.trainLight.position.set(-2.2, 2.6, 0); this.train.add(this.trainLight);
    // them
    this.buildCrowd();
  }

  clock(t: string) {
    let m = this.clockTex.get(t);
    if (!m) { m = clockText(t); this.clockTex.set(t, m); }
    return m;
  }
  setClock(t: string) {
    const m = this.clock(t);
    for (const f of [this.clockFace, this.clockFace.userData.twin2 as THREE.Mesh]) { const mat = f.material as THREE.MeshBasicMaterial; if (mat.map !== m) { mat.map = m; mat.needsUpdate = true; } }
  }

  buildTrain() {
    const T = this.train;
    const shell = std("#c8ccd4", { roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });
    const band = std("#2b3a7a", { roughness: 0.5, side: THREE.DoubleSide });
    const inner = std("#bfc3cb", { roughness: 0.7, side: THREE.DoubleSide });
    const L = 18, W = 2.9, x0 = -2.2;   // car centred on the track, floor at y 0.05
    // floor and roof
    T.add(mesh(new THREE.BoxGeometry(W, 0.1, L), std("#3a3c46", { roughness: 0.8 }), [x0, 0.0, 0]));
    T.add(mesh(new THREE.BoxGeometry(W, 0.1, L), shell, [x0, 3.15, 0]));
    // end walls
    for (const z of [-L / 2, L / 2]) T.add(mesh(new THREE.BoxGeometry(W, 3.2, 0.08), shell, [x0, 1.6, z]));
    // the two long sides: skirt (y 0..1.0), window band (1.0..2.2) of posts and glass, top (2.2..3.1); doors at z = -4.5, 4.5
    const doorsZ = [-4.5, 4.5];
    for (const side of [-1, 1]) {
      const x = x0 + side * (W / 2);
      T.add(mesh(new THREE.BoxGeometry(0.06, 0.95, L), shell, [x, 0.52, 0]));
      T.add(mesh(new THREE.BoxGeometry(0.07, 0.18, L), band, [x, 0.95, 0]));
      T.add(mesh(new THREE.BoxGeometry(0.06, 0.95, L), shell, [x, 2.65, 0]));
      // window posts every 1.5 m, skipping the door gaps
      for (let z = -L / 2 + 0.75; z <= L / 2; z += 1.5) {
        if (doorsZ.some((d) => Math.abs(z - d) < 0.9)) continue;
        T.add(mesh(new THREE.BoxGeometry(0.07, 1.2, 0.12), shell, [x, 1.6, z]));
      }
      // glass: dark, a little reflective
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.2), new THREE.MeshStandardMaterial({ color: "#0b0d16", roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      gl.position.set(x + side * 0.005, 1.6, 0); gl.rotation.y = Math.PI / 2; T.add(gl); this.windows.push(gl);
      // doors: two leaves each, sliding apart along z
      for (const dz of doorsZ) for (const k of [-1, 1]) {
        const leaf = new THREE.Group(); leaf.position.set(x + side * 0.01, 1.1, dz + k * 0.31);
        for (const [h, y] of [[1.0, -0.55], [0.25, 0.925]] as [number, number][]) leaf.add(mesh(new THREE.BoxGeometry(0.06, h, 0.62), shell, [0, y, 0]));
        for (const z of [-0.255, 0.255]) leaf.add(mesh(new THREE.BoxGeometry(0.06, 0.8, 0.11), shell, [0, 0.35, z]));
        const win = mesh(new THREE.PlaneGeometry(0.4, 0.8), new THREE.MeshBasicMaterial({ color: "#1a2034", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), [side * 0.035, 0.35, 0], false);
        win.rotation.y = side * Math.PI / 2; leaf.add(win);
        T.add(leaf); this.doors.push(leaf); this.doorRest.push(dz + k * 0.31);
      }
    }
    // inside: benches along both walls between the doors, grab poles, light strips
    const seat = std("#3a4a8a", { roughness: 0.7 });
    for (const side of [-1, 1]) for (const [a, b] of [[-8.6, -5.4], [-3.6, 3.6], [5.4, 8.6]]) {
      const zc = (a + b) / 2, len = b - a;
      T.add(mesh(new THREE.BoxGeometry(0.5, 0.1, len), seat, [x0 + side * 1.15, 0.5, zc]));
      T.add(mesh(new THREE.BoxGeometry(0.1, 0.55, len), seat, [x0 + side * 1.38, 0.82, zc]));
      T.add(mesh(new THREE.BoxGeometry(0.46, 0.45, len), inner, [x0 + side * 1.15, 0.25, zc]));
    }
    for (const z of [-6.5, -2, 2, 6.5]) T.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.0, 8), std("#c0c4cc", { metalness: 0.9, roughness: 0.2 }), [x0, 1.6, z]));
    for (const side of [-0.6, 0.6]) T.add(mesh(new THREE.BoxGeometry(0.12, 0.03, L - 0.4), new THREE.MeshBasicMaterial({ color: "#8a96b8" }), [x0 + side, 3.08, 0], false));
  }

  /** the glare of the torch when it points at the camera */
  torchFlare(cam: THREE.Vector3) {
    const d = this.torch.target.position.clone().sub(this.torch.position).normalize();
    const toCam = cam.clone().sub(this.torch.position).normalize();
    const k = Math.min(1, Math.max(0, (d.dot(toCam) - 0.72) / 0.26)) * Math.min(1, this.torch.intensity / 40);
    this.flare.position.copy(this.torch.position).addScaledVector(toCam, 0.04);
    this.flare.scale.setScalar(0.08 + 0.34 * k * k); (this.flare.material as THREE.SpriteMaterial).opacity = k; this.flare.visible = k > 0.01;
  }

  /** the tunnel lamps sliding past outside (relative to a train standing at z 0), every 4 m */
  runStreaks(f: number, speed = 0.45) {
    this.streaks.children.forEach((m, i) => { const z = (((i * 4 - f * speed) % 24) + 24) % 24; m.position.z = 12 - z; });
    this.streaks.visible = true;
  }

  /** open (0) / closed (1) */
  setDoors(k: number) {
    this.doors.forEach((d, i) => { const rest = this.doorRest[i], dz = rest - (i % 2 ? 4.5 : -4.5) * 0; void dz; const sgn = i % 2 === 0 ? -1 : 1; d.position.z = rest + sgn * 0.6 * (1 - k); });
  }

  buildCrowd() {
    // one drawing of it, shared by every figure: the body (dark) and the eyes (additive)
    const F = { x0: -45, y0: -4, w: 90, h: 255 };
    const bc = document.createElement("canvas"); bc.width = 256; bc.height = 720;
    const bx = bc.getContext("2d")!;
    drawWatcher(bx, F, { eyes: 0, smile: 0, rim: 0.95, tilt: 0, lean: 0 });
    // lift the black to a dark slate, so a figure caught in the light reads as a body, not a hole
    // (only a little: in the torch light they should still read as dark shapes against the lit tiles)
    bx.save(); bx.globalCompositeOperation = "source-atop"; bx.fillStyle = "rgba(58,60,84,0.34)"; bx.fillRect(0, 0, 256, 720); bx.restore();
    const ec = document.createElement("canvas"); ec.width = 256; ec.height = 720;
    const ex = ec.getContext("2d")!;
    drawWatcher(ex, F, { eyes: 1, smile: 0, rim: 0, tilt: 0, lean: 0, glowOnly: true });
    // a halo round the eyes, so they still read as two points of light from the far end of the platform
    const hc = document.createElement("canvas"); hc.width = 256; hc.height = 720; hc.getContext("2d")!.drawImage(ec, 0, 0);
    ex.save(); ex.globalCompositeOperation = "lighter"; ex.filter = "blur(4px)"; ex.drawImage(hc, 0, 0); ex.filter = "blur(9px)"; ex.globalAlpha = 0.8; ex.drawImage(hc, 0, 0); ex.restore();
    const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
    const et = new THREE.CanvasTexture(ec); et.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(0.9, 2.55); geo.translate(0, 2.55 / 2 - 0.04, 0);
    let s = 91; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const add = (group: string, x: number, z: number, y: number) => {
      const h = 0.92 + r() * 0.16;
      const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: bt, transparent: true, alphaTest: 0.3, depthWrite: true }));
      const eyes = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: et, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      eyes.renderOrder = 41; eyes.material.color.setScalar(2.4);
      body.scale.setScalar(h); eyes.scale.setScalar(h);
      body.position.set(x, y, z); eyes.position.set(x, y, z + 0.001);
      this.root.add(body, eyes);
      this.figures.push({ body, eyes, base: new THREE.Vector3(x, y, z), h, group });
    };
    // A: filling the far end of the platform, among the pillars, rank behind rank
    for (let z = -7.5; z > -26; z -= 1.15) for (let i = 0; i < 5; i++) add("A", 0.55 + i * 0.85 + (r() - 0.5) * 0.5, z + (r() - 0.5) * 0.6, 0);
    // B: on the tracks beyond the front of the train; C: deeper, into the tunnel
    for (let z = -11; z > -30; z -= 1.4) for (let i = 0; i < 3; i++) add("B", -3.8 + i * 1.3 + (r() - 0.5) * 0.6, z + (r() - 0.5) * 0.7, -1.2);
    for (let i = 0; i < 70; i++) add("C", -4.0 + r() * 3.6, -31 - Math.pow(r(), 0.8) * 55, -1.2);
    // D: along the platform edge, watching the train leave; E: along the tunnel walls, for the train to pass
    for (let z = -8; z < 26; z += 2.3) add("D", 0.42 + r() * 0.12, z, 0);
    for (let z = -32; z > -175; z -= 2.3 + r() * 1.2) { add("E", -4.12, z, -0.25); add("E", -0.3, z - 1.1, -0.25); }
  }

  /** every figure turns to face p; brightness from the torch (or 1 when lit = true); eyes open k */
  poseCrowd(p: THREE.Vector3, light: (pos: THREE.Vector3) => number, eyes: number, headTurn = 0, groups = "ABC") {
    for (const fg of this.figures) {
      if (!groups.includes(fg.group)) { fg.body.visible = false; fg.eyes.visible = false; continue; }
      const yaw = Math.atan2(p.x - fg.base.x, p.z - fg.base.z) + headTurn;
      fg.body.rotation.set(0, yaw, 0); fg.eyes.rotation.set(0, yaw, 0);
      const k = light(fg.base);
      (fg.body.material as THREE.MeshBasicMaterial).color.setScalar(Math.max(0.0, k));
      (fg.eyes.material as THREE.MeshBasicMaterial).opacity = eyes;
      fg.body.visible = k > 0.003 || eyes > 0; fg.eyes.visible = eyes > 0.01;
    }
  }

  /** point the torch from `from` toward `to`; the visible beam follows */
  aimTorch(from: THREE.Vector3, to: THREE.Vector3, k: number) {
    this.torch.position.copy(from); this.torch.target.position.copy(to); this.torch.intensity = 40 * k;
    this.torch.target.updateMatrixWorld();
    const d = to.clone().sub(from); const len = 9;
    this.beam.position.copy(from); this.beam.lookAt(to); this.beam.scale.set(Math.tan(0.36) * len, Math.tan(0.36) * len, len);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.42 * k; this.beam.visible = k > 0.01;
    void d;
  }
}

// ---------------------------------------------------------------- sparks
/** a burst of sparks: deterministic from its seed; t = seconds since the burst */
export class Sparks {
  points: THREE.Points;
  n: number;
  v: Float32Array;
  constructor(n = 70, seed = 1) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const c = canvas(64, 64); const x = c.x; const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.3, "rgba(255,255,255,0.75)"); rg.addColorStop(1, "rgba(255,255,255,0)");   // neutral: the colour comes from the vertices
    x.fillStyle = rg; x.fillRect(0, 0, 64, 64);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, map: tex(c.c), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.points.frustumCulled = false; this.points.renderOrder = 45;
    let s = seed * 9973 + 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.v = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { this.v[i * 4] = (r() - 0.5) * 5; this.v[i * 4 + 1] = r() * 3.5 - 0.5; this.v[i * 4 + 2] = (r() - 0.5) * 5; this.v[i * 4 + 3] = 0.25 + r() * 0.6; }
    this.points.visible = false;
  }
  glass = false;
  burst(origin: THREE.Vector3, t: number) {
    if (t < 0 || t > 1.1) { this.points.visible = false; return; }
    const p = this.points.geometry.attributes.position as THREE.BufferAttribute, c = this.points.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < this.n; i++) {
      const life = this.v[i * 4 + 3], a = Math.max(0, 1 - t / life);
      p.setXYZ(i, origin.x + this.v[i * 4] * t, origin.y + this.v[i * 4 + 1] * t - 4.9 * t * t, origin.z + this.v[i * 4 + 2] * t);
      if (this.glass) c.setXYZ(i, 1.1 * a, 1.3 * a, 1.7 * a); else c.setXYZ(i, 3 * a, 1.5 * a * a, 0.45 * a * a * a);
    }
    (this.points.material as THREE.PointsMaterial).size = this.glass ? 0.035 : 0.09;   // shards of glass: small, hard, blue-white
    p.needsUpdate = true; c.needsUpdate = true; this.points.visible = true;
  }
}


// ---------------------------------------------------------------- a subway entrance on the street
export function subwayEntrance() {
  const g = new THREE.Group();
  const im = std("#1f2a24", { roughness: 0.5, metalness: 0.5 });
  // the opening and the first steps going down into the dark
  const hole = mesh(new THREE.PlaneGeometry(1.9, 3.4), new THREE.MeshBasicMaterial({ color: "#020203" }), [0, 0.006, 0], false); hole.rotation.x = -Math.PI / 2; g.add(hole);
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(1.8, 0.04, 0.42), std("#3a3a40", { roughness: 0.9 }), [0, -0.18 * (i + 1), -1.5 + 0.42 * i], false));
  // railings on three sides
  for (const x of [-0.98, 0.98]) { g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 3.4), im, [x, 1.0, 0])); for (let z = -1.6; z <= 1.6; z += 0.8) g.add(mesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), im, [x, 0.5, z])); }
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.05, 0.05), im, [0, 1.0, 1.7]));
  // the lit sign on its post
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8), im, [-1.1, 1.3, 1.75]));
  const sign = mesh(new THREE.BoxGeometry(1.2, 0.36, 0.08), new THREE.MeshBasicMaterial({ map: signTex("SUBWAY", "#0e4a2a", "#e8fff0", 1024, 300, "800 190px sans-serif") }), [-1.1, 2.75, 1.75], false);
  g.add(sign);
  const l = new THREE.PointLight("#6aff9a", 1.6, 6, 1.6); l.position.set(-1.1, 2.4, 1.4); g.add(l);
  return g;
}


// ---------------------------------------------------------------- a thin rod or cable through points (the pipe, the torn cable)
export class Rod {
  group = new THREE.Group();
  segs: THREE.Mesh[] = [];
  constructor(n: number, r: number, color: string, o: { metal?: number; rough?: number } = {}) {
    const m = std(color, { roughness: o.rough ?? 0.6, metalness: o.metal ?? 0.2 });
    for (let i = 0; i < n; i++) { const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), m); this.group.add(g); this.segs.push(g); }
    this.group.visible = false;
  }
  /** lay the segments evenly along the polyline pts */
  set(pts: THREE.Vector3[]) {
    const L: number[] = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const tot = L[L.length - 1] || 1e-6, n = this.segs.length;
    const at = (d: number) => { let i = 1; while (i < pts.length - 1 && L[i] < d) i++; const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return pts[i - 1].clone().lerp(pts[i], Math.min(1, Math.max(0, k))); };
    const Y = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const a = at((tot * i) / n), b = at((tot * (i + 1)) / n), d = b.clone().sub(a), l = d.length();
      const g = this.segs[i]; g.position.copy(a).add(b).multiplyScalar(0.5); g.scale.set(1, Math.max(1e-4, l * 1.04), 1);
      g.quaternion.setFromUnitVectors(Y, l > 1e-6 ? d.multiplyScalar(1 / l) : Y);
    }
    this.group.visible = true;
  }
}
