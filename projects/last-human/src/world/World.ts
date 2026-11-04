// One three.js world for the whole film: apartment (+ skyline outside its window) and the city, switched per shot.
// story.ts poses it per frame; this file owns the sets, the drawn cards and the per-look sky/fog/lights.
import * as THREE from "three";
import { Apartment } from "./apartment";
import { City } from "./city";
import { SkyDome, Skyline, SkyLook } from "./skyline";
import { Card } from "../char/card";
import { drawCharacter, Frame, Light, Pose } from "../char/draw";
import { aimCctv } from "./props";

export type Look = "sunrise" | "morning" | "overcast" | "dusk" | "night" | "aptNight" | "photo";

const SKY: Record<Look, SkyLook> = {
  sunrise: { top: "#16204a", mid: "#5a4a86", horizon: "#ff9a62", below: "#2a2236", sunDir: [1, 0.07, -0.32], sunCol: "#ffb070", sunSize: 0.0028, glow: 1.3, clouds: 0.65, cloudCol: "#c87a78", stars: 0 },
  morning: { top: "#1c2a58", mid: "#6a5a90", horizon: "#ffb07a", below: "#2a2236", sunDir: [1, 0.12, -0.3], sunCol: "#ffbe80", sunSize: 0.0028, glow: 1.0, clouds: 0.6, cloudCol: "#c88a88", stars: 0 },
  overcast: { top: "#3e4c6a", mid: "#6c7a96", horizon: "#97a3b6", below: "#5a6070", sunDir: [0.3, 0.5, -1], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.55, cloudCol: "#828da2", stars: 0 },
  dusk: { top: "#1a1f48", mid: "#6a3e6e", horizon: "#ff8a52", below: "#3a2a3a", sunDir: [0.15, 0.03, -1], sunCol: "#ff7a3a", sunSize: 0.004, glow: 1.5, clouds: 0.7, cloudCol: "#c86a6a", stars: 0 },
  night: { top: "#04060f", mid: "#0c1230", horizon: "#2a2452", below: "#0a0a14", sunDir: [0, -1, 0], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.35, cloudCol: "#3a2c62", stars: 0.5 },
  aptNight: { top: "#04060f", mid: "#0c1230", horizon: "#2c2456", below: "#0a0a14", sunDir: [0, -1, 0], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.35, cloudCol: "#3a2c62", stars: 0.5 },
  photo: { top: "#04060f", mid: "#0c1230", horizon: "#2c2456", below: "#0a0a14", sunDir: [0, -1, 0], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.3, cloudCol: "#3a2c62", stars: 0.4 },
};
const FOG: Record<Look, [string, number]> = {
  sunrise: ["#3a2c4a", 0.012], morning: ["#3a3050", 0.012], overcast: ["#8a96aa", 0.0125], dusk: ["#6a4a6e", 0.011],
  night: ["#151838", 0.02], aptNight: ["#0a0c1c", 0.02], photo: ["#0a0c1c", 0.02],
};

export class World {
  scene = new THREE.Scene();
  apt = new Apartment();
  sky = new SkyDome();
  skyline = new Skyline(-45);
  city = new City();
  aptRoot = new THREE.Group();
  cityRoot = new THREE.Group();
  hero = new Card(1024, 1638);
  refl = new Card(1024, 1638, { castShadow: false });
  cu = new Card(1536, 1536, { castShadow: false });
  watcher = new Card(768, 1536, { castShadow: false });
  pigeon = new Card(512, 512, { castShadow: false });
  hand = new Card(1280, 384, { castShadow: false });
  fog = new THREE.FogExp2("#000", 0.01);
  photoTex: THREE.Texture | null = null;
  envs = new Map<string, THREE.Texture>();
  phone: THREE.Group;
  phoneScreen: THREE.Mesh;

