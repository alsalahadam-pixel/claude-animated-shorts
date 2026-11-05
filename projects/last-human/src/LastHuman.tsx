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
import "@fontsource/jetbrains-mono/500.css";
import { useComposer } from "./post/Composer";
import { LensBlur, GrainEffect } from "./post/lensblur";
import { GradeEffect, GradeParams } from "./post/grade";
import { World } from "./world/World";
import { SHOTS, shotAt, FPS, TOTAL, Shot, PHOTO_SHOT, FILM_END, PROMPT_AT } from "./story";
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
const EXPOSURE: Record<string, number> = { S01: 1.4, S02: 1.1, S03: 1.1, S04: 1.0, S05: 1.1, S06: 1.0, S07: 1.1, S08: 1.0, S09: 1.4, S10: 1.35, S11: 1.25, S12: 1.4, S13: 1.45, S14: 1.45, S15: 1.4, S16: 1.45, S17: 1.3, S18: 1.25, S19: 1.3, S20: 1.55, S21: 1.35, END: 1 };

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

/** phone screen: a message from "Me" with the photo. No clock time anywhere (story rule 1): only "1 min ago". */
function applyPhoto(world: World, photo: THREE.Texture) {
  const m = world.phoneScreen.material as THREE.MeshBasicMaterial;
  if (m.userData.done) return;
  const img = photo.image as HTMLImageElement;
  const c = document.createElement("canvas"); c.width = 680; c.height = 1460;
  const x = c.getContext("2d")!;
  x.fillStyle = "#07080d"; x.fillRect(0, 0, 680, 1460);
  x.fillStyle = "#8a90a8"; x.font = "500 28px sans-serif"; x.fillText("No Service", 36, 58);
  x.strokeStyle = "#8a90a8"; x.lineWidth = 3; x.strokeRect(586, 38, 54, 24); x.fillStyle = "#8a90a8"; x.fillRect(590, 42, 16, 16);
  x.fillStyle = "#151824"; x.fillRect(0, 96, 680, 136);
  // avatar: a crop of the photo itself (his own face)
  x.save(); x.beginPath(); x.arc(92, 164, 44, 0, 7); x.clip();
  x.drawImage(img, img.width * 0.3, img.height * 0.28, img.width * 0.42, img.width * 0.42, 48, 120, 88, 88); x.restore();
  x.fillStyle = "#eef1f8"; x.font = "700 46px sans-serif"; x.fillText("Me", 158, 160);
  x.fillStyle = "#8a90a8"; x.font = "400 28px sans-serif"; x.fillText("1 min ago", 158, 200);
  const pw = 620, ph = (pw * img.height) / img.width;
  x.save(); x.beginPath(); x.roundRect(30, 280, pw, ph, 26); x.clip(); x.drawImage(img, 30, 280, pw, ph); x.restore();
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
  useEffect(() => { Promise.all([document.fonts.load('800 60px "Montserrat"'), document.fonts.load('400 60px "Anton"'), document.fonts.load('500 40px "JetBrains Mono"')]).then(() => continueRender(h)); }, [h]);
};

// ---------------------------------------------------------------- overlays
type Cap = { s: number; e: number; kind?: string; words: { w: string; s: number; e: number }[] };
const CAPS = captions as Cap[];
const STROKE: React.CSSProperties = { WebkitTextStroke: "11px #07060c", paintOrder: "stroke fill", textShadow: "0 6px 18px rgba(0,0,0,0.65)" };

