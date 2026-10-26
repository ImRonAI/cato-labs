export function createCanvasDocument(channel: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; media-src https: data: blob:; connect-src https:; worker-src blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;min-height:100%}*{box-sizing:border-box}@media print{html,body{display:none!important}}</style></head><body></body><script>(${canvasRuntime.toString()})(${JSON.stringify(channel).replace(/</g, "\\u003c")})</script></html>`;
}

function canvasRuntime(channel: string) {
  let current = { html: "", streaming: false, agentId: "", agentName: "", fragment: "" };
  let previousFragment = "";
  let previousHtml = "";
  let previousStreaming = false;
  let paints = 0;
  let frame = 0;
  let active: Element | null = null;
  let recentBlocks: Element[] = [];
  let traceStarted = performance.now();
  let executed = false;
  let scriptGeneration = 0;
  const scriptNodes = new Set<HTMLScriptElement>();
  const parser = new DOMParser();
  const generatedHead = document.createElement("template");
  const headNodes: Node[] = [];
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: "closed" });

  const crew = [
    { id: "strategy", name: "Sapphire · Strategy", color: "#1226c8", phase: 0.0 },
    { id: "design", name: "Azure · Design", color: "#2e4bff", phase: 0.25 },
    { id: "engineering", name: "Ice · Engineering", color: "#5b7cfa", phase: 0.5 },
    { id: "seo", name: "Indigo · Discoverability", color: "#6656e8", phase: 0.75 },
  ];

  shadow.innerHTML = `<style>
    :host { pointer-events: none; user-select: none; -webkit-user-select: none; }
    .watermark {
      position: fixed;
      inset: -40%;
      width: 180%;
      height: 180%;
      pointer-events: none;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      align-content: space-around;
      justify-content: space-around;
      transform: rotate(-22deg);
      opacity: 0.13;
      mix-blend-mode: multiply;
    }
    .watermark span {
      font: 700 13px/1.2 system-ui, -apple-system, sans-serif;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: #2e4bff;
      padding: 42px 56px;
      white-space: nowrap;
      text-shadow: 0 0 1px rgba(255,255,255,0.6);
    }
    svg.stage-strokes {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: 2;
    }
    svg.stage-strokes rect {
      fill: none;
      stroke-width: 1.75;
      vector-effect: non-scaling-stroke;
      transition: opacity 0.25s ease;
    }
    .cursors-layer {
      position: fixed;
      inset: 0;
      z-index: 3;
      overflow: hidden;
    }
    .cursor {
      position: fixed;
      left: 0;
      top: 0;
      font: 600 11px/1.25 system-ui, -apple-system, sans-serif;
      white-space: nowrap;
      filter: drop-shadow(0 4px 10px rgba(10, 18, 60, 0.28));
      will-change: transform;
      transition: opacity 0.25s ease;
    }
    .cursor svg {
      position: static;
      width: 18px;
      height: 22px;
      display: block;
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin: -2px 0 0 12px;
      color: #fff;
      padding: 4px 9px;
      border-radius: 4px 10px 10px 10px;
      font-size: 10.5px;
      letter-spacing: 0.04em;
      box-shadow: 0 4px 12px rgba(18, 38, 200, 0.25);
    }
    .label-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #fff;
      opacity: 0.9;
    }
  </style>
  <div class="watermark" aria-hidden="true">${Array.from({ length: 36 }, () => `<span>CATO STUDIO · LIVE PREVIEW</span>`).join("")}</div>
  <svg class="stage-strokes" aria-hidden="true">
    ${crew.map((a) => `<rect data-rect="${a.id}" stroke="${a.color}" stroke-dasharray="6 4" rx="6" opacity="0" />`).join("")}
  </svg>
  <div class="cursors-layer" aria-hidden="true">
    ${crew
      .map(
        (a) => `<div class="cursor" data-cursor="${a.id}" style="color:${a.color};opacity:0">
          <svg viewBox="0 0 18 22"><path d="M2 1L16 14L9 15L6 21Z" fill="${a.color}" stroke="white" stroke-width="1.5"/></svg>
          <span class="label" style="background:${a.color}"><i class="label-dot"></i>${a.name}</span>
        </div>`
      )
      .join("")}
  </div>`;

  const rects = crew.map((a) => shadow.querySelector<SVGRectElement>(`rect[data-rect="${a.id}"]`)!);
  const cursors = crew.map((a) => shadow.querySelector<HTMLElement>(`.cursor[data-cursor="${a.id}"]`)!);
  const smoothPos = crew.map((_, i) => ({ x: 140 + i * 160, y: 120 + i * 80 }));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const notify = (type: string, data = {}) => parent.postMessage({ channel, type, ...data }, "*");

  // Deter context menu & forward screenshot key combos to parent shield
  addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener(
    "keydown",
    (e) => {
      const isPrintScreen = e.key === "PrintScreen" || e.keyCode === 44;
      const isMacShot = e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key);
      const isWinShot = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s";
      const isPrint = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p";
      if (isPrintScreen || isMacShot || isWinShot || isPrint) {
        e.preventDefault();
        notify("capture-attempt");
      }
    },
    true
  );

  const reportError = (message: string) => notify("render-error", { message });
  addEventListener("error", (event) => {
    if (event instanceof ErrorEvent) reportError(event.message || "A generated page script failed.");
  });
  addEventListener("unhandledrejection", (event) => {
    reportError(event.reason instanceof Error ? event.reason.message : String(event.reason));
  });

  function restoreFragment() {
    if (current.streaming || !current.fragment) return;
    let id = current.fragment.replace(/^#/, "");
    try { id = decodeURIComponent(id); } catch { /* Keep malformed fragments literal. */ }
    document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    previousFragment = current.fragment;
  }

  async function executeScripts(sources: HTMLScriptElement[], generation: number) {
    for (const [index, source] of sources.entries()) {
      if (generation !== scriptGeneration) return;
      const script = document.createElement("script");
      for (const attribute of Array.from(source.attributes)) {
        if (!["src", "async", "defer", "nonce"].includes(attribute.name.toLowerCase())) {
          script.setAttribute(attribute.name, attribute.value);
        }
      }
      script.textContent = source.textContent;
      const src = source.getAttribute("src");
      if (src) {
        let url: URL;
        try { url = new URL(src); } catch { throw new Error(`Script URL must be absolute HTTPS: ${src}`); }
        if (url.protocol !== "https:") throw new Error(`Script URL must use HTTPS: ${src}`);
        script.src = url.href;
      }
      script.async = false;
      scriptNodes.add(script);
      const type = script.type.trim().toLowerCase();
      const executable = !type || ["module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"].includes(type);
      if (script.noModule || !executable || (!src && type !== "module")) {
        document.body.append(script);
        continue;
      }
      await new Promise<void>((resolve, reject) => {
        const completionEvent = !src && type === "module" ? `cato:module:${channel}:${generation}:${index}` : null;
        const timeout = setTimeout(() => finish(new Error(`Script timed out: ${src || "inline module"}`)), 60000);
        const finish = (error?: Error) => {
          clearTimeout(timeout);
          if (completionEvent) removeEventListener(completionEvent, complete);
          script.onload = null;
          script.onerror = null;
          if (error) { script.remove(); reject(error); } else resolve();
        };
        const complete = () => finish();
        if (completionEvent) {
          addEventListener(completionEvent, complete, { once: true });
          script.textContent += `\n;globalThis.dispatchEvent(new globalThis.Event(${JSON.stringify(completionEvent)}));`;
        } else script.onload = complete;
        script.onerror = () => finish(new Error(`Unable to load or execute script: ${src || "inline module"}`));
        document.body.append(script);
      });
    }
    if (generation !== scriptGeneration) return;
    document.dispatchEvent(new Event("DOMContentLoaded"));
    dispatchEvent(new Event("load"));
    requestAnimationFrame(restoreFragment);
  }

  function safeDocument(html: string, streaming: boolean) {
    const parsed = parser.parseFromString(html, "text/html");
    parsed.querySelectorAll("base,meta[http-equiv],iframe,object,embed").forEach((node) => node.remove());
    parsed.querySelectorAll("*").forEach((element) => {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().replace(/[\u0000-\u0020]/g, "");
        if ((streaming && name.startsWith("on")) || name === "srcdoc" || name === "nonce" ||
          (["href", "src", "action", "formaction", "xlink:href"].includes(name) && /^(javascript|vbscript):/i.test(value))) {
          element.removeAttribute(attribute.name);
        }
      }
    });
    return parsed;
  }

  function syncAttributes(target: Element, source: Element) {
    let changed = false;
    for (const attribute of Array.from(target.attributes)) {
      if (!source.hasAttribute(attribute.name)) { target.removeAttribute(attribute.name); changed = true; }
    }
    for (const attribute of Array.from(source.attributes)) {
      if (target.getAttribute(attribute.name) !== attribute.value) {
        target.setAttribute(attribute.name, attribute.value); changed = true;
      }
    }
    return changed;
  }

  function mark(node: Node) {
    const element = node instanceof Element ? node : node.parentElement;
    const block = element?.closest("section,header,nav,main,article,figure,footer,div");
    if (block && document.body.contains(block)) {
      active = block;
      if (!recentBlocks.includes(block)) {
        recentBlocks.push(block);
        if (recentBlocks.length > 8) recentBlocks.shift();
      }
    }
  }

  function reconcile(target: Node, source: Node) {
    const incoming = Array.from(source.childNodes);
    incoming.forEach((next, index) => {
      let existing = target.childNodes[index];
      const same = existing && existing.nodeType === next.nodeType &&
        (!(existing instanceof Element) || (next instanceof Element && existing.tagName === next.tagName &&
          (!next.id || next.id === existing.id)));
      if (!same) {
        const replacement = document.importNode(next, true);
        if (existing) target.replaceChild(replacement, existing); else target.appendChild(replacement);
        existing = replacement;
        mark(existing);
        if (existing instanceof Element) existing.querySelectorAll("div,section,article,header,footer,main").forEach(mark);
      } else if (existing instanceof Element && next instanceof Element) {
        if (syncAttributes(existing, next)) mark(existing);
        reconcile(existing, next);
      } else if (existing.nodeValue !== next.nodeValue) {
        existing.nodeValue = next.nodeValue;
        mark(existing);
      }
    });
    while (target.childNodes.length > incoming.length) target.lastChild?.remove();
  }

  function draw(now: number) {
    frame = 0;
    const showCursors = current.streaming || now - traceStarted < 1800;
    if (!showCursors) {
      cursors.forEach((c) => (c.style.opacity = "0"));
      rects.forEach((r) => r.setAttribute("opacity", "0"));
      return;
    }

    const vw = Math.max(320, innerWidth);
    const vh = Math.max(240, innerHeight);
    const candidates = recentBlocks.filter((b) => b.isConnected && b.getBoundingClientRect().height > 12);

    crew.forEach((agent, idx) => {
      const cursorEl = cursors[idx]!;
      const rectEl = rects[idx]!;
      cursorEl.style.opacity = "1";

      const targetEl = candidates.length > 0 ? candidates[( candidates.length - 1 - (idx % candidates.length) + candidates.length) % candidates.length] : null;
      const bounds = targetEl ? targetEl.getBoundingClientRect() : null;

      let tx: number;
      let ty: number;

      if (bounds && bounds.width > 20 && bounds.height > 12 && bounds.bottom > 0 && bounds.top < vh) {
        const bx = Math.max(8, bounds.left);
        const by = Math.max(8, bounds.top);
        const bw = Math.min(vw - bx - 8, bounds.width);
        const bh = Math.min(vh - by - 8, bounds.height);
        const perim = 2 * (bw + bh);
        const t = ((now * 0.00012 + agent.phase) % 1 + 1) % 1;
        let dist = t * perim;
        tx = bx;
        ty = by;
        if (dist <= bw) tx += dist;
        else if ((dist -= bw) <= bh) { tx += bw; ty += dist; }
        else if ((dist -= bh) <= bw) { tx += bw - dist; ty += bh; }
        else { dist -= bw; ty += bh - dist; }

        rectEl.setAttribute("x", String(bx));
        rectEl.setAttribute("y", String(by));
        rectEl.setAttribute("width", String(Math.max(0, bw)));
        rectEl.setAttribute("height", String(Math.max(0, bh)));
        rectEl.setAttribute("stroke-dashoffset", String(-now * 0.015));
        rectEl.setAttribute("opacity", idx < 2 ? "0.65" : "0.35");
      } else {
        // Choreographed figure-8 / zone sketching when waiting for next block
        const zoneX = (0.18 + (idx % 2) * 0.46) * vw;
        const zoneY = (0.22 + Math.floor(idx / 2) * 0.42) * vh;
        const angle = now * 0.00045 * (idx % 2 === 0 ? 1 : -1) + idx * 1.7;
        tx = zoneX + Math.cos(angle) * (vw * 0.14);
        ty = zoneY + Math.sin(angle * 1.5) * (vh * 0.1);
        rectEl.setAttribute("x", String(zoneX - vw * 0.14));
        rectEl.setAttribute("y", String(zoneY - vh * 0.09));
        rectEl.setAttribute("width", String(vw * 0.28));
        rectEl.setAttribute("height", String(vh * 0.18));
        rectEl.setAttribute("stroke-dashoffset", String(-now * 0.015));
        rectEl.setAttribute("opacity", "0.28");
      }

      const prev = smoothPos[idx]!;
      const lerp = reduced.matches ? 1 : 0.06;
      prev.x += (tx - prev.x) * lerp;
      prev.y += (ty - prev.y) * lerp;

      const clampedX = Math.max(6, Math.min(vw - 150, prev.x));
      const clampedY = Math.max(6, Math.min(vh - 38, prev.y));
      cursorEl.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
    });

    if (!reduced.matches) {
      frame = requestAnimationFrame(draw);
    }
  }

  function scheduleDraw() { if (!frame) frame = requestAnimationFrame(draw); }
  new ResizeObserver(scheduleDraw).observe(document.body);
  addEventListener("resize", scheduleDraw);
  addEventListener("scroll", scheduleDraw, true);
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    const href = link?.getAttribute("href")?.trim();
    if (!href) return;
    if (href.startsWith("#")) {
      event.preventDefault();
      let id = href.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Keep malformed fragments literal. */ }
      document.getElementById(id)?.scrollIntoView({ behavior: reduced.matches ? "instant" : "smooth" });
      return;
    }
    if (/^(https:|mailto:|tel:)/i.test(href)) {
      link!.setAttribute("target", "_blank");
      link!.setAttribute("rel", "noopener noreferrer");
      return;
    }
    event.preventDefault();
    if (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith("//") && !href.includes("\\")) {
      notify("navigate", { href });
    }
  }, true);

  function paint() {
    if (current.html === previousHtml && current.streaming === previousStreaming) {
      scheduleDraw();
      if (current.fragment !== previousFragment) restoreFragment();
      return;
    }
    const reset = !current.html.startsWith(previousHtml) || (current.streaming && !previousStreaming);
    if (reset) {
      executed = false;
      active = null;
      recentBlocks = [];
      previousFragment = "";
      scriptGeneration += 1;
      scriptNodes.forEach((script) => script.remove());
      scriptNodes.clear();
    }
    const parsed = safeDocument(current.html, current.streaming);
    const scripts = Array.from(parsed.querySelectorAll("script"));
    scripts.forEach((script) => script.remove());
    generatedHead.content.replaceChildren(...Array.from(parsed.head.childNodes).filter((node) =>
      node instanceof Element && ["STYLE", "LINK", "TITLE"].includes(node.tagName)));
    const headContainer = document.createDocumentFragment();
    headNodes.forEach((node) => headContainer.append(node));
    reconcile(headContainer, generatedHead.content);
    headNodes.splice(0, headNodes.length, ...Array.from(headContainer.childNodes));
    document.head.append(headContainer);
    syncAttributes(document.documentElement, parsed.documentElement);
    syncAttributes(document.body, parsed.body);
    const oldActive = active;
    reconcile(document.body, parsed.body);
    if (active !== oldActive || current.streaming) {
      traceStarted = performance.now();
      if (current.streaming && active) {
        const bounds = active.getBoundingClientRect();
        if (bounds.top > innerHeight * 0.82 || bounds.bottom < 0) {
          active.scrollIntoView({ block: "center", behavior: "instant" });
        }
      }
    }
    previousHtml = current.html;
    previousStreaming = current.streaming;
    scheduleDraw();
    paints += 1;
    notify("metrics", {
      elements: document.body.querySelectorAll("*").length,
      paints,
      characters: current.html.length,
      activeElement: active ? active.tagName.toLowerCase() + (active.id ? `#${active.id}` : "") : "",
    });
    if (!current.streaming) restoreFragment();
    if (!current.streaming && /<\/html\s*>\s*$/i.test(current.html) && !executed) {
      executed = true;
      const generation = scriptGeneration;
      void executeScripts(scripts, generation).catch((error: unknown) => {
        if (generation === scriptGeneration) reportError(error instanceof Error ? error.message : String(error));
      });
    }
  }

  let paintScheduled = false;
  addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.channel !== channel || event.data?.type !== "render") return;
    if (typeof event.data.html !== "string" || typeof event.data.streaming !== "boolean") return;
    current = { ...event.data, fragment: typeof event.data.fragment === "string" ? event.data.fragment : "" };
    if (!paintScheduled) {
      paintScheduled = true;
      requestAnimationFrame(() => { paintScheduled = false; paint(); });
    }
  });
  notify("ready");
}
