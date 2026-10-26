/* KUROSHIO — "Ma (間)", the pause. Sumi ink and hinoki. Photographs are revealed by ink
   spreading across wet washi (an SVG turbulence mask that blooms), each section is opened by a
   single brush stroke drawn across the page, the four plates become a drag-to-turn strip you
   pull like a sushi rail, and the Toyosu lots flip on a split-flap auction board.
   Scrolling is heavy and slow. Cursor is an ink drop that leaves a fading trail. */
import { boot, $, $$, el, style, release, chars, onCleanup, fine, canPin, follower, whileVisible } from './core.js';

style(`
.kx-defs{position:absolute;width:0;height:0;overflow:hidden}
.kx-ink{position:relative;overflow:hidden}
.kx-ink img{will-change:filter}
.kx-brush{display:block;width:min(100%,1400px);height:clamp(40px,6vw,90px);margin:0 0 clamp(28px,4vw,56px) -6px;overflow:visible;pointer-events:none}
.kx-brush path{fill:none;stroke:var(--hinoki);stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.kx-char{display:inline-block;will-change:transform,opacity,filter}
html.kx-rail .kuroshio-plates{display:flex!important;gap:20px!important;overflow:visible;cursor:grab;touch-action:pan-y;user-select:none;margin-inline:calc(-1*var(--gutter,24px));padding-inline:var(--gutter,24px)}
html.kx-rail .kuroshio-plates.drag{cursor:grabbing}
html.kx-rail .kuroshio-plate-card{flex:0 0 clamp(280px,32vw,460px);will-change:transform}
html.kx-rail .kuroshio-plate-card img{aspect-ratio:3/4!important;pointer-events:none}
.kx-rail-wrap{overflow:hidden;position:relative}
.kx-rail-hint{display:flex;justify-content:space-between;align-items:center;margin:-28px 0 40px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ash)}
.kx-rail-hint i{display:block;height:1px;flex:1;margin:0 20px;background:var(--line)}
.kx-rail-hint b{font-weight:300;color:var(--hinoki);font-variant-numeric:tabular-nums}
.kx-flap{display:inline-flex;gap:2px}
.kx-flap span{display:inline-grid;place-items:center;min-width:.78em;padding:.12em .06em;background:var(--ink-3);border:1px solid var(--line);border-radius:2px;position:relative;font-variant-numeric:tabular-nums}
.kx-flap span::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(0,0,0,.6)}
.ledger li{position:relative}
.ledger li::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--hinoki);transform:scaleY(0);transform-origin:top;transition:transform .7s var(--ease-out)}
.ledger li.kx-sold::before{transform:scaleY(1)}
.kx-drop{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .4s}
.kx-drop.is-on{opacity:1}.kx-drop.is-off{opacity:0}
.kx-drop i{position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:50% 50% 50% 0;background:var(--paper);transform:rotate(-45deg);transition:transform .6s var(--ease-out),background .4s}
.kx-drop.hot i{transform:rotate(-45deg) scale(2.4);background:var(--hinoki)}
.kx-trail{position:fixed;inset:0;z-index:9998;pointer-events:none;mix-blend-mode:screen}
@media (hover:hover) and (pointer:fine){html.kx-cursor, html.kx-cursor a, html.kx-cursor button{cursor:none}}
html.kx-cursor #concierge-root, html.kx-cursor #concierge-root *{cursor:auto}
html.kx-cursor .kuroshio-plates{cursor:none}
`);

/* An SVG filter per image: turbulence that we threshold up over time, so the photograph
   appears the way ink bleeds outwards through paper fibres. */
let fid = 0;
function inkReveal(gsap, img) {
  const host = img.parentElement;
  if (!host) return;
  host.classList.add('kx-ink');
  const id = `kx-ink-${fid++}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'kx-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="4" seed="${(Math.random() * 90) | 0}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.3" result="m"/>
      <feComponentTransfer in="m" result="mask"><feFuncA type="linear" slope="18" intercept="-17"/></feComponentTransfer>
      <feComposite in="SourceGraphic" in2="mask" operator="in"/>
    </filter>`;
  document.body.appendChild(svg);
  const ft = svg.querySelector('feFuncA');
  img.style.filter = `url(#${id})`;
  const o = { i: -17 };
  gsap.to(o, {
    i: 1,
    duration: 2.6,
    ease: 'power2.inOut',
    scrollTrigger: { trigger: host, start: 'top 82%', once: true },
    onUpdate: () => ft.setAttribute('intercept', o.i.toFixed(2)),
    onComplete: () => {
      img.style.filter = '';
      svg.remove();
    },
  });
  onCleanup(() => svg.remove());
}

