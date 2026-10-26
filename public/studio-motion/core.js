/* Studio Motion core — library loading and small utilities only.
   Every site's visual language lives in its own module (/studio-motion/<slug>.js). */

const CDN = {
  gsap: 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js',
  st: 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js',
  lenis: 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js',
};

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const cleanups = [];
export const onCleanup = (fn) => cleanups.push(fn);
addEventListener(
  'pagehide',
  () =>
    cleanups.splice(0).forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }),
  { once: true }
);

/** Pinned/horizontal set pieces need a real viewport and a real scroll position. */
export const canPin = () => !reduced && !embedded && innerWidth > 860;

function load(src) {
  return new Promise((resolve, reject) => {
    const hit = document.querySelector(`script[data-sm="${src}"]`);
    if (hit) {
      if (hit.dataset.ok) resolve();
      else hit.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.dataset.sm = src;
    s.onload = () => {
      s.dataset.ok = '1';
      resolve();
    };
    s.onerror = () => reject(new Error(src));
    document.head.appendChild(s);
  });
}

/**
 * Loads GSAP + ScrollTrigger (+ Lenis when asked) and wires them together.
 * `lenis: false` keeps native scrolling — some sites are meant to feel unsmoothed.
 */
export async function boot({ lenis = { lerp: 0.09 } } = {}) {
  if (reduced) return null;
  await load(CDN.gsap);
  await load(CDN.st);
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ overwrite: 'auto' });
  let smooth = null;
  if (lenis && !embedded) {
    try {
      await load(CDN.lenis);
      smooth = startLenis(gsap, ScrollTrigger, lenis);
    } catch {
      smooth = null;
    }
  }
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  addEventListener('load', refresh, { once: true });
  return { gsap, ScrollTrigger, lenis: smooth };
}

function startLenis(gsap, ScrollTrigger, opts) {
  const Lenis = window.Lenis;
  if (!Lenis) return null;
  const lenis = new Lenis({
    lerp: opts.lerp ?? 0.09,
    wheelMultiplier: opts.wheel ?? 1,
    smoothWheel: true,
    syncTouch: false,
    autoRaf: false,
    prevent: (node) =>
      !!node.closest?.(
        '#concierge-root, dialog, [role="dialog"], .view, .sheet, .menu-panel, .drawer, .mnav, .dossier-backdrop, [data-lenis-prevent]'
      ),
  });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  const root = document.documentElement;
  root.classList.add('lenis');
  // Follow each site's own scroll locks (menus, dialogs, hash-routed views).
  const sync = () => {
    const o = getComputedStyle(document.body).overflowY;
    const locked = o === 'hidden' || o === 'clip' || !!document.querySelector('dialog[open]:modal');
    if (locked && !lenis.isStopped) lenis.stop();
    else if (!locked && lenis.isStopped) lenis.start();
  };
  const mo = new MutationObserver(sync);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  mo.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
  $$('dialog').forEach((d) => mo.observe(d, { attributes: true, attributeFilter: ['open'] }));
  window.__studioLenis = lenis;
  onCleanup(() => {
    mo.disconnect();
    gsap.ticker.remove(tick);
    lenis.destroy();
  });
  return lenis;
}

/** Stop a site's own IntersectionObserver reveal from fighting a GSAP tween. */
export function release(el) {
  if (!el) return;
  el.classList.add('in', 'is-visible', 'on', 'show');
  el.style.opacity = '1';
  el.style.transform = 'none';
  el.style.transition = 'none';
  el.style.animation = 'none';
  el.style.filter = 'none';
}

function textOnly(el) {
  return !el.querySelector('a, button, input, select, textarea, img, svg, .w');
}

/** Split into word spans. Keeps an unsplit accessible name; nested <em>/<span> survive. */
export function words(el, { wrap = 'sx-w', inner = 'sx-wi' } = {}) {
  if (!el || !textOnly(el) || el.dataset.sxSplit) return [];
  el.dataset.sxSplit = 'w';
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const out = [];
  const walk = (node) => {
    Array.from(node.childNodes).forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '));
          const w = document.createElement('span');
          w.className = wrap;
          w.setAttribute('aria-hidden', 'true');
          const i = document.createElement('span');
          i.className = inner;
          i.textContent = part;
          w.appendChild(i);
          frag.appendChild(w);
          out.push(i);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
    });
  };
  walk(el);
  return out;
}

