// Character reference sheet: turnaround, expressions, hands and arm poses, all drawn by the same renderer the film uses.
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import "@fontsource/jetbrains-mono/500.css";
import { drawCharacter, drawHeadOnly, drawWatcher, stand, walk, Light, FACE0, Face, Pose } from "./char/draw";

const STUDIO: Light = { key: "#fff0e2", keyK: 0.95, amb: "#7a77a8", ambK: 0.62, dir: 130, rim: { color: "#9fd8ff", k: 0.35, dir: 20, w: 0.8 } };
const W = 2160, H = 2700;

type Cell = { x: number; y: number; w: number; h: number; label: string; draw: (c: CanvasRenderingContext2D) => void };

export const CharRef: React.FC<{ part?: "hero" | "entity" }> = ({ part = "hero" }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const h = delayRender("ref");
    document.fonts.load('500 30px "JetBrains Mono"').then(() => {
      const cv = ref.current!, x = cv.getContext("2d")!;
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1a1f3a"); g.addColorStop(1, "#231c36");
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      const cells: Cell[] = part === "hero" ? heroCells() : entityCells();
      for (const c of cells) {
        const o = document.createElement("canvas"); o.width = c.w; o.height = c.h;
        const ox = o.getContext("2d")!; c.draw(ox);
        x.fillStyle = "rgba(255,255,255,0.035)"; x.fillRect(c.x, c.y, c.w, c.h);
        x.drawImage(o, c.x, c.y);
        x.font = '500 30px "JetBrains Mono"'; x.fillStyle = "#ffb35c"; x.fillText(c.label, c.x + 16, c.y + c.h - 18);
      }
      x.font = '500 44px "JetBrains Mono"'; x.fillStyle = "#f2efe9";
      x.fillText(part === "hero" ? "THE LAST HUMAN ALIVE — protagonist reference" : "THE LAST HUMAN ALIVE — the entity", 40, 62);
      continueRender(h);
    });
  }, [part]);
  return <AbsoluteFill><canvas ref={ref} width={W} height={H} /></AbsoluteFill>;
};

const body = { x0: -60, y0: -6, w: 120, h: 196 };
const head = { x0: -16, y0: -23, w: 32, h: 40 };

