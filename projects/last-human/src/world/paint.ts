// Canvas2D painted textures (deterministic: every texture comes from a seeded generator).
import * as THREE from "three";

export const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, x: c.getContext("2d")! };
}

export function tex(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function noise(x: CanvasRenderingContext2D, w: number, h: number, r: () => number, amt: number, n = 4000, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = r();
    x.fillStyle = v > 0.5 ? `rgba(255,255,255,${amt * (v - 0.5)})` : `rgba(0,0,0,${amt * (0.5 - v)})`;
    x.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r()));
  }
}

export function woodFloor() {
  const { c, x } = canvas(1024, 1024), r = rng(11);
  const cols = ["#3a2a28", "#33242a", "#40302c", "#2e2226"];
  const pw = 128;
  for (let i = 0; i < 1024 / pw; i++) {
    let y = -r() * 400;
    while (y < 1024) {
      const L = 300 + r() * 500;
      x.fillStyle = cols[Math.floor(r() * cols.length)];
      x.fillRect(i * pw, y, pw, L);
      for (let g = 0; g < 14; g++) {
        x.strokeStyle = `rgba(20,10,15,${0.12 + r() * 0.12})`; x.lineWidth = 1 + r() * 2;
        const gx = i * pw + r() * pw; x.beginPath(); x.moveTo(gx, y); x.bezierCurveTo(gx + 8, y + L / 3, gx - 8, y + (2 * L) / 3, gx + r() * 6, y + L); x.stroke();
      }
      x.fillStyle = "#140c12"; x.fillRect(i * pw, y + L - 3, pw, 3);
      y += L;
    }
    x.fillStyle = "#120a10"; x.fillRect(i * pw, 0, 3, 1024);
  }
  noise(x, 1024, 1024, r, 0.08, 6000);
  return tex(c, [3, 3]);
}

export function plaster(base: string, seed = 3) {
  const { c, x } = canvas(512, 512), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    const g = x.createRadialGradient(r() * 512, r() * 512, 0, r() * 512, r() * 512, 60 + r() * 120);
    g.addColorStop(0, `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},0.035)`); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  }
  noise(x, 512, 512, r, 0.05, 5000, 1.5);
  return tex(c, [2, 1]);
}

export function fabric(base: string, seed = 5, stripe?: string) {
  const { c, x } = canvas(512, 512), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  if (stripe) { x.fillStyle = stripe; for (let i = 0; i < 512; i += 64) x.fillRect(i, 0, 18, 512); }
  for (let i = 0; i < 512; i += 2) { x.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.03})`; x.fillRect(0, i, 512, 1); x.fillRect(i, 0, 1, 512); }
  noise(x, 512, 512, r, 0.06, 3000, 2);
  return tex(c, [2, 2]);
}

export function asphalt(wet: boolean) {
  const { c, x } = canvas(1024, 1024), r = rng(21);
  x.fillStyle = wet ? "#1d1f29" : "#3a3c44"; x.fillRect(0, 0, 1024, 1024);
  noise(x, 1024, 1024, r, 0.18, 30000, 2);
  for (let i = 0; i < 18; i++) { // patches + cracks
    x.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.08})`; x.beginPath(); x.ellipse(r() * 1024, r() * 1024, 40 + r() * 140, 20 + r() * 60, r() * 3, 0, 7); x.fill();
  }
  x.strokeStyle = "rgba(10,10,14,0.5)"; x.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) { let px = r() * 1024, py = r() * 1024; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 60; py += (r() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); }
  return tex(c, [6, 40]);
}

export function concrete(seed = 31) {
  const { c, x } = canvas(512, 512), r = rng(seed);
  x.fillStyle = "#5b5c64"; x.fillRect(0, 0, 512, 512);
  noise(x, 512, 512, r, 0.14, 12000, 2);
  x.strokeStyle = "rgba(20,20,26,0.55)"; x.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  return tex(c, [2, 20]);
}

