/**
 * BuildDirector: four agents drawing an already-made website into place.
 *
 * The page inside the simulator iframe is split along its own structure (the
 * site header, every section of <main>, the footer) and each section into the
 * divs a person would point at: headings, copy, images, canvases, cards, forms.
 * Every one starts masked out.
 *
 * The camera (the iframe's own scroll) frames a screenful and holds it. The four
 * agents spread over the frame and each works on its own: it claims a div near
 * it (leaning towards its specialty, away from the divs the others are on),
 * traces that div's outline, paints it in row by row, then claims the next.
 * Agents stay in a section until nothing in it is left unclaimed, then go to the
 * next one. Once the frame's work is all handed out, the camera moves on a real
 * step, never past a div that hasn't been drawn.
 *
 * Content a site adds after load (WebGL canvases, effect layers) is masked as it
 * arrives and drawn with the div it lies on, or as a div of its own. Scroll scenes
 * inside a pinned (sticky) stage are drawn as the camera walks through the stage.
 *
 * The reveal uses CSS masks rather than clip-path because several of the sites
 * run their own clip-path reveals, which must keep working underneath.
 */

export interface DirectorAgent {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface DirectorStats {
  /** 0 → 1 share of the drawing work that is finished */
  progress: number;
  complete: boolean;
  /** divs drawn so far, per agent id */
  drawn: Record<string, number>;
  /** the section the agents are working in (1-based index) */
  section: { index: number; total: number; label: string };
  /** divs revealed without an agent because none could reach them */
  forced: number;
  /** divs the agents draw on this page */
  blocks: number;
}

export interface DirectorOptions {
  iframe: HTMLIFrameElement;
  /** empty, absolutely positioned layer over the iframe; the director owns its children */
  overlay: HTMLElement;
  agents: readonly DirectorAgent[];
  /** element whose scaleX follows progress every frame */
  bar?: HTMLElement | null;
  /** how long the drawing itself should take; defaults to 18–25 s by page size */
  targetMs?: number;
  onStats?: (stats: DirectorStats) => void;
  onComplete?: () => void;
}

type Kind = 'heading' | 'copy' | 'visual' | 'interactive' | 'structure';
type Anchor = 'flow' | 'sticky' | 'fixed';
type Phase = 'idle' | 'travel' | 'outline' | 'paint';
type Styled = HTMLElement | SVGElement;
type SavedMask = Array<[string, string, string]>;

interface Layer {
  el: Styled;
  saved: SavedMask;
}

interface Block {
  /** the element the agent points at: its box is the frame, its tag the label */
  el: Styled;
  /** everything drawn with it: the element itself, plus anything laid exactly on it (a canvas over its photo, an effect layer) */
  layers: Layer[];
  section: number;
  kind: Kind;
  label: string;
  anchor: Anchor;
  /** part of the site's own header, so the header never stands in its way */
  inHeader: boolean;
  /** natural document top, px */
  top: number;
  /** a pinned (sticky) div: the scroll range over which its sticky box stays in place */
  pinFrom: number;
  pinTo: number;
  rows: number;
  /** paint direction alternates per row (images, cards) instead of writing left to right (text) */
  zigzag: boolean;
  outlineMs: number;
  paintMs: number;
  /** too small or out of reach to draw: revealed when its section starts */
  auto: boolean;
  state: 'pending' | 'active' | 'done';
  /** while it is in frame but not showing: since when it has been out of sight, or fading in */
  hiddenSince: number;
  fadeSince: number;
  lastOpacity: number;
}

interface Candidate {
  b: Block;
  R: DOMRect;
}

/** what the current frame holds for the agents */
interface Survey {
  /** visible, unclaimed divs of the section being drawn */
  cands: Candidate[];
  /** a div in frame is fading in, or only just went out of sight: worth a moment's wait */
  soon: boolean;
  /** a div in frame is waiting on the site (a scroll scene, a scroll trigger) */
  hidden: boolean;
}

interface Rig {
  agent: DirectorAgent;
  prefs: readonly Kind[];
  phase: Phase;
  block: Block | null;
  t0: number;
  dur: number;
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  /** where an idle agent waits, since when it has been waiting, and when it may claim again */
  restX: number;
  restY: number;
  idleAt: number;
  readyAt: number;
  bend: number;
  seed: number;
  drawn: number;
  /** paint head, px below the block's top; the camera follows it down tall blocks */
  headY: number;
  /** the next row, px below the block's top, when it is waiting below the frame for the camera */
  needY: number;
  /** how long the pen has waited for the camera on this div */
  waitMs: number;
  /** when it last got to a div */
  landAt: number;
  /** the div just finished: its frame fades out on that div, even while the page moves under it */
  fading: Styled | null;
  fadeUntil: number;
  cursor: HTMLDivElement;
  frame: HTMLDivElement;
  outline: SVGRectElement;
  tag: HTMLSpanElement;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_ID = 'cato-build-director';
const HIDDEN = 'linear-gradient(transparent, transparent)';
const MASK_PROPS = [
  'mask-image',
  'mask-size',
  'mask-position',
  'mask-repeat',
  '-webkit-mask-image',
  '-webkit-mask-size',
  '-webkit-mask-position',
  '-webkit-mask-repeat',
];
/** drawn as one piece, never split */
const ATOMIC = new Set([
  'img', 'picture', 'video', 'canvas', 'svg', 'iframe', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
  'blockquote', 'figcaption', 'button', 'input', 'select', 'textarea', 'table', 'dl', 'pre',
  'label', 'hr', 'summary',
]);
const NEVER = new Set([
  'script', 'style', 'noscript', 'template', 'link', 'meta', 'dialog', 'br', 'source', 'track',
  'defs', 'title',
]);
const MEDIA = 'img,picture,video,canvas,svg,iframe';
const MEDIA_TAGS = new Set(['img', 'picture', 'video', 'canvas', 'svg', 'iframe']);
/** what each agent reaches for first */
const PREFS: Record<string, readonly Kind[]> = {
  strategy: ['copy', 'heading'],
  design: ['visual'],
  engineering: ['interactive', 'structure'],
  seo: ['heading', 'structure'],
};
/** breathing room under the site's own fixed header */
const PAD = 22;
/** per div, on top of outline and paint: the flight to it and the short look after it, ms */
const OVERHEAD = 520;
/** share of an agent's time spent drawing; the rest goes to flights, looks and camera moves */
const BUSY = 0.55;
/** the fastest a div is drawn, as a share of its natural outline and paint time */
const MIN_SCALE = 0.2;
/** opacity from which a div counts as showing */
const VISIBLE = 0.15;
/** once the camera stops, a beat for the site's scroll scenes to react before it moves again, ms */
const LOOK = 160;
/** how much faster the last agents in a frame work while the others wait on them */
const HURRY = 3;
/** the shortest an outline, a paint or a flight is given, ms */
const MIN_PHASE = 60;
/** the shortest one ever takes, even at the end of a frame's work: a few frames, so it is seen happening */
const MIN_HURRIED = 40;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** deterministic 0–1 noise, so every replay keeps the same personalities */
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const styled = (el: Element): el is Styled => 'style' in el;

/**
 * An element's laid-out size. The sites' motion holds some pieces in a from-state until they
 * scroll into view (cards at scaleY(0), lines flipped 90°), which collapses their on-screen box;
 * the plan has to see the size they will settle at.
 */
function layoutSize(el: Element, r: DOMRect): { w: number; h: number } {
  const html = el as HTMLElement;
  if (typeof html.offsetWidth !== 'number') return { w: r.width, h: r.height };
  return { w: Math.max(r.width, html.offsetWidth), h: Math.max(r.height, html.offsetHeight) };
}

/** area two boxes share, px² */
function intersect(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** intersection over union of two boxes, 0 → 1 */
function overlap(a: DOMRect, b: DOMRect): number {
  const inter = intersect(a, b);
  if (!inter) return 0;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** distance between two boxes' edges, 0 when they touch or overlap */
function gap(a: DOMRect, b: DOMRect): number {
  const dx = Math.max(0, b.left - a.right, a.left - b.right);
  const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
  return Math.hypot(dx, dy);
}

function short(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.4;
}

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img') {
    const alt = (el.getAttribute('alt') || '').trim();
    const file = (el.getAttribute('src') || '').split('/').pop() || 'image';
    return `<img> ${short(alt || file, 22)}`;
  }
  if (tag === 'canvas') return '<canvas> 3D stage';
  if (tag === 'svg') return '<svg> vector';
  if (tag === 'video') return '<video>';
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return text ? `<${tag}> ${short(text, 24)}` : `<${tag}>`;
}

/** the mask this build writes: every mask property set, and all of them !important (no site's own) */
function ownMask(el: Styled): boolean {
  const s = el.style;
  return MASK_PROPS.every((p) => s.getPropertyPriority(p) === 'important');
}

function saveMask(el: Styled): SavedMask {
  const s = el.style;
  return MASK_PROPS.map((p) => [p, s.getPropertyValue(p), s.getPropertyPriority(p)]);
}

function restoreMask(el: Styled, saved: SavedMask): void {
  const s = el.style;
  for (const [p, v, prio] of saved) {
    if (v) s.setProperty(p, v, prio);
    else s.removeProperty(p);
  }
}

function writeMask(el: Styled, image: string, size: string, position: string): void {
  const s = el.style;
  s.setProperty('-webkit-mask-image', image, 'important');
  s.setProperty('mask-image', image, 'important');
  s.setProperty('-webkit-mask-size', size, 'important');
  s.setProperty('mask-size', size, 'important');
  s.setProperty('-webkit-mask-position', position, 'important');
  s.setProperty('mask-position', position, 'important');
  s.setProperty('-webkit-mask-repeat', 'no-repeat', 'important');
  s.setProperty('mask-repeat', 'no-repeat', 'important');
}

/** a piece joining a div mid-paint takes on the paint stroke already laid down */
function copyMask(from: Styled, to: Styled): void {
  const s = from.style;
  writeMask(
    to,
    s.getPropertyValue('mask-image') || HIDDEN,
    s.getPropertyValue('mask-size') || '100% 100%',
    s.getPropertyValue('mask-position') || '0 0'
  );
}

/** an animation that changes how visible its element is */
function fadesIn(a: Animation): boolean {
  if ('transitionProperty' in a) {
    const property = (a as CSSTransition).transitionProperty;
    return property === 'opacity' || property === 'visibility';
  }
  const effect = a.effect as KeyframeEffect | null;
  if (!effect || typeof effect.getKeyframes !== 'function') return false;
  try {
    return effect.getKeyframes().some((k) => 'opacity' in k || 'visibility' in k);
  } catch {
    return false;
  }
}

export class BuildDirector {
  private readonly iframe: HTMLIFrameElement;
  private readonly overlay: HTMLElement;
  private readonly agents: readonly DirectorAgent[];
  private readonly bar: HTMLElement | null;
  private readonly targetMs: number | undefined;
  private readonly onStats?: (stats: DirectorStats) => void;
  private readonly onComplete?: () => void;

