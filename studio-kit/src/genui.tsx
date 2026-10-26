/*
 * Generative UI for the studio concierge.
 *
 * The Telnyx MCP server's `generate_prefab_ui` returns a Prefab view tree
 * ({ view, state }). We translate that tree into a JSX string and render it through the
 * AI Elements <JSXPreview> with a component library built here — so tool output and any
 * ```jsx block the model writes go through exactly the same renderer.
 *
 * State is live: inputs, sliders, switches, tabs and buttons read and write a shared store,
 * and {{ template }} expressions in text re-render from it. `sendMessage` actions post back
 * to the chat.
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { JSXPreview, JSXPreviewContent, JSXPreviewError } from '../vendor/ai-elements/jsx-preview';

/* ───────── State + templates ───────── */
type State = Record<string, unknown>;
interface Store {
  state: State;
  set: (k: string, v: unknown) => void;
  send: (msg: string) => void;
}
const StoreCtx = createContext<Store>({ state: {}, set: () => {}, send: () => {} });
const useStore = () => useContext(StoreCtx);

function get(state: State, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), state);
}

const PIPES: Record<string, (v: unknown, a?: string) => unknown> = {
  upper: (v) => String(v ?? '').toUpperCase(),
  lower: (v) => String(v ?? '').toLowerCase(),
  length: (v) => (Array.isArray(v) || typeof v === 'string' ? v.length : 0),
  json: (v) => JSON.stringify(v),
  round: (v, a) => Number(Number(v).toFixed(Number(a ?? 0))),
  default: (v, a) => (v === undefined || v === null || v === '' ? stripQ(a ?? '') : v),
  truncate: (v, a) => {
    const s = String(v ?? '');
    const n = Number(a ?? 40);
    return s.length > n ? s.slice(0, n) + '…' : s;
  },
  currency: (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 }) : String(v ?? '');
  },
};
const stripQ = (s: string) => s.trim().replace(/^['"]|['"]$/g, '');

/** Evaluate a tiny, safe expression language: identifiers, numbers, strings, + - * / %, comparisons, !, && ||, ?:, pipes. */
function evalExpr(src: string, state: State): unknown {
  const [exprPart, ...pipeParts] = splitPipes(src);
  let v = evalPure(exprPart.trim(), state);
  for (const p of pipeParts) {
    const m = /^\s*([a-z]+)(?:\((.*)\))?\s*$/i.exec(p);
    if (m && PIPES[m[1]]) v = PIPES[m[1]](v, m[2]);
  }
  return v;
}
function splitPipes(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '', q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === '|' && s[i + 1] !== '|' && s[i - 1] !== '|' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
function evalPure(src: string, state: State): unknown {
  const toks = src.match(/\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+(?:\.\d+)?|[A-Za-z_$][\w$.]*|===|!==|==|!=|>=|<=|&&|\|\||[-+*/%<>!?:()])\s*/g) || [];
  let i = 0;
  const peek = () => toks[i]?.trim();
  const next = () => toks[i++]?.trim();
  const primary = (): unknown => {
    const t = next();
    if (t === undefined) return undefined;
    if (t === '(') { const v = ternary(); next(); return v; }
    if (t === '!') return !primary();
    if (t === '-') return -Number(primary());
    if (/^\d/.test(t)) return Number(t);
    if (/^["']/.test(t)) return t.slice(1, -1);
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    return get(state, t.replace(/^\$/, ''));
  };
  const bin = (ops: string[], sub: () => unknown) => (): unknown => {
    let l = sub();
    while (ops.includes(peek() ?? '')) {
      const op = next()!;
      const r = sub();
      const a = l as never, b = r as never;
      l = op === '+' ? (typeof a === 'string' || typeof b === 'string' ? `${a}${b}` : Number(a) + Number(b))
        : op === '-' ? Number(a) - Number(b) : op === '*' ? Number(a) * Number(b) : op === '/' ? Number(a) / Number(b) : op === '%' ? Number(a) % Number(b)
        : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : op === '<=' ? a <= b
        : op === '==' || op === '===' ? a == b : op === '!=' || op === '!==' ? a != b
        : op === '&&' ? a && b : a || b;
    }
    return l;
  };
  const mul = bin(['*', '/', '%'], primary);
  const add = bin(['+', '-'], mul);
  const cmp = bin(['>', '<', '>=', '<=', '==', '!=', '===', '!=='], add);
  const and = bin(['&&'], cmp);
  const or = bin(['||'], and);
  const ternary = (): unknown => {
    const c = or();
    if (peek() === '?') { next(); const a = ternary(); next(); const b = ternary(); return c ? a : b; }
    return c;
  };
  try { return ternary(); } catch { return undefined; }
}

/** Resolve "{{ expr }}" in strings. A string that is exactly one template returns the raw value. */
function tpl(v: unknown, state: State): unknown {
  if (typeof v !== 'string' || !v.includes('{{')) return v;
  const whole = /^\s*\{\{([\s\S]+?)\}\}\s*$/.exec(v);
  if (whole) return evalExpr(whole[1], state);
  return v.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => {
    const r = evalExpr(e, state);
    return r === undefined || r === null ? '' : typeof r === 'object' ? JSON.stringify(r) : String(r);
  });
}
const useT = () => {
  const { state } = useStore();
  return (v: unknown) => tpl(v, state);
};
const txt = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/* Minimal inline markdown for Text content: **bold**, *em*, `code`. */
function inlineMd(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/* ───────── Actions ───────── */
type Action = { action?: string; key?: string; value?: unknown; content?: string; url?: string } | Action[];
function useRun() {
  const { state, set, send } = useStore();
  return (a: unknown) => {
    const list = Array.isArray(a) ? a : a ? [a] : [];
    for (const raw of list as Action[]) {
      const x = raw as Exclude<Action, Action[]>;
      if (!x || typeof x !== 'object') continue;
      const key = x.key ?? '';
      switch (x.action) {
        case 'setState': set(key, tpl(x.value, state)); break;
        case 'toggleState': set(key, !get(state, key)); break;
        case 'appendState': set(key, [...((get(state, key) as unknown[]) || []), tpl(x.value, state)]); break;
        case 'popState': set(key, ((get(state, key) as unknown[]) || []).slice(0, -1)); break;
        case 'sendMessage': send(txt(tpl(x.content ?? x.value, state))); break;
        case 'openLink': if (x.url) window.open(txt(tpl(x.url, state)), '_blank', 'noopener'); break;
        default: break;
      }
    }
  };
}

/* ───────── Component library (rendered by JSXPreview) ───────── */
type P = Record<string, unknown> & { children?: React.ReactNode };
const cls = (...c: unknown[]) => c.filter(Boolean).join(' ');
const parse = (v: unknown) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
};

function arbitraryGrid(cssClass: string): React.CSSProperties | undefined {
  const m = /grid-cols-\[([^\]]+)\]/.exec(cssClass);
  return m ? { gridTemplateColumns: m[1].replace(/_/g, ' ') } : undefined;
}

function Box(tag: string, base: string) {
  const C = ({ className, children, cssClass }: P) =>
    React.createElement(tag, { className: cls(base, txt(cssClass), txt(className)), style: arbitraryGrid(txt(cssClass)) }, children);
  C.displayName = base;
  return C;
}
function TextLike(tag: string, base: string) {
  const C = ({ content, label, cssClass, children }: P) => {
    const t = useT();
    const s = txt(t(content ?? label));
    return React.createElement(tag, { className: cls(base, txt(cssClass)) }, s ? inlineMd(s) : children);
  };
  C.displayName = base;
  return C;
}

const Heading = ({ content, level, cssClass }: P) => {
  const t = useT();
  const lv = Math.min(4, Math.max(1, Number(level) || 2));
  return React.createElement(`h${lv}`, { className: cls('gx-h', `gx-h${lv}`, txt(cssClass)) }, txt(t(content)));
};

const Badge = ({ label, content, variant, cssClass, children }: P) => {
  const t = useT();
  return <span className={cls('gx-badge', `is-${txt(variant) || 'default'}`, txt(cssClass))}>{txt(t(label ?? content)) || children}</span>;
};

const Button = ({ label, content, variant, size, onClick, disabled, icon, cssClass }: P) => {
  const t = useT();
  const run = useRun();
  return (
    <button type="button" className={cls('gx-btn', `is-${txt(variant) || 'default'}`, `sz-${txt(size) || 'default'}`, txt(cssClass))} disabled={Boolean(t(disabled))} onClick={() => run(parse(onClick))}>
      {icon ? <span className="gx-ico" aria-hidden="true">{iconGlyph(txt(icon))}</span> : null}
      {txt(t(label ?? content))}
    </button>
  );
};

function iconGlyph(name: string) {
  const map: Record<string, string> = { check: '✓', x: '✕', plus: '+', minus: '−', clock: '◷', calendar: '▦', star: '★', arrow: '→', 'arrow-right': '→', 'arrow-left': '←', info: 'ⓘ', alert: '!', map: '⌖', 'map-pin': '⌖', phone: '☏', mail: '✉', heart: '♥', search: '⌕', user: '◯', users: '◯◯', fish: '⟡', utensils: '⋔', sparkles: '✦' };
  return map[name] ?? '•';
}
const Icon = ({ name }: P) => <span className="gx-ico" aria-hidden="true">{iconGlyph(txt(name))}</span>;

const Metric = ({ label, value, delta, description, cssClass }: P) => {
  const t = useT();
  const d = txt(t(delta));
  return (
    <div className={cls('gx-metric', txt(cssClass))}>
      <span className="gx-metric__l">{txt(t(label))}</span>
      <span className="gx-metric__v">{txt(t(value))}</span>
      {d ? <span className={cls('gx-metric__d', d.startsWith('-') ? 'is-down' : 'is-up')}>{d}</span> : null}
      {description ? <span className="gx-metric__s">{txt(t(description))}</span> : null}
    </div>
  );
};

const Progress = ({ value, max, cssClass }: P) => {
  const t = useT();
  const p = Math.max(0, Math.min(100, (Number(t(value)) / (Number(max) || 100)) * 100));
  return <div className={cls('gx-progress', txt(cssClass))} role="progressbar" aria-valuenow={p}><i style={{ width: `${p}%` }} /></div>;
};

const Ring = ({ value, min, max, label, cssClass }: P) => {
  const t = useT();
  const lo = Number(min) || 0, hi = Number(max) || 100;
  const p = Math.max(0, Math.min(1, (Number(t(value)) - lo) / (hi - lo || 1)));
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className={cls('gx-ring', txt(cssClass))}>
      <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} className="t" /><circle cx="32" cy="32" r={r} className="f" strokeDasharray={c} strokeDashoffset={c * (1 - p)} /></svg>
      <span>{txt(t(label))}</span>
    </div>
  );
};

