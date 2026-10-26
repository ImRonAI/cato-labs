/* SOLSTICE BIO — "Rewind". Scrolling down runs time backwards. An epigenetic clock in the
   margin counts biological age down as you read. The approach chapter is a pinned cell: the
   four steps of the mechanism scrub through it, and the cell visibly sheds the marks of age
   (methylation spots dissolve, the membrane smooths, the nucleus brightens), but the dial
   always stops before identity is lost. Organic easing throughout. Cursor is a cell that
   divides over interactive targets. Every number here is illustrative and labelled so. */
import { boot, $, $$, el, style, release, words, onCleanup, fine, canPin, follower } from './core.js';

style(`
.sx-clock{position:fixed;left:clamp(16px,2.6vw,40px);bottom:clamp(16px,2.6vw,40px);z-index:44;pointer-events:none;display:grid;gap:6px;opacity:0;transition:opacity .8s var(--ease)}
.sx-clock.on{opacity:1}
.sx-clock .k{font:500 10px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.sx-clock .v{font-family:var(--serif);font-weight:300;font-size:44px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.sx-clock .v small{font-family:var(--sans);font-size:12px;letter-spacing:.06em;color:var(--ink-3);margin-left:6px}
.sx-clock .bar{width:160px;height:2px;background:var(--line);position:relative}
.sx-clock .bar i{position:absolute;inset:0;background:var(--sun);transform-origin:100% 50%}
.sx-clock .note{font:400 10px/1.4 var(--sans);color:var(--ink-3);max-width:24ch}
.solstice-mark{display:none!important}
.sx-cellwrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,5vw,80px);align-items:center;min-height:100vh}
.sx-cellwrap .steps{border-top:0}
.sx-cellwrap .step{grid-template-columns:48px 1fr!important;padding:22px 0!important;opacity:.28;transition:opacity .6s var(--ease)}
.sx-cellwrap .step.cur{opacity:1}
.sx-cellwrap .step .n{grid-column:1!important}
.sx-cellwrap .step h3,.sx-cellwrap .step p{grid-column:2!important}
.sx-cellwrap .step p{font-size:14.5px}
.sx-cell{position:relative;aspect-ratio:1;width:100%;max-height:78vh}
.sx-cell svg{width:100%;height:100%;overflow:visible}
.sx-cell .lbl{position:absolute;left:0;right:0;bottom:-8px;display:flex;justify-content:space-between;font:500 10.5px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.sx-cell .lbl b{font-weight:500;color:var(--sun)}
.sx-w{display:inline-block;overflow:hidden;vertical-align:top;padding:.06em .02em .12em;margin:-.06em -.02em -.12em}
.sx-wi{display:inline-block;will-change:transform}
.track i{transition:none!important}
.track i.on{background:var(--ink)}
.sx-dot{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .4s}
.sx-dot.is-on{opacity:1}.sx-dot.is-off{opacity:0}
.sx-dot i{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;border:1px solid var(--ink);background:rgba(184,101,31,.12);transition:transform .7s var(--ease)}
.sx-dot i + i{opacity:0}
.sx-dot.split i:first-child{transform:translateX(-9px) scale(.8)}
.sx-dot.split i + i{opacity:1;transform:translateX(9px) scale(.8)}
@media (hover:hover) and (pointer:fine){html.sx-cursor, html.sx-cursor a, html.sx-cursor button{cursor:none}}
html.sx-cursor #concierge-root, html.sx-cursor #concierge-root *{cursor:auto}
@media (max-width:860px){.sx-cellwrap{grid-template-columns:1fr;min-height:0}.sx-cell{max-height:60vh}.sx-clock{display:none}}
`);

const NS = 'http://www.w3.org/2000/svg';

function blobPath(cx, cy, r, rough, t, n = 72) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + rough * (Math.sin(a * 5 + t) * 0.05 + Math.sin(a * 9 - t * 1.3) * 0.035 + Math.sin(a * 13 + t * 0.7) * 0.02);
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r * k).toFixed(2) + ' ' + (cy + Math.sin(a) * r * k).toFixed(2);
  }
  return d + 'Z';
}

