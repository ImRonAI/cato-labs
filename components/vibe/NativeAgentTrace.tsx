'use client';

import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentOutput,
  AgentTool,
  AgentTools,
} from '@/components/ai-elements/agent';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { MessageResponse } from '@/components/ai-elements/message';
import {
  Sandbox,
  SandboxContent,
  SandboxHeader,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from '@/components/ai-elements/sandbox';
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
  type TaskStatus,
} from '@/components/ai-elements/task';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import {
  STUDIO_AGENT_INSTRUCTIONS_MD,
  STUDIO_MODEL,
  STUDIO_OUTPUT_SCHEMA,
  STUDIO_TOOLS,
} from '@/components/vibe/studio-agent';
import type { NativeTraceEntry } from '@/lib/native-agent-trace';
import type { Tool as AiTool } from 'ai';
import {
  BookOpenIcon,
  BrainIcon,
  CodeIcon,
  DownloadIcon,
  FilePenIcon,
  GlobeIcon,
  ImageIcon,
  LandmarkIcon,
  SearchIcon,
  SparklesIcon,
  UsersIcon,
} from 'lucide-react';
import type { Ref } from 'react';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);

const field = (value: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key]) return value[key] as string;
  }
  return '';
};

const searchResults = (results: Record<string, unknown>[]): Record<string, unknown>[] =>
  results.flatMap((result) => {
    const sources = Array.isArray(result.sources)
      ? result.sources.flatMap((source): Record<string, unknown>[] =>
          typeof source === 'string'
            ? [{ url: source }]
            : typeof source === 'object' && source !== null
              ? [source as Record<string, unknown>]
              : []
        )
      : [];
    return sources.length ? sources.map((source) => ({ ...result, ...source, sources: undefined })) : [result];
  });

const href = (value: string) => (/^https?:\/\//i.test(value) ? value : undefined);

function hostnameOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function faviconOf(url?: string): string {
  const host = hostnameOf(url);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32` : '';
}

const failed = (entry: NativeTraceEntry) =>
  Boolean(entry.error) || /fail|error|cancel|incomplete/.test(entry.status ?? '');
const notification = (entry: NativeTraceEntry) =>
  ['submitted', 'ended', 'interrupted'].includes(entry.status ?? '');
const state = (entry: NativeTraceEntry) =>
  failed(entry)
    ? ('output-error' as const)
    : entry.done
      ? ('output-available' as const)
      : ('input-available' as const);
const label = (entry: NativeTraceEntry, name: string) =>
  `${name} · ${
    entry.status === 'submitted'
      ? 'Query submitted'
      : entry.status === 'ended'
        ? 'Run ended'
        : entry.status === 'interrupted'
          ? 'Interrupted'
          : failed(entry)
            ? 'Failed'
            : entry.done
              ? 'Completed'
              : 'Running'
  }`;
const status = (entry: NativeTraceEntry) =>
  entry.done || failed(entry) ? ('complete' as const) : ('active' as const);
const error = (entry: NativeTraceEntry) =>
  entry.error ? text(entry.error) : failed(entry) ? entry.status : undefined;

function splitOutputHtml(raw: string): { beforeHtml: string; htmlDoc: string; afterHtml: string } {
  const start = /<!doctype\s+html|<html\b/i.exec(raw);
  if (!start) {
    return {
      beforeHtml: raw.replace(/```(?:html)?\s*$/i, '').trim(),
      htmlDoc: '',
      afterHtml: '',
    };
  }
  const beforeHtml = raw
    .slice(0, start.index)
    .replace(/```(?:html)?\s*$/i, '')
    .trim();
  const rest = raw.slice(start.index);
  const end = /<\/html\s*>/i.exec(rest);
  if (!end) {
    return { beforeHtml, htmlDoc: rest, afterHtml: '' };
  }
  const htmlEndIndex = end.index + end[0].length;
  const htmlDoc = rest.slice(0, htmlEndIndex);
  const afterHtml = rest
    .slice(htmlEndIndex)
    .replace(/^\s*```/, '')
    .trim();
  return { beforeHtml, htmlDoc, afterHtml };
}

function extractSandboxHtml(entry: Extract<NativeTraceEntry, { kind: 'sandbox' }>): string {
  for (const candidate of [entry.stdout, entry.code]) {
    const start = /<!doctype\s+html|<html\b/i.exec(candidate);
    if (start) {
      const slice = candidate.slice(start.index);
      const end = /<\/html\s*>/i.exec(slice);
      const doc = end ? slice.slice(0, end.index + end[0].length) : slice;
      if (/<(?:head|body)\b/i.test(doc) && doc.length > 120) {
        return doc;
      }
    }
  }
  return '';
}