function heroCells(): Cell[] {
  const cells: Cell[] = [];
  // row 1: turnaround
  const views: [number, string][] = [[0, "front"], [40, "3/4"], [90, "profile"], [140, "3/4 back"], [180, "back"]];
  views.forEach(([psi, name], i) => cells.push({ x: 40 + i * 420, y: 100, w: 400, h: 680, label: name, draw: (c) => drawCharacter(c, stand(psi, 0, { tired: 1 }), STUDIO, body) }));
  // row 2: expressions (front + 3/4)
  const faces: [string, Partial<Face>, "front" | "q3"][] = [
    ["tired", { tired: 1, open: 0.9, browIn: 0.6, mouth: "tight" }, "front"],
    ["worried", { tired: 1, open: 1.05, brow: 0.5, browIn: 1.2, mouth: "tight", look: [0.4, 0] }, "q3"],
    ["fear", { tired: 1, open: 1.3, pupil: 0.55, brow: 1.0, browIn: 1.3, mouth: "part", mouthOpen: 0.4 }, "front"],
    ["shock", { tired: 1, open: 1.35, pupil: 0.5, brow: 1.2, browIn: 1.1, mouth: "gasp", mouthOpen: 0.7 }, "front"],
    ["shout", { open: 1.2, brow: 0.8, browIn: 1.4, mouth: "open", mouthOpen: 1 }, "q3"],
  ];
  faces.forEach(([name, f, v], i) => cells.push({ x: 40 + i * 420, y: 800, w: 400, h: 480, label: name, draw: (c) => drawHeadOnly(c, v, { ...FACE0, ...f } as Face, STUDIO, head, 0, 0.75) }));
  // row 3: hands and arms in context (cropped from full poses)
  const reach = (): Pose => { const p = stand(90, 0, {}); p.armL = [80, 4, 18]; p.armR = [10, 6, 12]; return p; };
  const reachQ3 = (): Pose => { const p = stand(45, 0, {}); p.armL = [74, 18, 22]; p.handL = "reach"; return p; };
  const phone = (): Pose => ({ ...stand(15, 0, {}), armL: [38, -14, 78], armR: [38, -14, 78], handL: "phone", handR: "phone", phoneGlow: 0.8 });
  const relaxed = (): Pose => stand(25, 0, {});
  const arms: [string, () => Pose, { x0: number; y0: number; w: number; h: number }][] = [
    ["arm: reach (side)", reach, { x0: -34, y0: 62, w: 104, h: 135 }],
    ["arm: reach (3/4)", reachQ3, { x0: -34, y0: 48, w: 122, h: 158 }],
    ["hands: phone", phone, { x0: -40, y0: 70, w: 80, h: 80 }],
    ["hand: relaxed", relaxed, { x0: -4, y0: 52, w: 44, h: 57 }],
    ["walk: contact", () => walk(90, 0.25, {}), { x0: -60, y0: -6, w: 120, h: 196 }],
  ];
  arms.forEach(([name, pf, fr], i) => cells.push({ x: 40 + i * 420, y: 1300, w: 400, h: 520, label: name, draw: (c) => drawCharacter(c, pf(), STUDIO, fr) }));
  // row 4: walk cycle strip (8 drawings)
  for (let k = 0; k < 8; k++) cells.push({ x: 40 + k * 262, y: 1840, w: 250, h: 430, label: `walk ${k + 1}/8`, draw: (c) => drawCharacter(c, walk(90, k / 8, {}), STUDIO, body) });
  // row 5: poses the film needs
  const floorPhone = (): Pose => ({ psi: 10, hip: [0, 18, 0], lean: 6, headTilt: 0, headNod: 14, legsFront: true, legL: [130, 12, 110], legR: [126, 16, 106], armL: [59, -14, 46], armR: [59, -14, 46], handL: "phone", handR: "phone", phoneGlow: 1, face: { ...FACE0, tired: 1, open: 1.1, browIn: 1.1, look: [0, -0.8], mouth: "tight" }, breathe: 0 });
  const palm = (): Pose => { const p = stand(90, 0, { tired: 1, open: 1.15, browIn: 1.1 }); p.armL = [72, 4, 34]; p.handL = "palm"; p.lean = 4; return p; };
  cells.push({ x: 40, y: 2290, w: 400, h: 380, label: "floor + phone", draw: (c) => drawCharacter(c, floorPhone(), STUDIO, { x0: -60, y0: -4, w: 120, h: 114 }) });
  cells.push({ x: 460, y: 2290, w: 400, h: 380, label: "palm on glass", draw: (c) => drawCharacter(c, palm(), STUDIO, { x0: -34, y0: 66, w: 118, h: 112 }) });
  const turn: [number, string][] = [[0, "turn 1"], [-45, "turn 2"], [-90, "turn 3"]];
  turn.forEach(([hp, name], i) => cells.push({ x: 880 + i * 420, y: 2290, w: 400, h: 380, label: name, draw: (c) => { const p = stand(0, 0, { tired: 1, open: 1.3, pupil: 0.55, brow: 1.0, browIn: 1.25, mouth: "part", mouthOpen: 0.35, look: [-0.9, 0] }); p.headPsi = hp; drawCharacter(c, p, STUDIO, { x0: -40, y0: 115, w: 80, h: 76 }); } }));
  return cells;
}

function entityCells(): Cell[] {
  return [
    { x: 40, y: 100, w: 700, h: 1500, label: "the entity: full figure", draw: (c) => drawWatcher(c, { x0: -45, y0: -4, w: 90, h: 255 }, { eyes: 1, smile: 1, rim: 0.6, tilt: -4, lean: 0 }) },
    { x: 760, y: 100, w: 680, h: 720, label: "eyes closed", draw: (c) => drawWatcher(c, { x0: -22, y0: 196, w: 44, h: 46 }, { eyes: 0, smile: 0, rim: 0.6, tilt: 0, lean: 0 }) },
    { x: 1460, y: 100, w: 680, h: 720, label: "eyes open", draw: (c) => drawWatcher(c, { x0: -22, y0: 196, w: 44, h: 46 }, { eyes: 1, smile: 0, rim: 0.6, tilt: 0, lean: 0 }) },
    { x: 760, y: 840, w: 680, h: 760, label: "grin, half", draw: (c) => drawWatcher(c, { x0: -22, y0: 196, w: 44, h: 46 }, { eyes: 1, smile: 0.5, rim: 0.6, tilt: -2, lean: 0 }) },
    { x: 1460, y: 840, w: 680, h: 760, label: "grin, full", draw: (c) => drawWatcher(c, { x0: -22, y0: 196, w: 44, h: 46 }, { eyes: 1, smile: 1, rim: 0.6, tilt: -5, lean: 0 }) },
  ];
}
