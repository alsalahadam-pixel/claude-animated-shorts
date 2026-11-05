// "Home Was Nagasaki" v2: a re-edit of the Yamaguchi short. The world, sets and cast are the v1 ones (a copy, with a
// few v2 additions); this composition plays them through an edit decision list (edl.json, made by
// shorts/yamaguchi_v2/remotion/edl.py): each output frame belongs to one segment that poses one v1 shot at a source
// frame, with an optional v2 camera angle. Crossfades stack a second canvas; white-outs, flashes, kicks, title cards,
// the rewind streaks and the word-timed captions are timed in output frames.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit, CamEx } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, gradeFor } from "./grade";
import { Kit } from "./build";
import { SHOTS, dofAt, camBase, camNamed, CAM2, applyKick, kickOut, Cam, V3 } from "./story";
import EDL_JSON from "./edl.json";

type Seg = { o0: number; o1: number; id: number; s0: number; s1: number; cam?: string; xf?: number; cy?: number };
type Title = { o0: number; o1: number; kind: string; top: string; sub?: string; note?: string };
type Cap = { o0: number; o1: number; w: { t: string; o0: number }[] };
type Edl = { total: number; segs: Seg[]; whites: number[][]; flashes: number[]; kicks: [number, number][]; titles: Title[]; rewind: number[][]; caps: Cap[] };
const EDL = EDL_JSON as unknown as Edl;
export const YAMA2_FRAMES = EDL.total;

const srcOf = (s: Seg, o: number) => s.s0 + ((o - s.o0) * (s.s1 - s.s0)) / (s.o1 - s.o0);
const segIndex = (o: number) => { let i = 0; while (i + 1 < EDL.segs.length && o >= EDL.segs[i + 1].o0) i++; return i; };
/** the segments to draw at output frame o (two while a crossfade runs, centred on the cut) */
const layersAt = (o: number): { seg: Seg; alpha: number }[] => {
  const i = segIndex(o), s = EDL.segs[i], n = EDL.segs[i + 1], p = EDL.segs[i - 1];
  if (n?.xf && o >= n.o0 - n.xf / 2) return [{ seg: s, alpha: 1 }, { seg: n, alpha: (o - (n.o0 - n.xf / 2) + 1) / (n.xf + 1) }];
  if (s.xf && p && o < s.o0 + s.xf / 2) return [{ seg: p, alpha: 1 }, { seg: s, alpha: (o - (s.o0 - s.xf / 2) + 1) / (s.xf + 1) }];
  return [{ seg: s, alpha: 1 }];
};
const whiteAt = (o: number) => {
  let w = 0;
  for (const [a, b, c, d] of EDL.whites) {
    if (o >= a && o < b) w = Math.max(w, ((o - a) / (b - a)) ** 1.6);
    else if (o >= b && o < c) w = 1;
    else if (o >= c && o < d) w = Math.max(w, (1 - (o - c) / (d - c)) ** 2);
  }
  for (const f of EDL.flashes) { const k = Math.floor(o - f); if (k >= 0 && k < 4) w = Math.max(w, [1, 0.75, 0.45, 0.2][k]); }
  return w;
};

type PostToggles = { ink: boolean; lens: boolean; bloom: boolean; grade: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, bloom: true, grade: true, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });
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
  const [handle] = useState(() => delayRender("yama2 kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};
const FONT = "YamaCaption";
const useFont = () => {
  const [handle] = useState(() => delayRender("yama2 font"));
  useEffect(() => {
    const faces = [new FontFace(FONT, `url(${staticFile("fonts/InterDisplay-Black.otf")})`, { weight: "900" }),
      new FontFace(FONT, `url(${staticFile("fonts/Inter-Bold.otf")})`, { weight: "700" })];
    Promise.all(faces.map((f) => f.load())).then((l) => { l.forEach((f) => (document.fonts as unknown as { add: (x: FontFace) => void }).add(f)); continueRender(handle); }, () => continueRender(handle));
  }, [handle]);
};

/** the camera of a segment at source frame f (v2 angle or the shot's own), plus the kick of output frame o */
const camOf = (seg: Seg, f: number, o: number): { ex: CamEx; cInf?: number; focus?: (f: number) => V3 } => {
  const fn = (g: number): Cam => (seg.cam ? camNamed(seg.cam, g) : camBase(seg.id, g));
  const c = applyKick(fn(f), kickOut(o, EDL.kicks));
  const d = seg.cam ? CAM2[seg.cam] : undefined;
  return { ex: { cam: c, key: seg.cam ?? "base", fn, s0: seg.s0, s1: seg.s1 }, cInf: d?.cInf, focus: d?.focus };
};

const Inner: React.FC<{ seg: Seg; kit: Kit; o: number }> = ({ seg, kit, o }) => {
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, 1),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  fx.lens.dist = fx.ink.distRT.texture;
  const post = useMemo(() => {
    const list: [boolean, object][] = [[on.ink, fx.ink], [on.lens, fx.lens.pre], [on.lens, fx.lens.main], [on.bloom, fx.bloom], [true, fx.tone], [on.grade, fx.grade]];
    return <EffectComposer multisampling={0}>{list.filter(([k]) => k).map(([, ob], i) => <primitive key={i} object={ob} dispose={null} />)}</EffectComposer>;
  }, [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  const f = srcOf(seg, o);
  const co = camOf(seg, f, o);
  const target = world.update(seg.id, f, cam, scene, co.ex);
  noInkFallback(world.root);
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  const focus = co.focus ?? (seg.cam ? undefined : d.focus);
  if (focus) fpt.set(...focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = co.cInf ?? (seg.id === 33 ? 0 : d.cInf);
  gradeFor(fx.grade, SHOTS[seg.id - 1].light);
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ seg: Seg; kit: Kit; alpha: number; o: number }> = ({ seg, kit, alpha, o }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.12, far: 2200 }}>
      <Inner seg={seg} kit={kit} o={o} />
    </ThreeCanvas>
  </AbsoluteFill>
);

// ---------------- overlays ----------------
const ease = (x: number) => { const u = Math.max(0, Math.min(1, x)); return 1 - (1 - u) ** 3; };
const INK = "#1d181c";
const stroke = (px: number) => ({ WebkitTextStroke: `${px}px ${INK}`, paintOrder: "stroke fill" as const });

/** word-timed captions, lower middle; the word being spoken is yellow */
const Captions: React.FC<{ o: number }> = ({ o }) => {
  const c = EDL.caps.find((g) => o >= g.o0 && o < g.o1);
  if (!c) return null;
  const pop = ease((o - c.o0) / 4), sc = 0.86 + 0.14 * pop, top = EDL.segs[segIndex(o)].cy ?? 1400;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 22px",
      transform: `scale(${sc})`, opacity: Math.min(1, (o - c.o0 + 1) / 2), fontFamily: FONT, fontWeight: 900, fontSize: 86, lineHeight: 1.08,
      letterSpacing: 1, textAlign: "center", filter: "drop-shadow(0 6px 0 rgba(29,24,28,0.55))" }}>
      {c.w.map((x, i) => {
        const on = o >= x.o0 && (i + 1 >= c.w.length || o < c.w[i + 1].o0);
        return <span key={i} style={{ color: on ? "#ffd84a" : "#ffffff", ...stroke(13) }}>{x.t}</span>;
      })}
    </div>
  );
};

