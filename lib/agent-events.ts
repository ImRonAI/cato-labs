import type { AgentEvent } from './pplx';
import type { Hit, Img, SearchKind, UiEvent } from './agent-ui';

/**
 * Agent API stream event → UiEvent.
 *
 * Handles all OpenAPI 3.1 / TypeScript SDK shapes across both execution paths:
 *  1. Direct / Reasoning stream events & OutputItems:
 *     - response.reasoning.{search,image_search,fetch_url,finance_search,people_search}_{queries,results}
 *     - ReasoningStep-Output embedded details (web_search, finance_search, people_search, fetch_url_content, execute_python)
 *     - response.sandbox.results & SandboxResultsOutputItem (both top-level stdout/stderr and nested results[])
 *     - SearchResultsOutputItem, ImageSearchResultsOutputItem, PeopleSearchResultsOutputItem,
 *       FinanceResultsOutputItem, FetchUrlResultsOutputItem
 *     - McpCallOutputItem, McpListToolsOutputItem, ToolSearchOutputItem, McpApprovalRequestOutputItem, FunctionCallOutputItem
 *     - UnknownOutputItem (type: "unknown", item_name, payload)
 *  2. Tools executed from inside the Sandbox container (`sandbox_results`):
 *     - Preinstalled `pplx` CLI (`pplx search web`, `pplx content snippets`, `pplx content fetch`,
 *       `pplx search finance`, `pplx search people`, `pplx search image`)
 *     - Preinstalled `pplx_sdk` Python SDK (`search.web`, `search.finance`, `search.people`, `content.snippets`)
 *     - Preinstalled GitHub / Git Connector CLIs (`gh repo|issue|pr|release|search|api`, `git clone|ls-remote`)
 *
 * Privacy invariant: Telnyx MCP arguments/outputs are never forwarded (they carry visitor contact info).
 */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v.filter(isRec) as Rec[]) : []);
const str = (v: unknown, n = 200) => (typeof v === 'string' ? v.slice(0, n) : '');

const hits = (v: unknown, n = 6): Hit[] =>
  arr(v)
    .map((x) => {
      const url = str(x.url ?? x.linkedin_url ?? x.profile_url ?? x.origin_url, 500);
      const nameOrTitle =
        str(x.title, 90) ||
        [str(x.name, 50), str(x.headline ?? x.current_title ?? x.role, 50), str(x.company ?? x.organization, 40)]
          .filter(Boolean)
          .join(' · ') ||
        str(x.domain ?? x.source, 60);
      const snippet = str(x.snippet ?? x.text ?? x.summary ?? x.content, 220) || undefined;
      return { title: nameOrTitle, url, snippet };
    })
    .filter((x) => Boolean(x.url || x.title))
    .slice(0, n);

const images = (v: unknown, n = 4): Img[] =>
  arr(v)
    .map((x) => ({
      imageUrl: str(x.image_url ?? x.url ?? x.thumbnail_url ?? x.media_url, 800),
      originUrl: str(x.origin_url ?? x.source_url ?? x.page_url ?? x.url ?? x.image_url, 500),
      title: str(x.title ?? x.alt ?? x.caption ?? x.source, 90),
    }))
    .filter((x) => x.imageUrl.startsWith('https://') || x.imageUrl.startsWith('http://'))
    .slice(0, n);

const queries = (v: unknown, n = 4): string[] =>
  (Array.isArray(v) ? v : [])
    .map((q) => (typeof q === 'string' || typeof q === 'number' ? String(q).trim() : ''))
    .filter(Boolean)
    .slice(0, n);

/** finance_search writes its raw quotes into the sandbox — that is plumbing, not the agent editing */
const isArtifact = (p: string) => p.includes('/.tool_artifacts/');

