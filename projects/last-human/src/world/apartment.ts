// The apartment (studio, 15th floor). Room box x ∈ [-3.5, 3.5], z ∈ [-3, 3], floor y = 0, ceiling 2.8.
// East wall (x = +3.5) is a floor-to-ceiling window; blinds over the bed half (z < -0.4), clear glass on the rest.
// Bed against the north wall (headboard at z = -2.95), TV on the west wall, door in the south wall, wardrobe and the
// dark corner at the north-west.
import * as THREE from "three";
import { fabric, plaster, poster, Static, woodFloor } from "./paint";
import { Dust, glow, mesh, rbox, shaft, std } from "./props";

export const APT = {
  pillowHead: new THREE.Vector3(1.55, 0.7, -2.42),
  bedHip: new THREE.Vector3(1.55, 0.6, -1.62),
  tvStand: new THREE.Vector3(-1.25, 0, 0.35),
  window: new THREE.Vector3(2.85, 0, 0.6),
  door: new THREE.Vector3(-2.15, 0, 2.55),
  bedEdge: new THREE.Vector3(1.05, 0.5, -1.2),
  corner: new THREE.Vector3(-3.05, 0, -2.6),
};

export class Apartment {
  root = new THREE.Group();
  sun: THREE.DirectionalLight;
  tvLight: THREE.PointLight;
  phoneLight: THREE.PointLight;
  cityGlowA: THREE.PointLight;
  cityGlowB: THREE.PointLight;
  hemi: THREE.HemisphereLight;
  lampLight: THREE.PointLight;
  stat = new Static();
  tvScreen: THREE.Mesh;
  shafts = new THREE.Group();
  dust: Dust;
  chainLoose: THREE.Group;
  chainLocked: THREE.Group;
  blinds = new THREE.Group();
  phoneOnStand: THREE.Mesh;

