/**
 * Native Perplexity Agent API stream → ordered trace entries for the studio's ChainOfThought.
 *
 * Shapes verified against recorded streams and the SDK types (src/generated/api.ts):
 *  - output items arrive as response.output_item.added / .done with `output_index`;
 *    search-style items (search_results, people_search_results, image_search_results,
 *    finance_results, fetch_url_results, skill_loaded) carry no id or call_id.
 *  - detail events (response.reasoning.{search,image_search,fetch_url,finance_search,…}_{queries,results},
 *    response.sandbox.{results,write,read,edit,grep,glob,apply_patch,…}, response.skill.loaded)
 *    carry `call_id` (when the tool has one) but no `output_index`. They are bound to the open
 *    output item they describe, so one tool call renders exactly once.
 *  - people_search streams its details as response.reasoning.search_queries/results.
 *  - assistant text arrives as response.output_text.delta/done and belongs in the trace too.
 * Anything unrecognised becomes a visible `notice` entry; nothing is dropped silently.
 */
export type NativeRecord = Record<string, unknown>;

type NativeTraceBase = {
  id: string;
  /** Response id the entry belongs to (research and build runs share one trace). */
  scope: string;
  /** Native output item type (or event-derived equivalent) used for binding and hydration. */
  nativeType: string;
  itemId?: string;
  callId?: string;
  outputIndex?: number;
  /** n-th output item of `nativeType` within its response; matches snapshot order for id-less items. */
  ordinal?: number;
  contentIndex?: number;
  summaryIndex?: number;
  sequenceNumber?: number;
  done: boolean;
  status?: string;
  error?: unknown;
  /** Latest provider status line for this step (e.g. "Searching for images..."). */
  thought?: string;
  raw: NativeRecord;
};

export type NativeTraceEntry = NativeTraceBase & (
  | { kind: 'reasoning'; text: string; channel: 'content' | 'summary' | 'thought' }
  | { kind: 'output'; text: string }
  | { kind: 'search'; searchKind: 'web' | 'people' | 'finance'; queries: string[]; results: NativeRecord[] }
  | { kind: 'imageSearch'; queries: string[]; results: NativeRecord[] }
  | { kind: 'fetch'; urls: string[]; contents: NativeRecord[] }
  | { kind: 'sandbox'; code: string; language: string; stdout: string; stderr: string; results: NativeRecord[]; exitCode?: number; durationMs?: number }
  | { kind: 'directTool'; name: string; input: unknown; output: unknown }
  | { kind: 'skill'; name: string }
  | { kind: 'file'; fileId: string; filename: string; bytes?: number; url?: string; responseId?: string }
  | { kind: 'fileOperation'; operation: string; path: string; paths: string[] }
  | { kind: 'notice'; name: string; detail: string; count: number }
);

const record = (v: unknown): v is NativeRecord => typeof v === 'object' && v !== null && !Array.isArray(v);
const records = (v: unknown): NativeRecord[] => Array.isArray(v) ? v.filter(record) : [];
const string = (v: unknown): string => typeof v === 'string' ? v : '';
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
const number = (v: unknown): number | undefined => typeof v === 'number' ? v : undefined;
/** Merge payloads without letting placeholder nulls/empties of `.added` items erase real data. */
function merge(previous: NativeRecord, next: NativeRecord): NativeRecord {
  const out: NativeRecord = { ...previous };
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined) continue;
    if ((value === '' || (Array.isArray(value) && !value.length)) && out[key] !== undefined) continue;
    out[key] = value;
  }
  return out;
}

const FAILED = /fail|error|timed_out|cancel|incomplete/;
const SANDBOX_OPS: Record<string, string> = {
  results: 'sandbox_results', write: 'sandbox_write_file', write_file: 'sandbox_write_file', read: 'sandbox_read_file', read_file: 'sandbox_read_file',
  edit: 'sandbox_edit_file', edit_file: 'sandbox_edit_file', grep: 'sandbox_grep', glob: 'sandbox_glob', apply_patch: 'sandbox_apply_patch',
  patch: 'sandbox_apply_patch', share_file: 'share_file', share: 'share_file',
};
const SEARCH_ITEMS = ['search_results', 'people_search_results'];