  constructor() {
    const S = this.scene;
    S.fog = this.fog;
    S.add(this.sky.mesh);
    this.aptRoot.add(this.apt.root);
    this.skyline.root.position.set(0, 0, 0);
    this.aptRoot.add(this.skyline.root);
    this.cityRoot.add(this.city.root);
    S.add(this.aptRoot, this.cityRoot);
    for (const c of [this.hero, this.refl, this.cu, this.watcher, this.pigeon, this.hand]) c.add(S);
    this.refl.mat.opacity = 0.62;
    this.refl.blob.visible = false;
    // the phone of scenes 6-7 (screen shows the photo)
    this.phone = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.155, 0.009), new THREE.MeshStandardMaterial({ color: "#0b0b12", roughness: 0.25, metalness: 0.5 }));
    this.phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    this.phoneScreen.position.z = 0.0051;
    this.phone.add(body, this.phoneScreen);
    this.phone.visible = false;
    S.add(this.phone);
  }

  setLook(look: Look, t: number, frame: number) {
    this.sky.set(SKY[look]);
    const [fc, fd] = FOG[look];
    this.fog.color.set(fc); this.fog.density = fd;
    const inApt = look === "sunrise" || look === "morning" || look === "aptNight" || look === "photo";
    this.aptRoot.visible = inApt; this.cityRoot.visible = !inApt;
    if (inApt) {
      this.apt.setLook(look === "aptNight" || look === "photo" ? "night" : (look as "sunrise" | "morning"), t, frame);
      this.skyline.setNight(look === "aptNight" || look === "photo" ? 1 : 0, t);
      // the skyline sits outside the window; fog there is thinner so the city reads
      this.fog.density = look === "sunrise" || look === "morning" ? 0.0042 : 0.0045;
    } else this.city.setLook(look as "overcast" | "dusk" | "night", t);
    this.hero.visible = false; this.refl.visible = false; this.cu.visible = false; this.watcher.visible = false;
    this.pigeon.visible = false; this.hand.visible = false;
    for (const c of [this.hero, this.refl, this.cu]) c.pivot.rotation.set(0, 0, 0);
    this.phone.visible = false;
    for (const l of this.city.pointLights) l.intensity = 0;
    this.cu.mat.opacity = 1;
  }

  /** a temporary practical light for a shot (city point lights pool) */
  practical(i: number, pos: [number, number, number], color: string, intensity: number, dist = 14) {
    const l = this.city.pointLights[i]; l.position.set(...pos); l.color.set(color); l.intensity = intensity; l.distance = dist;
  }

  /** prefiltered environment for reflections (wet road, cars, glass): the look's sky plus a few glowing panels */
  envFor(look: Look, gl: THREE.WebGLRenderer) {
    const key = look === "aptNight" || look === "photo" ? "night" : look === "morning" ? "sunrise" : look;
    const hit = this.envs.get(key); if (hit) return hit;
    const es = new THREE.Scene();
    const sky = new SkyDome(40); sky.set(SKY[key as Look]); es.add(sky.mesh);
    if (key === "night") {
      const cols = ["#b06bff", "#3ff0e0", "#ff4fb8", "#ffa050", "#5fd0ff", "#ff6a4a"];
      cols.forEach((c, i) => {
        const m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }); m.color.multiplyScalar(2.2);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.5), m);
        const a = (i / cols.length) * Math.PI * 2; p.position.set(Math.cos(a) * 25, 3 + (i % 2) * 4, Math.sin(a) * 25); p.lookAt(0, 4, 0); es.add(p);
      });
    }
    const pm = new THREE.PMREMGenerator(gl);
    const t = pm.fromScene(es, 0.02).texture; pm.dispose();
    this.envs.set(key, t);
    return t;
  }

  /** psi for a character at p facing world direction dir, seen from cam */
  static psi(p: THREE.Vector3, dir: THREE.Vector3, cam: THREE.PerspectiveCamera) {
    const toCam = cam.position.clone().sub(p); toCam.y = 0; toCam.normalize();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); right.y = 0; right.normalize();
    const d = dir.clone(); d.y = 0; d.normalize();
    return (Math.atan2(d.dot(right), d.dot(toCam)) * 180) / Math.PI;
  }

  /** draw + place a standing/walking/sitting character card at feet position p */
  place(card: Card, pose: Pose, L: Light, F: Frame, p: THREE.Vector3, cam: THREE.PerspectiveCamera, o: { floorY?: number; blob?: boolean; lineK?: number } = {}) {
    card.setFrame(F);
    card.draw((ctx, fr) => drawCharacter(ctx, pose, L, fr, { lineK: o.lineK }));
    card.stand(p, cam.position, 0, o.floorY ?? p.y);
    card.visible = true;
    card.blob.visible = o.blob ?? true;
  }

  /** every (or the listed) CCTV head turns from its rest pose toward the target by k (0..1) */
  aimCams(target: THREE.Vector3, k: number, which?: number[], rest?: (i: number) => { yaw: number; pitch: number }) {
    this.city.cams.forEach((c, i) => { if (!which || which.includes(i)) aimCctv(c, target, k, rest ? rest(i) : { yaw: 1.3 + i * 1.7, pitch: 0.25 }); });
  }
}
