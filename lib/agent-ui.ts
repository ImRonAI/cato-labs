/**
 * agent-ui — the one event vocabulary both agents (the builder and every
 * site's concierge) speak to the browser, and the reducer that turns it into
 * the steps VibeCoder.tsx and ConciergeChat.tsx render directly with AI Elements
 * (Task → ChainOfThought → ChainOfThoughtStep / SearchResults / Image / Tool / Sandbox).
 */

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const SEARCH_LABEL: Record<'web' | 'people' | 'finance' | 'image', { active: string; done: string }> = {
  web: { active: 'Searching the web', done: 'Searched the web' },
  finance: { active: 'Pulling market data', done: 'Pulled market data' },
  people: { active: 'Searching people', done: 'Searched people' },
  image: { active: 'Searching images', done: 'Searched images' },
};

export const EDIT_VERB: Record<'read' | 'write' | 'edit' | 'patch' | 'glob' | 'grep', string> = {
  read: 'Read',
  write: 'Wrote',
  edit: 'Edited',
  patch: 'Patched',
  glob: 'Matched',
  grep: 'Searched',
};

export const fileHref = (responseId: string, fileId: string) =>
  `/api/vibe-files?r=${encodeURIComponent(responseId)}&f=${encodeURIComponent(fileId)}`;

export interface Hit {
  title: string;
  url: string;
  snippet?: string;
}
export interface Img {
  imageUrl: string;
  originUrl: string;
  title: string;
}
export type SearchKind = 'web' | 'people' | 'finance' | 'image';
export type EditOp = 'read' | 'write' | 'edit' | 'patch' | 'glob' | 'grep';

export type UiEvent =
  | { t: 'thought'; text: string; delta?: boolean; done?: boolean }
  | { t: 'search'; kind: SearchKind; queries: string[]; thought?: string }
  | { t: 'hits'; kind: SearchKind; hits: Hit[]; images?: Img[]; queries?: string[]; thought?: string; fromSandbox?: boolean }
  | { t: 'fetch'; urls: string[]; thought?: string }
  | { t: 'fetched'; hits: Hit[]; urls?: string[]; thought?: string; fromSandbox?: boolean }
  | { t: 'code'; done: boolean; failed?: boolean; language?: string; code?: string; stdout?: string; stderr?: string }
  | { t: 'edit'; op: EditOp; paths: string[] }
  | { t: 'file'; responseId: string; fileId: string; filename: string; bytes?: number }
  | { t: 'skill'; name: string }
  | {
      t: 'mcp';
      server: string;
      tool: string;
      ok: boolean;
      done?: boolean;
      input?: Record<string, unknown>;
      output?: string;
      errorText?: string;
      fromSandbox?: boolean;
    }
  | { t: 'text'; delta: string };

export type Step =
  | { id: number; t: 'thought'; text: string; done?: boolean }
  | { id: number; t: 'search'; kind: SearchKind; queries: string[]; hits: Hit[]; images: Img[]; thought?: string; done: boolean }
  | { id: number; t: 'fetch'; urls: string[]; hits: Hit[]; thought?: string; done: boolean }
  | { id: number; t: 'code'; done: boolean; failed: boolean; language: string; code: string; stdout: string; stderr: string }
  | { id: number; t: 'edit'; op: EditOp; paths: string[] }
  | { id: number; t: 'file'; responseId: string; fileId: string; filename: string; bytes?: number }
  | { id: number; t: 'skill'; name: string }
  | {
      id: number;
      t: 'mcp';
      server: string;
      tool: string;
      ok: boolean;
      done: boolean;
      input?: Record<string, unknown>;
      output?: string;
      errorText?: string;
    };

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

let seq = 0;

/** index of the newest step matching pred, or -1 */
function lastIndex(steps: Step[], pred: (s: Step) => boolean): number {
  for (let i = steps.length - 1; i >= 0; i--) if (pred(steps[i])) return i;
  return -1;
}

