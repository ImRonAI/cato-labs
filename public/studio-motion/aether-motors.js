/* AETHER — "Wind tunnel". Everything travels left to right like air over a body.
   The engineering chapter becomes a pinned horizontal track; figures accelerate from zero
   the way the car does; the aero photograph gets live smoke streamlines that part around the
   pointer; headings blow in with motion blur. Cursor is a velocity readout. */
import { boot, $, $$, el, style, release, chars, follower, onCleanup, fine, canPin, whileVisible } from './core.js';

style(`
.ax-blow{display:inline-block;will-change:transform,filter}
.ax-track-wrap{overflow:hidden}
.ax-track{display:flex;gap:0;will-change:transform}
.ax-track > .eng-item{flex:0 0 min(62vw,860px);display:grid;grid-template-columns:1fr;grid-template-rows:auto auto 1fr auto;gap:28px;align-content:start;padding:56px 56px 48px 0;margin-right:56px;border-bottom:0!important;border-right:1px solid var(--line);min-height:62vh}
.ax-track > .eng-item .idx{font-size:clamp(80px,9vw,150px)!important;line-height:.8;color:transparent!important;-webkit-text-stroke:1px var(--bone-3);font-style:italic}
.ax-track > .eng-item .fig{font-family:var(--serif);font-weight:300;font-size:clamp(56px,6vw,104px)!important;line-height:1;letter-spacing:-.02em;align-self:end}
.ax-track > .eng-item .h3{font-size:clamp(30px,2.8vw,44px)!important}
.ax-track > .eng-item .body{max-width:38ch;font-size:17px}
.ax-track > .ax-cut{flex:0 0 min(78vw,1180px);margin-right:56px;align-self:center}
.ax-track > .ax-cut figure{margin:0!important}
.ax-hud{display:flex;justify-content:space-between;align-items:center;gap:24px;margin:28px 0 0;padding-top:18px;border-top:1px solid var(--line);font:400 11px/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--bone-3)}
.ax-hud .bar{flex:1;height:1px;background:var(--line);position:relative;overflow:hidden}
.ax-hud .bar i{position:absolute;inset:0;background:var(--bone);transform-origin:0 50%;transform:scaleX(0)}
.ax-hud b{font-weight:400;color:var(--bone);font-variant-numeric:tabular-nums;min-width:7ch;text-align:right}
.ax-smoke{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;mix-blend-mode:screen}
.aero-fig svg{opacity:.0!important}
.aero-fig .ax-probe{position:absolute;left:16px;bottom:14px;z-index:3;font:400 10px/1.5 var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--bone-2);font-variant-numeric:tabular-nums;pointer-events:none}
.aero-fig .ax-probe b{color:var(--bone);font-weight:400}
.figures .num{font-variant-numeric:tabular-nums}
.ax-speed{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .3s}
.ax-speed.is-on{opacity:1}.ax-speed.is-off{opacity:0}
.ax-speed .ring{position:absolute;left:-16px;top:-16px;width:32px;height:32px;border:1px solid var(--bone);border-radius:50%;transition:transform .4s var(--ease)}
.ax-speed .tail{position:absolute;right:16px;top:-.5px;height:1px;width:0;background:linear-gradient(90deg,transparent,var(--bone));transform-origin:100% 50%}
.ax-speed .v{position:absolute;left:24px;top:-18px;font:400 9px/1 var(--sans);letter-spacing:.2em;color:var(--bone-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.ax-speed.hot .ring{transform:scale(1.9);background:rgba(236,232,223,.08)}
@media (hover:hover) and (pointer:fine){html.ax-cursor, html.ax-cursor a, html.ax-cursor button{cursor:none}}
html.ax-cursor #concierge-root, html.ax-cursor #concierge-root *{cursor:auto}
.ax-wipe{position:fixed;inset:0;z-index:9000;pointer-events:none;background:var(--bone);transform:scaleX(0);transform-origin:0 50%}
`);

function blowIn(gsap, heading) {
  const cs = chars(heading, { cls: 'ax-blow' });
  if (!cs.length) return;
  gsap.set(cs, { x: -140, opacity: 0, skewX: -30, filter: 'blur(8px)' });
  gsap.to(cs, {
    x: 0,
    opacity: 1,
    skewX: 0,
    filter: 'blur(0px)',
    duration: 1.1,
    ease: 'expo.out',
    stagger: { each: 0.018, from: 'start' },
    scrollTrigger: { trigger: heading, start: 'top 86%', once: true },
  });
}

function countUp(gsap, ScrollTrigger, num) {
  const small = num.querySelector('small');
  const text = num.firstChild && num.firstChild.nodeType === 3 ? num.firstChild : null;
  if (!text) return;
  const raw = text.textContent.trim();
  const target = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(target)) return;
  const dec = (raw.split('.')[1] || '').length;
  num.setAttribute('aria-label', num.textContent.replace(/\s+/g, ' ').trim());
  const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const o = { v: 0 };
  text.textContent = fmt(0);
  // 0–100 in 1.89 s: every figure "launches" over exactly that long.
  ScrollTrigger.create({
    trigger: num,
    start: 'top 88%',
    once: true,
    onEnter: () => gsap.to(o, { v: target, duration: 1.89, ease: 'power4.out', onUpdate: () => (text.textContent = fmt(o.v)) }),
  });
  if (small) small.style.opacity = '1';
}

