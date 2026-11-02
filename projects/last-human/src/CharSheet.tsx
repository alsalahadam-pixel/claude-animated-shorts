import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { drawCharacter, drawHeadOnly, drawWatcher, stand, walk, Light, FACE0, Pose } from "./char/draw";

const WARM: Light = { key: "#ffc49a", keyK: 1.0, amb: "#6a6aa6", ambK: 0.62, dir: 140, rim: { color: "#ff9a5a", k: 0.7, dir: 20, w: 1.0 } };
const TEAL: Light = { key: "#bfeee8", keyK: 0.95, amb: "#5b5f99", ambK: 0.6, dir: 40, rim: { color: "#b28bff", k: 0.5, dir: 160, w: 0.9 } };

export const CharSheet: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current!; const x = cv.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, "#1b2244"); g.addColorStop(1, "#2a2140");
    x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
    const cell = (px: number, py: number, w: number, h: number, fn: (c: CanvasRenderingContext2D) => void) => {
      const o = document.createElement("canvas"); o.width = w; o.height = h; fn(o.getContext("2d")!); x.drawImage(o, px, py);
    };
    const body = { x0: -60, y0: -4, w: 120, h: 190 };
    const poses: [Pose, Light][] = [
      [stand(0, 0, { browIn: 0.6, mouth: "tight" }), WARM],
      [stand(40, 0, {}), WARM],
      [walk(90, 0.15, {}), TEAL],
      [walk(40, 0.6, { look: [0.4, 0.2] }, { pockets: true }), TEAL],
      [stand(180, 0), WARM],
      [stand(140, 0), TEAL],
    ];
    poses.forEach(([p, l], i) => cell((i % 3) * 360, Math.floor(i / 3) * 570, 360, 570, (c) => drawCharacter(c, p, l, body)));
    const head = { x0: -16, y0: -22, w: 32, h: 40 };
    const faces = [
      { view: "front" as const, f: { ...FACE0, open: 1.3, pupil: 0.55, brow: 1.0, browIn: 1.0, mouth: "gasp" as const, mouthOpen: 0.6 } },
      { view: "q3" as const, f: { ...FACE0, browIn: 0.8, mouth: "tight" as const, look: [0.6, 0] as [number, number] } },
      { view: "side" as const, f: { ...FACE0, open: 1.2, pupil: 0.6 } },
    ];
    faces.forEach((h, i) => cell(i * 360, 1140, 360, 450, (c) => drawHeadOnly(c, h.view, h.f, i === 1 ? TEAL : WARM, head)));
    cell(0, 1590, 360, 330, (c) => drawHeadOnly(c, "front", { ...FACE0, open: 0, mouth: "neutral" }, WARM, head, -12));
    cell(360, 1590, 360, 330, (c) => drawHeadOnly(c, "front", { ...FACE0, mouth: "creep", mouthOpen: 0.5, shine: false, look: [-0.8, 0] }, TEAL, head));
    cell(720, 1590, 360, 330, (c) => drawWatcher(c, { x0: -40, y0: 120, w: 80, h: 130 }, { eyes: 1, smile: 1, rim: 0.6, tilt: 4, lean: 0 }));
  }, []);
  return <AbsoluteFill><canvas ref={ref} width={1080} height={1920} /></AbsoluteFill>;
};
