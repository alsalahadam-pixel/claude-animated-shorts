// The film: one three.js world posed per frame from story.ts, a manual post chain, and HTML overlays
// (title, word-highlighted captions, dips to black, end card).
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, Effect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import "@fontsource/montserrat/800.css";
import "@fontsource/anton/400.css";
import { useComposer } from "./post/Composer";
import { LensBlur, GrainEffect } from "./post/lensblur";
import { GradeEffect, GradeParams } from "./post/grade";
import { World } from "./world/World";
import { SHOTS, shotAt, FPS, TOTAL, Shot, PHOTO_SHOT } from "./story";
import captions from "./data/captions.json";

export const LAST_HUMAN_FRAMES = TOTAL;

const GRADES: Record<Shot["grade"], GradeParams> = {
  warm: { ky: [0, 0.085, 0.25, 0.55, 0.8, 0.93, 1], sat: [1.0, 1.08, 1.05], tintS: [0.024, 0.006], tintM: [0.004, 0.002], tintH: [-0.014, 0.01], vig: [0.32, 0.32] },
  cool: { ky: [0, 0.085, 0.24, 0.52, 0.78, 0.92, 1], sat: [0.82, 0.88, 0.9], tintS: [0.018, -0.014], tintM: [0.008, -0.012], tintH: [0.0, -0.004], vig: [0.32, 0.32] },
  dusk: { ky: [0, 0.08, 0.24, 0.54, 0.8, 0.93, 1], sat: [1.0, 1.1, 1.08], tintS: [0.024, 0.012], tintM: [0.0, 0.004], tintH: [-0.016, 0.012], vig: [0.34, 0.32] },
  night: { ky: [0, 0.09, 0.245, 0.53, 0.79, 0.93, 1], sat: [1.05, 1.12, 1.08], tintS: [0.03, 0.006], tintM: [0.012, 0.0], tintH: [0.0, 0.0], vig: [0.42, 0.28] },
};

class ExposureEffect extends Effect {
  constructor() {
    super("ExposureEffect", `uniform float exposure; void mainImage(const in vec4 c, const in vec2 uv, out vec4 o) { o = vec4(c.rgb * exposure, c.a); }`,
      { blendFunction: BlendFunction.NORMAL, uniforms: new Map([["exposure", new THREE.Uniform(1)]]) });
  }
  set exposure(v: number) { this.uniforms.get("exposure")!.value = v; }
}
const EXPOSURE: Record<string, number> = { "1a": 1.1, "1b": 1.1, "2a": 1.0, "2b": 1.15, "3a": 1.0, "3b": 1.1, "3c": 1.0, "4a": 1.35, "4b": 1.35, "4c": 1.35, "4d": 1.25, "5a": 1.4, "5b": 1.4, "5c": 1.4, "6a": 1.45, "6b": 1.3, "6c": 1.3, "7a": 1.3, "7b": 1.4, "7c": 1 };

type Toggles = { lens: boolean; bloom: boolean; grade: boolean; grain: boolean; msaa: number };
const toggles = (): Toggles => ({ lens: true, bloom: true, grade: true, grain: true, msaa: 4, ...((getInputProps() as { post?: Partial<Toggles> }).post ?? {}) });

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ photo: THREE.Texture | null; override?: Shot }> = ({ photo, override }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const world = useMemo(() => new World(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => {
    const bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.75, luminanceThreshold: 0.95, luminanceSmoothing: 0.25, mipmapBlur: true, levels: 7, radius: 0.7 });
    const mip = bloom.mipmapBlurPass; const setSize = mip.setSize.bind(mip);
    mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
    return {
      lens: new LensBlur({ maxCoC: 22, nearScale: 1.2 }), bloom, exp: new ExposureEffect(),
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), grade: new GradeEffect(GRADES.night, 1),
      grain: new GrainEffect({ amount: 0.016, cellPx: 1.6 }),
    };
  }, []);
  useEffect(() => { gl.toneMapping = THREE.NoToneMapping; gl.shadowMap.type = THREE.PCFSoftShadowMap; }, [gl]);
  useMemo(() => { scene.fog = world.fog; scene.add(world.scene); }, [scene, world]);
  useComposer([
    ...(on.lens ? [fx.lens.pre, fx.lens.main] : []),
    [...(on.bloom ? [fx.bloom] : []), fx.exp, fx.tone, ...(on.grade ? [fx.grade] : []), ...(on.grain ? [fx.grain] : [])],
  ], { msaa: on.msaa });
  if (photo) applyPhoto(world, photo);

  const shot = override ?? shotAt(f);
  const cam = camera as THREE.PerspectiveCamera;
  world.setLook(shot.look, f / FPS, f);
  scene.environment = world.envFor(shot.look, gl);
  scene.environmentIntensity = shot.look === "night" ? 0.9 : shot.look === "overcast" || shot.look === "dusk" ? 0.6 : 0.22;
  const c = shot.cam(f);
  cam.position.set(...c.pos);
  cam.up.set(...(c.up ?? [0, 1, 0]));
  cam.fov = c.fov; cam.near = 0.05; cam.far = 2000;
  cam.lookAt(...c.look);
  if (c.roll) cam.rotateZ((c.roll * Math.PI) / 180);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  shot.act(f, world, cam);
  world.scene.updateMatrixWorld(true);
  const d = shot.dof(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus); else fpt.set(...c.look);
  fx.lens.focus = Math.max(0.2, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  fx.exp.exposure = override ? 1.25 : EXPOSURE[shot.id] ?? 1;
  if (override) fx.grain.amount = 0.05;
  const gtag = fx.grade as unknown as { _g?: string };
  if (gtag._g !== shot.grade) { fx.grade.set(GRADES[shot.grade]); gtag._g = shot.grade; }
  fx.grain.seed = f;
  return null;
};

