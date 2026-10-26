// Timmy.html -> components/webgl/kit/cato/timmy-core.js + cato.css
// usage: node scripts/gen-cato-core.mjs <path/to/Timmy.html> components/webgl/kit/cato
// Keeps the owner's geometry, rig, moves, props and decals verbatim; strips the SVG
// renderer's frame loop, dock UI and input, and records decals as 3D polygons.
import fs from 'node:fs';
const [src, outDir] = process.argv.slice(2);
const out = outDir + '/timmy-core.js';
const html = fs.readFileSync(src, 'utf8');
const rep = (s, a, b, all = false) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); return all ? s.split(a).join(b) : s.replace(a, b); };
const cut = (s, from, to, repl = '') => { const a = s.indexOf(from); if (a < 0) throw new Error('missing ' + from); const b = to === null ? s.length : s.indexOf(to, a); if (b < 0) throw new Error('missing ' + to); return s.slice(0, a) + repl + s.slice(b); };

let js = html.slice(html.indexOf("<script>\n'use strict';") + 9, html.lastIndexOf('</script>'));
js = rep(js, "'use strict';", '');
js = rep(js, "const $ = id => document.getElementById(id);", "const $ = id => host.querySelector('#' + id);");
// dock UI → mode reporting
js = cut(js, '/* ---------- UI ---------- */', '/* ---------- camera & poke input ---------- */',
  `function updateUI(id) { if (hooks.onMode) hooks.onMode(D.settle || id); }\n`);
// no pointer/wheel input on the hidden stage; no resize observer; no frame loop
js = cut(js, '/* ---------- camera & poke input ---------- */', 'function resize()',
  'let dragging = false, camVel = 0;\nfunction resetView() {}\n');
js = rep(js, "new ResizeObserver(resize).observe(stage);\nresize();", "VW = 800; VH = 600; fitCamera();");
js = rep(js, "tPoly.textContent = '—';\n", "");
js = cut(js, 'let last = performance.now()', null, '');
// decals: record bone-space polygons in world space instead of projecting them to SVG paths
js = cut(js, 'function decal(anchor, boneW, polys, toLocal, fill, alpha = 1, glow = 0, order = 0) {', 'const circle = (cx',
  `function decal(anchor, boneW, polys, toLocal, fill, alpha = 1, glow = 0, order = 0) {
  if (!SC.anchors[anchor] || alpha <= .01) return;
  for (const poly of polys) {
    if (poly.length < 3) continue;
    const pts = [];
    for (let i = 0; i < poly.length; i++) { const l = toLocal(poly[i][0], poly[i][1]); pts.push(mPt(boneW, l[0], l[1], l[2])); }
    DECALS.push({ pts, fill, alpha, glow, order });
  }
}
`);
// rename + recolour (Cato blue/white)
for (const [a, b] of [['Rivet (you)', 'Cato (you)'], ['Yes, it is Rivet.', 'Yes, it is Cato.'], ['team@rivet.bot', 'hi@cato-labs.com'],
  ["'#FF5A1F'", "'#2E4BFF'"], ["'#7DF3FF'", "'#B9C9FF'"], ['[125, 243, 255]', '[185, 201, 255]'], ['EYE_BASE = [120, 244, 255]', 'EYE_BASE = [185, 201, 255]'], ['rgb(255,90,31)', 'rgb(46,75,255)']])
  js = rep(js, a, b, true);
js = js.replace(/RIVET|Rivet/g, 'Cato');
// on the site Cato only moves when something real happens: no idle fidgets unless asked
js = rep(js, "else if (D.idleT > D.fidgetAt) {", "else if (opts.fidget && D.idleT > D.fidgetAt) {");
// on the site the page copy owns the left: cards go right of Cato's head unless only the left fits
js = rep(js, "x = left > 14 ? left : Math.min(right, VW - W - 14);",
  "x = right + W <= VW - 14 ? right : left > HUD_MIN_X ? left : Math.min(right, VW - W - 14);");

const markup = html.slice(html.indexOf('<svg id="view"'), html.indexOf('</svg>') + 6).replace('<svg id="view"', '<svg id="view" class="cato-host"');