  private win: Window;
  private doc: Document;
  private layer: HTMLDivElement | null = null;
  /** the site's header when it is pinned or fixed (it sets the inset under which divs show) */
  private header: Element | null = null;
  /** the site's header, however it is positioned */
  private siteHeader: Element | null = null;
  private sections: Array<{ el: Element; label: string }> = [];
  private blocks: Block[] = [];
  /** every element drawn as part of some div */
  private layerEls = new Set<Element>();
  private rigs: Rig[] = [];
  private scale = 1;
  private baseScale = 1;
  /**
   * past the fastest the drawing may go, the rest of a shortfall comes out of the time around the
   * drawing (camera turns, looks, hand-offs): 1 on time, down to 0.5
   */
  private rush = 1;
  /** how long the drawing should take, ms */
  private target = 22_000;
  private totalWork = 1;
  private shownProgress = 0;

  private prepared = false;
  private destroyed = false;
  private finished = false;
  private playing = false;
  private visible = false;
  private raf = 0;
  private lastTs = 0;
  private clock = 0;
  /** the camera: where it is, the glide it is on, and since when it has been still */
  private camY = 0;
  private camFrom = 0;
  private camTo = 0;
  private camT0 = 0;
  private camDur = 1;
  private camSettled = true;
  private camFollow = false;
  /** the clock of the last frame the camera's landing changed: claims wait a frame on it */
  private camAimAt = -1;
  /** the page can't turn until the agents still drawing are done: they pick up the pace */
  private hurry = false;
  private hurrySince = 0;
  private settledAt = 0;
  private topInset = 0;
  private viewW = 0;
  private current = 0;
  private revealedThrough = -1;
  private stallMs = 0;
  private lastClaimAt = -1000;
  private nextClaimAt = 0;
  private refreshAt = 0;
  private statsAt = -1;
  private forced = 0;
  private skipped = 0;
  private observer: MutationObserver | null = null;
  /** pieces the site added before giving them a size */
  private arrivals: Array<{ el: Element; until: number }> = [];
  private glideRaf = 0;
  private glideOff: (() => void) | null = null;

  constructor(opts: DirectorOptions) {
    const win = opts.iframe.contentWindow;
    const doc = opts.iframe.contentDocument;
    if (!win || !doc || !doc.body) throw new Error('BuildDirector needs a loaded, same-origin iframe');
    this.iframe = opts.iframe;
    this.overlay = opts.overlay;
    this.agents = opts.agents;
    this.bar = opts.bar ?? null;
    this.targetMs = opts.targetMs;
    this.onStats = opts.onStats;
    this.onComplete = opts.onComplete;
    this.win = win;
    this.doc = doc;
  }

  get isComplete(): boolean {
    return this.finished;
  }

  /** Measure the page, mask every div and put the agents at the edges. Resolves when ready to play. */
  async prepare(): Promise<void> {
    const doc = this.doc;
    this.injectStyle();
    // nothing may pop in later: load every lazy image now, and let fonts settle
    doc.querySelectorAll('img[loading="lazy"]').forEach((img) => img.setAttribute('loading', 'eager'));
    await Promise.race([
      Promise.all(
        Array.from(doc.images).map((img) => (img.complete ? null : img.decode().catch(() => null)))
      ),
      wait(2400),
    ]);
    await Promise.race([doc.fonts ? doc.fonts.ready.then(() => undefined) : Promise.resolve(), wait(1200)]);
    if (this.destroyed) return;
    this.setup();
    this.prepared = true;
    this.emit(true);
    this.kick();
  }

  play(): void {
    this.playing = true;
    this.kick();
  }

  pause(): void {
    this.playing = false;
  }

  /** the simulator is on screen and the tab is in front */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.kick();
  }

