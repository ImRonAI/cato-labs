/* MONOLITH — "Formwork". Brutal and literal. Photographs are cast: they arrive as timber
   shuttering boards — horizontal planks that slide in out of order and lock flush — then the
   formwork is struck. Headings are poured: heavy type that drops and compresses under its own
   weight. The ethos pillars are load-bearing: they rise from the floor as columns.
   Native scroll, hard cuts, no easing curves softer than they need to be.
   Cursor is a surveyor's square with live coordinates; press G for the 12-column grid. */
import { boot, $, $$, el, style, release, chars, onCleanup, fine, follower } from './core.js';

style(`
.mo-cast{position:relative;overflow:hidden}
.mo-boards{position:absolute;inset:0;z-index:2;pointer-events:none;display:grid}
.mo-boards i{display:block;background-repeat:no-repeat;will-change:transform}
.mo-boards i::after{content:"";position:absolute;inset:0}
.mo-strike{position:absolute;inset:0;z-index:3;pointer-events:none;background:repeating-linear-gradient(0deg,#b98a5c 0 2px,#a8774a 2px 3px,#c49668 3px 22px,#9d6c42 22px 24px);mix-blend-mode:multiply;opacity:0}
.mo-pour{display:inline-block;will-change:transform;transform-origin:50% 100%}
.mo-col{transform-origin:50% 100%}
.mo-grid{position:fixed;inset:0;z-index:9990;pointer-events:none;display:none;padding:0 var(--space-4,2rem)}
.mo-grid.on{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3,1.5rem)}
.mo-grid i{background:rgba(140,90,60,.07);border-inline:1px solid rgba(140,90,60,.22)}
.mo-grid b{position:fixed;left:16px;bottom:16px;font:600 10px/1 var(--font-sans);letter-spacing:.12em;color:var(--accent-bronze);background:var(--bg-canvas);padding:6px 8px;border:1px solid var(--hairline)}
.mo-sq{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .15s}
.mo-sq.is-on{opacity:1}.mo-sq.is-off{opacity:0}
.mo-sq .s{position:absolute;left:-1px;top:-1px;width:26px;height:26px;border-left:1.5px solid var(--ink-primary);border-top:1.5px solid var(--ink-primary)}
.mo-sq .s::after{content:"";position:absolute;left:4px;top:4px;width:4px;height:4px;background:var(--accent-bronze)}
.mo-sq b{position:absolute;left:32px;top:6px;font:600 9.5px/1.35 var(--font-sans);letter-spacing:.08em;color:var(--ink-primary);white-space:nowrap;font-variant-numeric:tabular-nums;background:var(--bg-canvas);padding:3px 5px;border:1px solid var(--hairline)}
.mo-sq.dark .s{border-color:var(--ink-on-dark)}
.mo-sq.dark b{color:var(--ink-on-dark);background:var(--bg-obsidian);border-color:rgba(242,239,233,.2)}
.mo-sq.hot .s{width:14px;height:14px;border-color:var(--accent-bronze)}
@media (hover:hover) and (pointer:fine){html.mo-cursor, html.mo-cursor a, html.mo-cursor button{cursor:none}}
html.mo-cursor #concierge-root, html.mo-cursor #concierge-root *{cursor:auto}
html.mo-cursor #light-study canvas{cursor:grab}
.mo-mpa{font-variant-numeric:tabular-nums}
`);

/* Cast a photograph: N planks carrying slices of the image slide in from alternating sides,
   land flush with a hard stop, then the shuttering (a wood-grain overlay) is struck off. */
function cast(gsap, ScrollTrigger, img) {
  const host = img.parentElement;
  if (!host || host.querySelector('.mo-boards')) return;
  host.classList.add('mo-cast');
  const N = 9;
  const boards = el('div', 'mo-boards');
  boards.style.gridTemplateRows = `repeat(${N},1fr)`;
  boards.setAttribute('aria-hidden', 'true');
  const strike = el('div', 'mo-strike');
  strike.setAttribute('aria-hidden', 'true');
  host.append(boards, strike);
  const planks = Array.from({ length: N }, () => boards.appendChild(el('i')));
  const layout = () => {
    const r = host.getBoundingClientRect();
    const src = img.currentSrc || img.src;
    const ir = (img.naturalWidth || 16) / (img.naturalHeight || 10), br = r.width / r.height;
    const dw = ir > br ? r.height * ir : r.width, dh = ir > br ? r.height : r.width / ir;
    planks.forEach((p, i) => {
      p.style.backgroundImage = `url("${src}")`;
      p.style.backgroundSize = `${dw}px ${dh}px`;
      p.style.backgroundPosition = `${(r.width - dw) / 2}px ${(r.height - dh) / 2 - (r.height / N) * i}px`;
      p.style.filter = getComputedStyle(img).filter;
    });
  };
  const go = () => {
    layout();
    img.style.opacity = '0';
    gsap.set(planks, { xPercent: (i) => (i % 2 ? 104 : -104) });
    const order = planks.map((_, i) => i).sort(() => Math.random() - 0.5);
    const tl = gsap.timeline({ onComplete: () => { img.style.opacity = ''; boards.remove(); } });
    order.forEach((idx, k) => tl.to(planks[idx], { xPercent: 0, duration: 0.42, ease: 'power4.in' }, k * 0.07));
    tl.to(planks, { y: '+=2', duration: 0.05, yoyo: true, repeat: 1, ease: 'none' }, '>-0.02');
    tl.fromTo(strike, { opacity: 0.85 }, { opacity: 0.85, duration: 0.2 }, '>');
    tl.to(strike, { clipPath: 'inset(0 0 0 100%)', duration: 0.6, ease: 'power3.inOut' }, '>');
  };
  if (img.complete) ScrollTrigger.create({ trigger: host, start: 'top 80%', once: true, onEnter: go });
  else img.addEventListener('load', () => ScrollTrigger.create({ trigger: host, start: 'top 80%', once: true, onEnter: go }), { once: true });
}

