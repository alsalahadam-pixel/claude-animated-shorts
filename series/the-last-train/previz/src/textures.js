// Canvas-painted textures. All readable text in the previz is drawn here (never "generated").
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// painterly brush noise over a filled area
function strokes(g, w, h, n, colors, alpha = 0.06, size = 30) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.5 + rnd());
    g.fillStyle = colors[(rnd() * colors.length) | 0];
    const x = rnd() * w, y = rnd() * h, l = size * (0.5 + rnd()), a = rnd() * Math.PI;
    g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-l / 2, -size * 0.12, l, size * 0.24); g.restore();
  }
  g.globalAlpha = 1;
}

export function logo(g, x, y, r, col = '#fff', bar = '#6a4c93') {
  g.lineWidth = r * 0.28; g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.save(); g.translate(x, y); g.rotate(-0.6); g.fillStyle = bar; g.fillRect(-r * 1.35, -r * 0.2, r * 2.7, r * 0.4); g.restore();
}

export function tileWall() { // 2 m wide x 3 m tall tile with teal band at 1.3-1.6 m
  const [c, g] = canvas(512, 768);
  g.fillStyle = '#d9d2bd'; g.fillRect(0, 0, 512, 768);
  for (let y = 0; y < 768; y += 19) for (let x = (y / 19) % 2 ? -19 : 0; x < 512; x += 38) {
    const v = 200 + rnd() * 30 | 0; g.fillStyle = `rgb(${v + 14},${v + 8},${v - 16})`; g.fillRect(x + 1.5, y + 1.5, 35, 16);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 2, y + 2, 33, 4);
  }
  strokes(g, 512, 768, 400, ['#b8ad92', '#efe7d0', '#8f8a7a', '#c9bfa2'], 0.05, 40);
  // grime toward the floor
  const gr = g.createLinearGradient(0, 560, 0, 768); gr.addColorStop(0, 'rgba(40,30,20,0)'); gr.addColorStop(1, 'rgba(40,30,20,0.45)'); g.fillStyle = gr; g.fillRect(0, 560, 512, 208);
  // teal band (1.3 - 1.6 m from floor => y 358-435)
  g.fillStyle = '#c9a24a'; g.fillRect(0, 352, 512, 6); g.fillRect(0, 436, 512, 6);
  g.fillStyle = '#145a5c'; g.fillRect(0, 358, 512, 78); strokes(g, 512, 78, 60, ['#0f4a4c', '#1c6e70'], 0.1, 30);
  return tex(c, [1, 1]);
}

export function nameBand(text) {
  const [c, g] = canvas(2048, 160);
  g.fillStyle = '#145a5c'; g.fillRect(0, 0, 2048, 160);
  g.fillStyle = '#c9a24a'; g.fillRect(0, 0, 2048, 8); g.fillRect(0, 152, 2048, 8);
  g.fillStyle = '#ffffff'; g.font = 'bold 96px "DejaVu Sans Condensed", "Liberation Sans Narrow", Arial Narrow, sans-serif'; g.textBaseline = 'middle';
  for (const x0 of [140, 1140]) { logo(g, x0, 80, 40); g.fillText(text, x0 + 80, 84); }
  return tex(c);
}

export function floorTex() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#4a4744'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 50 + rnd() * 90 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 8},0.5)`; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  strokes(g, 512, 512, 200, ['#2c2a28', '#6a6560'], 0.06, 60);
  return tex(c, [8, 8]);
}

export function edgeStrip() {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#d8b62a'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#b39320'; for (let x = 8; x < 256; x += 16) for (let y = 8; y < 64; y += 16) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  return tex(c, [40, 1]);
}

export function trainSide() {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#b8bcc0'; g.fillRect(0, 0, 1024, 256);
  strokes(g, 1024, 256, 200, ['#9da2a8', '#d0d4d8'], 0.07, 50);
  g.fillStyle = '#6a4c93'; g.fillRect(0, 196, 1024, 26);
  g.fillStyle = '#4a356a'; g.fillRect(0, 222, 1024, 6);
  return tex(c);
}

export function adPanel(i) {
  const [c, g] = canvas(256, 128);
  const pal = [['#1e3d59', '#f5f0e1', '#ff6e40'], ['#2b2d42', '#edf2f4', '#ef233c'], ['#283618', '#fefae0', '#dda15e'], ['#3d405b', '#f4f1de', '#81b29a']][i % 4];
  g.fillStyle = pal[0]; g.fillRect(0, 0, 256, 128);
  g.fillStyle = pal[2]; g.beginPath(); g.arc(200, 64, 46, 0, 7); g.fill();
  g.fillStyle = pal[1]; g.font = 'bold 26px sans-serif'; g.fillText(['SLEEP BETTER', 'CITY SAVER', 'KESSLER', 'NIGHT LINE'][i % 4], 14, 50);
  g.font = '14px sans-serif'; g.fillText(['ask your pharmacist', 'save on every trip', 'building deeper', 'we run late so you can'][i % 4], 14, 78);
  return tex(c);
}

