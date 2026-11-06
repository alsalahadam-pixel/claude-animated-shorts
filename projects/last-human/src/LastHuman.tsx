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
import { SHOTS, shotAt, FPS, TOTAL, Shot, PHOTO_SHOT, FILM_END, PROMPT_AT, FINAL, FINAL_TOTAL, finalAt } from "./story";
import captions from "./data/captions.json";
import captionsFinal from "./data/captions_final.json";

export const LAST_HUMAN_FRAMES = TOTAL;
export const FINAL_FRAMES = FINAL_TOTAL;

const GRADES: Record<Shot["grade"], GradeParams> = {
  warm: { ky: [0, 0.085, 0.25, 0.55, 0.8, 0.93, 1], sat: [1.0, 1.08, 1.05], tintS: [0.024, 0.006], tintM: [0.004, 0.002], tintH: [-0.014, 0.01], vig: [0.32, 0.32] },
  cool: { ky: [0, 0.085, 0.24, 0.52, 0.78, 0.92, 1], sat: [0.82, 0.88, 0.9], tintS: [0.018, -0.014], tintM: [0.008, -0.012], tintH: [0.0, -0.004], vig: [0.32, 0.32] },
  dusk: { ky: [0, 0.08, 0.24, 0.54, 0.8, 0.93, 1], sat: [1.0, 1.1, 1.08], tintS: [0.024, 0.012], tintM: [0.0, 0.004], tintH: [-0.016, 0.012], vig: [0.34, 0.32] },
  // night: deeper shadows and a heavier vignette (darker, more unsettling), mids kept so faces still read on a phone
  night: { ky: [0, 0.072, 0.215, 0.5, 0.775, 0.925, 1], sat: [0.96, 1.08, 1.06], tintS: [0.032, 0.012], tintM: [0.012, 0.002], tintH: [0.0, 0.0], vig: [0.52, 0.24] },
};

class ExposureEffect extends Effect {
  constructor() {
    super("ExposureEffect", `uniform float exposure; void mainImage(const in vec4 c, const in vec2 uv, out vec4 o) { o = vec4(c.rgb * exposure, c.a); }`,
      { blendFunction: BlendFunction.NORMAL, uniforms: new Map([["exposure", new THREE.Uniform(1)]]) });
  }
  set exposure(v: number) { this.uniforms.get("exposure")!.value = v; }
}
const EXPOSURE: Record<string, number> = { S01: 1.32, S02: 1.1, S03: 1.1, S04: 1.0, S05: 1.1, S06: 1.0, S07: 1.1, S08: 1.0, S09: 1.32, S10: 1.27, S11: 1.2, S12: 1.32, S13: 1.38, S13B: 1.38, S14: 1.36, S15: 1.35, S16: 1.36, S17: 1.24, S18: 1.25, S19: 1.24, S20: 1.48, S21: 1.32, END: 1,
  HOOKCAM: 1.32, P1: 1.1, PIGEON: 1.0, E1: 1.32, E2: 1.3, E3: 1.4 };

type Toggles = { lens: boolean; bloom: boolean; grade: boolean; grain: boolean; msaa: number };
const toggles = (): Toggles => ({ lens: true, bloom: true, grade: true, grain: true, msaa: 4, ...((getInputProps() as { post?: Partial<Toggles> }).post ?? {}) });

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

/** the final cut: final frame -> (source shot, source frame, camera/dof overrides) */
const resolveFinal = (F: number) => {
  const fs = finalAt(F);
  const re = fs.reuse ? SHOTS.find((x) => x.id === fs.reuse) : undefined;
  const src = fs.src ?? re ?? SHOTS[0];
  const f = (fs.from ?? re?.a ?? 0) + (F - fs.a);
  return { shot: { ...src, cam: fs.cam ?? src.cam, dof: fs.dof ?? src.dof }, f };
};

