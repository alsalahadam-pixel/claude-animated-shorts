// One three.js world for the whole film: apartment (+ skyline outside its window) and the city, switched per shot.
// story.ts poses it per frame; this file owns the sets, the drawn cards and the per-look sky/fog/lights.
import * as THREE from "three";
import { Apartment } from "./apartment";
import { City } from "./city";
import { SkyDome, Skyline, SkyLook } from "./skyline";
import { Card } from "../char/card";
import { drawCharacter, Frame, Light, Pose } from "../char/draw";
import { aimCctv } from "./props";
import { fireEscape, hallway, Rod, Sparks, Subway, subwayEntrance } from "./part3";

export type Look = "sunrise" | "morning" | "overcast" | "dusk" | "night" | "aptNight" | "photo" | "subway";

const SKY: Record<Look, SkyLook> = {
  sunrise: { top: "#16204a", mid: "#5a4a86", horizon: "#ff9a62", below: "#2a2236", sunDir: [1, 0.07, -0.32], sunCol: "#ffb070", sunSize: 0.0028, glow: 1.3, clouds: 0.65, cloudCol: "#c87a78", stars: 0 },
  morning: { top: "#1c2a58", mid: "#6a5a90", horizon: "#ffb07a", below: "#2a2236", sunDir: [1, 0.12, -0.3], sunCol: "#ffbe80", sunSize: 0.0028, glow: 1.0, clouds: 0.6, cloudCol: "#c88a88", stars: 0 },
  overcast: { top: "#3e4c6a", mid: "#6c7a96", horizon: "#97a3b6", below: "#5a6070", sunDir: [0.3, 0.5, -1], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.55, cloudCol: "#828da2", stars: 0 },
  dusk: { top: "#1a1f48", mid: "#6a3e6e", horizon: "#ff8a52", below: "#3a2a3a", sunDir: [0.15, 0.03, -1], sunCol: "#ff7a3a", sunSize: 0.004, glow: 1.5, clouds: 0.7, cloudCol: "#c86a6a", stars: 0 },
  night: { top: "#04060f", mid: "#0c1230", horizon: "#2a2452", below: "#0a0a14", sunDir: [0, -1, 0], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.35, cloudCol: "#3a2c62", stars: 0.5 },
  aptNight: { top: "#04060f", mid: "#0c1230", horizon: "#2c2456", below: "#0a0a14", sunDir: [0, -1, 0], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.35, cloudCol: "#3a2c62", stars: 0.5 },
  photo: { top: "#04060f", mid: "#0c1230", horizon: "#2c2456", below: "#0a0a14", sunDir: [0, -1, 0], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0.3, cloudCol: "#3a2c62", stars: 0.4 },
  subway: { top: "#000000", mid: "#020206", horizon: "#04040a", below: "#000000", sunDir: [0, -1, 0], sunCol: "#000000", sunSize: 0, glow: 0, clouds: 0, cloudCol: "#000000", stars: 0 },
};
const FOG: Record<Look, [string, number]> = {
  sunrise: ["#3a2c4a", 0.012], morning: ["#3a3050", 0.012], overcast: ["#8a96aa", 0.0125], dusk: ["#6a4a6e", 0.011],
  night: ["#151838", 0.02], aptNight: ["#0a0c1c", 0.02], photo: ["#0a0c1c", 0.02], subway: ["#050608", 0.03],
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
  glow = new Card(768, 1536, { castShadow: false });   // additive: the entity's eyes and grin glow (bloom)
  fog = new THREE.FogExp2("#000", 0.01);
  photoTex: THREE.Texture | null = null;
  photoUi: THREE.Texture | null = null;     // the "Me" message with the photo (set by applyPhoto)
  lockTex: THREE.Texture | null = null;     // the lock screen: no service, 06:12
  msgImg: HTMLImageElement | null = null;   // Part 2: the photo in the message (public/photo2.jpg)
  msgTex: THREE.Texture | null = null;      // Part 2: "Don't turn around." from Me
  envs = new Map<string, THREE.Texture>();
  phone: THREE.Group;
  phoneScreen: THREE.Mesh;
  // Part 3
  sub = new Subway();
  hall = hallway();
  escape = fireEscape();
  subEntrance = subwayEntrance();
  sparks = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => new Sparks(70, k));
  feedImg: HTMLImageElement | null = null;
  feedTex: THREE.Texture | null = null;
  pipe = new Rod(1, 0.022, "#7a7e88", { metal: 0.7, rough: 0.35 });   // the pipe he swings at the laundry camera
  entranceClutter: THREE.Object3D[] = [];
  cable = new Rod(28, 0.032, "#a2a2b4", { rough: 0.45, metal: 0.3 });                              // the camera cable he rips down the facade

  constructor() {
    const S = this.scene;
    S.fog = this.fog;
    S.add(this.sky.mesh);
    this.aptRoot.add(this.apt.root);
    this.skyline.root.position.set(0, 0, 0);
    this.aptRoot.add(this.skyline.root);
    this.cityRoot.add(this.city.root);
    S.add(this.aptRoot, this.cityRoot, this.sub.root);
    this.aptRoot.add(this.hall.group, this.escape);
    // on the west sidewalk, the stairs going down away from the road
    this.subEntrance.position.set(-10.6, 0.15, -14.0); this.subEntrance.rotation.y = -Math.PI / 2; this.cityRoot.add(this.subEntrance);
    S.add(this.pipe.group, this.cable.group);
    // street clutter standing where the entrance and its approach are (a tree, a bin): hidden while the entrance is shown
    for (const o of this.city.root.children) {
      const p = o.position;
      if (o !== this.subEntrance && p.x < -7.6 && p.x > -13 && p.z < -11 && p.z > -17 && !(o as THREE.Light).isLight) this.entranceClutter.push(o);
    }
    for (const sp of this.sparks) S.add(sp.points);
    for (const c of [this.hero, this.refl, this.cu, this.watcher, this.pigeon, this.hand, this.glow]) c.add(S);
    this.glow.mat.blending = THREE.AdditiveBlending; this.glow.mat.depthWrite = false; this.glow.mat.alphaTest = 0; this.glow.mat.color.setScalar(2.6);
    this.glow.mesh.renderOrder = 40; this.glow.blob.visible = false;
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
    const inSub = look === "subway";
    this.aptRoot.visible = inApt; this.cityRoot.visible = !inApt && !inSub; this.sub.root.visible = inSub;
    this.hall.light.intensity = 0;
    for (const sp of this.sparks) { sp.points.visible = false; (sp.points.material as THREE.PointsMaterial).color.set("#ffffff"); sp.glass = false; }
    this.subEntrance.visible = false; for (const o of this.entranceClutter) o.visible = true; this.pipe.group.visible = false; this.cable.group.visible = false;
    for (const c of [this.hero, this.refl, this.cu, this.watcher, this.glow, this.hand]) c.pivot.scale.setScalar(1);
    this.hero.mat.opacity = 1;
    for (const c of this.city.cams) c.led.visible = true;
    this.sub.torch.intensity = 0; this.sub.beam.visible = false; this.sub.train.position.set(0, 0, 0); this.sub.trainLight.intensity = 0;
    this.sub.streaks.visible = false; this.sub.flare.visible = false; this.sub.setDoors(0); this.sub.setClock("06:12"); this.sub.lamp.intensity = 0; this.sub.topGlow.intensity = 2.2; this.sub.exitLight.intensity = 0.9; this.sub.fill.intensity = 0.12;
    for (const fg of this.sub.figures) { fg.body.visible = false; fg.eyes.visible = false; fg.body.rotation.set(0, 0, 0); fg.eyes.rotation.set(0, 0, 0); fg.body.position.copy(fg.base); fg.eyes.position.copy(fg.base); }
    if (inApt) {
      this.apt.setLook(look === "aptNight" || look === "photo" ? "night" : (look as "sunrise" | "morning"), t, frame);
      this.skyline.setNight(look === "aptNight" || look === "photo" ? 1 : 0, t);
      // the skyline sits outside the window; fog there is thinner so the city reads
      this.fog.density = look === "sunrise" || look === "morning" ? 0.0042 : 0.0045;
    } else if (!inSub) this.city.setLook(look as "overcast" | "dusk" | "night", t);
    this.hero.visible = false; this.refl.visible = false; this.cu.visible = false; this.watcher.visible = false;
    this.pigeon.visible = false; this.hand.visible = false; this.glow.visible = false;
    for (const c of [this.hero, this.refl, this.cu]) c.pivot.rotation.set(0, 0, 0);
    this.phone.visible = false;
    for (const l of this.city.pointLights) l.intensity = 0;
    this.cu.mat.opacity = 1; this.watcher.mat.opacity = 1;
    const pm = this.phoneScreen.material as THREE.MeshBasicMaterial;
    if (this.photoUi && pm.map !== this.photoUi) { pm.map = this.photoUi; pm.needsUpdate = true; }
  }

  /** Part 2: a message from "Me", just now: a photo of the back of your head, taken from above, and "Don't turn around." */
  msgScreen() {
    if (!this.msgTex) {
      const c = document.createElement("canvas"); c.width = 680; c.height = 1460;
      const x = c.getContext("2d")!;
      x.fillStyle = "#07080d"; x.fillRect(0, 0, 680, 1460);
      x.fillStyle = "#8a90a8"; x.font = "500 28px sans-serif"; x.fillText("No Service", 36, 58);
      x.strokeStyle = "#8a90a8"; x.lineWidth = 3; x.strokeRect(586, 38, 54, 24); x.fillStyle = "#8a90a8"; x.fillRect(590, 42, 10, 16);
      x.fillStyle = "#151824"; x.fillRect(0, 96, 680, 136);
      const img = this.msgImg;
      x.save(); x.beginPath(); x.arc(92, 164, 44, 0, 7); x.clip();
      if (img) x.drawImage(img, img.width * 0.3, img.height * 0.3, img.width * 0.4, img.width * 0.4, 48, 120, 88, 88);
      else { x.fillStyle = "#3a3f55"; x.fillRect(48, 120, 88, 88); }
      x.restore();
      x.fillStyle = "#eef1f8"; x.font = "700 46px sans-serif"; x.fillText("Me", 158, 160);
      x.fillStyle = "#8a90a8"; x.font = "400 28px sans-serif"; x.fillText("now", 158, 200);
      // the photo, small, then the words, big and centred on the screen
      const pw = 400, ph = img ? (pw * img.height) / img.width : 533;
      x.save(); x.beginPath(); x.roundRect(250, 280, pw, ph, 22); x.clip();
      if (img) x.drawImage(img, 250, 280, pw, ph); else { x.fillStyle = "#2a3a2e"; x.fillRect(250, 280, pw, ph); }
      x.restore();
      const by = 280 + ph + 40;
      x.fillStyle = "#2c3142"; x.beginPath(); x.roundRect(40, by, 600, 220, 40); x.fill();
      x.fillStyle = "#ffffff"; x.font = "700 64px sans-serif"; x.textAlign = "left";
      x.fillText("Don't turn", 112, by + 92); x.fillText("around.", 112, by + 172);
      x.fillStyle = "#8a90a8"; x.font = "400 26px sans-serif"; x.textAlign = "right"; x.fillText("Delivered", 640, by + 262);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      this.msgTex = t;
    }
    const m = this.phoneScreen.material as THREE.MeshBasicMaterial;
    if (m.map !== this.msgTex) { m.map = this.msgTex; m.color.setScalar(1.2); m.needsUpdate = true; }
  }

  /** Part 3: the phone shows a live night-vision feed of you, from behind, on the platform */
  feedScreen(blink: boolean) {
    if (this.feedTex && !this.feedTex.userData.hasImg && this.feedImg) { this.feedTex.dispose(); this.feedTex = null; }   // built before the image loaded
    if (!this.feedTex) {
      const c = document.createElement("canvas"); c.width = 680; c.height = 1460;
      const x = c.getContext("2d")!;
      x.fillStyle = "#050806"; x.fillRect(0, 0, 680, 1460);
      const img = this.feedImg;
      if (img) { const ih = (680 * img.height) / img.width; x.drawImage(img, 0, (1460 - ih) / 2, 680, ih); }
      x.fillStyle = "rgba(0,0,0,0.55)"; x.fillRect(0, 0, 680, 150); x.fillRect(0, 1310, 680, 150);
      x.fillStyle = "#e8fff0"; x.font = "600 40px monospace"; x.fillText("LIVE", 92, 92);
      x.font = "500 32px monospace"; x.textAlign = "right"; x.fillText("CAM 00 · PLATFORM 2", 646, 92);
      x.textAlign = "left"; x.fillText("06:12:00", 40, 1395);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.hasImg = !!img;
      this.feedTex = t;
    }
    const m = this.phoneScreen.material as THREE.MeshBasicMaterial;
    if (m.map !== this.feedTex) { m.map = this.feedTex; m.needsUpdate = true; }
    m.color.setScalar(blink ? 1.35 : 1.2);
  }

  /** the phone shows its lock screen: no service, the frozen clock, nothing new */
  lockScreen() {
    if (!this.lockTex) {
      const c = document.createElement("canvas"); c.width = 680; c.height = 1460;
      const x = c.getContext("2d")!;
      const g = x.createLinearGradient(0, 0, 680, 1460);
      g.addColorStop(0, "#1a1d44"); g.addColorStop(0.55, "#2a1f4e"); g.addColorStop(1, "#0d1a2c");
      x.fillStyle = g; x.fillRect(0, 0, 680, 1460);
      const r = x.createRadialGradient(470, 1050, 20, 470, 1050, 520);
      r.addColorStop(0, "rgba(255,150,80,0.32)"); r.addColorStop(1, "rgba(255,150,80,0)");
      x.fillStyle = r; x.fillRect(0, 0, 680, 1460);
      x.fillStyle = "#c9cde0"; x.font = "500 30px sans-serif"; x.fillText("No Service", 40, 64);
      x.strokeStyle = "#c9cde0"; x.lineWidth = 3; x.strokeRect(580, 42, 58, 26); x.fillStyle = "#c9cde0"; x.fillRect(584, 46, 14, 18);
      x.textAlign = "center";
      x.fillStyle = "#f2efe9"; x.font = "200 196px sans-serif"; x.fillText("06:12", 340, 400);
      x.fillStyle = "#c9cde0"; x.font = "500 36px sans-serif"; x.fillText("Thursday", 340, 200);
      x.fillStyle = "rgba(255,255,255,0.10)"; x.beginPath(); x.roundRect(48, 520, 584, 104, 30); x.fill();
      x.fillStyle = "#c9cde0"; x.font = "400 30px sans-serif"; x.fillText("No new notifications", 340, 582);
      x.fillStyle = "rgba(242,239,233,0.8)"; x.beginPath(); x.roundRect(250, 1404, 180, 10, 5); x.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      this.lockTex = t;
    }
    const m = this.phoneScreen.material as THREE.MeshBasicMaterial;
    if (m.map !== this.lockTex) { m.map = this.lockTex; m.color.setScalar(1.25); m.needsUpdate = true; }
  }

  /** a temporary practical light for a shot (city point lights pool) */
  practical(i: number, pos: [number, number, number], color: string, intensity: number, dist = 14) {
    const l = this.city.pointLights[i]; l.position.set(...pos); l.color.set(color); l.intensity = intensity; l.distance = dist;
  }

  /** prefiltered environment for reflections (wet road, cars, glass): the look's sky plus a few glowing panels */
  envFor(look: Look, gl: THREE.WebGLRenderer) {
    const key = look === "aptNight" || look === "photo" || look === "subway" ? "night" : look === "morning" ? "sunrise" : look;
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

  /** lay the glow card exactly over another card (same frame, same transform), drawn with fn */
  glowOver(host: Card, fn: (ctx: CanvasRenderingContext2D) => void) {
    const g = this.glow;
    if (g.canvas.width !== host.canvas.width || g.canvas.height !== host.canvas.height) { g.canvas.width = host.canvas.width; g.canvas.height = host.canvas.height; g.tex.dispose(); }
    g.setFrame(host.frame);
    g.draw((ctx) => { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); fn(ctx); });
    g.pivot.position.copy(host.pivot.position); g.pivot.quaternion.copy(host.pivot.quaternion);
    g.mesh.position.z = host.mesh.position.z + 0.002;
    g.visible = true; g.blob.visible = false;
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

  /** every (or the listed) CCTV head turns from its own resting aim toward the target by k (0..1) */
  aimCams(target: THREE.Vector3, k: number, which?: number[]) {
    this.city.cams.forEach((c, i) => { if (!which || which.includes(i)) aimCctv(c, target, k, c.rest); });
  }
}
