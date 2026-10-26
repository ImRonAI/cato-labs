/* VESPERA — "Ascent". The page is a climb: the sky behind it thins from horizon haze to the
   stratosphere's black, stars come out, and a HUD altitude ruler tracks the descent of text
   decoding like telemetry. Cursor is a targeting reticle. */
import { boot, $, $$, el, style, release, decode, follower, onCleanup, reduced, fine, webgl, canPin } from './core.js';

style(`
.vx-sky{position:fixed;inset:0;z-index:-1;pointer-events:none;background:#0a0b10}
.vx-sky canvas{display:block;width:100%;height:100%}
html.vx main > section:not(.hero), html.vx footer.ft{background:transparent!important}
html.vx body{background:transparent}
html.vx .approach{background:rgba(15,17,23,.38)!important;backdrop-filter:blur(2px)}
.vx-hud{position:fixed;right:clamp(14px,2.4vw,36px);top:50%;transform:translateY(-50%);z-index:45;height:min(62vh,560px);width:64px;pointer-events:none;
  font:500 10px/1 var(--sans);letter-spacing:.14em;color:var(--ink-3);opacity:0;transition:opacity .8s var(--ease-out)}
.vx-hud.on{opacity:1}
.vx-hud .rail{position:absolute;right:0;top:0;bottom:0;width:1px;background:linear-gradient(var(--line-2),var(--line-2) 50%,transparent 50%) 0 0/1px 6px}
.vx-hud .tick{position:absolute;right:0;display:flex;align-items:center;gap:8px;transform:translateY(-50%)}
.vx-hud .tick i{display:block;width:8px;height:1px;background:var(--ink-3)}
.vx-hud .tick.band i{width:14px;background:var(--accent)}
.vx-hud .tick.band span{color:var(--accent)}
.vx-hud .cur{position:absolute;right:-4px;top:0;display:flex;align-items:center;gap:10px;transform:translateY(-50%);color:var(--ink)}
.vx-hud .cur b{font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:.06em;font-size:11px}
.vx-hud .cur i{display:block;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:7px solid var(--accent)}
.vx-hud .layer{position:absolute;right:28px;bottom:-26px;white-space:nowrap;color:var(--ink-2)}
#alt-mark{display:none!important}
.vx-reticle{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;width:0;height:0;opacity:0;transition:opacity .25s}
.vx-reticle.is-on{opacity:1}.vx-reticle.is-off{opacity:0}
.vx-reticle .r{position:absolute;left:-22px;top:-22px;width:44px;height:44px;transition:transform .5s var(--ease-out)}
.vx-reticle .r i{position:absolute;width:10px;height:10px;border:1px solid var(--accent-2)}
.vx-reticle .r i:nth-child(1){left:0;top:0;border-right:0;border-bottom:0}
.vx-reticle .r i:nth-child(2){right:0;top:0;border-left:0;border-bottom:0}
.vx-reticle .r i:nth-child(3){left:0;bottom:0;border-right:0;border-top:0}
.vx-reticle .r i:nth-child(4){right:0;bottom:0;border-left:0;border-top:0}
.vx-reticle .d{position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:50%;background:var(--accent-2)}
.vx-reticle .t{position:absolute;left:30px;top:14px;font:500 9px/1.3 var(--sans);letter-spacing:.14em;color:var(--ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.vx-reticle.lock .r{transform:scale(.62) rotate(45deg)}
.vx-reticle.lock .r i{border-color:var(--accent)}
@media (hover:hover) and (pointer:fine){html.vx-cursor, html.vx-cursor a, html.vx-cursor button{cursor:none}}
html.vx-cursor #concierge-root, html.vx-cursor #concierge-root *{cursor:auto}
.vx-scan{position:relative;overflow:hidden}
.vx-scan::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,transparent 0,rgba(240,200,154,.0) 46%,rgba(240,200,154,.45) 50%,rgba(240,200,154,0) 54%,transparent 100%);transform:translateY(-100%)}
.vx-scan.go::after{animation:vxscan 1.6s var(--ease-out) forwards}
@keyframes vxscan{to{transform:translateY(100%)}}
.vx-frame{position:absolute;inset:10px;pointer-events:none;z-index:2}
.vx-frame i{position:absolute;width:18px;height:18px;border:1px solid var(--accent-2);opacity:.9}
.vx-frame i:nth-child(1){left:0;top:0;border-right:0;border-bottom:0}
.vx-frame i:nth-child(2){right:0;top:0;border-left:0;border-bottom:0}
.vx-frame i:nth-child(3){left:0;bottom:0;border-right:0;border-top:0}
.vx-frame i:nth-child(4){right:0;bottom:0;border-left:0;border-top:0}
.vx-frame b{position:absolute;left:28px;top:8px;font:500 9px/1 var(--sans);letter-spacing:.16em;color:var(--accent-2)}
.vx-tele{font-variant-numeric:tabular-nums}
@media (max-width:899px){.vx-hud{display:none}}
`);