const Separator = () => <hr className="gx-sep" />;
const Loader = () => <span className="gx-loader" aria-label="Loading" />;
const Dot = ({ variant }: P) => <span className={cls('gx-dot', `is-${txt(variant) || 'default'}`)} />;
const Kbd = ({ label, content }: P) => <kbd className="gx-kbd">{txt(label ?? content)}</kbd>;
const Code = ({ content }: P) => {
  const t = useT();
  return <pre className="gx-code"><code>{txt(t(content))}</code></pre>;
};
const Image = ({ src, alt, cssClass }: P) => {
  const t = useT();
  const s = txt(t(src));
  return /^(https?:|\/)/.test(s) ? <img className={cls('gx-img', txt(cssClass))} src={s} alt={txt(t(alt))} loading="lazy" /> : null;
};
const LinkC = ({ content, href, cssClass }: P) => {
  const t = useT();
  const h = txt(t(href));
  return <a className={cls('gx-link', txt(cssClass))} href={/^(https?:|\/|#|mailto:|tel:)/.test(h) ? h : '#'} target={h.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{txt(t(content))}</a>;
};
const Markdown = ({ content }: P) => {
  const t = useT();
  const lines = txt(t(content)).split(/\n/);
  return (
    <div className="gx-md">
      {lines.map((l, i) => {
        const h = /^(#{1,4})\s+(.*)$/.exec(l);
        if (h) return React.createElement(`h${h[1].length + 1}`, { key: i, className: 'gx-h' }, inlineMd(h[2]));
        if (/^\s*[-*]\s+/.test(l)) return <div key={i} className="gx-li">• {inlineMd(l.replace(/^\s*[-*]\s+/, ''))}</div>;
        return l.trim() ? <p key={i}>{inlineMd(l)}</p> : null;
      })}
    </div>
  );
};

/* Inputs bound to state by `name`. */
function useField(name: unknown, fallback: unknown) {
  const { state, set } = useStore();
  const key = txt(name);
  const v = key ? get(state, key) : undefined;
  return [v === undefined ? fallback : v, (x: unknown) => key && set(key, x)] as const;
}
const Slider = ({ name, value, min, max, step, cssClass }: P) => {
  const [v, setV] = useField(name, Number(value) || 0);
  return (
    <div className={cls('gx-slider', txt(cssClass))}>
      <input type="range" min={Number(min ?? 0)} max={Number(max ?? 100)} step={Number(step ?? 1)} value={Number(v)} onChange={(e) => setV(Number(e.target.value))} aria-label={txt(name)} />
      <output>{txt(v)}</output>
    </div>
  );
};
const Input = ({ name, value, placeholder, inputType, label, cssClass }: P) => {
  const [v, setV] = useField(name, value ?? '');
  return (
    <label className={cls('gx-field', txt(cssClass))}>
      {label ? <span>{txt(label)}</span> : null}
      <input type={txt(inputType) || 'text'} value={txt(v)} placeholder={txt(placeholder)} onChange={(e) => setV(txt(inputType) === 'number' ? Number(e.target.value) : e.target.value)} />
    </label>
  );
};
const Textarea = ({ name, value, placeholder, cssClass }: P) => {
  const [v, setV] = useField(name, value ?? '');
  return <textarea className={cls('gx-textarea', txt(cssClass))} value={txt(v)} placeholder={txt(placeholder)} onChange={(e) => setV(e.target.value)} />;
};
const Switch = ({ name, value, label, cssClass }: P) => {
  const [v, setV] = useField(name, Boolean(value));
  return (
    <label className={cls('gx-switch', txt(cssClass))}>
      <button type="button" role="switch" aria-checked={Boolean(v)} onClick={() => setV(!v)}><i /></button>
      <span>{txt(label)}</span>
    </label>
  );
};
const Checkbox = ({ name, value, label, cssClass }: P) => {
  const [v, setV] = useField(name, Boolean(value));
  return (
    <label className={cls('gx-check', txt(cssClass))}>
      <input type="checkbox" checked={Boolean(v)} onChange={(e) => setV(e.target.checked)} />
      <span>{txt(label)}</span>
    </label>
  );
};

/* Options containers receive their options as a JSON prop (built by the translator). */
type Opt = { value: string; label: string };
const Select = ({ name, placeholder, options, cssClass }: P) => {
  const opts = (parse(options) as Opt[]) || [];
  const [v, setV] = useField(name, '');
  return (
    <select className={cls('gx-select', txt(cssClass))} value={txt(v)} onChange={(e) => setV(e.target.value)}>
      {placeholder ? <option value="" disabled>{txt(placeholder)}</option> : null}
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};
const RadioGroup = ({ name, options, cssClass }: P) => {
  const opts = (parse(options) as Opt[]) || [];
  const [v, setV] = useField(name, '');
  return (
    <div className={cls('gx-radio', txt(cssClass))} role="radiogroup">
      {opts.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={v === o.value} className={v === o.value ? 'on' : ''} onClick={() => setV(o.value)}>{o.label}</button>
      ))}
    </div>
  );
};

/* Tabs / Pages / Accordion: children are panels carrying title + value attributes. */
const TabsC = ({ name, value, children, cssClass }: P) => {
  const panels = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<P>[];
  const first = txt(value) || txt(panels[0]?.props.value);
  const [v, setV] = useField(name || '__tabs', first);
  return (
    <div className={cls('gx-tabs', txt(cssClass))}>
      <div className="gx-tabs__list" role="tablist">
        {panels.map((p) => (
          <button key={txt(p.props.value)} type="button" role="tab" aria-selected={v === p.props.value} onClick={() => setV(p.props.value)}>{txt(p.props.title)}</button>
        ))}
      </div>
      {panels.filter((p) => p.props.value === v)}
    </div>
  );
};
const Panel = ({ children }: P) => <div className="gx-panel">{children}</div>;
const AccordionItem = ({ title, children }: P) => (
  <details className="gx-acc">
    <summary>{txt(title)}</summary>
    <div>{children}</div>
  </details>
);

const ChoiceCard = ({ name, value, children, cssClass }: P) => {
  const [v, setV] = useField(name, '');
  const on = value !== undefined && v === value;
  return (
    <button type="button" className={cls('gx-choice', on && 'on', txt(cssClass))} aria-pressed={on} onClick={() => setV(value)}>
      {children}
    </button>
  );
};

const TooltipC = ({ content, children }: P) => <span className="gx-tip" title={txt(content)}>{children}</span>;

/* Conditions and loops. */
const Condition = ({ cases, otherwise, children }: P) => {
  const { state } = useStore();
  const list = (parse(cases) as { when: string }[]) || [];
  const kids = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<P>[];
  for (let i = 0; i < list.length; i++) if (tpl(list[i].when, state)) return <>{kids[i]?.props.children}</>;
  return otherwise ? <>{kids[list.length]?.props.children}</> : null;
};
const Case = ({ children }: P) => <>{children}</>;
const ForEachC = ({ items, children }: P) => {
  const store = useStore();
  const arr = (get(store.state, txt(items)) as unknown[]) || [];
  return (
    <>
      {arr.map((item, index) => (
        <StoreCtx.Provider key={index} value={{ ...store, state: { ...store.state, item, $item: item, index, $index: index } }}>{children}</StoreCtx.Provider>
      ))}
    </>
  );
};

/* Tables. DataTable gets rows/columns as JSON. */
const DataTable = ({ columns, rows, cssClass }: P) => {
  const cols = (parse(columns) as { key: string; header?: string }[]) || [];
  const data = (parse(rows) as Record<string, unknown>[]) || [];
  const t = useT();
  return (
    <div className={cls('gx-tablewrap', txt(cssClass))}>
      <table className="gx-table">
        <thead><tr>{cols.map((c) => <th key={c.key}>{c.header ?? c.key}</th>)}</tr></thead>
        <tbody>{data.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.key}>{txt(t(r[c.key]))}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
};

/* Charts: dependency-free SVG bar/line/area/pie, enough for published figures. */
type Series = { dataKey: string; label?: string };
const PALETTE = ['var(--sc-accent)', 'color-mix(in oklab, var(--sc-accent) 55%, var(--sc-fg))', 'color-mix(in oklab, var(--sc-fg) 55%, transparent)', 'color-mix(in oklab, var(--sc-accent) 40%, var(--sc-bg))'];
const ChartC = (kind: 'bar' | 'line' | 'area') => {
  const C = ({ data, series, xAxis, horizontal, stacked }: P) => {
    const rows = (parse(data) as Record<string, unknown>[]) || [];
    const ser = (parse(series) as Series[]) || [];
    const xk = txt(xAxis);
    if (!rows.length || !ser.length) return null;
    const W = 320, H = 170, pad = { l: 34, r: 8, t: 10, b: 26 };
    const vals = rows.flatMap((r) => ser.map((s) => Number(r[s.dataKey]) || 0));
    const max = Math.max(1, ...(stacked ? rows.map((r) => ser.reduce((a, s) => a + (Number(r[s.dataKey]) || 0), 0)) : vals));
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const bw = iw / rows.length;
    const y = (v: number) => pad.t + ih - (v / max) * ih;
    const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10));
    if (horizontal && kind === 'bar') {
      const bh = ih / rows.length;
      return (
        <figure className="gx-chart">
          <svg viewBox={`0 0 ${W} ${H}`}>
            {rows.map((r, i) => {
              const v = Number(r[ser[0].dataKey]) || 0;
              return (
                <g key={i}>
                  <text x={pad.l - 4} y={pad.t + bh * i + bh / 2 + 3} textAnchor="end" className="gx-ax">{txt(r[xk])}</text>
                  <rect x={pad.l} y={pad.t + bh * i + bh * 0.18} width={(v / max) * iw} height={bh * 0.64} rx="3" fill={PALETTE[0]} />
                  <text x={pad.l + (v / max) * iw + 4} y={pad.t + bh * i + bh / 2 + 3} className="gx-ax">{fmt(v)}</text>
                </g>
              );
            })}
          </svg>
          <Legend ser={ser} />
        </figure>
      );
    }
    return (
      <figure className="gx-chart">
        <svg viewBox={`0 0 ${W} ${H}`}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} className="gx-grid" />
              <text x={pad.l - 4} y={y(max * f) + 3} textAnchor="end" className="gx-ax">{fmt(max * f)}</text>
            </g>
          ))}
          {rows.map((r, i) => (
            <text key={i} x={pad.l + bw * i + bw / 2} y={H - 8} textAnchor="middle" className="gx-ax">{txt(r[xk])}</text>
          ))}
          {kind === 'bar'
            ? rows.map((r, i) => {
                let acc = 0;
                return ser.map((s, k) => {
                  const v = Number(r[s.dataKey]) || 0;
                  const w = stacked ? bw * 0.6 : (bw * 0.7) / ser.length;
                  const x = stacked ? pad.l + bw * i + bw * 0.2 : pad.l + bw * i + bw * 0.15 + w * k;
                  const top = stacked ? y(acc + v) : y(v);
                  const h = stacked ? y(acc) - y(acc + v) : pad.t + ih - y(v);
                  acc += v;
                  return <rect key={`${i}-${k}`} x={x} y={top} width={w} height={Math.max(0, h)} rx="2" fill={PALETTE[k % PALETTE.length]} />;
                });
              })
            : ser.map((s, k) => {
                const pts = rows.map((r, i) => `${pad.l + bw * i + bw / 2},${y(Number(r[s.dataKey]) || 0)}`);
                return (
                  <g key={k}>
                    {kind === 'area' ? <polygon points={`${pad.l + bw / 2},${pad.t + ih} ${pts.join(' ')} ${pad.l + bw * (rows.length - 0.5)},${pad.t + ih}`} fill={PALETTE[k % PALETTE.length]} opacity=".18" /> : null}
                    <polyline points={pts.join(' ')} fill="none" stroke={PALETTE[k % PALETTE.length]} strokeWidth="1.8" />
                  </g>
                );
              })}
        </svg>
        <Legend ser={ser} />
      </figure>
    );
  };
  C.displayName = `${kind}Chart`;
  return C;
};
const Legend = ({ ser }: { ser: Series[] }) =>
  ser.length > 1 || ser[0]?.label ? (
    <figcaption className="gx-legend">
      {ser.map((s, k) => <span key={s.dataKey}><i style={{ background: PALETTE[k % PALETTE.length] }} />{s.label ?? s.dataKey}</span>)}
    </figcaption>
  ) : null;
