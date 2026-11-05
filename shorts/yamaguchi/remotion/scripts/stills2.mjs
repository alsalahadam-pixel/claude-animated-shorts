// stills with inputProps: node scripts/stills2.mjs <comp> <outPrefix> <frames> <scale> '<json props>'
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [comp, prefix, frames, scale = "0.5", props = "{}"] = process.argv.slice(2);
const inputProps = JSON.parse(props);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: comp, inputProps, browserExecutable, chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 300000 });
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, output: `${prefix}${String(f).padStart(4, "0")}.png`, frame: f, scale: +scale, browserExecutable, inputProps,
    chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 300000, logLevel: "error",
    onBrowserLog: (l) => { if (!l.text.includes("404") && !l.text.includes("deprecated")) console.log("[browser]", l.type, l.text.slice(0, 400)); } });
  console.log(`frame ${f}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
process.exit(0);