/* One hand-like brush stroke above each section heading, drawn with scroll. */
function brush(gsap, head) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'kx-brush');
  svg.setAttribute('viewBox', '0 0 1400 90');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const y = 40 + Math.random() * 14;
  const d = `M8 ${y + 8} C 220 ${y - 18}, 480 ${y + 22}, 720 ${y - 4} S 1180 ${y - 22}, 1392 ${y + 6}`;
  // Three overlapping passes of varying width read as one dry-brush stroke.
  svg.innerHTML = [10, 5, 2.2].map((w, i) => `<path d="${d}" stroke-width="${w}" style="opacity:${[0.85, 0.5, 0.9][i]};transform:translateY(${(i - 1) * 3}px)"/>`).join('');
  head.before(svg);
  const paths = $$('path', svg);
  paths.forEach((p) => {
    const L = p.getTotalLength();
    p.style.strokeDasharray = `${L}`;
    p.style.strokeDashoffset = `${L}`;
  });
  gsap.to(paths, { strokeDashoffset: 0, ease: 'power2.inOut', stagger: 0.06, scrollTrigger: { trigger: svg, start: 'top 88%', end: 'top 45%', scrub: 1.2 } });
}

/* Heading characters settle like ink drops, one after another, with long pauses (ma). */
function settle(gsap, h) {
  const cs = chars(h, { cls: 'kx-char' });
  if (!cs.length) return;
  gsap.set(cs, { opacity: 0, y: -18, filter: 'blur(6px)' });
  gsap.to(cs, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, ease: 'power3.out', stagger: 0.045, scrollTrigger: { trigger: h, start: 'top 84%', once: true } });
}

