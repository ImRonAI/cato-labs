/* AURELLE — "Breath on glass". Cold, still, slow. Each flacon is behind frosted glass the
   pointer melts clear (a WebGL frost shader with a decaying thaw trail). The collection is a
   pinned climb: an altimeter rises from 1,650 m to 3,100 m as the three extraits pass.
   Type condenses out of blur like breath fading. Cursor is a soft cold halo. */
import { boot, $, $$, el, style, release, words, follower, onCleanup, fine, canPin, webgl, whileVisible, reduced } from './core.js';

style(`
.au-cond{display:inline-block;will-change:filter,opacity,transform}
.au-frost{position:absolute;inset:0;z-index:2;width:100%;height:100%;pointer-events:none}
.au-hint{position:absolute;left:14px;bottom:12px;z-index:3;font:400 10px/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:rgba(21,26,30,.62);pointer-events:none;transition:opacity .8s var(--ease)}
.flacon:hover .au-hint{opacity:0}
.au-climb{position:relative}
.au-alt{position:absolute;left:0;top:0;height:100%;width:100%;pointer-events:none;z-index:3}
.au-alt-inner{position:sticky;top:0;height:100vh;display:flex;align-items:center;justify-content:flex-end;padding-right:clamp(20px,3vw,48px)}
.au-meter{display:grid;justify-items:end;gap:8px;font-family:var(--serif)}
.au-meter .n{font-size:clamp(64px,8.5vw,148px);line-height:.9;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--glacier)}
.au-meter .u{font:400 11px/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;color:var(--ink-3)}
.au-meter .nm{font-style:italic;font-size:clamp(20px,1.8vw,28px);color:var(--ink-2)}
.au-meter .ln{width:1px;height:120px;background:linear-gradient(var(--glacier),transparent);margin-top:12px}
html.au-pinned .collection .flacons{grid-template-columns:1fr!important;max-width:min(560px,46vw);gap:clamp(80px,14vh,160px)!important;border-top:0!important;padding-bottom:30vh}
html.au-pinned .collection .flacon:nth-child(2){margin-left:clamp(40px,8vw,140px)}
html.au-pinned .collection .flacon:nth-child(3){margin-left:clamp(10px,3vw,50px)}
.au-snow{position:absolute;inset:0;pointer-events:none;z-index:0}
.method{isolation:isolate}
.method .wrap{position:relative;z-index:1}
.method .steps li .val b{font-variant-numeric:tabular-nums}
.au-halo{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;opacity:0;transition:opacity .4s}
.au-halo.is-on{opacity:1}.au-halo.is-off{opacity:0}
.au-halo i{position:absolute;left:-28px;top:-28px;width:56px;height:56px;border-radius:50%;background:radial-gradient(circle,rgba(185,204,212,.55),rgba(185,204,212,0) 70%);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);transition:transform .7s var(--ease)}
.au-halo b{position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:50%;background:var(--glacier)}
.au-halo.big i{transform:scale(2.2)}
@media (max-width:860px){.au-alt{display:none}}
`);

