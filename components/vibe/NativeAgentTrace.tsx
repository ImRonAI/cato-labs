'use client';

import { Agent, AgentContent, AgentHeader } from '@/components/ai-elements/agent';
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtImage, ChainOfThoughtSearchResult, ChainOfThoughtSearchResults, ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { MessageResponse } from '@/components/ai-elements/message';
import { Sandbox, SandboxContent, SandboxHeader, SandboxTabContent, SandboxTabs, SandboxTabsBar, SandboxTabsList, SandboxTabsTrigger } from '@/components/ai-elements/sandbox';
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from '@/components/ai-elements/task';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import type { NativeTraceEntry } from '@/lib/native-agent-trace';
import { BookOpenIcon, BrainIcon, CodeIcon, DownloadIcon, FilePenIcon, GlobeIcon, ImageIcon, LandmarkIcon, SearchIcon, UsersIcon } from 'lucide-react';
import type { Ref } from 'react';

const text = (value: unknown): string => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
const field = (value: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (typeof value[key] === 'string' && value[key]) return value[key] as string;
  return '';
};
const searchResults = (results: Record<string, unknown>[]): Record<string, unknown>[] => results.flatMap(result => {
  const sources = Array.isArray(result.sources) ? result.sources.flatMap((source): Record<string, unknown>[] => typeof source === 'string' ? [{ url: source }] : typeof source === 'object' && source !== null ? [source as Record<string, unknown>] : []) : [];
  return sources.length ? sources.map(source => ({ ...result, ...source, sources: undefined })) : [result];
});
const href = (value: string) => /^https?:\/\//i.test(value) ? value : undefined;
const failed = (entry: NativeTraceEntry) => Boolean(entry.error) || /fail|error|cancel|incomplete/.test(entry.status ?? '');
const notification = (entry: NativeTraceEntry) => ['submitted', 'ended', 'interrupted'].includes(entry.status ?? '');
const state = (entry: NativeTraceEntry) => failed(entry) ? 'output-error' as const : entry.done ? 'output-available' as const : 'input-available' as const;
const label = (entry: NativeTraceEntry, name: string) => `${name} · ${entry.status === 'submitted' ? 'Query submitted' : entry.status === 'ended' ? 'Run ended' : entry.status === 'interrupted' ? 'Interrupted' : failed(entry) ? 'Failed' : entry.done ? 'Completed' : 'Running'}`;
const status = (entry: NativeTraceEntry) => entry.done || failed(entry) ? 'complete' as const : 'active' as const;
const error = (entry: NativeTraceEntry) => entry.error ? text(entry.error) : failed(entry) ? entry.status : undefined;

