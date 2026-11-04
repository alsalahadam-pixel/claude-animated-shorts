// Sky dome (gradient + sun + cloud streaks) and the far city: merged boxes with world-scaled window UVs.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvas, rng, tex } from "./paint";
import { car, glow, std } from "./props";

const skyVS = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const skyFS = /* glsl */ `
uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 below; uniform vec3 sunDir; uniform vec3 sunCol;
uniform float sunSize; uniform float glowK; uniform float clouds; uniform vec3 cloudCol; uniform float stars;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(horizon, mid, smoothstep(0.0, 0.18, h)) : mix(horizon, below, smoothstep(0.0, -0.12, h));
  c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.7, h)) : c;
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6) * glowK;
  c += sunCol * smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, s) * 6.0;
  if (clouds > 0.0 && h > -0.02) {
    vec2 uv = d.xz / (h + 0.12) * 1.4;
    float n = vn(uv * vec2(1.0, 6.0)) * 0.6 + vn(uv * vec2(2.3, 13.0)) * 0.4;
    float band = smoothstep(0.55, 0.85, n) * smoothstep(0.45, 0.04, h);
    vec3 cc = cloudCol * (0.6 + 0.8 * pow(s, 3.0));
    c = mix(c, cc, band * clouds);
  }
  if (stars > 0.0 && h > 0.05) { vec2 g = floor(d.xz / (h + 0.3) * 300.0); float st = step(0.997, hash(g)); c += vec3(st) * stars * smoothstep(0.05, 0.4, h); }
  gl_FragColor = vec4(c, 1.0);
}`;

export type SkyLook = { top: string; mid: string; horizon: string; below: string; sunDir: [number, number, number]; sunCol: string; sunSize: number; glow: number; clouds: number; cloudCol: string; stars: number };

export class SkyDome {
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial;
  constructor(r = 900) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, below: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(1, 0.1, 0) }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0.002 }, glowK: { value: 1 },
        clouds: { value: 0 }, cloudCol: { value: new THREE.Color() }, stars: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), this.mat);
    this.mesh.renderOrder = -10; this.mesh.frustumCulled = false;
  }
  set(L: SkyLook) {
    const u = this.mat.uniforms;
    u.top.value.set(L.top); u.mid.value.set(L.mid); u.horizon.value.set(L.horizon); u.below.value.set(L.below);
    u.sunDir.value.set(...L.sunDir).normalize(); u.sunCol.value.set(L.sunCol); u.sunSize.value = L.sunSize; u.glowK.value = L.glow;
    u.clouds.value = L.clouds; u.cloudCol.value.set(L.cloudCol); u.stars.value = L.stars;
  }
}

/** window-bay tile textures: 8 x 8 bays per texture, albedo + lit-window emissive */
export function bayTextures(seed: number, base: string, glass: string, lit: number) {
  const N = 8, S = 64;
  const a = canvas(N * S, N * S), e = canvas(N * S, N * S), r = rng(seed);
  a.x.fillStyle = base; a.x.fillRect(0, 0, N * S, N * S);
  e.x.fillStyle = "#000"; e.x.fillRect(0, 0, N * S, N * S);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i * S, y = j * S;
    a.x.fillStyle = "rgba(255,255,255,0.05)"; a.x.fillRect(x, y, S, 3);
    a.x.fillStyle = glass; a.x.fillRect(x + 10, y + 12, S - 20, S - 22);
    a.x.fillStyle = "rgba(255,255,255,0.07)"; a.x.fillRect(x + 10, y + 12, (S - 20) * 0.4, S - 22);
    if (r() < lit) {
      const warm = r() < 0.7;
      e.x.fillStyle = warm ? "#ffb468" : r() < 0.5 ? "#a98bff" : "#74d6cf";
      e.x.globalAlpha = 0.35 + r() * 0.65; e.x.fillRect(x + 10, y + 12, S - 20, S - 22); e.x.globalAlpha = 1;
    }
  }
  const m = tex(a.c), em = tex(e.c);
  m.generateMipmaps = true; em.generateMipmaps = true;
  return { map: m, emissive: em };
}

