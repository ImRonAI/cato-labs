/* VELOUR CAPITAL — "Patience". The slowest site of the ten, on purpose. Nothing hurries:
   the scroll has the longest inertia, text is revealed by a brass light raking across velvet
   (a sheen that sweeps each line), the four mandates are an index whose large brass numeral
   follows the pointer and changes as you move between rows, the approach steps are a ledger
   that fills in ink, and the two offices get real analogue clocks. Cursor is a small brass
   ring that is always a little behind you. Nothing on the page quotes a return. */
import { boot, $, $$, el, style, release, words, onCleanup, fine, follower } from './core.js';

style(`
.vl-line{display:inline;background-image:linear-gradient(100deg,var(--bone) 0 40%,var(--brass-2) 48%,#fff6dc 50%,var(--brass-2) 52%,rgba(217,210,199,.18) 60% 100%);background-size:260% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;color:transparent}
.vl-line em{color:transparent!important}
.vl-num{position:fixed;left:0;top:0;z-index:30;pointer-events:none;font-family:var(--serif);font-weight:300;font-size:clamp(160px,18vw,300px);line-height:.8;color:transparent;-webkit-text-stroke:1px var(--brass);opacity:0;transition:opacity .9s var(--ease)}
.vl-num.on{opacity:.55}
.index .row{position:relative;z-index:1}
.vl-ink{position:relative}
.vl-ink::after{content:"";position:absolute;left:0;bottom:-1px;height:1px;width:100%;background:var(--brass);transform:scaleX(0);transform-origin:0 50%}
.vl-ink.in::after{transform:scaleX(1);transition:transform 2.4s cubic-bezier(.65,0,.35,1)}
.vl-clock{display:inline-block;width:64px;height:64px;vertical-align:middle;margin-right:16px}
.vl-clock svg{width:100%;height:100%}
.vl-clock .f{fill:none;stroke:var(--hair-2)}
.vl-clock .tk{stroke:var(--stone);stroke-width:1}
.vl-clock .h,.vl-clock .m{stroke:var(--bone);stroke-linecap:round}
.vl-clock .h{stroke-width:2}.vl-clock .m{stroke-width:1.2}
.vl-clock .s{stroke:var(--brass-2);stroke-width:.8}
.vl-clock circle.c{fill:var(--brass-2)}
.vl-ring{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .6s}
.vl-ring.is-on{opacity:1}.vl-ring.is-off{opacity:0}
.vl-ring i{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:1px solid var(--brass-2);transition:transform 1.1s cubic-bezier(.16,1,.3,1),background .8s}
.vl-ring.hot i{transform:scale(2);background:rgba(181,155,106,.1)}
@media (hover:hover) and (pointer:fine){html.vl-cursor, html.vl-cursor a, html.vl-cursor button{cursor:none}}
html.vl-cursor #concierge-root, html.vl-cursor #concierge-root *{cursor:auto}
@media (max-width:899px){.vl-num{display:none}}
`);

/* A raking brass light passes across each heading once, then the type stays bone. */
function sheen(gsap, h, delay = 0) {
  if (h.querySelector('a, button')) return;
  const inner = document.createElement('span');
  inner.className = 'vl-line';
  while (h.firstChild) inner.appendChild(h.firstChild);
  h.appendChild(inner);
  gsap.to(inner, {
    backgroundPosition: '0% 0',
    duration: 3.6,
    delay,
    ease: 'sine.inOut',
    scrollTrigger: { trigger: h, start: 'top 82%', once: true },
  });
}

/* The firm statement is read, not scrolled past: words fade up from shadow, scrubbed. */
function readSlowly(gsap, p) {
  const ws = words(p, { inner: 'vl-w' });
  if (!ws.length) return;
  gsap.fromTo(ws, { opacity: 0.12 }, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: p, start: 'top 78%', end: 'bottom 30%', scrub: 2 } });
}

function analogue(node, tz) {
  const c = el('span', 'vl-clock');
  c.setAttribute('aria-hidden', 'true');
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ticks += `<line class="tk" x1="${32 + Math.sin(a) * 26}" y1="${32 - Math.cos(a) * 26}" x2="${32 + Math.sin(a) * 30}" y2="${32 - Math.cos(a) * 30}"/>`;
  }
  c.innerHTML = `<svg viewBox="0 0 64 64"><circle class="f" cx="32" cy="32" r="31"/>${ticks}<line class="h" x1="32" y1="32" x2="32" y2="17"/><line class="m" x1="32" y1="34" x2="32" y2="8"/><line class="s" x1="32" y1="38" x2="32" y2="6"/><circle class="c" cx="32" cy="32" r="1.6"/></svg>`;
  node.prepend(c);
  const [h, m, s] = ['.h', '.m', '.s'].map((q) => $(q, c));
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
  let raf = 0;
  const tick = () => {
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    const ms = new Date().getMilliseconds();
    const sec = Number(parts.second) + ms / 1000;
    const min = Number(parts.minute) + sec / 60;
    const hr = (Number(parts.hour) % 12) + min / 60;
    s.setAttribute('transform', `rotate(${sec * 6} 32 32)`);
    m.setAttribute('transform', `rotate(${min * 6} 32 32)`);
    h.setAttribute('transform', `rotate(${hr * 30} 32 32)`);
    raf = requestAnimationFrame(tick);
  };
  tick();
  onCleanup(() => cancelAnimationFrame(raf));
}