/* Poured type: characters fall and compress (scaleY < 1) on impact, then recover. */
function pour(gsap, h) {
  const cs = chars(h, { cls: 'mo-pour' });
  if (!cs.length) return;
  gsap.set(cs, { yPercent: -160, opacity: 0 });
  const tl = gsap.timeline({ scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
  tl.to(cs, { yPercent: 0, opacity: 1, duration: 0.42, ease: 'power4.in', stagger: { each: 0.025, from: 'random' } })
    .to(cs, { scaleY: 0.78, scaleX: 1.08, duration: 0.07, ease: 'none', stagger: { each: 0.025, from: 'random' } }, 0.38)
    .to(cs, { scaleY: 1, scaleX: 1, duration: 0.35, ease: 'elastic.out(1,0.5)', stagger: { each: 0.025, from: 'random' } }, 0.46);
}

async function run() {
  // Native scrolling — the building does not float.
  const ctx = await boot({ lenis: false }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  $$('.section-title, .work-title').forEach((h) => {
    release(h);
    pour(gsap, h);
  });

  $$('.work-figure img, main img').forEach((img) => {
    if (img.closest('.hero-section, header, #light-study')) return;
    release(img);
    cast(gsap, ScrollTrigger, img);
  });

  // Specs read like a pour log: MPa values count up as if the concrete is curing.
  $$('.spec-row dd').forEach((dd) => {
    const m = dd.textContent.match(/(\d+)\s*MPa/);
    if (!m) return;
    const target = Number(m[1]);
    const before = dd.textContent.slice(0, m.index);
    const after = dd.textContent.slice(m.index + m[0].length);
    dd.setAttribute('aria-label', dd.textContent.trim());
    const o = { v: 0 };
    const render = () => (dd.innerHTML = `${before}<span class="mo-mpa" aria-hidden="true">${Math.round(o.v)}</span> MPa${after}`);
    render();
    ScrollTrigger.create({ trigger: dd, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: target, duration: 2.8, ease: 'power1.out', onUpdate: render }) });
  });

  // Ethos: three load-bearing columns rise from the slab, one after another.
  const cards = $$('.ethos-card');
  if (cards.length) {
    cards.forEach((c) => c.classList.add('mo-col'));
    gsap.from(cards, { scaleY: 0, duration: 0.9, ease: 'power4.inOut', stagger: 0.18, scrollTrigger: { trigger: cards[0], start: 'top 80%', once: true } });
    gsap.from(cards.map((c) => c.children), { opacity: 0, y: 20, duration: 0.5, ease: 'power2.out', stagger: 0.06, delay: 0.6, scrollTrigger: { trigger: cards[0], start: 'top 80%', once: true } });
  }

  // Index marks stamp in — no fade, a hard cut, like a stencil lifted.
  $$('.index-mark').forEach((m) => {
    if (m.closest('.hero-section')) return;
    gsap.set(m, { clipPath: 'inset(0 100% 0 0)' });
    ScrollTrigger.create({ trigger: m, start: 'top 92%', once: true, onEnter: () => gsap.to(m, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'steps(8)' }) });
  });

  // Section rules are drawn like chalk lines snapped on site.
  $$('.section-header').forEach((sh) => {
    gsap.fromTo(sh, { borderBottomColor: 'transparent' }, { borderBottomColor: 'var(--hairline)', duration: 0.01, scrollTrigger: { trigger: sh, start: 'top 85%', once: true } });
  });

  // The 12-column grid, on G.
  const grid = el('div', 'mo-grid', Array.from({ length: 12 }, () => '<i></i>').join('') + '<b>GRID 12 · 24 GUTTER · G TO HIDE</b>');
  grid.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grid);
  const onKey = (e) => {
    if (e.key.toLowerCase() !== 'g' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], #concierge-root')) return;
    grid.classList.toggle('on');
  };
  addEventListener('keydown', onKey);
  onCleanup(() => removeEventListener('keydown', onKey));

  if (fine) {
    document.documentElement.classList.add('mo-cursor');
    const c = el('div', 'mo-sq', '<span class="s"></span><b></b>');
    c.setAttribute('aria-hidden', 'true');
    const b = $('b', c);
    follower(gsap, c, {
      duration: 0.04,
      onMove: (e, t) => {
        const hot = !!t?.closest('a, button, input, select, textarea, label');
        c.classList.toggle('hot', hot);
        c.classList.toggle('dark', !!t?.closest('.ethos-section, .site-footer, .dossier-backdrop'));
        // millimetres on a 1:100 drawing, measured from the page origin
        const x = ((e.clientX + scrollX) * 0.2646 * 100) / 1000;
        const y = ((e.clientY + scrollY) * 0.2646 * 100) / 1000;
        b.textContent = hot ? 'OPEN' : `X ${x.toFixed(2)} m  Y ${y.toFixed(2)} m`;
      },
    });
  }
}

run();