const file = `/* eslint-disable */
// @ts-nocheck
/*
 * Cato core: the owner's Timmy.html robot ("Rivet"), verbatim — procedural
 * geometry, skeleton, rig evaluation, move library, props and face decals —
 * recoloured to Cato blue/white and renamed. Generated from Timmy.html; the
 * SVG painter, its frame loop, the dock UI and pointer input are removed.
 * three.js draws it (see CatoBody.tsx): each mesh is rigid on one bone, so a
 * mesh's world matrix is its bone's 3x4 matrix W. Decals (eyes, mouth, chest
 * core, prop screens) are recorded per frame as world-space polygons.
 * Its SVG scaffold is kept: CatoBody mounts it over the canvas and shows only
 * the cards (#gHud) and emotes (#gFx), projected with the three.js camera.
 */
export function createCatoCore(opts = {}) {
const host = document.createElement('div');
host.innerHTML = '<div id="stage">' + ${JSON.stringify(markup)} + '<nav id="dock"></nav></div>';
const hooks = { onMode: null };
const DECALS = [];
let scrub = null, HUD_MIN_X = 14;
${js}
D.attract = !!opts.attract;
/* align the engine's projection with the three.js camera (Cato-local space, CSS px),
   so the SVG cards and emotes it draws land on the WebGL body */
function syncView(v) {
  for (let i = 0; i < 3; i++) { CB.p[i] = v.p[i]; CB.f[i] = v.f[i]; CB.r[i] = v.r[i]; CB.u[i] = v.u[i]; }
  if (VW !== v.w || VH !== v.h) { VW = v.w; VH = v.h; svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); }
  FOC = (VH / 2) / Math.tan(v.fov / 2); OX = VW / 2; OY = VH / 2;
  HUD_MIN_X = v.minX ?? 14;
}
function frame(dt, view) {
  if (scrub) {
    const mv = MOVES[scrub.id];
    if (D.cur !== mv) { copyPose(D.prev, pose); D.cur = mv; D.blendT = 0; D.blendDur = .2; D.fired.clear(); D.ticks = {}; D.settle = null; D.after = null; D.resume = null; updateUI(mv.id); }
    D.t = Math.min(scrub.t, (mv.dur || 1e9) - .001) - dt;
  }
  step(dt);
  if (view) syncView(view);
  DECALS.length = 0;
  buildDecals(pose, rigOut.gx, rigOut.gy, time);
  if (view) { drawFx(dt); hudUpdate(dt); }
}
return {
  frame,
  meshes: SC.meshes, fIdx: SC.fIdx, fStart: SC.fStart, fLen: SC.fLen, fMat: SC.fMat, LP, MATS, BONES,
  decals: DECALS,
  lights: { key: KEY_C, fill: FILL_C, rim: RIM_C, sky: SKY, gnd: GND, scene: SCENE },
  led: () => LED_RGB,
  svg,
  body,
  play: id => { scrub = null; play(id); },
  scrub(id, t) { if (MOVES[id]) scrub = { id, t: Math.max(0, t) }; },
  release() { if (!scrub) return; scrub = null; toIdle(); },
  viseme(key, value) { key = String(key).replace(/^viseme_/, ''); key = VALIAS[key] || key; MOUTH.ext[key] = +value || 0; MOUTH.extT = time; },
  beat(bpm, phase = 0) { if (!(bpm > 0)) { EXT_BEAT.bpm = 0; return; } EXT_BEAT.bpm = bpm; EXT_BEAT.t0 = time - phase * 60 / bpm; EXT_BEAT.until = time + 6; },
  pointerAt(x, y, active) { pointer.x = x * VW; pointer.y = y * VH; pointer.active = active; pointer.t = time; },
  moves: () => Object.keys(MOVES),
  duration: id => (MOVES[id] && MOVES[id].dur) || 0,
  isLoop: id => !!(MOVES[id] && MOVES[id].loop),
  mode: () => D.settle || D.cur.id,
  onMode(fn) { hooks.onMode = fn; },
};
}
`;
fs.writeFileSync(out, file);

/* stage CSS for the cards and emotes, scoped under .cato-host */
const css = html.slice(html.indexOf('<style>\n/* Layout'), html.indexOf('</style>', html.indexOf('<style>\n/* Layout')));
const lines = css.split('\n');
const s0 = lines.findIndex(l => l.startsWith('#gFx text'));
const s1 = lines.findIndex(l => l.startsWith('@media (prefers-reduced-motion: reduce){.ovl'));
let body = lines.slice(s0, s1 + 1).join('\n');
body = body.replace(/(^|})([^{}@]+)\{/g, (m, pre, sel) => pre + sel.split(',').map(x => '.cato-host ' + x.trim()).join(',') + '{');
const vars = `/* GENERATED by scripts/gen-cato-core.mjs from Timmy.html. Cato card + emote styles. */
.cato-host{
  --bg:#ffffff; --ink:#0b1033; --ink-2:#56607a;
  --accent:#2e4bff; --accent-ink:#ffffff;
  --hud-bg:#ffffff; --hud-line:rgba(11,16,51,.14); --tile:#eef2ff; --cy:#2e4bff; --ok:#1E9E6A; --amb:#C98A16; --rec:#E5484D;
  --f-display:var(--font-sans); --f-ui:var(--font-sans); --f-mono:ui-monospace,"SFMono-Regular",Menlo,monospace;
  position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none;
}
.cato-host > :not(#gHud):not(#gFx):not(defs){display:none}
/* phones: Cato stands above the copy card, so the cards would cover it */
@media (max-width:759px){.cato-host #gHud{display:none}}
`;
fs.writeFileSync(outDir + '/cato.css', vars + body + '\n');
console.log('ok', file.length, body.length);