const PieChart = ({ data, dataKey, nameKey, innerRadius }: P) => {
  const rows = (parse(data) as Record<string, unknown>[]) || [];
  const dk = txt(dataKey), nk = txt(nameKey);
  const total = rows.reduce((a, r) => a + (Number(r[dk]) || 0), 0) || 1;
  let a0 = -Math.PI / 2;
  const R = 70, r0 = Number(innerRadius) ? 40 : 0;
  return (
    <figure className="gx-chart gx-pie">
      <svg viewBox="0 0 160 160">
        {rows.map((r, i) => {
          const v = (Number(r[dk]) || 0) / total;
          const a1 = a0 + v * Math.PI * 2;
          const big = a1 - a0 > Math.PI ? 1 : 0;
          const p = (rad: number, a: number) => `${80 + Math.cos(a) * rad},${80 + Math.sin(a) * rad}`;
          const d = `M${p(R, a0)} A${R},${R} 0 ${big} 1 ${p(R, a1)} L${r0 ? p(r0, a1) : '80,80'} ${r0 ? `A${r0},${r0} 0 ${big} 0 ${p(r0, a0)}` : ''}Z`;
          a0 = a1;
          return <path key={i} d={d} fill={PALETTE[i % PALETTE.length]} stroke="var(--sc-bg)" strokeWidth="1" />;
        })}
      </svg>
      <figcaption className="gx-legend">{rows.map((r, i) => <span key={i}><i style={{ background: PALETTE[i % PALETTE.length] }} />{txt(r[nk])}</span>)}</figcaption>
    </figure>
  );
};