/** facade: window grid; returns albedo + emissive (lit windows) textures */
export function facade(seed: number, o: { base: string; win: string; lit: number; cols: number; rows: number; warm?: boolean }) {
  const W = 512, H = 1024;
  const a = canvas(W, H), e = canvas(W, H), r = rng(seed);
  a.x.fillStyle = o.base; a.x.fillRect(0, 0, W, H);
  noise(a.x, W, H, r, 0.08, 4000, 2);
  e.x.fillStyle = "#000"; e.x.fillRect(0, 0, W, H);
  const cw = W / o.cols, rh = H / o.rows;
  for (let j = 0; j < o.rows; j++) {
    // floor band
    a.x.fillStyle = "rgba(0,0,0,0.18)"; a.x.fillRect(0, j * rh + rh - 6, W, 6);
    for (let i = 0; i < o.cols; i++) {
      const wx = i * cw + cw * 0.18, wy = j * rh + rh * 0.2, ww = cw * 0.64, wh = rh * 0.58;
      a.x.fillStyle = o.win; a.x.fillRect(wx, wy, ww, wh);
      a.x.fillStyle = "rgba(255,255,255,0.06)"; a.x.fillRect(wx, wy, ww * 0.45, wh);
      a.x.strokeStyle = "rgba(0,0,0,0.5)"; a.x.lineWidth = 3; a.x.strokeRect(wx, wy, ww, wh);
      if (r() < o.lit) {
        const warm = o.warm ?? true;
        const col = r() < 0.75 ? (warm ? "#ffb56a" : "#9fe6ff") : r() < 0.5 ? "#c8a0ff" : "#7fd8d0";
        e.x.fillStyle = col; e.x.globalAlpha = 0.45 + r() * 0.55; e.x.fillRect(wx, wy, ww, wh); e.x.globalAlpha = 1;
        // blind / curtain silhouette
        e.x.fillStyle = "rgba(0,0,0,0.55)"; e.x.fillRect(wx, wy, ww, wh * r() * 0.6);
      }
    }
  }
  const at = tex(a.c), et = tex(e.c);
  return { map: at, emissive: et };
}

export function neonSign(text: string, color: string, w = 1024, h = 256, font = "bold 150px sans-serif") {
  const { c, x } = canvas(w, h);
  x.fillStyle = "rgba(0,0,0,0)"; x.clearRect(0, 0, w, h);
  x.font = font; x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = color; x.shadowBlur = 30; x.fillStyle = color; x.fillText(text, w / 2, h / 2);
  x.shadowBlur = 8; x.fillStyle = "#ffffff"; x.globalAlpha = 0.85; x.fillText(text, w / 2, h / 2);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function radial(inner: string, outer = "rgba(0,0,0,0)", size = 256) {
  const { c, x } = canvas(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

/** vertical streak used for fake wet-road reflections (white, tinted by the material colour) */
export function streak() {
  const { c, x } = canvas(64, 512);
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.35, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 512);
  const h = x.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.5, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)");
  x.globalCompositeOperation = "destination-out"; x.fillStyle = h; x.fillRect(0, 0, 64, 512);
  const r = rng(4); x.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.5})`; x.fillRect(0, r() * 512, 64, 2 + r() * 8); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function poster(seed: number, cols: string[]) {
  const { c, x } = canvas(256, 384), r = rng(seed);
  x.fillStyle = cols[0]; x.fillRect(0, 0, 256, 384);
  for (let i = 0; i < 5; i++) { x.fillStyle = cols[1 + (i % (cols.length - 1))]; x.globalAlpha = 0.85; x.beginPath(); x.arc(r() * 256, r() * 384, 30 + r() * 90, 0, 7); x.fill(); }
  x.globalAlpha = 1; x.fillStyle = "rgba(255,255,255,0.85)"; x.fillRect(24, 320, 208, 8); x.fillRect(24, 340, 140, 6);
  x.strokeStyle = "#0b0a10"; x.lineWidth = 10; x.strokeRect(0, 0, 256, 384);
  return tex(c);
}

/** live TV static, redrawn per frame from the frame number */
export class Static {
  c: HTMLCanvasElement; x: CanvasRenderingContext2D; t: THREE.CanvasTexture; img: ImageData;
  constructor(w = 192, h = 108) {
    const { c, x } = canvas(w, h); this.c = c; this.x = x; this.t = tex(c); this.t.wrapS = this.t.wrapT = THREE.ClampToEdgeWrapping;
    this.t.magFilter = THREE.NearestFilter; this.img = x.createImageData(w, h);
  }
  update(frame: number) {
    const r = rng(frame * 7919 + 13), d = this.img.data, w = this.c.width;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.floor(i / 4 / w);
      const roll = (y + frame * 3) % 40 < 3 ? 40 : 0;
      const v = r() * 200 + roll;
      d[i] = v * 0.7; d[i + 1] = v * 0.95; d[i + 2] = v; d[i + 3] = 255;
    }
    this.x.putImageData(this.img, 0, 0); this.t.needsUpdate = true;
  }
}