function TraceEntry({ entry, streamedHtml }: { entry: NativeTraceEntry; streamedHtml?: string }) {
  switch (entry.kind) {
    case 'reasoning':
      return (
        <ChainOfThoughtStep
          data-native-trace-kind="reasoning"
          icon={BrainIcon}
          label={label(entry, 'Reasoning')}
          status={status(entry)}
        >
          <MessageResponse mode="streaming" isAnimating={!entry.done && !failed(entry)}>
            {entry.text}
          </MessageResponse>
          {error(entry) && <p role="alert">{error(entry)}</p>}
        </ChainOfThoughtStep>
      );

    case 'output': {
      const { beforeHtml, htmlDoc, afterHtml } = splitOutputHtml(entry.text);
      const combinedReasoning = [beforeHtml, afterHtml].filter(Boolean).join('\n\n');
      return (
        <>
          {combinedReasoning && (
            <ChainOfThoughtStep
              data-native-trace-kind="reasoning"
              icon={BrainIcon}
              label={label(entry, 'Reasoning')}
              status={status(entry)}
            >
              <MessageResponse mode="streaming" isAnimating={!entry.done && !failed(entry)}>
                {combinedReasoning}
              </MessageResponse>
              {error(entry) && <p role="alert">{error(entry)}</p>}
            </ChainOfThoughtStep>
          )}
          {htmlDoc && (
            <ChainOfThoughtStep
              data-native-trace-kind="sandbox"
              icon={CodeIcon}
              label={label(entry, 'Sandbox HTML deliverable')}
              status={status(entry)}
            >
              <Sandbox defaultOpen>
                <SandboxHeader title="Streamed HTML · index.html" state={state(entry)} />
                <SandboxContent>
                  <SandboxTabs defaultValue="code">
                    <SandboxTabsBar>
                      <SandboxTabsList>
                        <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
                        <SandboxTabsTrigger value="preview">Live Preview</SandboxTabsTrigger>
                      </SandboxTabsList>
                    </SandboxTabsBar>
                    <SandboxTabContent value="code">
                      <CodeBlock code={htmlDoc} language="html" />
                    </SandboxTabContent>
                    <SandboxTabContent value="preview">
                      <iframe
                        title="Sandbox HTML preview"
                        srcDoc={htmlDoc}
                        sandbox="allow-scripts"
                        referrerPolicy="no-referrer"
                        className="native-trace__sandbox-iframe"
                      />
                    </SandboxTabContent>
                  </SandboxTabs>
                </SandboxContent>
              </Sandbox>
            </ChainOfThoughtStep>
          )}
        </>
      );
    }

    case 'search': {
      const Icon =
        entry.searchKind === 'finance'
          ? LandmarkIcon
          : entry.searchKind === 'people'
            ? UsersIcon
            : SearchIcon;
      const searchTitle =
        entry.searchKind === 'finance'
          ? 'Financial search'
          : entry.searchKind === 'people'
            ? 'People search'
            : 'Web search';
      const flattened = searchResults(entry.results);
      const financeMarkdownBlocks =
        entry.searchKind === 'finance'
          ? Array.from(
              new Set(
                entry.results
                  .map((r) => field(r, 'content', 'summary', 'description'))
                  .filter(Boolean)
              )
            )
          : [];
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          data-search-kind={entry.searchKind}
          icon={Icon}
          label={label(entry, searchTitle)}
          description={entry.queries.join(' · ')}
          status={status(entry)}
        >
          <ChainOfThoughtSearchResults className="native-trace__search-results">
            {flattened.map((result, index) => {
              const url = href(field(result, 'url', 'link'));
              const host = hostnameOf(url);
              const favicon = faviconOf(url);
              const tickerList = Array.isArray(result.tickers)
                ? result.tickers.filter((t): t is string => typeof t === 'string').join(', ')
                : field(result, 'symbol', 'ticker');
              const categoryLabel = field(result, 'category');
              const financeLabel = [
                tickerList,
                categoryLabel ? categoryLabel.replace(/_/g, ' ') : '',
              ]
                .filter(Boolean)
                .join(' · ');
              const title =
                field(result, 'title', 'name', 'full_name') ||
                financeLabel ||
                host ||
                url ||
                field(result, 'snippet', 'text', 'description', 'content').slice(0, 120);
              if (!title) return null;
              const snippetText = field(
                result,
                'snippet',
                'people_headline',
                'description',
                'text',
                'content'
              );
              const inner = (
                <span className="native-trace__search-pill-inner">
                  {favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={favicon}
                      alt=""
                      width={14}
                      height={14}
                      loading="lazy"
                      className="native-trace__search-favicon"
                    />
                  ) : (
                    <Icon className="native-trace__search-fallback-icon" size={12} />
                  )}
                  <span className="native-trace__search-title">{title}</span>
                  {host && title !== host && (
                    <span className="native-trace__search-domain">{host}</span>
                  )}
                </span>
              );
              return (
                <ChainOfThoughtSearchResult
                  key={index}
                  title={snippetText}
                  className="native-trace__search-pill"
                  style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                >
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="native-trace__search-link"
                    >
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </ChainOfThoughtSearchResult>
              );
            })}
          </ChainOfThoughtSearchResults>
          {financeMarkdownBlocks.map((md, idx) => (
            <div key={idx} className="native-trace__finance-markdown">
              <MessageResponse>{md}</MessageResponse>
            </div>
          ))}
          {error(entry) && <p role="alert">{error(entry)}</p>}
        </ChainOfThoughtStep>
      );
    }

    case 'imageSearch':
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={ImageIcon}
          label={label(entry, 'Image search')}
          description={entry.queries.join(' · ')}
          status={status(entry)}
        >
          <div className="native-trace__images">
            {entry.results.map((result, index) => {
              const source = href(field(result, 'image_url', 'imageUrl', 'url', 'thumbnail_url'));
              const title = field(result, 'title', 'caption', 'alt');
              const origin = href(field(result, 'origin_url', 'originUrl', 'source_url'));
              return source ? (
                <ChainOfThoughtImage
                  key={index}
                  caption={title}
                  className="native-trace__image-card"
                  style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
                >
                  {origin ? (
                    <a href={origin} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={source} alt={title || 'Search result'} loading="lazy" />
                    </a>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={source} alt={title || 'Search result'} loading="lazy" />
                  )}
                </ChainOfThoughtImage>
              ) : null;
            })}
          </div>
          {error(entry) && <p role="alert">{error(entry)}</p>}
        </ChainOfThoughtStep>
      );

    case 'fetch':
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={GlobeIcon}
          label={label(entry, 'URL Fetch')}
          description={entry.urls.join(' · ')}
          status={status(entry)}
        >
          <Tool defaultOpen>
            {!notification(entry) && (
              <ToolHeader type="tool-fetch_url" title="fetch_url" state={state(entry)} />
            )}
            <ToolContent>
              <ToolInput input={{ urls: entry.urls }} />
              <ToolOutput
                output={entry.contents.length > 0 ? entry.contents : undefined}
                errorText={error(entry)}
              />
            </ToolContent>
          </Tool>
        </ChainOfThoughtStep>
      );

    case 'sandbox': {
      const previewHtml = extractSandboxHtml(entry) || streamedHtml || '';
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={CodeIcon}
          label={label(entry, 'Sandbox')}
          status={status(entry)}
        >
          <Sandbox defaultOpen>
            {!notification(entry) && (
              <SandboxHeader title={`Sandbox · ${entry.language}`} state={state(entry)} />
            )}
            <SandboxContent>
              <SandboxTabs defaultValue="code">
                <SandboxTabsBar>
                  <SandboxTabsList>
                    <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
                    <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
                    {previewHtml && <SandboxTabsTrigger value="preview">Preview</SandboxTabsTrigger>}
                  </SandboxTabsList>
                </SandboxTabsBar>
                <SandboxTabContent value="code">
                  <CodeBlock
                    code={entry.code}
                    language={
                      entry.language === 'python'
                        ? 'python'
                        : entry.language === 'bash'
                          ? 'bash'
                          : entry.language === 'javascript'
                            ? 'javascript'
                            : entry.language === 'typescript'
                              ? 'typescript'
                              : 'log'
                    }
                  />
                </SandboxTabContent>
                <SandboxTabContent value="output">
                  <CodeBlock
                    code={[entry.stdout, entry.stderr, error(entry)].filter(Boolean).join('\n') || 'Completed with exit code 0.'}
                    language="log"
                  />
                  {entry.results.length > 0 && (
                    <CodeBlock code={text(entry.results)} language="json" />
                  )}
                </SandboxTabContent>
                {previewHtml && (
                  <SandboxTabContent value="preview">
                    <iframe
                      title="Sandbox HTML preview"
                      srcDoc={previewHtml}
                      sandbox="allow-scripts"
                      referrerPolicy="no-referrer"
                      className="native-trace__sandbox-iframe"
                    />
                  </SandboxTabContent>
                )}
              </SandboxTabs>
            </SandboxContent>
          </Sandbox>
        </ChainOfThoughtStep>
      );
    }

    case 'directTool':
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={GlobeIcon}
          label={label(entry, entry.name)}
          status={status(entry)}
        >
          <Tool defaultOpen>
            {!notification(entry) && (
              <ToolHeader type={`tool-${entry.name}`} title={entry.name} state={state(entry)} />
            )}
            <ToolContent>
              {entry.input !== undefined && <ToolInput input={entry.input} />}
              <ToolOutput output={entry.output} errorText={error(entry)} />
            </ToolContent>
          </Tool>
        </ChainOfThoughtStep>
      );

    case 'skill':
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={BookOpenIcon}
          label={label(entry, `Skill loaded · ${entry.name}`)}
          status={status(entry)}
        />
      );

    case 'fileOperation':
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={FilePenIcon}
          label={label(entry, entry.operation.replace(/^sandbox_/, '').replaceAll('_', ' '))}
          status={status(entry)}
        >
          <TaskItem className="native-trace__file" status={failed(entry) ? 'error' : entry.done ? 'completed' : 'in_progress'}>
            <TaskItemFile filename={entry.path}>{entry.path}</TaskItemFile>
            {error(entry)}
          </TaskItem>
        </ChainOfThoughtStep>
      );

    case 'file': {
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={FilePenIcon}
          label={label(entry, `Shared deliverable · ${entry.filename}`)}
          status={status(entry)}
        >
          <TaskItem className="native-trace__file" status="completed">
            <TaskItemFile filename={entry.filename}>{entry.filename}</TaskItemFile>
          </TaskItem>
        </ChainOfThoughtStep>
      );
    }

    case 'notice':
      return (
        <ChainOfThoughtStep
          data-native-trace-kind={entry.kind}
          icon={SparklesIcon}
          label={label(entry, entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name)}
          status={status(entry)}
        >
          {entry.detail ? <ToolOutput output={entry.detail} errorText={error(entry)} /> : null}
        </ChainOfThoughtStep>
      );
  }
}