const Fallback = ({ children }: P) => <div>{children}</div>;

export const GEN_COMPONENTS: Record<string, React.ComponentType<P>> = {
  Div: Box('div', 'gx-div'),
  Column: Box('div', 'gx-col'),
  Row: Box('div', 'gx-row'),
  Grid: Box('div', 'gx-grid'),
  GridItem: Box('div', 'gx-griditem'),
  Container: Box('div', 'gx-container'),
  Dashboard: Box('div', 'gx-grid'),
  DashboardItem: Box('div', 'gx-griditem'),
  Card: Box('section', 'gx-card'),
  CardHeader: Box('header', 'gx-card__h'),
  CardContent: Box('div', 'gx-card__c'),
  CardFooter: Box('footer', 'gx-card__f'),
  CardTitle: TextLike('h3', 'gx-card__t'),
  CardDescription: TextLike('p', 'gx-card__d'),
  Form: Box('div', 'gx-col'),
  Field: Box('div', 'gx-fieldwrap'),
  FieldContent: Box('div', 'gx-col'),
  FieldTitle: TextLike('span', 'gx-fieldtitle'),
  FieldDescription: TextLike('span', 'gx-muted'),
  FieldError: TextLike('span', 'gx-err'),
  Label: TextLike('label', 'gx-label'),
  Alert: Box('div', 'gx-alert'),
  AlertTitle: TextLike('strong', 'gx-alert__t'),
  AlertDescription: TextLike('p', 'gx-alert__d'),
  Heading,
  H1: (p: P) => <Heading {...p} level={1} />,
  H2: (p: P) => <Heading {...p} level={2} />,
  H3: (p: P) => <Heading {...p} level={3} />,
  H4: (p: P) => <Heading {...p} level={4} />,
  Text: TextLike('p', 'gx-text'),
  P: TextLike('p', 'gx-text'),
  Lead: TextLike('p', 'gx-lead'),
  Large: TextLike('p', 'gx-large'),
  Small: TextLike('small', 'gx-small'),
  Muted: TextLike('p', 'gx-muted'),
  Span: TextLike('span', 'gx-span'),
  BlockQuote: TextLike('blockquote', 'gx-quote'),
  Badge,
  Button,
  ButtonGroup: Box('div', 'gx-row gx-btngroup'),
  Icon,
  Metric,
  Progress,
  Ring,
  Separator,
  Loader,
  Dot,
  Kbd,
  Code,
  Image,
  Link: LinkC,
  Markdown,
  Mermaid: ({ chart }: P) => <pre className="gx-code">{txt(chart)}</pre>,
  Slider,
  Input,
  Textarea,
  Switch,
  Checkbox,
  Select,
  Combobox: Select,
  RadioGroup,
  Tabs: TabsC,
  Pages: TabsC,
  Tab: Panel,
  Page: Panel,
  Accordion: Box('div', 'gx-accordion'),
  AccordionItem,
  Carousel: Box('div', 'gx-carousel'),
  ChoiceCard,
  Tooltip: TooltipC,
  HoverCard: TooltipC,
  Popover: Box('div', 'gx-div'),
  Dialog: Box('div', 'gx-card'),
  Condition,
  Case,
  ForEach: ForEachC,
  Slot: Fallback,
  DataTable,
  Table: ({ children }: P) => <div className="gx-tablewrap"><table className="gx-table">{children}</table></div>,
  TableHeader: ({ children }: P) => <thead>{children}</thead>,
  TableBody: ({ children }: P) => <tbody>{children}</tbody>,
  TableFooter: ({ children }: P) => <tfoot>{children}</tfoot>,
  TableRow: ({ children }: P) => <tr>{children}</tr>,
  TableHead: ({ content, children }: P) => { const t = useT(); return <th>{txt(t(content)) || children}</th>; },
  TableCell: ({ content, children }: P) => { const t = useT(); return <td>{content !== undefined ? inlineMd(txt(t(content))) : children}</td>; },
  TableCaption: TextLike('caption', 'gx-muted'),
  BarChart: ChartC('bar'),
  LineChart: ChartC('line'),
  AreaChart: ChartC('area'),
  PieChart,
  Histogram: ChartC('bar'),
  Fallback,
};