/** Parse one or more JSON objects emitted to stdout by `pplx` CLI or `pplx_sdk` in the sandbox */
function parseJsonObjects(stdout: string): Rec[] {
  const out: Rec[] = [];
  const trimmed = stdout.trim();
  if (!trimmed) return out;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRec(parsed)) return [parsed];
    if (Array.isArray(parsed)) return parsed.filter(isRec);
  } catch {
    /* stdout may contain multiple newline-delimited orpretty-printed JSON blocks */
  }
  const blockRe = /\{[\s\S]*?\n\}|\{[^\n{}]+\}/g;
  for (const m of trimmed.matchAll(blockRe)) {
    try {
      const parsed: unknown = JSON.parse(m[0]);
      if (isRec(parsed)) out.push(parsed);
    } catch {
      /* ignore non-JSON lines */
    }
  }
  return out;
}

/** Extract quoted CLI or Python arguments (excluding flags and URLs) */
function extractQuotedQueries(code: string, max = 4): string[] {
  const out: string[] = [];
  const re = /(?:"([^"\n]{2,120})"|'([^'\n]{2,120})')/g;
  for (const m of code.matchAll(re)) {
    const val = (m[1] ?? m[2] ?? '').trim();
    if (
      !val ||
      val.startsWith('-') ||
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('/') ||
      val.endsWith('.json') ||
      val.endsWith('.py') ||
      val.endsWith('.html')
    ) {
      continue;
    }
    if (!out.includes(val)) out.push(val);
    if (out.length >= max) break;
  }
  return out;
}

