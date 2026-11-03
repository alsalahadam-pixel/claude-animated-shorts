// "Home Was Nagasaki": the Yamaguchi short. One three.js world (world.ts) posed per frame from the timeline (story.ts).
// Post chain from the bridge short: InkPass -> lens blur pre + main -> bloom -> NEUTRAL tone map -> grade, then FXAA.
// No MSAA: in software GL it costs more than everything else together (7.5 -> 3.1 s/frame); the ink pass has its own
// tent filter and FXAA cleans the remaining geometry edges. Place changes crossfade by stacking a second canvas; the
// hook ends on a 4-frame white flash; the two bombs are full white-outs (DOM overlay, timed in story.ts).
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode, FXAAEffect } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt, whiteAt } from "./story";

export const YAMA_FRAMES = TOTAL;

type PostToggles = { ink: boolean; lens: boolean; bloom: boolean; grade: boolean; fxaa: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, bloom: true, grade: true, fxaa: false, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("yama kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, 1),
    fxaa: new FXAAEffect(),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  fx.lens.dist = fx.ink.distRT.texture;
  const post = useMemo(() => {
    const list: [boolean, object][] = [[on.ink, fx.ink], [on.lens, fx.lens.pre], [on.lens, fx.lens.main], [on.bloom, fx.bloom], [true, fx.tone], [on.grade, fx.grade], [on.fxaa, fx.fxaa]];
    return <EffectComposer multisampling={0}>{list.filter(([k]) => k).map(([, o], i) => <primitive key={i} object={o} dispose={null} />)}</EffectComposer>;
  }, [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  const target = world.update(id, f, cam, scene);
  noInkFallback(world.root);
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.12, far: 2200 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const YamaShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  const white = Math.max(flash, whiteAt(f));
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {white < 0.999 && layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {white > 0 && <AbsoluteFill style={{ background: "#fffaf0", opacity: white }} />}
    </AbsoluteFill>
  );
};
