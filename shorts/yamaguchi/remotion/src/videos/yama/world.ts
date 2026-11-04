// The Yamaguchi short's world: sky dome, camera-relative sun frozen per shot, fog, clouds, sun disc / moon, the six
// sets (sets.ts, one visible per shot), moving parts posed from the story time, and the cast (cast.ts) as lit cards.
// update(id, f, camera) is a pure function of the shot and frame.
import * as THREE from "three";
import { V, Kit } from "./build";
import { ctex, cloudHD } from "./paint";
import { Pen } from "./toon";
import { fxMushroom, fxHand } from "./fx";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, planeX } from "./cast";
import { buildSets, Sets } from "./sets";
import { FPS, SHOTS, camAt, ShotDef, trainZ, DESK_INSERT, smooth, TRAIN_V } from "./story";

export const loadKit = () => Promise.resolve({} as Kit); // no Kenney models: all plants are the cartoon vegetation

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-zone fog override (the rail shots must see Nagasaki 250-400 m ahead) */
const FOG_ZONE: Record<string, [number, number]> = { rail: [90, 1100], office: [60, 400] };

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite; private moon: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private S: Sets;
  private mush: THREE.Mesh; private mushCv: HTMLCanvasElement; private mushTex: THREE.CanvasTexture; private mushK = -1;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(2.3, 2.3, 2.1), fog: false, depthWrite: false }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5; this.moon.renderOrder = -0.5;
    for (const m of [this.sunDisc, this.sunHalo, this.moon]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 700 + (i % 3) * 70;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 150 + (i % 4) * 34;
      m.position.set(Math.cos(a) * d, 140 + (i % 4) * 42, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    this.S = buildSets(kit);
    for (const z of Object.values(this.S.zones)) { z.visible = false; R.add(z); }
    // office: interior pieces should not throw the outside sun's shadow over the whole room
    this.S.zones.office.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });
    // the mushroom cloud: one big unlit card, no fog, redrawn as it grows
    this.mushCv = document.createElement("canvas"); this.mushCv.width = 1000; this.mushCv.height = 1300;
    this.mushTex = new THREE.CanvasTexture(this.mushCv); this.mushTex.colorSpace = THREE.SRGBColorSpace;
    this.mush = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshBasicMaterial({ map: this.mushTex, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.04, 0.96, 0.9) }));
    this.mush.layers.set(NOINK); this.mush.renderOrder = -0.2; this.mush.frustumCulled = false;
    this.S.zones.field.add(this.mush);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], tau = s.tau(t), L = LIGHTS[s.light], K = LOOK[s.light], S = this.S;
    for (const [name, z] of Object.entries(S.zones)) z.visible = name === s.zone;
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.12; cam.far = 2200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const sf = focus.clone();
    if (dist > 60) sf.copy(cam.position).addScaledVector(focus.clone().sub(cam.position).normalize(), 30);
    const Rr = THREE.MathUtils.clamp(Math.min(dist, 60) * 1.15 + 7, 10, 70);
    this.sun.position.copy(sf).addScaledVector(sunDir, 220); this.sun.target.position.copy(sf);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun / moon, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    const fz = FOG_ZONE[s.zone];
    this.fog.near = fz ? fz[0] : L.fogNear; this.fog.far = fz ? fz[1] : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 1000);
      this.sunDisc.scale.setScalar(2 * 1000 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 1000 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    const night = s.light === "night" || s.light === "fire";
    this.moon.visible = night;
    if (night) { this.moon.position.copy(cam.position).add(V(-380, 520, -820)); this.moon.scale.setScalar(46); }
    const cloudsOn = s.light === "day" || s.light === "golden";
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.visible = cloudsOn && s.zone !== "office";
      m.position.x = cam.position.x + Math.cos((i / 9) * Math.PI * 2 + 0.3) * (700 + (i % 3) * 70);
      m.position.z = cam.position.z + Math.sin((i / 9) * Math.PI * 2 + 0.3) * (700 + (i % 3) * 70);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light === "golden" ? "golden" : "day"][i % 4];
    }
    // ---- moving parts ----
    if (s.zone === "rail") S.train.update(trainZ(tau), TRAIN_V * tau);
    if (s.zone === "street") S.yard.update(t);
    S.plane.visible = id === 11;
    if (id === 11) { S.plane.position.set(planeX(t), 300, -200); S.plane.rotation.set(0.05, 0, 0.04 * Math.sin(t)); }
    for (const l of S.lanterns) {
      l.m.visible = id === 23;
      if (id === 23) { l.m.position.set(l.x0 + 0.28 * t, -1.3 + 0.025 * Math.sin(t * 1.7 + l.k * 9), l.z); l.m.rotation.y = l.k * 6 + 0.1 * Math.sin(t + l.k * 5); }
    }
    // office flash: windows burn white from f 1360, the room lifts with it
    const fl = id === 21 ? smooth((f - 1358) / 16) : 0;
    S.windowGlow.color.setRGB(9 * fl, 8.4 * fl, 7.4 * fl); S.windowGlow.opacity = fl > 0 ? 1 : 0;
    S.view.color.setScalar(1 + 6 * fl);
    if (fl > 0) TONE.uLitCol.value.multiplyScalar(1 + 1.6 * fl), TONE.uShadeCol.value.multiplyScalar(1 + 2.4 * fl);
    // hanko inserts: down at the stamp frame, held, lifted; the seal stays on the paper
    const insert = id === 7 || id === 30;
    S.hanko.visible = S.seal.visible = S.paper.visible = insert || s.zone === "office";
    let handY = -1;
    if (insert) {
      const hit = id === 7 ? 494 : 2382, d = DESK_INSERT;
      let h = 0.2;
      if (f < hit - 10) h = 0.2 - 0.04 * smooth((f - (hit - 40)) / 30);
      else if (f < hit) h = 0.16 * (1 - ((f - (hit - 10)) / 10) ** 2);
      else if (f < hit + 6) h = 0;
      else h = 0.22 * smooth((f - hit - 6) / 10);
      S.hanko.position.set(d[0] + 0.08, d[1] + h, d[2] + 0.06);
      S.hanko.scale.set(1, f >= hit && f < hit + 3 ? 0.94 : 1, 1);
      S.seal.visible = f >= hit;
      (S.paper.material as THREE.MeshLambertMaterial).map = id === 30 ? S.certTex : S.noteTex;
      handY = d[1] + h + 0.068;
    } else { S.seal.visible = false; S.hanko.position.set(DESK_INSERT[0] + 0.3, DESK_INSERT[1], DESK_INSERT[2] - 0.15); }
    // campfire glow on the grass
    S.fireGlow.visible = s.zone === "camp" && id !== 24;
    S.fireGlow.scale.setScalar(1.15);
    (S.fireGlow.material as THREE.MeshBasicMaterial).opacity = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
    // mushroom cloud: Hiroshima (shots 12-13), Nagasaki (shot 22)
    this.mush.visible = id === 12 || id === 13 || id === 22;
    if (this.mush.visible) {
      const g = id === 22 ? 0.25 + 0.75 * smooth((f - 1423) / 95) : 0.45 + 0.55 * smooth((f - 754) / 123);
      const k = Math.round(g * 160) / 160;
      if (k !== this.mushK) {
        const ctx = this.mushCv.getContext("2d")!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1000, 1300);
        fxMushroom(new Pen(ctx), k); this.mushTex.needsUpdate = true; this.mushK = k;
      }
      const H = 980;
      this.mush.scale.set(H / 1.3, H / 1.3, 1);
      this.mush.position.set(id === 22 ? -60 : 40, (H / 1.3) * 0.65 - 18, -1150);
      this.mush.lookAt(cam.position.x, this.mush.position.y, cam.position.z);
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir }, sunDir);
    if (insert) {
      const sleeve = id === 7 ? "#8f875c" : "#565c6a";
      st.fx.push({ key: `hand${sleeve}`, cw: 300, ch: 500, draw: (p) => fxHand(p, sleeve), x: S.hanko.position.x, y: handY + 0.012 + 0.037, z: S.hanko.position.z, w: 0.16, h: 0.267, order: 3 });
    }
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5 * sc2))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(p);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
