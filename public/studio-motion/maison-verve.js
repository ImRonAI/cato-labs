/* MAISON VERVE — "Escapement". Nothing glides; everything ticks. All motion on this site is
   quantised to the beat of the MV-01's balance (21,600 vph = 6 beats a second): headings index
   in with stepped easing, figures advance a beat at a time, and a seconds hand in the corner
   marks your progress through the page. The finishing photographs sit under a jeweller's loupe
   that magnifies what the bezel passes over. Native wheel scrolling with a mechanical feel. */
import { boot, $, $$, el, style, release, chars, onCleanup, fine, follower } from './core.js';

const BEAT = 1 / 6; // seconds per beat at 21,600 vph

style(`
.mv-step{display:inline-block;will-change:transform,opacity}
.mv-dial{position:fixed;left:clamp(16px,2.4vw,36px);bottom:clamp(16px,2.4vw,36px);z-index:45;width:68px;height:68px;pointer-events:none;opacity:0;transition:opacity .6s var(--ease-out)}
.mv-dial.on{opacity:1}
.mv-dial svg{width:100%;height:100%;overflow:visible}
.mv-dial .rim{fill:rgba(12,12,13,.55);stroke:var(--line-2);stroke-width:1}
.mv-dial .tk{stroke:var(--mute);stroke-width:1}
.mv-dial .tk.q{stroke:var(--bone);stroke-width:1.4}
.mv-dial .hand{stroke:var(--steel-2);stroke-width:1.4;stroke-linecap:round}
.mv-dial .pin{fill:var(--steel-2)}
.mv-dial .arc{fill:none;stroke:var(--steel);stroke-width:2;opacity:.7}
.mv-dial text{font:500 7px var(--sans);letter-spacing:.14em;fill:var(--mute)}
.mv-loupe{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;width:0;height:0;opacity:0;transition:opacity .3s}
.mv-loupe.is-on{opacity:1}.mv-loupe.is-off{opacity:0}
.mv-loupe .ring{position:absolute;left:-10px;top:-10px;width:20px;height:20px;border-radius:50%;border:1px solid var(--bone);transition:width .7s cubic-bezier(.7,0,.3,1),height .7s cubic-bezier(.7,0,.3,1),left .7s cubic-bezier(.7,0,.3,1),top .7s cubic-bezier(.7,0,.3,1),border-color .4s;overflow:hidden;background:transparent}
.mv-loupe .lens{position:absolute;inset:0;border-radius:50%;background-repeat:no-repeat;opacity:0;transition:opacity .4s}
.mv-loupe .ring::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 6px rgba(12,12,13,.85),inset 0 0 0 7px rgba(235,230,220,.5),inset 0 0 30px rgba(0,0,0,.5)}
.mv-loupe .mag{position:absolute;left:84px;top:-8px;font:500 9px var(--sans);letter-spacing:.16em;color:var(--bone-2);opacity:0;transition:opacity .4s;white-space:nowrap}
.mv-loupe.lensing .ring{width:180px;height:180px;left:-90px;top:-90px;border-color:var(--bone)}
.mv-loupe.lensing .lens{opacity:1}
.mv-loupe.lensing .mag{opacity:1;left:100px}
.mv-loupe.hot .ring{width:44px;height:44px;left:-22px;top:-22px;border-color:var(--steel-2)}
@media (hover:hover) and (pointer:fine){html.mv-cursor, html.mv-cursor a, html.mv-cursor button{cursor:none}}
html.mv-cursor #concierge-root, html.mv-cursor #concierge-root *{cursor:auto}
.fin .swatch img{transition:none!important}
.mv-jewel{display:inline-block;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffb3c0,#b0304a 60%,#5a0f20);box-shadow:0 0 6px rgba(200,40,70,.5);margin-right:8px;vertical-align:middle;transform:scale(0)}
.piece .dial{will-change:transform}
@media (max-width:760px){.mv-dial{display:none}}
`);