/** Extract URLs from CLI code or stdout */
function extractUrls(text: string, max = 6): string[] {
  const out: string[] = [];
  const re = /https?:\/\/[^\s"'`<>)\]]+/g;
  for (const m of text.matchAll(re)) {
    const u = m[0].replace(/[.,;]+$/, '');
    if (!out.includes(u)) out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Inspect a `sandbox_results` execution (`code` + `stdout`) to determine if the
 * model invoked a built-in tool or connector from inside the sandbox container
 * via the preinstalled `pplx` CLI, `pplx_sdk` Python SDK, or `gh`/`git` CLIs.
 */
function classifySandboxTool(
  code: string,
  stdout: string,
  stderr: string,
  done: boolean,
  failed: boolean
): UiEvent | null {
  const trimmedCode = code.trim();
  if (!trimmedCode && !stdout.trim()) return null;

  /* Do not reclassify multi-purpose site-building scripts that write workspace files */
  const writesSiteFiles =
    /\b(?:index\.html|styles?\.css|app\.js|script\.js)\b/.test(trimmedCode) &&
    /\b(?:open\(|write_text|cat\s+>|cat\s+<<)\b/.test(trimmedCode);
  if (writesSiteFiles) return null;

  const jsonBlocks = parseJsonObjects(stdout);

  /* 1. URL Fetch / Content Snippets (`pplx content snippets|fetch` or `pplx_sdk` content/fetch) */
  const isContentCli =
    /\bpplx\s+content\s+(?:snippets|fetch)\b/.test(trimmedCode) ||
    /\bpplx_sdk\b[\s\S]*?\b(?:content\.snippets|content\.fetch|fetch_url)\b/.test(trimmedCode) ||
    /\/v1\/pplx\/content\b/.test(trimmedCode) ||
    jsonBlocks.some(
      (b) =>
        Array.isArray(b.results) &&
        arr(b.results).some((r) => typeof r.url === 'string' && ('tokens_count' in r || 'text' in r))
    );

  if (isContentCli) {
    const codeUrls = extractUrls(trimmedCode, 6);
    if (!done) return { t: 'fetch', urls: codeUrls };
    const fetchedHits = jsonBlocks.flatMap((b) => hits(b.results ?? b.contents, 6));
    const finalHits: Hit[] = fetchedHits.length
      ? fetchedHits
      : codeUrls.map((url) => ({ title: url, url, snippet: str(stdout, 200) || undefined }));
    return {
      t: 'fetched',
      urls: codeUrls.length ? codeUrls : finalHits.map((h) => h.url).filter(Boolean),
      hits: finalHits,
      fromSandbox: true,
    };
  }

  /* 2. Finance Search in Sandbox (`pplx search finance`, `pplx finance`, `pplx_sdk` finance, or `/.tool_artifacts/` finance quotes) */
  const isFinanceSandbox =
    /\bpplx\s+(?:search\s+)?finance\b/.test(trimmedCode) ||
    /\bpplx_sdk\b[\s\S]*?\bfinance\b/.test(trimmedCode) ||
    (/\b\.tool_artifacts\b/.test(trimmedCode) && /\b(?:ticker|quote|financial|market_cap|revenue|earnings)\b/i.test(trimmedCode));

  if (isFinanceSandbox) {
    const tickers = Array.from(new Set((trimmedCode.match(/\b[A-Z]{1,5}\b/g) ?? []).filter((t) => !['JSON', 'UTF', 'TRUE', 'FALSE', 'NONE', 'NULL', 'HTTP', 'HTTPS', 'HTML', 'PPLX', 'BASH'].includes(t)))).slice(0, 4);
    const qs = tickers.length ? tickers : extractQuotedQueries(trimmedCode);
    if (!done) return { t: 'search', kind: 'finance', queries: qs };
    const parsedHits = jsonBlocks.flatMap((b) => hits(b.hits ?? b.results ?? b.sources, 6));
    const fallbackHits: Hit[] = parsedHits.length
      ? parsedHits
      : qs.map((q) => ({ title: q, url: '' }));
    return { t: 'hits', kind: 'finance', queries: qs, hits: fallbackHits, fromSandbox: true };
  }

  /* 3. People Search in Sandbox (`pplx search people`, `pplx people`, `pplx_sdk` people) */
  const isPeopleSandbox =
    /\bpplx\s+(?:search\s+)?people\b/.test(trimmedCode) ||
    /\bpplx_sdk\b[\s\S]*?\bpeople\b/.test(trimmedCode);

  if (isPeopleSandbox) {
    const qs = extractQuotedQueries(trimmedCode);
    if (!done) return { t: 'search', kind: 'people', queries: qs };
    const parsedHits = jsonBlocks.flatMap((b) => hits(b.hits ?? b.results, 6));
    const urlFallbacks = !parsedHits.length
      ? extractUrls(stdout, 5).map((url) => ({ title: url, url }))
      : [];
    return {
      t: 'hits',
      kind: 'people',
      queries: qs,
      hits: parsedHits.length ? parsedHits : urlFallbacks,
      fromSandbox: true,
    };
  }

  /* 4. Image Search in Sandbox (`pplx search image`, `pplx image`, `pplx_sdk` image) */
  const isImageSandbox =
    /\bpplx\s+(?:search\s+)?images?\b/.test(trimmedCode) ||
    /\bpplx_sdk\b[\s\S]*?\bimages?\b/.test(trimmedCode) ||
    jsonBlocks.some((b) => images(b.results ?? b.hits, 1).length > 0);

  if (isImageSandbox) {
    const qs = extractQuotedQueries(trimmedCode);
    if (!done) return { t: 'search', kind: 'image', queries: qs };
    const imgs = jsonBlocks.flatMap((b) => images(b.results ?? b.hits, 4)).slice(0, 4);
    return {
      t: 'hits',
      kind: 'image',
      queries: qs,
      hits: [],
      images: imgs,
      fromSandbox: true,
    };
  }

  /* 5. Web Search in Sandbox (`pplx search web`, `pplx search`, `pplx_sdk` search, or `{ total, hits }` JSON output) */
  const isWebSearchSandbox =
    /\bpplx\s+search(?:\s+web)?\b/.test(trimmedCode) ||
    /\bpplx_sdk\b[\s\S]*?\bsearch\b/.test(trimmedCode) ||
    /\/v1\/pplx\/search\b/.test(trimmedCode) ||
    jsonBlocks.some((b) => typeof b.total === 'number' && Array.isArray(b.hits));

  if (isWebSearchSandbox) {
    const qs = extractQuotedQueries(trimmedCode);
    if (!done) return { t: 'search', kind: 'web', queries: qs };
    const parsedHits = jsonBlocks.flatMap((b) => hits(b.hits ?? b.results, 6)).slice(0, 6);
    const urlFallbacks = !parsedHits.length
      ? extractUrls(stdout, 5).map((url) => ({ title: url, url }))
      : [];
    return {
      t: 'hits',
      kind: 'web',
      queries: qs,
      hits: parsedHits.length ? parsedHits : urlFallbacks,
      fromSandbox: true,
    };
  }

  /* 6. GitHub / Git Connectors in Sandbox (`gh repo|issue|pr|release|search|api`, `git clone|ls-remote`) */
  const ghMatch = /^\s*(?:gh\s+([a-z-]+(?:\s+[a-z-]+)?)|git\s+(clone|ls-remote|fetch|log|diff|status))\b/m.exec(
    trimmedCode
  );
  if (ghMatch) {
    const sub = ghMatch[1] ? `gh ${ghMatch[1]}` : `git ${ghMatch[2]}`;
    return {
      t: 'mcp',
      server: 'github',
      tool: sub,
      ok: !failed,
      done,
      input: { command: str(trimmedCode, 400) },
      output: str(stdout || stderr, 1200) || undefined,
      errorText: failed ? str(stderr || stdout, 600) || 'Command failed' : undefined,
      fromSandbox: true,
    };
  }

  return null;
}

/** Parse finance_results output items into Hit[] */
function parseFinanceHits(results: unknown): Hit[] {
  return arr(results)
    .flatMap((r): Hit[] => {
      if (typeof r.url === 'string' && r.url) {
        return [{ title: str(r.title, 90) || str(r.url, 90), url: str(r.url, 500), snippet: str(r.snippet ?? r.content, 200) || undefined }];
      }
      const label = `${queries(r.tickers).join(', ')} ${str(r.category, 40)}`.trim() || str(r.title ?? r.name, 60) || 'Financial data';
      const snippet = str(r.content ?? r.snippet, 200) || undefined;
      const urls = queries(r.sources, 5);
      return urls.length ? urls.map((url) => ({ title: label, url, snippet })) : [{ title: label, url: '', snippet }];
    })
    .slice(0, 6);
}

/** Safely parse MCP/Function JSON arguments when non-sensitive */
function safeParseArgs(server: string, rawArgs: unknown): Record<string, unknown> | undefined {
  if (server.toLowerCase() === 'telnyx') return undefined;
  if (isRec(rawArgs)) return rawArgs;
  if (typeof rawArgs === 'string' && rawArgs.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawArgs);
      if (isRec(parsed)) return parsed;
    } catch {
      return { arguments: str(rawArgs, 300) };
    }
  }
  return undefined;
}

export function toUi(ev: AgentEvent): UiEvent | null {
  /* Unwrap OpenAPI UnknownOutputItem (`type: "unknown"`, `item_name`, `payload`) transparently */
  const rawItem = (ev.item ?? {}) as Rec;
  const item: Rec =
    rawItem.type === 'unknown' && typeof rawItem.item_name === 'string'
      ? { ...(isRec(rawItem.payload) ? rawItem.payload : {}), type: rawItem.item_name }
      : rawItem;

  switch (ev.type) {
    case 'response.output_text.delta':
      return typeof ev.delta === 'string' ? { t: 'text', delta: ev.delta } : null;

    case 'response.reasoning.delta':
    case 'response.reasoning_text.delta':
    case 'response.reasoning_summary_text.delta': {
      const delta = typeof ev.delta === 'string' ? ev.delta : str(ev.thought, 10000);
      return delta ? { t: 'thought', text: delta, delta: true, done: false } : null;
    }

    case 'response.reasoning_text.done':
    case 'response.reasoning_summary_text.done': {
      const text = str(ev.text ?? ev.thought, 10000);
      return text ? { t: 'thought', text, done: true } : null;
    }

    case 'response.reasoning.started':
    case 'response.reasoning.stopped': {
      /* Check ReasoningStep-Output embedded tool step details from OpenAPI schema first */
      const thought = str(ev.thought, 10000) || undefined;
      if (isRec(ev.web_search)) {
        const ws = ev.web_search;
        const h = hits(ws.search_results);
        const q = queries(ws.search_keywords);
        if (h.length) return { t: 'hits', kind: 'web', queries: q, hits: h, thought };
        if (q.length) return { t: 'search', kind: 'web', queries: q, thought };
      }
      if (isRec(ev.finance_search)) {
        const fs = ev.finance_search;
        const h = hits(fs.search_results);
        const q = queries(fs.search_keywords);
        if (h.length) return { t: 'hits', kind: 'finance', queries: q, hits: h, thought };
        if (q.length) return { t: 'search', kind: 'finance', queries: q, thought };
      }
      if (isRec(ev.people_search)) {
        const ps = ev.people_search;
        const h = hits(ps.search_results);
        const q = queries(ps.search_keywords);
        if (h.length) return { t: 'hits', kind: 'people', queries: q, hits: h, thought };
        if (q.length) return { t: 'search', kind: 'people', queries: q, thought };
      }
      if (isRec(ev.image_search)) {
        const is = ev.image_search;
        const imgs = images(is.search_results ?? is.results ?? is.images);
        const q = queries(is.search_keywords ?? is.queries);
        if (imgs.length) return { t: 'hits', kind: 'image', queries: q, hits: [], images: imgs, thought };
        if (q.length) return { t: 'search', kind: 'image', queries: q, thought };
      }
      if (isRec(ev.fetch_url_content)) {
        const fu = ev.fetch_url_content;
        const h = hits(fu.contents);
        if (h.length) return { t: 'fetched', hits: h, thought };
      }
      if (isRec(ev.execute_python)) {
        const ep = ev.execute_python;
        const code = str(ep.code, 6000);
        const result = str(ep.result, 4000);
        const sandboxTool = classifySandboxTool(code, result, '', true, false);
        if (sandboxTool) return sandboxTool;
        return { t: 'code', done: true, failed: false, language: 'python', code, stdout: result, stderr: '' };
      }
      return thought ? { t: 'thought', text: thought, done: ev.type === 'response.reasoning.stopped' } : null;
    }

    /* Direct reasoning stream events for all 5 search/fetch tools — preserving ev.thought as written */
    case 'response.reasoning.search_queries':
      return { t: 'search', kind: 'web', queries: queries(ev.queries), thought: str(ev.thought, 4000) || undefined };
    case 'response.reasoning.search_results':
      return { t: 'hits', kind: 'web', hits: hits(ev.results), thought: str(ev.thought, 4000) || undefined };

    case 'response.reasoning.image_search_queries':
      return { t: 'search', kind: 'image', queries: queries(ev.queries), thought: str(ev.thought, 4000) || undefined };
    case 'response.reasoning.image_search_results':
      return { t: 'hits', kind: 'image', hits: [], images: images(ev.results ?? ev.images), thought: str(ev.thought, 4000) || undefined };

    case 'response.reasoning.fetch_url_queries':
      return { t: 'fetch', urls: queries(ev.urls, 6), thought: str(ev.thought, 4000) || undefined };
    case 'response.reasoning.fetch_url_results':
      return { t: 'fetched', hits: hits(ev.contents ?? ev.results, 6), thought: str(ev.thought, 4000) || undefined };

    case 'response.reasoning.finance_search_queries':
      return {
        t: 'search',
        kind: 'finance',
        queries: [...queries(ev.tickers), ...queries(ev.categories), ...queries(ev.queries)].slice(0, 6),
        thought: str(ev.thought, 4000) || undefined,
      };
    case 'response.reasoning.finance_search_results':
      return { t: 'hits', kind: 'finance', hits: parseFinanceHits(ev.results), thought: str(ev.thought, 4000) || undefined };

    case 'response.reasoning.people_search_queries':
      return { t: 'search', kind: 'people', queries: queries(ev.queries), thought: str(ev.thought, 4000) || undefined };
    case 'response.reasoning.people_search_results':
      return { t: 'hits', kind: 'people', hits: hits(ev.results), thought: str(ev.thought, 4000) || undefined };

    /* Streaming sandbox execution event (`response.sandbox.results`) */
    case 'response.sandbox.results': {
      const runs = arr(ev.results);
      const code = str(ev.code, 6000);
      const stdout = runs.map((r) => str(r.stdout, 4000)).join('') || str(ev.stdout, 4000);
      const stderr = runs.map((r) => str(r.stderr, 2000)).join('') || str(ev.stderr, 2000);
      const done = ev.status ? ev.status !== 'in_progress' : true;
      const failed = Boolean(ev.status && ev.status !== 'completed' && ev.status !== 'in_progress');
      const sandboxTool = classifySandboxTool(code, stdout, stderr, done, failed);
      if (sandboxTool) return sandboxTool;
      return {
        t: 'code',
        done,
        failed,
        language: str(ev.language, 12) || 'python',
        code,
        stdout,
        stderr,
      };
    }

    case 'response.skill.loaded':
      return { t: 'skill', name: str(ev.name, 64) };

    case 'response.output_item.added':
      switch (item.type) {
        case 'reasoning': {
          const summaryText = arr(item.summary ?? item.content)
            .map((p) => str(p.text ?? p.thought, 10000))
            .filter(Boolean)
            .join('\n');
          const direct = str(item.thought ?? item.text, 10000);
          const text = summaryText || direct;
          return text ? { t: 'thought', text, done: false } : null;
        }
        case 'search_results':
          return queries(item.queries).length ? { t: 'search', kind: 'web', queries: queries(item.queries) } : null;
        case 'image_search_results':
          return { t: 'search', kind: 'image', queries: queries(item.queries) };
        case 'people_search_results':
          return { t: 'search', kind: 'people', queries: queries(item.queries) };
        case 'finance_results':
          return {
            t: 'search',
            kind: 'finance',
            queries: [...queries(item.tickers), ...queries(item.categories), ...queries(item.queries)].slice(0, 6),
          };
        case 'fetch_url_results': {
          const u = queries(item.urls, 6);
          return u.length ? { t: 'fetch', urls: u } : null;
        }
        case 'sandbox_results': {
          const code = str(item.code, 6000);
          const sandboxTool = classifySandboxTool(code, '', '', false, false);
          if (sandboxTool) return sandboxTool;
          return { t: 'code', done: false, language: str(item.language, 12) || 'python', code };
        }
        case 'mcp_call': {
          const server = str(item.server_label ?? item.connector_id, 40) || 'mcp';
          const tool = str(item.name, 60) || 'call';
          return {
            t: 'mcp',
            server,
            tool,
            ok: true,
            done: false,
            input: safeParseArgs(server, item.arguments),
          };
        }
        case 'tool_search_output':
          return {
            t: 'mcp',
            server: 'tool_search',
            tool: 'search_tools',
            ok: true,
            done: false,
            input: safeParseArgs('tool_search', item.arguments),
          };
        default:
          return null;
      }

    case 'response.output_item.done':
      switch (item.type) {
        case 'reasoning': {
          const summaryText = arr(item.summary ?? item.content)
            .map((p) => str(p.text ?? p.thought, 10000))
            .filter(Boolean)
            .join('\n');
          const direct = str(item.thought ?? item.text, 10000);
          const text = summaryText || direct;
          return text ? { t: 'thought', text, done: true } : null;
        }
        case 'search_results':
          return { t: 'hits', kind: 'web', queries: queries(item.queries), hits: hits(item.results) };
        case 'image_search_results':
          return {
            t: 'hits',
            kind: 'image',
            queries: queries(item.queries),
            hits: [],
            images: images(item.results),
          };
        case 'people_search_results':
          return { t: 'hits', kind: 'people', queries: queries(item.queries), hits: hits(item.results) };
        case 'finance_results':
          return {
            t: 'hits',
            kind: 'finance',
            queries: [...queries(item.tickers), ...queries(item.categories)].slice(0, 6),
            hits: parseFinanceHits(item.results),
          };
        case 'fetch_url_results':
          return {
            t: 'fetched',
            urls: queries(item.urls, 6),
            hits: hits(item.contents ?? item.results, 6),
          };
        case 'sandbox_results': {
          /* Support both SDK `item.results[]` and OpenAPI top-level `item.stdout`/`item.stderr` */
          const runs = arr(item.results);
          const code = str(item.code, 6000);
          const stdout = runs.map((r) => str(r.stdout, 4000)).join('') || str(item.stdout, 4000);
          const stderr = runs.map((r) => str(r.stderr, 2000)).join('') || str(item.stderr, 2000);
          const failed = item.status !== 'completed' || (typeof item.exit_code === 'number' && item.exit_code !== 0);
          const sandboxTool = classifySandboxTool(code, stdout, stderr, true, failed);
          if (sandboxTool) return sandboxTool;
          return {
            t: 'code',
            done: true,
            failed,
            language: str(item.language, 12) || 'python',
            code,
            stdout,
            stderr,
          };
        }
        case 'sandbox_read_file':
        case 'sandbox_write_file':
        case 'sandbox_edit_file': {
          const p = str(item.file_path, 300);
          if (!p || isArtifact(p) || item.error) return null;
          const op =
            item.type === 'sandbox_write_file'
              ? 'write'
              : item.type === 'sandbox_edit_file'
                ? 'edit'
                : 'read';
          return { t: 'edit', op, paths: [p] };
        }
        case 'sandbox_apply_patch': {
          const paths = [...queries(item.added), ...queries(item.modified)].filter((p) => !isArtifact(p));
          return paths.length && !item.error ? { t: 'edit', op: 'patch', paths } : null;
        }
        case 'sandbox_glob':
        case 'sandbox_grep': {
          const pattern = str(item.pattern, 120);
          const matches = queries(item.matches);
          return pattern
            ? { t: 'edit', op: item.type === 'sandbox_glob' ? 'glob' : 'grep', paths: matches.length ? matches : [pattern] }
            : null;
        }
        case 'share_file': {
          const m = /responses\/([^/]+)\/files\/([^/]+)/.exec(str(item.url, 300));
          if (!m || item.error) return null;
          return {
            t: 'file',
            responseId: m[1],
            fileId: m[2],
            filename: str(item.filename, 120) || 'file',
            bytes: typeof item.size_bytes === 'number' ? item.size_bytes : undefined,
          };
        }
        /* skill_loaded duplicates response.skill.loaded — handled there */
        case 'mcp_call': {
          const server = str(item.server_label ?? item.connector_id, 40) || 'mcp';
          const tool = str(item.name, 60) || 'call';
          const isTelnyx = server.toLowerCase() === 'telnyx';
          return {
            t: 'mcp',
            server,
            tool,
            ok: !item.error,
            done: true,
            input: safeParseArgs(server, item.arguments),
            output: isTelnyx ? undefined : str(item.output, 1200) || undefined,
            errorText: item.error ? str(item.error, 400) : undefined,
          };
        }
        case 'mcp_list_tools': {
          const server = str(item.server_label ?? item.connector_id, 40) || 'mcp';
          const toolNames = arr(item.tools)
            .map((t) => str(t.name, 50))
            .filter(Boolean);
          return {
            t: 'mcp',
            server,
            tool: 'list_tools',
            ok: !item.error,
            done: true,
            output: toolNames.length ? `Available tools: ${toolNames.join(', ')}` : undefined,
            errorText: item.error ? str(item.error, 400) : undefined,
          };
        }
        case 'tool_search_output': {
          const namespaces = arr(item.tools)
            .map((t) => str(t.name, 50))
            .filter(Boolean);
          return {
            t: 'mcp',
            server: 'tool_search',
            tool: 'search_tools',
            ok: item.status !== 'incomplete',
            done: true,
            input: safeParseArgs('tool_search', item.arguments),
            output: namespaces.length ? `Discovered namespaces: ${namespaces.join(', ')}` : 'Completed tool search',
          };
        }
        case 'mcp_approval_request': {
          const server = str(item.server_label ?? item.connector_id, 40) || 'mcp';
          const tool = str(item.name, 60) || 'approval_request';
          return {
            t: 'mcp',
            server,
            tool,
            ok: true,
            done: true,
            input: safeParseArgs(server, item.arguments),
            output: 'Approval requested',
          };
        }
        case 'function_call': {
          const name = str(item.name, 60) || 'function';
          if (name === 'set_site_config') return null;
          return {
            t: 'mcp',
            server: 'function',
            tool: name,
            ok: item.status !== 'incomplete',
            done: item.status !== 'in_progress',
            input: safeParseArgs('function', item.arguments),
          };
        }
        default:
          return null;
      }
    default:
      return null;
  }
}
