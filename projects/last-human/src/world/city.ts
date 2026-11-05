// The empty city at street level. Avenue along z (most cameras look toward -z). Road x ∈ [-8, 8], sidewalks
// (+0.15 m) to x = ±13, building fronts at x = ±13. Cross street at z ∈ [-48, -32]. Café on the west side at z ≈ 0,
// long dark shop window on the west side at z ∈ [-92, -68].
import * as THREE from "three";
import { asphalt, canvas, concrete, facade, radial, rng, tex } from "./paint";

/** an analogue clock face showing h:m */
function clockFace(h: number, m: number) {
  const { c, x } = canvas(256, 256);
  x.fillStyle = "#f1ece2"; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
  x.strokeStyle = "#1a1a20"; x.lineWidth = 8; x.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.lineWidth = i % 3 ? 4 : 8; x.beginPath(); x.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); x.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116); x.stroke(); }
  const hand = (a: number, l: number, w: number) => { x.lineWidth = w; x.lineCap = "round"; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); x.stroke(); };
  hand(((h % 12) + m / 60) / 12 * Math.PI * 2, 62, 10); hand((m / 60) * Math.PI * 2, 96, 6);
  x.fillStyle = "#1a1a20"; x.beginPath(); x.arc(128, 128, 9, 0, 7); x.fill();
  return tex(c);
}

/** steam caught in mid-air: soft curled ribbons and puffs that never move */
function frozenSteam(base: THREE.Vector3) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: "#e8eef8", transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const curls: [number, number, number][][] = [
    [[0, 0, 0], [0.01, 0.06, 0.005], [-0.02, 0.12, 0.0], [0.015, 0.19, -0.01], [-0.01, 0.26, 0.0]],
    [[0.012, 0, 0.01], [0.03, 0.05, 0.01], [0.02, 0.11, 0.02], [0.045, 0.16, 0.015], [0.03, 0.21, 0.02]],
    [[-0.012, 0, -0.008], [-0.028, 0.045, -0.01], [-0.012, 0.09, -0.02], [-0.035, 0.14, -0.01]],
  ];
  curls.forEach((pts, i) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    for (const r of [0.006, 0.011, 0.018]) { const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r * (1 - i * 0.15), 10, false), mat); g.add(m); }
  });
  const puffM = new THREE.SpriteMaterial({ map: radial("rgba(235,242,255,0.55)"), transparent: true, depthWrite: false, opacity: 0.4 });
  for (const [x, y, z, s] of [[0, 0.03, 0, 0.05], [0.01, 0.07, 0, 0.07], [-0.015, 0.11, 0, 0.08], [0.02, 0.15, 0.01, 0.09], [0.0, 0.19, 0, 0.1], [-0.01, 0.23, 0, 0.1], [0.035, 0.12, 0.01, 0.06], [-0.03, 0.08, -0.01, 0.06]]) {
    const sp = new THREE.Sprite(puffM); sp.position.set(x, y, z); sp.scale.setScalar(s); g.add(sp);
  }
  g.position.copy(base);
  return g;
}
import { bayTextures, mergedBlocks } from "./skyline";
import { Cctv, cafeSet, car, cctv, glow, groundPool, mesh, neon, rbox, std, streetLamp, trafficLight, wetStreak } from "./props";

export const CITY = {
  cafeTable: new THREE.Vector3(-10.4, 0.15, -1.2),
  shopGlassX: -12.9,
  shopZ: [-92, -68] as [number, number],
  crossZ: [-48, -32] as [number, number],
};

type Lit = { m: THREE.MeshBasicMaterial; base: THREE.Color };

export class City {
  root = new THREE.Group();
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  cams: Cctv[] = [];
  heroCam!: Cctv;     // the close-up camera of scene 4b
  neons: Lit[] = [];  // night-only emissives
  lampsDay = new THREE.Group();
  lampsNight = new THREE.Group();
  streaks = new THREE.Group();
  pools = new THREE.Group();
  bldMats: THREE.MeshStandardMaterial[] = [];
  redLights: THREE.Object3D[] = [];
  glass: THREE.Mesh;
  pointLights: THREE.PointLight[] = [];
  steam!: THREE.Group;

