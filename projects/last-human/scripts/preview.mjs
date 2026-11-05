// Half-resolution motion preview of a frame range (for review, not the final render).
// usage: node scripts/preview.mjs <name> <from> <to> [scale] [concurrency]
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
const [name, from, to, scale = "0.5", conc = "2"] = process.argv.slice(2);
const browserExecutable = new URL("./chrome.sh", import.meta.url).pathname;
const chromiumOptions = { gl: "swangle" };
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "LastHuman", browserExecutable, chromiumOptions });
let last = 0;
await renderMedia({
  composition, serveUrl, codec: "h264", crf: 18, outputLocation: `out/preview/${name}.mp4`, browserExecutable, chromiumOptions,
  imageFormat: "jpeg", jpegQuality: 92, scale: Number(scale), concurrency: Number(conc), frameRange: [Number(from), Number(to) - 1],
  timeoutInMilliseconds: 600000, muted: true,
  onProgress: ({ renderedFrames }) => { if (renderedFrames - last >= 25) { last = renderedFrames; console.log(`${name}: ${renderedFrames}/${to - from} (${((Date.now() - t0) / 60000).toFixed(1)} min)`); } },
});
console.log(`${name} DONE in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