/* gsap custom ease: n discrete steps with a tiny mechanical overshoot on each. */
function tickEase(gsap, steps) {
  return (p) => {
    const k = Math.floor(p * steps);
    const f = p * steps - k;
    const settle = f < 0.35 ? f / 0.35 : 1 + Math.sin(((f - 0.35) / 0.65) * Math.PI) * 0.04 * (1 - f);
    return Math.min(1, (k + Math.min(1, settle)) / steps);
  };
}

function indexIn(gsap, h) {
  const cs = chars(h, { cls: 'mv-step' });
  if (!cs.length) return;
  gsap.set(cs, { yPercent: 100, opacity: 0 });
  // one character per beat-and-a-half, each one snapping into place
  gsap.to(cs, {
    yPercent: 0,
    opacity: 1,
    duration: BEAT * 2,
    ease: tickEase(gsap, 2),
    stagger: BEAT / 2,
    scrollTrigger: { trigger: h, start: 'top 86%', once: true },
  });
}

function secondsDial(gsap, ScrollTrigger) {
  const d = el('div', 'mv-dial');
  d.setAttribute('aria-hidden', 'true');
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const q = i % 15 === 0;
    const r1 = q ? 26 : 29, r2 = 32;
    ticks += `<line class="tk${q ? ' q' : ''}" x1="${34 + Math.sin(a) * r1}" y1="${34 - Math.cos(a) * r1}" x2="${34 + Math.sin(a) * r2}" y2="${34 - Math.cos(a) * r2}"/>`;
  }
  d.innerHTML = `<svg viewBox="0 0 68 68"><circle class="rim" cx="34" cy="34" r="33"/>${ticks}<path class="arc" d=""/><line class="hand" x1="34" y1="40" x2="34" y2="9"/><circle class="pin" cx="34" cy="34" r="2"/><text x="34" y="50" text-anchor="middle">MV</text></svg>`;
  document.body.appendChild(d);
  const hand = $('.hand', d);
  const arc = $('.arc', d);
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (s) => {
      // the hand jumps in whole seconds (60 steps) — it never sweeps
      const sec = Math.round(s.progress * 59);
      const ang = (sec / 60) * 360;
      hand.setAttribute('transform', `rotate(${ang} 34 34)`);
      const a = (ang * Math.PI) / 180;
      const large = ang > 180 ? 1 : 0;
      arc.setAttribute('d', sec ? `M34 4 A30 30 0 ${large} 1 ${34 + Math.sin(a) * 30} ${34 - Math.cos(a) * 30}` : '');
      d.classList.toggle('on', s.progress > 0.04);
    },
  });
}

function loupe(gsap) {
  document.documentElement.classList.add('mv-cursor');
  const l = el('div', 'mv-loupe', '<div class="ring"><div class="lens"></div></div><span class="mag">×4 · ANGLAGE</span>');
  l.setAttribute('aria-hidden', 'true');
  const lens = $('.lens', l);
  const mag = $('.mag', l);
  const ZOOM = 4;
  const R = 90;
  follower(gsap, l, {
    duration: 0.25,
    onMove: (e, t) => {
      const img = t?.closest('.fin .swatch')?.querySelector('img');
      l.classList.toggle('hot', !img && !!t?.closest('a, button, input, select, textarea, label, tr'));
      if (!img || !img.complete) {
        l.classList.remove('lensing');
        return;
      }
      l.classList.add('lensing');
      const r = img.getBoundingClientRect();
      // object-fit: cover geometry
      const ir = img.naturalWidth / img.naturalHeight, br = r.width / r.height;
      const dw = ir > br ? r.height * ir : r.width;
      const dh = ir > br ? r.height : r.width / ir;
      const ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
      const px = e.clientX - r.left - ox, py = e.clientY - r.top - oy;
      lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
      lens.style.backgroundSize = `${dw * ZOOM}px ${dh * ZOOM}px`;
      lens.style.backgroundPosition = `${-(px * ZOOM - R)}px ${-(py * ZOOM - R)}px`;
      mag.textContent = `×${ZOOM} · ${(t.closest('.fin')?.querySelector('h3')?.firstChild?.textContent || '').trim().toUpperCase()}`;
    },
  });
}

