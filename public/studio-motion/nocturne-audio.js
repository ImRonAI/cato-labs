/* NOCTURNE — "Signal, minus noise". The site is a measurement. A thin oscilloscope trace
   runs along the bottom of the viewport: scrolling is signal (it oscillates with your speed),
   stopping is silence (it settles perfectly flat). Headings arrive as noise and are filtered
   clean. The "what we remove" figures are measured live: a noisy reading converges on the
   published value. The frequency-response chart gets a probe that reads Hz and dB under the
   pointer. Cursor is a sine that flattens when still. Mid-weight smoothing. */
import { boot, $, $$, el, style, release, chars, onCleanup, fine, follower } from './core.js';

style(`
.nx-scope{position:fixed;left:0;right:0;bottom:0;height:56px;z-index:44;pointer-events:none;mix-blend-mode:screen}
.nx-scope canvas{display:block;width:100%;height:100%}
.nx-scope b{position:absolute;left:clamp(16px,3vw,40px);bottom:12px;font:500 9.5px/1 var(--sans);letter-spacing:.16em;color:var(--paper-3);font-variant-numeric:tabular-nums}
.nx-scope b i{font-style:normal;color:var(--fil)}
.nx-c{display:inline-block;will-change:transform,opacity}
.nx-meas{font-variant-numeric:tabular-nums}
.removed .n{position:relative}
.removed .nx-tag{display:block;margin-top:10px;font:500 10px/1 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--paper-3)}
.removed .nx-tag.ok{color:var(--fil)}
.nx-probe{position:absolute;top:0;bottom:0;width:1px;background:var(--fil);pointer-events:none;opacity:0;transition:opacity .25s}
.nx-probe.on{opacity:1}
.nx-probe i{position:absolute;left:-4px;width:9px;height:9px;border-radius:50%;background:var(--ink);border:1px solid var(--fil);transform:translateY(-50%)}
.nx-probe b{position:absolute;top:6px;left:10px;font:500 10px/1.5 var(--sans);letter-spacing:.1em;color:var(--paper);white-space:nowrap;background:var(--ink-2);padding:4px 7px;border:1px solid var(--line-2);font-variant-numeric:tabular-nums}
.response figure{cursor:crosshair}
.nx-wave{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .3s}
.nx-wave.is-on{opacity:1}.nx-wave.is-off{opacity:0}
.nx-wave canvas{position:absolute;left:-30px;top:-14px;width:60px;height:28px}
.nx-wave.hot canvas{transform:scale(1.5)}
@media (hover:hover) and (pointer:fine){html.nx-cursor, html.nx-cursor a, html.nx-cursor button{cursor:none}}
html.nx-cursor #concierge-root, html.nx-cursor #concierge-root *{cursor:auto}
html.nx-cursor .response figure{cursor:none}
.inst .art img{will-change:transform}
`);

/* Viewport oscilloscope. Amplitude follows scroll velocity and the room-tone toggle. */
function scope(gsap, ScrollTrigger) {
  const wrap = el('div', 'nx-scope', '<canvas></canvas><b>CH1 · <i>0.000</i> V · SILENCE</b>');
  wrap.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wrap);
  const c = $('canvas', wrap);
  const label = $('b', wrap);
  const x = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const size = () => {
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);
  let vel = 0, amp = 0, phase = 0, lastLabel = 0;
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => (vel = s.getVelocity()) });
  const frame = (t, dt) => {
    const tone = window.__field?.energy ? 0.35 : 0;
    const want = Math.min(1, Math.abs(vel) / 2600) + tone;
    vel *= 0.9;
    amp += (want - amp) * 0.08;
    phase += dt * 0.006 * (1 + amp * 3);
    x.clearRect(0, 0, W, H);
    x.lineWidth = 1;
    x.strokeStyle = 'rgba(217,195,160,.85)';
    x.beginPath();
    const mid = H * 0.5;
    for (let i = 0; i <= W; i += 2) {
      const u = i / W;
      const env = Math.sin(u * Math.PI);
      const y = mid + env * amp * (Math.sin(u * 46 + phase) * 11 + Math.sin(u * 131 - phase * 1.7) * 4 + (Math.random() - 0.5) * 3 * amp);
      i ? x.lineTo(i, y) : x.moveTo(i, y);
    }
    x.stroke();
    if (t - lastLabel > 0.12) {
      lastLabel = t;
      const v = (amp * 0.8).toFixed(3);
      label.innerHTML = `CH1 · <i>${v}</i> V · ${amp < 0.02 ? 'SILENCE' : amp < 0.35 ? 'SIGNAL' : 'PEAK'}`;
    }
  };
  gsap.ticker.add(frame);
  const vis = () => (document.hidden ? gsap.ticker.remove(frame) : gsap.ticker.add(frame));
  document.addEventListener('visibilitychange', vis);
  onCleanup(() => {
    gsap.ticker.remove(frame);
    removeEventListener('resize', size);
    document.removeEventListener('visibilitychange', vis);
  });
}

