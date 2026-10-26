'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AsteriskIcon,
  BrainCircuitIcon,
  ClockIcon,
  Code2Icon,
  CpuIcon,
  EyeIcon,
  ExpandIcon,
  FolderTreeIcon,
  LockIcon,
  MessageSquareTextIcon,
  Minimize2Icon,
  MonitorIcon,
  PaperclipIcon,
  ShieldAlertIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { NativeAgentTrace } from '@/components/vibe/NativeAgentTrace';
import { CatoBlurpleRipple } from '@/components/vibe/CatoBlurpleRipple';
import { FileTree, FileTreeFile, FileTreeFolder } from '@/components/ai-elements/file-tree';
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockFilename,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block';
import {
  Terminal,
  TerminalHeader,
  TerminalTitle,
  TerminalContent,
  TerminalCopyButton,
} from '@/components/ai-elements/terminal';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputHeader,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from '@/components/ai-elements/checkpoint';
import LiveCanvas from '@/components/vibe/LiveCanvas';
import { STUDIO_MODEL } from '@/components/vibe/studio-agent';
import { fileHref } from '@/lib/agent-ui';
import {
  applyNativeTrace,
  hydrateNativeTrace,
  type NativeTraceEntry,
} from '@/lib/native-agent-trace';
import type { AgentEvent } from '@/lib/pplx';
import '../../ai-elements.css';
import './vibe.css';
import './studio.css';

type Status =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'incomplete'
  | 'disconnected'
  | 'cancelling';

type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

type AgentModelOption = {
  id: string;
  owned_by: string;
};

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const DEFAULT_MODELS: AgentModelOption[] = [
  { id: 'anthropic/claude-opus-5-5', owned_by: 'anthropic' },
  { id: 'anthropic/claude-sonnet-5-5', owned_by: 'anthropic' },
  { id: 'anthropic/claude-haiku-5-5', owned_by: 'anthropic' },
  { id: 'anthropic/claude-fable-5-1', owned_by: 'anthropic' },
  { id: 'openai/gpt-6.1-sol', owned_by: 'openai' },
  { id: 'openai/gpt-6-luna', owned_by: 'openai' },
  { id: 'openai/gpt-6-astra', owned_by: 'openai' },
  { id: 'google/gemini-3.8-flash', owned_by: 'google' },
  { id: 'google/gemini-3.1-pro-preview', owned_by: 'google' },
  { id: 'xai/grok-4.7', owned_by: 'xai' },
  { id: 'perplexity/kimi-k3', owned_by: 'perplexity' },
  { id: 'perplexity/glm-5.3', owned_by: 'perplexity' },
  { id: 'perplexity/sonar', owned_by: 'perplexity' },
];

const REASONING_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: 'minimal', label: 'Minimal reasoning' },
  { value: 'low', label: 'Low reasoning' },
  { value: 'medium', label: 'Medium reasoning' },
  { value: 'high', label: 'High reasoning' },
  { value: 'xhigh', label: 'X-High reasoning' },
  { value: 'max', label: 'Max reasoning' },
];

function formatModelLabel(id: string): string {
  const [provider = '', rawName = ''] = id.split('/');
  const prettyName = rawName
    .replace(/-preview$/i, '')
    .replace(/claude-(opus|sonnet|haiku|fable)-(\d+)-(\d+)/i, (_, tier: string, maj: string, min: string) =>
      `Claude ${tier.charAt(0).toUpperCase() + tier.slice(1)} ${maj}.${min}`
    )
    .replace(/claude-(opus|sonnet|haiku|fable)-(\d+)/i, (_, tier: string, maj: string) =>
      `Claude ${tier.charAt(0).toUpperCase() + tier.slice(1)} ${maj}`
    );
  if (prettyName !== rawName.replace(/-preview$/i, '')) {
    return prettyName;
  }
  return `${provider.toUpperCase()} · ${rawName}`;
}

type SharedFile = { id: string; filename: string; bytes: number };
type ProjectFileNode =
  | { kind: 'file'; name: string; file: SharedFile }
  | { kind: 'folder'; name: string; path: string; children: ProjectFileNode[] };

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
      let folder = children.find(
        (node): node is Extract<ProjectFileNode, { kind: 'folder' }> =>
          node.kind === 'folder' && node.path === path
      );
      if (!folder) {
        folder = { kind: 'folder', name: part, path, children: [] };
        children.push(folder);
      }
      children = folder.children;
    }
    children.push({ kind: 'file', name, file });
  }
  return roots;
}

function ProjectFiles({ nodes }: { nodes: ProjectFileNode[] }) {
  return nodes.map((node) =>
    node.kind === 'folder' ? (
      <FileTreeFolder key={node.path} path={node.path} name={node.name}>
        <ProjectFiles nodes={node.children} />
      </FileTreeFolder>
    ) : (
      <FileTreeFile
        key={node.file.id}
        path={node.file.id}
        name={node.name}
        title={node.file.filename}
      />
    )
  );
}

type Attachment =
  | { type: 'input_file'; filename: string; file_data: string }
  | { type: 'input_text'; filename: string; text: string };

interface Build {
  localId: string;
  name: string;
  prompt: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  responseId: string;
  previousResponseId?: string;
  cancelRequested?: boolean;
  status: Status;
  sequence: number;
  texts: Record<string, string>;
  trace: NativeTraceEntry[];
  traceHydrated?: boolean;
  traceVersion?: number;
  rippleStartedAt?: number;
  rippleDone?: boolean;
  previewStartedAt?: number;
  previewExpired?: boolean;
  savedAt?: number;
  lead?: {
    name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
    submittedAt: number;
  };
  chatTurns?: ChatTurn[];
  chatGreetingStarted?: boolean;
  previewFilename?: string;
  previewFragment?: string;
  previewHtml?: string;
  homeHtml?: string;
  navigating?: boolean;
  chatResponseId?: string;
  chatPendingResponseId?: string;
  files: SharedFile[];
  error: string;
  events: number;
}

type SavedBuild = Omit<Build, 'trace'> & { trace?: NativeTraceEntry[]; steps?: unknown[] };
const STORAGE = 'cato-native-builds-v2';
const SAVED_SITES_STORAGE = 'cato-saved-websites-v1';
const RIPPLE_DURATION_MS = 2800;
const PREVIEW_DURATION_MS = 60_000;

const terminal = (status: string) =>
  ['completed', 'failed', 'cancelled', 'incomplete'].includes(status);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const messageOf = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (!record(value)) return 'The provider could not complete this request.';
  if (typeof value.message === 'string') return value.message;
  return value.error ? messageOf(value.error) : 'The provider could not complete this request.';
};

function extractHtmlSnippet(text: string): string {
  const start = /<!doctype\s+html|<html\b/i.exec(text);
  if (!start) return '';
  const candidate = text.slice(start.index);
  const end = /<\/html\s*>/i.exec(candidate);
  const doc = end ? candidate.slice(0, end.index + end[0].length) : candidate;
  if (end && !/<(?:head|body)\b/i.test(doc)) return '';
  return doc;
}

