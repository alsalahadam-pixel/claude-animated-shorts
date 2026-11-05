// Render the film shot by shot into out/chunks/<id>.mp4 (existing chunks are skipped; delete one to re-render it).
// usage: node scripts/render_chunks.mjs [id,id,...]   (default: every shot)
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
const only = process.argv[2] ? process.argv[2].split(",") : null;
const story = fs.readFileSync("src/story.ts", "utf8");
const shots = [...story.matchAll(/id: "(\w+)", a: (\d+), b: (\d+), look/g)].map((m) => ({ id: m[1], a: +m[2], b: +m[3] })).filter((s) => s.id !== "photo");
const browserExecutable = new URL("./chrome.sh", import.meta.url).pathname;
const chromiumOptions = { gl: "swangle" };
fs.mkdirSync("out/chunks", { recursive: true });
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "LastHuman", browserExecutable, chromiumOptions });
for (const s of shots) {
  const out = `out/chunks/${s.id}.mp4`;
  if (only ? !only.includes(s.id) : fs.existsSync(out)) continue;
  const t1 = Date.now();
  await renderMedia({
    composition, serveUrl, codec: "h264", crf: 12, outputLocation: out + ".tmp.mp4", browserExecutable, chromiumOptions,
    imageFormat: "jpeg", jpegQuality: 96, concurrency: Number(process.env.CONC ?? 1), frameRange: [s.a, s.b - 1], timeoutInMilliseconds: 600000, muted: true,
    onBrowserLog: (l) => { if (l.type === "error" && !l.text.includes("404")) console.log(`[${s.id}] [error]`, l.text.slice(0, 200)); },
  });
  fs.renameSync(out + ".tmp.mp4", out);
  const n = s.b - s.a;
  console.log(`${s.id}: ${n} frames in ${((Date.now() - t1) / 1000).toFixed(0)}s (${((Date.now() - t1) / 1000 / n).toFixed(2)} s/f), total ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
console.log("ALL DONE");
