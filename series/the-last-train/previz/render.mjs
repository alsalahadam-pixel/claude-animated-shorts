// Frame-by-frame capture of the previz in headless Chromium (SwiftShader WebGL), piped to ffmpeg.
//   node render.mjs --stills 1.0,5.5,...  [--w 720 --h 1280] [--dir out/stills]
//   node render.mjs --from 0 --to 2112 --out out/seg0.mp4 [--w 1080 --h 1920] [--port 8770]
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');

const A = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? acc.concat([[v.slice(2), arr[i + 1]]]) : acc), []));
const W = +(A.w || 720), H = +(A.h || 1280), PORT = +(A.port || 8765 + Math.floor(Math.random() * 400));
const root = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
}).listen(PORT);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Math.min(W, 1200), height: Math.min(H, 1200) } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('PAGE', m.type(), m.text().slice(0, 300)); });
const load = async () => {
  await page.goto(`http://localhost:${PORT}/index.html?w=${W}&h=${H}`);
  await page.waitForFunction('window.PV && window.PV.ready === true', null, { timeout: 120000 });
};
await load();
// SwiftShader can lose the WebGL context on long runs: reload every 300 frames, and redo any frame rendered on a lost context.
let sinceLoad = 0;
const grab = async (f) => {
  if (sinceLoad >= 300) { await load(); sinceLoad = 0; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = await page.evaluate((f) => window.PV.frame(f), f);
    if (!(await page.evaluate(() => window.PV.lost()))) { sinceLoad++; return Buffer.from(url.split(',')[1], 'base64'); }
    console.log('context lost at frame', f, '- reloading'); await load(); sinceLoad = 0;
  }
  throw new Error('WebGL context keeps getting lost at frame ' + f);
};

if (A.stills) {
  const dir = A.dir || 'out/stills'; fs.mkdirSync(dir, { recursive: true });
  for (const s of A.stills.split(',')) { const f = Math.round(parseFloat(s) * 24); const t0 = Date.now(); fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}.jpg`), await grab(f)); console.log('still', s, Date.now() - t0, 'ms'); }
} else {
  const from = +(A.from || 0), to = +(A.to || 2112), out = A.out || 'out/video.mp4';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '24', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    const buf = await grab(f);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - from) % 48 === 0) console.log(`frame ${f}/${to}  ${((Date.now() - t0) / Math.max(1, f - from + 1)).toFixed(0)} ms/f`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
}
await browser.close(); srv.close();
