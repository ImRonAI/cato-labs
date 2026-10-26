/* HELIOS GRID — "Field". Precise and engineered. The thesis becomes a pinned instrument:
   scroll turns the field up from 5.3 T to 22.4 T, the D-shaped flux surfaces tighten and the
   core visibly shrinks to one sixteenth of its volume while the P ∝ B⁴ readout climbs. Figures
   roll like mechanical counters. The programme line charges like a busbar.
   Cursor is a crosshair with a live coordinate. Native scroll — an instrument shouldn't float. */
import { boot, $, $$, el, style, release, onCleanup, fine, canPin, follower } from './core.js';

style(`
.hx-inst{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:clamp(32px,5vw,88px);align-items:center;min-height:100vh;padding-block:96px}
.hx-inst .thesis-big{max-width:22ch}
.hx-plot{position:relative;aspect-ratio:1/1;max-height:76vh;width:100%;justify-self:end}
.hx-plot svg{width:100%;height:100%;overflow:visible}
.hx-plot .grid line{stroke:var(--line);stroke-width:.6}
.hx-plot .axis{stroke:var(--ink-3);stroke-width:.6}
.hx-plot .surf{fill:none;stroke:var(--ember);vector-effect:non-scaling-stroke}
.hx-plot .core{fill:rgba(184,82,31,.08);stroke:var(--ink);stroke-width:1;vector-effect:non-scaling-stroke}
.hx-plot .ghost{fill:none;stroke:var(--ink-3);stroke-width:.8;stroke-dasharray:3 4;vector-effect:non-scaling-stroke}
.hx-plot text{font:500 10px var(--sans);letter-spacing:.08em;fill:var(--ink-3)}
.hx-read{display:grid;grid-template-columns:repeat(3,auto);gap:12px 36px;margin-top:40px;padding-top:24px;border-top:1px solid var(--line)}
.hx-read dt{font:500 10.5px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.hx-read dd{margin:6px 0 0;font-family:var(--serif);font-weight:300;font-size:clamp(30px,3vw,46px);line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.hx-read dd small{font-family:var(--sans);font-size:12px;letter-spacing:.06em;color:var(--ink-3);margin-left:4px}
.hx-read dd.em{color:var(--ember)}
.hx-gauge{height:2px;background:var(--line);margin-top:28px;position:relative}
.hx-gauge i{position:absolute;inset:0;background:var(--ember);transform-origin:0 50%;transform:scaleX(0)}
.hx-gauge span{position:absolute;top:10px;font:500 10px var(--sans);letter-spacing:.1em;color:var(--ink-3);transform:translateX(-50%)}
.thesis-big .w{transition:none!important}
.hx-odo{display:inline-flex;overflow:hidden;height:1em;line-height:1;vertical-align:-.08em}
.hx-odo .col{display:inline-flex;flex-direction:column;will-change:transform}
.hx-odo .col span{height:1em;display:block}
.prog-line::after{content:"";position:absolute;left:0;right:0;top:7px;height:1px;background:var(--ember);transform-origin:0 50%;transform:scaleX(var(--hx-charge,0));box-shadow:0 0 12px rgba(217,122,63,.8)}
.prog-step .hx-spark{position:absolute;left:-6px;top:-6px;width:27px;height:27px;border-radius:50%;border:1px solid var(--ember);opacity:0;pointer-events:none}
.hx-cross{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .25s}
.hx-cross.is-on{opacity:1}.hx-cross.is-off{opacity:0}
.hx-cross::before,.hx-cross::after{content:"";position:absolute;background:var(--ink)}
.hx-cross::before{left:-14px;width:28px;top:0;height:1px}
.hx-cross::after{top:-14px;height:28px;left:0;width:1px}
.hx-cross b{position:absolute;left:12px;top:10px;font:500 9.5px/1 var(--sans);letter-spacing:.08em;color:var(--ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.hx-cross.hot::before,.hx-cross.hot::after{background:var(--ember)}
.hx-cross.hot b{color:var(--ember)}
.hx-hline,.hx-vline{position:fixed;z-index:9999;pointer-events:none;background:rgba(23,25,28,.07);opacity:0;transition:opacity .25s}
.hx-hline{left:0;right:0;height:1px;top:0}.hx-vline{top:0;bottom:0;width:1px;left:0}
.hx-on .hx-hline,.hx-on .hx-vline{opacity:1}
@media (hover:hover) and (pointer:fine){html.hx-cursor, html.hx-cursor a, html.hx-cursor button{cursor:none}}
html.hx-cursor #concierge-root, html.hx-cursor #concierge-root *{cursor:auto}
@media (max-width:860px){.hx-inst{grid-template-columns:1fr;min-height:0}}
`);

