// 2D layer: previz slug, temp dialogue subtitles, and the Episode 1 vote graphic (S30).
const TAG = { kai: ['KAI', '#ff8a3d'], ruth: ['RUTH', '#7fe0a8'], lucy: ['LUCY', '#ffd34d'], wren: ['WREN', '#9fd8ff'], pa: ['PA', '#cfcfcf'] };
const FX = { vo: ' (V.O.)', vo_whisper: ' (V.O.)', radio: ' (RADIO)', radio_loud: ' (RADIO)', phone: ' (VOICEMAIL)', steel: ' (O.S.)', steel_w: ' (O.S.)' };
const FONT = '"DejaVu Sans Condensed", "Liberation Sans Narrow", "DejaVu Sans", sans-serif';

function wrap(g, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const nxt = cur ? cur + ' ' + w : w; if (g.measureText(nxt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = nxt; }
  if (cur) lines.push(cur); return lines;
}
function outlined(g, text, x, y, fill, lw) { g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y); }

export function drawOverlay(g, W, H, t, st, timing) {
  const s = H / 1920;
  // slug
  g.font = `${Math.round(22 * s)}px "DejaVu Sans Mono", monospace`; g.textBaseline = 'top'; g.textAlign = 'left';
  g.fillStyle = 'rgba(255,255,255,0.55)';
  const tc = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  g.fillText(`PREVIZ  S${String(st.shot).padStart(2, '0')}  ${tc}`, 40 * s, 120 * s);
  g.textAlign = 'right'; g.fillText('THE LAST TRAIN · EP1', W - 40 * s, 120 * s); g.textAlign = 'left';

  if (st.split) { vote(g, W, H, s, t, st); return; }
  // temp subtitles
  const act = timing.filter(l => t >= l.start - 0.05 && t <= l.end + 0.35);
  let y = H * 0.705;
  for (const l of act) {
    const [name, col] = TAG[l.who] || [l.who.toUpperCase(), '#fff'];
    g.font = `bold ${Math.round(26 * s)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    outlined(g, name + (FX[l.fx] || ''), W / 2, y, col, 6 * s);
    g.font = `${l.fx.startsWith('vo') ? 'italic ' : ''}bold ${Math.round(40 * s)}px ${FONT}`;
    for (const ln of wrap(g, l.text, W * 0.84)) { y += 50 * s; outlined(g, ln, W / 2, y, '#ffffff', 8 * s); }
    y += 46 * s;
  }
  g.textAlign = 'left';
}

function vote(g, W, H, s, t, st) {
  const e = st.splitP ?? 1, a = Math.min(1, e * 1.2);
  if (st.black) return;
  g.save(); g.globalAlpha = a;
  // panel tints + divider
  g.fillStyle = 'rgba(215,38,46,0.20)'; g.fillRect(0, 0, W / 2, H);
  g.fillStyle = 'rgba(255,154,31,0.18)'; g.fillRect(W / 2, 0, W / 2, H);
  g.fillStyle = '#000'; g.fillRect(W / 2 - 4 * s, 0, 8 * s, H);
  // title
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `bold ${Math.round(44 * s)}px ${FONT}`; outlined(g, 'THE LAST TRAIN', W / 2, 330 * s, '#ffffff', 8 * s);
  // letters (pulse with heartbeat)
  const beat = 1 + 0.05 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.4)), 8);
  for (const [x, L, col] of [[W / 4, 'A', '#ff3b3b'], [W * 3 / 4, 'B', '#ffa22e']]) {
    g.save(); g.translate(x, 640 * s); g.scale(beat, beat);
    g.font = `900 ${Math.round(260 * s)}px ${FONT}`; outlined(g, L, 0, 0, col, 14 * s); g.restore();
  }
  // phone in panel B
  if (st.phoneCanvas) { const pw = 150 * s, ph = pw * 520 / 256; g.drawImage(st.phoneCanvas, W * 3 / 4 - pw / 2, 760 * s, pw, ph); }
  g.font = `bold ${Math.round(56 * s)}px ${FONT}`;
  outlined(g, 'OPEN', W / 4, 1170 * s, '#fff', 10 * s); outlined(g, 'THE DOOR', W / 4, 1236 * s, '#fff', 10 * s);
  outlined(g, 'RUN FOR', W * 3 / 4, 1170 * s, '#fff', 10 * s); outlined(g, 'THE SHUTTER', W * 3 / 4, 1236 * s, '#fff', 10 * s);
  g.font = `bold ${Math.round(40 * s)}px ${FONT}`;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(80 * s, 1330 * s, W - 160 * s, 84 * s);
  outlined(g, 'YOUR CHOICE BECOMES PART 2', W / 2, 1386 * s, '#ffffff', 6 * s);
  g.restore(); g.textAlign = 'left';
}
