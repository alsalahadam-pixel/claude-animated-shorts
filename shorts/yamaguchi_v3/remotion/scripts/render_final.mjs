// final render of YamaShort (or $COMP) in resumable chunks: node scripts/render_final.mjs <outDir> [chunkFrames] [concurrency]
// writes <outDir>/chunk_XX.mp4 (skips chunks that already exist), then concat.txt for ffmpeg
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
const [outDir, chunkArg = "460", concArg = "2"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "YamaShort", browserExecutable, chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 600000 });
const total = composition.durationInFrames, step = +chunkArg;
const list = [];
for (let a = 0, k = 0; a < total; a += step, k++) {
  const b = Math.min(total, a + step) - 1, file = path.join(outDir, `chunk_${String(k).padStart(2, "0")}.mp4`);
  list.push(`file '${path.resolve(file)}'`);
  if (fs.existsSync(file)) { console.log(`chunk ${k} exists, skip`); continue; }
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 17, outputLocation: file + ".part.mp4", browserExecutable, concurrency: +concArg,
    chromiumOptions: { gl: "swangle" }, frameRange: [a, b], timeoutInMilliseconds: 600000, logLevel: "error", muted: true,
    onProgress: (p) => { if (p.renderedFrames % 20 === 0) fs.writeFileSync(path.join(outDir, "progress.txt"), `chunk ${k} [${a}-${b}] ${p.renderedFrames}/${b - a + 1} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`); } });
  fs.renameSync(file + ".part.mp4", file);
  console.log(`chunk ${k} [${a}-${b}] done in ${((Date.now() - t0) / 1000).toFixed(0)} s (${((Date.now() - t0) / 1000 / (b - a + 1)).toFixed(2)} s/frame)`);
}
fs.writeFileSync(path.join(outDir, "concat.txt"), list.join("\n") + "\n");
console.log("ALL DONE");
process.exit(0);