const NS = 'http://www.w3.org/2000/svg';
// Miller-parameterised D-shaped flux surface (κ elongation, δ triangularity) as an SVG path.
function dshape(cx, cy, a, k = 1.75, d = 0.38, n = 96) {
  let s = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = cx + a * Math.cos(t + d * Math.sin(t));
    const y = cy - a * k * Math.sin(t);
    s += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return s + 'Z';
}

function instrument(gsap, ScrollTrigger, thesis) {
  const wrap = $('.wrap', thesis);
  const big = $('.thesis-big', thesis);
  const eyebrow = $('.eyebrow', thesis);
  const notes = $('.thesis-notes', thesis);
  const inst = el('div', 'hx-inst');
  const left = el('div');
  left.append(eyebrow, big);
  const read = el('dl', 'hx-read');
  read.setAttribute('aria-hidden', 'true');
  read.innerHTML = '<div><dt>Field on axis</dt><dd class="em"><b data-k="b">11.2</b><small>T</small></dd></div><div><dt>Power density</dt><dd><b data-k="p">1</b><small>×</small></dd></div><div><dt>Core volume</dt><dd><b data-k="v">1</b><small>×</small></dd></div>';
  const gauge = el('div', 'hx-gauge', '<i></i><span style="left:0">11.2 T</span><span style="left:50%">16.8 T</span><span style="left:100%">22.4 T</span>');
  gauge.setAttribute('aria-hidden', 'true');
  left.append(read, gauge);
  const plot = el('div', 'hx-plot');
  plot.setAttribute('role', 'img');
  plot.setAttribute('aria-label', 'Diagram: as the toroidal field doubles twice, the plasma cross-section shrinks to one sixteenth of its volume for the same output.');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 400');
  let gridLines = '';
  for (let i = 0; i <= 8; i++) gridLines += `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="400"/><line x1="0" y1="${i * 50}" x2="400" y2="${i * 50}"/>`;
  svg.innerHTML = `<g class="grid">${gridLines}</g><line class="axis" x1="70" y1="0" x2="70" y2="400"/><text x="76" y="14">Z</text><text x="380" y="392">R</text>
    <path class="ghost" d="${dshape(230, 200, 95)}"/><g class="surfs"></g><path class="core" d=""/><text class="lab-b" x="76" y="392">B = 11.2 T</text>`;
  plot.appendChild(svg);
  inst.append(left, plot);
  wrap.prepend(inst);
  if (notes) wrap.appendChild(notes);

  const surfs = $('.surfs', svg);
  const N = 9;
  const paths = Array.from({ length: N }, () => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', 'surf');
    surfs.appendChild(p);
    return p;
  });
  const core = $('.core', svg);
  const lab = $('.lab-b', svg);
  const out = { b: $('[data-k="b"]', read), p: $('[data-k="p"]', read), v: $('[data-k="v"]', read) };
  const fill = $('i', gauge);
  const ws = $$('.w', big);
  ws.forEach((w) => w.classList.remove('on'));

  const draw = (p, t) => {
    // The thesis: P ∝ B⁴. Doubling B (11.2 → 22.4 T) gives 16× the power density,
    // so the same output needs one sixteenth of the volume.
    const B = 11.2 * (1 + p);
    const gain = Math.pow(B / 11.2, 4);
    const vol = 1 / gain;
    const a = 95 * Math.cbrt(vol);
    core.setAttribute('d', dshape(230 - (95 - a) * 0.35, 200, a));
    paths.forEach((path, i) => {
      const f = (i + 1) / (N + 1);
      const wobble = Math.sin(t * 2.2 + i) * (1 - p) * 1.4;
      path.setAttribute('d', dshape(230 - (95 - a) * 0.35 * f, 200, a * f + wobble, 1.75 - 0.25 * (1 - f), 0.38 * f));
      path.style.strokeWidth = String(0.5 + p * 0.9);
      path.style.opacity = String(0.25 + 0.6 * f * (0.4 + p * 0.6));
    });
    out.b.textContent = B.toFixed(1);
    out.p.textContent = gain.toFixed(gain < 10 ? 1 : 0);
    out.v.textContent = vol >= 0.995 ? '1' : '1/' + (1 / vol).toFixed(1 / vol < 10 ? 1 : 0);
    lab.textContent = `B = ${B.toFixed(1)} T`;
    fill.style.transform = `scaleX(${p})`;
    const n = Math.floor(p * ws.length * 1.05);
    ws.forEach((w, i) => w.classList.toggle('on', i < n));
  };
  let prog = 0;
  let t = 0;
  draw(0, 0);
  const tick = (_a, dt) => {
    t += dt / 1000;
    draw(prog, t);
  };
  gsap.ticker.add(tick);
  onCleanup(() => gsap.ticker.remove(tick));
  if (canPin()) {
    ScrollTrigger.create({ trigger: inst, start: 'top top', end: '+=160%', pin: true, scrub: true, onUpdate: (s) => (prog = s.progress) });
  } else {
    ScrollTrigger.create({ trigger: inst, start: 'top 80%', end: 'bottom 40%', scrub: true, onUpdate: (s) => (prog = s.progress) });
  }
}

