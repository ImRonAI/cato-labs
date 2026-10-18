'use client';

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
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from '@/components/ai-elements/task';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import type { EditOp, SearchKind, Step } from '@/lib/agent-ui';
import {
  BookOpenIcon,
  BrainIcon,
  CodeIcon,
  DownloadIcon,
  FilePenIcon,
  GlobeIcon,
  ImageIcon,
  LandmarkIcon,
  MessageSquareIcon,
  SearchIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * AgentTrace — one agent run, rendered with Vercel AI Elements as written:
 *
 *   Task                       the outermost task container (title, collapsible)
 *   ├─ TaskTrigger
 *   └─ TaskContent
 *      └─ ChainOfThought       the reasoning chain
 *         ├─ ChainOfThoughtHeader
 *         └─ ChainOfThoughtContent
 *            ├─ ChainOfThoughtStep (every reasoning trace from the Agent API)
 *            ├─ ChainOfThoughtStep + ChainOfThoughtSearchResults → ChainOfThoughtSearchResult (web / finance / people)
 *            ├─ ChainOfThoughtStep + ChainOfThoughtImage (image_search)
 *            ├─ ChainOfThoughtStep + Tool (fetch_url & MCP/connectors)
 *            ├─ ChainOfThoughtStep + Sandbox (sandbox code execution)
 *            └─ TaskItem + TaskItemFile (sandbox file edits & shared files)
 */

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** favicon chip for a result URL — Google's s2 service */
export function Favicon({ url }: { url: string }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${hostOf(url)}&sz=32`}
      alt=""
      width={14}
      height={14}
      className="size-3.5 shrink-0 rounded-[3px]"
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

const SEARCH: Record<SearchKind, { icon: LucideIcon; active: string; done: string }> = {
  web: { icon: SearchIcon, active: 'Searching the web', done: 'Searched the web' },
  finance: { icon: LandmarkIcon, active: 'Pulling market data', done: 'Pulled market data' },
  people: { icon: UsersIcon, active: 'Searching people', done: 'Searched people' },
  image: { icon: ImageIcon, active: 'Gathering visual references', done: 'Gathered visual references' },
};

const EDIT_VERBS: Record<EditOp, string> = {
  read: 'Read',
  write: 'Wrote',
  edit: 'Edited',
  patch: 'Patched',
  glob: 'Matched',
  grep: 'Searched',
};

const fileHref = (responseId: string, fileId: string) =>
  `/api/vibe-files?r=${encodeURIComponent(responseId)}&f=${encodeURIComponent(fileId)}`;

const kb = (bytes?: number) =>
  typeof bytes === 'number' ? ` · ${bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`}` : '';

function renderStep(step: Step): ReactNode {
  switch (step.t) {
    case 'thought': {
      const streaming = step.done === false;
      return (
        <ChainOfThoughtStep
          key={step.id}
          icon={BrainIcon}
          label={streaming ? 'Reasoning' : 'Reasoned'}
          status={streaming ? 'active' : 'complete'}
        >
          <MessageResponse
            className="text-foreground text-sm leading-relaxed"
            mode="streaming"
            isAnimating={streaming}
          >
            {step.text}
          </MessageResponse>
        </ChainOfThoughtStep>
      );
    }
    case 'skill':
      return (
        <ChainOfThoughtStep
          key={step.id}
          icon={BookOpenIcon}
          label={`Loaded the ${step.name} skill`}
          status="complete"
        />
      );
    case 'mcp': {
      const isTelnyx = step.server.toLowerCase() === 'telnyx' && step.tool !== 'list_tools';
      const state = !step.done ? 'input-available' : step.ok ? 'output-available' : 'output-error';
      const stepLabel = isTelnyx
        ? !step.done
          ? 'Texting the team'
          : step.ok
            ? 'Passed to the team by text'
            : 'Text to the team failed'
        : `${step.server} · ${step.tool}`;
      return (
        <ChainOfThoughtStep
          key={step.id}
          icon={MessageSquareIcon}
          label={stepLabel}
          description={isTelnyx ? undefined : !step.done ? 'Running' : step.ok ? 'Completed' : 'Failed'}
          status={step.done ? 'complete' : 'active'}
        >
          <Tool className="mb-0 bg-card" defaultOpen={false}>
            <ToolHeader
              type={`tool-${step.tool}`}
              title={`${step.server} · ${step.tool}`}
              state={state}
            />
            <ToolContent>
              {step.input && <ToolInput input={step.input} />}
              <ToolOutput
                output={
                  step.output ??
                  (step.done && step.ok
                    ? isTelnyx
                      ? 'SMS handoff delivered (visitor details redacted)'
                      : 'Completed'
                    : undefined)
                }
                errorText={step.errorText ?? (step.done && !step.ok ? 'Tool call failed' : undefined)}
              />
            </ToolContent>
          </Tool>
        </ChainOfThoughtStep>
      );
    }
    case 'search': {
      const meta = SEARCH[step.kind];
      const queryDescription = step.queries.length ? step.queries.map((q) => `“${q}”`).join('  ') : undefined;

      if (step.kind === 'image') {
        return (
          <ChainOfThoughtStep
            key={step.id}
            icon={ImageIcon}
            label={step.done ? meta.done : meta.active}
            description={queryDescription}
            status={step.done ? 'complete' : 'active'}
          >
            {step.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {step.images.map((img, idx) => (
                  <ChainOfThoughtImage
                    key={`${img.imageUrl}-${idx}`}
                    caption={img.title || hostOf(img.originUrl)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageUrl}
                      alt={img.title || 'Visual reference'}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="max-h-36 w-full rounded-md object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </ChainOfThoughtImage>
                ))}
              </div>
            )}
          </ChainOfThoughtStep>
        );
      }

      return (
        <ChainOfThoughtStep
          key={step.id}
          icon={meta.icon}
          label={step.done ? meta.done : meta.active}
          description={queryDescription}
          status={step.done ? 'complete' : 'active'}
        >
          {step.hits.length > 0 && (
            <ChainOfThoughtSearchResults>
              {step.hits.map((h, i) =>
                h.url ? (
                  <a key={`${h.url}-${i}`} href={h.url} target="_blank" rel="noreferrer noopener">
                    <ChainOfThoughtSearchResult>
                      <Favicon url={h.url} />
                      <span className="max-w-[240px] truncate">{h.title || hostOf(h.url)}</span>
                    </ChainOfThoughtSearchResult>
                  </a>
                ) : (
                  <ChainOfThoughtSearchResult key={`${h.title}-${i}`}>
                    <meta.icon className="size-3" />
                    <span className="max-w-[240px] truncate">{h.title}</span>
                  </ChainOfThoughtSearchResult>
                )
              )}
            </ChainOfThoughtSearchResults>
          )}
        </ChainOfThoughtStep>
      );
    }
    case 'fetch': {
      const state = step.done ? 'output-available' : 'input-available';
      return (
        <ChainOfThoughtStep
          key={step.id}
          icon={GlobeIcon}
          label={step.done ? 'Fetched URL content' : 'Fetching URL content'}
          description={step.urls.length ? step.urls.map(hostOf).join(', ') : undefined}
          status={step.done ? 'complete' : 'active'}
        >
          <Tool className="mb-0 bg-card" defaultOpen={step.done}>
            <ToolHeader type="tool-fetch_url" title="fetch_url" state={state} />
            <ToolContent>
              <ToolInput input={{ urls: step.urls }} />
              {step.done && (
                <ToolOutput
                  errorText={undefined}
                  output={
                    <ul className="space-y-1.5 p-3">
                      {step.hits.map((h, i) => (
                        <li key={`${h.url}-${i}`} className="flex items-center gap-2">
                          <Favicon url={h.url} />
                          <a
                            className="truncate hover:underline"
                            href={h.url}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {h.title || hostOf(h.url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}
            </ToolContent>
          </Tool>
        </ChainOfThoughtStep>
      );
    }
    case 'code': {
      const state = !step.done ? 'input-available' : step.failed ? 'output-error' : 'output-available';
      return (
        <ChainOfThoughtStep
          key={step.id}
          icon={CodeIcon}
          label={step.done ? `Executed ${step.language} in sandbox` : `Running ${step.language} in sandbox`}
          status={step.done ? 'complete' : 'active'}
        >
          <Sandbox className="mb-0 bg-card">
            <SandboxHeader title={`Sandbox · ${step.language}`} state={state} />
            <SandboxContent>
              <SandboxTabs defaultValue="code">
                <SandboxTabsBar>
                  <SandboxTabsList>
                    <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
                    <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
                  </SandboxTabsList>
                </SandboxTabsBar>
                <SandboxTabContent value="code">
                  {step.code ? (
                    <CodeBlock
                      code={step.code}
                      language={step.language === 'bash' ? 'bash' : 'python'}
                      className="rounded-none border-0"
                    />
                  ) : (
                    <p className="p-3 text-muted-foreground text-xs">Writing code…</p>
                  )}
                </SandboxTabContent>
                <SandboxTabContent value="output">
                  {step.stdout || step.stderr ? (
                    <CodeBlock
                      code={[step.stdout, step.stderr].filter(Boolean).join('\n')}
                      language="log"
                      className="rounded-none border-0"
                    />
                  ) : (
                    <p className="p-3 text-muted-foreground text-xs">{step.done ? 'No output.' : 'Running…'}</p>
                  )}
                </SandboxTabContent>
              </SandboxTabs>
            </SandboxContent>
          </Sandbox>
        </ChainOfThoughtStep>
      );
    }
    case 'edit':
      return (
        <TaskItem key={step.id} className="flex flex-wrap items-center gap-1.5">
          <FilePenIcon className="size-4" />
          {EDIT_VERBS[step.op]}
          {step.paths.map((p) => (
            <TaskItemFile key={p}>{p.split('/').pop() || p}</TaskItemFile>
          ))}
        </TaskItem>
      );
    case 'file':
      return (
        <TaskItem key={step.id} className="flex flex-wrap items-center gap-1.5">
          <DownloadIcon className="size-4" />
          Shared
          <a href={fileHref(step.responseId, step.fileId)} download={step.filename}>
            <TaskItemFile className="hover:border-primary hover:text-primary">
              <DownloadIcon className="size-3" />
              {step.filename}
              {kb(step.bytes)}
            </TaskItemFile>
          </a>
        </TaskItem>
      );
  }
}

export function AgentTrace({
  title,
  steps,
  active,
  header,
  defaultOpen = true,
  className,
  bodyRef,
}: {
  title: string;
  steps: Step[];
  active?: boolean;
  header?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Task defaultOpen={defaultOpen} className={className}>
      <TaskTrigger title={title} />
      <TaskContent>
        <ChainOfThought defaultOpen className="max-w-none space-y-2">
          <ChainOfThoughtHeader>{header ?? (active ? 'Working…' : 'Chain of Thought')}</ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            <div ref={bodyRef} className="space-y-3">
              {steps.length === 0 && active && (
                <ChainOfThoughtStep icon={BrainIcon} label="Thinking…" status="active" />
              )}
              {steps.map(renderStep)}
            </div>
          </ChainOfThoughtContent>
        </ChainOfThought>
      </TaskContent>
    </Task>
  );
}
