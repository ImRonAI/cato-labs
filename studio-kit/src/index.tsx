import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '../vendor/ai-elements/conversation';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '../vendor/ai-elements/message';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from '../vendor/ai-elements/chain-of-thought';
import { CheckIcon, CopyIcon, GlobeIcon, RefreshCcwIcon } from 'lucide-react';
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from '../vendor/ai-elements/task';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '../vendor/ai-elements/tool';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '../vendor/ai-elements/prompt-input';
import { GenerativeUI, extractPrefab, prefabToJsx } from './genui';

interface ConciergeSection {
  id: string;
  label?: string;
  title?: string;
}

interface ConciergeContextData {
  brand?: string;
  concierge?: string;
  intro?: string;
  sections?: ConciergeSection[];
  suggestions?: string[];
  facts?: string;
  tone?: string;
  locations?: { name: string; lat: number; lon: number; tz?: string }[];
}

interface GreetingState {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  text: string;
  responseId: string | null;
}

const GREETING_TTL = 30 * 60 * 1000;

function greetingKey(brand: string) {
  return `studio-concierge:greeting:${brand}`;
}

function readCachedGreeting(brand: string): (GreetingState & { dismissed?: boolean }) | null {
  try {
    const raw = sessionStorage.getItem(greetingKey(brand));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; text: string; responseId: string | null; dismissed?: boolean };
    if (!parsed || typeof parsed.text !== 'string' || Date.now() - parsed.at > GREETING_TTL) return null;
    return { status: 'ready', text: parsed.text, responseId: parsed.responseId ?? null, dismissed: parsed.dismissed };
  } catch {
    return null;
  }
}

function writeCachedGreeting(brand: string, g: { text: string; responseId: string | null; dismissed?: boolean }) {
  try {
    sessionStorage.setItem(greetingKey(brand), JSON.stringify({ at: Date.now(), ...g }));
  } catch {
    /* storage unavailable */
  }
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useTypewriter(text: string, active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.round(text.length / 90));
      setCount(Math.min(text.length, i));
      if (i >= text.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [text, active]);
  return text.slice(0, count);
}