export function poster(i) {
  const [c, g] = canvas(256, 384);
  const cols = ['#e8c547', '#30323d', '#4d5061', '#5c80bc', '#cdd1c4', '#b23a48'];
  g.fillStyle = cols[i % 6]; g.fillRect(0, 0, 256, 384);
  g.fillStyle = cols[(i + 2) % 6]; g.fillRect(20, 30, 216, 220);
  g.fillStyle = cols[(i + 4) % 6]; g.beginPath(); g.arc(128, 140, 70, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.fillText(['ECHOES', 'MIND THE', 'RIVERFEST', 'STAY', 'LINE 7', 'OPEN LATE'][i % 6], 24, 300);
  g.font = '16px sans-serif'; g.fillText(['live at the docks', 'quiet carriages', 'east bank', 'calm', 'under the river', 'always'][i % 6], 24, 330);
  strokes(g, 256, 384, 80, ['#000', '#fff'], 0.04, 40);
  return tex(c);
}

// Departure board: header + rows; redraw when state changes.
export class Board {
  constructor() { [this.c, this.g] = canvas(768, 400); this.tex = tex(this.c); this.key = ''; }
  draw(s) {
    const key = JSON.stringify(s); if (key === this.key) return; this.key = key;
    const g = this.g;
    g.fillStyle = '#050505'; g.fillRect(0, 0, 768, 400);
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 768, 70);
    g.font = 'bold 40px "DejaVu Sans Mono", monospace'; g.textBaseline = 'middle';
    g.fillStyle = s.headerColor || '#ffb000'; g.fillText(s.header, 18, 36);
    g.fillStyle = '#ffb000'; g.fillText(s.clock, 640, 36);
    s.rows.forEach((r, i) => {
      const y = 112 + i * 64;
      g.fillStyle = r.flip ? '#3a2a00' : '#ffb000';
      if (r.flip) { g.fillRect(14, y - 24, 740, 48); g.fillStyle = '#ffb000'; }
      g.fillStyle = r.color || '#ffb000';
      g.fillText(r.text, 18, y);
    });
    this.tex.needsUpdate = true;
  }
}

export function doorTex() {
  const [c, g] = canvas(512, 1075);
  g.fillStyle = '#6d7377'; g.fillRect(0, 0, 512, 1075);
  strokes(g, 512, 1075, 500, ['#5a6064', '#80878b', '#4b5053'], 0.08, 40);
  g.strokeStyle = '#4a4f52'; g.lineWidth = 6; g.strokeRect(20, 20, 472, 1035);
  // window hole region marked darker (actual hole is geometry)
  // sign plate
  g.fillStyle = '#e8e2d0'; g.fillRect(96, 110, 320, 90); g.fillStyle = '#145a5c'; g.fillRect(96, 110, 320, 22);
  g.fillStyle = '#111'; g.font = 'bold 30px sans-serif'; g.fillText('SIGNAL EQUIPMENT', 112, 164); g.font = 'bold 20px sans-serif'; g.fillText('STAFF ONLY', 112, 190);
  // red marker warning (lower half, under the window)
  g.save(); g.fillStyle = '#c4161c'; g.strokeStyle = '#c4161c';
  g.font = 'bold 74px "DejaVu Sans", sans-serif'; g.translate(40, 660); g.rotate(-0.04);
  g.fillText('DO NOT OPEN.', 0, 0);
  g.font = 'bold 50px "DejaVu Sans", sans-serif'; g.fillText('NO MATTER WHAT', 6, 90); g.fillText('SHE SAYS.', 70, 160);
  // drips
  g.lineWidth = 4; for (const [x, y, l] of [[60, 8, 50], [210, 10, 80], [330, 12, 36], [120, 100, 60], [300, 172, 70]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + l); g.stroke(); g.beginPath(); g.arc(x + 1, y + l, 4, 0, 7); g.fill(); }
  g.restore();
  return tex(c);
}

export function meshGlass() {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256); g.fillStyle = 'rgba(160,190,200,0.10)'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(30,30,30,0.85)'; g.lineWidth = 2.2;
  for (let i = -256; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 40; i++) g.fillRect(rnd() * 256, rnd() * 256, 40, 1);
  const t = tex(c); return t;
}

export function crackTex() {
  const [c, g] = canvas(512, 512);
  g.clearRect(0, 0, 512, 512); g.strokeStyle = 'rgba(235,245,250,0.85)'; g.lineWidth = 2;
  const cx = 256, cy = 230;
  for (let i = 0; i < 18; i++) {
    let a = i / 18 * Math.PI * 2 + rnd() * 0.3, x = cx, y = cy; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (rnd() - 0.5) * 0.5; const l = 14 + rnd() * 26; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); }
    g.stroke();
  }
  for (let r = 30; r < 200; r += 40 + rnd() * 30) { g.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = r * (0.8 + rnd() * 0.4); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.lineWidth = 1.2; g.stroke(); }
  return tex(c);
}