const Inner: React.FC<{ photo: THREE.Texture | null; override?: Shot; final?: boolean }> = ({ photo, override, final }) => {
  const F = useCurrentFrame();
  const R = final ? resolveFinal(F) : null;
  const f = R ? R.f : F;
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

  const shot = R ? R.shot : override ?? shotAt(f);
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
  fx.grain.seed = F;
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
  m.map = t; m.color.setScalar(1.25); m.needsUpdate = true; m.userData.done = true; world.photoUi = t;
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
  // face close-ups (S02 pillow, S05 at the glass, S11 his face, S18 the phone, S19): captions sit low, off the face
  const low = (f >= 144 && f < 216) || (f >= 342 && f < 402) || (f >= 813 && f < 849) || (f >= 1437 && f < 1635);
  const top = low ? 1600 : 1180;
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

// ---------------------------------------------------------------- the final cut
// Two passes: FinalPlate is the 3D picture only (no text), FinalOverlay is every word on screen, on transparency.

/** 3D only. Reused and black shots are not rendered from here (they come from the V3 chunks and ffmpeg). */
export const FinalPlate: React.FC = () => {
  const photo = usePhoto();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }} camera={{ fov: 36, near: 0.05, far: 2000 }}>
        <Inner photo={photo} final />
      </ThreeCanvas>
      {finalAt(useCurrentFrame()).black && <AbsoluteFill style={{ background: "#000" }} />}
    </AbsoluteFill>
  );
};

const CAPS_F = captionsFinal as Cap[];
const shotRange = (id: string) => { const s = FINAL.find((x) => x.id === id)!; return [s.a, s.b] as const; };
// captions sit low (off the face) on the face close-ups and the phone
const LOW_F = ["F_S02", "F_S05", "F_P1", "F_S11", "F_S18", "F_S19", "F_E2", "F_E3"].map(shotRange);
const SHOUT_T = 7.25;
const ECHO_T = [SHOUT_T + 1.05, SHOUT_T + 1.5, SHOUT_T + 1.9];

const CaptionsFinal: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const echoes = ECHO_T.map((e, i) => ({ e, i })).filter(({ e }) => t >= e && t < e + 0.5);
  if (echoes.length) {
    const { e, i } = echoes[echoes.length - 1];
    const a = interpolate(t - e, [0, 0.08, 0.5], [0, 1, 0], { extrapolateRight: "clamp" }) * [0.8, 0.55, 0.35][i];
    const lowE = LOW_F.some(([a0, b0]) => f >= a0 && f < b0);
    return <div style={{ position: "absolute", top: lowE ? 1600 : 1180, left: 0, right: 0, textAlign: "center", opacity: a, fontFamily: "Montserrat", fontWeight: 800, fontSize: [62, 52, 42][i], color: "#ffffff", textTransform: "lowercase", ...STROKE }}>hello…</div>;
  }
  const cap = CAPS_F.find((c) => t >= c.s && t < c.e);
  if (!cap) return null;
  const age = (t - cap.s) * FPS;
  if (cap.kind === "shout") {
    const sc = interpolate(age, [0, 3, 8], [1.35, 1.06, 1], { extrapolateRight: "clamp" });
    return <div style={{ position: "absolute", top: 1150, left: 0, right: 0, textAlign: "center", transform: `scale(${sc})`, fontFamily: "Montserrat", fontWeight: 800, fontSize: 118, color: "#ffb35c", ...STROKE }}>HELLO?!</div>;
  }
  const pop = interpolate(age, [0, 4], [0.86, 1], { extrapolateRight: "clamp" });
  const low = LOW_F.some(([a, b]) => f >= a && f < b);
  // the last two lines: smaller, slower, no pop, no orange
  const ending = cap.s > 95;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: ending && low ? 1690 : low ? 1600 : 1180, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 22px", transform: `scale(${ending ? 1 : pop})`, transformOrigin: "50% 50%", opacity: ending ? interpolate(t, [cap.words[cap.words.length - 1].e + 0.02, cap.words[cap.words.length - 1].e + 0.22], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1 }}>
      {cap.words.map((w, i) => {
        const active = t >= w.s - 0.03 && (t < w.e || i === cap.words.length - 1);
        const spoken = t >= w.s - 0.03;
        return (
          <span key={i} style={{
            fontFamily: "Montserrat", fontWeight: 800, fontSize: ending ? 68 : 76, lineHeight: 1.12, letterSpacing: ending ? 2 : 0.5, textTransform: "uppercase",
            color: ending ? "#ffffff" : active ? "#ffb35c" : spoken ? "#ffffff" : "rgba(255,255,255,0.92)", ...STROKE,
            opacity: ending ? interpolate(t, [w.s - 0.03, w.s + 0.15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1,
            transform: active && !ending ? "translateY(-3px) scale(1.06)" : "none", display: "inline-block",
          }}>{w.w}</span>
        );
      })}
    </div>
  );
};