/** phone screen: the photo with a message UI around it */
function applyPhoto(world: World, photo: THREE.Texture) {
  const m = world.phoneScreen.material as THREE.MeshBasicMaterial;
  if (m.userData.done) return;
  const img = photo.image as HTMLImageElement;
  const c = document.createElement("canvas"); c.width = 680; c.height = 1460;
  const x = c.getContext("2d")!;
  x.fillStyle = "#07080d"; x.fillRect(0, 0, 680, 1460);
  x.fillStyle = "#e8ecf4"; x.font = "600 34px sans-serif"; x.fillText("3:14", 40, 60);
  x.fillStyle = "#1a1d2a"; x.fillRect(0, 100, 680, 120);
  x.fillStyle = "#3a3f55"; x.beginPath(); x.arc(80, 160, 34, 0, 7); x.fill();
  x.fillStyle = "#e8ecf4"; x.font = "700 38px sans-serif"; x.fillText("Unknown", 136, 152);
  x.fillStyle = "#8a90a8"; x.font = "400 26px sans-serif"; x.fillText("now", 136, 190);
  const pw = 600, ph = (pw * img.height) / img.width;
  x.drawImage(img, 40, 300, pw, ph);
  x.strokeStyle = "#2a2e3e"; x.lineWidth = 4; x.strokeRect(40, 300, pw, ph);
  x.fillStyle = "#8a90a8"; x.font = "400 26px sans-serif"; x.fillText("Photo · 3:14 AM", 40, 300 + ph + 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  m.map = t; m.color.setScalar(1.25); m.needsUpdate = true; m.userData.done = true;
}

const usePhoto = () => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [h] = useState(() => delayRender("photo"));
  useEffect(() => {
    new THREE.TextureLoader().load(staticFile("photo.jpg"), (t) => { t.colorSpace = THREE.SRGBColorSpace; setTex(t); continueRender(h); }, undefined, () => continueRender(h));
  }, [h]);
  return tex;
};

const useFonts = () => {
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => { Promise.all([document.fonts.load('800 60px "Montserrat"'), document.fonts.load('400 60px "Anton"')]).then(() => continueRender(h)); }, [h]);
};

// ---------------------------------------------------------------- overlays
type Cap = { s: number; e: number; words: { w: string; s: number; e: number }[] };
const CAPS = captions as Cap[];

const Captions: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const cap = CAPS.find((c) => t >= c.s && t < c.e);
  if (!cap || f >= 1767) return null;
  const age = (t - cap.s) * FPS;
  const pop = interpolate(age, [0, 4], [0.86, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1180, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 22px", transform: `scale(${pop})`, transformOrigin: "50% 50%" }}>
      {cap.words.map((w, i) => {
        const active = t >= w.s - 0.03 && (t < w.e || i === cap.words.length - 1);
        const spoken = t >= w.s - 0.03;
        return (
          <span key={i} style={{
            fontFamily: "Montserrat", fontWeight: 800, fontSize: 76, lineHeight: 1.12, letterSpacing: 0.5, textTransform: "uppercase",
            color: active ? "#ffb35c" : spoken ? "#ffffff" : "rgba(255,255,255,0.92)",
            WebkitTextStroke: "11px #07060c", paintOrder: "stroke fill",
            textShadow: "0 6px 18px rgba(0,0,0,0.65)", transform: active ? "translateY(-3px) scale(1.06)" : "none", display: "inline-block",
          }}>{w.w}</span>
        );
      })}
    </div>
  );
};

