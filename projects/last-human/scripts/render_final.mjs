// Render an edit's 3D plates (no text) row by row into <out>/plates/<id>.mp4.
// Reused rows come from the V3 chunks, black rows from ffmpeg; both are skipped here. Existing plates are skipped.
// usage: node scripts/render_final.mjs [id,id,...]          the final cut (FINAL -> FinalPlate -> out/final)
//        PART=2 node scripts/render_final.mjs [id,...]       Part 2 (P2 -> Part2Plate -> out/part2)
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
export const PARTS = { 1: { table: "FINAL", comp: "FinalPlate", out: "out/final" }, 2: { table: "P2", comp: "Part2Plate", out: "out/part2" } };
export const finalRows = (table = "FINAL") => {
  const story = fs.readFileSync("src/story.ts", "utf8");
  const body = story.slice(story.indexOf(`export const ${table}: FinalShot[] = edit([`));
  let t = 0;
  return [...body.matchAll(/\["(\w+)", (\d+), \{ (\w+): "?(\w+)?/g)].map((m) => {
    const r = { id: m[1], a: t, b: t + +m[2], kind: m[3], reuse: m[3] === "reuse" ? m[4] : null }; t = r.b; return r;
  });
};
if (import.meta.url === `file://${process.argv[1]}`) {
  const P = PARTS[process.env.PART ?? "1"];
  const rows = finalRows(P.table);
  console.log("total", rows[rows.length - 1].b);
  const only = process.argv[2] ? process.argv[2].split(",") : null;
  const first = ["F_CAM", "F_P1", "F_PIGEON", "F_E1", "F_E2", "F_E3", "F_S21"];
  const todo = rows.filter((r) => r.kind === "src").sort((x, y) => (first.includes(y.id) ? 1 : 0) - (first.includes(x.id) ? 1 : 0));
  const browserExecutable = new URL("./chrome.sh", import.meta.url).pathname;
  const chromiumOptions = { gl: "swangle" };
  fs.mkdirSync(`${P.out}/plates`, { recursive: true });
  const t0 = Date.now();
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
  const composition = await selectComposition({ serveUrl, id: P.comp, browserExecutable, chromiumOptions });
  for (const s of todo) {
    const out = `${P.out}/plates/${s.id}.mp4`;
    if (only ? !only.includes(s.id) : fs.existsSync(out)) continue;
    const t1 = Date.now();
    await renderMedia({
      composition, serveUrl, codec: "h264", crf: 12, outputLocation: out + ".tmp.mp4", browserExecutable, chromiumOptions,
      imageFormat: "jpeg", jpegQuality: 96, concurrency: Number(process.env.CONC ?? 2), frameRange: [s.a, s.b - 1], timeoutInMilliseconds: 600000, muted: true,
      onBrowserLog: (l) => { if (l.type === "error" && !l.text.includes("404")) console.log(`[${s.id}] [error]`, l.text.slice(0, 200)); },
    });
    fs.renameSync(out + ".tmp.mp4", out);
    const n = s.b - s.a;
    console.log(`${s.id}: ${n} frames in ${((Date.now() - t1) / 1000).toFixed(0)}s (${((Date.now() - t1) / 1000 / n).toFixed(2)} s/f), total ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  console.log("ALL DONE");
}