function TraceEntry({ entry }: { entry: NativeTraceEntry }) {
  switch (entry.kind) {
    case 'reasoning':
      return <ChainOfThoughtStep data-native-trace-kind={entry.kind} icon={BrainIcon} label={label(entry, entry.channel === 'summary' ? 'Reasoning summary' : 'Reasoning')} status={status(entry)}>
        <MessageResponse mode="streaming" isAnimating={!entry.done && !failed(entry)}>{entry.text}</MessageResponse>
        {error(entry) && <p role="alert">{error(entry)}</p>}
      </ChainOfThoughtStep>;
    case 'search': {
      const Icon = entry.searchKind === 'finance' ? LandmarkIcon : entry.searchKind === 'people' ? UsersIcon : SearchIcon;
      return <ChainOfThoughtStep data-native-trace-kind={entry.kind} icon={Icon} label={label(entry, `${entry.searchKind} search`)} description={entry.queries.join(' · ')} status={status(entry)}>
        <ChainOfThoughtSearchResults>
          {searchResults(entry.results).map((result, index) => {
            const url = href(field(result, 'url', 'link'));
            const title = field(result, 'title', 'name', 'symbol', 'ticker') || url || [field(result, 'category'), Array.isArray(result.tickers) ? result.tickers.join(', ') : '', field(result, 'snippet', 'text', 'description')].filter(Boolean).join(' · ');
            if (!title) return null;
            return <ChainOfThoughtSearchResult key={index} title={field(result, 'snippet', 'description', 'text')}>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer">{title}</a> : title}
            </ChainOfThoughtSearchResult>;
          })}
        </ChainOfThoughtSearchResults>
        {error(entry) && <p role="alert">{error(entry)}</p>}
      </ChainOfThoughtStep>;
    }
    case 'imageSearch':
      return <ChainOfThoughtStep data-native-trace-kind={entry.kind} icon={ImageIcon} label={label(entry, 'Image search')} description={entry.queries.join(' · ')} status={status(entry)}>
        {entry.results.map((result, index) => {
          const source = href(field(result, 'image_url', 'imageUrl', 'url', 'thumbnail_url'));
          const title = field(result, 'title', 'caption', 'alt');
          const origin = href(field(result, 'origin_url', 'originUrl', 'source_url'));
          return source ? <ChainOfThoughtImage key={index} caption={title}>
            {origin ? <a href={origin} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source} alt={title || 'Search result'} loading="lazy" />
            </a> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={source} alt={title || 'Search result'} loading="lazy" />}
          </ChainOfThoughtImage> : null;
        })}
        {error(entry) && <p role="alert">{error(entry)}</p>}
      </ChainOfThoughtStep>;
    case 'sandbox':
      return <ChainOfThoughtStep data-native-trace-kind={entry.kind} icon={CodeIcon} label={label(entry, 'Sandbox')} status={status(entry)}>
        <Sandbox defaultOpen>
          {!notification(entry) && <SandboxHeader title={`Sandbox · ${entry.language}`} state={state(entry)} />}
          <SandboxContent>
            <SandboxTabs defaultValue="code">
              <SandboxTabsBar><SandboxTabsList>
                <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
                <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
              </SandboxTabsList></SandboxTabsBar>
              <SandboxTabContent value="code"><CodeBlock code={entry.code} language={entry.language === 'python' ? 'python' : entry.language === 'bash' ? 'bash' : entry.language === 'javascript' ? 'javascript' : entry.language === 'typescript' ? 'typescript' : 'log'} /></SandboxTabContent>
              <SandboxTabContent value="output">
                <CodeBlock code={[entry.stdout, entry.stderr, error(entry)].filter(Boolean).join('\n')} language="log" />
                {entry.results.length > 0 && <CodeBlock code={text(entry.results)} language="json" />}
              </SandboxTabContent>
            </SandboxTabs>
          </SandboxContent>
        </Sandbox>
      </ChainOfThoughtStep>;
    case 'directTool':
      return <ChainOfThoughtStep data-native-trace-kind={entry.kind} icon={GlobeIcon} label={label(entry, entry.name)} status={status(entry)}>
        <Tool defaultOpen>
          {!notification(entry) && <ToolHeader type={`tool-${entry.name}`} title={entry.name} state={state(entry)} />}
          <ToolContent>
            {entry.input !== undefined && <ToolInput input={entry.input} />}
            <ToolOutput output={entry.output} errorText={error(entry)} />
          </ToolContent>
        </Tool>
      </ChainOfThoughtStep>;
    case 'skill':
      return <ChainOfThoughtStep data-native-trace-kind={entry.kind} icon={BookOpenIcon} label={label(entry, entry.name)} status={status(entry)} />;
    case 'fileOperation':
      return <TaskItem className="native-trace__file"><FilePenIcon size={16} />{entry.operation}<TaskItemFile>{entry.path}</TaskItemFile>{error(entry)}</TaskItem>;
    case 'file': {
      const url = entry.responseId ? `/api/vibe-files?r=${encodeURIComponent(entry.responseId)}&f=${encodeURIComponent(entry.fileId)}` : href(entry.url ?? '');
      return <TaskItem className="native-trace__file"><DownloadIcon size={16} />
        {url ? <a href={url} download={entry.filename}><TaskItemFile>{entry.filename}</TaskItemFile></a> : <TaskItemFile>{entry.filename}</TaskItemFile>}
      </TaskItem>;
    }
    case 'unknown':
      return <ChainOfThoughtStep data-native-trace-kind={entry.kind} label={label(entry, entry.name)} status={status(entry)}><ToolOutput output={entry.raw} errorText={error(entry)} /></ChainOfThoughtStep>;
  }
}

export function NativeAgentTrace({ title, entries, active, className, bodyRef, model, agentName = 'Website builder' }: {
  title: string;
  entries: NativeTraceEntry[];
  active?: boolean;
  className?: string;
  bodyRef?: Ref<HTMLDivElement>;
  agentName?: string;
  model?: string;
}) {
  return <Agent className={className} data-native-agent-trace>
    <AgentHeader name={agentName} model={model} />
    <AgentContent>
      <Task defaultOpen>
        <TaskTrigger title={title} />
        <TaskContent>
          <ChainOfThought defaultOpen>
            <ChainOfThoughtHeader>{active ? 'Live activity' : 'Activity'}</ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              <div ref={bodyRef} className="native-trace__entries">
                {entries.map(entry => <TraceEntry key={entry.id} entry={entry} />)}
              </div>
            </ChainOfThoughtContent>
          </ChainOfThought>
        </TaskContent>
      </Task>
    </AgentContent>
  </Agent>;
}
