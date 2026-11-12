/**
 * The session: state, reducer, and the runner that plays the script in lib/content/studio.ts
 * on a Timeline. Files are written from the real oubliai.com source (source.ts).
 */

import {
  oubliBrief,
  oubliRundown,
  oubliSession,
  type SessionStep,
  type TermTone,
} from '@/lib/content/studio';
import type { PreparedSource } from './source';
import type { Timeline } from './timeline';

/* ---------------------------------------------------------------- state */

export interface WriteFile {
  path: string;
  lines: number;
  done: boolean;
}

export type Item =
  | { id: number; type: 'user'; text: string; brief: boolean }
  | { id: number; type: 'think'; text: string; done: boolean; secs: number }
  | { id: number; type: 'say'; text: string; done: boolean }
  | { id: number; type: 'plan'; items: readonly string[] }
  | { id: number; type: 'run'; command: string; result: string; done: boolean; secs: number }
  | { id: number; type: 'write'; title: string; files: WriteFile[]; done: boolean }
  | { id: number; type: 'final'; shown: number; done: boolean }
  | { id: number; type: 'offer'; mode: 'first' | 'later'; answer: 'yes' | 'no' | null };

export type Phase = 'idle' | 'running' | 'offer' | 'reveal' | 'site';

export interface TermEntry {
  tone: TermTone | 'cmd';
  text: string;
}

export interface SessionState {
  phase: Phase;
  composer: string;
  sending: boolean;
  items: Item[];
  /** plan items completed */
  plan: number;
  /** files in the project, in the order they appeared */
  tree: string[];
  /** lines written per file */
  written: Record<string, number>;
  editor: { path: string | null; chars: number; writing: boolean };
  tabs: string[];
  term: { entries: TermEntry[]; running: boolean };
  activity: string;
}

export const initialState: SessionState = {
  phase: 'idle',
  composer: '',
  sending: false,
  items: [],
  plan: 0,
  tree: [],
  written: {},
  editor: { path: null, chars: 0, writing: false },
  tabs: [],
  term: { entries: [], running: false },
  activity: 'Ready',
};

type ItemPatch = Partial<Omit<Item, 'id' | 'type'>> & Record<string, unknown>;

export type Action =
  | { type: 'reset' }
  | { type: 'phase'; phase: Phase }
  | { type: 'composer'; text: string }
  | { type: 'sending'; value: boolean }
  | { type: 'add'; item: Item }
  | { type: 'patch'; id: number; patch: ItemPatch }
  /** answers the most recent open "would you like to see it?" */
  | { type: 'answer'; answer: 'yes' | 'no' }
  | { type: 'plan'; done: number }
  | { type: 'tree'; paths: readonly string[] }
  | { type: 'written'; path: string; lines: number }
  | { type: 'editor'; path: string | null; chars: number; writing: boolean }
  | { type: 'editorChars'; chars: number }
  | { type: 'termCmd'; command: string }
  | { type: 'termLine'; tone: TermTone; text: string }
  | { type: 'termRunning'; value: boolean }
  | { type: 'activity'; text: string };

export function reducer(state: SessionState, a: Action): SessionState {
  switch (a.type) {
    case 'reset':
      return initialState;
    case 'phase':
      return { ...state, phase: a.phase };
    case 'composer':
      return state.composer === a.text ? state : { ...state, composer: a.text };
    case 'sending':
      return { ...state, sending: a.value };
    case 'add':
      return { ...state, items: [...state.items, a.item] };
    case 'patch':
      return {
        ...state,
        items: state.items.map((it) => (it.id === a.id ? ({ ...it, ...a.patch } as Item) : it)),
      };
    case 'answer': {
      const at = state.items.findLastIndex((it) => it.type === 'offer' && it.answer === null);
      if (at < 0) return state;
      const items = state.items.slice();
      items[at] = { ...(items[at] as Extract<Item, { type: 'offer' }>), answer: a.answer };
      return { ...state, items };
    }
    case 'plan':
      return { ...state, plan: a.done };
    case 'tree': {
      const add = a.paths.filter((p) => !state.tree.includes(p));
      return add.length ? { ...state, tree: [...state.tree, ...add] } : state;
    }
    case 'written':
      return { ...state, written: { ...state.written, [a.path]: a.lines } };
    case 'editor': {
      const tabs =
        a.path && !state.tabs.includes(a.path) ? [...state.tabs, a.path].slice(-4) : state.tabs;
      return { ...state, editor: { path: a.path, chars: a.chars, writing: a.writing }, tabs };
    }
    case 'editorChars':
      return state.editor.chars === a.chars ? state : { ...state, editor: { ...state.editor, chars: a.chars } };
    case 'termCmd':
      return {
        ...state,
        term: { ...state.term, entries: [...state.term.entries, { tone: 'cmd', text: a.command }] },
      };
    case 'termLine':
      return {
        ...state,
        term: { ...state.term, entries: [...state.term.entries, { tone: a.tone, text: a.text }] },
      };
    case 'termRunning':
      return { ...state, term: { ...state.term, running: a.value } };
    case 'activity':
      return state.activity === a.text ? state : { ...state, activity: a.text };
    default:
      return state;
  }
}