export function applyUi(steps: Step[], ev: UiEvent, cap = 120): Step[] {
  /* Close any active streaming thought step when a non-thought step begins */
  let baseSteps =
    ev.t !== 'thought' && ev.t !== 'text'
      ? steps.map((s) => (s.t === 'thought' && s.done === false ? { ...s, done: true } : s))
      : steps;

  /* If a reasoning.* tool event (search/hits/fetch/fetched) carries a `thought` string from the Agent API,
     record it as a Reasoning step before the tool step (unless the previous thought already has that exact text) */
  if (
    (ev.t === 'search' || ev.t === 'hits' || ev.t === 'fetch' || ev.t === 'fetched') &&
    typeof ev.thought === 'string' &&
    ev.thought.trim()
  ) {
    const trimmedThought = ev.thought.trim();
    const lastThoughtIdx = lastIndex(baseSteps, (s) => s.t === 'thought');
    const prevThoughtText =
      lastThoughtIdx >= 0 && baseSteps[lastThoughtIdx].t === 'thought'
        ? (baseSteps[lastThoughtIdx] as Extract<Step, { t: 'thought' }>).text.trim()
        : '';
    if (prevThoughtText !== trimmedThought) {
      baseSteps = [
        ...baseSteps.slice(-(cap - 1)),
        { id: ++seq, t: 'thought', text: ev.thought, done: true },
      ];
    }
  }

  const push = (s: DistributiveOmit<Step, 'id'>): Step[] => [
    ...baseSteps.slice(-(cap - 1)),
    { ...s, id: ++seq } as Step,
  ];
  const replace = (i: number, s: Step): Step[] => {
    const next = [...baseSteps];
    next[i] = s;
    return next;
  };

  switch (ev.t) {
    case 'text':
      return steps;
    case 'thought': {
      const last = baseSteps[baseSteps.length - 1];
      if (ev.delta) {
        if (last && last.t === 'thought' && last.done === false) {
          return replace(baseSteps.length - 1, {
            ...last,
            text: last.text + ev.text,
            done: ev.done ?? false,
          });
        }
        if (!ev.text.trim()) return baseSteps;
        return push({ t: 'thought', text: ev.text, done: ev.done ?? false });
      }
      if (last && last.t === 'thought' && last.done === false) {
        return replace(baseSteps.length - 1, {
          ...last,
          text: ev.text.trim() ? ev.text : last.text,
          done: ev.done ?? true,
        });
      }
      if (!ev.text.trim()) return baseSteps;
      if (last && last.t === 'thought' && last.text.trim() === ev.text.trim()) {
        return baseSteps;
      }
      return push({ t: 'thought', text: ev.text, done: ev.done ?? true });
    }
    case 'search': {
      const openIdx = lastIndex(baseSteps, (s) => s.t === 'search' && s.kind === ev.kind && !s.done);
      if (openIdx >= 0) {
        const existing = baseSteps[openIdx] as Extract<Step, { t: 'search' }>;
        if (!existing.queries.length && ev.queries.length) {
          return replace(openIdx, { ...existing, queries: ev.queries, thought: ev.thought ?? existing.thought });
        }
        if (existing.queries.join('|') === ev.queries.join('|')) {
          return baseSteps;
        }
      }
      return push({
        t: 'search',
        kind: ev.kind,
        queries: ev.queries,
        hits: [],
        images: [],
        thought: ev.thought,
        done: false,
      });
    }
    case 'hits': {
      const openIdx = lastIndex(baseSteps, (s) => s.t === 'search' && s.kind === ev.kind && !s.done);
      const targetIdx =
        openIdx >= 0
          ? openIdx
          : lastIndex(
              baseSteps,
              (s) =>
                s.t === 'search' &&
                s.kind === ev.kind &&
                s.done &&
                ((ev.kind === 'image' ? s.images.length === 0 : s.hits.length === 0) ||
                  (Boolean(ev.queries?.length) && s.queries.join('|') === (ev.queries ?? []).join('|')))
            );
      const s = targetIdx >= 0 ? baseSteps[targetIdx] : undefined;
      if (targetIdx >= 0 && s && s.t === 'search') {
        const mergedQueries = s.queries.length ? s.queries : (ev.queries ?? []);
        const mergedHits = ev.hits.length ? ev.hits : s.hits;
        const mergedImages = (ev.images && ev.images.length ? ev.images : s.images) ?? [];
        return replace(targetIdx, {
          ...s,
          queries: mergedQueries,
          hits: mergedHits,
          images: mergedImages,
          thought: ev.thought ?? s.thought,
          done: true,
        });
      }
      if (ev.fromSandbox) {
        const ci = lastIndex(baseSteps, (st) => st.t === 'code' && !st.done);
        if (ci >= 0) {
          return replace(ci, {
            id: baseSteps[ci].id,
            t: 'search',
            kind: ev.kind,
            queries: ev.queries ?? [],
            hits: ev.hits,
            images: ev.images ?? [],
            thought: ev.thought,
            done: true,
          });
        }
      }
      return push({
        t: 'search',
        kind: ev.kind,
        queries: ev.queries ?? [],
        hits: ev.hits,
        images: ev.images ?? [],
        thought: ev.thought,
        done: true,
      });
    }
    case 'fetch': {
      const openIdx = lastIndex(baseSteps, (s) => s.t === 'fetch' && !s.done);
      if (openIdx >= 0) {
        const existing = baseSteps[openIdx] as Extract<Step, { t: 'fetch' }>;
        if (!existing.urls.length && ev.urls.length) {
          return replace(openIdx, { ...existing, urls: ev.urls, thought: ev.thought ?? existing.thought });
        }
        if (existing.urls.join('|') === ev.urls.join('|')) {
          return baseSteps;
        }
      }
      return push({ t: 'fetch', urls: ev.urls, hits: [], thought: ev.thought, done: false });
    }
    case 'fetched': {
      const openIdx = lastIndex(baseSteps, (s) => s.t === 'fetch' && !s.done);
      const fallbackUrls = ev.urls?.length ? ev.urls : ev.hits.map((h) => h.url).filter(Boolean);
      const targetIdx =
        openIdx >= 0
          ? openIdx
          : lastIndex(
              baseSteps,
              (s) =>
                s.t === 'fetch' &&
                s.done &&
                (s.hits.length === 0 || (fallbackUrls.length > 0 && s.urls.join('|') === fallbackUrls.join('|')))
            );
      const s = targetIdx >= 0 ? baseSteps[targetIdx] : undefined;
      if (targetIdx >= 0 && s && s.t === 'fetch') {
        return replace(targetIdx, {
          ...s,
          urls: s.urls.length ? s.urls : fallbackUrls,
          hits: ev.hits.length ? ev.hits : s.hits,
          thought: ev.thought ?? s.thought,
          done: true,
        });
      }
      if (ev.fromSandbox) {
        const ci = lastIndex(baseSteps, (st) => st.t === 'code' && !st.done);
        if (ci >= 0) {
          return replace(ci, {
            id: baseSteps[ci].id,
            t: 'fetch',
            urls: fallbackUrls,
            hits: ev.hits,
            thought: ev.thought,
            done: true,
          });
        }
      }
      return push({ t: 'fetch', urls: fallbackUrls, hits: ev.hits, thought: ev.thought, done: true });
    }
    case 'mcp': {
      const done = ev.done ?? true;
      const filled = {
        t: 'mcp' as const,
        server: ev.server,
        tool: ev.tool,
        ok: ev.ok,
        done,
        input: ev.input,
        output: ev.output,
        errorText: ev.errorText,
      };
      if (done) {
        const i = lastIndex(baseSteps, (s) => s.t === 'mcp' && s.server === ev.server && s.tool === ev.tool && !s.done);
        if (i >= 0) return replace(i, { ...filled, id: baseSteps[i].id, input: filled.input ?? (baseSteps[i] as Extract<Step, { t: 'mcp' }>).input });
        if (ev.fromSandbox) {
          const ci = lastIndex(baseSteps, (st) => st.t === 'code' && !st.done);
          if (ci >= 0) return replace(ci, { ...filled, id: baseSteps[ci].id });
        }
      }
      return push(filled);
    }
    case 'code': {
      const filled = {
        t: 'code' as const,
        done: ev.done,
        failed: Boolean(ev.failed),
        language: ev.language ?? 'python',
        code: ev.code ?? '',
        stdout: ev.stdout ?? '',
        stderr: ev.stderr ?? '',
      };
      const i = ev.done ? lastIndex(baseSteps, (s) => s.t === 'code' && !s.done) : -1;
      return i >= 0 ? replace(i, { ...filled, id: baseSteps[i].id }) : push(filled);
    }
    default:
      return push(ev);
  }
}