async function run() {
  // Native scrolling; the site's own 520vh movement section relies on real scroll positions.
  const ctx = await boot({ lenis: false }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  $$('main .sec-head h2, #maison-h').forEach((h) => {
    release(h.closest('.reveal'));
    indexIn(gsap, h);
  });

  // Finishing operations arrive one beat apart, like teeth of the escape wheel passing.
  $$('.fin').forEach((f) => {
    release(f);
    const parts = [$('.idx', f), $('h3', f), $('p', f), $('.swatch', f)].filter(Boolean);
    gsap.from(parts, { x: 40, opacity: 0, duration: BEAT * 3, ease: tickEase(gsap, 3), stagger: BEAT, scrollTrigger: { trigger: f, start: 'top 82%', once: true } });
    const img = $('.swatch img', f);
    if (img) gsap.fromTo(img, { scale: 1.18 }, { scale: 1, ease: tickEase(gsap, 12), scrollTrigger: { trigger: f, start: 'top bottom', end: 'center center', scrub: true } });
  });

  // Collection dials (rendered by the page) — each rotates one beat per scroll notch.
  const pieces = $('#pieces');
  const wirePieces = () => {
    $$('.piece', pieces).forEach((p, i) => {
      if (p.dataset.mv) return;
      p.dataset.mv = '1';
      gsap.from(p, { y: 60, opacity: 0, duration: BEAT * 4, ease: tickEase(gsap, 4), delay: i * BEAT * 2, scrollTrigger: { trigger: pieces, start: 'top 80%', once: true } });
      const dial = $('.dial', p);
      if (dial) gsap.fromTo(dial, { rotate: -6 }, { rotate: 6, ease: tickEase(gsap, 24), scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  };
  if (pieces) {
    wirePieces();
    new MutationObserver(wirePieces).observe(pieces, { childList: true });
  }

  // Calibre table: each row is set with a jewel as it enters, 0.17 s apart.
  const rows = $('#calibre-rows');
  const wireRows = () => {
    const trs = $$('tr', rows);
    if (!trs.length || rows.dataset.mv) return;
    rows.dataset.mv = '1';
    trs.forEach((tr) => {
      const first = tr.querySelector('td, th');
      if (first && !first.querySelector('.mv-jewel')) first.prepend(Object.assign(el('span', 'mv-jewel'), { ariaHidden: 'true' }));
    });
    const tl = gsap.timeline({ scrollTrigger: { trigger: rows, start: 'top 85%', once: true } });
    trs.forEach((tr, i) => {
      tl.from(tr, { opacity: 0, x: -20, duration: BEAT * 2, ease: tickEase(gsap, 2) }, i * BEAT * 2);
      tl.to($('.mv-jewel', tr), { scale: 1, duration: BEAT, ease: 'back.out(3)' }, i * BEAT * 2 + BEAT);
    });
  };
  if (rows) {
    wireRows();
    new MutationObserver(wireRows).observe(rows, { childList: true });
  }

  // The house paragraph is set like type in a composing stick: line by line, on the beat.
  $$('#maison .maison-copy p, #appointment .salon-intro p').forEach((p) => {
    release(p.closest('.reveal'));
    gsap.from(p, { clipPath: 'inset(0 0 100% 0)', duration: BEAT * 6, ease: tickEase(gsap, 6), scrollTrigger: { trigger: p, start: 'top 88%', once: true } });
  });

  secondsDial(gsap, ScrollTrigger);
  if (fine) loupe(gsap);
}

run();