  /** draw everything at once */
  finish(): void {
    if (!this.prepared || this.finished || this.destroyed) return;
    for (const b of this.blocks) {
      if (b.state !== 'done') {
        this.reveal(b);
        b.state = 'done';
      }
    }
    for (const r of this.rigs) {
      r.block = null;
      r.phase = 'idle';
    }
    this.complete();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    this.unwatch();
    this.endGlide();
    this.clearMasks();
    this.layer?.remove();
    this.layer = null;
    // the next page's veil shouldn't show this build's progress
    if (this.bar) this.bar.style.transform = 'scaleX(0)';
    try {
      this.doc.getElementById(STYLE_ID)?.remove();
    } catch {
      /* the iframe document is already gone */
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Setup                                                              */
  /* ------------------------------------------------------------------ */

  private setup(): void {
    this.win.scrollTo({ top: 0, behavior: 'instant' });
    this.camY = 0;
    this.camFrom = 0;
    this.camTo = 0;
    this.camSettled = true;
    this.camFollow = false;
    this.camAimAt = -1;
    this.settledAt = 0;
    this.clock = 0;
    this.rush = 1;
    this.stallMs = 0;
    this.lastClaimAt = -1000;
    this.nextClaimAt = 0;
    this.hurry = false;
    this.hurrySince = 0;
    this.refreshAt = 0;
    this.statsAt = -1;
    this.forced = 0;
    this.skipped = 0;
    this.shownProgress = 0;
    this.current = 0;
    this.revealedThrough = -1;
    this.collect();
    for (const b of this.blocks) this.hide(b);
    this.buildRigs();
    this.paceDurations();
    this.watch();
    if (this.bar) this.bar.style.transform = 'scaleX(0)';
  }

  private injectStyle(): void {
    const doc = this.doc;
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html { scroll-behavior: auto !important; scroll-snap-type: none !important; }
      body { scroll-snap-type: none !important; }
      #concierge-root { visibility: hidden !important; }
    `;
    doc.head.appendChild(style);
    // the sites' own scroll reveals would replay underneath the agents; settle them first
    doc.querySelectorAll('.rv, .reveal').forEach((el) => el.classList.add('in'));
  }

  private usable(el: Element): boolean {
    if (NEVER.has(el.tagName.toLowerCase())) return false;
    if (el.closest('#concierge-root, [hidden], dialog, template')) return false;
    const s = this.win.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.visibility !== 'collapse';
  }

  /** Split the page into sections, and each section into the divs the agents will draw. */
  private collect(): void {
    const { doc, win } = this;
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    const screen = Math.max(1, vw * vh);
    const css = (el: Element) => win.getComputedStyle(el);
    const ownText = (el: Element) => {
      let n = 0;
      el.childNodes.forEach((c) => {
        if (c.nodeType === 3) n += (c.textContent || '').trim().length;
      });
      return n;
    };
    const hasContent = (el: Element): boolean => {
      if (ATOMIC.has(el.tagName.toLowerCase())) return true;
      if ((el.textContent || '').trim().length) return true;
      if (el.querySelector(MEDIA + ',input,button')) return true;
      const s = css(el);
      if (s.backgroundImage !== 'none') return true;
      if (s.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)) return true;
      return parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0;
    };
    const kids = (el: Element, depth = 0): Element[] => {
      const out: Element[] = [];
      for (const c of Array.from(el.children)) {
        if (!this.usable(c)) continue;
        const { w, h } = layoutSize(c, c.getBoundingClientRect());
        if (w >= 6 && h >= 6) {
          if (hasContent(c)) out.push(c);
        } else if (depth < 2 && c.childElementCount) {
          // a zero-height wrapper around absolutely placed pieces (stacked scenes, captions): look inside
          out.push(...kids(c, depth + 1));
        }
      }
      return out;
    };

    // sections: the site header, the sections of <main>, the footer
    const sections: Element[] = [];
    const bodyKids = Array.from(doc.body.children);
    const header =
      bodyKids.find((c) => c.tagName === 'HEADER' && this.usable(c) && c.getBoundingClientRect().height > 0) ??
      null;
    this.siteHeader = header;
    if (header) sections.push(header);
    const main = doc.querySelector('main');
    if (main) {
      let host: Element = main;
      for (let i = 0; i < 3; i++) {
        const k = kids(host);
        if (k.length === 1 && k[0].getBoundingClientRect().height > vh * 1.5) host = k[0];
        else break;
      }
      sections.push(...kids(host));
    }
    const footer =
      bodyKids.find((c) => c.tagName === 'FOOTER' && this.usable(c) && c.getBoundingClientRect().height > 0) ??
      (main?.nextElementSibling?.tagName === 'FOOTER' ? main.nextElementSibling : null);
    if (footer && !sections.includes(footer)) sections.push(footer);

    const blocks: Block[] = [];
    sections.forEach((sec, si) => {
      const sr = sec.getBoundingClientRect();
      // about ten divs per screenful gives each of the four agents a choice of its own, without
      // turning text into confetti: splitting stops at headings, paragraphs, images and buttons
      const target = clamp(Math.round(((sr.width * sr.height) / screen) * 10), 3, 64);
      const size = new Map<Element, { w: number; h: number }>();
      const sizeOf = (el: Element) => {
        let s = size.get(el);
        if (!s) {
          s = layoutSize(el, el.getBoundingClientRect());
          size.set(el, s);
        }
        return s;
      };
      const areaOf = (el: Element) => {
        const s = sizeOf(el);
        return s.w * s.h;
      };
      const pool: Element[] = [sec];
      const picked: Element[] = [];
      let guard = 0;
      while (pool.length && guard++ < 1500) {
        pool.sort((a, b) => areaOf(b) - areaOf(a));
        const el = pool.shift()!;
        const split = ATOMIC.has(el.tagName.toLowerCase()) || ownText(el) > 2 ? [] : kids(el);
        const tooBig = sizeOf(el).h > vh * 0.9 || areaOf(el) > screen * 0.5;
        const wantMore = picked.length + pool.length + 1 < target;
        if (split.length && (el === sec || tooBig || wantMore || split.length === 1)) pool.push(...split);
        else picked.push(el);
      }

      const drawn: Array<{ b: Block; r: DOMRect; shown: boolean }> = [];
      for (const el of picked) {
        if (!styled(el)) continue;
        const r = el.getBoundingClientRect();
        const s = css(el);
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || '').trim().length;
        const media = MEDIA_TAGS.has(tag) || !!el.querySelector(MEDIA);
        // grain, veils and vignettes belong to the section's backdrop, not to anyone's drawing
        if ((s.position === 'absolute' || s.position === 'fixed') && !text && !media) continue;
        const b = this.makeBlock(el, r, sizeOf(el), si);
        const shown = this.opacityOf(el) >= VISIBLE;
        // a piece stacked exactly on another (a 3D canvas over its own photo, a chart over its
        // image) is one drawing. Scenes stacked to take turns, one showing at a time, are not.
        const under = shown ? drawn.find((d) => d.shown && overlap(d.r, r) >= 0.8) : undefined;
        if (under) {
          under.b.layers.push(...b.layers);
          under.b.auto = under.b.auto && b.auto;
        } else {
          drawn.push({ b, r, shown });
        }
      }
      for (const d of drawn) blocks.push(d.b);
    });

    blocks.sort((a, b) => a.section - b.section || a.top - b.top);
    this.header = header && this.anchorOf(header) !== 'flow' ? header : null;
    this.sections = sections.map((el, i) => ({ el, label: this.labelOf(el, i, sections.length) }));
    this.blocks = blocks;
    this.layerEls = new Set(blocks.flatMap((b) => b.layers.map((l) => l.el)));
    this.attachEffects();
    this.attachFrames();
  }

  /**
   * A frame the site has put around a picture (a scan frame with its brackets and a target label,
   * a link the size of the picture) is drawn with the picture: its own looks, and the small marks
   * inside it, show as the picture is drawn rather than over a picture nobody has drawn yet.
   */
  private attachFrames(): void {
    const folded = new Set<Block>();
    for (const b of this.blocks) {
      if (folded.has(b) || b.auto || !MEDIA_TAGS.has(b.el.tagName.toLowerCase())) continue;
      const frame = this.frameOf(b, folded);
      if (!frame) continue;
      for (const o of frame.inner) {
        folded.add(o);
        // the piece's own effect layers lie inside the frame (frameOf checks), so the frame's mask
        // hides and shows them with the picture; their own masks would otherwise never be lifted
        for (const l of o.layers) if (l.el !== o.el) restoreMask(l.el, l.saved);
      }
      b.layers.push({ el: frame.el, saved: saveMask(frame.el) });
      this.layerEls.add(frame.el);
    }
    if (!folded.size) return;
    this.blocks = this.blocks.filter((b) => !folded.has(b));
    this.layerEls = new Set(this.blocks.flatMap((b) => b.layers.map((l) => l.el)));
  }

  /** the outermost wrapper of a picture that is the picture's own size, and the small pieces inside it */
  private frameOf(b: Block, folded: Set<Block>): { el: Styled; inner: Block[] } | null {
    const P = b.el.getBoundingClientRect();
    const area = Math.max(1, P.width * P.height);
    const stop = this.sections[b.section]?.el ?? this.doc.body;
    let found: { el: Styled; inner: Block[] } | null = null;
    for (let n = b.el.parentElement; n && n !== stop && n !== this.doc.body; n = n.parentElement) {
      if (!styled(n) || this.layerEls.has(n) || !this.usable(n)) break;
      const R = n.getBoundingClientRect();
      if (R.width < 1 || R.height < 1 || intersect(R, P) < 0.95 * R.width * R.height) break;
      const inner: Block[] = [];
      let group = false;
      for (const o of this.blocks) {
        if (o === b || folded.has(o) || !o.layers.some((l) => n.contains(l.el))) continue;
        const O = o.el.getBoundingClientRect();
        // another picture, a headline, or a piece reaching outside: a group of divs, not a frame.
        // Outside counts on screen as well as in the DOM: the frame's mask clips at its own box, so a
        // label hanging below it would stay hidden while the picture is drawn and pop in when it lands
        group =
          !o.layers.every((l) => n.contains(l.el)) ||
          MEDIA_TAGS.has(o.el.tagName.toLowerCase()) ||
          (o.el.textContent || '').trim().length > 40 ||
          O.width * O.height > area * 0.1 ||
          intersect(O, R) < 0.95 * Math.max(1, O.width * O.height);
        if (group) break;
        inner.push(o);
      }
      if (group) break;
      found = { el: n, inner };
    }
    return found;
  }

  /**
   * Effect layers the split leaves out (planks and shutters over a photo, a sheen on a card) are
   * drawn with the piece they lie on, so they can't play unmasked over a div nobody has drawn.
   * Layers spread over several pieces belong to the section's backdrop and stay as they are.
   */
  private attachEffects(): void {
    this.sections.forEach((s, si) => {
      for (const el of Array.from(s.el.querySelectorAll('*'))) {
        if (!styled(el) || this.covered(el)) continue;
        if (this.win.getComputedStyle(el).position !== 'absolute' || !this.usable(el)) continue;
        const R = el.getBoundingClientRect();
        const { w, h } = layoutSize(el, R);
        if (w < 6 || h < 6 || this.wraps(el)) continue;
        const host = this.hostOf(R, si);
        if (host && host.state !== 'done') this.addLayer(host, el);
      }
    });
  }

  private makeBlock(el: Styled, R: DOMRect, size: { w: number; h: number }, section: number): Block {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || '').trim().length;
    const media = MEDIA_TAGS.has(tag) || !!el.querySelector(MEDIA);
    const kind = this.kindOf(el, tag, text, media);
    const { w, h } = size;
    const tiny = w < 14 || h < 10 || w * h < 320;
    const offside = R.right < 8 || R.left > this.win.innerWidth - 8;
    const { rows, zigzag } = this.rowsOf(el, kind, h);
    const anchor = this.anchorOf(el);
    const pin = anchor === 'sticky' ? this.pinOf(el) : null;
    return {
      el,
      layers: [{ el, saved: saveMask(el) }],
      section,
      kind,
      label: describe(el),
      anchor,
      inHeader: !!this.siteHeader && this.siteHeader.contains(el),
      top: R.top + this.win.scrollY,
      pinFrom: pin ? pin.from : 0,
      pinTo: pin ? pin.to : 0,
      rows,
      zigzag,
      outlineMs: clamp(170 + (w + h) * 0.2, 240, 560),
      paintMs: clamp(rows * (130 + w * 0.3), 280, 1900),
      auto: tiny || offside,
      state: 'pending',
      hiddenSince: -1,
      fadeSince: -1,
      lastOpacity: -1,
    };
  }

  private kindOf(el: Element, tag: string, text: number, media: boolean): Kind {
    if (/^h[1-3]$/.test(tag)) return 'heading';
    if (MEDIA_TAGS.has(tag) || tag === 'figure' || tag === 'hr') return 'visual';
    if (
      ['button', 'input', 'select', 'textarea', 'form', 'label', 'nav', 'details', 'summary', 'fieldset', 'a'].includes(tag) ||
      el.getAttribute('role') === 'button'
    )
      return 'interactive';
    if (
      ['p', 'blockquote', 'figcaption', 'li', 'dt', 'dd', 'h4', 'h5', 'h6', 'span', 'small', 'strong', 'em', 'address', 'time', 'q', 'cite'].includes(tag)
    )
      return 'copy';
    if (el.querySelector('form,input,button,select,textarea')) return 'interactive';
    if (media && text < 40) return 'visual';
    if (['ul', 'ol', 'dl', 'table', 'header', 'footer', 'article', 'section', 'aside'].includes(tag)) return 'structure';
    return text ? 'copy' : 'visual';
  }

  private rowsOf(el: Element, kind: Kind, h: number): { rows: number; zigzag: boolean } {
    if (kind === 'heading' || kind === 'copy') {
      const s = this.win.getComputedStyle(el);
      let lh = parseFloat(s.lineHeight);
      if (!Number.isFinite(lh)) lh = (parseFloat(s.fontSize) || 16) * 1.3;
      return { rows: clamp(Math.round(h / Math.max(12, lh)), 1, 9), zigzag: false };
    }
    return { rows: clamp(Math.round(h / 120), 1, 5), zigzag: true };
  }

  private anchorOf(el: Element): Anchor {
    for (let n: Element | null = el; n && n !== this.doc.body; n = n.parentElement) {
      const p = this.win.getComputedStyle(n).position;
      if (p === 'fixed') return 'fixed';
      if (p === 'sticky') return 'sticky';
    }
    return 'flow';
  }

  /** for a div in a sticky box: the scroll range over which the box stays in place */
  private pinOf(el: Element): { from: number; to: number } | null {
    const sy = this.win.scrollY;
    for (let n: Element | null = el; n && n !== this.doc.body; n = n.parentElement) {
      const s = this.win.getComputedStyle(n);
      if (s.position !== 'sticky') continue;
      const inset = parseFloat(s.top) || 0;
      const r = n.getBoundingClientRect();
      const from = r.top + sy - inset;
      const host = n.parentElement;
      const to = host ? host.getBoundingClientRect().bottom + sy - r.height - inset : from;
      return { from, to: Math.max(from, to) };
    }
    return null;
  }

  private labelOf(el: Element, i: number, total: number): string {
    const tag = el.tagName.toLowerCase();
    if (tag === 'header' && i === 0) return 'Header';
    if (tag === 'footer' && i === total - 1) return 'Footer';
    const heading = el.querySelector('h1, h2');
    const text = (heading?.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return short(text, 26);
    const id = el.id || el.getAttribute('aria-label') || tag;
    return short(id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), 26);
  }

  private buildRigs(): void {
    const doc = this.overlay.ownerDocument;
    const layer = doc.createElement('div');
    layer.className = 'kit-sim-agents';
    const vw = this.win.innerWidth;
    const vh = this.win.innerHeight;
    // they fly in from different edges
    const entries = [
      [-30, vh * 0.34],
      [vw + 30, vh * 0.16],
      [vw * 0.28, vh + 30],
      [vw + 30, vh * 0.82],
    ];
    this.rigs = this.agents.map((agent, i) => {
      const ink = isLight(agent.color) ? '#0b1021' : '#ffffff';
      const frame = doc.createElement('div');
      frame.className = 'kit-sim-frame';
      frame.dataset.state = 'off';
      frame.style.setProperty('--agent-color', agent.color);
      frame.style.setProperty('--agent-ink', ink);
      const svg = doc.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'kit-sim-frame__svg');
      svg.setAttribute('aria-hidden', 'true');
      const outline = doc.createElementNS(SVG_NS, 'rect');
      outline.setAttribute('x', '0.75');
      outline.setAttribute('y', '0.75');
      outline.setAttribute('rx', '2');
      outline.setAttribute('pathLength', '1');
      svg.appendChild(outline);
      frame.appendChild(svg);
      for (const corner of ['tl', 'tr', 'bl', 'br']) {
        const handle = doc.createElement('i');
        handle.className = `kit-sim-frame__handle kit-sim-frame__handle--${corner}`;
        frame.appendChild(handle);
      }
      const tag = doc.createElement('span');
      tag.className = 'kit-sim-frame__tag';
      frame.appendChild(tag);

      const cursor = doc.createElement('div');
      cursor.className = 'kit-sim-cursor';
      cursor.dataset.phase = 'idle';
      cursor.style.setProperty('--agent-color', agent.color);
      const arrow = doc.createElementNS(SVG_NS, 'svg');
      arrow.setAttribute('width', '15');
      arrow.setAttribute('height', '15');
      arrow.setAttribute('viewBox', '0 0 14 14');
      arrow.setAttribute('aria-hidden', 'true');
      const path = doc.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M1 1 L12.2 6.2 L6.9 7.6 L5.1 13 Z');
      path.setAttribute('fill', agent.color);
      path.setAttribute('stroke', '#ffffff');
      path.setAttribute('stroke-width', '1');
      arrow.appendChild(path);
      const chip = doc.createElement('span');
      chip.className = 'kit-sim-chip';
      chip.textContent = agent.name;
      chip.style.background = agent.color;
      chip.style.color = ink;
      cursor.append(arrow, chip);
      layer.append(frame, cursor);

      const [x, y] = entries[i % entries.length];
      return {
        agent,
        prefs: PREFS[agent.id] ?? [],
        phase: 'idle' as Phase,
        block: null,
        t0: 0,
        dur: 1,
        fromX: x,
        fromY: y,
        x,
        y,
        restX: x,
        restY: y,
        idleAt: 0,
        readyAt: i * 110,
        bend: i % 2 ? 1 : -1,
        seed: i * 2.1 + 0.7,
        drawn: 0,
        headY: 0,
        needY: 0,
        waitMs: 0,
        landAt: -Infinity,
        fading: null,
        fadeUntil: 0,
        cursor,
        frame,
        outline,
        tag,
      };
    });
    this.overlay.appendChild(layer);
    this.layer = layer;
    // until the first frame runs (a build that is ready but paused) the agents wait at their edges
    this.viewW = this.overlay.clientWidth;
    for (const r of this.rigs) this.paintCursor(r);
  }

  /** Fit the whole build into the target time: big pages draw a little faster per div. */
  private paceDurations(): void {
    const drawable = this.blocks.filter((b) => !b.auto);
    this.target = this.targetMs ?? clamp(7_000 + drawable.length * 60, 11_000, 17_000);
    this.totalWork = Math.max(1, drawable.reduce((n, b) => n + b.outlineMs + b.paintMs, 0));
    this.baseScale = 1.15;
    this.repace();
    this.baseScale = this.scale;
  }

  /**
   * Keep the build on its target time: fit the pace of every div not yet started to the time
   * that is left. Agents spend part of the build on flights, looks and camera moves, so only a
   * share of the time left is drawing time. The pace only ever quickens from the opening
   * estimate; a build running early simply finishes early.
   */
  private repace(): void {
    let left = 0;
    for (const b of this.blocks) {
      if (!b.auto && b.state === 'pending') left += b.outlineMs + b.paintMs + OVERHEAD;
    }
    for (const r of this.rigs) {
      const b = r.block;
      if (!b) continue;
      if (r.phase === 'travel') left += b.outlineMs + b.paintMs;
      else if (r.phase === 'outline') left += b.paintMs;
    }
    if (left <= 0) return;
    const perAgent = left / Math.max(1, this.rigs.length);
    const time = Math.max(2500, this.target - this.clock);
    const want = (time * BUSY) / perAgent;
    this.scale = clamp(Math.min(this.baseScale, want), MIN_SCALE, 1.15);
    // below the fastest drawing pace, the rest of the shortfall comes out of the camera and the hand-offs
    this.rush = clamp(want / MIN_SCALE, 0.5, 1);
  }

  /* ------------------------------------------------------------------ */
  /*  Content the site adds while the build runs                         */
  /* ------------------------------------------------------------------ */

  private watch(): void {
    const Observer = (this.win as unknown as typeof globalThis).MutationObserver ?? MutationObserver;
    const observer = new Observer((records) => {
      if (this.finished || this.destroyed) return;
      try {
        for (const record of records) {
          // content re-rendered in place (a live readout, a ticking counter) is drawn as the stable
          // element around it, not as each fleeting copy
          const target = record.target as Element;
          if (record.removedNodes.length && record.addedNodes.length && target !== this.doc.body && this.live(target)) {
            this.adopt(target);
            if (this.covered(target)) continue;
          }
          record.addedNodes.forEach((node) => {
            if (node.nodeType === 1) this.adopt(node as Element);
          });
        }
      } catch {
        /* the document is going away */
      }
    });
    // childList only: the build rewrites inline mask styles every frame, as the sites' tweens do theirs
    observer.observe(this.doc.body, { childList: true, subtree: true });
    this.observer = observer;
  }

  private unwatch(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.arrivals = [];
  }

  /** something the site added after the split: drawn with the div it lies on, or as a div of its own */
  private adopt(el: Element, retry = false): void {
    if (!styled(el) || !el.isConnected) return;
    this.unmaskCopies(el);
    if (this.covered(el) || !this.usable(el) || this.chrome(el)) return;
    if (this.wraps(el)) {
      this.adoptWrapper(el);
      return;
    }
    const R = el.getBoundingClientRect();
    const size = layoutSize(el, R);
    if (size.w < 6 || size.h < 6) {
      // canvases are often sized a moment after they are added
      if (!retry && this.arrivals.length < 40 && !this.arrivals.some((a) => a.el === el)) {
        this.arrivals.push({ el, until: this.clock + 1500 });
      }
      return;
    }
    const section = this.sectionOf(el, R.top + this.win.scrollY);
    // a part of the page that is already drawn keeps whatever the site adds there
    if (section < 0 || section < this.current) return;
    const host = this.hostOf(R, section);
    if (host) {
      if (host.state !== 'done') this.addLayer(host, el);
      return;
    }
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || '').trim().length;
    const media = MEDIA_TAGS.has(tag) || !!el.querySelector(MEDIA);
    // a bare wrapper, or an effect layer of the section's backdrop
    if (!text && !media) return;
    const b = this.makeBlock(el, R, size, section);
    // an effect spread over several screens (falling snow, a grain canvas) switches on with its section
    if (!text && size.h > this.win.innerHeight * 1.2) b.auto = true;
    if (b.auto && section <= this.revealedThrough) return;
    const at = this.blocks.findIndex((x) => x.section > section || (x.section === section && x.top > b.top));
    this.blocks.splice(at < 0 ? this.blocks.length : at, 0, b);
    for (const l of b.layers) this.layerEls.add(l.el);
    this.hide(b);
    if (!b.auto) this.totalWork += b.outlineMs + b.paintMs;
  }

  /**
   * A copy of a piece this build has masked (a cloned card, markup read back and written again)
   * arrives wearing the build's mask: take it off, so the copy shows with whatever it is part of.
   */
  private unmaskCopies(el: Styled): void {
    const strip = (n: Element) => {
      if (!styled(n) || this.layerEls.has(n) || !ownMask(n)) return;
      for (const p of MASK_PROPS) n.style.removeProperty(p);
    };
    strip(el);
    el.querySelectorAll('[style*="mask"]').forEach(strip);
  }

  /**
   * A wrapper the site puts around a div already on the plan (a scan frame around a photo) is
   * drawn with that div, so its own look and effects never play over a div not yet drawn. A
   * wrapper around a whole region (a pin spacer, a re-parented group) is left alone.
   */
  private adoptWrapper(el: Styled): void {
    let host: Block | null = null;
    for (const b of this.blocks) {
      if (!b.layers.some((l) => el.contains(l.el))) continue;
      if (host) return;
      host = b;
    }
    if (!host || host.state === 'done') return;
    const R = el.getBoundingClientRect();
    if (R.width < 1 || R.height < 1) return;
    if (intersect(R, host.el.getBoundingClientRect()) < 0.8 * R.width * R.height) return;
    this.addLayer(host, el);
  }

  /** on-screen chrome the site floats over the page (a scope, a dial, a cursor): fixed, and not a scroll pin */
  private chrome(el: Element): boolean {
    for (let n: Element | null = el; n && n !== this.doc.body; n = n.parentElement) {
      if (this.win.getComputedStyle(n).position !== 'fixed') continue;
      if (!n.parentElement?.classList.contains('pin-spacer')) return true;
    }
    return false;
  }

  /** small enough to be one piece of the page (a label, a readout), not a whole region of it */
  private live(el: Element): boolean {
    if (el.nodeType !== 1) return false;
    const R = el.getBoundingClientRect();
    const vh = this.win.innerHeight;
    if (R.width < 1 || R.height < 1) return false;
    return R.height <= vh * 0.6 && R.width * R.height <= this.win.innerWidth * vh * 0.35;
  }

  private settleArrivals(): void {
    const arrivals = this.arrivals;
    this.arrivals = [];
    for (const a of arrivals) {
      if (!a.el.isConnected || this.clock > a.until) continue;
      const { w, h } = layoutSize(a.el, a.el.getBoundingClientRect());
      if (w >= 6 && h >= 6) this.adopt(a.el, true);
      else this.arrivals.push(a);
    }
  }

  /** already drawn as part of a div, or inside one */
  private covered(el: Element): boolean {
    for (let n: Element | null = el; n; n = n.parentElement) if (this.layerEls.has(n)) return true;
    return false;
  }

  /** a wrapper around pieces already on the plan (a pin spacer, a re-parented card) */
  private wraps(el: Element): boolean {
    for (const l of this.layerEls) if (l !== el && el.contains(l)) return true;
    return false;
  }

  /** the div a piece mostly lies on (at least 60% of the piece), if any */
  private hostOf(R: DOMRect, section: number): Block | null {
    const area = R.width * R.height;
    if (area < 1) return null;
    let host: Block | null = null;
    let best = 0.6;
    for (const b of this.blocks) {
      if (b.section !== section) continue;
      const cover = intersect(b.el.getBoundingClientRect(), R) / area;
      if (cover >= best) {
        best = cover;
        host = b;
      }
    }
    return host;
  }

  private addLayer(b: Block, el: Styled): void {
    b.layers.push({ el, saved: saveMask(el) });
    this.layerEls.add(el);
    if (b.state === 'pending') writeMask(el, HIDDEN, '100% 100%', '0 0');
    else if (b.state === 'active') copyMask(b.el, el);
  }

  private sectionOf(el: Element, docTop: number): number {
    const i = this.sections.findIndex((s) => s.el.contains(el));
    if (i >= 0) return i;
    const sy = this.win.scrollY;
    let found = -1;
    this.sections.forEach((s, j) => {
      if (s.el.getBoundingClientRect().top + sy <= docTop + 1) found = j;
    });
    return found;
  }

  /* ------------------------------------------------------------------ */
  /*  Loop                                                               */
  /* ------------------------------------------------------------------ */

  private running(): boolean {
    return this.prepared && !this.destroyed && !this.finished && this.playing && this.visible;
  }

  private kick(): void {
    if (this.raf || !this.running()) return;
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (ts: number): void => {
    this.raf = 0;
    if (!this.running()) return;
    const dt = this.lastTs ? clamp(ts - this.lastTs, 0, 64) : 16;
    this.lastTs = ts;
    this.clock += dt;
    try {
      this.step(dt);
    } catch {
      // the iframe navigated or was torn down mid-frame
      this.stop();
      return;
    }
    if (this.running()) this.raf = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    const vh = this.win.innerHeight;
    // read before this frame writes anything to the overlay
    this.viewW = this.overlay.clientWidth;
    this.measureInset(vh);
    if (this.arrivals.length) this.settleArrivals();
    if (this.clock >= this.refreshAt) {
      this.refresh();
      this.repace();
      this.refreshAt = this.clock + 600;
    }

    this.openSection();
    const view = this.survey();
    // the survey may have set aside divs the site keeps hidden or took away
    this.openSection();

    // the camera moves first, so every frame and pen drawn below lines up with where the page now is
    this.moveCamera(view);
    for (const r of this.rigs) this.advance(r, dt);
    this.assign(view);
    this.unstick(dt, view);

    const progress = this.progress();
    if (this.bar) this.bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    this.emit(false);

    if (this.blocks.every((b) => b.state === 'done') && this.rigs.every((r) => r.phase === 'idle')) {
      this.complete();
    }
  }

  /** the first section with work left; anything too small to draw shows as it opens */
  private openSection(): void {
    this.current = this.firstOpenSection();
    if (this.current <= this.revealedThrough) return;
    for (const b of this.blocks) {
      if (b.auto && b.state === 'pending' && b.section <= this.current) {
        this.reveal(b);
        b.state = 'done';
      }
    }
    this.revealedThrough = this.current;
  }

  private measureInset(vh: number): void {
    const h = this.header;
    if (!h) {
      this.topInset = 0;
      return;
    }
    const r = h.getBoundingClientRect();
    this.topInset = r.top <= 1 && r.bottom > 0 ? clamp(r.bottom, 0, vh * 0.3) : 0;
  }

  /** layout settles as the page scrolls; keep natural positions current, undrawn divs hidden, and let go of divs the site removed */
  private refresh(): void {
    const sy = this.win.scrollY;
    for (const b of this.blocks) {
      if (b.state === 'done') continue;
      if (this.gone(b)) {
        this.drop(b);
        continue;
      }
      if (b.state === 'pending') {
        for (const l of b.layers) {
          if (!l.el.style.getPropertyValue('mask-image')) writeMask(l.el, HIDDEN, '100% 100%', '0 0');
        }
      }
      if (b.anchor !== 'flow') continue;
      const r = b.el.getBoundingClientRect();
      if (r.height > 0) b.top = r.top + sy;
    }
  }

  private firstOpenSection(): number {
    for (const b of this.blocks) if (!b.auto && b.state !== 'done') return b.section;
    return this.sections.length;
  }

  /**
   * What the frame holds right now: the visible, unclaimed divs of the section being drawn (or
   * of the next one, once nothing here is left unclaimed). A div that is in frame but not showing
   * is given a moment if it is fading in or has only just gone out of sight. A div the site's own
   * stylesheet keeps out of sight (a fallback that never shows) is set aside; a scene of a pinned
   * stage the camera hasn't walked through yet, and a tween waiting on its scroll trigger, stay.
   */
  private survey(): Survey {
    const view: Survey = { cands: [], soon: false, hidden: false };
    let section = this.current;
    let pool = this.open(section);
    if (!pool.length) {
      const next = this.blocks.find((b) => b.state === 'pending' && !b.auto && b.section > section);
      if (!next) return view;
      section = next.section;
      pool = this.open(section);
    }
    const vw = this.win.innerWidth;
    const vh = this.win.innerHeight;
    const sy = this.win.scrollY;
    // while the page turns, the frame that counts is the one the camera lands on: the agents set off
    // for the divs coming up with it, rather than waiting for the glide to finish
    const ahead = this.camSettled ? 0 : this.camTo - this.camY;
    // with a little to spare, in case the turn comes up a touch short (a div above it still settling)
    const spare = ahead > 0 ? Math.min(24, ahead) : 0;
    for (const b of pool) {
      if (this.gone(b)) {
        this.drop(b);
        continue;
      }
      const R = b.el.getBoundingClientRect();
      const landed = ahead && b.anchor === 'flow' ? new DOMRect(R.x, R.y - ahead + spare, R.width, R.height) : R;
      if (!this.reachable(b, landed, vw, vh)) {
        b.hiddenSince = -1;
        b.fadeSince = -1;
        continue;
      }
      const op = this.opacity(b);
      if (op >= VISIBLE) {
        b.hiddenSince = -1;
        b.fadeSince = -1;
        b.lastOpacity = op;
        view.cands.push({ b, R });
        continue;
      }
      view.hidden = true;
      const fading = (b.lastOpacity >= 0 && Math.abs(op - b.lastOpacity) > 0.002) || this.fading(b);
      b.lastOpacity = op;
      // each grace runs once per stretch out of sight: a div flickering between fading and still
      // doesn't start either one over (it would hold the page forever)
      if (fading) {
        if (b.fadeSince < 0) b.fadeSince = this.clock;
        if (this.clock - b.fadeSince < 1500) view.soon = true;
        continue;
      }
      if (b.hiddenSince < 0) b.hiddenSince = this.clock;
      const age = this.clock - b.hiddenSince;
      if (age < 350) {
        view.soon = true;
        continue;
      }
      const staged = b.anchor === 'sticky' && !b.inHeader && sy < b.pinTo - 2;
      if (age > 700 && !staged && !this.heldInline(b)) this.skip(b);
    }
    return view;
  }

  private open(section: number): Block[] {
    return this.blocks.filter((b) => b.state === 'pending' && !b.auto && b.section === section);
  }

  /** how visible an element is right now: its opacity times its ancestors', 0 when hidden */
  private opacityOf(el: Element): number {
    const win = this.win;
    if (win.getComputedStyle(el).visibility !== 'visible') return 0;
    let o = 1;
    for (let n: Element | null = el; n && n !== this.doc.documentElement; n = n.parentElement) {
      o *= parseFloat(win.getComputedStyle(n).opacity);
      if (!(o > 0.004)) return 0;
    }
    return o;
  }

  private opacity(b: Block): number {
    let o = 0;
    for (const l of b.layers) if (l.el.isConnected) o = Math.max(o, this.opacityOf(l.el));
    return o;
  }

  /** an opacity or visibility animation is running on the div or around it */
  private fading(b: Block): boolean {
    for (const l of b.layers) {
      for (let n: Element | null = l.el; n && n !== this.doc.documentElement; n = n.parentElement) {
        if (typeof n.getAnimations !== 'function') break;
        if (n.getAnimations().some((a) => a.playState === 'running' && fadesIn(a))) return true;
      }
    }
    return false;
  }

  /** a script holds the div at zero opacity: a tween waiting on its scroll trigger */
  private heldInline(b: Block): boolean {
    for (const l of b.layers) {
      for (let n: Element | null = l.el; n && n !== this.doc.body; n = n.parentElement) {
        const o = styled(n) ? n.style.opacity : '';
        if (o !== '' && parseFloat(o) < VISIBLE) return true;
      }
    }
    return false;
  }

  /** the site removed the div, or took it out of the layout */
  private gone(b: Block): boolean {
    return b.layers.every((l) => !l.el.isConnected || l.el.getClientRects().length === 0);
  }

  private drop(b: Block): void {
    const active = b.state === 'active';
    b.state = 'done';
    try {
      this.reveal(b);
    } catch {
      /* left with its document */
    }
    if (active) for (const r of this.rigs) if (r.block === b) this.release(r);
  }

  /** the site keeps it out of sight: there is nothing to draw */
  private skip(b: Block): void {
    this.reveal(b);
    b.state = 'done';
    this.skipped += 1;
  }

  private begin(r: Rig, phase: Phase, ms: number): void {
    r.phase = phase;
    r.t0 = this.clock;
    r.dur = Math.max(MIN_PHASE, ms * this.scale);
    r.needY = 0;
    r.waitMs = 0;
  }

  private advance(r: Rig, dt: number): void {
    if (r.fading) {
      if (this.clock < r.fadeUntil && r.phase !== 'outline' && r.phase !== 'paint') {
        this.placeFrame(r, r.fading.getBoundingClientRect());
      } else {
        r.fading = null;
      }
    }
    // the site took the div away mid-drawing: let go of it
    if (r.block && r.block.state === 'done') this.release(r);
    const b = r.block;
    if (r.phase === 'idle' || !b) {
      this.rest(r, dt);
      return;
    }
    const vh = this.win.innerHeight;
    const R = b.el.getBoundingClientRect();
    if (r.phase === 'paint') {
      // a row below the frame waits for the camera to bring it up (the camera follows needY); if
      // the camera can't come within a moment, the pen carries on along the frame's edge
      r.needY = 0;
      if (this.clock - r.t0 < r.dur && r.waitMs < 1200) {
        const row = Math.min(b.rows - 1, Math.floor(((this.clock - r.t0) / r.dur) * b.rows));
        const y = ((row + 0.5) / b.rows) * R.height;
        if (R.top + y > vh - 12) {
          r.t0 = Math.min(this.clock, r.t0 + dt);
          r.waitMs += dt;
          r.needY = y;
        }
      }
    }
    if (this.hurry && !r.needY) {
      // the last agents in a frame quicken while the others look on, but never so much that a phase
      // is over in a frame or two; a flight only while its landing stays clear of the others'
      const quick = dt * Math.min(HURRY - 1, Math.max(0, r.dur / MIN_HURRIED - 1));
      if (quick > 0 && (r.phase !== 'travel' || this.landsClear(r, r.t0 + r.dur - quick))) r.t0 -= quick;
    }
    const t = clamp((this.clock - r.t0) / r.dur, 0, 1);

    if (r.phase === 'travel' && b.anchor === 'flow') {
      // judged where the camera is heading: if the page comes to rest short of where this div was
      // going to be, or goes back up for a div above, it waits for its turn and the agent looks for another
      const ahead = this.camSettled ? 0 : this.camTo - this.camY;
      const landed = ahead ? new DOMRect(R.x, R.y - ahead, R.width, R.height) : R;
      if (!this.reachable(b, landed, this.win.innerWidth, vh)) {
        b.state = 'pending';
        this.release(r);
        return;
      }
    }
    if (r.phase === 'travel') {
      const tx = R.left + Math.min(3, R.width * 0.1);
      const ty = R.top + Math.min(3, R.height * 0.1);
      const e = easeInOut(t);
      const dx = tx - r.fromX;
      const dy = ty - r.fromY;
      const len = Math.hypot(dx, dy) || 1;
      const arc = r.bend * Math.min(70, len * 0.16) * Math.sin(Math.PI * e);
      r.x = r.fromX + dx * e - (dy / len) * arc;
      r.y = Math.min(r.fromY + dy * e + (dx / len) * arc, vh - 6);
      this.paintCursor(r);
      if (t >= 1) {
        r.landAt = this.clock;
        r.fading = null;
        this.placeFrame(r, R);
        this.showFrame(r, b);
        this.begin(r, 'outline', b.outlineMs);
        r.cursor.dataset.phase = 'draw';
      }
      return;
    }

    this.placeFrame(r, R);

    if (r.phase === 'outline') {
      // trace the div clockwise from its top-left corner, the pen riding the line
      const w = R.width;
      const h = R.height;
      const d = t * 2 * (w + h);
      if (d <= w) {
        r.x = R.left + d;
        r.y = R.top;
      } else if (d <= w + h) {
        r.x = R.right;
        r.y = R.top + (d - w);
      } else if (d <= 2 * w + h) {
        r.x = R.right - (d - w - h);
        r.y = R.bottom;
      } else {
        r.x = R.left;
        r.y = R.bottom - (d - 2 * w - h);
      }
      // where the div runs past the bottom of the frame, the pen keeps to the frame's edge
      r.y = Math.min(r.y, vh - 6);
      r.outline.style.strokeDashoffset = String(1 - t);
      this.paintCursor(r);
      if (t >= 1) {
        r.frame.dataset.state = 'paint';
        r.outline.style.strokeDashoffset = '0';
        this.begin(r, 'paint', b.paintMs);
      }
      return;
    }

    // paint: row by row, text written left to right, imagery swept back and forth
    const rows = b.rows;
    const rt = t * rows;
    const row = Math.min(rows - 1, Math.floor(rt));
    const local = t >= 1 ? 1 : rt - row;
    const ltr = !b.zigzag || row % 2 === 0;
    const lead = row === 0 ? 0 : b.zigzag ? 0.1 : 0.16;
    const rowY = (i: number) => R.top + ((i + 0.5) / rows) * R.height;
    let sweep: number;
    if (local < lead) {
      sweep = 0;
      const k = easeInOut(local / lead);
      const prevEnd = b.zigzag ? ((row - 1) % 2 === 0 ? R.right : R.left) : R.right;
      const start = ltr ? R.left : R.right;
      r.x = prevEnd + (start - prevEnd) * k;
      r.y = rowY(row - 1) + (rowY(row) - rowY(row - 1)) * k;
    } else {
      sweep = (local - lead) / (1 - lead);
      r.x = ltr ? R.left + sweep * R.width : R.right - sweep * R.width;
      r.y = rowY(row) + Math.sin(this.clock / 70 + r.seed) * Math.min(2.5, R.height / rows / 5);
    }
    r.y = Math.min(r.y, vh - 6);
    r.headY = ((row + 0.5) / rows) * R.height;
    this.paintMask(b, row, sweep, ltr);
    this.paintCursor(r);
    if (t >= 1) this.land(r, b);
  }

  /** an idle agent waits beside the div it just finished, inside the frame and clear of the others */
  private rest(r: Rig, dt: number): void {
    const vh = this.win.innerHeight;
    let tx = clamp(r.restX, 18, Math.max(18, this.viewW - 48));
    let ty = clamp(r.restY, this.topInset + 18, Math.max(this.topInset + 18, vh - 30));
    for (const o of this.rigs) {
      if (o === r) continue;
      const dx = tx - o.x;
      const dy = ty - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.5 && d < 46) {
        tx += (dx / d) * (46 - d);
        ty += (dy / d) * (46 - d);
      }
    }
    const k = 1 - Math.exp(-dt / 380);
    r.restX += (tx - r.restX) * k;
    r.restY += (ty - r.restY) * k;
    r.x = r.restX + Math.sin(this.clock / 640 + r.seed) * 3;
    r.y = r.restY + Math.cos(this.clock / 820 + r.seed) * 2.5;
    this.paintCursor(r);
  }

  private paintMask(b: Block, row: number, sweep: number, ltr: boolean): void {
    const rows = b.rows;
    const done = (row / rows) * 100;
    const edge = Math.round(18 * (1 - sweep));
    const image = `linear-gradient(#000, #000), linear-gradient(${ltr ? 90 : 270}deg, #000 calc(100% - ${edge}px), transparent)`;
    const size = `100% ${row > 0 ? `calc(${done.toFixed(3)}% + 0.5px)` : '0px'}, ${(sweep * 100).toFixed(2)}% ${(100 / rows).toFixed(3)}%`;
    const posY = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    const position = `0 0, ${ltr ? 0 : 100}% ${posY.toFixed(3)}%`;
    for (const l of b.layers) writeMask(l.el, image, size, position);
  }

  private hide(b: Block): void {
    for (const l of b.layers) writeMask(l.el, HIDDEN, '100% 100%', '0 0');
  }

  /** hand the page its own styles back */
  private reveal(b: Block): void {
    for (const l of b.layers) restoreMask(l.el, l.saved);
  }

  /** the div is drawn: hand the page its real styles back and look for the next one */
  private land(r: Rig, b: Block): void {
    this.reveal(b);
    b.state = 'done';
    r.drawn += 1;
    r.block = null;
    r.phase = 'idle';
    r.idleAt = this.clock;
    // a short look at the work before reaching for the next div; everyone's look is a different length
    r.readyAt = this.clock + (90 + 190 * hash(r.seed * 7.31 + r.drawn)) * this.scale;
    r.restX = r.x;
    r.restY = r.y;
    r.frame.dataset.state = 'done';
    // the frame's fade (0.32 s in kit.css) follows the finished div while the camera moves on
    r.fading = b.el;
    r.fadeUntil = this.clock + 420;
    r.cursor.dataset.phase = 'idle';
  }

  /** the div went away under the agent: it lets go and looks for another */
  private release(r: Rig): void {
    r.block = null;
    r.phase = 'idle';
    r.idleAt = this.clock;
    r.readyAt = this.clock + 120 * this.scale;
    r.restX = r.x;
    r.restY = r.y;
    r.fading = null;
    if (r.frame.dataset.state !== 'off') r.frame.dataset.state = 'done';
    r.cursor.dataset.phase = 'idle';
  }

  /**
   * Each free agent claims its own div in the frame: close to where it is, ideally its
   * specialty, and away from the divs the others are on, so the four spread over the frame
   * rather than queueing for the next div down the page.
   */
  private assign(view: Survey): void {
    // agents look up from their last div at their own moment, and never two in the same breath
    if (this.clock < this.nextClaimAt || !view.cands.length) return;
    // the camera changed where it lands this very frame: that changes the frame the survey judged
    if (this.camAimAt === this.clock) return;
    const ready = this.rigs.filter((r) => r.phase === 'idle' && this.clock >= r.readyAt);
    if (!ready.length) return;
    // whose moment it is: any one of the free agents, not whoever has the cheapest pick (that let the
    // same agent lead off every page turn, the others in the same order behind it); the one whose
    // moment it is then picks its own div
    let drawn = 0;
    for (const r of this.rigs) drawn += r.drawn;
    const idle = [ready[Math.floor(hash(this.clock * 0.0137 + drawn * 1.618) * ready.length) % ready.length]];
    const taken: DOMRect[] = [];
    // how far down each of those divs its paint has gone: the rows above that line are drawn
    const clear: number[] = [];
    for (const r of this.rigs) {
      if (!r.block) continue;
      const R = r.block.el.getBoundingClientRect();
      taken.push(R);
      clear.push(r.phase === 'paint' ? R.top + r.headY - (R.height / r.block.rows) * 0.5 : -Infinity);
    }
    let pick: { r: Rig; c: Candidate } | null = null;
    let best = Infinity;
    for (const c of view.cands) {
      if (c.b.state !== 'pending') continue;
      // never two agents on one patch of the page: a piece lying over another agent's div (a caption
      // on a picture, a badge on a card) waits until that div's paint has gone past it
      const own = c.R.width * c.R.height;
      if (taken.some((o, i) => c.R.bottom > clear[i] + 0.5 && intersect(c.R, o) > 0.5 * Math.min(own, o.width * o.height))) {
        continue;
      }
      // the patch around another agent's div is that agent's to work
      let crowd = 0;
      for (const o of taken) crowd += Math.max(0, 260 - gap(c.R, o)) * 0.8;
      for (const r of idle) {
        const reach = Math.hypot(
          Math.max(c.R.left - r.x, 0, r.x - c.R.right),
          Math.max(c.R.top - r.y, 0, r.y - c.R.bottom)
        );
        const cost = reach * 0.55 + crowd + (r.prefs.includes(c.b.kind) ? 0 : 200);
        if (cost < best) {
          best = cost;
          pick = { r, c };
        }
      }
    }
    if (!pick) return;
    const { r, c } = pick;
    c.b.state = 'active';
    r.block = c.b;
    r.fromX = r.x;
    r.fromY = r.y;
    r.headY = 0;
    const dist = Math.hypot(c.R.left - r.x, c.R.top - r.y);
    // a div still coming up with the page is reached as it comes into view: each agent gets to its own
    // div at its own moment, not all of them together as the camera lands
    const shown = this.shownIn(c.b, c.R);
    const wait = shown > 0 ? shown + 70 * hash(r.seed * 3.7 + r.drawn * 1.3) : 0;
    // every flight its own pace
    const pace = 0.8 + 0.4 * hash(r.seed * 5.1 + r.drawn * 0.7);
    this.begin(r, 'travel', this.offBeat(r, Math.max(clamp(150 + dist * 0.36, 180, 540) * pace, wait / this.scale), shown > 0));
    r.cursor.dataset.phase = 'travel';
    r.frame.dataset.state = r.frame.dataset.state === 'off' ? 'off' : 'done';
    this.lastClaimAt = this.clock;
    // the next agent looks up a moment later, never on a beat
    this.nextClaimAt = this.clock + 45 + 60 * hash(this.lastClaimAt * 0.013 + r.drawn);
  }

  /**
   * A flight timed to land clear of the others: an agent never gets to its div on the same beat as
   * another (one landing just now, or one due), even when the page turn brings their divs up together.
   */
  private offBeat(r: Rig, ms: number, turning: boolean): number {
    const beats: number[] = [];
    for (const o of this.rigs) {
      if (o === r || !o.block) continue;
      if (o.phase === 'travel') beats.push(o.t0 + o.dur);
      else if (o.phase === 'outline') beats.push(o.t0);
    }
    // a page turn brings several divs up at once, so those landings are kept further apart
    const gap = (turning ? 85 : 45) + (turning ? 50 : 30) * hash(r.seed * 2.3 + r.drawn * 0.9);
    let at = this.clock + Math.max(60, ms * this.scale);
    for (let k = 0; k < beats.length; k++) {
      const hit = beats.find((t) => Math.abs(at - t) < gap);
      if (hit === undefined) break;
      at = hit + gap;
    }
    return (at - this.clock) / this.scale;
  }

  /** a landing at this moment would be clear of every other agent's, made or due */
  private landsClear(r: Rig, at: number): boolean {
    return this.rigs.every((o) => {
      if (o === r) return true;
      const t = o.phase === 'travel' && o.block ? o.t0 + o.dur : o.landAt;
      return Math.abs(at - t) >= 45;
    });
  }

  /** how long until a div coming up with the page turn shows enough to be drawn (0 if it already does) */
  private shownIn(b: Block, R: DOMRect): number {
    if (this.camSettled || b.anchor !== 'flow') return 0;
    const vw = this.win.innerWidth;
    const vh = this.win.innerHeight;
    if (this.reachable(b, R, vw, vh)) return 0;
    const end = this.camT0 + this.camDur;
    for (let t = this.clock + 16; t < end; t += 16) {
      const y = this.camFrom + (this.camTo - this.camFrom) * easeInOut(clamp((t - this.camT0) / this.camDur, 0, 1));
      if (this.reachable(b, new DOMRect(R.x, R.y - (y - this.camY), R.width, R.height), vw, vh)) return t - this.clock;
    }
    return Math.max(0, end - this.clock);
  }

  /** a div can be claimed once most of it is in frame, below the site's own header */
  private reachable(b: Block, R: DOMRect, vw: number, vh: number): boolean {
    if (R.width < 2 || R.height < 2) return false;
    if (R.right < 8 || R.left > vw - 8) return false;
    // the header's own pieces, and anything tucked under it at the very top of the page (a hero
    // eyebrow beneath a see-through header), can't be scrolled any clearer: the header is no obstacle
    const top = b.anchor === 'fixed' || b.inHeader || b.top < this.topInset ? 0 : this.topInset;
    const seen = Math.min(R.bottom, vh) - Math.max(R.top, top);
    // a div that fits in half the frame waits until it is all but whole in it, so the camera turns
    // whole pages instead of nudging down after rows cut off at the bottom edge; a bigger div is
    // taken once most of it shows, and the camera leads its paint down the page
    if (R.height <= (vh - top) * 0.5) {
      // never more of it than any scroll position can show: the camera can't go above the top of the
      // page or past its end (a ribbon above the page, a wordmark bleeding out of the footer's clip)
      const most =
        b.anchor === 'fixed'
          ? seen
          : Math.min(b.top + R.height, this.doc.documentElement.scrollHeight) - Math.max(b.top, 0);
      return seen >= Math.min(R.height * 0.92, Math.max(R.height * 0.6, most - 1));
    }
    return seen >= Math.min(R.height * 0.6, (vh - top) * 0.5);
  }

  /** if nobody can reach the next div (clipped, off-canvas), reveal it rather than stall the build */
  private unstick(dt: number, view: Survey): void {
    const busy = this.rigs.some((r) => r.phase !== 'idle');
    const pending = this.blocks.find((b) => b.state === 'pending' && !b.auto);
    if (busy || !pending || !this.camSettled || view.soon || view.cands.length) {
      this.stallMs = 0;
      return;
    }
    this.stallMs += dt;
    if (this.stallMs < 900) return;
    this.stallMs = 0;
    this.reveal(pending);
    pending.state = 'done';
    this.forced += 1;
  }

  /**
   * The camera frames a screenful and holds it while the agents work. Once nothing in the frame
   * is left to hand out, it moves on a real step, as far as the work allows: never past a div
   * nobody has drawn, never while a pinned div is being drawn. A paint head running off the
   * bottom of the frame pulls it along; a pinned stage is walked a step at a time, so its scroll
   * scenes can play and be drawn.
   */
  private moveCamera(view: Survey): void {
    const vh = this.win.innerHeight;
    const sy = this.win.scrollY;
    const inset = this.topInset;
    const room = Math.max(120, vh - inset);
    const max = Math.max(0, this.doc.documentElement.scrollHeight - vh);
    let bound = Infinity;
    let hold = false;
    let scene = false;
    let follow = -Infinity;
    let waiting = false;
    // how high the camera may go: a div being drawn stays in frame (its bottom, or a frame of it)
    let floor = -Infinity;
    // the div that sets the bound: whether the camera can still come for a pen waiting below the frame
    let holder: Block | null = null;
    const limit = (v: number, b: Block) => {
      if (v < bound) holder = b;
      bound = Math.min(bound, v);
    };
    for (const b of this.blocks) {
      if (b.state === 'done' || b.auto || b.anchor === 'fixed') continue;
      if (b.anchor === 'sticky') {
        if (b.state === 'active') {
          hold = true;
        } else {
          // waiting in a pinned box: the camera may travel as far as the box stays put
          limit(b.pinTo, b);
          if (!b.inHeader && sy >= b.pinFrom - 2 && sy < b.pinTo - 2) scene = true;
        }
        continue;
      }
      if (b.state === 'pending') {
        limit(b.top - inset - PAD, b);
        continue;
      }
      const R = b.el.getBoundingClientRect();
      const top = sy + R.top;
      const rig = this.rigs.find((r) => r.block === b);
      const head = rig && rig.phase === 'paint' ? Math.max(rig.headY, rig.needY) : -1;
      // a div taller than the frame may scroll its painted rows away as the head goes down it (and
      // never pulls the camera back up while its top is still in sight)
      if (head >= 0 && R.height > room * 0.8) limit(Math.max(top - inset - 12, top + head - vh * 0.4), b);
      // so may the painted rows of any div, up to half of it: the row being painted stays in sight,
      // and the page can turn while an agent finishes the lower part of its div
      else if (head > 0) limit(top + Math.min(head - (R.height / b.rows) * 0.5, R.height * 0.5) - inset - 12, b);
      else limit(top - inset - 12, b);
      // the head (or the row it waits on) running off the bottom of the frame pulls the camera along,
      // in a long stride that lifts it to the upper half of the frame rather than a nudge at a time
      if (head >= 0 && R.top + head > vh - (R.height > room * 0.5 ? 70 : 24)) {
        follow = Math.max(follow, top + head - vh * 0.45);
        if (rig && rig.needY > 0) waiting = true;
      }
      if (rig && rig.phase !== 'travel') {
        // going back up keeps the div in frame, and for a tall one the row being painted
        const rowH = R.height / b.rows;
        const keep = head >= 0 ? Math.min(R.height, Math.max(room - PAD, head + rowH * 0.5)) : Math.min(R.height, room - PAD);
        floor = Math.max(floor, top + keep - vh + 8);
      }
      // a div claimed as the page turned, whose turn then came up short, is brought into the frame
      if (rig && rig.phase !== 'paint' && R.top + R.height * 0.5 > vh) {
        follow = Math.max(follow, top + Math.min(R.height, room - PAD) - vh + PAD);
        waiting = true;
      }
    }
    bound = clamp(Number.isFinite(bound) ? bound : this.camTo, 0, max);

    let to = this.camTo;
    let following = false;
    if (to > bound + 0.5) {
      // never past a div nobody has drawn. One that creeps up a few pixels (a reveal tween settling)
      // is still clear of the frame's top within the padding: a resting camera stays put, and a
      // gliding one lands a little short instead of starting its glide over
      // A div the site moved up out of sight (a card sliding into place) is gone back for once the
      // divs being drawn lower down are done: going back sooner would drop them out of the frame.
      const back = Number.isFinite(floor) ? Math.max(bound, Math.min(floor, this.camY)) : bound;
      if (this.camSettled) {
        if (to > bound + PAD * 0.6) to = back;
      } else if (this.camY <= bound + 0.5) {
        to = bound;
      } else {
        to = back;
      }
    } else if (this.camSettled) {
      const want = Math.min(bound, follow);
      if (want - this.camY >= 48 || (waiting && want - this.camY >= 24)) {
        to = want;
        following = true;
      } else if (
        !hold &&
        !view.cands.length &&
        !view.soon &&
        this.clock - this.settledAt >= (view.hidden ? LOOK * this.rush : 0)
      ) {
        // everything in frame is handed out: once the top of the frame is drawn, turn the page, as
        // far as the work allows. A real step brings up a fresh screenful for the agents to spread
        // over, instead of one div at a time sliding in under them.
        const step = bound - this.camY;
        const busy = this.rigs.some((r) => r.block !== null);
        // the others have been waiting on the last agents in the frame for a moment: a shorter turn
        // (still a good part of a screen) lets them start on what comes next while those finish
        const turn = this.hurry && this.clock - this.hurrySince > 250 ? room * 0.4 : room * 0.6;
        if (step > 0.5 && (step >= turn || !busy)) to = scene ? Math.min(bound, this.camY + room * 0.6) : bound;
      }
    }
    if (Math.abs(to - this.camTo) > 0.5) {
      // a glide whose landing shifts (a div above it settling as the page turns) carries on to the new
      // landing from where it is: no jump back, no stop and start
      const ahead = this.camTo - this.camY;
      const left = to - this.camY;
      // (a landing pushed much further than what is left starts a glide of its own: squeezing it into
      // the end of this one would make the camera hop)
      if (!this.camSettled && Math.abs(left) >= 0.5 && Math.sign(left) === Math.sign(ahead) && Math.abs(left) <= Math.abs(ahead) * 2 + 1) {
        this.reaim(to);
      } else {
        this.glideTo(to, following);
      }
    }
    // nothing left to hand out and the camera staying put: the frame is waiting on the agents still
    // drawing, so they quicken while the others look on
    const hurry =
      this.camSettled &&
      !view.cands.length &&
      !view.soon &&
      this.rigs.some((r) => r.block === null) &&
      this.rigs.some((r) => r.block !== null);
    if (hurry && !this.hurry) this.hurrySince = this.clock;
    this.hurry = hurry;
    // a pen waiting below the frame for a camera that isn't coming (held by a div above that nobody
    // can reach to draw, or at the end of the page) finishes along the edge after a moment. A div
    // being drawn lets the camera on as its paint goes down, and one the site keeps hidden is set
    // aside within moments: for those the pen waits for the camera.
    const held = holder as Block | null;
    if (
      waiting &&
      this.camSettled &&
      (!held ||
        this.camY >= max - 1 ||
        (held.state === 'pending' && !this.reachable(held, held.el.getBoundingClientRect(), this.win.innerWidth, vh)))
    ) {
      for (const r of this.rigs) if (r.needY > 0) r.waitMs = Math.max(r.waitMs, 1000);
    }

    if (!this.camSettled) {
      const t = clamp((this.clock - this.camT0) / this.camDur, 0, 1);
      this.camY = this.camFrom + (this.camTo - this.camFrom) * easeInOut(t);
      if (t >= 1) {
        this.camY = this.camTo;
        this.camSettled = true;
        this.camFollow = false;
        this.settledAt = this.clock;
      }
    }
    if (Math.abs(this.camY - this.win.scrollY) > 0.5) {
      this.win.scrollTo({ top: this.camY, behavior: 'instant' });
    }
  }

  /**
   * Point the glide under way at a new landing without a jump: the same curve and timing, rebased
   * so it runs through where the camera is now.
   */
  private reaim(y: number): void {
    const span = this.camTo - this.camFrom;
    const e = clamp((this.camY - this.camFrom) / span, 0, 1);
    if (e >= 0.999) {
      this.glideTo(y, this.camFollow);
      return;
    }
    this.camFrom = (this.camY - y * e) / (1 - e);
    this.camTo = y;
    this.camAimAt = this.clock;
  }

  private glideTo(y: number, follow: boolean): void {
    this.camAimAt = this.clock;
    const dist = Math.abs(y - this.camY);
    this.camFrom = this.camY;
    this.camTo = y;
    this.camT0 = this.clock;
    // a build running late turns its pages a little quicker, never so quick that a turn reads as a cut
    const quick = Math.max(0.7, this.rush);
    this.camDur = (follow ? clamp(180 + dist * 0.5, 200, 420) : clamp(200 + dist * 0.16, 240, 400)) * quick;
    this.camFollow = follow;
    this.camSettled = dist < 0.5;
    if (this.camSettled) {
      this.camY = y;
      this.camFollow = false;
      this.settledAt = this.clock;
    }
  }

  private progress(): number {
    let work = 0;
    for (const b of this.blocks) {
      if (b.auto) continue;
      if (b.state === 'done') work += b.outlineMs + b.paintMs;
    }
    for (const r of this.rigs) {
      const b = r.block;
      if (!b) continue;
      const t = clamp((this.clock - r.t0) / r.dur, 0, 1);
      if (r.phase === 'outline') work += t * b.outlineMs;
      else if (r.phase === 'paint') work += b.outlineMs + t * b.paintMs;
    }
    // pieces the site adds mid-build grow the plan; the bar never runs backwards
    this.shownProgress = Math.max(this.shownProgress, clamp(work / this.totalWork, 0, 1));
    return this.shownProgress;
  }

  /* ------------------------------------------------------------------ */
  /*  Overlay                                                            */
  /* ------------------------------------------------------------------ */

  private showFrame(r: Rig, b: Block): void {
    r.tag.textContent = b.label;
    r.outline.style.strokeDashoffset = '1';
    r.frame.dataset.state = 'outline';
  }

  private placeFrame(r: Rig, R: DOMRect): void {
    const w = Math.max(2, R.width);
    const h = Math.max(2, R.height);
    r.frame.style.transform = `translate3d(${R.left.toFixed(1)}px, ${R.top.toFixed(1)}px, 0)`;
    r.frame.style.width = `${w.toFixed(1)}px`;
    r.frame.style.height = `${h.toFixed(1)}px`;
    r.outline.setAttribute('width', String(Math.max(0, w - 1.5)));
    r.outline.setAttribute('height', String(Math.max(0, h - 1.5)));
    r.frame.classList.toggle('is-tag-inside', R.top < 22);
    r.frame.classList.toggle('is-tag-right', R.left + 250 > this.viewW);
  }

  private paintCursor(r: Rig): void {
    r.cursor.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
    r.cursor.classList.toggle('is-flipped', r.x > this.viewW - 120);
  }

  /* ------------------------------------------------------------------ */
  /*  Finish                                                             */
  /* ------------------------------------------------------------------ */

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    this.stop();
    this.unwatch();
    for (const b of this.blocks) {
      if (b.state !== 'done') {
        this.reveal(b);
        b.state = 'done';
      }
    }
    for (const r of this.rigs) r.frame.dataset.state = 'done';
    this.layer?.classList.add('is-complete');
    if (this.bar) this.bar.style.transform = 'scaleX(1)';
    this.glideHome();
    this.emit(true);
    this.onComplete?.();
  }

  /**
   * Back to the top of the finished page. Stepped frame by frame rather than handed to a native
   * smooth scroll, which the sites' own scroll engines (Lenis, smooth scroll-behavior) can cut
   * short; a wheel, touch, click or key from the visitor ends it where it is. The scroll overrides
   * come off once it is over.
   */
  private glideHome(): void {
    let from = 0;
    try {
      from = this.win.scrollY;
    } catch {
      return;
    }
    if (from < 1) {
      this.endGlide();
      return;
    }
    const win = this.win;
    const dur = clamp(600 + from * 0.1, 700, 1600);
    const stop = () => this.endGlide();
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    for (const type of inputs) win.addEventListener(type, stop, { passive: true });
    this.glideOff = () => {
      for (const type of inputs) win.removeEventListener(type, stop);
    };
    let t0 = 0;
    const tick = (ts: number) => {
      this.glideRaf = 0;
      if (this.destroyed) return;
      if (!t0) t0 = ts;
      const t = clamp((ts - t0) / dur, 0, 1);
      try {
        win.scrollTo({ top: Math.round(from * (1 - easeInOut(t))), behavior: 'instant' });
      } catch {
        this.endGlide();
        return;
      }
      if (t < 1) this.glideRaf = requestAnimationFrame(tick);
      else this.endGlide();
    };
    this.glideRaf = requestAnimationFrame(tick);
  }

  /** stop gliding and give the page its own scrolling (and its concierge) back */
  private endGlide(): void {
    if (this.glideRaf) cancelAnimationFrame(this.glideRaf);
    this.glideRaf = 0;
    try {
      this.glideOff?.();
      this.doc.getElementById(STYLE_ID)?.remove();
    } catch {
      /* the iframe document is already gone */
    }
    this.glideOff = null;
  }

  private clearMasks(): void {
    for (const b of this.blocks) {
      try {
        this.reveal(b);
      } catch {
        /* element left with its document */
      }
    }
  }

  private emit(force: boolean): void {
    if (!this.onStats) return;
    if (!force && this.clock - this.statsAt < 120) return;
    this.statsAt = this.clock;
    const drawn: Record<string, number> = {};
    for (const r of this.rigs) drawn[r.agent.id] = r.drawn;
    const total = this.sections.length;
    const index = Math.min(this.current, Math.max(0, total - 1));
    this.onStats({
      progress: this.finished ? 1 : this.progress(),
      complete: this.finished,
      drawn,
      section: { index: index + 1, total, label: this.sections[index]?.label ?? '' },
      forced: this.forced,
      blocks: this.blocks.filter((b) => !b.auto).length,
    });
  }
}