/* Headings arrive as noise: every character jitters in position and opacity, then the
   "filter" sweeps across and each one settles to rest. */
function denoise(gsap, h) {
  const cs = chars(h, { cls: 'nx-c' });
  if (!cs.length) return;
  gsap.set(cs, { opacity: 0 });
  const go = () => {
    const tl = gsap.timeline();
    cs.forEach((c, i) => {
      const at = i * 0.022;
      tl.fromTo(c, { opacity: 0.15, y: () => (Math.random() - 0.5) * 26, x: () => (Math.random() - 0.5) * 8 }, { opacity: 1, y: 0, x: 0, duration: 0.9, ease: 'expo.out' }, at);
      tl.to(c, { opacity: 0.4, duration: 0.04, repeat: 3, yoyo: true, ease: 'none' }, at);
    });
  };
  window.ScrollTrigger.create({ trigger: h, start: 'top 85%', once: true, onEnter: go });
}

/* A measurement converging: noisy readings that tighten onto the published figure. */
function measure(gsap, ScrollTrigger, n) {
  const sub = n.querySelector('sub');
  const t = n.firstChild;
  if (!t || t.nodeType !== 3) return;
  const raw = t.textContent.trim();
  const m = raw.match(/^([<−-]?)(\d+(?:\.\d+)?)$/);
  if (!m) return;
  const prefix = m[1], target = Number(m[2]), dec = (m[2].split('.')[1] || '').length;
  n.setAttribute('aria-label', n.textContent.replace(/\s+/g, ' ').trim());
  const tag = el('span', 'nx-tag', 'Measuring…');
  tag.setAttribute('aria-hidden', 'true');
  n.after(tag);
  t.textContent = `${prefix}${(target * 3).toFixed(dec)}`;
  const o = { k: 0 };
  ScrollTrigger.create({
    trigger: n,
    start: 'top 85%',
    once: true,
    onEnter: () =>
      gsap.to(o, {
        k: 1,
        duration: 2.4,
        ease: 'power2.out',
        onUpdate: () => {
          const noise = (1 - o.k) * target * 2.2 * (Math.random() - 0.3);
          t.textContent = `${prefix}${Math.abs(target + noise).toFixed(dec)}`;
        },
        onComplete: () => {
          t.textContent = `${prefix}${target.toFixed(dec)}`;
          tag.textContent = 'Verified · APx555';
          tag.classList.add('ok');
        },
      }),
  });
  if (sub) sub.classList.add('nx-meas');
}

/* Probe on the frequency-response chart: log-frequency X, ±1 dB Y, matching the SVG axes. */
function probe(fig) {
  const svg = $('svg', fig);
  const trace = $('#trace', svg);
  if (!svg || !trace) return;
  const p = el('div', 'nx-probe', '<i></i><b></b>');
  p.setAttribute('aria-hidden', 'true');
  fig.appendChild(p);
  const dot = $('i', p);
  const lab = $('b', p);
  const L = trace.getTotalLength();
  fig.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * 900;
    if (sx < 60 || sx > 860) return p.classList.remove('on');
    p.classList.add('on');
    // find the trace y at this x (binary search along the path)
    let lo = 0, hi = L;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      trace.getPointAtLength(mid).x < sx ? (lo = mid) : (hi = mid);
    }
    const pt = trace.getPointAtLength(lo);
    const hz = 20 * Math.pow(1000, (sx - 60) / 800);
    const db = -((pt.y - 130) / 90);
    p.style.left = `${((sx / 900) * r.width).toFixed(1)}px`;
    dot.style.top = `${((pt.y / 260) * r.height).toFixed(1)}px`;
    lab.textContent = `${hz >= 1000 ? (hz / 1000).toFixed(2) + ' kHz' : Math.round(hz) + ' Hz'}  ${db >= 0 ? '+' : '−'}${Math.abs(db).toFixed(3)} dB`;
  });
  fig.addEventListener('pointerleave', () => p.classList.remove('on'));
}