export function shutterTex() {
  const [c, g] = canvas(512, 512);
  for (let y = 0; y < 512; y += 24) { g.fillStyle = '#7d8286'; g.fillRect(0, y, 512, 24); g.fillStyle = '#5c6064'; g.fillRect(0, y + 18, 512, 6); g.fillStyle = '#9aa0a4'; g.fillRect(0, y + 2, 512, 3); }
  strokes(g, 512, 512, 200, ['#3b3f42', '#a8adb0'], 0.07, 40);
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(30,30,30,0.6)'; g.fillRect(rnd() * 512, rnd() * 512, 4, 2); }
  const t = tex(c, [3, 3]); return t;
}
export function hazardTex() {
  const [c, g] = canvas(256, 32); g.fillStyle = '#e8c21e'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#111';
  for (let x = -32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.fill(); }
  return tex(c, [6, 1]);
}

export function rackTex() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#16191c'; g.fillRect(0, 0, 256, 512);
  for (let y = 10; y < 512; y += 36) { g.fillStyle = '#23272b'; g.fillRect(8, y, 240, 30); for (let x = 20; x < 240; x += 18) { if (rnd() < 0.5) { g.fillStyle = rnd() < 0.7 ? '#2fd0ff' : '#3cff8a'; g.fillRect(x, y + 12, 5, 5); } } }
  return tex(c);
}

export class PhoneScreen {
  constructor() { [this.c, this.g] = canvas(256, 520); this.tex = tex(this.c); this.key = ''; }
  draw(kind) {
    if (kind === this.key) return; this.key = kind; const g = this.g;
    const bg = g.createLinearGradient(0, 0, 0, 520); bg.addColorStop(0, '#1d2433'); bg.addColorStop(1, '#0b0e14'); g.fillStyle = bg; g.fillRect(0, 0, 256, 520);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    if (kind === 'mum') {
      g.font = '22px sans-serif'; g.fillText('incoming call', 128, 120); g.font = 'bold 44px sans-serif'; g.fillText('MUM', 128, 190);
      g.fillStyle = '#ff4d6d'; heart(g, 128, 240, 22);
      g.fillStyle = '#2ecc71'; g.beginPath(); g.arc(70, 430, 30, 0, 7); g.fill(); g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(186, 430, 30, 0, 7); g.fill();
    } else if (kind === 'lucy_missed') {
      g.font = 'bold 34px sans-serif'; g.fillText('02:18', 128, 70);
      g.fillStyle = '#ffffff22'; g.fillRect(16, 110, 224, 130); g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.fillText('LUCY', 110, 152); g.fillStyle = '#ffcc33'; heart(g, 172, 144, 12);
      g.fillStyle = '#ff6b6b'; g.font = '20px sans-serif'; g.fillText('14 missed calls', 128, 188); g.fillStyle = '#ddd'; g.fillText('Voicemail  0:09  ▶', 128, 220);
    } else if (kind === 'lucy_calling') {
      g.font = '22px sans-serif'; g.fillText('calling…', 128, 120); g.font = 'bold 48px sans-serif'; g.fillText('LUCY', 128, 190); g.fillStyle = '#ffcc33'; heart(g, 128, 240, 22);
      g.fillStyle = '#2ecc71'; g.beginPath(); g.arc(70, 430, 30, 0, 7); g.fill(); g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(186, 430, 30, 0, 7); g.fill();
    } else if (kind === 'lock') { // lockscreen: Lucy photo (stylized)
      g.fillStyle = '#ffb36b'; g.fillRect(0, 0, 256, 520); g.fillStyle = '#8d5a3b'; g.beginPath(); g.arc(128, 250, 70, 0, 7); g.fill();
      g.fillStyle = '#ff6a13'; g.fillRect(58, 320, 140, 200); g.fillStyle = '#d9dde0'; g.fillRect(58, 380, 140, 12); g.fillRect(58, 420, 140, 12);
      g.fillStyle = '#1a1410'; for (let i = 0; i < 6; i++) g.fillRect(64 + i * 24, 180, 10, 110); g.fillStyle = '#ff6a13'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(69 + i * 24, 296, 7, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.fillRect(100, 270, 56, 14); g.fillStyle = '#1a1a1a'; g.fillRect(126, 270, 7, 14);
      g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.fillText('02:19', 128, 80);
    }
    g.textAlign = 'left'; this.tex.needsUpdate = true;
  }
}
function heart(g, x, y, r) { g.beginPath(); g.moveTo(x, y + r); g.bezierCurveTo(x - r * 2, y - r * 0.2, x - r * 0.9, y - r * 1.6, x, y - r * 0.5); g.bezierCurveTo(x + r * 0.9, y - r * 1.6, x + r * 2, y - r * 0.2, x, y + r); g.fill(); }