function smoke(gsap, fig) {
  const c = el('canvas', 'ax-smoke');
  c.setAttribute('aria-hidden', 'true');
  fig.appendChild(c);
  const probe = el('div', 'ax-probe', 'Probe <b>—</b><br>Flow <b>250 km/h</b>');
  probe.setAttribute('aria-hidden', 'true');
  fig.appendChild(probe);
  const pb = $('b', probe);
  const ctx = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const size = () => {
    W = fig.clientWidth;
    H = fig.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(fig);
  const LINES = 26, SEG = 70;
  const mouse = { x: -999, y: -999, tx: -999, ty: -999 };
  fig.addEventListener('pointermove', (e) => {
    const r = fig.getBoundingClientRect();
    mouse.tx = e.clientX - r.left;
    mouse.ty = e.clientY - r.top;
    pb.textContent = `${((mouse.tx / W) * 4.8).toFixed(2)} m · ${(((1 - mouse.ty / H) * 1.3)).toFixed(2)} m`;
  });
  fig.addEventListener('pointerleave', () => {
    mouse.tx = -999;
    mouse.ty = -999;
    pb.textContent = '—';
  });
  let t = 0;
  let intro = 0;
  const frame = (_time, dt) => {
    t += dt / 1000;
    intro = Math.min(1, intro + dt / 2400);
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    // A body profile the air flows over (the car sits in the lower middle of the photo).
    const bx = W * 0.5, by = H * 0.62, bw = W * 0.36, bh = H * 0.16;
    for (let i = 0; i < LINES; i++) {
      const y0 = (H * (i + 0.5)) / LINES;
      ctx.beginPath();
      const reach = intro * (W + 40);
      for (let s = 0; s <= SEG; s++) {
        const x = (s / SEG) * (W + 40) - 20;
        if (x > reach) break;
        let y = y0;
        // deflect over the body: a smooth bump, stronger nearer the body
        const dx = (x - bx) / bw;
        const near = Math.exp(-((y0 - by) * (y0 - by)) / (2 * (bh * 1.6) * (bh * 1.6)));
        const lift = Math.exp(-dx * dx * 2.2) * bh * 1.3 * near * (y0 < by ? 1 : -0.4);
        y -= lift;
        // wake turbulence behind the body
        if (x > bx + bw * 0.6) y += Math.sin(x * 0.045 - t * 7 + i) * 6 * near * Math.min(1, (x - bx - bw * 0.6) / 120);
        // the pointer is an obstacle
        const mx = x - mouse.x, my = y - mouse.y;
        const md = Math.hypot(mx, my);
        if (md < 120) y += (my >= 0 ? 1 : -1) * (120 - md) * 0.55;
        // gentle travelling ripple so it reads as moving air
        y += Math.sin(x * 0.012 + t * 2.4 + i * 0.7) * 1.4;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const a = 0.12 + 0.35 * Math.exp(-((y0 - by) * (y0 - by)) / (2 * (bh * 2.4) * (bh * 2.4)));
      ctx.strokeStyle = `rgba(236,232,223,${a})`;
      ctx.stroke();
    }
    // Moving tracer particles along the lines.
    for (let i = 0; i < LINES; i += 2) {
      const y0 = (H * (i + 0.5)) / LINES;
      const x = ((t * 260 + i * 97) % (W + 80)) - 40;
      if (x > intro * W) continue;
      const dx = (x - bx) / bw;
      const near = Math.exp(-((y0 - by) * (y0 - by)) / (2 * (bh * 1.6) * (bh * 1.6)));
      let y = y0 - Math.exp(-dx * dx * 2.2) * bh * 1.3 * near * (y0 < by ? 1 : -0.4);
      const md = Math.hypot(x - mouse.x, y - mouse.y);
      if (md < 120) y += (y - mouse.y >= 0 ? 1 : -1) * (120 - md) * 0.55;
      ctx.fillStyle = 'rgba(236,232,223,.85)';
      ctx.fillRect(x, y - 0.5, 14, 1);
    }
  };
  whileVisible(gsap, fig, frame);
  onCleanup(() => ro.disconnect());
}

async function run() {
  const ctx = await boot({ lenis: { lerp: 0.12, wheel: 1.1 } }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  $$('main .h2').forEach((h) => {
    release(h);
    blowIn(gsap, h);
  });
  $$('.figures .num').forEach((n) => {
    release(n.closest('li'));
    countUp(gsap, ScrollTrigger, n);
  });
  gsap.from('.figures li', { x: -80, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.figures', start: 'top 85%', once: true } });

  // Engineering: pinned horizontal track — the cutaway, then each system as a panel.
  const eng = $('#engineering');
  const list = $('.eng-list', eng);
  const cut = $('.eng-cutaway', eng);
  if (eng && list && cut && canPin()) {
    $$('.eng-item', list).forEach(release);
    release(cut);
    const wrap = el('div', 'ax-track-wrap');
    const track = el('div', 'ax-track');
    const cutCell = el('div', 'ax-cut');
    cut.before(wrap);
    wrap.appendChild(track);
    cutCell.appendChild(cut);
    track.appendChild(cutCell);
    $$('.eng-item', list).forEach((it) => track.appendChild(it));
    list.remove();
    const hud = el('div', 'ax-hud', '<span>Powertrain</span><span class="bar"><i></i></span><b>0 / 3</b>');
    hud.setAttribute('aria-hidden', 'true');
    wrap.after(hud);
    const fill = $('.bar i', hud);
    const cnt = $('b', hud);
    const distance = () => track.scrollWidth - wrap.clientWidth;
    const tw = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: eng,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (s) => {
          fill.style.transform = `scaleX(${s.progress})`;
          cnt.textContent = `${Math.min(3, Math.floor(s.progress * 3.2))} / 3`;
        },
      },
    });
    // Skew the panels with scroll velocity — the faster you go, the more they lean into it.
    const skewTo = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });
    ScrollTrigger.create({ trigger: eng, start: 'top top', end: () => `+=${distance()}`, onUpdate: (s) => skewTo(Math.max(-2.5, Math.min(2.5, s.getVelocity() / -900))) });
    $$('.eng-item', track).forEach((it) => {
      gsap.from([$('.idx', it), $('.h3', it), $('.body', it), $('.fig', it)], {
        x: 120,
        opacity: 0,
        stagger: 0.06,
        ease: 'expo.out',
        duration: 1,
        scrollTrigger: { trigger: it, containerAnimation: tw, start: 'left 80%', toggleActions: 'play none none reverse' },
      });
    });
  } else if (eng) {
    $$('.eng-item', eng).forEach((it) => {
      release(it);
      gsap.from(it, { x: -60, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: it, start: 'top 88%', once: true } });
    });
  }

  // Aero: live streamlines that part around the pointer.
  const fig = $('#aeroFig');
  if (fig) {
    release(fig);
    smoke(gsap, fig);
    gsap.from(fig, { clipPath: 'inset(0 100% 0 0)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: fig, start: 'top 80%', once: true } });
  }

  // Atelier + allocation copy slides in from the left, like everything else here.
  $$('#atelier .rv, #allocation .rv, #manifesto .rv').forEach((n) => {
    if (n.matches('.h2')) return;
    release(n);
    gsap.from(n, { x: -50, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 90%', once: true } });
  });

  // In-page navigation is a full-screen horizontal wipe.
  const wipe = el('div', 'ax-wipe');
  wipe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wipe);
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
    if (!a || e.defaultPrevented) return;
    const id = a.getAttribute('href').slice(1);
    const dest = id && !id.startsWith('/') && document.getElementById(id);
    if (!dest || !ctx.lenis) return;
    e.preventDefault();
    e.stopPropagation();
    gsap.timeline()
      .set(wipe, { transformOrigin: '0 50%' })
      .to(wipe, { scaleX: 1, duration: 0.45, ease: 'expo.in' })
      .add(() => ctx.lenis.scrollTo(dest, { immediate: true, force: true }))
      .set(wipe, { transformOrigin: '100% 50%' })
      .to(wipe, { scaleX: 0, duration: 0.6, ease: 'expo.out' });
  }, true);

  // Velocity cursor: a tail that stretches with pointer speed and a km/h readout.
  if (fine) {
    document.documentElement.classList.add('ax-cursor');
    const c = el('div', 'ax-speed', '<span class="tail"></span><span class="ring"></span><span class="v">0 KM/H</span>');
    c.setAttribute('aria-hidden', 'true');
    const tail = $('.tail', c);
    const v = $('.v', c);
    let lx = 0, ly = 0, lt = performance.now(), sp = 0;
    follower(gsap, c, {
      duration: 0.18,
      onMove: (e, t) => {
        const now = performance.now();
        const d = Math.hypot(e.clientX - lx, e.clientY - ly);
        const inst = d / Math.max(1, now - lt);
        sp += (inst - sp) * 0.3;
        const ang = Math.atan2(e.clientY - ly, e.clientX - lx);
        lx = e.clientX; ly = e.clientY; lt = now;
        tail.style.width = `${Math.min(140, sp * 40)}px`;
        tail.style.transform = `rotate(${ang}rad)`;
        v.textContent = `${Math.round(Math.min(sp * 120, 320))} KM/H`;
        c.classList.toggle('hot', !!t?.closest('a, button, input, select, textarea, label, .chip, .swatch'));
      },
    });
  }
}

run();