const BANDS = [
  { km: 0, label: 'Weather' },
  { km: 12, label: 'Air corridors' },
  { km: 20, label: 'Stratosphere', band: true },
  { km: 26, label: '', band: true },
  { km: 100, label: 'Kármán line' },
];
// Scroll progress → altitude. Linger in the operating band for the middle of the page.
const altAt = (p) => {
  if (p < 0.22) return (p / 0.22) * 20;
  if (p < 0.8) return 20 + ((p - 0.22) / 0.58) * 6;
  return 26 + ((p - 0.8) / 0.2) * 74;
};
const layerAt = (km) => (km < 10 ? 'Troposphere' : km < 20 ? 'Tropopause' : km <= 26.2 ? 'Operating band' : km < 50 ? 'Upper stratosphere' : 'Mesosphere');

async function sky(THREE, host) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const u = { uRes: { value: new THREE.Vector2() }, uAlt: { value: 0 }, uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: /* glsl */ `
      precision highp float; varying vec2 v; uniform vec2 uRes; uniform float uAlt, uTime; uniform vec2 uMouse;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
      void main(){
        vec2 uv=v; float asp=uRes.x/uRes.y;
        float a=clamp(uAlt/26.,0.,1.); float space=smoothstep(26.,90.,uAlt);
        // horizon sits low and sinks out of frame as we climb; it curves with altitude
        vec2 c=vec2((uv.x-.5)*asp,uv.y);
        float curve=mix(0.0,0.9,a); float hy=mix(.34,-.55,smoothstep(0.,1.,a*1.1)) - curve*c.x*c.x*.18;
        float d=uv.y-hy;
        vec3 deep=vec3(.020,.024,.040), zen=mix(vec3(.10,.14,.26),vec3(.03,.035,.06),a);
        vec3 haze=mix(vec3(.95,.64,.38),vec3(.85,.50,.33),a), band=vec3(.33,.27,.42);
        vec3 col=mix(haze,band,smoothstep(0.,.12,d));
        col=mix(col,zen,smoothstep(.06,.5,d));
        col=mix(col,deep,smoothstep(.3,1.,d)+a*.35);
        // thin bright limb line
        col+=vec3(1.,.78,.55)*exp(-abs(d)*mix(60.,180.,a))*mix(.55,.9,a);
        // below the horizon: the planet / cloud deck
        if(d<0.){float cl=fbm(vec2(c.x*3.+uTime*.01,(uv.y*9.)/(1.-d*6.)));
          vec3 ground=mix(vec3(.05,.05,.07),vec3(.18,.15,.18),cl)*mix(1.,.55,a);
          col=mix(col,ground,smoothstep(0.,-.02,d));}
        // stars arrive as the air thins
        vec2 g=uv*uRes/2.2; vec2 id=floor(g); float r=h(id);
        float star=step(.9965,r)*smoothstep(.5,0.,length(fract(g)-.5))*(.55+.45*sin(uTime*2.+r*90.));
        float vis=smoothstep(.45,1.,a)*smoothstep(-.02,.25,d)+space;
        col+=vec3(.9,.92,1.)*star*clamp(vis,0.,1.);
        // faint aurora-like airglow in the operating band
        col+=vec3(.25,.55,.45)*.05*smoothstep(.05,.0,abs(d-.08))*a*(1.-space);
        // vignette + a soft lift where the pointer is
        col*=1.-.35*pow(length(uv-.5),2.);
        col+=vec3(.9,.7,.5)*.025*smoothstep(.35,0.,length((uv-uMouse)*vec2(asp,1.)));
        gl_FragColor=vec4(col,1.);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const size = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    u.uRes.value.set(innerWidth, innerHeight);
  };
  size();
  addEventListener('resize', size);
  onCleanup(() => {
    removeEventListener('resize', size);
    mat.dispose();
    renderer.dispose();
  });
  return { u, render: () => renderer.render(scene, cam) };
}

async function run() {
  document.documentElement.classList.add('vx');
  const ctx = await boot({ lenis: { lerp: 0.075 } }).catch(() => null);
  const hero = $('#hero');

  // HUD altitude ruler (decorative; the real figures are in the content).
  const hud = el('div', 'vx-hud');
  hud.setAttribute('aria-hidden', 'true');
  const MAXKM = 100;
  const y = (km) => `${(1 - Math.log10(1 + km) / Math.log10(1 + MAXKM)) * 100}%`;
  hud.innerHTML =
    '<span class="rail"></span>' +
    BANDS.map((b) => `<span class="tick${b.band ? ' band' : ''}" style="top:${y(b.km)}"><span>${b.km ? b.km + ' KM' : 'SEA'}</span><i></i></span>`).join('') +
    '<span class="cur"><b>0.0 KM</b><i></i></span><span class="layer">Troposphere</span>';
  document.body.appendChild(hud);
  const cur = $('.cur', hud);
  const curB = $('b', cur);
  const layer = $('.layer', hud);

  if (!ctx) {
    hud.remove();
    return;
  }
  const { gsap, ScrollTrigger } = ctx;

  let skyGL = null;
  if (!reduced && webgl()) {
    const host = el('div', 'vx-sky');
    host.setAttribute('aria-hidden', 'true');
    document.body.prepend(host);
    try {
      const THREE = await import('three');
      skyGL = await sky(THREE, host);
    } catch {
      host.remove();
    }
  }

  const state = { km: 0 };
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (s) => {
      const km = altAt(s.progress);
      state.km = km;
      curB.textContent = `${km.toFixed(1)} KM`;
      cur.style.top = y(km);
      layer.textContent = layerAt(km);
      hud.classList.toggle('on', scrollY > innerHeight * 0.4);
    },
  });

  if (skyGL) {
    const mouse = { x: 0.5, y: 0.5 };
    addEventListener('pointermove', (e) => {
      mouse.x = e.clientX / innerWidth;
      mouse.y = 1 - e.clientY / innerHeight;
    }, { passive: true });
    let alt = 0;
    const frame = (t) => {
      alt += (state.km - alt) * 0.08;
      skyGL.u.uAlt.value = alt;
      skyGL.u.uTime.value = t;
      skyGL.u.uMouse.value.x += (mouse.x - skyGL.u.uMouse.value.x) * 0.05;
      skyGL.u.uMouse.value.y += (mouse.y - skyGL.u.uMouse.value.y) * 0.05;
      skyGL.render();
    };
    gsap.ticker.add(frame);
    const vis = () => (document.hidden ? gsap.ticker.remove(frame) : gsap.ticker.add(frame));
    document.addEventListener('visibilitychange', vis);
    onCleanup(() => gsap.ticker.remove(frame));
  }

  // Hero: the original scene stays; the copy lifts away as we climb out of it.
  if (hero) {
    gsap.to(hero.querySelector('.wrap'), { yPercent: -22, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 20%', scrub: true } });
    gsap.to(hero.querySelector('.scene'), { opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: '40% top', end: 'bottom top', scrub: true } });
  }

  // Section eyebrows + numerals decode like telemetry; headings resolve line by line.
  $$('main .sec .eyebrow, main .sys .n, main .prog .k > span:first-child, .alt-scale .k, .comp-list .k').forEach((n) => {
    release(n.closest('.reveal') || n);
    n.classList.add('vx-tele');
    ScrollTrigger.create({ trigger: n, start: 'top 90%', once: true, onEnter: () => decode(n, { duration: 0.9 }) });
  });
  $$('main .sec-head h2').forEach((h) => {
    release(h.closest('.reveal'));
    gsap.from(h, { clipPath: 'inset(0 0 100% 0)', y: 30, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
  });

  // Systems: each photo is acquired by a targeting frame and a scan sweep.
  $$('.sys').forEach((s, i) => {
    release(s);
    const img = $('.sys-photo', s);
    if (img) {
      const wrap = el('div', 'vx-scan');
      img.before(wrap);
      wrap.appendChild(img);
      const f = el('div', 'vx-frame', `<i></i><i></i><i></i><i></i><b>TGT 0${i + 1} · ACQ</b>`);
      f.setAttribute('aria-hidden', 'true');
      wrap.appendChild(f);
      gsap.set(f, { scale: 1.25, opacity: 0 });
      const tl = gsap.timeline({ scrollTrigger: { trigger: s, start: 'top 78%', once: true } });
      tl.from(img, { clipPath: 'inset(48% 48% 48% 48%)', duration: 1.1, ease: 'expo.inOut' })
        .to(f, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }, 0.5)
        .add(() => wrap.classList.add('go'), 0.7)
        .to($('b', f), { opacity: 0.4, duration: 0.2, repeat: 3, yoyo: true }, 0.9);
    }
    gsap.from([$('h3', s), $('.fig', s)], { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: s, start: 'top 80%', once: true } });
  });

  // The altitude scale scrubs: the operating band lights as the page reaches it.
  const scale = $('.alt-scale');
  if (scale) {
    release(scale);
    const items = $$('li', scale).reverse();
    gsap.from(items, { x: -30, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: scale, start: 'top 80%', once: true } });
    const us = $('li.us', scale);
    if (us) gsap.fromTo(us, { color: 'var(--ink-3)' }, { color: 'var(--ink)', scrollTrigger: { trigger: us, start: 'top 70%', end: 'top 40%', scrub: true } });
  }

  // Programme cards arrive in formation, like a flight in echelon.
  const progs = $$('.prog-grid .prog');
  if (progs.length) {
    release($('.prog-grid'));
    gsap.from(progs, { y: (i) => 70 + i * 26, x: (i) => -20 * i, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.prog-grid', start: 'top 82%', once: true } });
  }

  // Reticle cursor with a live altitude/bearing read-out; locks onto interactive targets.
  if (fine) {
    document.documentElement.classList.add('vx-cursor');
    const r = el('div', 'vx-reticle', '<div class="r"><i></i><i></i><i></i><i></i></div><div class="d"></div><div class="t"></div>');
    r.setAttribute('aria-hidden', 'true');
    const t = $('.t', r);
    follower(gsap, r, {
      duration: 0.3,
      onMove: (e, target) => {
        const lock = !!target?.closest('a, button, input, select, textarea, label, [data-concierge-open]');
        r.classList.toggle('lock', lock);
        const brg = ((e.clientX / innerWidth) * 360).toFixed(0).padStart(3, '0');
        t.textContent = lock ? 'LOCK' : `${state.km.toFixed(1)} KM · ${brg}°`;
      },
    });
  }
}

run();