/* Frost shader over each flacon photo. The pointer leaves a thawed trail that slowly refreezes. */
async function frost(THREE, fig) {
  const img = $('img', fig);
  if (!img) return;
  const canvas = el('canvas', 'au-frost');
  canvas.setAttribute('aria-hidden', 'true');
  fig.appendChild(canvas);
  const hint = el('span', 'au-hint', 'Breathe on the glass');
  hint.setAttribute('aria-hidden', 'true');
  fig.appendChild(hint);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // Thaw map: a small 2D canvas we paint into, uploaded as a texture each frame.
  const M = 128;
  const mc = document.createElement('canvas');
  mc.width = mc.height = M;
  const mx = mc.getContext('2d');
  mx.fillStyle = '#000';
  mx.fillRect(0, 0, M, M);
  const mask = new THREE.CanvasTexture(mc);
  const tex = await new THREE.TextureLoader().loadAsync(img.currentSrc || img.src);
  tex.colorSpace = THREE.SRGBColorSpace;
  const u = {
    uTex: { value: tex },
    uMask: { value: mask },
    uTime: { value: 0 },
    uAspect: { value: new THREE.Vector2(1, 1) },
    uIntro: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: u,
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: /* glsl */ `
      precision highp float; varying vec2 v; uniform sampler2D uTex,uMask; uniform float uTime,uIntro; uniform vec2 uAspect;
      float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p*=2.1;a*=.5;}return s;}
      vec3 tap(vec2 uv){
        // object-fit: cover
        vec2 s=uAspect; vec2 c=(uv-.5)/s+.5; return texture2D(uTex,c).rgb;}
      void main(){
        float thaw=texture2D(uMask,v).r;
        float crystals=fbm(v*vec2(18.,22.)) ; float fern=fbm(v*vec2(60.,7.)+crystals*2.);
        float frostAmt=clamp((1.-thaw)*uIntro,0.,1.);
        vec2 off=(vec2(fbm(v*40.),fbm(v*40.+7.))-.5)*.05*frostAmt;
        vec3 col=vec3(0.);
        // cheap blur by multi-tap, scaled by frost
        float r=.012*frostAmt;
        col+=tap(v+off);
        col+=tap(v+off+vec2(r,0.));col+=tap(v+off-vec2(r,0.));col+=tap(v+off+vec2(0.,r));col+=tap(v+off-vec2(0.,r));
        col/=5.;
        vec3 ice=vec3(.90,.94,.96);
        col=mix(col,ice,frostAmt*(.42+.25*crystals));
        col+=vec3(1.)*smoothstep(.62,.9,fern)*.22*frostAmt;
        // a clear wet rim at the edge of the thawed area
        float rim=smoothstep(.15,.35,thaw)*(1.-smoothstep(.35,.6,thaw));
        col+=vec3(.75,.85,.9)*rim*.25;
        gl_FragColor=vec4(col,1.);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const size = () => {
    const w = fig.clientWidth, hgt = fig.clientHeight;
    renderer.setSize(w, hgt, false);
    const ia = tex.image.width / tex.image.height, ca = w / hgt;
    u.uAspect.value.set(ca > ia ? 1 : ia / ca, ca > ia ? ca / ia : 1);
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(fig);
  img.style.visibility = 'hidden';
  let last = null;
  const paint = (x, y, r = 16) => {
    const g = mx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    mx.fillStyle = g;
    mx.beginPath();
    mx.arc(x, y, r, 0, Math.PI * 2);
    mx.fill();
  };
  const onMove = (e) => {
    const rc = fig.getBoundingClientRect();
    const x = ((e.clientX - rc.left) / rc.width) * M;
    const y = ((e.clientY - rc.top) / rc.height) * M;
    if (last) {
      const steps = Math.ceil(Math.hypot(x - last.x, y - last.y) / 3);
      for (let i = 1; i <= steps; i++) paint(last.x + ((x - last.x) * i) / steps, last.y + ((y - last.y) * i) / steps);
    } else paint(x, y);
    last = { x, y };
  };
  fig.addEventListener('pointermove', onMove);
  fig.addEventListener('pointerleave', () => (last = null));
  // Touch/keyboard: a tap or focus thaws the centre so nobody is locked out of the image.
  const open = () => paint(M / 2, M / 2, 70);
  fig.closest('a')?.addEventListener('focus', open);
  fig.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && open());
  const frame = () => {
    mx.fillStyle = 'rgba(0,0,0,0.012)'; // refreeze, slowly
    mx.fillRect(0, 0, M, M);
    mask.needsUpdate = true;
    renderer.render(scene, cam);
  };
  whileVisible(window.gsap, fig, frame);
  onCleanup(() => {
    ro.disconnect();
    tex.dispose();
    mask.dispose();
    mat.dispose();
    renderer.dispose();
  });
}

function condense(gsap, h, opts = {}) {
  const ws = words(h, { inner: 'au-cond' });
  if (!ws.length) return;
  gsap.set(ws, { opacity: 0, filter: 'blur(14px)', y: 8 });
  gsap.to(ws, {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    duration: 2.2,
    ease: 'sine.out',
    stagger: { each: opts.each ?? 0.07, from: opts.from ?? 'start' },
    scrollTrigger: { trigger: h, start: 'top 86%', once: true },
  });
}

/* Slow drifting snow in the method chapter (2D, cheap, only while visible). */
function snow(gsap, host) {
  const c = el('canvas', 'au-snow');
  c.setAttribute('aria-hidden', 'true');
  host.prepend(c);
  const x = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const flakes = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, s: 0.15 + Math.random() * 0.5, p: Math.random() * 6 }));
  const size = () => {
    W = host.clientWidth;
    H = host.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(host);
  let t = 0;
  whileVisible(gsap, host, (_a, dt) => {
    t += dt / 1000;
    x.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += (f.s * dt) / 16000;
      if (f.y > 1.02) f.y = -0.02;
      const px = (f.x + Math.sin(t * 0.4 + f.p) * 0.012) * W;
      x.globalAlpha = 0.25 + f.r * 0.18;
      x.fillStyle = '#e9efef';
      x.beginPath();
      x.arc(px, f.y * H, f.r, 0, Math.PI * 2);
      x.fill();
    }
  });
  onCleanup(() => ro.disconnect());
}

async function run() {
  const ctx = await boot({ lenis: { lerp: 0.055, wheel: 0.8 } }).catch(() => null);
  if (!ctx) return;
  const { gsap, ScrollTrigger } = ctx;

  const statement = $('#man-h');
  if (statement) {
    release(statement);
    condense(gsap, statement, { each: 0.09 });
  }
  $$('#col-h, #met-h, #discovery h2, #ate-h').forEach((h) => {
    release(h);
    condense(gsap, h);
  });
  $$('.manifesto .body, .collection .sec-head p, .method .sec-head p').forEach((p) => {
    release(p);
    gsap.from(p, { opacity: 0, filter: 'blur(8px)', duration: 2, ease: 'sine.out', scrollTrigger: { trigger: p, start: 'top 90%', once: true } });
  });

  // Collection: pinned altimeter while the three flacons climb past.
  const col = $('#collection');
  const flacons = $$('.flacon', col);
  const altFor = [2042, 3100, 1650];
  const nameFor = ['Sommet N°1', 'Crevasse N°2', 'Treeline N°3'];
  if (col && flacons.length === 3 && canPin()) {
    document.documentElement.classList.add('au-pinned');
    // Order by altitude so the climb only goes up: Treeline → Sommet → Crevasse.
    const grid = $('.flacons', col);
    [2, 0, 1].forEach((i) => grid.appendChild(flacons[i]));
    const order = [2, 0, 1];
    const alt = el('div', 'au-alt', '<div class="au-alt-inner"><div class="au-meter"><span class="u">Gathered at</span><span class="n">1,035</span><span class="u">metres</span><span class="nm">The atelier</span><span class="ln"></span></div></div>');
    alt.setAttribute('aria-hidden', 'true');
    col.style.position = 'relative';
    col.appendChild(alt);
    const n = $('.n', alt);
    const nm = $('.nm', alt);
    const o = { v: 1035 };
    const set = (target, name) => {
      gsap.to(o, { v: target, duration: 1.6, ease: 'expo.out', onUpdate: () => (n.textContent = Math.round(o.v).toLocaleString('en-US')) });
      gsap.fromTo(nm, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.2 });
      nm.textContent = name;
    };
    order.forEach((src, k) => {
      const f = $$('.flacon', grid)[k];
      release(f);
      ScrollTrigger.create({
        trigger: f,
        start: 'top 55%',
        end: 'bottom 45%',
        onEnter: () => set(altFor[src], nameFor[src]),
        onEnterBack: () => set(altFor[src], nameFor[src]),
      });
      gsap.from(f, { y: 120, opacity: 0, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 92%', once: true } });
      gsap.fromTo($('.fig', f), { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  } else {
    flacons.forEach((f, i) => {
      release(f);
      gsap.from(f, { y: 60, opacity: 0, duration: 1.6, delay: i * 0.12, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 90%', once: true } });
    });
  }

  // Frost over each flacon photograph.
  if (!reduced && webgl()) {
    try {
      const THREE = await import('three');
      for (const f of flacons) await frost(THREE, $('.fig', f));
    } catch {
      /* the photographs stay unfrosted */
    }
  }

  // Method: it snows, and the four steps freeze into place one by one.
  const method = $('#method');
  if (method) {
    snow(gsap, method);
    const steps = $$('.steps li', method);
    steps.forEach(release);
    gsap.from(steps, { y: 50, opacity: 0, filter: 'blur(10px)', duration: 1.8, ease: 'expo.out', stagger: 0.18, scrollTrigger: { trigger: $('.steps', method), start: 'top 82%', once: true } });
    const cold = $('.cold', method);
    if (cold) gsap.fromTo(cold, { xPercent: 20 }, { xPercent: -30, ease: 'none', scrollTrigger: { trigger: method, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  if (fine) {
    const h = el('div', 'au-halo', '<i></i><b></b>');
    h.setAttribute('aria-hidden', 'true');
    follower(gsap, h, { duration: 0.9, onMove: (_e, t) => h.classList.toggle('big', !!t?.closest('.flacon .fig, a, button')) });
  }
}

run();