/* ---------------------------------------------------------------- the rundown as text */

export interface RundownCounts {
  files: number;
  lines: number;
}

export function fillCounts(text: string, c: RundownCounts): string {
  return text
    .replace('{files}', c.files.toLocaleString('en-US'))
    .replace('{lines}', c.lines.toLocaleString('en-US'));
}

/** The rundown's segments in reading order; the final message reveals them by character. */
export function rundownSegments(c: RundownCounts): { key: string; text: string }[] {
  const segs = [
    { key: 'headline', text: oubliRundown.headline },
    { key: 'intro', text: fillCounts(oubliRundown.intro, c) },
  ];
  oubliRundown.points.forEach((p, i) => {
    segs.push({ key: `pt${i}t`, text: p.title });
    segs.push({ key: `pt${i}b`, text: p.body });
  });
  segs.push({ key: 'stack', text: oubliRundown.stack.join(' · ') });
  segs.push({ key: 'question', text: oubliRundown.question });
  return segs;
}

/* ---------------------------------------------------------------- the runner */

const THINK_CPS = 118;
const SAY_CPS = 84;
const FINAL_CPS = 190;
/** Total active time spent writing files, shared by size (square root, so small files still read). */
const WRITE_BUDGET_MS = 40_000;
const WRITE_MIN_MS = 360;