/** place / date cards at the top, and the end card */
const Titles: React.FC<{ o: number }> = ({ o }) => (
  <>
    {EDL.titles.filter((t) => o >= t.o0 && o < t.o1).map((t, i) => {
      const a = ease((o - t.o0) / 7) * Math.min(1, (t.o1 - o) / 6), dy = (1 - ease((o - t.o0) / 9)) * -26;
      if (t.kind === "end") return (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", opacity: a, fontFamily: FONT, color: "#fffaf0" }}>
          <div style={{ fontWeight: 900, fontSize: 92, letterSpacing: 2, ...stroke(12), filter: "drop-shadow(0 6px 0 rgba(29,24,28,0.5))" }}>{t.top}</div>
          <div style={{ fontWeight: 900, fontSize: 66, marginTop: 10, letterSpacing: 3, ...stroke(10) }}>{t.sub}</div>
          {t.note && <div style={{ fontWeight: 700, fontSize: 34, marginTop: 34, letterSpacing: 1, ...stroke(7), opacity: 0.95 }}>{t.note}</div>}
        </div>
      );
      return (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 210 + dy, display: "flex", flexDirection: "column", alignItems: "center", opacity: a, fontFamily: FONT }}>
          <div style={{ background: "#c8372d", color: "#fffaf0", fontWeight: 900, fontSize: 60, letterSpacing: 4, padding: "8px 26px 10px",
            border: `6px solid ${INK}`, borderRadius: 14, boxShadow: `0 7px 0 ${INK}` }}>{t.top}</div>
          {t.sub && <div style={{ marginTop: 16, color: "#fffaf0", fontWeight: 900, fontSize: 46, letterSpacing: 3, ...stroke(10) }}>{t.sub}</div>}
        </div>
      );
    })}
  </>
);

/** rewind: bright tape streaks rolling up the frame, a slight wash and the double arrow */
const hh = (i: number) => { const v = Math.sin(i * 127.1) * 43758.5453; return v - Math.floor(v); };
const Rewind: React.FC<{ o: number }> = ({ o }) => {
  const r = EDL.rewind.find(([a, b]) => o >= a && o < b);
  if (!r) return null;
  const k = o - r[0];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "rgba(220,235,255,0.16)" }} />
      {[0, 1, 2, 3, 4].map((i) => {
        const y = ((hh(i + 1) * 1920 - k * (90 + 40 * i)) % 1920 + 1920) % 1920, h = 10 + 46 * hh(i + 7);
        return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: y, height: h, background: "rgba(255,255,255,0.55)", filter: "blur(3px)" }} />;
      })}
      <div style={{ position: "absolute", left: 70, top: 120, fontFamily: FONT, fontWeight: 900, fontSize: 84, color: "#fffaf0", ...stroke(10), opacity: k % 10 < 7 ? 1 : 0.25 }}>{"◀◀"}</div>
    </AbsoluteFill>
  );
};

export const YamaShortV2: React.FC = () => {
  const o = useCurrentFrame();
  const kit = useKit();
  useFont();
  if (!kit) return null;
  const white = whiteAt(o);
  const fade = Math.max(0, Math.min(1, (o - (EDL.total - 12)) / 12)); // to black over the last 12 frames
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {white < 0.999 && layersAt(o).map((l, i) => <ShotView key={i ? "over" : "base"} seg={l.seg} kit={kit} alpha={l.alpha} o={o} />)}
      {white > 0 && <AbsoluteFill style={{ background: "#fffaf0", opacity: white }} />}
      <Rewind o={o} />
      {fade > 0 && <AbsoluteFill style={{ background: "#0d0b0e", opacity: fade }} />}
      <Titles o={o} />
      <Captions o={o} />
    </AbsoluteFill>
  );
};
