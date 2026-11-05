// bundle once, then time short frame ranges under different post toggles / concurrency
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
const comp = process.argv[2] ?? "BridgeShort";
const f0 = +(process.argv[3] ?? 600);
const configs = JSON.parse(process.argv[4] ?? '[{"name":"full","post":{},"conc":1}]');
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
for (const c of configs) {
  const inputProps = { post: c.post, perf: c.perf ?? {} };
  const composition = await selectComposition({ serveUrl, id: comp, inputProps, browserExecutable, chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 300000 });
  const n = c.n ?? 8;
  const t0 = Date.now(); let first = 0;
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: `out/prof_${c.name}.mp4`, inputProps, browserExecutable, concurrency: c.conc,
    chromiumOptions: { gl: "swangle" }, frameRange: [f0, f0 + n - 1], timeoutInMilliseconds: 300000, logLevel: "error",
    onProgress: (p) => { if (p.renderedFrames === 1 && !first) first = Date.now(); } });
  const t1 = Date.now();
  console.log(`${c.name}: total ${((t1 - t0) / 1000).toFixed(1)} s, first frame at ${((first - t0) / 1000).toFixed(1)} s, after-first ${(((t1 - first) / 1000) / (n - 1)).toFixed(2)} s/frame`);
}