function htmlOf(build: Build): string {
  let html = build.homeHtml || '';
  for (const text of Object.values(build.texts)) {
    const doc = extractHtmlSnippet(text);
    if (doc.length > html.length) html = doc;
  }
  if (html) return html;
  for (const entry of build.trace) {
    if (entry.kind === 'sandbox') {
      for (const candidate of [entry.stdout, entry.code]) {
        const doc = extractHtmlSnippet(candidate);
        if (doc.length > html.length) html = doc;
      }
    } else if (entry.kind === 'fileOperation' && record(entry.raw)) {
      const content = typeof entry.raw.content === 'string' ? entry.raw.content : '';
      const doc = extractHtmlSnippet(content);
      if (doc.length > html.length) html = doc;
    }
  }
  return html;
}

function proseOf(build: Build): string {
  return Object.values(build.texts)
    .map((text) => {
      const start = /<!doctype\s+html|<html\b/i.exec(text);
      if (!start) {
        return text.replace(/```(?:html)?\s*$/i, '').trim();
      }
      const before = text
        .slice(0, start.index)
        .replace(/```(?:html)?\s*$/i, '')
        .trim();
      const rest = text.slice(start.index);
      const end = /<\/html\s*>/i.exec(rest);
      const after = end
        ? rest
            .slice(end.index + end[0].length)
            .replace(/^\s*```/, '')
            .trim()
        : '';
      return [before, after].filter(Boolean).join('\n\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function saveWebsiteToStorage(build: Build) {
  try {
    const existingRaw = localStorage.getItem(SAVED_SITES_STORAGE);
    const existing: Record<string, unknown>[] = existingRaw ? JSON.parse(existingRaw) : [];
    const html = build.previewHtml ?? htmlOf(build);
    const recordEntry = {
      localId: build.localId,
      responseId: build.responseId,
      name: build.name,
      prompt: build.prompt,
      model: build.model,
      reasoningEffort: build.reasoningEffort,
      html,
      savedAt: build.savedAt || Date.now(),
      chatResponseId: build.chatResponseId || null,
      chatTurns: build.chatTurns || [],
    };
    const next = [
      ...existing.filter((item) => item.localId !== build.localId),
      recordEntry,
    ];
    localStorage.setItem(SAVED_SITES_STORAGE, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

async function responseError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    return messageOf(JSON.parse(text));
  } catch {
    return text || `Request failed (${response.status}).`;
  }
}

async function consumeEvents(response: Response, receive: (event: AgentEvent) => void) {
  if (!response.ok) throw new Error(await responseError(response));
  if (!response.body) throw new Error('The response did not include a stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let ended = false;
  const consume = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) return;
    if (data === '[DONE]') {
      ended = true;
      return;
    }
    const event: unknown = JSON.parse(data);
    if (!record(event) || typeof event.type !== 'string')
      throw new Error('Invalid provider stream event.');
    receive(event as AgentEvent);
    ended =
      event.type === 'error' ||
      ['response.completed', 'response.failed', 'response.cancelled', 'response.incomplete'].includes(
        event.type
      );
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        if (ended) {
          await reader.cancel();
          return;
        }
      }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
  } finally {
    reader.releaseLock();
  }
}

export default function VibeCoder() {
  const [visitedBuilds, setVisitedBuilds] = useState<Set<string>>(new Set());
  const [selectedBuild, setSelectedBuild] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'preview' | 'code' | 'files'>('preview');
  const [ideViewMode, setIdeViewMode] = useState<'auto' | 'chat' | 'canvas'>('auto');
  const [expandedModal, setExpandedModal] = useState(false);
  const [captureShielded, setCaptureShielded] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [models, setModels] = useState<AgentModelOption[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(STUDIO_MODEL);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('high');

  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);

  const [source, setSource] = useState<{
    buildId: string;
    fileId: string;
    filename: string;
    text: string;
    loading: boolean;
    error: string;
    binary: boolean;
  } | null>(null);
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
  const rippleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const previewTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const paint = useRef<number | null>(null);
  const mounted = useRef(false);

  // Fetch live models list from Perplexity Agent API (/v1/models filtered to latest versions)
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/vibe-build?models=true', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const json: unknown = await res.json();
        if (record(json) && Array.isArray(json.data)) {
          const fetched = json.data.filter(
            (m): m is AgentModelOption =>
              record(m) && typeof m.id === 'string' && typeof m.owned_by === 'string'
          );
          if (fetched.length > 0) {
            setModels(fetched);
            setSelectedModel((prev) =>
              fetched.some((entry) => entry.id === prev) ? prev : fetched[0].id
            );
          }
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_MODELS if offline
      });
    return () => controller.abort();
  }, []);

  const triggerCaptureShield = useCallback(() => {
    setCaptureShielded(true);
    try {
      void navigator.clipboard?.writeText('Protected Cato Studio Live Preview');
    } catch {
      // Clipboard write may require transient user activation
    }
  }, []);

  // Screenshot & screen-capture deterrence listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      const isMacShot = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key);
      const isWinShot = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's';
      const isPrint = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p';
      if (isPrintScreen || isMacShot || isWinShot || isPrint) {
        e.preventDefault();
        triggerCaptureShield();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        triggerCaptureShield();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && live.current.some((b) => Boolean(htmlOf(b)))) {
        setCaptureShielded(true);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [triggerCaptureShield]);

  // Sync native <dialog> modal open/close for expanded preview
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (expandedModal && !dialog.open) {
      dialog.showModal();
    } else if (!expandedModal && dialog.open) {
      dialog.close();
    }
  }, [expandedModal]);

  function publish() {
    if (!mounted.current || paint.current !== null) return;
    paint.current = requestAnimationFrame(() => {
      paint.current = null;
      const next = live.current.map((build) => ({ ...build, texts: { ...build.texts } }));
      setBuilds(next);
      try {
        sessionStorage.setItem(STORAGE, JSON.stringify(next));
      } catch {
        setStorageError(
          'This browser could not save the session. Keep this tab open to retain the preview.'
        );
      }
    });
  }

  function ensurePreviewTimer(build: Build) {
    if (build.previewExpired || previewTimers.current.has(build.localId)) return;
    if (!build.previewStartedAt) {
      build.previewStartedAt = Date.now();
    }
    const elapsed = Date.now() - build.previewStartedAt;
    const remaining = Math.max(0, PREVIEW_DURATION_MS - elapsed);
    if (remaining <= 0) {
      build.previewExpired = true;
      build.savedAt = build.savedAt || Date.now();
      saveWebsiteToStorage(build);
      publish();
      return;
    }
    const timer = setTimeout(() => {
      previewTimers.current.delete(build.localId);
      build.previewExpired = true;
      build.savedAt = Date.now();
      saveWebsiteToStorage(build);
      publish();
    }, remaining);
    previewTimers.current.set(build.localId, timer);
  }

  function ensureRippleTimer(build: Build) {
    if (build.rippleDone) {
      ensurePreviewTimer(build);
      return;
    }
    if (rippleTimers.current.has(build.localId)) return;
    if (!build.rippleStartedAt) {
      build.rippleStartedAt = Date.now();
    }
    const elapsed = Date.now() - build.rippleStartedAt;
    const remaining = Math.max(0, RIPPLE_DURATION_MS - elapsed);
    const timer = setTimeout(() => {
      rippleTimers.current.delete(build.localId);
      build.rippleDone = true;
      ensurePreviewTimer(build);
      publish();
    }, remaining);
    rippleTimers.current.set(build.localId, timer);
  }

  // 1-second ticker for updating the 60-second preview countdown badge
  useEffect(() => {
    const interval = setInterval(() => {
      const hasActivePreview = live.current.some(
        (b) => b.previewStartedAt && !b.previewExpired
      );
      if (hasActivePreview) {
        setNowTick(Date.now());
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const restoreController = new AbortController();
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE) || '[]');
      if (Array.isArray(saved)) {
        const restored = saved.filter(
          (value): value is SavedBuild =>
            record(value) &&
            typeof value.localId === 'string' &&
            typeof value.name === 'string' &&
            typeof value.prompt === 'string' &&
            typeof value.responseId === 'string' &&
            typeof value.status === 'string' &&
            typeof value.sequence === 'number' &&
            record(value.texts) &&
            Object.values(value.texts).every((text) => typeof text === 'string') &&
            (value.trace === undefined || Array.isArray(value.trace)) &&
            Array.isArray(value.files)
        );
        live.current = restored.map(({ steps: _legacySteps, ...build }) => ({
          ...build,
          model: typeof build.model === 'string' ? build.model : STUDIO_MODEL,
          reasoningEffort:
            typeof build.reasoningEffort === 'string'
              ? (build.reasoningEffort as ReasoningEffort)
              : 'high',
          trace: build.trace || [],
          rippleDone: Boolean(build.rippleDone || htmlOf(build as Build)),
          traceHydrated: build.traceVersion === 2 && Boolean(build.traceHydrated),
          status: terminal(build.status) ? build.status : 'disconnected',
        }));
        for (const build of live.current) {
          if (htmlOf(build) && build.rippleDone) {
            ensurePreviewTimer(build);
          }
        }
        setBuilds(live.current);
        setSelectedBuild(live.current.at(-1)?.localId ?? null);
        setVisitedBuilds(new Set(live.current.slice(-1).map((entry) => entry.localId)));
        for (const build of live.current.filter(
          (entry) => !entry.traceHydrated && entry.responseId
        )) {
          void fetch(`/api/vibe-build?r=${encodeURIComponent(build.responseId)}`, {
            signal: restoreController.signal,
          })
            .then(async (response) => {
              if (!response.ok) throw new Error(await responseError(response));
              const value: unknown = await response.json();
              if (!record(value)) throw new Error('Invalid response snapshot.');
              snapshot(build, value, true);
              if (!terminal(build.status)) build.status = 'disconnected';
              publish();
            })
            .catch((error: unknown) => {
              if (!restoreController.signal.aborted) {
                build.error = messageOf(error);
                publish();
              }
            });
        }
      }
    } catch {
      setStorageError('The saved studio session could not be restored. Start a new brief below.');
    }
    const active = controllers.current;
    const rTimers = rippleTimers.current;
    const pTimers = previewTimers.current;
    return () => {
      mounted.current = false;
      restoreController.abort();
      active.forEach((controller) => controller.abort());
      active.clear();
      rTimers.forEach((t) => clearTimeout(t));
      rTimers.clear();
      pTimers.forEach((t) => clearTimeout(t));
      pTimers.clear();
      if (paint.current !== null) cancelAnimationFrame(paint.current);
      paint.current = null;
    };
  }, []);

  function snapshot(build: Build, response: Record<string, unknown>, includeTrace = true) {
    if (typeof response.id === 'string') {
      build.responseId = response.id;
    }
    if (typeof response.model === 'string' && response.model) {
      build.model = response.model;
    }
    if (
      typeof response.status === 'string' &&
      [
        'queued',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'incomplete',
        'cancelling',
      ].includes(response.status)
    ) {
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
          const text = item.content
            .filter(record)
            .map((part) => (typeof part.text === 'string' ? part.text : ''))
            .join('');
          if (text) {
            build.texts[typeof item.id === 'string' ? item.id : `output-${index}`] = text;
          }
        }
      });
    }
    if (htmlOf(build)) {
      ensureRippleTimer(build);
    }
  }

  function receive(build: Build, event: AgentEvent) {
    if (typeof event.sequence_number === 'number') {
      if (event.sequence_number <= build.sequence) return;
      build.sequence = event.sequence_number;
    }
    build.events += 1;
    if (event.response && record(event.response)) {
      snapshot(build, event.response, false);
    }
    const id =
      typeof event.item_id === 'string' ? event.item_id : `output-${event.output_index ?? 0}`;
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      build.texts[id] = (build.texts[id] || '') + event.delta;
    } else if (event.type === 'response.output_text.done' && typeof event.text === 'string') {
      build.texts[id] = event.text;
    }
    if (
      event.type === 'response.output_item.done' &&
      record(event.item) &&
      event.item.type === 'message'
    ) {
      snapshot(build, { output: [event.item] }, false);
    }
    build.trace = applyNativeTrace(build.trace, event, build.responseId || build.localId);

    if (
      event.type === 'response.file.created' ||
      (event.type === 'response.output_item.done' &&
        record(event.item) &&
        event.item.type === 'share_file')
    ) {
      void refreshFiles(build, controllers.current.get(build.localId)?.signal).catch(() => {});
    }

    if (htmlOf(build)) {
      ensureRippleTimer(build);
    }

    if (event.type === 'error' || event.type === 'response.failed') {
      build.status = 'failed';
      build.error = messageOf(event.response?.error || event.error || event);
    } else if (event.type === 'response.cancelled') {
      build.status = 'cancelled';
    } else if (event.type === 'response.incomplete') {
      build.status = 'incomplete';
      build.error ||= 'The provider ended this run before it was complete.';
    }
    publish();
  }

  async function refreshFiles(build: Build, signal?: AbortSignal) {
    if (!build.responseId) return;
    const response = await fetch(`/api/vibe-files?r=${encodeURIComponent(build.responseId)}`, {
      signal,
    });
    if (!response.ok) throw new Error(await responseError(response));
    const value: unknown = await response.json();
    if (!record(value) || !Array.isArray(value.data))
      throw new Error('The provider returned an invalid file list.');
    build.files = value.data.filter(
      (file): file is SharedFile =>
        record(file) &&
        typeof file.id === 'string' &&
        typeof file.filename === 'string' &&
        typeof file.bytes === 'number'
    );
    if (!build.homeHtml) {
      const htmlFile =
        build.files.find((f) => /^index\.html?$/i.test(f.filename.replace(/^\/+/, ''))) ||
        build.files.find((f) => /\.html?$/i.test(f.filename));
      if (htmlFile) {
        const htmlRes = await fetch(fileHref(build.responseId, htmlFile.id), { signal });
        if (htmlRes.ok) {
          build.homeHtml = await htmlRes.text();
          ensureRippleTimer(build);
        }
      }
    }
    publish();
  }

  async function navigate(build: Build, href: string) {
    if (build.navigating || !build.responseId) return;
    build.navigating = true;
    build.error = '';
    publish();
    try {
      const destination = new URL(
        href,
        `https://canvas.local/${build.previewFilename || 'index.html'}`
      );
      if (destination.origin !== 'https://canvas.local')
        throw new Error('Only generated website pages can open in this preview.');
      const filename = decodeURIComponent(destination.pathname).replace(/^\/+/, '');
      await refreshFiles(build);
      const candidates = [
        filename || 'index.html',
        `${filename}.html`,
        `${filename.replace(/\/$/, '')}/index.html`,
      ];
      const matches = build.files.filter((file) =>
        candidates.includes(file.filename.replace(/^\/+/, ''))
      );
      if (matches.length !== 1 || !/\.html?$/i.test(matches[0].filename))
        throw new Error(
          'This page has not been shared by the agent yet. Try again when the build finishes.'
        );
      const file = matches[0];
      const response = await fetch(fileHref(build.responseId, file.id));
      if (!response.ok) throw new Error(await responseError(response));
      build.previewHtml = await response.text();
      build.previewFilename = file.filename;
      build.previewFragment = destination.hash;
    } catch (error) {
      build.error = messageOf(error);
    } finally {
      build.navigating = false;
      publish();
    }
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
      const response = await fetch(
        build.responseId
          ? `${base}&stream=true${build.sequence >= 0 ? `&starting_after=${build.sequence}` : ''}`
          : '/api/vibe-build',
        build.responseId
          ? { signal }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: build.prompt,
                model: build.model,
                reasoning_effort: build.reasoningEffort,
                files,
                previous_response_id: build.previousResponseId || undefined,
              }),
              signal,
            }
      );

      if (build.responseId && response.status === 400) {
        const current = await fetch(base, { signal });
        if (!current.ok) throw new Error(await responseError(current));
        const value: unknown = await current.json();
        if (!record(value)) throw new Error('Invalid response snapshot.');
        snapshot(build, value, true);
      } else {
        try {
          await consumeEvents(response, (event) => receive(build, event));
        } catch (streamError) {
          if (!build.responseId || signal.aborted) throw streamError;
        }
      }

      if (!terminal(build.status) && build.responseId) {
        const deadline = Date.now() + 1_800_000;
        while (!terminal(build.status) && !signal.aborted && Date.now() < deadline) {
          const current = await fetch(
            `/api/vibe-build?r=${encodeURIComponent(build.responseId)}`,
            { signal }
          );
          if (!current.ok) throw new Error(await responseError(current));
          const value: unknown = await current.json();
          if (!record(value)) throw new Error('Invalid response snapshot.');
          snapshot(build, value, true);
          publish();
          if (terminal(build.status) || Date.now() >= deadline) break;

          if (!build.cancelRequested) {
            try {
              const resumeRes = await fetch(
                `/api/vibe-build?r=${encodeURIComponent(build.responseId)}&stream=true${
                  build.sequence >= 0 ? `&starting_after=${build.sequence}` : ''
                }`,
                { signal }
              );
              if (resumeRes.ok && resumeRes.body) {
                await consumeEvents(resumeRes, (event) => receive(build, event));
                if (terminal(build.status)) break;
              }
            } catch {
              // Fall back to snapshot polling on transient stream drop
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      if (['completed', 'incomplete'].includes(build.status)) {
        await refreshFiles(build, signal);
        saveWebsiteToStorage(build);
      }

      if (!terminal(build.status)) {
        build.status = 'disconnected';
        build.error =
          'The stream ended before a final status arrived. Reconnect to retrieve the agent’s latest progress.';
      } else if (
        ['completed'].includes(build.status) &&
        !/<\/html\s*>/i.test(build.previewHtml ?? htmlOf(build))
      ) {
        build.error =
          'The agent completed without a full HTML document. Its response and files are available below.';
      }
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
      const response = await fetch(`/api/vibe-build?r=${encodeURIComponent(build.responseId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await responseError(response));
      if (!terminal(build.status)) build.status = 'cancelling';
      publish();
      if (!terminal(build.status) && !controllers.current.has(build.localId)) await connect(build);
    } catch (error) {
      build.cancelRequested = false;
      build.error = messageOf(error);
      publish();
    }
  }

  function submit() {
    if (!prompt.trim() || readingFiles) return;
    const build: Build = {
      localId: crypto.randomUUID(),
      name: `Builder ${live.current.length + 1}`,
      prompt: prompt.trim(),
      model: selectedModel,
      reasoningEffort,
      responseId: '',
      previousResponseId: previousId || undefined,
      status: 'queued',
      sequence: -1,
      texts: {},
      trace: [],
      traceHydrated: true,
      traceVersion: 2,
      files: [],
      error: '',
      events: 0,
    };
    live.current = [...live.current, build];
    setSelectedBuild(build.localId);
    setVisitedBuilds((previous) => new Set([...previous, build.localId]));
    setWorkspaceTab('preview');
    setIdeViewMode('auto');
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
      const next = await Promise.all(
        Array.from(files).map(async (file): Promise<Attachment> => {
          if (!/\.pdf$/i.test(file.name)) {
            return {
              type: 'input_text',
              filename: file.name,
              text: new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()),
            };
          }
          return new Promise<Attachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === 'string'
                ? resolve({ type: 'input_file', filename: file.name, file_data: reader.result })
                : reject(new Error(`Could not read ${file.name}.`));
            reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
            reader.readAsDataURL(file);
          });
        })
      );
      setAttachments(next);
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setReadingFiles(false);
    }
  }

  async function openFile(build: Build, file: SharedFile) {
    const request = ++fileRequest.current;
    setWorkspaceTab('code');
    setIdeViewMode('canvas');
    const binary = !/\.(html?|css|[cm]?js|jsx|tsx?|json|md|txt|csv|svg|xml|ya?ml|py|sh|toml|sql)$/i.test(
      file.filename
    );
    setSource({
      buildId: build.localId,
      fileId: file.id,
      filename: file.filename,
      text: '',
      loading: !binary,
      error: '',
      binary,
    });
    if (binary) return;
    try {
      const response = await fetch(fileHref(build.responseId, file.id));
      if (!response.ok) throw new Error(await responseError(response));
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer());
      if (request === fileRequest.current) {
        setSource({
          buildId: build.localId,
          fileId: file.id,
          filename: file.filename,
          text,
          loading: false,
          error: '',
          binary: false,
        });
      }
    } catch (error) {
      if (request === fileRequest.current) {
        setSource({
          buildId: build.localId,
          fileId: file.id,
          filename: file.filename,
          text: '',
          loading: false,
          error: messageOf(error),
          binary: false,
        });
      }
    }
  }

  async function sendHaikuChat(targetBuild: Build, text: string, isAutoGreeting = false) {
    const trimmed = text.trim();
    if (!trimmed || chatStreaming) return;
    if (!targetBuild.chatTurns) targetBuild.chatTurns = [];

    if (!isAutoGreeting) {
      targetBuild.chatTurns = [
        ...targetBuild.chatTurns,
        { id: crypto.randomUUID(), role: 'user', text: trimmed },
      ];
      setChatInput('');
    }

    const assistantTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: '',
    };
    targetBuild.chatTurns = [...targetBuild.chatTurns, assistantTurn];
    setChatStreaming(true);
    publish();

    try {
      const response = await fetch('/api/vibe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: trimmed,
          ...(targetBuild.chatResponseId ? { previous_response_id: targetBuild.chatResponseId } : {}),
        }),
      });
      await consumeEvents(response, (event) => {
        if (record(event.response) && typeof event.response.id === 'string') {
          targetBuild.chatResponseId = event.response.id;
        }
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          assistantTurn.text += event.delta;
          publish();
        } else if (event.type === 'response.output_text.done' && typeof event.text === 'string' && !assistantTurn.text) {
          assistantTurn.text = event.text;
          publish();
        }
      });
      targetBuild.savedAt = targetBuild.savedAt || Date.now();
      saveWebsiteToStorage(targetBuild);
    } catch (error) {
      assistantTurn.text = assistantTurn.text || `Unable to reach Cato Labs assistant: ${messageOf(error)}`;
    } finally {
      setChatStreaming(false);
      publish();
    }
  }

  const view = builds.find((b) => b.localId === selectedBuild);
  const build = live.current.find((b) => b.localId === selectedBuild);
  const html = view ? view.previewHtml ?? htmlOf(view) : '';
  const hasHtml = Boolean(html);
  const isRippling = Boolean(view && hasHtml && !view.rippleDone);
  const active = Boolean(view && !terminal(view.status) && view.status !== 'disconnected');
  const previewRemainingSec = view?.previewStartedAt
    ? Math.max(0, Math.ceil((PREVIEW_DURATION_MS - (nowTick - view.previewStartedAt)) / 1000))
    : 60;
  const isPreviewExpired = Boolean(
    view && (view.previewExpired || (view.previewStartedAt && previewRemainingSec <= 0))
  );

  // Automatically start the Haiku Chatbot lead capture greeting when the 1-minute preview finishes
  useEffect(() => {
    if (!isPreviewExpired || !build || build.chatGreetingStarted) return;
    build.chatGreetingStarted = true;
    const greetingPrompt = `The visitor just finished their 1-minute live preview of the sample website built for: "${build.prompt}". Their website has now been saved in Cato Studio. Greet them warmly, let them know their custom website has been saved, and ask for their name, business/brand, email or phone number so Cato Labs can share their saved website and connect with them.`;
    void sendHaikuChat(build, greetingPrompt, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewExpired, build?.localId]);

  const selectedSource = source?.buildId === view?.localId ? source : null;
  const code = selectedSource?.text ?? html;
  const filename = selectedSource?.filename ?? view?.previewFilename ?? 'index.html (Streamed)';
  const language = /\.css$/i.test(filename)
    ? 'css'
    : /\.json$/i.test(filename)
      ? 'json'
      : /\.tsx?$/i.test(filename)
        ? 'typescript'
        : /\.[cm]?jsx?$/i.test(filename)
          ? 'javascript'
          : /\.py$/i.test(filename)
            ? 'python'
            : /\.md$/i.test(filename)
              ? 'markdown'
              : /\.html?$/i.test(filename) || !selectedSource
                ? 'html'
                : 'log';
  const sandbox = view?.trace.filter((entry) => entry.kind === 'sandbox') ?? [];
  const output = sandbox
    .map((entry) => [entry.code, entry.stdout, entry.stderr].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');

  const chooseBuild = (id: string | null) => {
    setSelectedBuild(id);
    if (id) setVisitedBuilds((previous) => new Set([...previous, id]));
    setSource(null);
    ++fileRequest.current;
    setWorkspaceTab('preview');
    setIdeViewMode('auto');
  };

  const activeStage: 'chat' | 'ripple' | 'canvas' = isRippling
    ? 'ripple'
    : ideViewMode === 'chat'
      ? 'chat'
      : ideViewMode === 'canvas' && view
        ? 'canvas'
        : hasHtml && view?.rippleDone
          ? 'canvas'
          : 'chat';

  const renderLeadCaptureGate = (targetView: Build, targetBuild: Build) => {
    const turns = targetView.chatTurns ?? [];
    return (
      <div className="studio-lead-gate" role="dialog" aria-label="Save your website and chat with Cato Labs">
        <div className="studio-lead-gate__card">
          <div className="studio-lead-gate__badge">
            <LockIcon size={13} />
            <span>1-Minute Live Preview Complete · Website Saved · Claude Haiku 4.5</span>
          </div>
          <h4>Your Sample Website Has Been Saved</h4>
          <p>
            Your 60-second live preview has finished and your custom Three.js build is saved in Cato
            Studio. Chat with our Cato Labs AI assistant below to share your info and unlock your
            saved project.
          </p>

          <div className="studio-haiku-chat" aria-live="polite">
            {turns.length === 0 ? (
              <div className="studio-haiku-chat__turn is-assistant">
                <span className="studio-haiku-chat__role">Cato Labs Assistant</span>
                <p>Connecting to Cato Labs Assistant…</p>
              </div>
            ) : (
              turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`studio-haiku-chat__turn ${turn.role === 'user' ? 'is-user' : 'is-assistant'}`}
                >
                  <span className="studio-haiku-chat__role">
                    {turn.role === 'user' ? 'You' : 'Cato Labs Assistant'}
                  </span>
                  <p>{turn.text || (chatStreaming ? 'Thinking…' : '')}</p>
                </div>
              ))
            )}
          </div>

          <form
            className="studio-haiku-chat__form"
            onSubmit={(e) => {
              e.preventDefault();
              void sendHaikuChat(targetBuild, chatInput, false);
            }}
          >
            <input
              type="text"
              value={chatInput}
              disabled={chatStreaming}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Share your name, email, or phone number to claim your saved website…"
              className="studio-haiku-chat__input"
            />
            <button
              type="submit"
              disabled={chatStreaming || !chatInput.trim()}
              className="studio-lead-gate__submit"
            >
              {chatStreaming ? 'Sending…' : 'Send →'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div
      className="dp-vc native-studio"
      data-stage={activeStage}
      onContextMenu={(e) => {
        if (hasHtml) e.preventDefault();
      }}
    >
      {/* ---------- Top Studio Header ---------- */}
      <header className="studio-toolbar">
        <div className="studio-toolbar__brand">
          <AsteriskIcon className="studio-mark" aria-hidden="true" />
          <strong>cato studio</strong>
          <span className="studio-caption">
            {view
              ? `${formatModelLabel(view.model)} · ${view.status.replace('_', ' ')}`
              : 'AI Agent Website Studio'}
          </span>
        </div>

        <div className="studio-toolbar__controls">
          {view && hasHtml && !isRippling && (
            <div className="studio-stage-switcher" role="group" aria-label="View mode">
              <button
                type="button"
                className="studio-stage-btn"
                aria-pressed={activeStage === 'chat'}
                onClick={() => setIdeViewMode('chat')}
              >
                <MessageSquareTextIcon size={14} />
                <span>Chat &amp; Trace</span>
              </button>
              <button
                type="button"
                className="studio-stage-btn"
                aria-pressed={activeStage === 'canvas'}
                onClick={() => setIdeViewMode('canvas')}
              >
                <MonitorIcon size={14} />
                <span>Live Canvas &amp; IDE</span>
              </button>
            </div>
          )}

          <label className="sr-only" htmlFor="studio-build">
            Selected build
          </label>
          <select
            id="studio-build"
            value={selectedBuild ?? ''}
            onChange={(event) => chooseBuild(event.target.value || null)}
          >
            <option value="">New website</option>
            {builds.map((entry) => (
              <option value={entry.localId} key={entry.localId}>
                {entry.name} · {entry.status.replace('_', ' ')}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="kit-mini-btn"
            onClick={() => {
              chooseBuild(null);
              setPreviousId('');
              setPrompt('');
              document.getElementById('vibe-prompt')?.focus();
            }}
          >
            New build +
          </button>
        </div>
      </header>

      {storageError && <p role="status" className="studio-storage-notice">{storageError}</p>}

      {/* ---------- STAGE 2: Whole-IDE Ethereal Cato Blurple Water-Ripple ---------- */}
      {activeStage === 'ripple' && view && (
        <div className="studio-ripple-stage">
          <CatoBlurpleRipple
            title="Materializing your website onto the live canvas…"
            subtitle="Research complete. Sapphire, Azure, Ice & Indigo are entering the stage to draw your Three.js multipage website live."
            onSkip={() => {
              if (build) {
                const t = rippleTimers.current.get(build.localId);
                if (t) clearTimeout(t);
                rippleTimers.current.delete(build.localId);
                build.rippleDone = true;
                ensurePreviewTimer(build);
                publish();
              }
            }}
          />
        </div>
      )}

      {/* ---------- Main Studio Body (ChatGPT-Style Flow + Scaled Canvas IDE) ---------- */}
      <div
        className="studio-body"
        hidden={activeStage === 'ripple'}
        data-status={view?.status}
        data-response-id={view?.responseId}
        data-sequence={view?.sequence}
      >
        {/* Left/Center Scaled Canvas & Code Stage (Visible in 'canvas' stage) */}
        {activeStage === 'canvas' && view && build && (
          <section className="studio-workspace" aria-label="Website preview, code, and files">
            <div className="studio-editor-tabs">
              <div role="tablist" aria-label="Website view">
                <button
                  id="studio-preview-tab"
                  role="tab"
                  aria-selected={workspaceTab === 'preview'}
                  aria-controls="studio-preview"
                  onClick={() => setWorkspaceTab('preview')}
                >
                  <MonitorIcon size={14} />
                  <span>Scaled Preview</span>
                </button>
                <button
                  id="studio-code-tab"
                  role="tab"
                  aria-selected={workspaceTab === 'code'}
                  aria-controls="studio-code"
                  onClick={() => setWorkspaceTab('code')}
                >
                  <Code2Icon size={14} />
                  <span>Code</span>
                </button>
                <button
                  id="studio-files-tab"
                  role="tab"
                  aria-selected={workspaceTab === 'files'}
                  aria-controls="studio-files"
                  onClick={() => setWorkspaceTab('files')}
                >
                  <FolderTreeIcon size={14} />
                  <span>Files ({view.files.length})</span>
                </button>
              </div>

              <div className="studio-editor-actions">
                <span
                  className="studio-timer-pill"
                  data-expired={isPreviewExpired}
                  title="1-minute live preview timer"
                >
                  <ClockIcon size={12} />
                  <span>
                    {isPreviewExpired
                      ? 'Preview saved · 0:00'
                      : `Preview · 0:${String(previewRemainingSec).padStart(2, '0')}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="studio-expand-btn"
                  disabled={isPreviewExpired}
                  onClick={() => setExpandedModal(true)}
                >
                  <ExpandIcon size={14} />
                  <span>Make Bigger</span>
                </button>
              </div>
            </div>

            {/* Scaled-down Website Preview Stage with Watermark, 1-Min Gate & Capture Shield */}
            <div
              id="studio-preview"
              role="tabpanel"
              aria-labelledby="studio-preview-tab"
              hidden={workspaceTab !== 'preview'}
              className="studio-preview-scaled-shell"
            >
              <div className="studio-scaled-card">
                <div className="studio-scaled-chrome">
                  <div className="studio-scaled-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="studio-scaled-address">
                    <span>https://preview.catolabs.ai/{view.previewFilename || 'index.html'}</span>
                  </div>
                  <button
                    type="button"
                    className="studio-scaled-maximize"
                    disabled={isPreviewExpired}
                    onClick={() => setExpandedModal(true)}
                  >
                    <ExpandIcon size={13} />
                    <span>Expand Fullscreen</span>
                  </button>
                </div>

                <div className="studio-scaled-viewport">
                  {/* Outer Watermark Overlay */}
                  <div className="studio-watermark-overlay" aria-hidden="true">
                    {Array.from({ length: 18 }, (_, i) => (
                      <span key={i}>CATO STUDIO · PROTECTED PREVIEW</span>
                    ))}
                  </div>

                  {/* Screenshot Deterrence Shield */}
                  {captureShielded && !isPreviewExpired && (
                    <div className="studio-capture-shield" role="alert">
                      <ShieldAlertIcon size={28} />
                      <h4>Preview Protected by Cato Studio</h4>
                      <p>
                        Screenshots and screen capture are disabled on live studio previews. Click
                        below to resume viewing your interactive build.
                      </p>
                      <button
                        type="button"
                        className="kit-mini-btn"
                        onClick={() => setCaptureShielded(false)}
                      >
                        Resume live preview
                      </button>
                    </div>
                  )}

                  {/* 1-Minute Preview Limit -> Save Website & Haiku Chatbot Lead Capture Gate */}
                  {isPreviewExpired ? (
                    renderLeadCaptureGate(view, build)
                  ) : (
                    builds
                      .filter((entry) => visitedBuilds.has(entry.localId))
                      .map((canvasView) => {
                        const canvasBuild = live.current.find(
                          (entry) => entry.localId === canvasView.localId
                        );
                        if (!canvasBuild) return null;
                        const canvasHtml = canvasView.previewHtml ?? htmlOf(canvasView);
                        const canvasActive =
                          !terminal(canvasView.status) && canvasView.status !== 'disconnected';
                        return (
                          <div
                            key={canvasView.localId}
                            hidden={canvasView.localId !== selectedBuild}
                            className="studio-canvas-instance"
                          >
                            <LiveCanvas
                              key={`${canvasView.localId}:${canvasView.previewFilename || 'stream'}:${canvasView.previewFragment || ''}`}
                              html={canvasHtml}
                              streaming={canvasActive && !/<\/html\s*>/i.test(canvasHtml)}
                              agentId={canvasView.responseId || canvasView.localId}
                              agentName={canvasView.name}
                              initialFragment={canvasView.previewFragment}
                              previousChatResponseId={canvasView.chatResponseId}
                              onChatResponseId={(id) => {
                                canvasBuild.chatResponseId = id;
                                publish();
                              }}
                              previousPendingChatResponseId={canvasView.chatPendingResponseId}
                              onChatPendingResponseId={(id) => {
                                canvasBuild.chatPendingResponseId = id;
                                publish();
                              }}
                              onNavigate={(href) => void navigate(canvasBuild, href)}
                              onRenderError={(message) => {
                                canvasBuild.error = message;
                                publish();
                              }}
                              onCaptureAttempt={triggerCaptureShield}
                            />
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Code Inspector Tab (Read-Only, No Downloads) */}
            <div
              id="studio-code"
              role="tabpanel"
              aria-labelledby="studio-code-tab"
              hidden={workspaceTab !== 'code'}
              className="studio-code"
            >
              {isPreviewExpired ? (
                renderLeadCaptureGate(view, build)
              ) : selectedSource?.loading ? (
                <p role="status" className="studio-empty-note">
                  Loading {filename}…
                </p>
              ) : selectedSource?.error ? (
                <p role="alert" className="native-build__error">
                  {selectedSource.error}
                </p>
              ) : selectedSource?.binary ? (
                <p className="studio-empty-note">
                  {filename} is a binary asset managed inside the studio preview.
                </p>
              ) : code ? (
                <CodeBlock code={code} language={language} showLineNumbers>
                  <CodeBlockHeader>
                    <CodeBlockFilename>{filename} · read only</CodeBlockFilename>
                    <CodeBlockCopyButton />
                  </CodeBlockHeader>
                </CodeBlock>
              ) : (
                <p className="studio-empty-note">
                  Select a project file or wait for the first HTML from your build.
                </p>
              )}
            </div>

            {/* Project Files & Explorer Tab */}
            <div
              id="studio-files"
              role="tabpanel"
              aria-labelledby="studio-files-tab"
              hidden={workspaceTab !== 'files'}
              className="studio-files-panel"
            >
              <FileTree
                key={view.localId}
                selectedPath={selectedSource?.fileId}
                onSelect={(id) => {
                  const file = view.files.find((entry) => entry.id === id);
                  if (file && build) void openFile(build, file);
                }}
              >
                <ProjectFiles nodes={projectFileTree(view.files)} />
              </FileTree>
              {!view.files.length && (
                <p className="studio-empty-note">
                  Project files appear here as the agent builds your website.
                </p>
              )}
              {html && (
                <button
                  type="button"
                  className="studio-stream-file"
                  onClick={() => {
                    setSource(null);
                    ++fileRequest.current;
                    setWorkspaceTab('code');
                  }}
                >
                  View streamed index.html
                </button>
              )}
              {build?.responseId && (
                <button
                  type="button"
                  className="studio-stream-file"
                  onClick={() =>
                    void refreshFiles(build).catch((error: unknown) => {
                      build.error = messageOf(error);
                      publish();
                    })
                  }
                >
                  Refresh files
                </button>
              )}
            </div>

            {/* Sandbox Terminal */}
            {output && (
              <Terminal
                output={output}
                isStreaming={sandbox.some((entry) => !entry.done) && active}
                className="studio-terminal"
              >
                <TerminalHeader>
                  <TerminalTitle>Sandbox terminal</TerminalTitle>
                  <TerminalCopyButton />
                </TerminalHeader>
                <TerminalContent />
              </Terminal>
            )}
          </section>
        )}

        {/* ChatGPT-Style Scrollable Conversation & AI Elements Trace */}
        <section className="studio-chat-column" aria-label="AI build conversation and reasoning trace">
          <Conversation className="studio-conversation">
            <ConversationContent>
              {view ? (
                <>
                  <Message from="user">
                    <MessageContent>
                      <MessageResponse>{view.prompt}</MessageResponse>
                    </MessageContent>
                  </Message>

                  <Message from="assistant">
                    <MessageContent>
                      <NativeAgentTrace
                        title="Grounded Research & Three.js Website Build"
                        entries={view.trace}
                        agentName={view.name}
                        model={view.model}
                        active={active}
                        streamedHtml={html}
                      />

                      {hasHtml && activeStage === 'chat' && (
                        <div className="studio-inline-preview-cta">
                          <div className="studio-inline-preview-cta__info">
                            <SparklesIcon size={16} />
                            <div>
                              <strong>Live Website Canvas Ready</strong>
                              <p>
                                Explore your Three.js multipage website on the interactive preview
                                stage (1-minute live preview).
                              </p>
                            </div>
                          </div>
                          <div className="studio-inline-preview-cta__actions">
                            <button
                              type="button"
                              className="kit-mini-btn"
                              onClick={() => setIdeViewMode('canvas')}
                            >
                              Open Scaled Preview
                            </button>
                            <button
                              type="button"
                              className="kit-mini-btn"
                              disabled={isPreviewExpired}
                              onClick={() => setExpandedModal(true)}
                            >
                              Expand Fullscreen ↗
                            </button>
                          </div>
                        </div>
                      )}

                      {proseOf(view) && (
                        <MessageResponse mode="streaming" isAnimating={active}>
                          {proseOf(view)}
                        </MessageResponse>
                      )}
                    </MessageContent>
                  </Message>
                </>
              ) : (
                <ConversationEmptyState
                  title="What website shall we build today?"
                  description="Pick your model and reasoning effort below. The agent will research SEO, competitors, competitor financials and owners, and design style, then build a live Three.js multipage sample website."
                />
              )}

              {view?.error && (
                <p className="native-build__error" role="alert">
                  {view.error}
                </p>
              )}

              {view && build && (
                <div className="studio-run-actions">
                  {view.status === 'disconnected' && view.responseId && (
                    <button className="kit-mini-btn" onClick={() => void connect(build)}>
                      Reconnect {view.name}
                    </button>
                  )}
                  {!terminal(view.status) && view.responseId && (
                    <button
                      className="kit-mini-btn"
                      onClick={() => void cancel(build)}
                      disabled={view.status === 'cancelling'}
                    >
                      Stop {view.name}
                    </button>
                  )}
                  {terminal(view.status) && (
                    <button
                      className="kit-mini-btn"
                      onClick={() => {
                        setPreviousId(view.status === 'completed' ? view.responseId : '');
                        setPrompt(view.status === 'completed' ? '' : view.prompt);
                        document.getElementById('vibe-prompt')?.focus();
                      }}
                    >
                      {view.status === 'completed' ? 'Revise website' : 'Revise brief'}
                    </button>
                  )}
                  {view.previewFilename && (
                    <button
                      className="kit-mini-btn"
                      onClick={() => {
                        build.previewFilename = undefined;
                        build.previewHtml = undefined;
                        build.previewFragment = undefined;
                        publish();
                      }}
                    >
                      Home preview
                    </button>
                  )}
                  {view.navigating && <span role="status">Opening page…</span>}
                </div>
              )}

              {view?.status === 'completed' && (
                <Checkpoint>
                  <CheckpointIcon />
                  <CheckpointTrigger
                    tooltip="Restore to this checkpoint"
                    onClick={() => {
                      chooseBuild(view.localId);
                      if (build) {
                        build.previewFilename = undefined;
                        build.previewHtml = undefined;
                        build.previewFragment = undefined;
                        publish();
                      }
                      setPreviousId(view.responseId);
                      setPrompt('');
                    }}
                  >
                    Restore {view.name} checkpoint
                  </CheckpointTrigger>
                </Checkpoint>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* AI Elements PromptInput Composer with Markdown Preview, Model Picker & Reasoning Effort Picker */}
          <div className="studio-composer">
            <input
              ref={fileInputRef}
              aria-label="Attach documents"
              type="file"
              multiple
              className="sr-only"
              accept=".pdf,.txt,.md,.csv,.html,.json,.css,.js,.ts,.tsx"
              disabled={readingFiles}
              onChange={(event) => {
                void attach(event.target.files);
                event.target.value = '';
              }}
            />
            <PromptInput
              className="studio-prompt-input"
              onSubmit={() => submit()}
            >
              {(attachments.length > 0 || previousId) && (
                <PromptInputHeader className="studio-prompt-header">
                  {previousId && (
                    <button
                      type="button"
                      className="studio-prompt-chip"
                      onClick={() => setPreviousId('')}
                    >
                      <span>Continuing previous website</span>
                      <XIcon size={12} />
                    </button>
                  )}
                  {attachments.map((file) => (
                    <button
                      key={file.filename}
                      type="button"
                      className="studio-prompt-chip"
                      onClick={() =>
                        setAttachments((previous) => previous.filter((entry) => entry !== file))
                      }
                    >
                      <PaperclipIcon size={12} />
                      <span>{file.filename}</span>
                      <XIcon size={12} />
                    </button>
                  ))}
                </PromptInputHeader>
              )}

              <PromptInputBody className="studio-prompt-body">
                <PromptInputTextarea
                  id="vibe-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={
                    previousId
                      ? 'Describe the refinements for your Three.js website (Markdown supported)…'
                      : 'Describe your business, target audience, and optional design style for your sample Three.js website (Markdown supported)…'
                  }
                />
                {showMarkdownPreview && prompt.trim() && (
                  <div className="studio-prompt-md-preview" aria-label="Rendered Markdown prompt preview">
                    <div className="studio-prompt-md-preview__label">Markdown Preview</div>
                    <MessageResponse>{prompt}</MessageResponse>
                  </div>
                )}
              </PromptInputBody>

              <PromptInputFooter className="studio-prompt-footer">
                <PromptInputTools className="studio-prompt-tools">
                  <PromptInputButton
                    tooltip={readingFiles ? 'Reading files…' : 'Attach brief or PDF'}
                    disabled={readingFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className="studio-tool-btn"
                  >
                    <PaperclipIcon className="size-4" />
                  </PromptInputButton>

                  <PromptInputButton
                    tooltip={showMarkdownPreview ? 'Hide Markdown preview' : 'Show Markdown preview'}
                    aria-pressed={showMarkdownPreview}
                    onClick={() => setShowMarkdownPreview((v) => !v)}
                    className="studio-tool-btn"
                  >
                    <EyeIcon className="size-4" />
                  </PromptInputButton>

                  {/* Perplexity Agent API Model Picker (Latest version of each model) */}
                  <PromptInputSelect
                    value={selectedModel}
                    onValueChange={(value) => setSelectedModel(value)}
                  >
                    <PromptInputSelectTrigger
                      aria-label="Select Agent Model"
                      className="studio-select-trigger"
                    >
                      <CpuIcon className="size-3.5 shrink-0" />
                      <PromptInputSelectValue placeholder="Select model" />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {models.map((m) => (
                        <PromptInputSelectItem key={m.id} value={m.id}>
                          {formatModelLabel(m.id)}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>

                  {/* Reasoning Effort Picker */}
                  <PromptInputSelect
                    value={reasoningEffort}
                    onValueChange={(value) => setReasoningEffort(value as ReasoningEffort)}
                  >
                    <PromptInputSelectTrigger
                      aria-label="Select Reasoning Effort"
                      className="studio-select-trigger"
                    >
                      <BrainCircuitIcon className="size-3.5 shrink-0" />
                      <PromptInputSelectValue placeholder="Reasoning effort" />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {REASONING_OPTIONS.map((opt) => (
                        <PromptInputSelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>

                  <span className="studio-char-count">{prompt.length}</span>
                </PromptInputTools>

                <PromptInputSubmit
                  aria-label={active ? 'Stop agent' : 'Build website'}
                  status={active ? 'streaming' : undefined}
                  onStop={view && build && active ? () => void cancel(build) : undefined}
                  disabled={!active && (!prompt.trim() || readingFiles)}
                />
              </PromptInputFooter>
            </PromptInput>
            {formError && <p role="alert" className="native-build__error">{formError}</p>}
          </div>
        </section>
      </div>

      {/* ---------- Fullscreen / Expanded Modal Preview (<dialog>) ---------- */}
      <dialog
        ref={dialogRef}
        className="studio-expanded-dialog"
        aria-label="Expanded website preview"
        onClose={() => setExpandedModal(false)}
      >
        {expandedModal && view && build && (
          <div className="studio-expanded-dialog__inner">
            <header className="studio-expanded-dialog__bar">
              <div className="studio-expanded-dialog__title">
                <AsteriskIcon className="studio-mark" aria-hidden="true" />
                <strong>{view.name} · Fullscreen Interactive Preview</strong>
                <span>https://preview.catolabs.ai/{view.previewFilename || 'index.html'}</span>
              </div>
              <div className="studio-editor-actions">
                <span className="studio-timer-pill" data-expired={isPreviewExpired}>
                  <ClockIcon size={12} />
                  <span>
                    {isPreviewExpired
                      ? 'Preview saved · 0:00'
                      : `Preview · 0:${String(previewRemainingSec).padStart(2, '0')}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="studio-expand-btn"
                  onClick={() => setExpandedModal(false)}
                >
                  <Minimize2Icon size={14} />
                  <span>Exit Fullscreen</span>
                </button>
              </div>
            </header>
            <div className="studio-expanded-dialog__stage">
              <div className="studio-watermark-overlay" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <span key={i}>CATO STUDIO · PROTECTED PREVIEW</span>
                ))}
              </div>
              {isPreviewExpired ? (
                renderLeadCaptureGate(view, build)
              ) : (
                <LiveCanvas
                  key={`expanded:${view.localId}:${view.previewFilename || 'stream'}:${view.previewFragment || ''}`}
                  html={html}
                  streaming={active && !/<\/html\s*>/i.test(html)}
                  agentId={view.responseId || view.localId}
                  agentName={view.name}
                  initialFragment={view.previewFragment}
                  previousChatResponseId={view.chatResponseId}
                  onChatResponseId={(id) => {
                    build.chatResponseId = id;
                    publish();
                  }}
                  previousPendingChatResponseId={view.chatPendingResponseId}
                  onChatPendingResponseId={(id) => {
                    build.chatPendingResponseId = id;
                    publish();
                  }}
                  onNavigate={(href) => void navigate(build, href)}
                  onRenderError={(message) => {
                    build.error = message;
                    publish();
                  }}
                  onCaptureAttempt={triggerCaptureShield}
                />
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