/** merged boxes; UVs in bays (bay = 3.6 m wide, floor = 3.4 m) so windows keep their size on every building */
export function mergedBlocks(boxes: { x: number; z: number; w: number; d: number; h: number; y0?: number }[]) {
  const geos: THREE.BufferGeometry[] = [];
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    // face order: +x, -x, +y, -y, +z, -z (4 vertices each)
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const u = uv.getX(i), v = uv.getY(i);
      const across = f < 2 ? b.d : b.w;
      if (f === 2 || f === 3) uv.setXY(i, 0.01, 0.01);
      else uv.setXY(i, (u * across) / 3.6 / 8, (v * b.h) / 3.4 / 8);
    }
    g.translate(b.x, (b.y0 ?? 0) + b.h / 2, b.z);
    geos.push(g);
  }
  return mergeGeometries(geos)!;
}

export class Skyline {
  root = new THREE.Group();
  mats: THREE.MeshStandardMaterial[] = [];
  carLights: THREE.MeshBasicMaterial[] = [];
  constructor(groundY: number) {
    const r = rng(77);
    const sets = [
      { tx: bayTextures(1, "#3a4058", "#1a2033", 0.22), boxes: [] as any[] },
      { tx: bayTextures(2, "#4a4458", "#221d30", 0.18), boxes: [] as any[] },
      { tx: bayTextures(3, "#2f3a48", "#141c28", 0.26), boxes: [] as any[] },
    ];
    // blocks east of the window (+x), on a street grid, taller toward the "downtown" cluster
    for (let gx = 0; gx < 18; gx++) for (let gz = -14; gz <= 14; gz++) {
      const x = 60 + gx * 46, z = gz * 46;
      if (gx === 2) continue;      // the highway corridor at x ≈ 168
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const w = 12 + r() * 18, d = 12 + r() * 18;
        const down = Math.exp(-(((gx - 10) / 4) ** 2 + ((gz + 2) / 5) ** 2));
        const near = gx < 4 ? 0.45 : 1;   // the blocks right under the window stay low so the view opens up
        const h = (10 + r() * 30) * near + down * (70 + r() * 130);
        sets[Math.floor(r() * 3)].boxes.push({ x: x + (r() - 0.5) * 16, z: z + (r() - 0.5) * 16, w, d, h, y0: groundY });
      }
    }
    for (const s of sets) {
      const geo = mergedBlocks(s.boxes);
      const m = std("#ffffff", { map: s.tx.map, emissiveMap: s.tx.emissive, emissive: new THREE.Color("#000000"), roughness: 0.8 });
      this.mats.push(m);
      const me = new THREE.Mesh(geo, m); me.receiveShadow = false; me.castShadow = false; this.root.add(me);
    }
    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), std("#1c1e28", { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = groundY; this.root.add(ground);
    // elevated highway full of stopped cars (x ≈ 168)
    const hw = new THREE.Group(); hw.position.set(168, groundY + 14, 0); this.root.add(hw);
    hw.add(new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 1400), std("#4a4d58", { roughness: 0.9 })));
    for (const sx of [-12, 12]) hw.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 1400), std("#6a6d78")).translateX(sx).translateY(1.1));
    for (let z = -600; z < 600; z += 40) hw.add(new THREE.Mesh(new THREE.BoxGeometry(3, 14, 3), std("#3a3d48")).translateY(-7).translateZ(z));
    for (let i = 0; i < 110; i++) {
      const c = car(1000 + i);
      const lane = Math.floor(r() * 4);
      c.position.set(-9 + lane * 6 + (r() - 0.5), 0.6, -560 + r() * 1120);
      c.rotation.y = (lane < 2 ? 1 : -1) * Math.PI / 2 + (r() - 0.5) * 0.15;
      c.scale.setScalar(1.15);
      hw.add(c);
    }
    // a river of tail lights would mean traffic; a few hazard lights only
    for (let i = 0; i < 6; i++) {
      const m = glow("#ff7a20", 3); this.carLights.push(m);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), m); l.position.set(-9 + (i % 4) * 6, 1.3, -300 + i * 97); hw.add(l);
    }
  }
  setNight(n: number, t: number) {
    for (const m of this.mats) { m.emissive.setScalar(n * 1.6); m.color.setScalar(1 - 0.55 * n); }
    this.carLights.forEach((m) => m.color.setRGB(1, 0.48, 0.12).multiplyScalar(1.6 * (0.3 + n)));   // steady: nothing blinks (story rule 1)
    void t;
  }
}