/** Kind-specific fields derived from the merged native payload. */
function shape(nativeType: string, raw: NativeRecord): DistributiveOmit<NativeTraceEntry, keyof NativeTraceBase> {
  switch (nativeType) {
    case 'search_results': case 'people_search_results': case 'finance_results':
      return { kind: 'search', searchKind: nativeType === 'people_search_results' ? 'people' : nativeType === 'finance_results' ? 'finance' : 'web',
        queries: [...strings(raw.queries), ...strings(raw.tickers), ...(nativeType === 'finance_results' ? strings(raw.categories) : [])],
        results: records(raw.results) };
    case 'image_search_results':
      return { kind: 'imageSearch', queries: strings(raw.queries), results: records(raw.results) };
    case 'fetch_url_results': {
      const contents = records(raw.contents);
      return { kind: 'fetch', urls: strings(raw.urls).length ? strings(raw.urls) : contents.map((c) => string(c.url)).filter(Boolean), contents };
    }
    case 'sandbox_results': {
      const results = records(raw.results);
      const last = results.at(-1);
      return { kind: 'sandbox', code: string(raw.code), language: string(raw.language) || 'python',
        stdout: typeof raw.stdout === 'string' ? raw.stdout : results.map((r) => string(r.stdout)).join(''),
        stderr: typeof raw.stderr === 'string' ? raw.stderr : results.map((r) => string(r.stderr)).join(''),
        results, exitCode: number(raw.exit_code) ?? number(last?.exit_code), durationMs: number(raw.duration_ms) ?? (results.reduce((sum, r) => sum + (number(r.duration_ms) ?? 0), 0) || undefined) };
    }
    case 'sandbox_read_file': case 'sandbox_write_file': case 'sandbox_edit_file': case 'sandbox_apply_patch': case 'sandbox_glob': case 'sandbox_grep': {
      const paths = [...strings(raw.added), ...strings(raw.modified), ...strings(raw.deleted), ...strings(raw.files)];
      return { kind: 'fileOperation', operation: nativeType, path: string(raw.file_path) || string(raw.pattern) || paths[0] || '', paths };
    }
    case 'share_file':
      return { kind: 'file', fileId: string(raw.file_id), filename: string(raw.filename) || string(raw.file_path).split('/').pop() || 'file',
        bytes: number(raw.size_bytes), url: string(raw.url) || undefined, responseId: string(raw.response_id) || /responses\/([^/]+)\/files\//.exec(string(raw.url))?.[1] };
    case 'skill_loaded':
      return { kind: 'skill', name: string(raw.name) || 'skill' };
    case 'function_call': case 'function_call_output': case 'mcp_call': case 'mcp_list_tools': case 'mcp_approval_request': case 'tool_search_output': case 'advisor_result': {
      let input: unknown = raw.arguments ?? raw.question;
      if (typeof input === 'string') { try { input = JSON.parse(input); } catch { /* keep the model's text */ } }
      return { kind: 'directTool', name: string(raw.name) || string(raw.server_label) || nativeType, input, output: raw.output ?? raw.advice ?? raw.tools };
    }
    default:
      return { kind: 'notice', name: nativeType || 'provider item', detail: '', count: 1 };
  }
}
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

function compose(base: NativeTraceBase): NativeTraceEntry {
  const entry = { ...base, ...shape(base.nativeType, base.raw) } as NativeTraceEntry;
  const raw = base.raw;
  entry.error = raw.error ?? raw.error_message ?? (entry.kind === 'sandbox' && (FAILED.test(string(raw.status)) || (entry.exitCode ?? 0) !== 0) ? (entry.stderr || `Exit code ${entry.exitCode ?? '?'}`) : undefined);
  entry.status = string(raw.status) || base.status;
  return entry;
}

function replace(entries: NativeTraceEntry[], previous: NativeTraceEntry | undefined, next: NativeTraceEntry) {
  return previous ? entries.map((entry) => entry === previous ? next : entry) : [...entries, next];
}

/** Upsert a tool/item entry. `match` finds an existing entry to merge into. */
function upsert(entries: NativeTraceEntry[], previous: NativeTraceEntry | undefined, fresh: NativeTraceBase, data: NativeRecord, authoritativeType = false): NativeTraceEntry[] {
  if (!previous) return [...entries, compose({ ...fresh, raw: merge({}, data) })];
  const nativeType = authoritativeType || previous.kind === 'notice' ? fresh.nativeType : previous.nativeType;
  const thought = fresh.thought ?? previous.thought;
  return replace(entries, previous, compose({ ...previous, nativeType, thought,
    itemId: previous.itemId ?? fresh.itemId, callId: previous.callId ?? fresh.callId,
    outputIndex: previous.outputIndex ?? fresh.outputIndex, ordinal: previous.ordinal ?? fresh.ordinal,
    sequenceNumber: fresh.sequenceNumber ?? previous.sequenceNumber,
    done: previous.done || fresh.done, status: fresh.status ?? previous.status,
    raw: merge(previous.raw, data) }));
}

function reasoningEntry(entries: NativeTraceEntry[], scope: string, id: string, text: string, channel: 'content' | 'summary' | 'thought', done: boolean, extra: Partial<NativeTraceBase> = {}): NativeTraceEntry[] {
  const previous = entries.find((entry) => entry.id === id);
  const next = { ...(previous ?? {}), id, scope, nativeType: 'reasoning', done: done || Boolean(previous?.done), raw: previous?.raw ?? {}, ...extra,
    kind: 'reasoning', channel, text } as NativeTraceEntry;
  return replace(entries, previous, next);
}

function outputEntry(entries: NativeTraceEntry[], scope: string, itemId: string, update: (text: string) => string, done: boolean, extra: Partial<NativeTraceBase> = {}): NativeTraceEntry[] {
  const id = `${scope}:item:${itemId}`;
  const previous = entries.find((entry) => entry.id === id);
  const text = update(previous?.kind === 'output' ? previous.text : '');
  const next = { ...(previous ?? {}), id, scope, nativeType: 'message', itemId, done: done || Boolean(previous?.done), raw: previous?.raw ?? {}, ...extra,
    kind: 'output', text } as NativeTraceEntry;
  return replace(entries, previous, next);
}

function notice(entries: NativeTraceEntry[], scope: string, name: string, detail: string, raw: NativeRecord, sequenceNumber?: number, error?: unknown): NativeTraceEntry[] {
  const id = `${scope}:notice:${name}`;
  const previous = entries.find((entry) => entry.id === id);
  if (previous?.kind === 'notice') return replace(entries, previous, { ...previous, count: previous.count + 1, detail: detail || previous.detail, raw, sequenceNumber, error: error ?? previous.error });
  return [...entries, { id, scope, nativeType: name, done: true, raw, sequenceNumber, error, kind: 'notice', name, detail, count: 1 }];
}

/** Message items: output text, reasoning text parts and legacy reasoning_steps. */
function messageItem(entries: NativeTraceEntry[], scope: string, item: NativeRecord, done: boolean, envelope: NativeRecord): NativeTraceEntry[] {
  let next = entries;
  const itemId = string(item.id) || `output:${number(envelope.output_index) ?? 'unknown'}`;
  const parts = records(item.content);
  const text = parts.filter((part) => part.type === 'output_text' || part.type === undefined).map((part) => string(part.text)).join('');
  if (text || done) next = outputEntry(next, scope, itemId, (previous) => text || previous, done, { outputIndex: number(envelope.output_index), status: string(item.status) || undefined, raw: item });
  for (const [channel, list] of [['content', item.type === 'reasoning' ? item.content : parts.filter((part) => part.type === 'reasoning_text')], ['summary', item.summary]] as const) {
    records(list).forEach((part, index) => {
      if (typeof part.text === 'string' && part.text) next = reasoningEntry(next, scope, `${scope}:item:${itemId}:${channel}:${index}`, part.text, channel, done);
    });
  }
  if (item.type === 'reasoning' && typeof item.text === 'string' && item.text) next = reasoningEntry(next, scope, `${scope}:item:${itemId}:text`, item.text, 'content', done);
  parts.forEach((part, contentIndex) => records(part.reasoning_steps).forEach((step, index) => {
    next = stepDetails(next, scope, step, `${scope}:item:${itemId}:${contentIndex}:step:${index}`, done);
  }));
  return next;
}

/** ReasoningStep payloads (thought + embedded web_search / people_search / … details). */
function stepDetails(entries: NativeTraceEntry[], scope: string, step: NativeRecord, id: string, done: boolean): NativeTraceEntry[] {
  let next = entries;
  if (typeof step.thought === 'string' && step.thought) next = reasoningEntry(next, scope, `${id}:thought`, step.thought, 'thought', true);
  const details: [string, string][] = [['web_search', 'search_results'], ['people_search', 'people_search_results'], ['finance_search', 'finance_results'],
    ['image_search', 'image_search_results'], ['fetch_url_content', 'fetch_url_results'], ['execute_python', 'sandbox_results']];
  for (const [key, nativeType] of details) {
    const detail = step[key];
    if (!record(detail)) continue;
    const data: NativeRecord = { ...detail, queries: detail.search_keywords ?? detail.queries, results: detail.search_results ?? detail.results, stdout: detail.result ?? detail.stdout };
    const itemId = `${id}:${key}`;
    const previous = next.find((entry) => entry.id === itemId);
    next = upsert(next, previous, { id: itemId, scope, nativeType, done, raw: {} }, data);
  }
  return next;
}

const resultUrls = (raw: NativeRecord) => records(raw.results).map((r) => string(r.url)).filter(Boolean).join('\n');

function outputItem(entries: NativeTraceEntry[], scope: string, rawItem: NativeRecord, envelope: NativeRecord, done: boolean): NativeTraceEntry[] {
  // UnknownOutputItem: { type: 'unknown', item_name, payload }
  const item = rawItem.type === 'unknown' && typeof rawItem.item_name === 'string'
    ? { ...(record(rawItem.payload) ? rawItem.payload : {}), type: rawItem.item_name } : rawItem;
  const type = string(item.type);
  if (type === 'message' || type === 'reasoning') return messageItem(entries, scope, item, done, envelope);
  const outputIndex = number(envelope.output_index);
  const callId = string(item.call_id) || undefined;
  const itemId = type === 'function_call' || type === 'mcp_call' || type === 'tool_search_output' ? string(item.id) || undefined : undefined;
  const inScope = entries.filter((entry) => entry.scope === scope);
  const urls = SEARCH_ITEMS.includes(type) ? resultUrls(item) : '';
  const previous = (outputIndex !== undefined ? inScope.find((entry) => entry.outputIndex === outputIndex) : undefined)
    ?? (callId ? entries.find((entry) => entry.callId === callId) : undefined)
    ?? (itemId ? entries.find((entry) => entry.itemId === itemId) : undefined)
    // a detail event that arrived before its item was announced
    ?? inScope.find((entry) => entry.outputIndex === undefined && entry.ordinal === undefined && !entry.done && entry.nativeType === type && (!callId || !entry.callId))
    ?? (urls ? entries.find((entry) => entry.nativeType === type && resultUrls(entry.raw) === urls) : undefined);
  const ordinal = previous?.ordinal ?? inScope.filter((entry) => entry.nativeType === type && entry.ordinal !== undefined).length;
  const id = `${scope}:output:${outputIndex ?? `${type}#${ordinal}`}`;
  return upsert(entries, previous, { id, scope, nativeType: type, callId, itemId, outputIndex, ordinal,
    sequenceNumber: number(envelope.sequence_number), done: done && string(item.status) !== 'in_progress', raw: {} }, item, true);
}

/** Detail events → the open output item they describe (by call_id, else first open compatible item). */
function detail(entries: NativeTraceEntry[], scope: string, event: NativeRecord, nativeType: string, compatible: string[], data: NativeRecord, done: boolean): NativeTraceEntry[] {
  const callId = string(event.call_id) || undefined;
  const thought = string(event.thought) || undefined;
  const inScope = entries.filter((entry) => entry.scope === scope);
  const open = (entry: NativeTraceEntry) => compatible.includes(entry.nativeType) && !entry.done && !entry.callId;
  // Without a call_id, a `_queries` event starts the next untouched item; `_results` complete the one in progress.
  const previous = (callId ? entries.find((entry) => entry.callId === callId) : undefined)
    ?? (done ? inScope.find(open) : inScope.find((entry) => open(entry) && !hasData(entry)));
  const sequenceNumber = number(event.sequence_number);
  const id = `${scope}:${callId ? `call:${callId}` : `event:${nativeType}:${sequenceNumber ?? inScope.length}`}`;
  return upsert(entries, previous, { id, scope, nativeType: previous?.nativeType ?? nativeType, callId, sequenceNumber, done, thought, raw: {} }, data);
}
const hasData = (entry: NativeTraceEntry) => (entry.kind === 'search' || entry.kind === 'imageSearch') ? entry.queries.length > 0 || entry.results.length > 0 : entry.kind === 'fetch' ? entry.urls.length > 0 : false;

const strip = (event: NativeRecord): NativeRecord => Object.fromEntries(Object.entries(event)
  .filter(([key]) => !['type', 'sequence_number', 'thought', 'usage', 'output_index', 'item_id'].includes(key)));

export function hydrateNativeTrace(entries: NativeTraceEntry[], response: unknown): NativeTraceEntry[] {
  if (!record(response)) return entries;
  const scope = string(response.id);
  const terminal = ['completed', 'failed', 'cancelled', 'incomplete'].includes(string(response.status));
  let next = entries;
  const ordinals = new Map<string, number>();
  records(response.output).forEach((output, index) => {
    const type = string(output.type);
    const done = terminal || (typeof output.status === 'string' ? !['', 'in_progress', 'queued'].includes(output.status) : true);
    if (type === 'message' || type === 'reasoning') { next = messageItem(next, scope, output, done, {}); return; }
    const ordinal = ordinals.get(type) ?? 0;
    ordinals.set(type, ordinal + 1);
    const callId = string(output.call_id) || undefined;
    const itemId = string(output.id) || undefined;
    const urls = SEARCH_ITEMS.includes(type) ? resultUrls(output) : '';
    const previous = (callId ? next.find((entry) => entry.callId === callId) : undefined)
      ?? (itemId ? next.find((entry) => entry.itemId === itemId) : undefined)
      ?? next.find((entry) => entry.scope === scope && entry.nativeType === type && entry.ordinal === ordinal)
      ?? (urls ? next.find((entry) => entry.nativeType === type && resultUrls(entry.raw) === urls) : undefined);
    next = upsert(next, previous, { id: `${scope}:snapshot:${index}`, scope, nativeType: type, callId, itemId: type === 'function_call' ? itemId : undefined,
      ordinal, done, raw: {} }, output, true);
  });
  if (!terminal) return next;
  return next.map((entry) => entry.scope !== scope || entry.done ? entry : { ...entry, done: true,
    status: response.status === 'completed' ? (entry.kind === 'output' || entry.kind === 'reasoning' ? entry.status : 'ended') : 'interrupted' });
}

/**
 * Apply one native stream event. `scope` is the id of the response the event belongs to
 * (several responses — research then build — share one trace).
 */
export function applyNativeTrace(entries: NativeTraceEntry[], event: unknown, scope = ''): NativeTraceEntry[] {
  if (!record(event)) return entries;
  const type = string(event.type);
  const sequenceNumber = number(event.sequence_number);
  if (record(event.response)) return hydrateNativeTrace(entries, { ...event.response, id: string(event.response.id) || scope });
  if (record(event.item)) return outputItem(entries, scope, event.item, event, type.endsWith('.done'));

  if (type === 'response.output_text.delta' || type === 'response.output_text.done') {
    const itemId = string(event.item_id) || `output:${number(event.output_index) ?? 0}`;
    return outputEntry(entries, scope, itemId, (previous) => type.endsWith('.done') ? string(event.text) || previous : previous + string(event.delta), type.endsWith('.done'),
      { outputIndex: number(event.output_index), sequenceNumber });
  }
  const reasoning = /^response\.(reasoning(?:_text)?|reasoning_summary_text|reasoning_summary_part)\.(delta|done|added)$/.exec(type);
  if (reasoning) {
    const channel = reasoning[1].startsWith('reasoning_summary') ? 'summary' : 'content';
    const index = number(channel === 'summary' ? event.summary_index : event.content_index) ?? 0;
    const owner = string(event.item_id) || `output:${number(event.output_index) ?? 0}`;
    const id = `${scope}:item:${owner}:${channel}:${index}`;
    const previous = entries.find((entry) => entry.id === id);
    const before = previous?.kind === 'reasoning' ? previous.text : '';
    const text = reasoning[2] === 'delta' ? before + (string(event.delta) || string(event.thought))
      : string(event.text ?? event.reasoning ?? (record(event.part) ? event.part.text : undefined)) || before;
    return reasoningEntry(entries, scope, id, text, channel, reasoning[2] === 'done', { sequenceNumber });
  }
  if (type === 'response.content_part.added' || type === 'response.content_part.done') {
    if (record(event.part) && event.part.type === 'reasoning_text') {
      return applyNativeTrace(entries, { ...event, type: type.endsWith('.done') ? 'response.reasoning_text.done' : 'response.reasoning_text.added', text: event.part.text }, scope);
    }
    return entries; // output_text parts: their text arrives through output_text.delta/done
  }
  if (type === 'response.reasoning.started' || type === 'response.reasoning.stopped') {
    return stepDetails(entries, scope, event, `${scope}:${type}:${sequenceNumber ?? entries.length}`, type.endsWith('.stopped'));
  }
  const reasoningTool = /^response\.reasoning\.([a-z_]+)_(queries|results)$/.exec(type);
  if (reasoningTool) {
    const tool = reasoningTool[1];
    const nativeType = tool === 'search' ? 'search_results' : tool === 'finance_search' || tool === 'finance' ? 'finance_results' : `${tool}_results`;
    const compatible = tool === 'search' ? SEARCH_ITEMS : [nativeType];
    return detail(entries, scope, event, nativeType, compatible, strip(event), reasoningTool[2] === 'results');
  }
  const sandbox = /^response\.sandbox\.([a-z_]+)$/.exec(type);
  if (sandbox) {
    if (sandbox[1] === 'created') return notice(entries, scope, 'sandbox_session', string(event.container_id), event, sequenceNumber);
    const nativeType = SANDBOX_OPS[sandbox[1]] ?? `sandbox_${sandbox[1]}`;
    const done = sandbox[1] === 'results' ? event.status !== 'in_progress' : true;
    return detail(entries, scope, event, nativeType, [nativeType], strip(event), done);
  }
  if (type === 'response.skill.loaded') return detail(entries, scope, event, 'skill_loaded', ['skill_loaded'], strip(event), true);
  if (type === 'response.file.created') return detail(entries, scope, event, 'share_file', ['share_file'], strip(event), true);
  if (type === 'error') return notice(entries, scope, 'error', string(record(event.error) ? event.error.message : event.message), event, sequenceNumber, event.error ?? event);
  return notice(entries, scope, type || 'provider event', '', event, sequenceNumber);
}
