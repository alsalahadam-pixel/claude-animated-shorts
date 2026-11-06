// Assemble the final cut: plates + reused V3 chunks + black, the text overlay on top, the final mix.
// usage: node scripts/assemble_final.mjs   (needs out/final/plates/*, out/chunks/<reused>.mp4, out/final/overlay.mov, audio/mix_final.wav)
//        PART=2 node scripts/assemble_final.mjs   (out/part2/plates/*, out/part2/overlay.mov, audio/mix_part2.wav -> out/last_human_PART2.mp4)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { finalRows, PARTS } from "./render_final.mjs";
const two = process.env.PART === "2", P = PARTS[two ? 2 : 1];
const rows = finalRows(P.table);
const total = rows[rows.length - 1].b;
const inputs = [], labels = [];
for (const r of rows) {
  let file;
  if (r.kind === "black") {
    file = `${P.out}/black_${r.b - r.a}.mp4`;
    if (!fs.existsSync(file)) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=black:s=1080x1920:r=30`, "-frames:v", String(r.b - r.a), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12", file]);
  } else file = r.reuse ? `out/chunks/${r.reuse}.mp4` : `${P.out}/plates/${r.id}.mp4`;
  if (!fs.existsSync(file)) throw new Error("missing " + file);
  inputs.push("-i", file);
  labels.push(`[${labels.length}:v]setpts=PTS-STARTPTS,fps=30,format=yuv420p,trim=end_frame=${r.b - r.a}[v${labels.length}]`);
}
const n = labels.length;
const filter = labels.join(";") + ";" + Array.from({ length: n }, (_, i) => `[v${i}]`).join("") + `concat=n=${n}:v=1:a=0[base];` +
  `[${n}:v]format=yuva444p10le[ov];[base][ov]overlay=0:0:format=auto,format=yuv420p[out]`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-i", `${P.out}/overlay.mov`, "-i", two ? "audio/mix_part2.wav" : "audio/mix_final.wav", "-filter_complex", filter,
  "-map", "[out]", "-map", `${n + 1}:a:0`, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2", "-r", "30",
  "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", "-frames:v", String(total), two ? "out/last_human_PART2.mp4" : "out/last_human_FINAL.mp4"], { stdio: "inherit" });
console.log(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames,width,height,r_frame_rate", "-of", "csv=p=0", two ? "out/last_human_PART2.mp4" : "out/last_human_FINAL.mp4"]).toString());