/* ───────── Prefab view → JSX string ───────── */
type Node = Record<string, unknown> & { type?: string; children?: Node[] };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
const SKIP_KEYS = new Set(['type', 'children', 'let']);

function attrs(node: Node): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(node)) {
    if (SKIP_KEYS.has(k) || v === undefined || v === null) continue;
    const name = k === 'else' ? 'otherwise' : k;
    if (typeof v === 'string') out.push(`${name}="${esc(v)}"`);
    else out.push(`${name}="${esc(JSON.stringify(v))}"`);
  }
  return out.length ? ' ' + out.join(' ') : '';
}

export function prefabToJsx(node: unknown, depth = 0): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Node;
  let type = typeof n.type === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(n.type) ? n.type : 'Fallback';
  if (!GEN_COMPONENTS[type]) type = 'Fallback';
  const kids = Array.isArray(n.children) ? n.children : [];

  // Option containers: lift their option children into a JSON prop.
  if (type === 'Select' || type === 'Combobox' || type === 'RadioGroup') {
    const opts: { value: string; label: string }[] = [];
    const walk = (c: Node) => {
      if (c.type === 'SelectOption' || c.type === 'ComboboxOption' || c.type === 'Radio') opts.push({ value: String(c.value ?? ''), label: String(c.label ?? c.option ?? c.value ?? '') });
      (c.children || []).forEach(walk);
    };
    kids.forEach(walk);
    const { children: _c, ...rest } = n;
    return `<${type}${attrs(rest as Node)} options="${esc(JSON.stringify(opts))}" />`;
  }
  // Condition: each case's children become <Case> blocks, followed by the else block.
  if (n.type === 'Condition') {
    const cases = (n.cases as { when: string; children?: Node[] }[]) || [];
    const elseKids = (n.else as Node[]) || [];
    const caseJsx = cases.map((c) => `<Case>${(c.children || []).map((k) => prefabToJsx(k, depth + 1)).join('')}</Case>`).join('');
    const elseJsx = elseKids.length ? `<Case>${elseKids.map((k) => prefabToJsx(k, depth + 1)).join('')}</Case>` : '';
    return `<Condition cases="${esc(JSON.stringify(cases.map((c) => ({ when: c.when }))))}"${elseKids.length ? ' otherwise="1"' : ''}>${caseJsx}${elseJsx}</Condition>`;
  }
  const inner = kids.map((k) => prefabToJsx(k, depth + 1)).join('');
  if (n.type === 'ForEach') return `<ForEach items="${esc(String(n.key ?? ''))}">${inner}</ForEach>`;
  return inner ? `<${type}${attrs(n)}>${inner}</${type}>` : `<${type}${attrs(n)} />`;
}