  constructor() {
    const R = this.root, r = rng(5150);
    // ground: road, sidewalks, curbs, markings
    const road = mesh(new THREE.PlaneGeometry(16, 900), std("#ffffff", { map: asphalt(true), roughness: 0.38, metalness: 0.15 }), [0, 0, -300], false);
    road.rotation.x = -Math.PI / 2; R.add(road);
    const cross = mesh(new THREE.PlaneGeometry(400, 16), std("#ffffff", { map: asphalt(true), roughness: 0.38, metalness: 0.15 }), [0, 0.001, -40], false);
    cross.rotation.x = -Math.PI / 2; R.add(cross);
    const walkM = std("#ffffff", { map: concrete(), roughness: 0.6, metalness: 0.05 });
    for (const sx of [-1, 1]) {
      for (const [z0, z1] of [[60, -32], [-48, -640]]) {
        const L = z0 - z1;
        R.add(mesh(new THREE.BoxGeometry(5, 0.15, L), walkM, [sx * 10.5, 0.075, (z0 + z1) / 2], false));
        R.add(mesh(new THREE.BoxGeometry(0.22, 0.17, L), std("#7a7b84", { roughness: 0.7 }), [sx * 8.05, 0.085, (z0 + z1) / 2], false));
      }
    }
    const paint = std("#d8d6cc", { roughness: 0.6 });
    const yellow = std("#b8963e", { roughness: 0.6 });
    for (let z = 50; z > -620; z -= 9) if (z > -30 || z < -50) {
      for (const x of [-4, 4]) { const d = mesh(new THREE.PlaneGeometry(0.15, 3), paint, [x, 0.004, z], false); d.rotation.x = -Math.PI / 2; R.add(d); }
    }
    for (const x of [-0.12, 0.12]) { const l = mesh(new THREE.PlaneGeometry(0.1, 900), yellow, [x, 0.004, -300], false); l.rotation.x = -Math.PI / 2; R.add(l); }
    for (let i = 0; i < 14; i++) for (const z of [-31.2, -48.8]) { const s = mesh(new THREE.PlaneGeometry(0.6, 3.2), paint, [-7.2 + i * 1.1, 0.005, z], false); s.rotation.x = -Math.PI / 2; R.add(s); }
    // buildings: merged upper floors (3 facade families) + per-building storefront details
    const fam = [bayTextures(11, "#565a6e", "#1c2132", 0.2), bayTextures(12, "#6a5f66", "#21192a", 0.16), bayTextures(13, "#48586a", "#172230", 0.24)];
    const boxes: any[][] = [[], [], []];
    const storeM = [std("#17161f", { roughness: 0.3, metalness: 0.4 }), std("#1d1a24", { roughness: 0.25, metalness: 0.5 })];
    const bandM = std("#35333f", { roughness: 0.7 });
    const awningCols = ["#5a2e3e", "#2e4a5a", "#6a4a2a", "#3a2e5a"];
    const signs: [string, string][] = [["NOODLES", "#ff4fb8"], ["OPEN 24H", "#3ff0e0"], ["BAR", "#b06bff"], ["PHARMACY", "#40ffa0"], ["KARAOKE", "#ff5f9e"], ["HOTEL", "#ffb04a"], ["LAUNDRY", "#5fd0ff"], ["RAMEN", "#ff6a4a"], ["VIDEO", "#b06bff"], ["DINER", "#ff4f6a"]];
    let si = 0;
    for (const sx of [-1, 1]) {
      let z = 50;
      while (z > -620) {
        if (z < -32 && z > -48) { z = -48; continue; }
        const w = 12 + r() * 16;
        const zc = z - w / 2;
        const h = 16 + r() * 34 + (z < -150 ? r() * 40 : 0);
        const front = sx * 13;
        const isShop = sx < 0 && zc < CITY.shopZ[1] + 4 && zc > CITY.shopZ[0] - 4;
        const isCafe = sx < 0 && zc < 6 && zc > -8;
        boxes[Math.floor(r() * 3)].push({ x: front + sx * 10, z: zc, w: 20, d: w - 0.4, h: h - 4.4, y0: 4.4 });
        // ground floor: dark band + storefront glass + trim
        // ground floor block (pushed back behind the shop / café interiors so their glass shows a room)
        const back = isShop || isCafe ? 7 : 0;
        R.add(mesh(new THREE.BoxGeometry(20, 4.4, w - 0.4), bandM, [front + sx * (10.25 + back), 2.2, zc], false));
        if (back) for (const e of [-1, 1]) R.add(mesh(new THREE.BoxGeometry(7.2, 4.4, 0.3), bandM, [front + sx * 3.6, 2.2, zc + e * (w / 2 - 0.35)], false));
        if (!isShop) {
          const sf = mesh(new THREE.PlaneGeometry(w - 2.2, 3.0), storeM[Math.floor(r() * 2)], [front + sx * 0.02 - sx * 0.01, 1.75, zc], false);
          sf.rotation.y = -sx * Math.PI / 2; R.add(sf);
        }
        R.add(mesh(new THREE.BoxGeometry(0.5, 0.35, w - 0.4), std("#4a4856", { roughness: 0.6 }), [front - sx * 0.05, 4.45, zc], false));
        if (r() < 0.45 && !isShop) {
          const aw = mesh(new THREE.BoxGeometry(1.4, 0.08, w - 3), std(awningCols[Math.floor(r() * 4)], { roughness: 0.8 }), [front - sx * 0.7, 3.45, zc]);
          aw.rotation.z = sx * 0.28; R.add(aw);
        }
        if (!isShop && !isCafe && r() < 0.8) {
          const [txt, col] = signs[si++ % signs.length];
          const sg = neon(txt, col, Math.min(5, w * 0.45), 1.15, 2.6);
          sg.position.set(front - sx * 0.12, 3.95, zc + (r() - 0.5) * 3); sg.rotation.y = -sx * Math.PI / 2; R.add(sg);
          this.trackNeon(sg);
          const st = wetStreak(col, 1.6, 9, 0.35); st.position.set(front - sx * 1.4, 0, zc); st.rotation.z = -sx * Math.PI / 2; this.streaks.add(st);
          const pool = groundPool(col, 4.2, 0.45); pool.position.set(front - sx * 2.0, 0.165, zc); this.pools.add(pool);
          if (r() < 0.35) { // vertical blade sign higher up
            const bl = neon(txt.slice(0, 5), col, 3.2, 0.8, 2.4); bl.position.set(front - sx * 0.6, 7 + r() * 4, zc - w * 0.3); bl.rotation.set(0, -sx * Math.PI / 2, Math.PI / 2 * sx); R.add(bl); this.trackNeon(bl);
          }
        }
        z -= w;
      }
    }
    boxes.forEach((b, i) => {
      const m = std("#ffffff", { map: fam[i].map, emissiveMap: fam[i].emissive, emissive: new THREE.Color("#000"), roughness: 0.75 });
      this.bldMats.push(m);
      const me = new THREE.Mesh(mergedBlocks(b), m); me.receiveShadow = true; me.castShadow = true; R.add(me);
    });
    // far end: a wall of towers so the avenue never ends in sky
    const farBoxes = [];
    for (let i = 0; i < 40; i++) farBoxes.push({ x: (r() - 0.5) * 300, z: -660 - r() * 200, w: 20 + r() * 30, d: 20 + r() * 30, h: 40 + r() * 140, y0: 0 });
    const farM = std("#ffffff", { map: fam[0].map, emissiveMap: fam[0].emissive, emissive: new THREE.Color("#000"), roughness: 0.8 });
    this.bldMats.push(farM); R.add(new THREE.Mesh(mergedBlocks(farBoxes), farM));

    // café: awning, sign, door held open, table outside
    const cafe = new THREE.Group(); cafe.position.set(-13, 0, 0); R.add(cafe);
    const cafeGlass = std("#2a2f3a", { roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.55 });
    const win = mesh(new THREE.PlaneGeometry(9, 3.0), cafeGlass, [0.04, 1.75, -1.5], false); win.rotation.y = Math.PI / 2; cafe.add(win);
    cafe.add(mesh(new THREE.BoxGeometry(0.2, 3.2, 12), std("#1a1720"), [-3, 1.6, -1.5], false)); // dark interior back
    const inside = mesh(new THREE.PlaneGeometry(8.6, 2.8), glow("#ffa860", 0.35), [-2.8, 1.6, -1.5], false); inside.rotation.y = Math.PI / 2; cafe.add(inside);
    const door = new THREE.Group(); door.position.set(0.05, 0.15, 2.4); cafe.add(door);
    door.add(mesh(rbox(0.05, 2.2, 1.0, 0.01), std("#1e2028", { roughness: 0.3, metalness: 0.6 }), [0, 1.1, -0.5]));
    door.rotation.y = 1.1;
    cafe.add(mesh(new THREE.BoxGeometry(1.6, 0.1, 10), std("#5a2e3e", { roughness: 0.85 }), [0.8, 3.4, -1.5]).rotateZ(-0.25));
    const cs = neon("CAFÉ", "#ffb04a", 3, 0.9, 2.2); cs.position.set(0.1, 3.95, -1.5); cs.rotation.y = Math.PI / 2; cafe.add(cs); this.trackNeon(cs);
    const table = cafeSet(); table.position.copy(CITY.cafeTable); R.add(table);
    const t2 = cafeSet(); t2.position.set(-10.6, 0.15, -4.2); t2.rotation.y = 1.3; R.add(t2);

    // long dark shop window (scene 5): glass + deep dark interior with faint shapes
    const [z0, z1] = CITY.shopZ;
    const shopIn = new THREE.Group(); shopIn.position.set(CITY.shopGlassX, 0, (z0 + z1) / 2); R.add(shopIn);
    shopIn.add(mesh(new THREE.BoxGeometry(0.1, 3.4, z1 - z0), std("#07080d"), [-6, 1.7, 0], false));
    shopIn.add(mesh(new THREE.BoxGeometry(2.6, 0.15, z1 - z0), std("#1a2036", { map: concrete(), roughness: 0.35, metalness: 0.3, color: "#3a4a78" }), [-1.33, 0.075, 0], false));
    for (let i = 0; i < 6; i++) shopIn.add(mesh(rbox(1.2, 1.0, 2.2, 0.05), std("#121420", { roughness: 0.6 }), [-3.2, 0.5, -10 + i * 4], false));
    const g = new THREE.MeshStandardMaterial({ color: "#0d1220", roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0.42, depthWrite: false });
    this.glass = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 3.3), g);
    this.glass.position.set(CITY.shopGlassX + 0.02, 1.85, (z0 + z1) / 2); this.glass.rotation.y = Math.PI / 2; this.glass.renderOrder = 20;
    R.add(this.glass);
    for (const z of [z0, -80, z1]) R.add(mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), std("#2a2c36", { metalness: 0.6, roughness: 0.4 }), [CITY.shopGlassX + 0.06, 1.85, z], false));
    R.add(mesh(new THREE.BoxGeometry(0.4, 0.3, z1 - z0), std("#2a2c36"), [CITY.shopGlassX + 0.15, 0.3, (z0 + z1) / 2], false));
    const ss = neon("ATELIER", "#b06bff", 4.2, 0.9, 1.6); ss.position.set(CITY.shopGlassX + 0.1, 3.95, (z0 + z1) / 2); ss.rotation.y = Math.PI / 2; R.add(ss); this.trackNeon(ss);

    // bollards along the west curb by the shop window: foreground parallax for the tracking shot
    for (let z = -60; z > -100; z -= 2.6) {
      R.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.9, 12), std("#20222c", { roughness: 0.4, metalness: 0.5 }), [-8.45, 0.6, z]));
      R.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), std("#c9a24a", { roughness: 0.4, metalness: 0.6 }), [-8.45, 0.95, z], false));
    }
    // parking meter on the east kerb near the shop camera (foreground of the camera-test shot)
    const meter = new THREE.Group(); meter.position.set(8.75, 0.15, -8.2); R.add(meter);
    meter.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 10), std("#2a2c34", { metalness: 0.6, roughness: 0.4 }), [0, 0.6, 0]));
    meter.add(mesh(rbox(0.22, 0.34, 0.16, 0.04), std("#3a3d48", { metalness: 0.5, roughness: 0.35 }), [0, 1.35, 0]));
    meter.add(mesh(new THREE.PlaneGeometry(0.12, 0.08), glow("#ff3a2a", 1.6), [0, 1.4, 0.081], false));
    // traffic lights at the intersection (red forever)
    // lamps face the oncoming traffic: the near light (z = -30.6) faces +z toward the camera side
    for (const [x, z, ry] of [[-9.3, -30.6, 0], [9.3, -49.4, Math.PI]] as [number, number, number][]) {
      const t = trafficLight("red", 7); t.group.position.set(x, 0.15, z); t.group.rotation.y = ry; R.add(t.group);
      this.redLights.push(t.head);
      const st = wetStreak("#ff3020", 1.4, 14, 0.9); st.position.set(x + (ry === 0 ? 6.6 : -6.6), 0, z + (ry === 0 ? 1 : -1)); st.rotation.z = ry === 0 ? Math.PI : 0; this.streaks.add(st);
      const pool = groundPool("#ff2a1a", 5, 0.25); pool.position.set(x + (ry === 0 ? 6.6 : -6.6), 0.02, z + (ry === 0 ? 2.5 : -2.5)); this.pools.add(pool);
    }
    // street lamps (day: off, night: on)
    for (let z = 40; z > -400; z -= 24) for (const sx of [-1, 1]) {
      for (const [grp, on] of [[this.lampsDay, 0], [this.lampsNight, 1]] as [THREE.Group, number][]) {
        const l = streetLamp(on); l.position.set(sx * 9.6, 0.15, z + (sx > 0 ? 12 : 0)); l.rotation.y = sx > 0 ? Math.PI : 0; grp.add(l);
      }
      const pool = groundPool("#ffa050", 7.5, 0.5); pool.position.set(sx * 8.05, 0.16, z + (sx > 0 ? 12 : 0)); this.pools.add(pool);
      const st = wetStreak("#ffa050", 1.4, 8, 0.4); st.position.set(sx * 8.0, 0, z + (sx > 0 ? 12 : 0)); this.streaks.add(st);
    }
    R.add(this.lampsDay, this.lampsNight, this.streaks, this.pools);

    // abandoned cars: a queue at the red light and strays
    const lanes = [-6, -2, 2, 6];
    const slots: [number, number, number, boolean][] = [
      [-6, -24, 0.02, false], [-6, -17.5, -0.03, true], [-2, -26, 0, false], [-2, -19, 0.05, false], [-2, -11, -0.1, true],
      [2, -27, 3.14, false], [6, -21, 3.12, false], [6, -9, 2.9, true], [-6, 8, 0.25, false], [2, 18, 3.3, false],
      [-2, -62, 0.1, false], [6, -80, 3.0, true], [-6, -105, -0.2, false], [2, -130, 3.1, false], [-2, -160, 0.0, false],
      [6, -190, 3.2, false], [-6, -220, 0.1, false], [2, -250, 3.14, false], [-2, -290, 0.05, false], [6, -330, 3.1, false],
    ];
    slots.forEach(([x, z, ry, open], i) => {
      // frozen at 06:12: the queue at the light keeps its brake lights on, the oncoming cars their headlights
      const queued = z < -8 && z > -28 && Math.abs(ry) < 0.4;
      const oncoming = z < -8 && z > -28 && Math.abs(ry) > 2.5;
      const c = car(200 + i, { doorOpen: open, tail: queued ? 0.9 : 0, lights: oncoming ? 0.5 : 0 }); c.position.set(x + (r() - 0.5) * 0.6, 0, z); c.rotation.y = ry + Math.PI / 2; R.add(c);
    });
    // street clock on the corner by the light, stopped at 06:12
    const post = new THREE.Group(); post.position.set(-8.7, 0.15, -29.2); R.add(post);
    const dark = std("#1d2028", { roughness: 0.5, metalness: 0.5 });
    post.add(mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.0, 12), dark, [0, 2.0, 0]));
    post.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 32), dark, [0, 4.45, 0]).rotateX(Math.PI / 2));
    for (const sgn of [1, -1]) {
      const f = mesh(new THREE.CircleGeometry(0.5, 40), std("#ffffff", { map: clockFace(6, 12), roughness: 0.5, emissive: new THREE.Color("#ffe8c8"), emissiveIntensity: 0.25 }), [0, 4.45, sgn * 0.085], false);
      if (sgn < 0) f.rotation.y = Math.PI; post.add(f);
    }
    // frozen steam over the café cup (cup at the table's local (0.18, 0.805, -0.08))
    const cup = CITY.cafeTable.clone().add(new THREE.Vector3(0.18, 0.84, -0.08));
    this.steam = frozenSteam(cup); R.add(this.steam);
    void lanes;

    // CCTV, installed like a real system: wall units on brackets at consistent heights, pole units at the kerb, pendant
    // units clamped under the traffic-light arms. Each has a deliberate resting aim (along the street, at a door, at the
    // crossing): yaws below are WORLD headings (atan2(x, z)); pitch + = looking down.
    const E = -Math.PI / 2, W = Math.PI / 2;   // group rotations for the east (x = +12.85) and west (x = -12.85) facades
    const SW = Math.atan2(-0.45, 0.9), NW = Math.atan2(-0.45, -0.9), SE = Math.atan2(0.45, 0.9), NE = Math.atan2(0.45, -0.9);
    type Spot = { p: [number, number, number]; mount: "wall" | "pole" | "pendant"; face?: number; yaw: number; pitch: number; scale?: number };
    const spots: Spot[] = [
      // 0: the laundry camera (the one that turns in S01 and S09): resting aim up the street, north-west
      { p: [12.85, 2.45, -11.5], mount: "wall", face: E, yaw: NW - 0.25, pitch: 0.12, scale: 1.7 },   // over the shop door, under the sign
      // the Day 3 facade: a tidy 2 x 3 array, one pair per floor, the pairs covering both directions of the street
      ...[5.8, 8.6, 11.4].flatMap((y) => [
        { p: [12.85, y, -10.2] as [number, number, number], mount: "wall" as const, face: E, yaw: SW, pitch: 0.38, scale: 1.7 },
        { p: [12.85, y, -12.8] as [number, number, number], mount: "wall" as const, face: E, yaw: NW, pitch: 0.38, scale: 1.7 },
      ]),
      // other facades: one unit at 4.2 m every few buildings, alternating directions
      { p: [-12.85, 4.2, -9], mount: "wall", face: W, yaw: NE, pitch: 0.35, scale: 1.7 },
      { p: [12.85, 4.2, -26], mount: "wall", face: E, yaw: SW, pitch: 0.35, scale: 1.7 },
      { p: [-12.85, 4.2, -27], mount: "wall", face: W, yaw: SE, pitch: 0.35, scale: 1.7 },
      { p: [12.85, 4.2, 2], mount: "wall", face: E, yaw: NW, pitch: 0.35, scale: 1.7 },
      { p: [-12.85, 4.2, 6], mount: "wall", face: W, yaw: NE, pitch: 0.35, scale: 1.7 },
      // kerb poles
      { p: [-9.2, 0.15, -20], mount: "pole", yaw: Math.PI, pitch: 0.3 },
      { p: [9.2, 0.15, -52], mount: "pole", yaw: 0, pitch: 0.3 },
      { p: [-9.2, 0.15, -60], mount: "pole", yaw: Math.PI, pitch: 0.3 },
      { p: [9.0, 0.15, -16], mount: "pole", yaw: Math.PI + 0.3, pitch: 0.3 },
      { p: [-9.0, 0.15, -40], mount: "pole", yaw: -0.3, pitch: 0.3 },
      { p: [-9.0, 0.15, -16], mount: "pole", yaw: Math.PI - 0.3, pitch: 0.3 },
      // under the traffic-light arms, watching the crossing
      { p: [-7.6, 5.47, -30.6], mount: "pendant", yaw: Math.PI, pitch: 0.42, scale: 1.4 },
      { p: [-4.6, 5.47, -30.6], mount: "pendant", yaw: Math.PI - 0.5, pitch: 0.42, scale: 1.4 },
      { p: [7.6, 5.47, -49.4], mount: "pendant", yaw: 0, pitch: 0.42, scale: 1.4 },
      { p: [4.4, 5.47, -49.4], mount: "pendant", yaw: 0.5, pitch: 0.42, scale: 1.4 },
    ];
    for (const sp of spots) {
      const face = sp.face ?? 0;
      const c = cctv(sp.mount === "pole" ? { mount: "pole", pole: 4.2, rest: { yaw: sp.yaw - face, pitch: sp.pitch } } : { mount: sp.mount, rest: { yaw: sp.yaw - face, pitch: sp.pitch } });
      c.group.position.set(...sp.p); c.group.rotation.y = face; c.group.scale.setScalar(sp.scale ?? 1);
      R.add(c.group); this.cams.push(c);
    }
    this.heroCam = this.cams[0];
    // misc: hydrant, bins, trash bags, bench, newspapers, trees
    for (let i = 0; i < 26; i++) {
      const sx = r() < 0.5 ? -1 : 1, z = 40 - r() * 380;
      if (z < -30 && z > -50) continue;
      if (sx < 0 && z < -64 && z > -170) continue;
      const k = r();
      if (k < 0.35) { const b = mesh(new THREE.SphereGeometry(0.42, 10, 8), std("#14141a", { roughness: 0.3, metalness: 0.2 }), [sx * (12 - r() * 0.8), 0.45, z]); b.scale.y = 0.75; R.add(b); }
      else if (k < 0.55) R.add(mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.95, 12), std("#2d4a3e", { roughness: 0.6 }), [sx * 8.8, 0.62, z]));
      else if (k < 0.7) { const h = new THREE.Group(); h.position.set(sx * 8.7, 0.15, z); h.add(mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.7, 10), std("#8a2a2a"), [0, 0.35, 0])); h.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), std("#8a2a2a"), [0, 0.72, 0])); R.add(h); }
      else if (k < 0.85) { const n = mesh(new THREE.PlaneGeometry(0.5, 0.36), std("#bdb8aa", { side: THREE.DoubleSide }), [sx * (2 + r() * 5), 0.01, z], false); n.rotation.set(-Math.PI / 2, 0, r() * 3); R.add(n); }
      else {
        const tr = new THREE.Group(); tr.position.set(sx * 9.0, 0.15, z);
        tr.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 3, 8), std("#2a2220"), [0, 1.5, 0]));
        tr.add(mesh(new THREE.IcosahedronGeometry(1.5, 1), std("#24382f", { roughness: 0.9, flatShading: true }), [0, 3.6, 0]));
        R.add(tr);
      }
    }
    // lights
    this.hemi = new THREE.HemisphereLight("#8a9ab8", "#262430", 1); R.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#c8d4e8", 1.5);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
    this.sun.shadow.bias = -0.0005;
    R.add(this.sun, this.sun.target);
    for (let i = 0; i < 4; i++) { const p = new THREE.PointLight("#ffffff", 0, 18, 2); this.pointLights.push(p); R.add(p); }
  }

  trackNeon(g: THREE.Object3D) {
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (m && (m as any).isMeshBasicMaterial && m.map) this.neons.push({ m, base: m.color.clone() });
    });
  }

  /** day = overcast, dusk, night; n = night amount 0..1 */
  setLook(look: "overcast" | "dusk" | "night", t: number) {
    const n = look === "night" ? 1 : look === "dusk" ? 0.35 : 0;
    // neon stays lit in every scene and never flickers (story rule 1); daylight only washes it out
    for (const L of this.neons) L.m.color.copy(L.base).multiplyScalar(look === "night" ? 1 : look === "dusk" ? 0.55 : 0.3);
    void t;
    // street lamps were on at 06:12, so they stay on; their haze cones only read in the dark
    this.lampsDay.visible = false; this.lampsNight.visible = true;
    this.lampsNight.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.ShaderMaterial; if (m && m.uniforms && m.uniforms.k) m.uniforms.k.value = look === "night" ? 0.16 : look === "dusk" ? 0.04 : 0.0; });
    this.streaks.visible = look !== "overcast";
    this.pools.visible = look === "night";
    for (const s of this.streaks.children) ((s as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = look === "night" ? 1 : 0.45;
    for (const m of this.bldMats) { m.emissive.setScalar(n * 1.4); }
    this.hemi.color.set(look === "overcast" ? "#93a6c0" : look === "dusk" ? "#8a7ab0" : "#3a4890");
    this.hemi.groundColor.set(look === "overcast" ? "#2c2a34" : look === "dusk" ? "#40283a" : "#120f1c");
    this.hemi.intensity = look === "overcast" ? 1.15 : look === "dusk" ? 0.9 : 1.0;
    this.sun.visible = look !== "night";
    this.sun.color.set(look === "dusk" ? "#ff9a5a" : "#c8d4e8");
    this.sun.intensity = look === "dusk" ? 2.2 : 0.9;
  }
}
