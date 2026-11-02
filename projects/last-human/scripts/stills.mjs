// usage: node scripts/stills.mjs <comp> <outPrefix> <frame,frame,...> [scale] [gl]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
const [comp, prefix, frames, scale = "0.5", gl = "swangle"] = process.argv.slice(2);
const browserExecutable = new URL("./chrome.sh", import.meta.url).pathname;
const chromiumOptions = { gl };
const props = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
fs.mkdirSync(path.dirname(prefix), { recursive: true });
let t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
console.log("bundle", ((Date.now() - t0) / 1000).toFixed(1) + "s");
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable, chromiumOptions, inputProps: props });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 90, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000, onBrowserLog, inputProps: props });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