/** elapsed time since everyone vanished: the day and how long he has been awake */
const at = (id: string, d0: number, d1: number): [number, number] => { const [a] = shotRange(id); return [a + d0, a + d1]; };
const LABELS_F: [[number, number], string, string][] = [
  [at("F_P1", 4, 80), "DAY 1", "0 HOURS AWAKE"],
  [at("F_S06", 4, 80), "DAY 2", "29 HOURS AWAKE"],
  [at("F_S01", 30, 110), "DAY 3", "68 HOURS AWAKE"],
  [at("F_S17", 6, 66), "", "69 HOURS AWAKE"],
];
const LabelFinal: React.FC<{ f: number }> = ({ f }) => {
  const L = LABELS_F.find(([[a, b]]) => f >= a && f < b);
  if (!L) return null;
  const [[a, b], day, hrs] = L;
  const o = interpolate(f, [a, a + 6, b - 8, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const st: React.CSSProperties = { fontFamily: "JetBrains Mono", fontWeight: 500, color: "#f2efe9", letterSpacing: 3, textShadow: "0 2px 10px rgba(0,0,0,0.85)" };
  return (
    <div style={{ position: "absolute", top: 150, left: 70, opacity: o }}>
      {day && <div style={{ ...st, fontSize: 40 }}>{day}</div>}
      <div style={{ ...st, fontSize: 30, color: "#ffb35c", marginTop: 6 }}>{hrs}</div>
    </div>
  );
};

/** the title: cut in hard on the boom, a faint tremor, then gone. At the end it fades up slowly out of the black. */
const TitleFinal: React.FC<{ f: number }> = ({ f }) => {
  const [a1, b1] = shotRange("TITLE1"), [a2, b2] = shotRange("TITLE2");
  const first = f >= a1 && f < b1, last = f >= a2 && f < b2;
  if (!first && !last) return null;
  const age = first ? f - a1 : f - a2;
  const o = first ? interpolate(age, [0, 1, 50, 60], [0, 1, 1, 0], { extrapolateRight: "clamp" }) : interpolate(age, [0, 30, 78, 90], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const jx = first && age < 10 ? Math.sin(age * 7.3) * (10 - age) * 0.5 : 0;
  const sc = first ? interpolate(age, [0, 60], [1.0, 1.04]) : interpolate(age, [0, 90], [1.02, 1.0]);
  const line: React.CSSProperties = { fontFamily: "Anton", fontSize: 150, lineHeight: 1.0, letterSpacing: 6, color: "#f2efe9", textAlign: "center" };
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ transform: `translateX(${jx}px) scale(${sc})` }}>
        <div style={{ ...line, fontSize: 92, letterSpacing: 26, color: "#cfcad8" }}>THE</div>
        <div style={line}>LAST HUMAN</div>
        <div style={{ ...line, color: "#ffb35c" }}>ALIVE</div>
      </div>
    </AbsoluteFill>
  );
};

/** after the title: "PART 2?" fades up out of the black and stays to the last frame; the "?" flickers once */
const Part2: React.FC<{ f: number }> = ({ f }) => {
  const [a] = shotRange("PART2");
  if (f < a) return null;
  const age = f - a;
  const o = interpolate(age, [6, 24], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const q = age >= 46 && age < 49 ? 0.15 : 1;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ fontFamily: "Anton", fontSize: 128, letterSpacing: 18, color: "#f2efe9" }}>
        PART 2<span style={{ color: "#ffb35c", opacity: q }}>?</span>
      </div>
    </AbsoluteFill>
  );
};

/** every word on screen, on a transparent background (composited over the plates in ffmpeg) */
export const FinalOverlay: React.FC = () => {
  const f = useCurrentFrame();
  useFonts();
  return (
    <AbsoluteFill>
      <LabelFinal f={f} />
      <CaptionsFinal f={f} />
      <TitleFinal f={f} />
      <Part2 f={f} />
    </AbsoluteFill>
  );
};

/** preview of the whole final cut in one composition (plates for every shot, reused ones re-rendered live) */
export const FinalPreview: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <FinalPlate />
    <FinalOverlay />
  </AbsoluteFill>
);
