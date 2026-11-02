// usage: node scripts/render.mjs <comp> <out.mp4> [from-to] [concurrency]
// env PROPS='{"...":...}' passes inputProps. Software WebGL (SwiftShader) via scripts/chrome.sh.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
const [comp, out, range, conc = "2"] = process.argv.slice(2);
const browserExecutable = new URL("./chrome.sh", import.meta.url).pathname;
const chromiumOptions = { gl: "swangle" };
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable, chromiumOptions, inputProps });
const frameRange = range ? range.split("-").map(Number) : null;
let last = 0;
await renderMedia({
  composition, serveUrl, codec: "h264", crf: 14, outputLocation: out, inputProps, browserExecutable, chromiumOptions,
  imageFormat: "jpeg", jpegQuality: 96, concurrency: Number(conc), frameRange, timeoutInMilliseconds: 300000,
  muted: true, x264Preset: "slow",
  onBrowserLog: (l) => { if (l.type === "error") console.log("[error]", l.text.slice(0, 300)); },
  onProgress: ({ renderedFrames, progress }) => {
    const now = Date.now();
    if (now - last > 30000) { last = now; console.log(`${renderedFrames} frames, ${(progress * 100).toFixed(1)}%, ${((now - t0) / 1000).toFixed(0)}s`); }
  },
});
const n = frameRange ? frameRange[1] - frameRange[0] + 1 : composition.durationInFrames;
console.log(`done ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${(((Date.now() - t0) / 1000) / n).toFixed(2)} s/frame`);