export function NativeAgentTrace({
  title,
  entries,
  active,
  className,
  bodyRef,
  model = STUDIO_MODEL,
  agentName = 'Cato Studio Orchestrator',
  streamedHtml,
}: {
  title: string;
  entries: NativeTraceEntry[];
  active?: boolean;
  className?: string;
  bodyRef?: Ref<HTMLDivElement>;
  agentName?: string;
  model?: string;
  streamedHtml?: string;
}) {
  const hasError = entries.some(failed);
  const completedCount = entries.filter((e) => e.done).length;
  const taskStatus: TaskStatus = hasError
    ? 'error'
    : active
      ? 'in_progress'
      : entries.length > 0
        ? 'completed'
        : 'pending';

  return (
    <Agent className={className} data-native-agent-trace>
      <AgentHeader name={agentName} model={model} />
      <AgentContent>
        <details className="native-trace__spec">
          <summary className="native-trace__spec-summary">
            Agent Configuration · Instructions, {STUDIO_TOOLS.length} Tools &amp; Output Schema
          </summary>
          <div className="native-trace__spec-body">
            <AgentInstructions>{STUDIO_AGENT_INSTRUCTIONS_MD}</AgentInstructions>
            <AgentTools type="multiple">
              {STUDIO_TOOLS.map((tool) => (
                <AgentTool
                  key={tool.type}
                  value={tool.type}
                  tool={tool as unknown as AiTool & { description?: string }}
                />
              ))}
            </AgentTools>
            <AgentOutput schema={STUDIO_OUTPUT_SCHEMA} />
          </div>
        </details>

        <Task defaultOpen status={taskStatus}>
          <TaskTrigger
            title={title}
            status={taskStatus}
            progress={
              entries.length > 0
                ? { completed: completedCount, total: entries.length }
                : undefined
            }
          />
          <TaskContent>
            <ChainOfThought defaultOpen>
              <ChainOfThoughtHeader>
                {active
                  ? `Streaming Reasoning & Tool Trace (${entries.length} steps)`
                  : `Reasoning & Tool Trace (${entries.length} steps)`}
              </ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                <div ref={bodyRef} className="native-trace__entries">
                  {entries.map((entry) => (
                    <TraceEntry
                      key={entry.id}
                      entry={entry}
                      streamedHtml={streamedHtml}
                    />
                  ))}
                </div>
              </ChainOfThoughtContent>
            </ChainOfThought>
          </TaskContent>
        </Task>
      </AgentContent>
    </Agent>
  );
}