async function run() {
  // The longest inertia of all ten sites.
  const ctx = await boot({ lenis: { lerp: 0.035, wheel: 0.75 } }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  const firm = $('#firm-h');
  if (firm) {
    release(firm);
    readSlowly(gsap, firm);
  }
  $$('#strat-h, #app-h, #let-h, #off-h, #enq-h').forEach((h) => {
    release(h);
    sheen(gsap, h);
  });
  $$('main .lede.side, main .statement .cols p').forEach((p) => {
    release(p);
    gsap.from(p, { opacity: 0, y: 18, duration: 2.4, ease: 'sine.out', scrollTrigger: { trigger: p, start: 'top 88%', once: true } });
  });

  // Mandate index: a large outlined brass numeral trails the pointer and turns to the row's number.
  const index = $('#strategy-index');
  if (index) {
    const rows = $$('.row', index);
    rows.forEach((r, i) => {
      release(r);
      gsap.from(r, { opacity: 0, y: 30, duration: 2, ease: 'sine.out', delay: i * 0.18, scrollTrigger: { trigger: index, start: 'top 82%', once: true } });
    });
    if (fine) {
      const num = el('div', 'vl-num', '01');
      num.setAttribute('aria-hidden', 'true');
      document.body.appendChild(num);
      const xTo = gsap.quickTo(num, 'x', { duration: 1.4, ease: 'power3.out' });
      const yTo = gsap.quickTo(num, 'y', { duration: 1.4, ease: 'power3.out' });
      let current = '';
      index.addEventListener('pointermove', (e) => {
        const row = e.target instanceof Element ? e.target.closest('.row') : null;
        xTo(e.clientX + 60);
        yTo(e.clientY - num.offsetHeight / 2);
        num.classList.toggle('on', !!row);
        const n = row ? $('.num', row)?.textContent.trim() : '';
        if (n && n !== current) {
          current = n;
          gsap.fromTo(num, { opacity: 0, filter: 'blur(10px)' }, { opacity: 0.55, filter: 'blur(0px)', duration: 0.9, ease: 'sine.out', onStart: () => (num.textContent = n) });
        }
      });
      index.addEventListener('pointerleave', () => num.classList.remove('on'));
      onCleanup(() => num.remove());
    }
  }

  // Approach: a ledger. Each step's rule is inked across slowly as it is reached.
  $$('.approach .step').forEach((s, i) => {
    release(s);
    s.classList.add('vl-ink');
    ScrollTrigger.create({ trigger: s, start: 'top 75%', once: true, onEnter: () => s.classList.add('in') });
    gsap.from([$('.k', s), $('.t', s), $('.d', s)], { opacity: 0, y: 16, duration: 2, ease: 'sine.out', stagger: 0.25, delay: i * 0.05, scrollTrigger: { trigger: s, start: 'top 80%', once: true } });
  });

  // Letters arrive like envelopes laid on a desk, one by one.
  $$('.letters .item').forEach((it, i) => {
    release(it);
    gsap.from(it, { opacity: 0, x: -24, rotate: -0.6, duration: 2, ease: 'sine.out', delay: i * 0.22, scrollTrigger: { trigger: it.parentElement, start: 'top 82%', once: true } });
  });

  // Offices: real analogue clocks beside the digital times.
  $$('.office .time[data-tz]').forEach((t) => analogue(t, t.dataset.tz));
  $$('.office').forEach((o, i) => {
    release(o);
    gsap.from(o, { opacity: 0, y: 40, duration: 2.4, ease: 'sine.out', delay: i * 0.3, scrollTrigger: { trigger: o, start: 'top 85%', once: true } });
  });

  if (fine) {
    document.documentElement.classList.add('vl-cursor');
    const r = el('div', 'vl-ring', '<i></i>');
    r.setAttribute('aria-hidden', 'true');
    follower(gsap, r, { duration: 1.1, onMove: (_e, t) => r.classList.toggle('hot', !!t?.closest('a, button, input, select, textarea, label, .row')) });
  }
}

run();