export function writeDurations(src: PreparedSource): Map<string, number> {
  const paths = oubliSession.flatMap((s) => (s.kind === 'write' ? s.paths : []));
  const weights = paths.map((p) => Math.sqrt(src.files.get(p)?.chars ?? 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  return new Map(paths.map((p, i) => [p, Math.max(WRITE_MIN_MS, (WRITE_BUDGET_MS * weights[i]) / sum)]));
}

/** "npm install three …" → "npm install three" for the status line. */
function shortCommand(cmd: string): string {
  const words = cmd.split(' ');
  return words.slice(0, 3).join(' ') + (words.length > 3 ? ' …' : '');
}

/** Cuts the brief at a word boundary so the composer types in words, not letters. */
function wordCut(text: string, p: number): string {
  if (p >= 1) return text;
  const n = Math.floor(text.length * p);
  const space = text.lastIndexOf(' ', n);
  return text.slice(0, space > 0 ? space : n);
}

export interface RunContext {
  tl: Timeline;
  src: PreparedSource;
  dispatch: (a: Action) => void;
  nextId: () => number;
}

async function say({ tl, dispatch, nextId }: RunContext, text: string) {
  const id = nextId();
  dispatch({ type: 'add', item: { id, type: 'say', text: '', done: false } });
  const ms = (text.length / SAY_CPS) * 1000;
  await tl.tween(ms, (p) => dispatch({ type: 'patch', id, patch: { text: text.slice(0, Math.round(text.length * p)) } }));
  dispatch({ type: 'patch', id, patch: { done: true } });
  await tl.wait(380);
}

async function playStep(ctx: RunContext, step: SessionStep, durations: Map<string, number>) {
  const { tl, src, dispatch, nextId } = ctx;
  switch (step.kind) {
    case 'compose': {
      dispatch({ type: 'activity', text: 'Writing the brief' });
      await tl.wait(500);
      let last = '';
      await tl.tween(3600, (p) => {
        const next = wordCut(oubliBrief, p);
        if (next !== last) {
          last = next;
          dispatch({ type: 'composer', text: next });
        }
      });
      await tl.wait(520);
      dispatch({ type: 'sending', value: true });
      await tl.wait(300);
      dispatch({ type: 'composer', text: '' });
      dispatch({ type: 'sending', value: false });
      dispatch({ type: 'add', item: { id: nextId(), type: 'user', text: oubliBrief, brief: true } });
      await tl.wait(650);
      return;
    }
    case 'think': {
      const id = nextId();
      dispatch({ type: 'activity', text: 'Thinking' });
      dispatch({ type: 'add', item: { id, type: 'think', text: '', done: false, secs: 0 } });
      const ms = Math.min(9000, Math.max(2400, (step.text.length / THINK_CPS) * 1000));
      const t0 = tl.elapsed;
      await tl.tween(ms, (p) =>
        dispatch({ type: 'patch', id, patch: { text: step.text.slice(0, Math.round(step.text.length * p)) } }),
      );
      const secs = Math.max(1, Math.round((tl.elapsed - t0) / 1000));
      dispatch({ type: 'patch', id, patch: { done: true, secs } });
      await tl.wait(420);
      return;
    }
    case 'say':
      dispatch({ type: 'activity', text: 'Writing' });
      await say(ctx, step.text);
      return;
    case 'plan':
      dispatch({ type: 'activity', text: 'Planning' });
      dispatch({ type: 'add', item: { id: nextId(), type: 'plan', items: step.items } });
      await tl.wait(1100);
      return;
    case 'tick':
      dispatch({ type: 'plan', done: step.index + 1 });
      await tl.wait(260);
      return;
    case 'run': {
      const id = nextId();
      const t0 = tl.elapsed;
      dispatch({ type: 'activity', text: `Running ${shortCommand(step.command)}` });
      dispatch({ type: 'add', item: { id, type: 'run', command: step.command, result: step.result, done: false, secs: 0 } });
      dispatch({ type: 'termCmd', command: step.command });
      dispatch({ type: 'termRunning', value: true });
      await tl.wait(420);
      const gap = Math.max(60, (step.ms - 420) / Math.max(1, step.output.length));
      for (const [tone, text] of step.output) {
        await tl.wait(gap);
        dispatch({ type: 'termLine', tone, text });
      }
      if (step.adds) dispatch({ type: 'tree', paths: step.adds });
      dispatch({ type: 'termRunning', value: false });
      dispatch({ type: 'patch', id, patch: { done: true, secs: Math.max(1, Math.round((tl.elapsed - t0) / 1000)) } });
      await tl.wait(360);
      return;
    }
    case 'write': {
      const id = nextId();
      let files: WriteFile[] = [];
      dispatch({ type: 'add', item: { id, type: 'write', title: step.title, files, done: false } });
      for (const path of step.paths) {
        const file = src.files.get(path);
        if (!file) continue;
        files = [...files, { path, lines: file.lines.length, done: false }];
        dispatch({ type: 'patch', id, patch: { files } });
        dispatch({ type: 'tree', paths: [path] });
        dispatch({ type: 'activity', text: `Writing ${path}` });
        dispatch({ type: 'editor', path, chars: 0, writing: true });
        await tl.tween(durations.get(path) ?? 800, (p) =>
          dispatch({ type: 'editorChars', chars: Math.round(file.chars * p) }),
        );
        files = files.map((f) => (f.path === path ? { ...f, done: true } : f));
        dispatch({ type: 'patch', id, patch: { files } });
        dispatch({ type: 'written', path, lines: file.lines.length });
        await tl.wait(140);
      }
      dispatch({ type: 'editor', path: files.at(-1)?.path ?? null, chars: Number.MAX_SAFE_INTEGER, writing: false });
      dispatch({ type: 'patch', id, patch: { done: true } });
      await tl.wait(320);
      return;
    }
    case 'final': {
      const id = nextId();
      const counts = { files: src.fileCount, lines: src.totalLines };
      const total = rundownSegments(counts).reduce((n, s) => n + s.text.length, 0);
      dispatch({ type: 'activity', text: 'Summarising' });
      dispatch({ type: 'add', item: { id, type: 'final', shown: 0, done: false } });
      await tl.tween((total / FINAL_CPS) * 1000, (p) =>
        dispatch({ type: 'patch', id, patch: { shown: Math.round(total * p) } }),
      );
      dispatch({ type: 'patch', id, patch: { done: true } });
      await tl.wait(260);
      dispatch({ type: 'add', item: { id: nextId(), type: 'offer', mode: 'first', answer: null } });
      dispatch({ type: 'activity', text: 'Waiting for you' });
      dispatch({ type: 'phase', phase: 'offer' });
      return;
    }
  }
}

/** Plays the whole session. Rejects with Cancelled if the timeline is killed. */
export async function playSession(ctx: RunContext) {
  const durations = writeDurations(ctx.src);
  ctx.dispatch({ type: 'phase', phase: 'running' });
  for (const step of oubliSession) await playStep(ctx, step, durations);
  ctx.tl.settle();
}

/** "Not yet": the agent answers, and offers once more. */
export async function playNotYet(ctx: RunContext) {
  ctx.dispatch({ type: 'phase', phase: 'running' });
  await ctx.tl.wait(450);
  await say(ctx, oubliRundown.noAnswer);
  ctx.dispatch({ type: 'add', item: { id: ctx.nextId(), type: 'offer', mode: 'later', answer: null } });
  ctx.dispatch({ type: 'activity', text: 'Waiting for you' });
  ctx.dispatch({ type: 'phase', phase: 'offer' });
  ctx.tl.settle();
}