function Orb({ size = 28, live = false }: { size?: number; live?: boolean }) {
  return (
    <span className={`sc-orb${live ? ' is-live' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="sc-orb__core" />
      <span className="sc-orb__ring" />
    </span>
  );
}

function TypingDots() {
  return (
    <span className="sc-typing" role="status" aria-label="Typing">
      <i />
      <i />
      <i />
    </span>
  );
}

interface ToolCallEntry {
  id: string;
  name: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  genui?: { status: 'loading' | 'ready' | 'error'; jsx: string; state: Record<string, unknown>; error?: string };
}

interface SourceEntry {
  url: string;
  title: string;
}

interface ActivityEntry {
  id: string;
  kind: 'search' | 'fetch' | 'sandbox' | 'finance' | 'people' | 'skill';
  label: string;
  detail: string;
  done: boolean;
}

async function renderPrefab(args: Record<string, unknown>) {
  const res = await fetch('/api/mcp-app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'call', name: 'generate_prefab_ui', arguments: args }),
  });
  const data: unknown = await res.json();
  const env = extractPrefab(data);
  if (!env) {
    const msg = (data as { error?: unknown })?.error;
    throw new Error(typeof msg === 'string' ? msg : 'The interface could not be rendered.');
  }
  return { jsx: prefabToJsx(env.view), state: env.state };
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning: string;
  tasks: string[];
  tools: ToolCallEntry[];
  jsxBlock: string;
  activity: ActivityEntry[];
  sources: SourceEntry[];
  streaming: boolean;
  greeting?: boolean;
}

function readConciergeContext(): ConciergeContextData {
  try {
    const el = document.getElementById('concierge-context');
    if (!el || !el.textContent) return {};
    const parsed: unknown = JSON.parse(el.textContent);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ConciergeContextData)
      : {};
  } catch {
    return {};
  }
}

function extractJsxFence(raw: string): { cleanText: string; jsx: string } {
  const match = /```jsx\s*([\s\S]*?)(?:```|$)/i.exec(raw);
  if (!match) return { cleanText: raw, jsx: '' };
  const jsx = match[1].trim();
  const cleanText = (raw.slice(0, match.index) + raw.slice(match.index + match[0].length)).trim();
  return { cleanText, jsx };
}

class TurnErrorBoundary extends React.Component<
  { fallbackText: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallbackText: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ whiteSpace: 'pre-wrap' }}>{this.props.fallbackText}</div>;
    }
    return this.props.children;
  }
}

function StudioConciergeApp({ hideLauncher }: { hideLauncher: boolean }) {
  const ctx = useMemo(() => readConciergeContext(), []);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
  const [copied, setCopied] = useState<string | null>(null);
  const responseIdRef = useRef<string | null>(null);
  const greetingIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [greeting, setGreeting] = useState<GreetingState>({ status: 'idle', text: '', responseId: null });
  const [nudge, setNudge] = useState(false);
  const [unread, setUnread] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const brand = ctx.brand || document.title.split(/[—·|-]/)[0]?.trim() || 'Studio';
  const title = ctx.concierge || `${brand} Concierge`;
  const intro =
    ctx.intro || `Ask a question about ${brand}, request a specification, or explore the page.`;
  const suggestions = Array.isArray(ctx.suggestions) ? ctx.suggestions : [];

  const sendMessage = useCallback(
    async (rawInput: string) => {
      const text = rawInput.trim();
      if (!text || streaming) return;

      const userTurn: ChatTurn = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        reasoning: '',
        tasks: [],
        tools: [],
        jsxBlock: '',
        activity: [],
        sources: [],
        streaming: false,
      };
      const assistantId = `a-${Date.now() + 1}`;
      const assistantTurn: ChatTurn = {
        id: assistantId,
        role: 'assistant',
        text: '',
        reasoning: '',
        tasks: [],
        tools: [],
        jsxBlock: '',
        activity: [],
        sources: [],
        streaming: true,
      };

      setTurns((prev) => [...prev, userTurn, assistantTurn]);
      setStreaming(true);
      setStatus('submitted');
      setNudge(false);
      setUnread(false);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (mutator: (draft: ChatTurn) => void) => {
        setTurns((prev) =>
          prev.map((t) => {
            if (t.id !== assistantId) return t;
            const copy: ChatTurn = {
              ...t,
              tasks: [...t.tasks],
              tools: t.tools.map((tl) => ({ ...tl })),
              activity: t.activity.map((a) => ({ ...a })),
              sources: [...t.sources],
            };
            mutator(copy);
            return copy;
          })
        );
      };

      try {
        const post = (prev: string | null) =>
          fetch('/api/studio-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: text,
              ...(prev ? { previous_response_id: prev } : {}),
              context: ctx,
              page: location.pathname,
            }),
            signal: controller.signal,
          });
        let res = await post(responseIdRef.current);
        if (!res.ok && responseIdRef.current && responseIdRef.current === greetingIdRef.current) {
          // The greeting run could not be continued; start the thread fresh.
          responseIdRef.current = null;
          greetingIdRef.current = null;
          res = await post(null);
        }

        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const argBuffers = new Map<string, string>();

        const handleEvent = (evt: Record<string, unknown>) => {
          const type = typeof evt.type === 'string' ? evt.type : '';
          if (
            evt.response &&
            typeof evt.response === 'object' &&
            typeof (evt.response as Record<string, unknown>).id === 'string'
          ) {
            responseIdRef.current = (evt.response as Record<string, unknown>).id as string;
          }

          if (
            (type === 'response.reasoning.delta' ||
              type === 'response.reasoning_text.delta' ||
              type === 'response.reasoning_summary_text.delta') &&
            typeof evt.delta === 'string'
          ) {
            patchAssistant((d) => {
              d.reasoning += evt.delta as string;
            });
            return;
          }

          if (type === 'response.output_text.delta' && typeof evt.delta === 'string') {
            setStatus('streaming');
            patchAssistant((d) => {
              const combined = d.text + (evt.delta as string);
              const { cleanText, jsx } = extractJsxFence(combined);
              d.text = cleanText;
              if (jsx) d.jsxBlock = jsx;
            });
            return;
          }

          // Native Agent API tools: show what the agent is doing, live.
          const act = (kind: ActivityEntry['kind'], label: string, detail: string, done: boolean, id?: string) =>
            patchAssistant((d) => {
              const key = id || `${kind}-${label}`;
              const hit = d.activity.find((a) => a.id === key);
              if (hit) {
                hit.detail = detail || hit.detail;
                hit.done = hit.done || done;
              } else d.activity.push({ id: key, kind, label, detail, done });
            });
          const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : (x as { query?: string; url?: string; title?: string })?.query || (x as { url?: string })?.url || (x as { title?: string })?.title || '')).filter(Boolean).join(' · ') : '');
          if (type === 'response.reasoning.search_queries') { act('search', 'Searching the web', list(evt.queries), false, 'search'); return; }
          if (type === 'response.reasoning.search_results') {
            const results = Array.isArray(evt.results) ? (evt.results as { url?: string; title?: string }[]) : [];
            act('search', 'Searching the web', `${results.length} sources`, true, 'search');
            patchAssistant((d) => {
              for (const r of results) if (r?.url && !d.sources.some((x) => x.url === r.url)) d.sources.push({ url: r.url, title: r.title || r.url });
            });
            return;
          }
          if (type === 'response.reasoning.fetch_url_queries') { act('fetch', 'Reading pages', list(evt.urls ?? evt.queries), false, 'fetch'); return; }
          if (type === 'response.reasoning.fetch_url_results') { act('fetch', 'Reading pages', list(evt.contents ?? evt.results) || 'Read', true, 'fetch'); return; }
          if (type === 'response.reasoning.finance_search_queries') { act('finance', 'Checking market data', list(evt.tickers) || 'Quotes', false, 'finance'); return; }
          if (type === 'response.reasoning.finance_search_results') { act('finance', 'Checking market data', 'Done', true, 'finance'); return; }
          if (type === 'response.reasoning.people_search_queries') { act('people', 'Looking up people', list(evt.queries), false, 'people'); return; }
          if (type === 'response.reasoning.people_search_results') { act('people', 'Looking up people', 'Done', true, 'people'); return; }
          if (type === 'response.sandbox.created') return;
          if (type === 'response.sandbox.results') {
            const res = Array.isArray(evt.results) ? (evt.results[0] as { stdout?: string; exit_code?: number }) : undefined;
            const stdout = res?.stdout || '';
            const code = typeof evt.code === 'string' ? evt.code : '';
            const viaSdk = /pplx_sdk\.(search|content|people)/.test(code);
            const kind: ActivityEntry['kind'] = /search\.people/.test(code) ? 'people' : /content\.fetch/.test(code) ? 'fetch' : /search\.web/.test(code) ? 'search' : 'sandbox';
            const label = kind === 'people' ? 'Looking up people' : kind === 'fetch' ? 'Reading pages' : kind === 'search' ? 'Searching the web' : 'Running a calculation';
            // Searches the model runs through the sandbox SDK surface their URLs in stdout.
            const found: SourceEntry[] = [];
            for (const m of stdout.matchAll(/url='(https?:[^']+)'(?:, title='([^']*)')?/g)) found.push({ url: m[1], title: m[2] || m[1] });
            for (const m of stdout.matchAll(/^(https?:\/\/\S+)\s+None$/gm)) found.push({ url: m[1], title: m[1] });
            if (found.length) patchAssistant((d) => { for (const f of found) if (!d.sources.some((x) => x.url === f.url)) d.sources.push(f); });
            const last = stdout.trim().split('\n').slice(-1)[0] || '';
            const detail = viaSdk ? (found.length ? `${found.length} source${found.length > 1 ? 's' : ''}` : 'Done') : last ? `→ ${last}` : res?.exit_code ? 'Failed' : 'Done';
            act(kind, label, detail, true, typeof evt.call_id === 'string' ? evt.call_id : kind);
            return;
          }

          if (type === 'response.output_item.added' && evt.item && typeof evt.item === 'object') {
            const item = evt.item as Record<string, unknown>;
            const itemType = typeof item.type === 'string' ? item.type : '';
            const itemId = typeof item.id === 'string' ? item.id : `item-${Date.now()}`;
            if (itemType === 'search_results') act('search', 'Searching the web', '', false, 'search');
            else if (itemType === 'fetch_url_results') act('fetch', 'Reading pages', '', false, 'fetch');
            else if (itemType === 'finance_results') act('finance', 'Checking market data', '', false, 'finance');
            else if (itemType === 'people_search_results') act('people', 'Looking up people', '', false, 'people');
            else if (itemType === 'mcp_call' || itemType === 'function_call') {
              const name =
                typeof item.name === 'string'
                  ? item.name
                  : typeof item.tool_name === 'string'
                    ? item.tool_name
                    : 'tool';
              patchAssistant((d) => {
                if (!d.tools.some((tl) => tl.id === itemId)) {
                  d.tools.push({
                    id: itemId,
                    name,
                    state: 'input-streaming',
                    input: {},
                  });
                }
              });
            }
            return;
          }

          if (
            (type === 'response.mcp_call_arguments.delta' ||
              type === 'response.function_call_arguments.delta') &&
            typeof evt.delta === 'string'
          ) {
            const itemId = typeof evt.item_id === 'string' ? evt.item_id : '';
            const nextRaw = (argBuffers.get(itemId) || '') + evt.delta;
            argBuffers.set(itemId, nextRaw);
            try {
              const parsed = JSON.parse(nextRaw);
              if (parsed && typeof parsed === 'object') {
                patchAssistant((d) => {
                  const tl = d.tools.find((x) => x.id === itemId);
                  if (tl) tl.input = parsed as Record<string, unknown>;
                });
              }
            } catch {
              /* partial JSON */
            }
            return;
          }

          if (type === 'response.output_item.done' && evt.item && typeof evt.item === 'object') {
            const item = evt.item as Record<string, unknown>;
            const itemType = typeof item.type === 'string' ? item.type : '';
            const itemId = typeof item.id === 'string' ? item.id : '';
            if (itemType === 'mcp_call' || itemType === 'function_call') {
              const name =
                typeof item.name === 'string'
                  ? item.name
                  : typeof item.tool_name === 'string'
                    ? item.tool_name
                    : 'tool';
              let parsedArgs: Record<string, unknown> = {};
              if (typeof item.arguments === 'string') {
                try {
                  parsedArgs = JSON.parse(item.arguments) as Record<string, unknown>;
                } catch {
                  parsedArgs = { raw: item.arguments };
                }
              } else if (item.arguments && typeof item.arguments === 'object') {
                parsedArgs = item.arguments as Record<string, unknown>;
              }
              const hasError = Boolean(item.error);
              const wantsUi = name === 'generate_prefab_ui' && typeof parsedArgs.code === 'string' && !hasError;
              const toolId = itemId || `tl-${Date.now()}`;
              if (wantsUi) {
                // The Agent API returns only a placeholder for MCP UI output, so replay the model's
                // exact Prefab code against the same MCP server and render the view tree we get back.
                const direct = extractPrefab(item.output);
                const apply = (g: ToolCallEntry['genui']) =>
                  patchAssistant((d) => {
                    const tl = d.tools.find((x) => x.id === toolId);
                    if (tl) tl.genui = g;
                  });
                if (direct) setTimeout(() => apply({ status: 'ready', jsx: prefabToJsx(direct.view), state: direct.state }), 0);
                else
                  renderPrefab(parsedArgs)
                    .then((r) => apply({ status: 'ready', jsx: r.jsx, state: r.state }))
                    .catch((e: unknown) => apply({ status: 'error', jsx: '', state: {}, error: e instanceof Error ? e.message : 'Render failed' }));
              }
              if (itemType === 'mcp_call' && item.error) {
                /* fall through: shown on the tool row */
              }

              patchAssistant((d) => {
                const existing = d.tools.find((x) => x.id === itemId);
                if (existing) {
                  existing.name = name;
                  existing.input = Object.keys(parsedArgs).length ? parsedArgs : existing.input;
                  existing.state = hasError ? 'output-error' : 'output-available';
                  existing.output = item.output ?? 'Completed';
                  existing.errorText = typeof item.error === 'string' ? item.error : undefined;
                  if (wantsUi && !existing.genui) existing.genui = { status: 'loading', jsx: '', state: {} };
                } else {
                  d.tools.push({
                    id: toolId,
                    name,
                    state: hasError ? 'output-error' : 'output-available',
                    input: parsedArgs,
                    output: item.output ?? 'Completed',
                    errorText: typeof item.error === 'string' ? item.error : undefined,
                    genui: wantsUi ? { status: 'loading', jsx: '', state: {} } : undefined,
                  });
                }
              });
            }
          }
        };

        for (;;) {
          const { value, done } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          let sep: RegExpExecArray | null;
          while ((sep = /\r?\n\r?\n/.exec(buffer))) {
            const block = buffer.slice(0, sep.index);
            buffer = buffer.slice(sep.index + sep[0].length);
            const dataLines = block
              .split(/\r?\n/)
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim());
            const payload = dataLines.join('\n');
            if (!payload || payload === '[DONE]') continue;
            try {
              handleEvent(JSON.parse(payload) as Record<string, unknown>);
            } catch {
              /* ignore malformed event */
            }
          }
          if (done) break;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setStatus('error');
          patchAssistant((d) => {
            if (!d.text) {
              d.text =
                err instanceof Error
                  ? `Unable to complete reply: ${err.message}`
                  : 'Unable to complete reply.';
            }
          });
        }
      } finally {
        patchAssistant((d) => {
          d.streaming = false;
        });
        setStreaming(false);
        setStatus((s) => (s === 'error' ? 'error' : 'ready'));
      }
    },
    [ctx, streaming]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus('ready');
    setTurns((prev) => prev.map((t) => (t.streaming ? { ...t, streaming: false } : t)));
  }, []);

  const regenerate = useCallback(
    (assistantId: string) => {
      const idx = turns.findIndex((t) => t.id === assistantId);
      const prompt = idx > 0 ? turns[idx - 1] : undefined;
      if (!prompt || prompt.role !== 'user' || streaming) return;
      setTurns((prev) => prev.slice(0, idx - 1));
      void sendMessage(prompt.text);
    },
    [turns, streaming, sendMessage]
  );

  const copyTurn = useCallback((t: ChatTurn) => {
    void navigator.clipboard?.writeText(t.text).then(() => {
      setCopied(t.id);
      setTimeout(() => setCopied((c) => (c === t.id ? null : c)), 1600);
    });
  }, []);

  const applyGreeting = useCallback((text: string, responseId: string | null) => {
    setGreeting({ status: 'ready', text, responseId });
    if (responseId && !responseIdRef.current) {
      responseIdRef.current = responseId;
      greetingIdRef.current = responseId;
    }
    setTurns((prev) =>
      prev.some((t) => t.greeting || t.role === 'user')
        ? prev
        : [
            {
              id: 'greeting',
              role: 'assistant',
              text,
              reasoning: '',
              tasks: [],
              tools: [],
              jsxBlock: '',
              activity: [],
              sources: [],
              streaming: false,
              greeting: true,
            },
            ...prev,
          ]
    );
  }, []);

  useEffect(() => {
    const cached = readCachedGreeting(brand);
    if (cached) {
      applyGreeting(cached.text, cached.responseId);
      if (!cached.dismissed) {
        const t = window.setTimeout(() => {
          if (!openRef.current) {
            setNudge(true);
            setUnread(true);
          }
        }, 2600);
        return () => window.clearTimeout(t);
      }
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const showTimer = window.setTimeout(() => {
      if (cancelled || openRef.current) return;
      setGreeting((g) => (g.status === 'idle' ? { ...g, status: 'loading' } : g));
      setNudge(true);
    }, 2400);
    const fetchTimer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/studio-greeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: ctx }),
          signal: controller.signal,
        });
        const data = (await res.json()) as { text?: unknown; responseId?: unknown };
        if (cancelled) return;
        const text = typeof data.text === 'string' ? data.text.trim() : '';
        if (!text) throw new Error('empty');
        const id = typeof data.responseId === 'string' ? data.responseId : null;
        applyGreeting(text, id);
        writeCachedGreeting(brand, { text, responseId: id });
        if (!openRef.current) setUnread(true);
      } catch {
        if (!cancelled) {
          setGreeting({ status: 'failed', text: '', responseId: null });
          setNudge(false);
        }
      }
    }, 900);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(showTimer);
      window.clearTimeout(fetchTimer);
    };
  }, [applyGreeting, brand, ctx]);

  const dismissNudge = useCallback(() => {
    setNudge(false);
    if (greeting.status === 'ready') {
      writeCachedGreeting(brand, { text: greeting.text, responseId: greeting.responseId, dismissed: true });
    }
  }, [brand, greeting]);

  const openPanel = useCallback(() => {
    setOpen(true);
    setNudge(false);
    setUnread(false);
    if (greeting.status === 'ready') {
      writeCachedGreeting(brand, { text: greeting.text, responseId: greeting.responseId, dismissed: true });
    }
  }, [brand, greeting]);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    responseIdRef.current = greetingIdRef.current;
    setTurns((prev) => prev.filter((t) => t.greeting));
    setStreaming(false);
  }, []);

  useEffect(() => {
    if (open) {
      setNudge(false);
      setUnread(false);
    }
  }, [open]);

  const typed = useTypewriter(greeting.text, nudge && greeting.status === 'ready');
  const hasUserTurn = turns.some((t) => t.role === 'user');

  useEffect(() => {
    const api = {
      open: (prompt?: string) => {
        setOpen(true);
        if (prompt && prompt.trim()) {
          void sendMessage(prompt);
        }
      },
      close: () => setOpen(false),
    };
    (window as unknown as { StudioConcierge?: typeof api }).StudioConcierge = api;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;

      const trigger = target.closest('[data-concierge-open]');
      if (trigger) {
        e.preventDefault();
        const prompt = trigger.getAttribute('data-concierge-prompt') || '';
        setOpen(true);
        if (prompt.trim()) {
          void sendMessage(prompt);
        }
        return;
      }

      const hashLink = target.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (hashLink && !e.defaultPrevented) {
        const hash = hashLink.getAttribute('href');
        if (!hash || hash === '#') return;
        if (hash.startsWith('#/')) {
          if (window.location.hash !== hash) {
            window.location.hash = hash;
          } else {
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }
          return;
        }
        const lenis = (window as unknown as { __studioLenis?: { scrollTo: (t: unknown, o?: unknown) => void; isStopped?: boolean } }).__studioLenis;
        if (hash === '#top') {
          e.preventDefault();
          if (lenis && !lenis.isStopped) lenis.scrollTo(0, { duration: 1.6 });
          else window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const id = hash.slice(1);
        const dest = document.getElementById(id);
        if (dest) {
          e.preventDefault();
          if (lenis && !lenis.isStopped) lenis.scrollTo(dest, { offset: -8, duration: 1.6 });
          else dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, sendMessage]);

  const renderTurn = (turn: ChatTurn) => (
    <Message key={turn.id} from={turn.role} className={`sc-message${turn.greeting ? ' is-greeting' : ''}`}>
      {turn.role === 'assistant' && (
        <div className="sc-message__meta">
          <Orb size={18} live={turn.streaming} />
          <span>{turn.greeting ? `${title} · just now` : title}</span>
        </div>
      )}
      <MessageContent className="sc-message__content">
        <TurnErrorBoundary fallbackText={turn.text}>
          {turn.role === 'assistant' && turn.reasoning && (
            <ChainOfThought defaultOpen={false} className="sc-cot">
              <ChainOfThoughtHeader>Reasoning</ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                <ChainOfThoughtStep label="Analysis" status={turn.streaming ? 'active' : 'complete'}>
                  <MessageResponse isAnimating={turn.streaming}>{turn.reasoning}</MessageResponse>
                </ChainOfThoughtStep>
              </ChainOfThoughtContent>
            </ChainOfThought>
          )}

          {turn.role === 'assistant' && turn.activity.length > 0 && (
            <Task defaultOpen={false} className="sc-task">
              <TaskTrigger
                title={
                  turn.activity.every((a) => a.done) || !turn.streaming
                    ? `Used ${turn.activity.length} tool${turn.activity.length > 1 ? 's' : ''}`
                    : turn.activity.filter((a) => !a.done).slice(-1)[0]?.label || turn.activity.slice(-1)[0].label
                }
              />
              <TaskContent>
                {turn.activity.map((a) => (
                  <TaskItem key={a.id}>
                    <span className={`sc-act is-${a.kind}${a.done ? ' is-done' : ''}`}>
                      <b>{a.label}</b>
                      {a.detail ? <span> · {a.detail}</span> : null}
                    </span>
                  </TaskItem>
                ))}
              </TaskContent>
            </Task>
          )}

          {turn.role === 'assistant' &&
            turn.tools
              .filter((tl) => tl.name !== 'search_prefab_components' || !turn.tools.some((x) => x.genui))
              .map((tl) => (
                <div key={tl.id} className="sc-tool-wrap">
                  {tl.genui ? (
                    tl.genui.status === 'ready' ? (
                      <div className="sc-genui-wrap">
                        <GenerativeUI jsx={tl.genui.jsx} initialState={tl.genui.state} onSendMessage={(msg) => void sendMessage(msg)} />
                      </div>
                    ) : tl.genui.status === 'loading' ? (
                      <div className="sc-genui-wrap is-loading" aria-label="Building an interactive view">
                        <span className="sc-genui-skel" />
                        <span className="sc-genui-skel" />
                        <span className="sc-genui-skel short" />
                      </div>
                    ) : (
                      <div className="sc-genui-wrap is-error">The interactive view could not be rendered: {tl.genui.error}</div>
                    )
                  ) : (
                    <Tool defaultOpen={false}>
                      <ToolHeader type="dynamic-tool" toolName={tl.name} state={tl.state} />
                      <ToolContent>
                        <ToolInput input={tl.input} />
                        <ToolOutput output={tl.output} errorText={tl.errorText} />
                      </ToolContent>
                    </Tool>
                  )}
                </div>
              ))}

          {turn.role === 'assistant' && turn.jsxBlock && (
            <div className="sc-genui-wrap">
              <GenerativeUI jsx={turn.jsxBlock} streaming={turn.streaming} onSendMessage={(msg) => void sendMessage(msg)} />
            </div>
          )}

          {turn.text ? (
            turn.role === 'user' ? (
              <div className="sc-user-text">{turn.text}</div>
            ) : (
              <MessageResponse isAnimating={turn.streaming}>{turn.text}</MessageResponse>
            )
          ) : turn.streaming ? (
            <TypingDots />
          ) : null}

          {turn.role === 'assistant' && turn.sources.length > 0 && !turn.streaming && (
            <ChainOfThoughtSearchResults className="sc-sources">
              {turn.sources
              .filter((src, i, all) => {
                const host = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };
                return all.findIndex((o) => host(o.url) === host(src.url)) === i;
              })
              .map((src) => {
                let host = src.url;
                try {
                  host = new URL(src.url).hostname.replace(/^www\./, '');
                } catch {
                  /* keep raw */
                }
                return (
                  <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" title={src.title}>
                    <ChainOfThoughtSearchResult>
                      <GlobeIcon className="size-3" />
                      {host}
                    </ChainOfThoughtSearchResult>
                  </a>
                );
              })}
            </ChainOfThoughtSearchResults>
          )}
        </TurnErrorBoundary>
      </MessageContent>
      {turn.role === 'assistant' && !turn.streaming && turn.text && (
        <MessageActions className="sc-actions">
          <MessageAction label="Copy" tooltip={copied === turn.id ? 'Copied' : 'Copy'} onClick={() => copyTurn(turn)}>
            {copied === turn.id ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </MessageAction>
          {!turn.greeting && (
            <MessageAction label="Retry" tooltip="Retry" onClick={() => regenerate(turn.id)}>
              <RefreshCcwIcon className="size-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      )}
    </Message>
  );

  const launcherVisible = !hideLauncher && !open;
  const nudgeVisible = nudge && !open && (greeting.status === 'loading' || greeting.status === 'ready');

  return (
    <div className="sc-shell" data-open={open ? 'true' : 'false'} data-launcher={hideLauncher ? 'off' : 'on'}>
      {nudgeVisible && (
        <div className="sc-nudge" role="status" aria-live="polite">
          <button type="button" className="sc-nudge__x" onClick={dismissNudge} aria-label="Dismiss message">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
          <button type="button" className="sc-nudge__body" onClick={openPanel}>
            <span className="sc-nudge__head">
              <Orb size={22} live />
              <span className="sc-nudge__name">{title}</span>
              <span className="sc-nudge__live">online</span>
            </span>
            <span className="sc-nudge__text">
              {greeting.status === 'ready' ? (
                <>
                  {typed}
                  {typed.length < greeting.text.length && <span className="sc-caret" aria-hidden="true" />}
                </>
              ) : (
                <TypingDots />
              )}
            </span>
            {greeting.status === 'ready' && <span className="sc-nudge__cta">Reply</span>}
          </button>
        </div>
      )}

      {launcherVisible && (
        <button type="button" className="sc-launcher" onClick={openPanel} aria-label={`Open ${title}`}>
          <Orb size={26} live={unread} />
          <span className="sc-launcher__label">{title}</span>
          {unread && <span className="sc-launcher__badge" aria-label="1 new message">1</span>}
        </button>
      )}

      <div className="sc-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />

      <aside className="sc-panel" role="dialog" aria-modal="false" aria-label={title} aria-hidden={!open} data-lenis-prevent>
        <div className="sc-panel__glow" aria-hidden="true" />
        <header className="sc-header">
          <Orb size={38} live={streaming} />
          <div className="sc-header__titles">
            <span className="sc-header__eyebrow">{brand}</span>
            <h2 className="sc-header__title">{title}</h2>
            <span className="sc-header__status">
              <i aria-hidden="true" />
              {streaming ? 'Composing a reply' : 'Online · replies in seconds'}
            </span>
          </div>
          <div className="sc-header__actions">
            {hasUserTurn && (
              <button type="button" className="sc-icon-btn" onClick={resetChat} aria-label="Start a new conversation" title="New conversation">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                  <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V5H5" />
                </svg>
              </button>
            )}
            <button type="button" className="sc-icon-btn" onClick={() => setOpen(false)} aria-label="Close concierge" title="Close">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </header>

        <Conversation className="sc-conversation">
          <ConversationContent className="sc-conversation__content">
            {turns.length === 0 && (
              <div className="sc-hello">
                <Orb size={56} live={greeting.status === 'loading'} />
                <p className="sc-hello__title">{title}</p>
                <p className="sc-hello__intro">{intro}</p>
              </div>
            )}
            {turns.map(renderTurn)}
            {!hasUserTurn && suggestions.length > 0 && (
              <div className="sc-suggestions">
                <span className="sc-suggestions__label">Start with</span>
                {suggestions.map((s, i) => (
                  <button key={i} type="button" className="sc-suggestion" style={{ ['--i' as string]: i }} onClick={() => void sendMessage(s)}>
                    <span>{s}</span>
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                      <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton className="sc-scroll-btn" />
        </Conversation>

        <div className="sc-footer">
          <PromptInput
            onSubmit={({ text }) => {
              if (text.trim()) void sendMessage(text);
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea placeholder={`Message ${title}…`} />
            </PromptInputBody>
            <PromptInputFooter>
              <span className="sc-footer__hint">
                <kbd>↵</kbd> send <kbd>⇧↵</kbd> new line
              </span>
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
          <p className="sc-footer__legal">AI concierge · answers may be imperfect · built by Cato Labs</p>
        </div>
      </aside>
    </div>
  );
}

function mountStudioConcierge() {
  try {
    const origReplace = history.replaceState.bind(history);
    const origPush = history.pushState.bind(history);
    history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
      try {
        origReplace(data, unused, url);
      } catch {
        if (typeof url === 'string' && url.startsWith('#')) {
          window.location.hash = url;
        }
      }
    };
    history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
      try {
        origPush(data, unused, url);
      } catch {
        if (typeof url === 'string' && url.startsWith('#')) {
          window.location.hash = url;
        }
      }
    };
  } catch {
    /* ignore */
  }
  const rootEl = document.getElementById('concierge-root');
  if (!rootEl || rootEl.dataset.conciergeMounted === 'true') return;
  rootEl.dataset.conciergeMounted = 'true';
  const scheme = getComputedStyle(rootEl).getPropertyValue('--concierge-scheme').trim() || getComputedStyle(document.documentElement).getPropertyValue('--concierge-scheme').trim();
  rootEl.dataset.scheme = scheme === 'light' ? 'light' : 'dark';
  const hideLauncher = rootEl.getAttribute('data-concierge-launcher') === 'off';
  const root = createRoot(rootEl);
  root.render(<StudioConciergeApp hideLauncher={hideLauncher} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountStudioConcierge, { once: true });
} else {
  mountStudioConcierge();
}