function waveCursor(gsap) {
  document.documentElement.classList.add('nx-cursor');
  const w = el('div', 'nx-wave', '<canvas width="120" height="56"></canvas>');
  w.setAttribute('aria-hidden', 'true');
  const c = $('canvas', w);
  const x = c.getContext('2d');
  let speed = 0, lx = 0, ly = 0, ph = 0;
  follower(gsap, w, {
    duration: 0.2,
    onMove: (e, t) => {
      speed = Math.min(1, speed + Math.hypot(e.clientX - lx, e.clientY - ly) / 120);
      lx = e.clientX;
      ly = e.clientY;
      w.classList.toggle('hot', !!t?.closest('a, button, input, select, textarea, label, .inst'));
    },
  });
  const frame = (_t, dt) => {
    speed *= 0.93;
    ph += dt * 0.012;
    x.clearRect(0, 0, 120, 56);
    x.strokeStyle = '#ece9e2';
    x.lineWidth = 2;
    x.beginPath();
    for (let i = 0; i <= 120; i += 2) {
      const env = Math.sin((i / 120) * Math.PI);
      const y = 28 + Math.sin(i * 0.16 + ph) * env * (1.5 + speed * 18);
      i ? x.lineTo(i, y) : x.moveTo(i, y);
    }
    x.stroke();
  };
  gsap.ticker.add(frame);
  onCleanup(() => gsap.ticker.remove(frame));
}

async function run() {
  const ctx = await boot({ lenis: { lerp: 0.08 } }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  scope(gsap, ScrollTrigger);

  $$('#principle-h, #inst-h, #eng-h, #rooms-h').forEach((h) => {
    release(h);
    denoise(gsap, h);
  });

  $$('.removed .n').forEach((n) => {
    release(n.closest('li'));
    measure(gsap, ScrollTrigger, n);
  });

  // Frequency response: the trace draws left to right with scroll, like a sweep on the bench.
  const trace = $('#trace');
  if (trace) {
    const L = trace.getTotalLength();
    trace.style.strokeDasharray = `${L}`;
    trace.style.strokeDashoffset = `${L}`;
    const fig = trace.closest('figure');
    release(fig);
    gsap.to(trace, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: fig, start: 'top 80%', end: 'center 45%', scrub: 0.6 } });
    probe(fig);
  }

  // Bench procedure steps arrive in sequence, each one "passing" with a fil-coloured tick.
  $$('.engineering .step').forEach((s, i) => {
    release(s);
    gsap.from(s, { opacity: 0, x: 30, duration: 0.9, ease: 'expo.out', delay: i * 0.06, scrollTrigger: { trigger: s, start: 'top 88%', once: true } });
    gsap.fromTo($('.num', s), { color: 'var(--paper-3)' }, { color: 'var(--fil)', duration: 0.4, scrollTrigger: { trigger: s, start: 'top 60%', toggleActions: 'play none none reverse' } });
  });

  // Instrument art floats with a slow parallax (they are rendered by the page).
  const wireInst = () =>
    $$('#instList .inst .art img').forEach((img) => {
      if (img.dataset.nx) return;
      img.dataset.nx = '1';
      gsap.fromTo(img, { yPercent: -6, scale: 1.08 }, { yPercent: 6, scale: 1.08, ease: 'none', scrollTrigger: { trigger: img.closest('.inst'), start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  wireInst();
  const list = $('#instList');
  if (list) new MutationObserver(wireInst).observe(list, { childList: true, subtree: true });

  if (fine) waveCursor(gsap);
}

run();
