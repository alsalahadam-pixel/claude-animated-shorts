// Render every word on screen as a transparent ProRes 4444 movie: out/final/overlay.mov (PART=2: out/part2/overlay.mov)
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
const browserExecutable = new URL("./chrome.sh", import.meta.url).pathname;
const two = process.env.PART === "2", dir = two ? "out/part2" : "out/final";
fs.mkdirSync(dir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: two ? "Part2Overlay" : "FinalOverlay", browserExecutable });
const t0 = Date.now();
await renderMedia({ composition, serveUrl, codec: "prores", proResProfile: "4444", pixelFormat: "yuva444p10le", imageFormat: "png",
  outputLocation: `${dir}/overlay.mov`, browserExecutable, concurrency: 1, muted: true, timeoutInMilliseconds: 600000 });
console.log("overlay", ((Date.now() - t0) / 1000).toFixed(0) + "s");