/* Mechanical odometer: each digit rolls through its column to the target. */
function odometer(gsap, ScrollTrigger, node) {
  const text = node.textContent.trim();
  if (!/\d/.test(text)) return;
  node.setAttribute('aria-label', text);
  node.textContent = '';
  const cols = [];
  for (const ch of text) {
    if (/\d/.test(ch)) {
      const box = el('span', 'hx-odo');
      box.setAttribute('aria-hidden', 'true');
      const col = el('span', 'col');
      const target = Number(ch);
      const turns = 2;
      for (let k = 0; k <= turns * 10 + target; k++) col.appendChild(el('span', '', String(k % 10)));
      box.appendChild(col);
      node.appendChild(box);
      cols.push({ col, steps: turns * 10 + target });
    } else {
      const s = el('span', '', ch);
      s.setAttribute('aria-hidden', 'true');
      node.appendChild(s);
    }
  }
  ScrollTrigger.create({
    trigger: node,
    start: 'top 92%',
    once: true,
    onEnter: () => cols.forEach(({ col, steps }, i) => gsap.to(col, { yPercent: (-100 * steps) / (steps + 1), duration: 1.6 + i * 0.18, ease: 'power4.inOut' })),
  });
}

async function run() {
  // Native scrolling: the instrument should feel direct, not floaty.
  const ctx = await boot({ lenis: false }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  const thesis = $('#thesis');
  if (thesis) instrument(gsap, ScrollTrigger, thesis);

  $$('.tech-item .spec b, .prog-step .yr, .basis td.tnum, .hero .tnum').forEach((n) => {
    release(n.closest('.reveal'));
    odometer(gsap, ScrollTrigger, n);
  });

  // Headings: a precise horizontal sweep, like a plotter drawing them.
  $$('#tech-h, #prog-h, #part-h, #contact-h').forEach((h) => {
    release(h);
    gsap.fromTo(h, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'power3.inOut', scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
  });

  // Tech list: each row draws its rule then its content.
  $$('.tech-item').forEach((it) => {
    release(it);
    gsap.from(it, { '--hx-r': 0, opacity: 0, y: 24, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: it, start: 'top 88%', once: true } });
  });

  // Programme: the busbar charges with scroll; each milestone sparks as current reaches it.
  const line = $('.prog-line');
  if (line) {
    const steps = $$('.prog-step', line);
    steps.forEach((s) => {
      release(s);
      s.appendChild(Object.assign(el('span', 'hx-spark'), { ariaHidden: 'true' }));
    });
    const fired = new Set();
    ScrollTrigger.create({
      trigger: line,
      start: 'top 75%',
      end: 'bottom 45%',
      scrub: true,
      onUpdate: (s) => {
        line.style.setProperty('--hx-charge', s.progress.toFixed(3));
        steps.forEach((st, i) => {
          const at = i / Math.max(1, steps.length - 1);
          if (s.progress >= at - 0.01 && !fired.has(i)) {
            fired.add(i);
            gsap.fromTo($('.hx-spark', st), { scale: 0.6, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.9, ease: 'expo.out' });
          }
          if (s.progress < at - 0.02) fired.delete(i);
        });
      },
    });
  }

  // Audience columns rise like bars on a chart.
  const aud = $$('.aud-item');
  if (aud.length) {
    aud.forEach(release);
    gsap.from(aud, { clipPath: 'inset(100% 0 0 0)', duration: 1.2, ease: 'power3.inOut', stagger: 0.14, scrollTrigger: { trigger: aud[0], start: 'top 85%', once: true } });
  }

  if (fine) {
    document.documentElement.classList.add('hx-cursor');
    const c = el('div', 'hx-cross', '<b></b>');
    const hl = el('div', 'hx-hline');
    const vl = el('div', 'hx-vline');
    [c, hl, vl].forEach((n) => n.setAttribute('aria-hidden', 'true'));
    document.body.append(hl, vl);
    const b = $('b', c);
    follower(gsap, c, {
      duration: 0.08,
      onMove: (e, t) => {
        hl.style.transform = `translateY(${e.clientY}px)`;
        vl.style.transform = `translateX(${e.clientX}px)`;
        document.documentElement.classList.toggle('hx-on', !t?.closest('#concierge-root'));
        const hot = !!t?.closest('a, button, input, select, textarea, label');
        c.classList.toggle('hot', hot);
        b.textContent = hot ? 'SELECT' : `R ${(e.clientX / innerWidth * 2).toFixed(3)}  Z ${((0.5 - e.clientY / innerHeight) * 1.6).toFixed(3)}`;
      },
    });
    onCleanup(() => {
      hl.remove();
      vl.remove();
    });
  }
}

run();