function cellChapter(gsap, ScrollTrigger, section) {
  const wrap = $('.wrap', section);
  const steps = $('.steps', section);
  if (!wrap || !steps) return;
  const host = el('div', 'sx-cellwrap');
  steps.before(host);
  const cell = el('div', 'sx-cell');
  cell.setAttribute('role', 'img');
  cell.setAttribute('aria-label', 'Illustration of a cell during transient reprogramming: age-associated marks clear while the cell keeps its identity.');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 400');
  const marks = Array.from({ length: 46 }, () => {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 120;
    return { x: 200 + Math.cos(a) * r, y: 200 + Math.sin(a) * r, s: 2 + Math.random() * 4.5, at: Math.random() };
  });
  svg.innerHTML = `
    <defs><radialGradient id="sxN" cx="45%" cy="40%"><stop offset="0" stop-color="#f6ead9"/><stop offset=".6" stop-color="#d99a5a"/><stop offset="1" stop-color="#b8651f"/></radialGradient>
    <radialGradient id="sxC" cx="50%" cy="45%"><stop offset="0" stop-color="#f3efe7"/><stop offset="1" stop-color="#e2dccf"/></radialGradient></defs>
    <path class="mem" fill="url(#sxC)" stroke="#17181a" stroke-width="1"/>
    <path class="mem2" fill="none" stroke="#17181a" stroke-opacity=".25" stroke-width=".6"/>
    <g class="marks">${marks.map((m) => `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="${m.s.toFixed(1)}" fill="#4a4b4f"/>`).join('')}</g>
    <g class="mrna"></g>
    <path class="nuc" fill="url(#sxN)" stroke="#17181a" stroke-width=".8"/>
    <circle class="halo" cx="200" cy="200" r="70" fill="none" stroke="#b8651f" stroke-width="1" opacity="0"/>`;
  cell.appendChild(svg);
  const lbl = el('div', 'lbl', '<span>Aged</span><b>Illustrative</b><span>Younger</span>');
  lbl.setAttribute('aria-hidden', 'true');
  cell.appendChild(lbl);
  host.append(cell, steps);

  const mem = $('.mem', svg), mem2 = $('.mem2', svg), nuc = $('.nuc', svg), halo = $('.halo', svg);
  const dots = $$('.marks circle', svg);
  const mrna = $('.mrna', svg);
  // mRNA strands enter from the edge on step 1 and degrade by step 3 (transient by design).
  const strands = Array.from({ length: 7 }, (_, i) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', '#b8651f');
    p.setAttribute('stroke-width', '1.2');
    p.setAttribute('stroke-linecap', 'round');
    mrna.appendChild(p);
    return { p, a: (i / 7) * Math.PI * 2 + 0.3 };
  });
  const stepEls = $$('.step', steps);
  stepEls.forEach(release);
  let prog = 0;
  let t = 0;
  const draw = () => {
    const rough = 1 - Math.min(1, prog * 1.15); // membrane smooths
    mem.setAttribute('d', blobPath(200, 200, 160, 1.6 * rough + 0.25, t * 0.6));
    mem2.setAttribute('d', blobPath(200, 200, 150, 1.2 * rough + 0.2, t * 0.6 + 1));
    nuc.setAttribute('d', blobPath(200, 200, 58 + prog * 8, 0.8 * rough + 0.15, t));
    nuc.style.opacity = String(0.55 + prog * 0.45);
    // the dial stops before pluripotency: the halo shows the limit
    halo.setAttribute('opacity', String(Math.max(0, (prog - 0.85) * 5) * (0.6 + Math.sin(t * 3) * 0.2)));
    dots.forEach((d, i) => {
      const gone = prog > 0.25 + marks[i].at * 0.6;
      d.setAttribute('opacity', gone ? '0' : String(0.55 + Math.sin(t + i) * 0.1));
    });
    const life = prog < 0.25 ? prog / 0.25 : prog < 0.55 ? 1 : Math.max(0, 1 - (prog - 0.55) / 0.2);
    strands.forEach(({ p, a }, i) => {
      const r0 = 175 - life * 70, r1 = r0 - 26 * life;
      const w = Math.sin(t * 2 + i) * 6;
      const x0 = 200 + Math.cos(a) * r0, y0 = 200 + Math.sin(a) * r0;
      const x1 = 200 + Math.cos(a + 0.12) * r1 + w, y1 = 200 + Math.sin(a + 0.12) * r1 - w;
      p.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} Q ${(200 + Math.cos(a + 0.06) * (r0 - 13) - w).toFixed(1)} ${(200 + Math.sin(a + 0.06) * (r0 - 13) + w).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`);
      p.setAttribute('opacity', String(life));
    });
    const cur = Math.min(stepEls.length - 1, Math.floor(prog * stepEls.length));
    stepEls.forEach((s, i) => s.classList.toggle('cur', i === cur));
  };
  const tick = (_a, dt) => {
    t += dt / 1000;
    draw();
  };
  gsap.ticker.add(tick);
  onCleanup(() => gsap.ticker.remove(tick));
  if (canPin()) ScrollTrigger.create({ trigger: host, start: 'top top', end: '+=220%', pin: true, scrub: 0.8, onUpdate: (s) => (prog = s.progress) });
  else {
    stepEls.forEach((s) => s.classList.add('cur'));
    ScrollTrigger.create({ trigger: host, start: 'top 70%', end: 'bottom 30%', scrub: true, onUpdate: (s) => (prog = s.progress) });
  }
}

function epiClock(gsap, ScrollTrigger) {
  const c = el('div', 'sx-clock', '<span class="k">Epigenetic age · illustrative</span><span class="v"><b>72.0</b><small>yrs</small></span><span class="bar"><i></i></span><span class="note">Runs backwards as you read. Not a clinical figure.</span>');
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const v = $('b', c);
  const bar = $('.bar i', c);
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (s) => {
      // Rewinds 72 → 54, and holds there: transient, partial, never all the way back.
      const age = 72 - 18 * Math.min(1, s.progress / 0.85);
      v.textContent = age.toFixed(1);
      bar.style.transform = `scaleX(${1 - s.progress * 0.25})`;
      const sci = document.querySelector('.sx-cellwrap');
      const r = sci?.getBoundingClientRect();
      const overCell = !!r && r.top < innerHeight * 0.9 && r.bottom > innerHeight * 0.1;
      c.classList.toggle('on', s.progress > 0.03 && s.progress < 0.98 && !overCell);
    },
  });
}

/* Headings grow in: words rise from below with a soft, organic overshoot. */
function grow(gsap, h) {
  const ws = words(h, { wrap: 'sx-w', inner: 'sx-wi' });
  if (!ws.length) return;
  gsap.set(ws, { yPercent: 110 });
  gsap.to(ws, { yPercent: 0, duration: 1.6, ease: 'elastic.out(1,0.75)', stagger: 0.05, scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
}

async function run() {
  const ctx = await boot({ lenis: { lerp: 0.07 } }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  epiClock(gsap, ScrollTrigger);

  $$('main .t-h2').forEach((h) => {
    release(h);
    grow(gsap, h);
  });
  $$('main .head .lede').forEach((p) => {
    release(p);
    gsap.from(p, { opacity: 0, y: 30, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 88%', once: true } });
  });

  const science = $('#science');
  if (science) cellChapter(gsap, ScrollTrigger, science);

  // Pipeline: each programme's track fills stage by stage, like a culture spreading.
  $$('.prog').forEach((row, r) => {
    release(row.closest('.reveal'));
    const marks = $$('.track i', row);
    const on = marks.map((m) => m.classList.contains('on'));
    marks.forEach((m) => m.classList.remove('on', 'cur'));
    const curIdx = on.lastIndexOf(true);
    ScrollTrigger.create({
      trigger: row,
      start: 'top 85%',
      once: true,
      onEnter: () =>
        on.forEach((v, i) => {
          if (!v) return;
          setTimeout(() => {
            marks[i].classList.add('on');
            if (i === curIdx) marks[i].classList.add('cur');
            gsap.fromTo(marks[i], { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.7, ease: 'power3.out' });
          }, 200 + r * 120 + i * 320);
        }),
    });
    gsap.from(row, { opacity: 0, y: 24, duration: 1.2, ease: 'power3.out', delay: r * 0.08, scrollTrigger: { trigger: row, start: 'top 90%', once: true } });
  });

  // People: portraits bloom open from the centre, like a cell under a coverslip.
  $$('.person').forEach((p, i) => {
    release(p);
    const por = $('.portrait', p);
    if (por) gsap.from(por, { clipPath: 'circle(0% at 50% 50%)', duration: 1.8, ease: 'expo.inOut', delay: i * 0.12, scrollTrigger: { trigger: p, start: 'top 85%', once: true } });
  });

  if (fine) {
    document.documentElement.classList.add('sx-cursor');
    const d = el('div', 'sx-dot', '<i></i><i></i>');
    d.setAttribute('aria-hidden', 'true');
    follower(gsap, d, { duration: 0.55, onMove: (_e, t) => d.classList.toggle('split', !!t?.closest('a, button, input, select, textarea, label')) });
  }
}

run();