const Captions: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  if (f >= FILM_END) return null;
  const cap = CAPS.find((c) => t >= c.s && t < c.e);
  // the city throws his shout back: three echoes, each smaller and fainter
  const echoes = [10.4, 10.85, 11.25].map((e, i) => ({ e, i })).filter(({ e }) => t >= e && t < e + 0.5);
  if (echoes.length) {
    const { e, i } = echoes[echoes.length - 1];
    const a = interpolate(t - e, [0, 0.08, 0.5], [0, 1, 0], { extrapolateRight: "clamp" }) * [0.8, 0.55, 0.35][i];
    return <div style={{ position: "absolute", top: 1180, left: 0, right: 0, textAlign: "center", opacity: a, fontFamily: "Montserrat", fontWeight: 800, fontSize: [62, 52, 42][i], color: "#ffffff", textTransform: "lowercase", ...STROKE }}>hello…</div>;
  }
  if (!cap) return null;
  const age = (t - cap.s) * FPS;
  if (cap.kind === "shout") {
    const sc = interpolate(age, [0, 3, 8], [1.35, 1.06, 1], { extrapolateRight: "clamp" });
    return <div style={{ position: "absolute", top: 1150, left: 0, right: 0, textAlign: "center", transform: `scale(${sc})`, fontFamily: "Montserrat", fontWeight: 800, fontSize: 118, color: "#ffb35c", ...STROKE }}>HELLO?!</div>;
  }
  const pop = interpolate(age, [0, 4], [0.86, 1], { extrapolateRight: "clamp" });
  const top = f >= 1437 && f < 1635 ? 1600 : 1180;   // below the photo in S18; under his face in the S19 close-up
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 22px", transform: `scale(${pop})`, transformOrigin: "50% 50%" }}>
      {cap.words.map((w, i) => {
        const active = t >= w.s - 0.03 && (t < w.e || i === cap.words.length - 1);
        const spoken = t >= w.s - 0.03;
        return (
          <span key={i} style={{
            fontFamily: "Montserrat", fontWeight: 800, fontSize: 76, lineHeight: 1.12, letterSpacing: 0.5, textTransform: "uppercase",
            color: active ? "#ffb35c" : spoken ? "#ffffff" : "rgba(255,255,255,0.92)", ...STROKE,
            transform: active ? "translateY(-3px) scale(1.06)" : "none", display: "inline-block",
          }}>{w.w}</span>
        );
      })}
    </div>
  );
};

/** elapsed time only (the world's clocks stopped at 06:12): the day and how long he has been awake */
const LABELS: [number, number, string, string][] = [
  [6, 96, "DAY 3", "68 HOURS AWAKE"], [146, 204, "DAY 1", "0 HOURS AWAKE"], [404, 446, "DAY 2", "29 HOURS AWAKE"],
  [593, 640, "DAY 3", "68 HOURS AWAKE"], [1379, 1425, "", "69 HOURS AWAKE"],
];
const Label: React.FC<{ f: number }> = ({ f }) => {
  const L = LABELS.find(([a, b]) => f >= a && f < b);
  if (!L) return null;
  const [a, b, day, hrs] = L;
  const o = interpolate(f, [a, a + 6, b - 8, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const st: React.CSSProperties = { fontFamily: "JetBrains Mono", fontWeight: 500, color: "#f2efe9", letterSpacing: 3, textShadow: "0 2px 10px rgba(0,0,0,0.85)" };
  return (
    <div style={{ position: "absolute", top: 150, left: 70, opacity: o }}>
      {day && <div style={{ ...st, fontSize: 40 }}>{day}</div>}
      <div style={{ ...st, fontSize: 30, color: "#ffb35c", marginTop: 6 }}>{hrs}</div>
    </div>
  );
};

/** 60.0 s: hard cut to black. Hold black and silence; only then a quiet prompt. */
const EndCard: React.FC<{ f: number }> = ({ f }) => {
  if (f < FILM_END) return null;
  const a = interpolate(f, [PROMPT_AT, PROMPT_AT + 18], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: a, fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: 46, letterSpacing: 10, color: "#cfcad8" }}>PART 2?</div>
    </AbsoluteFill>
  );
};

export const LastHuman: React.FC = () => {
  const f = useCurrentFrame();
  const photo = usePhoto();
  useFonts();
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }} camera={{ fov: 36, near: 0.05, far: 2000 }}>
        <Inner photo={photo} />
      </ThreeCanvas>
      <Label f={f} />
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
  </AbsoluteFill>
);