/** Pull a Prefab envelope out of an MCP call output (string or object), if there is one. */
export function extractPrefab(output: unknown): { view: unknown; state: State } | null {
  const tryObj = (o: unknown): { view: unknown; state: State } | null => {
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    if (r.view && typeof r.view === 'object') return { view: r.view, state: (r.state as State) || {} };
    if (r.structuredContent) return tryObj(r.structuredContent);
    if (Array.isArray(r.content)) {
      for (const c of r.content) {
        const t = (c as { text?: unknown }).text;
        if (typeof t === 'string') {
          const got = tryStr(t);
          if (got) return got;
        }
      }
    }
    return null;
  };
  const tryStr = (s: string) => {
    try {
      return tryObj(JSON.parse(s));
    } catch {
      return null;
    }
  };
  return typeof output === 'string' ? tryStr(output) : tryObj(output);
}

/* ───────── Surface ───────── */
export function GenerativeUI({
  jsx,
  initialState,
  streaming,
  onSendMessage,
}: {
  jsx: string;
  initialState?: State;
  streaming?: boolean;
  onSendMessage: (m: string) => void;
}) {
  const [state, setState] = useState<State>(() => ({ ...(initialState || {}) }));
  const set = useCallback((k: string, v: unknown) => setState((s) => ({ ...s, [k]: v })), []);
  const store = useMemo(() => ({ state, set, send: onSendMessage }), [state, set, onSendMessage]);
  return (
    <StoreCtx.Provider value={store}>
      <JSXPreview jsx={jsx} isStreaming={streaming} components={GEN_COMPONENTS as never} className="sc-genui">
        <JSXPreviewContent />
        <JSXPreviewError />
      </JSXPreview>
    </StoreCtx.Provider>
  );
}