/* The plates become a rail you pull with the pointer (or wheel/trackpad horizontally). */
function rail(gsap, plates) {
  document.documentElement.classList.add('kx-rail');
  const wrap = el('div', 'kx-rail-wrap');
  plates.before(wrap);
  wrap.appendChild(plates);
  const cards = $$('.kuroshio-plate-card', plates);
  const hint = el('div', 'kx-rail-hint', `<span>Drag the counter</span><i></i><b>01 / ${String(cards.length).padStart(2, '0')}</b>`);
  hint.setAttribute('aria-hidden', 'true');
  wrap.after(hint);
  const count = $('b', hint);
  let x = 0, target = 0, vel = 0, dragging = false, sx = 0, sTarget = 0, last = 0;
  const max = () => Math.min(0, -(plates.scrollWidth - wrap.clientWidth));
  plates.addEventListener('pointerdown', (e) => {
    dragging = true;
    sx = e.clientX;
    sTarget = target;
    last = e.clientX;
    plates.classList.add('drag');
    plates.setPointerCapture(e.pointerId);
  });
  plates.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    target = Math.max(max() - 80, Math.min(80, sTarget + (e.clientX - sx) * 1.1));
    vel = e.clientX - last;
    last = e.clientX;
  });
  const up = () => {
    if (!dragging) return;
    dragging = false;
    plates.classList.remove('drag');
    target += vel * 14;
  };
  plates.addEventListener('pointerup', up);
  plates.addEventListener('pointercancel', up);
  wrap.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      target -= e.deltaX;
    }
  }, { passive: false });
  plates.tabIndex = 0;
  plates.setAttribute('aria-label', 'Four courses. Use the arrow keys to move along the counter.');
  plates.addEventListener('keydown', (e) => {
    const step = cards[0]?.offsetWidth + 20 || 300;
    if (e.key === 'ArrowRight') target -= step;
    if (e.key === 'ArrowLeft') target += step;
  });
  whileVisible(gsap, wrap, () => {
    if (!dragging) target = Math.max(max(), Math.min(0, target));
    const prev = x;
    x += (target - x) * 0.09;
    const v = x - prev;
    plates.style.transform = `translate3d(${x}px,0,0)`;
    cards.forEach((c, i) => {
      c.style.transform = `rotate(${Math.max(-4, Math.min(4, v * 0.18))}deg) translateY(${Math.sin(i * 1.3 + x * 0.004) * 6}px)`;
    });
    const idx = Math.min(cards.length, Math.round(-x / ((cards[0]?.offsetWidth || 300) + 20)) + 1);
    count.textContent = `${String(idx).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  });
}

/* Split-flap board for the auction lot numbers. */
function flap(gsap, ScrollTrigger, lot, row, delay) {
  const target = lot.textContent.trim();
  lot.setAttribute('aria-label', `Lot ${target}`);
  lot.textContent = '';
  const box = el('span', 'kx-flap');
  box.setAttribute('aria-hidden', 'true');
  const cells = [...target].map(() => box.appendChild(el('span', '', '0')));
  lot.appendChild(box);
  ScrollTrigger.create({
    trigger: row,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      cells.forEach((c, i) => {
        let n = 0;
        const flips = 8 + i * 4;
        const id = setInterval(() => {
          n++;
          c.textContent = n >= flips ? target[i] : String((Math.random() * 10) | 0);
          gsap.fromTo(c, { rotateX: -70 }, { rotateX: 0, duration: 0.08 });
          if (n >= flips) {
            clearInterval(id);
            if (i === cells.length - 1) row.classList.add('kx-sold');
          }
        }, 55);
        onCleanup(() => clearInterval(id));
      });
    },
    // stagger rows a little, like a board updating line by line
    onEnterBack: undefined,
  });
  gsap.from(row, { opacity: 0, y: 24, duration: 1.2, delay, ease: 'power3.out', scrollTrigger: { trigger: row, start: 'top 90%', once: true } });
}

function inkTrail(gsap) {
  const c = el('canvas', 'kx-trail');
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const x = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = () => {
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    c.style.width = innerWidth + 'px';
    c.style.height = innerHeight + 'px';
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);
  const pts = [];
  addEventListener('pointermove', (e) => {
    if (e.target instanceof Element && e.target.closest('#concierge-root')) return;
    pts.push({ x: e.clientX, y: e.clientY, life: 1 });
    if (pts.length > 60) pts.shift();
  }, { passive: true });
  const frame = () => {
    x.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      b.life -= 0.022;
      if (b.life <= 0) continue;
      x.strokeStyle = `rgba(201,162,106,${b.life * 0.35})`;
      x.lineWidth = b.life * 3.2;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(a.x, a.y);
      x.lineTo(b.x, b.y);
      x.stroke();
    }
    while (pts.length && pts[0].life <= 0) pts.shift();
  };
  gsap.ticker.add(frame);
  onCleanup(() => {
    gsap.ticker.remove(frame);
    removeEventListener('resize', size);
    c.remove();
  });
}

async function run() {
  // Heavy and slow: the room asks you to wait.
  const ctx = await boot({ lenis: { lerp: 0.045, wheel: 0.7 } }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  $$('main .sec .sec-head').forEach((head) => {
    const h = $('h2', head);
    if (!h) return;
    release(h);
    release($('.num', head));
    brush(gsap, head);
    settle(gsap, h);
  });

  $$('main img').forEach((img) => {
    if (img.closest('.hero')) return;
    release(img.closest('.rv'));
    inkReveal(gsap, img);
  });

  const plates = $('.kuroshio-plates');
  if (plates && canPin()) rail(gsap, plates);

  $$('.ledger li').forEach((li, i) => {
    const lot = $('.lot', li);
    release(li.closest('.rv'));
    if (lot) flap(gsap, ScrollTrigger, lot, li, i * 0.08);
  });

  // Seating times: the numerals arrive like a clock hand stopping on the hour.
  $$('.seating .t').forEach((t) => {
    release(t.closest('.rv'));
    gsap.from(t, { rotateX: -90, transformOrigin: '50% 100%', opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: t, start: 'top 88%', once: true } });
  });

  // The courses list drifts in as if on the current itself: each row a beat after the last.
  const coursesEl = $('#courses');
  if (coursesEl) {
    const animate = () => {
      const rows = $$('.course', coursesEl);
      gsap.fromTo(rows, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.05, scrollTrigger: { trigger: coursesEl, start: 'top 85%', once: true } });
    };
    animate();
    new MutationObserver(() => {
      const rows = $$('.course', coursesEl);
      gsap.fromTo(rows, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.03 });
    }).observe(coursesEl, { childList: true });
  }

  if (fine) {
    document.documentElement.classList.add('kx-cursor');
    const d = el('div', 'kx-drop', '<i></i>');
    d.setAttribute('aria-hidden', 'true');
    follower(gsap, d, { duration: 0.6, onMove: (_e, t) => d.classList.toggle('hot', !!t?.closest('a, button, input, select, textarea, label, .course, .kuroshio-plates')) });
    inkTrail(gsap);
  }
}

run();
