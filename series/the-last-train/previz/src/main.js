import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';
import { makeCast, frameState, setTiming, FPS, worldOf, eyeWorld } from './shots.js';
import { drawOverlay } from './overlay.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 720), H = +(q.get('h') || 1280);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, W / H, 0.02, 140);
const cam2 = new THREE.PerspectiveCamera(40, W / H, 0.02, 140);
const world = buildWorld(scene);
const fills = [cam].map((c) => { const l = new THREE.PointLight(0xffffff, 0, 5, 2); l.position.set(-0.35, 0.3, 0.2); c.add(l); scene.add(c); return l; });
const cast = makeCast(scene);
const FOG = { A: [0x0b1719, 0.032], Ahit: [0x1c0606, 0.04], C: [0x170506, 0.03] };
scene.fog = new THREE.FogExp2(0x0b1719, 0.03);

const Grade = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 }, uGrain: { value: 0.035 }, uSat: { value: 0.92 }, uFade: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0.012, 0.02, 0.026) }, uAspect: { value: W / H } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVig,uGrain,uSat,uFade,uAspect; uniform vec3 uTint,uLift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, uSat);
      c = c*uTint + uLift*(1.0-c); vec2 d = vUv-0.5; d.x *= uAspect; float v = smoothstep(0.78, 0.18, length(d)); c *= mix(1.0, v, uVig);
      c += (h(vUv*vec2(1733.,977.)+uTime)-0.5)*uGrain; c = clamp(c,0.,1.)*(1.0-uFade); gl_FragColor = vec4(c,1.0); }`,
};
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
const rp = new RenderPass(scene, cam); composer.addPass(rp);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.78); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(Grade); composer.addPass(grade);

const outC = document.createElement('canvas'); outC.width = W; outC.height = H; const g = outC.getContext('2d');
let timing = [];

function applySet(st, t) {
  world.A.visible = st.set === 'A'; world.C.visible = st.set === 'C';
  const k = st.set === 'C' ? 'C' : (t >= 29.0 ? 'Ahit' : 'A');
  scene.fog.color.setHex(FOG[k][0]); scene.fog.density = FOG[k][1]; scene.background = new THREE.Color(FOG[k][0]);
  grade.uniforms.uTint.value.set(...(k === 'A' ? [0.94, 1.02, 1.03] : [1.04, 0.96, 0.95]));
  const fc = { A: [0xbfe8e4, 1.1], Ahit: [0xff8a80, 1.3], C: [0xff9a8a, 1.6] }[k]; for (const l of fills) { l.color.setHex(fc[0]); l.intensity = fc[1]; }
}
function kick(c, amt) {
  if (!amt) return; const r = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion); c.position.addScaledVector(r, amt * 0.03); c.rotateZ(amt * 0.012);
}
function renderTo(c) { rp.camera = c; composer.render(); }

window.PV = {
  W, H, ready: false,
  probe(f) { frameState(f / FPS, world, cast, cam); const v = (o) => o.toArray().map((x) => +x.toFixed(3)); return { commHand: v(worldOf(cast.comm.armR.hand)), commPhone: v(worldOf(cast.commPhone)), commHead: v(worldOf(cast.comm.head)), kaiEyes: v(eyeWorld(cast.kai)), cam: v(cam.position) }; },
  setTiming(tm) { timing = tm; setTiming(tm); },
  frame(f) {
    const t = f / FPS;
    const st = frameState(t, world, cast, cam);
    applySet(st, t); kick(cam, st.kick);
    renderer.toneMappingExposure = 1.1 * (st.dim ?? 1);
    world.spots.forEach((l, i) => { const sp = st.spots && st.spots[i]; l.intensity = sp ? 10 : 0; if (sp) l.position.set(sp[0], 2.4, sp[1]); });
    grade.uniforms.uTime.value = f * 0.37; grade.uniforms.uFade.value = 0;
    renderTo(cam);
    g.drawImage(renderer.domElement, 0, 0);
    if (st.split) {
      const p = Math.min(1, (t - 82.6) * FPS / 10); const e = p * p * (3 - 2 * p);
      g.fillStyle = `rgba(0,0,0,${0.55 * e})`; g.fillRect(0, 0, W, H);
      for (const [side, fn] of [['left', st.split.left], ['right', st.split.right]]) {
        fn(cam2); cam2.aspect = W / H; cam2.updateProjectionMatrix(); applySet({ set: 'C' }, 70); renderer.toneMappingExposure = 1.1;
        renderTo(cam2);
        const off = side === 'left' ? -W / 2 * (1 - e) : W / 2 * (1 - e);
        g.drawImage(renderer.domElement, W / 4, 0, W / 2, H, (side === 'left' ? 0 : W / 2) + off, 0, W / 2, H);
      }
      cast.kaiScreen.draw('lucy_calling');
      st.phoneCanvas = cast.kaiScreen.c; st.splitP = e;
    }
    if (st.black) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    drawOverlay(g, W, H, t, st, timing);
    return outC.toDataURL('image/jpeg', 0.93);
  },
};
fetch('out/vo_timing.json').then(r => r.ok ? r.json() : []).catch(() => []).then(tm => { window.PV.setTiming(tm); window.PV.ready = true; });