const Title: React.FC<{ f: number }> = ({ f }) => {
  if (f > 140) return null;
  const a = interpolate(f, [0, 4, 120, 140], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flick = f < 14 && (f % 4 === 1) ? 0.35 : 1;
  const b = interpolate(f, [26, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const st: React.CSSProperties = { fontFamily: "Anton", textTransform: "uppercase", WebkitTextStroke: "8px #07060c", paintOrder: "stroke fill", textShadow: "0 6px 24px rgba(0,0,0,0.7)", lineHeight: 1.04, textAlign: "center" };
  return (
    <div style={{ position: "absolute", top: 190, left: 50, right: 50, opacity: a * flick }}>
      <div style={{ ...st, fontSize: 96, color: "#f4f1ec" }}>You're the last<br />human alive…</div>
      <div style={{ ...st, fontSize: 66, color: "#ff8a4a", marginTop: 18, opacity: b }}>but something is<br />watching you.</div>
    </div>
  );
};

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  if (f < 1767) return null;
  const k = f - 1767;
  const a = interpolate(k, [3, 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const jit = k < 12 && k % 3 === 0 ? 6 : 0;
  // "PART 2?" glitches in at 60.0 s (frame 1800) and holds to the end
  const p = f - 1800;
  const pa = p < 0 ? 0 : p < 2 ? 0.6 : p === 3 ? 0.2 : 1;
  const pj = p >= 0 && p < 10 && p % 3 !== 1 ? (p % 2 ? -10 : 8) : 0;
  const scale = p < 0 ? 1 : interpolate(p, [0, 6], [1.25, 1], { extrapolateRight: "clamp" });
  const lift = p < 0 ? 0 : interpolate(p, [0, 8], [0, -220], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#020205", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: a * (p >= 0 ? 0.55 : 1), transform: `translate(${jit}px, ${lift}px) scale(${p >= 0 ? 0.8 : 1})`, fontFamily: "Anton", fontSize: 92, lineHeight: 1.05, color: "#f2efe9", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>
        Something<br />is watching<br /><span style={{ color: "#ff5a3a" }}>you.</span>
      </div>
      {p >= 0 && (
        <div style={{ position: "absolute", top: 1060, left: 0, right: 0, textAlign: "center", opacity: pa, transform: `translateX(${pj}px) scale(${scale})` }}>
          <div style={{ fontFamily: "Anton", fontSize: 210, lineHeight: 1, color: "#ff8a3a", letterSpacing: 4, WebkitTextStroke: "6px #07060c", paintOrder: "stroke fill",
            textShadow: `${pj ? 10 : 0}px 0 0 rgba(63,240,224,0.75), ${pj ? -10 : 0}px 0 0 rgba(255,60,90,0.75), 0 0 40px rgba(255,120,40,0.45)` }}>PART 2?</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** dips to black where time jumps */
const dipAt = (f: number) => {
  const dips: [number, number][] = [[360, 5], [1260, 5]];
  let a = 0;
  for (const [c, r] of dips) a = Math.max(a, 1 - Math.min(1, Math.abs(f - c + 0.5) / r));
  return a;
};

export const LastHuman: React.FC = () => {
  const f = useCurrentFrame();
  const photo = usePhoto();
  useFonts();
  const t = f / FPS;
  const dip = dipAt(f);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }} camera={{ fov: 36, near: 0.05, far: 2000 }}>
        <Inner photo={photo} />
      </ThreeCanvas>
      {dip > 0 && <AbsoluteFill style={{ background: "#000", opacity: dip }} />}
      <Title f={f} />
      <Captions t={t} f={f} />
      <EndCard f={f} />
    </AbsoluteFill>
  );
};

export { SHOTS };

/** the creepy photo shown on his phone (rendered once to public/photo.jpg) */
export const Photo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <ThreeCanvas width={1080} height={1440} shadows gl={{ antialias: false, stencil: false }} camera={{ fov: 58, near: 0.05, far: 2000 }}>
      <Inner photo={null} override={PHOTO_SHOT} />
    </ThreeCanvas>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 55% 55%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.65) 100%)" }} />
    <div style={{ position: "absolute", right: 48, bottom: 40, fontFamily: "monospace", fontSize: 44, color: "#ff9a3a", textShadow: "0 0 8px rgba(255,120,40,0.8)" }}>03:14</div>
  </AbsoluteFill>
);