  constructor() {
    const R = this.root;
    const floor = mesh(new THREE.PlaneGeometry(7, 6), std("#ffffff", { map: woodFloor(), roughness: 0.55 }), [0, 0, 0]);
    floor.rotation.x = -Math.PI / 2; R.add(floor);
    const wallM = std("#ffffff", { map: plaster("#59607a", 3), roughness: 0.92 });
    const wall = (w: number, h: number, p: [number, number, number], ry: number) => { const m = mesh(new THREE.PlaneGeometry(w, h), wallM, p, false); m.rotation.y = ry; R.add(m); return m; };
    wall(7, 2.8, [0, 1.4, -3], 0);             // north
    wall(6, 2.8, [-3.5, 1.4, 0], Math.PI / 2); // west
    // south wall with a door opening
    wall(4.95, 2.8, [0.975, 1.4, 3], Math.PI);
    wall(0.85, 2.8, [-3.075, 1.4, 3], Math.PI);
    wall(1.2, 0.7, [-2.15, 2.45, 3], Math.PI);
    const ceil = mesh(new THREE.PlaneGeometry(7, 6), std("#ffffff", { map: plaster("#4a4f66", 4), roughness: 0.95 }), [0, 2.8, 0], false);
    ceil.rotation.x = Math.PI / 2; R.add(ceil);
    // east wall: frame around the window opening (z -2.4..1.6, y 0.3..2.6)
    const frameM = std("#2a2c38", { roughness: 0.6 });
    const ew = (w: number, h: number, y: number, z: number) => { const m = mesh(new THREE.PlaneGeometry(w, h), wallM, [3.5, y, z], false); m.rotation.y = -Math.PI / 2; R.add(m); };
    ew(6, 0.3, 0.15, 0); ew(6, 0.2, 2.7, 0); ew(0.6, 2.8, 1.4, -2.7); ew(1.4, 2.8, 1.4, 2.3);
    for (const z of [-2.4, -0.4, 1.6]) R.add(mesh(new THREE.BoxGeometry(0.12, 2.32, 0.07), frameM, [3.47, 1.45, z]));
    for (const y of [0.3, 2.6]) R.add(mesh(new THREE.BoxGeometry(0.14, 0.07, 4.05), frameM, [3.47, y, -0.4]));
    R.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 4.1), std("#3a3d4a"), [3.38, 0.32, -0.4]));   // sill
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.3), new THREE.MeshStandardMaterial({ color: "#8fa6c8", transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.9, depthWrite: false }));
    glass.position.set(3.49, 1.45, -0.4); glass.rotation.y = -Math.PI / 2; R.add(glass);
    // blinds over the bed half: tilted slats with gaps (the sunrise stripes)
    const slatM = std("#c9c3b8", { roughness: 0.6 });
    for (let y = 0.36; y < 2.58; y += 0.078) {
      const s = mesh(new THREE.BoxGeometry(0.07, 0.008, 1.96), slatM, [3.38, y, -1.4]);
      s.rotation.z = 0.5; this.blinds.add(s);
    }
    this.blinds.add(mesh(rbox(0.1, 0.08, 2.0, 0.02), slatM, [3.38, 2.6, -1.4]));
    R.add(this.blinds);
    // bed
    const bedM = std("#2c2733", { roughness: 0.7 });
    R.add(mesh(rbox(1.9, 0.32, 2.15, 0.03), bedM, [1.55, 0.2, -1.88]));
    R.add(mesh(rbox(1.95, 1.05, 0.1, 0.03), bedM, [1.55, 0.55, -2.95]));
    R.add(mesh(rbox(1.84, 0.2, 2.05, 0.08), std("#ffffff", { map: fabric("#c9cbd8", 5), roughness: 0.9 }), [1.55, 0.46, -1.9]));
    const pillow = mesh(rbox(0.72, 0.16, 0.46, 0.07, 4), std("#ffffff", { map: fabric("#d8d6e2", 6), roughness: 0.95 }), [1.55, 0.6, -2.55]);
    pillow.rotation.x = -0.12; R.add(pillow);
    R.add(this.blanket());
    // nightstand + lamp + phone
    R.add(mesh(rbox(0.48, 0.5, 0.42, 0.02), std("#3b3140", { roughness: 0.6 }), [2.95, 0.25, -2.6]));
    R.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.06, 16), std("#c7b9a3"), [2.95, 0.53, -2.7]));
    R.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), std("#c7b9a3"), [2.95, 0.68, -2.7]));
    R.add(mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.17, 20, 1, true), std("#d7c2a0", { side: THREE.DoubleSide, roughness: 0.9 }), [2.95, 0.86, -2.7]));
    this.phoneOnStand = mesh(rbox(0.075, 0.012, 0.15, 0.006), std("#0b0b12", { roughness: 0.2 }), [2.85, 0.505, -2.5]);
    R.add(this.phoneOnStand);
    // TV wall (west)
    R.add(mesh(rbox(0.42, 0.45, 1.7, 0.02), std("#23222c", { roughness: 0.5 }), [-3.25, 0.225, 0.35]));
    const tvBody = mesh(rbox(0.06, 0.78, 1.36, 0.015), std("#0a0a10", { roughness: 0.3 }), [-3.3, 0.95, 0.35]);
    R.add(tvBody);
    const scr = new THREE.MeshBasicMaterial({ map: this.stat.t }); scr.color.setRGB(0.55, 1.6, 1.55);
    this.tvScreen = mesh(new THREE.PlaneGeometry(1.28, 0.7), scr, [-3.265, 0.95, 0.35], false);
    this.tvScreen.rotation.y = Math.PI / 2; R.add(this.tvScreen);
    // posters, shelf, plant, rug, wardrobe
    const posterA = mesh(new THREE.PlaneGeometry(0.6, 0.9), std("#fff", { map: poster(2, ["#2b2f55", "#d06a3a", "#6e5aa8", "#2f8a86"]) }), [-3.48, 1.85, -0.75], false);
    posterA.rotation.y = Math.PI / 2; R.add(posterA);
    const posterB = mesh(new THREE.PlaneGeometry(0.55, 0.8), std("#fff", { map: poster(7, ["#1d2b3a", "#c94f4f", "#e0b45a"]) }), [-0.6, 1.7, -2.98], false);
    R.add(posterB);
    const shelf = new THREE.Group(); shelf.position.set(1.4, 0, 2.82); R.add(shelf);
    shelf.add(mesh(rbox(1.5, 1.6, 0.32, 0.02), std("#2e2a35"), [0, 0.8, 0]));
    const bookCols = ["#6a3b3b", "#2f4f6a", "#c9a45a", "#4d3b6a", "#2f6a5a", "#8a8a96"];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
      const h = 0.22 + ((i * 7 + row * 3) % 5) * 0.025;
      shelf.add(mesh(new THREE.BoxGeometry(0.045 + (i % 3) * 0.01, h, 0.22), std(bookCols[(i + row * 2) % bookCols.length]), [-0.6 + i * 0.13, 0.2 + row * 0.5 + h / 2, -0.04]));
    }
    const plant = new THREE.Group(); plant.position.set(3.05, 0, 2.25); R.add(plant);
    plant.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 16), std("#b87355"), [0, 0.2, 0]));
    for (let i = 0; i < 9; i++) {
      const leaf = mesh(new THREE.ConeGeometry(0.07, 0.75, 6), std("#2c4a3e", { roughness: 0.8 }), [Math.sin(i * 2.4) * 0.12, 0.7, Math.cos(i * 2.4) * 0.12]);
      leaf.rotation.set(Math.cos(i * 2.4) * 0.5, 0, -Math.sin(i * 2.4) * 0.5); plant.add(leaf);
    }
    const rug = mesh(new THREE.PlaneGeometry(2.6, 1.8), std("#fff", { map: fabric("#3c3552", 8, "#4a4366"), roughness: 1 }), [-0.6, 0.006, 0.3], false);
    rug.rotation.x = -Math.PI / 2; R.add(rug);
    R.add(mesh(rbox(0.62, 2.25, 1.15, 0.02), std("#25232d", { roughness: 0.55 }), [-3.18, 1.125, -1.45]));
    R.add(mesh(new THREE.BoxGeometry(0.02, 2.1, 0.01), std("#111018"), [-2.86, 1.12, -1.45]));
    // door (south wall, x -2.6..-1.7)
    const door = new THREE.Group(); door.position.set(-2.15, 0, 2.97); R.add(door);
    door.add(mesh(rbox(0.9, 2.08, 0.05, 0.01), std("#3a3346", { roughness: 0.55 }), [0, 1.04, 0]));
    door.add(mesh(new THREE.BoxGeometry(1.02, 2.16, 0.04), std("#22202a"), [0, 1.06, 0.03]));
    const brass = std("#c9a55a", { metalness: 0.85, roughness: 0.3 });
    door.add(mesh(new THREE.SphereGeometry(0.035, 12, 10), brass, [0.33, 1.0, -0.06]));
    door.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), brass, [0.33, 1.18, -0.04]).rotateX(Math.PI / 2));
    door.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), std("#111"), [0, 1.55, -0.03]).rotateX(Math.PI / 2));
    // chain lock: slot plate on the frame; chain hanging loose, or across into the slot
    door.add(mesh(rbox(0.16, 0.03, 0.02, 0.005), brass, [0.24, 1.48, -0.035]));
    door.add(mesh(rbox(0.03, 0.06, 0.02, 0.005), brass, [-0.55, 1.48, -0.035]));
    this.chainLoose = new THREE.Group(); this.chainLocked = new THREE.Group();
    const link = (g: THREE.Group, x: number, y: number, r: number) => { const l = mesh(new THREE.TorusGeometry(0.013, 0.003, 6, 12), brass, [x, y, -0.05], false); l.rotation.set(0, r, Math.PI / 2 * (g.children.length % 2)); g.add(l); };
    for (let i = 0; i < 10; i++) link(this.chainLoose, -0.55 + 0.004 * i, 1.46 - i * 0.022, 0);
    for (let i = 0; i < 12; i++) link(this.chainLocked, -0.53 + i * 0.062, 1.47 - Math.sin((i / 11) * Math.PI) * 0.03, Math.PI / 2);
    door.add(this.chainLoose, this.chainLocked);
    // lights
    this.hemi = new THREE.HemisphereLight("#6a74b8", "#1a1424", 0.6); R.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#ffb070", 4.5);
    this.sun.position.set(14, 3.2, -4.4); this.sun.target.position.set(0, 0.4, -1.4);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02;
    R.add(this.sun, this.sun.target);
    this.tvLight = new THREE.PointLight("#5fe0d6", 0, 6, 2); this.tvLight.position.set(-2.9, 1.0, 0.35); R.add(this.tvLight);
    this.phoneLight = new THREE.PointLight("#bfe6ff", 0, 1.6, 2); R.add(this.phoneLight);
    this.cityGlowA = new THREE.PointLight("#8a5cff", 0, 12, 1.5); this.cityGlowA.position.set(4.5, 1.6, 0.8); R.add(this.cityGlowA);
    this.cityGlowB = new THREE.PointLight("#3fc6c0", 0, 12, 1.5); this.cityGlowB.position.set(4.5, 1.2, -2.0); R.add(this.cityGlowB);
    this.lampLight = new THREE.PointLight("#ff9a50", 0, 4, 2); this.lampLight.position.set(2.95, 0.9, -2.7); R.add(this.lampLight);
    // sunrise shafts through the blinds + clear glass, and dust in them
    const dir = new THREE.Vector3(-1, -0.2, 0.3).normalize();
    for (let i = 0; i < 3; i++) this.shafts.add(shaft(new THREE.Vector3(3.45, 2.3 - i * 0.45, -2.1 + i * 0.6), dir, 5.0, 1.1, "#ffae6a", 0.1, 7));
    for (let i = 0; i < 2; i++) this.shafts.add(shaft(new THREE.Vector3(3.45, 2.1 - i * 0.6, 0.3 + i * 0.6), dir, 6.0, 1.3, "#ffb878", 0.08));
    R.add(this.shafts);
    this.dust = new Dust(500, new THREE.Box3(new THREE.Vector3(-1, 0.3, -2.8), new THREE.Vector3(3.4, 2.5, 1.5)));
    R.add(this.dust.points);
  }

  blanket() {
    // rumpled duvet over the lower bed: displaced plane draped over the sides
    const g = new THREE.PlaneGeometry(2.05, 1.5, 40, 32);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getY(i);
      const edge = Math.max(0, Math.abs(x) - 0.88) + Math.max(0, -z - 0.6) * 1.4;   // drapes over the sides and the foot
      const fold = 0.035 * Math.sin(x * 9 + z * 3) + 0.025 * Math.sin(z * 13 - x * 5) + 0.05 * Math.exp(-((x - 0.1) ** 2) * 6) * Math.cos(z * 2);
      const body = 0.07 * Math.exp(-(x * x) * 7) * (z < 0.6 ? 1 : 0.6); // a lump where his legs are
      p.setXYZ(i, Math.min(Math.abs(x), 0.95) * Math.sign(x), Math.max(z, -0.68), 0.11 + fold + body - edge * 3.2);
    }
    g.computeVertexNormals();
    const m = mesh(g, std("#ffffff", { map: fabric("#4c4f7a", 12), roughness: 0.95, side: THREE.DoubleSide }), [1.55, 0.5, -1.52]);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  /** light rig per look; t = seconds (for static, dust, flicker) */
  setLook(look: "sunrise" | "morning" | "night" | "photo", t: number, frame: number) {
    const day = look === "sunrise" || look === "morning";
    this.sun.visible = day;
    this.sun.intensity = look === "sunrise" ? 5.2 : 3.6;
    this.shafts.visible = day;
    this.dust.points.visible = day;
    this.dust.update(t);
    for (const s of this.shafts.children) ((s as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.time.value = t;
    this.hemi.color.set(day ? "#6a74b8" : "#2c3570"); this.hemi.groundColor.set(day ? "#2a1f2c" : "#0d0b16");
    this.hemi.intensity = day ? 0.75 : 0.5;
    this.tvLight.intensity = look === "morning" ? 2.2 : 0;
    this.stat.update(frame);
    this.cityGlowA.intensity = day ? 0 : 6; this.cityGlowB.intensity = day ? 0 : 4;
    this.lampLight.intensity = 0;
    (this.tvScreen.material as THREE.MeshBasicMaterial).color.setRGB(0.55 * 1.3, 1.6 * 1.3, 1.55 * 1.3);
  }
}

export { glow };