/** Split into character spans grouped by word (so lines still wrap on spaces). */
export function chars(el, { cls = 'sx-c' } = {}) {
  if (!el || !textOnly(el) || el.dataset.sxSplit) return [];
  el.dataset.sxSplit = 'c';
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  ensureCharStyle();
  const out = [];
  const walk = (node) => {
    Array.from(node.childNodes).forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((part, idx) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '));
          // Punctuation glued to a preceding element (e.g. "<em>Toyosu</em>,") must stay on its line.
          const prevWord = idx === 0 && c.previousSibling?.nodeType === 1 ? Array.from(c.previousSibling.querySelectorAll('.sx-cw')).pop() : null;
          let w;
          if (prevWord) {
            w = document.createElement('span');
            const cs = getComputedStyle(node);
            w.style.cssText = `font-style:${cs.fontStyle};color:${cs.color};font-weight:${cs.fontWeight}`;
            prevWord.appendChild(w);
          } else {
            w = document.createElement('span');
            w.className = 'sx-cw';
            w.setAttribute('aria-hidden', 'true');
          }
          for (const ch of part) {
            const s = document.createElement('span');
            s.className = cls;
            s.textContent = ch;
            w.appendChild(s);
            out.push(s);
          }
          if (!prevWord) frag.appendChild(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
    });
  };
  walk(el);
  return out;
}

let charStyled = false;
function ensureCharStyle() {
  if (charStyled) return;
  charStyled = true;
  const st = document.createElement('style');
  st.textContent = '.sx-cw{display:inline-block;white-space:nowrap}';
  document.head.appendChild(st);
}

/** Telemetry-style decode: characters resolve from noise, left to right. */
export function decode(el, { duration = 1.1, glyphs = '0123456789ABCDEF/\\<>+-=·', delay = 0 } = {}) {
  const target = el.dataset.sxText ?? el.textContent;
  el.dataset.sxText = target;
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', target);
  const start = performance.now() + delay * 1000;
  let raf = 0;
  return new Promise((resolve) => {
    const step = (now) => {
      const p = Math.min(1, Math.max(0, (now - start) / (duration * 1000)));
      const n = Math.floor(p * target.length);
      let s = target.slice(0, n);
      for (let i = n; i < target.length; i++) {
        const ch = target[i];
        s += ch === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = s;
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        el.textContent = target;
        resolve();
      }
    };
    raf = requestAnimationFrame(step);
    onCleanup(() => cancelAnimationFrame(raf));
  });
}

export function style(css) {
  const s = document.createElement('style');
  s.dataset.studioMotion = '';
  s.textContent = css;
  document.head.appendChild(s);
  return s;
}

/** Follower element that tracks the pointer; hidden over the concierge and on touch. */
export function follower(gsap, node, { duration = 0.45, onMove } = {}) {
  if (!fine || reduced) return null;
  document.body.appendChild(node);
  const xTo = gsap.quickTo(node, 'x', { duration, ease: 'power3.out' });
  const yTo = gsap.quickTo(node, 'y', { duration, ease: 'power3.out' });
  const move = (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
    const t = e.target instanceof Element ? e.target : null;
    node.classList.toggle('is-off', !!t?.closest('#concierge-root, dialog[open], .view:not([hidden])'));
    node.classList.add('is-on');
    onMove?.(e, t);
  };
  const out = (e) => {
    if (!e.relatedTarget) node.classList.remove('is-on');
  };
  addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerout', out);
  onCleanup(() => {
    removeEventListener('pointermove', move);
    document.removeEventListener('pointerout', out);
    node.remove();
  });
  return node;
}

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

export function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Run `frame` on the GSAP ticker only while `target` is on screen and the tab is visible. */
export function whileVisible(gsap, target, frame) {
  let inView = false;
  let on = false;
  const set = () => {
    const want = inView && !document.hidden;
    if (want && !on) gsap.ticker.add(frame);
    else if (!want && on) gsap.ticker.remove(frame);
    on = want;
  };
  const io = new IntersectionObserver((e) => {
    inView = e[0].isIntersecting;
    set();
  });
  io.observe(target);
  document.addEventListener('visibilitychange', set);
  const stop = () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', set);
    gsap.ticker.remove(frame);
  };
  onCleanup(stop);
  return stop;
}
