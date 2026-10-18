'use client';

import { useEffect, useRef, useState } from 'react';
import { AsteriskIcon, CheckCircle2Icon, CircleDashedIcon, CircleStopIcon } from 'lucide-react';
import { NativeAgentTrace } from '@/components/vibe/NativeAgentTrace';
import { FileTree, FileTreeFile, FileTreeFolder } from '@/components/ai-elements/file-tree';
import { CodeBlock, CodeBlockHeader, CodeBlockFilename, CodeBlockCopyButton } from '@/components/ai-elements/code-block';
import { Terminal, TerminalHeader, TerminalTitle, TerminalContent, TerminalCopyButton } from '@/components/ai-elements/terminal';
import { Plan, PlanHeader, PlanTitle, PlanDescription, PlanAction, PlanContent, PlanTrigger } from '@/components/ai-elements/plan';
import { Queue, QueueSection, QueueSectionLabel, QueueSectionTrigger, QueueSectionContent, QueueList, QueueItem, QueueItemIndicator, QueueItemContent } from '@/components/ai-elements/queue';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from '@/components/ai-elements/checkpoint';
import { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from '@/components/ai-elements/task';
import LiveCanvas from '@/components/vibe/LiveCanvas';
import { fileHref } from '@/lib/agent-ui';
import { applyNativeTrace, hydrateNativeTrace, type NativeTraceEntry } from '@/lib/native-agent-trace';
import type { AgentEvent } from '@/lib/pplx';
import '../../ai-elements.css';
import './vibe.css';
import './studio.css';

type Status = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'disconnected' | 'cancelling';
type SharedFile = { id: string; filename: string; bytes: number };
type ProjectFileNode = { kind: 'file'; name: string; file: SharedFile } | { kind: 'folder'; name: string; path: string; children: ProjectFileNode[] };
function projectFileTree(files: SharedFile[]): ProjectFileNode[] {
  const roots: ProjectFileNode[] = [];
  for (const file of files) {
    const parts = file.filename.split(/[\\/]/).filter(Boolean);
    const name = parts.pop() || file.filename;
    let children = roots;
    const ancestors: string[] = [];
    for (const part of parts) {
      ancestors.push(part);
      const path = `folder:${ancestors.map(encodeURIComponent).join('/')}`;
      let folder = children.find((node): node is Extract<ProjectFileNode, { kind: 'folder' }> => node.kind === 'folder' && node.path === path);
      if (!folder) { folder = { kind: 'folder', name: part, path, children: [] }; children.push(folder); }
      children = folder.children;
    }
    children.push({ kind: 'file', name, file });
  }
  return roots;
}
function ProjectFiles({ nodes }: { nodes: ProjectFileNode[] }) {
  return nodes.map(node => node.kind === 'folder'
    ? <FileTreeFolder key={node.path} path={node.path} name={node.name}><ProjectFiles nodes={node.children} /></FileTreeFolder>
    : <FileTreeFile key={node.file.id} path={node.file.id} name={node.name} title={node.file.filename} />);
}
function workTitle(entry: NativeTraceEntry): string {
  switch (entry.kind) {
    case 'search': return `${entry.searchKind === 'web' ? 'Web' : entry.searchKind === 'people' ? 'People' : 'Financial'} search`;
    case 'imageSearch': return 'Image search';
    case 'sandbox': return 'Sandbox execution';
    case 'directTool': case 'skill': case 'unknown': return entry.name;
    case 'fileOperation': return `${entry.operation.replace(/^sandbox_/, '').replaceAll('_', ' ')}${entry.path ? ` · ${entry.path}` : ''}`;
    case 'file': return entry.filename;
    case 'reasoning': return 'Provider reasoning';
  }
}
type Attachment = { type: 'input_file'; filename: string; file_data: string } | { type: 'input_text'; filename: string; text: string };
interface Build {
  localId: string;
  name: string;
  prompt: string;
  responseId: string;
  previousResponseId?: string;
  cancelRequested?: boolean;
  status: Status;
  sequence: number;
  texts: Record<string, string>;
  trace: NativeTraceEntry[];
  traceHydrated?: boolean;
  traceVersion?: number;
  previewFilename?: string;
  previewFragment?: string;
  previewHtml?: string;
  navigating?: boolean;
  chatResponseId?: string;
  chatPendingResponseId?: string;
  files: SharedFile[];
  error: string;
  events: number;
}
type SavedBuild = Omit<Build, 'trace'> & { trace?: NativeTraceEntry[]; steps?: unknown[] };
const STORAGE = 'cato-native-builds-v1';
const terminal = (status: string) => ['completed', 'failed', 'cancelled', 'incomplete'].includes(status);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const messageOf = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (!record(value)) return 'The provider could not complete this request.';
  if (typeof value.message === 'string') return value.message;
  return value.error ? messageOf(value.error) : 'The provider could not complete this request.';
};
function htmlOf(build: Build): string {
  let html = '';
  for (const text of Object.values(build.texts)) {
    const start = /<!doctype\s+html|<html\b/i.exec(text);
    if (!start) continue;
    const candidate = text.slice(start.index);
    const end = /<\/html\s*>/i.exec(candidate);
    const document = end ? candidate.slice(0, end.index + end[0].length) : candidate;
    if (document.length > html.length) html = document;
  }
  return html;
}
function proseOf(build: Build): string {
  return Object.values(build.texts).map((text) => {
    const start = /<!doctype\s+html|<html\b/i.exec(text);
    return (start ? text.slice(0, start.index) : text).replace(/```(?:html)?\s*$/i, '').trim();
  }).filter(Boolean).join('\n\n');
}
async function responseError(response: Response): Promise<string> {
  const text = await response.text();
  try { return messageOf(JSON.parse(text)); } catch { return text || `Request failed (${response.status}).`; }
}

// Transport only: Perplexity owns reasoning, tool execution, skills and the agent loop.
async function consumeEvents(response: Response, receive: (event: AgentEvent) => void) {
  if (!response.ok) throw new Error(await responseError(response));
  if (!response.body) throw new Error('The response did not include a stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let ended = false;
  const consume = (block: string) => {
    const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data) return;
    if (data === '[DONE]') { ended = true; return; }
    const event: unknown = JSON.parse(data);
    if (!record(event) || typeof event.type !== 'string') throw new Error('Invalid provider stream event.');
    receive(event as AgentEvent);
    ended = event.type === 'error' || ['response.completed', 'response.failed', 'response.cancelled', 'response.incomplete'].includes(event.type);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        if (ended) { await reader.cancel(); return; }
      }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
  } finally { reader.releaseLock(); }
}

export default function VibeCoder() {
  const [visitedBuilds, setVisitedBuilds] = useState<Set<string>>(new Set());
  const [selectedBuild, setSelectedBuild] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'preview' | 'code'>('preview');
  const [mobilePanel, setMobilePanel] = useState<'files' | 'workspace' | 'agent'>('agent');
  const [source, setSource] = useState<{ buildId: string; fileId: string; filename: string; text: string; loading: boolean; error: string; binary: boolean } | null>(null);
  const fileRequest = useRef(0);
  const [prompt, setPrompt] = useState('');
  const [previousId, setPreviousId] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);
  const [formError, setFormError] = useState('');
  const [builds, setBuilds] = useState<Build[]>([]);
  const [storageError, setStorageError] = useState('');
  const live = useRef<Build[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const paint = useRef<number | null>(null);
  const mounted = useRef(false);

  function publish() {
    if (!mounted.current || paint.current !== null) return;
    paint.current = requestAnimationFrame(() => {
      paint.current = null;
      const next = live.current.map((build) => ({ ...build, texts: { ...build.texts } }));
      setBuilds(next);
      try { sessionStorage.setItem(STORAGE, JSON.stringify(next)); }
      catch { setStorageError('This browser could not save the session. Keep this tab open to retain the preview.'); }
    });
  }

  useEffect(() => {
    mounted.current = true;
    const restoreController = new AbortController();
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE) || '[]');
      if (Array.isArray(saved)) {
        const restored = saved.filter((value): value is SavedBuild => record(value)
          && typeof value.localId === 'string' && typeof value.name === 'string'
          && typeof value.prompt === 'string' && typeof value.responseId === 'string'
          && typeof value.status === 'string' && typeof value.sequence === 'number'
          && record(value.texts) && Object.values(value.texts).every((text) => typeof text === 'string')
          && (value.trace === undefined || Array.isArray(value.trace)) && Array.isArray(value.files));
        live.current = restored.map(({ steps: _legacySteps, ...build }) => ({ ...build, trace: build.trace || [], traceHydrated: build.traceVersion === 2 && Boolean(build.traceHydrated), status: terminal(build.status) ? build.status : 'disconnected' }));
        setBuilds(live.current);
        setSelectedBuild(live.current.at(-1)?.localId ?? null);
        setVisitedBuilds(new Set(live.current.slice(-1).map(entry => entry.localId)));
        for (const build of live.current.filter((entry) => !entry.traceHydrated && entry.responseId)) {
          void fetch(`/api/vibe-build?r=${encodeURIComponent(build.responseId)}`, { signal: restoreController.signal })
            .then(async (response) => {
              if (!response.ok) throw new Error(await responseError(response));
              const value: unknown = await response.json();
              if (!record(value)) throw new Error('Invalid response snapshot.');
              snapshot(build, value);
              if (!terminal(build.status)) build.status = 'disconnected';
              publish();
            })
            .catch((error: unknown) => {
              if (!restoreController.signal.aborted) { build.error = messageOf(error); publish(); }
            });
        }
      }
    } catch { setStorageError('The saved studio session could not be restored. Start a new brief below.'); }
    const active = controllers.current;
    return () => {
      mounted.current = false;
      restoreController.abort();
      active.forEach((controller) => controller.abort());
      active.clear();
      if (paint.current !== null) cancelAnimationFrame(paint.current);
      paint.current = null;
    };
  }, []);

  function snapshot(build: Build, response: Record<string, unknown>, includeTrace = true) {
    if (typeof response.id === 'string') build.responseId = response.id;
    if (typeof response.status === 'string' && ['queued', 'in_progress', 'completed', 'failed', 'cancelled', 'incomplete', 'cancelling'].includes(response.status)) {
      build.status = response.status as Status;
      if (build.cancelRequested && !terminal(build.status)) build.status = 'cancelling';
    }
    if (response.error && build.status !== 'cancelled') build.error = messageOf(response.error);
    if (build.status === 'cancelled') build.error = '';
    if (includeTrace) {
      build.trace = hydrateNativeTrace(build.trace, response);
      build.traceHydrated = true;
      build.traceVersion = 2;
    }
    if (Array.isArray(response.output)) {
      response.output.forEach((item: unknown, index: number) => {
        if (!record(item)) return;
        if (item.type === 'message' && Array.isArray(item.content)) {
          const text = item.content.filter(record).map((part) => typeof part.text === 'string' ? part.text : '').join('');
          if (text) build.texts[typeof item.id === 'string' ? item.id : `output-${index}`] = text;
        }
      });
    }
  }

  function receive(build: Build, event: AgentEvent) {
    if (typeof event.sequence_number === 'number') {
      if (event.sequence_number <= build.sequence) return;
      build.sequence = event.sequence_number;
    }
    build.events += 1;
    if (event.response && record(event.response)) snapshot(build, event.response, false);
    const id = typeof event.item_id === 'string' ? event.item_id : `output-${event.output_index ?? 0}`;
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      build.texts[id] = (build.texts[id] || '') + event.delta;
    } else if (event.type === 'response.output_text.done' && typeof event.text === 'string') {
      build.texts[id] = event.text;
    }
    if (event.type === 'response.output_item.done' && record(event.item) && event.item.type === 'message') {
      snapshot(build, { output: [event.item] }, false);
    }
    build.trace = applyNativeTrace(build.trace, event);
    if (event.type === 'error' || event.type === 'response.failed') {
      build.status = 'failed';
      build.error = messageOf(event.response?.error || event.error || event);
    } else if (event.type === 'response.cancelled') build.status = 'cancelled';
    else if (event.type === 'response.incomplete') {
      build.status = 'incomplete';
      build.error ||= 'The provider ended this run before it was complete.';
    }
    publish();
  }

  async function refreshFiles(build: Build, signal?: AbortSignal) {
    if (!build.responseId) return;
    const response = await fetch(`/api/vibe-files?r=${encodeURIComponent(build.responseId)}`, { signal });
    if (!response.ok) throw new Error(await responseError(response));
    const value: unknown = await response.json();
    if (!record(value) || !Array.isArray(value.data)) throw new Error('The provider returned an invalid file list.');
    build.files = value.data.filter((file): file is SharedFile => record(file)
      && typeof file.id === 'string' && typeof file.filename === 'string' && typeof file.bytes === 'number');
    publish();
  }

  async function navigate(build: Build, href: string) {
    if (build.navigating || !build.responseId) return;
    build.navigating = true;
    build.error = '';
    publish();
    try {
      const destination = new URL(href, `https://canvas.local/${build.previewFilename || 'index.html'}`);
      if (destination.origin !== 'https://canvas.local') throw new Error('Only generated website pages can open in this preview.');
      const filename = decodeURIComponent(destination.pathname).replace(/^\/+/, '');
      await refreshFiles(build);
      const candidates = [filename || 'index.html', `${filename}.html`, `${filename.replace(/\/$/, '')}/index.html`];
      const matches = build.files.filter(file => candidates.includes(file.filename.replace(/^\/+/, '')));
      if (matches.length !== 1 || !/\.html?$/i.test(matches[0].filename)) throw new Error('This page has not been shared by the agent yet. Try again when the build finishes.');
      const file = matches[0];
      const response = await fetch(fileHref(build.responseId, file.id));
      if (!response.ok) throw new Error(await responseError(response));
      build.previewHtml = await response.text();
      build.previewFilename = file.filename;
      build.previewFragment = destination.hash;
    } catch (error) { build.error = messageOf(error); }
    finally { build.navigating = false; publish(); }
  }

  async function connect(build: Build, files?: Attachment[]) {
    if (controllers.current.has(build.localId)) return;
    const controller = new AbortController();
    controllers.current.set(build.localId, controller);
    const { signal } = controller;
    build.error = '';
    build.status = build.responseId ? 'in_progress' : 'queued';
    publish();
    try {
      const base = `/api/vibe-build?r=${encodeURIComponent(build.responseId)}`;
      const response = await fetch(build.responseId
        ? `${base}&stream=true${build.sequence >= 0 ? `&starting_after=${build.sequence}` : ''}` : '/api/vibe-build', build.responseId
        ? { signal }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: build.prompt, files, previous_response_id: build.previousResponseId || undefined }), signal });
      if (build.responseId && response.status === 400) {
        // Perplexity's reconnect window can expire; a snapshot remains retrievable.
        const current = await fetch(base, { signal });
        if (!current.ok) throw new Error(await responseError(current));
        const value: unknown = await current.json();
        if (!record(value)) throw new Error('Invalid response snapshot.');
        snapshot(build, value);
      } else {
        await consumeEvents(response, (event) => receive(build, event));
      }
      if (!terminal(build.status) && build.responseId) {
        // Cancellation can close SSE without a terminal event. Retrieve durable state.
        const deadline = Date.now() + 30_000;
        do {
          const current = await fetch(`/api/vibe-build?r=${encodeURIComponent(build.responseId)}`, { signal });
          if (!current.ok) throw new Error(await responseError(current));
          const value: unknown = await current.json();
          if (!record(value)) throw new Error('Invalid response snapshot.');
          snapshot(build, value);
          publish();
          if (terminal(build.status) || !build.cancelRequested || Date.now() >= deadline) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } while (!signal.aborted);
      }
      if (!terminal(build.status)) {
        build.status = 'disconnected';
        build.error = 'The stream ended before a final status arrived. Reconnect to retrieve the agent’s latest progress.';
      } else if (['completed'].includes(build.status) && !/<\/html\s*>/i.test(htmlOf(build))) {
        build.error = 'The agent completed without a full HTML document. Its response and files are available below.';
      }
      if (['completed'].includes(build.status)) await refreshFiles(build, signal);
    } catch (error) {
      if (!signal.aborted) {
        if (!terminal(build.status)) build.status = build.responseId ? 'disconnected' : 'failed';
        build.error = error instanceof Error ? error.message : 'The request failed.';
      }
    } finally {
      controllers.current.delete(build.localId);
      publish();
    }
  }

  async function cancel(build: Build) {
    if (!build.responseId || terminal(build.status)) return;
    build.cancelRequested = true;
    try {
      const response = await fetch(`/api/vibe-build?r=${encodeURIComponent(build.responseId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      if (!terminal(build.status)) build.status = 'cancelling';
      publish();
      if (!terminal(build.status) && !controllers.current.has(build.localId)) await connect(build);
    } catch (error) { build.cancelRequested = false; build.error = messageOf(error); publish(); }
  }

  function submit() {
    if (!prompt.trim() || readingFiles) return;
    const build: Build = { localId: crypto.randomUUID(), name: `Builder ${live.current.length + 1}`, prompt: prompt.trim(),
      responseId: '', previousResponseId: previousId || undefined, status: 'queued', sequence: -1, texts: {}, trace: [], traceHydrated: true, traceVersion: 2, files: [], error: '', events: 0 };
    live.current = [...live.current, build];
    setSelectedBuild(build.localId);
    setVisitedBuilds(previous => new Set([...previous, build.localId]));
    setWorkspaceTab('preview');
    setMobilePanel('workspace');
    setSource(null);
    const files = attachments;
    setPrompt('');
    setPreviousId('');
    setAttachments([]);
    setFormError('');
    publish();
    void connect(build, files);
  }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setReadingFiles(true);
    setFormError('');
    try {
      if (Array.from(files).some((file) => !/\.(pdf|txt|md|csv|html|json|css|js|ts|tsx)$/i.test(file.name))) {
        throw new Error('Attach a PDF or a UTF-8 text/source file.');
      }
      if (files.length > 10 || Array.from(files).reduce((sum, file) => sum + file.size, 0) > 2.5 * 1024 * 1024) {
        throw new Error('Attach up to 10 documents, totaling 2.5 MB or less.');
      }
      const next = await Promise.all(Array.from(files).map(async (file): Promise<Attachment> => {
        if (!/\.pdf$/i.test(file.name)) {
          return { type: 'input_text', filename: file.name, text: new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()) };
        }
        return new Promise<Attachment>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve({ type: 'input_file', filename: file.name, file_data: reader.result })
          : reject(new Error(`Could not read ${file.name}.`));
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
        });
      }));
      setAttachments(next);
    } catch (error) { setFormError(messageOf(error)); }
    finally { setReadingFiles(false); }
  }

  async function openFile(build: Build, file: SharedFile) {
    const request = ++fileRequest.current;
    setWorkspaceTab('code');
    setMobilePanel('workspace');
    const binary = !/\.(html?|css|[cm]?js|jsx|tsx?|json|md|txt|csv|svg|xml|ya?ml|py|sh|toml|sql)$/i.test(file.filename);
    setSource({ buildId: build.localId, fileId: file.id, filename: file.filename, text: '', loading: !binary, error: '', binary });
    if (binary) return;
    try {
      const response = await fetch(fileHref(build.responseId, file.id));
      if (!response.ok) throw new Error(await responseError(response));
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer());
      if (request === fileRequest.current) setSource({ buildId: build.localId, fileId: file.id, filename: file.filename, text, loading: false, error: '', binary: false });
    } catch (error) {
      if (request === fileRequest.current) setSource({ buildId: build.localId, fileId: file.id, filename: file.filename, text: '', loading: false, error: messageOf(error), binary: false });
    }
  }

  const view = builds.find(build => build.localId === selectedBuild);
  const build = live.current.find(build => build.localId === selectedBuild);
  const html = view ? view.previewHtml ?? htmlOf(view) : '';
  const active = Boolean(view && !terminal(view.status) && view.status !== 'disconnected');
  const selectedSource = source?.buildId === view?.localId ? source : null;
  const code = selectedSource?.text ?? html;
  const filename = selectedSource?.filename ?? view?.previewFilename ?? 'Streamed HTML';
  const language = /\.css$/i.test(filename) ? 'css' : /\.json$/i.test(filename) ? 'json' : /\.tsx?$/i.test(filename) ? 'typescript' : /\.[cm]?jsx?$/i.test(filename) ? 'javascript' : /\.py$/i.test(filename) ? 'python' : /\.md$/i.test(filename) ? 'markdown' : /\.html?$/i.test(filename) || !selectedSource ? 'html' : 'log';
  const sandbox = view?.trace.filter(entry => entry.kind === 'sandbox') ?? [];
  const providerWork = view?.trace.filter(entry => entry.kind !== 'reasoning' && entry.kind !== 'file') ?? [];
  const output = sandbox.map(entry => [entry.code, entry.stdout, entry.stderr].filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
  const chooseBuild = (id: string | null) => { setSelectedBuild(id); if (id) setVisitedBuilds(previous => new Set([...previous, id])); setSource(null); ++fileRequest.current; setWorkspaceTab('preview'); };

  return <div className="dp-vc native-studio" data-mobile-panel={mobilePanel}>
    <header className="studio-toolbar">
      <div><AsteriskIcon className="studio-mark" aria-hidden="true" /><strong>cato studio</strong><span className="studio-caption">Website workspace</span></div>
      <div><label className="sr-only" htmlFor="studio-build">Selected build</label><select id="studio-build" value={selectedBuild ?? ''} onChange={event => chooseBuild(event.target.value || null)}>
        <option value="">New website</option>{builds.map(entry => <option value={entry.localId} key={entry.localId}>{entry.name} · {entry.status.replace('_', ' ')}</option>)}
      </select><button type="button" className="kit-mini-btn" onClick={() => { chooseBuild(null); setPreviousId(''); setPrompt(''); setMobilePanel('agent'); document.getElementById('vibe-prompt')?.focus(); }}>New build +</button></div>
    </header>
    <nav className="studio-mobile-nav" aria-label="Workspace panels">{(['files', 'workspace', 'agent'] as const).map(panel => <button type="button" key={panel} aria-pressed={mobilePanel === panel} onClick={() => setMobilePanel(panel)}>{panel === 'workspace' ? 'Preview & code' : panel === 'agent' ? 'Agent & brief' : 'Files'}</button>)}</nav>
    {storageError && <p role="status">{storageError}</p>}
    <div className="studio-panels" data-status={view?.status} data-response-id={view?.responseId} data-sequence={view?.sequence}>
      <aside className="studio-files" aria-label="Project files">
        <div className="studio-panel-heading"><span>Explorer</span><span>{view?.files.length ?? 0}</span></div>
        <FileTree key={view?.localId ?? 'new'} selectedPath={selectedSource?.fileId} onSelect={id => { const file = view?.files.find(entry => entry.id === id); if (file && build) void openFile(build, file); }}>
          <ProjectFiles nodes={projectFileTree(view?.files ?? [])} />
        </FileTree>
        {!view?.files.length && <p className="studio-empty-note">Shared project files appear here as the agent delivers them.</p>}
        {html && <button type="button" className="studio-stream-file" onClick={() => { setSource(null); ++fileRequest.current; setWorkspaceTab('code'); setMobilePanel('workspace'); }}>View streamed HTML</button>}
        {build?.responseId && <button className="studio-stream-file" onClick={() => void refreshFiles(build).catch((error: unknown) => { build.error = messageOf(error); publish(); })}>Refresh files</button>}
        {!!view?.files.length && <div className="studio-downloads"><p className="micro-label">Downloads</p>{view.files.map(file => <a key={file.id} href={fileHref(view.responseId, file.id)} download={file.filename}>{file.filename} ↓</a>)}</div>}
      </aside>
      <section className="studio-workspace" aria-label="Website preview and source">
        <div className="studio-editor-tabs"><div role="tablist" aria-label="Website view"><button id="studio-preview-tab" role="tab" aria-selected={workspaceTab === 'preview'} aria-controls="studio-preview" onClick={() => setWorkspaceTab('preview')}>Preview</button><button id="studio-code-tab" role="tab" aria-selected={workspaceTab === 'code'} aria-controls="studio-code" onClick={() => setWorkspaceTab('code')}>Code</button></div><span role="status">{view ? view.status.replace('_', ' ') : 'Ready for your brief'}</span></div>
        <div id="studio-preview" role="tabpanel" aria-labelledby="studio-preview-tab" hidden={workspaceTab !== 'preview'} className="studio-preview">
          {builds.filter(entry => visitedBuilds.has(entry.localId)).map(canvasView => {
            const canvasBuild = live.current.find(entry => entry.localId === canvasView.localId);
            if (!canvasBuild) return null;
            const canvasHtml = canvasView.previewHtml ?? htmlOf(canvasView);
            const canvasActive = !terminal(canvasView.status) && canvasView.status !== 'disconnected';
            return <div key={canvasView.localId} hidden={canvasView.localId !== selectedBuild} className="studio-canvas-instance"><LiveCanvas key={`${canvasView.localId}:${canvasView.previewFilename || 'stream'}:${canvasView.previewFragment || ''}`} html={canvasHtml} streaming={canvasActive && !/<\/html\s*>/i.test(canvasHtml)} agentId={canvasView.responseId || canvasView.localId} agentName={canvasView.name}
              initialFragment={canvasView.previewFragment} previousChatResponseId={canvasView.chatResponseId} onChatResponseId={id => { canvasBuild.chatResponseId = id; publish(); }}
              previousPendingChatResponseId={canvasView.chatPendingResponseId} onChatPendingResponseId={id => { canvasBuild.chatPendingResponseId = id; publish(); }}
              onNavigate={href => void navigate(canvasBuild, href)} onRenderError={message => { canvasBuild.error = message; publish(); }} /></div>;
          })}
          {!view && <div className="studio-welcome"><AsteriskIcon className="studio-welcome-icon" aria-hidden="true" /><p className="micro-label">From an idea to a live website</p><h3>Your next website<br />starts here.</h3><p>Give the studio a brief. Watch the site take shape, explore its source, and refine it together.</p><button type="button" className="kit-mini-btn" onClick={() => { setMobilePanel('agent'); document.getElementById('vibe-prompt')?.focus(); }}>Write your brief ↗</button></div>}
        </div>
        <div id="studio-code" role="tabpanel" aria-labelledby="studio-code-tab" hidden={workspaceTab !== 'code'} className="studio-code">
          {selectedSource?.loading ? <p role="status" className="studio-empty-note">Loading {filename}…</p> : selectedSource?.error ? <p role="alert" className="native-build__error">{selectedSource.error}</p> : selectedSource?.binary ? <p className="studio-empty-note">This file is available as a download. <a href={fileHref(view!.responseId, selectedSource.fileId)} download={filename}>Download {filename}</a></p> : code ? <CodeBlock code={code} language={language} showLineNumbers><CodeBlockHeader><CodeBlockFilename>{filename} · read only</CodeBlockFilename><CodeBlockCopyButton /></CodeBlockHeader></CodeBlock> : <p className="studio-empty-note">Select a shared source file or wait for the first HTML from your build.</p>}
        </div>
        <Terminal output={output} isStreaming={sandbox.some(entry => !entry.done) && active} className="studio-terminal"><TerminalHeader><TerminalTitle>Sandbox terminal</TerminalTitle><TerminalCopyButton /></TerminalHeader>{output ? <TerminalContent /> : <p className="studio-terminal-empty">No sandbox output yet.</p>}</Terminal>
      </section>
      <aside className="studio-agent" aria-label="AI build conversation">
        <div className="studio-panel-heading"><span>Studio agent</span><span className="studio-agent-dot" aria-hidden="true" /></div>
        <div className="studio-planning"><Plan defaultOpen><PlanHeader><div><PlanTitle>{view ? 'Build objective' : 'Your brief'}</PlanTitle><PlanDescription>{view ? 'Your brief and observed provider activity' : 'A starting point for your website'}</PlanDescription></div><PlanAction><PlanTrigger aria-label="Toggle build objective" /></PlanAction></PlanHeader><PlanContent><p>{view?.prompt || 'Describe your website, its audience, and what you want it to do.'}</p>
          {!!providerWork.length && <Task defaultOpen={false} className="studio-plan-task"><TaskTrigger title="Provider work" /><TaskContent>{providerWork.map(entry => <TaskItem key={entry.id}>{workTitle(entry)}{entry.error ? ' · Error' : entry.status ? ` · ${entry.status.replaceAll('_', ' ')}` : ''}</TaskItem>)}</TaskContent></Task>}
          {!!view?.files.length && <Task className="studio-plan-task"><TaskTrigger title="Shared project files" /><TaskContent><div className="studio-task-files">{view.files.map(file => <TaskItemFile key={file.id}><button type="button" onClick={() => { if (build) void openFile(build, file); }}>{file.filename}</button></TaskItemFile>)}</div></TaskContent></Task>}
        </PlanContent></Plan>
          {!!builds.length && <Queue>{[
            { label: 'Pending', items: builds.filter(entry => !terminal(entry.status)), icon: <CircleDashedIcon size={14} /> },
            { label: 'Completed', items: builds.filter(entry => entry.status === 'completed'), icon: <CheckCircle2Icon size={14} /> },
            { label: 'Ended', items: builds.filter(entry => terminal(entry.status) && entry.status !== 'completed'), icon: <CircleStopIcon size={14} /> },
          ].filter(section => section.items.length).map(section => <QueueSection key={section.label}><QueueSectionTrigger><QueueSectionLabel label={section.label} count={section.items.length} icon={section.icon} /></QueueSectionTrigger><QueueSectionContent><QueueList>{section.items.map(entry => <QueueItem key={entry.localId}><QueueItemIndicator completed={entry.status === 'completed'} /><QueueItemContent><button type="button" onClick={() => chooseBuild(entry.localId)}>{entry.name} · {entry.status.replace('_', ' ')}</button></QueueItemContent></QueueItem>)}</QueueList></QueueSectionContent></QueueSection>)}</Queue>}
        </div>
        <Conversation className="studio-conversation"><ConversationContent>
          {view ? <><Message from="user"><MessageContent>{view.prompt}</MessageContent></Message><Message from="assistant"><MessageContent><NativeAgentTrace title="Agent activity" entries={view.trace} agentName={view.name} active={active} />{proseOf(view) && <MessageResponse>{proseOf(view)}</MessageResponse>}</MessageContent></Message></> : <ConversationEmptyState title="Let's build something." description="Share your idea below. You can attach a brief, content, or reference documents." />}
          {view?.error && <p className="native-build__error" role="alert">{view.error}</p>}
          {view && build && <div className="studio-run-actions">
            {view.status === 'disconnected' && view.responseId && <button className="kit-mini-btn" onClick={() => void connect(build)}>Reconnect {view.name}</button>}
            {!terminal(view.status) && view.responseId && <button className="kit-mini-btn" onClick={() => void cancel(build)} disabled={view.status === 'cancelling'}>Stop {view.name}</button>}
            {terminal(view.status) && <button className="kit-mini-btn" onClick={() => { setPreviousId(view.status === 'completed' ? view.responseId : ''); setPrompt(view.status === 'completed' ? '' : view.prompt); document.getElementById('vibe-prompt')?.focus(); }}>{view.status === 'completed' ? 'Revise website' : 'Revise brief'}</button>}
            {view.previewFilename && <button className="kit-mini-btn" onClick={() => { build.previewFilename = undefined; build.previewHtml = undefined; build.previewFragment = undefined; publish(); }}>Home preview</button>}
            {view.navigating && <span role="status">Opening page…</span>}
          </div>}
          {view?.status === 'completed' && <Checkpoint><CheckpointIcon /><CheckpointTrigger tooltip="Restore to this checkpoint" onClick={() => { chooseBuild(view.localId); if (build) { build.previewFilename = undefined; build.previewHtml = undefined; build.previewFragment = undefined; publish(); } setPreviousId(view.responseId); setPrompt(''); }}>Restore {view.name} checkpoint</CheckpointTrigger></Checkpoint>}
        </ConversationContent><ConversationScrollButton /></Conversation>
        <div className="studio-composer"><label htmlFor="vibe-prompt">{previousId ? 'Refine this website' : 'Describe what you’re building'}</label>
          <PromptInput onSubmit={() => submit()}><PromptInputBody><PromptInputTextarea id="vibe-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} placeholder="A desert-modernist boutique hotel in Palm Springs…" /></PromptInputBody><PromptInputFooter><div className="native-studio__attachments"><label className="studio-attach">{readingFiles ? 'Reading…' : 'Attach documents'}<input aria-label="Attach documents" type="file" multiple accept=".pdf,.txt,.md,.csv,.html,.json,.css,.js,.ts,.tsx" disabled={readingFiles} onChange={event => { void attach(event.target.files); event.target.value = ''; }} /></label><span>{prompt.length}/2000</span></div><PromptInputSubmit aria-label="Brief the studio" disabled={!prompt.trim() || readingFiles} /></PromptInputFooter></PromptInput>
          {attachments.map(file => <button key={file.filename} type="button" className="native-studio__file" onClick={() => setAttachments(previous => previous.filter(entry => entry !== file))}>Remove {file.filename} ×</button>)}
          {previousId && <button type="button" className="native-studio__file" onClick={() => setPreviousId('')}>Using previous website · Start fresh ×</button>}{formError && <p role="alert">{formError}</p>}
        </div>
        {view && <details className="native-build__details"><summary>Run details</summary><p>Claude Opus 5.5 · 128,000 output token limit · 100 step limit · Background execution</p><p>{view.responseId || 'Waiting for the provider'} · {view.events} events received</p></details>}
      </aside>
    </div>
  </div>;
}
