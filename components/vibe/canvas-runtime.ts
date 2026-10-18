export function createCanvasDocument(channel: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; media-src https: data: blob:; connect-src https:; worker-src blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;min-height:100%}*{box-sizing:border-box}</style></head><body></body><script>(${canvasRuntime.toString()})(${JSON.stringify(channel).replace(/</g, "\\u003c")})</script></html>`;
}

function canvasRuntime(channel: string) {
  let current = { html: "", streaming: false, agentId: "", agentName: "", fragment: "" };
  let previousFragment = "";
  let previousHtml = "";
  let previousStreaming = false;
  let paints = 0;
  let frame = 0;
  let active: Element | null = null;
  let traceStarted = 0;
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
  shadow.innerHTML = `<style>:host{pointer-events:none}svg{position:fixed;inset:0;width:100%;height:100%;overflow:hidden}rect{fill:none;stroke:#6656e8;stroke-width:2;vector-effect:non-scaling-stroke}.cursor{position:fixed;left:0;top:0;color:#6656e8;font:600 11px/1.3 system-ui;white-space:nowrap;filter:drop-shadow(0 2px 5px #0003)}.cursor svg{position:static;width:18px;height:22px;display:block}.label{display:block;margin:0 0 0 12px;background:#6656e8;color:white;padding:5px 8px;border-radius:3px 8px 8px 8px}</style><svg aria-hidden="true"><rect/></svg><div class="cursor"><svg viewBox="0 0 18 22"><path d="M2 1L16 14L9 15L6 21Z" fill="currentColor" stroke="white" stroke-width="1.5"/></svg><span class="label"></span></div>`;
  const rect = shadow.querySelector("rect")!;
  const cursor = shadow.querySelector<HTMLElement>(".cursor")!;
  const label = shadow.querySelector<HTMLElement>(".label")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const notify = (type: string, data = {}) => parent.postMessage({ channel, type, ...data }, "*");

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
    const block = element?.closest("div,section,article,header,footer,main,nav,aside,figure,li");
    if (block && document.body.contains(block)) active = block;
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
    host.style.display = current.streaming && active?.isConnected ? "block" : "none";
    if (!current.streaming || !active?.isConnected) return;
    const bounds = active.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    const perimeter = 2 * (width + height);
    if (!perimeter) return;
    const progress = reduced.matches ? 1 : Math.min(1, (now - traceStarted) / 700);
    rect.setAttribute("x", String(bounds.left)); rect.setAttribute("y", String(bounds.top));
    rect.setAttribute("width", String(width)); rect.setAttribute("height", String(height));
    rect.setAttribute("rx", getComputedStyle(active).borderTopLeftRadius.replace("px", ""));
    rect.setAttribute("stroke-dasharray", `${perimeter} ${perimeter}`);
    rect.setAttribute("stroke-dashoffset", String(perimeter * (1 - progress)));
    let distance = progress * perimeter;
    let x = bounds.left; let y = bounds.top;
    if (distance <= width) x += distance;
    else if ((distance -= width) <= height) { x += width; y += distance; }
    else if ((distance -= height) <= width) { x += width - distance; y += height; }
    else { distance -= width; y += height - distance; }
    cursor.style.transform = `translate(${Math.max(0, Math.min(innerWidth - 22, x))}px,${Math.max(0, Math.min(innerHeight - 45, y))}px)`;
    label.style.marginLeft = `${x > innerWidth - label.offsetWidth - 24 ? -(label.offsetWidth + 8) : 12}px`;
    if (progress < 1) frame = requestAnimationFrame(draw);
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
    label.textContent = current.agentName;
    if (current.html === previousHtml && current.streaming === previousStreaming) {
      scheduleDraw();
      if (current.fragment !== previousFragment) restoreFragment();
      return;
    }
    const reset = !current.html.startsWith(previousHtml) || (current.streaming && !previousStreaming);
    if (reset) {
      executed = false;
      active = null;
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
    // Keep the bootstrap CSP outside generated head reconciliation.
    const headContainer = document.createDocumentFragment();
    headNodes.forEach((node) => headContainer.append(node));
    reconcile(headContainer, generatedHead.content);
    headNodes.splice(0, headNodes.length, ...Array.from(headContainer.childNodes));
    document.head.append(headContainer);
    syncAttributes(document.documentElement, parsed.documentElement);
    syncAttributes(document.body, parsed.body);
    const oldActive = active;
    reconcile(document.body, parsed.body);
    if (active !== oldActive) {
      traceStarted = performance.now();
      if (current.streaming && active) {
        const bounds = active.getBoundingClientRect();
        if (bounds.top > innerHeight * .8 || bounds.bottom < 0) active.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
    previousHtml = current.html;
    previousStreaming = current.streaming;
    label.textContent = current.agentName;
    scheduleDraw();
    paints += 1;
    notify("metrics", { elements: document.body.querySelectorAll("*").length, paints,
      characters: current.html.length, activeElement: active ? active.tagName.toLowerCase() + (active.id ? `#${active.id}` : "") : "" });
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
