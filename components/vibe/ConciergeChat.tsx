'use client';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import { applyUi, type Step, type UiEvent } from '@/lib/agent-ui';
import { SendIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AgentTrace } from './AgentTrace';
import { GenUi, splitUi } from './GenUi';

/**
 * ConciergeChat — every vibe-built site's chatbot, rendered by the host page
 * with AI Elements (Conversation, Message, MessageContent, MessageResponse with
 * native Streamdown integration, Task, ChainOfThought, Tool, Sandbox, and JSXPreview).
 */

export interface ConciergeConfig {
  brand?: string;
  domain?: string;
  persona?: { name?: string; role?: string; voice?: string };
  greeting?: string;
  accent?: string;
  suggestedQuestions?: string[];
  category?: string;
  audience?: string;
  region?: string;
  feel?: string;
}

interface Turn {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  steps: Step[];
  pending: boolean;
  error?: string;
}

let turnSeq = 0;

export default function ConciergeChat({
  config,
  frame,
}: {
  config: ConciergeConfig;
  frame: React.RefObject<HTMLIFrameElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const linksRef = useRef<{ label: string; href: string }[]>([]);
  const persona = config.persona?.name || 'Concierge';
  const role = config.persona?.role || 'Concierge';
  const accent = /^#[0-9a-f]{3,8}$/i.test(config.accent ?? '') ? config.accent : 'var(--primary)';

  /* the launcher inside the site talks to us; we mirror state back */
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = (e.data ?? {}) as { vibe?: string; links?: { label: string; href: string }[] };
      if (d.vibe === 'toggle') setOpen((o) => !o);
      if (d.vibe === 'links' && Array.isArray(d.links)) linksRef.current = d.links.slice(0, 12);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [frame]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ vibe: open ? 'open' : 'closed' }, '*');
  }, [open, frame]);
  /* open once, a beat after the site is shipped — the concierge introduces itself */
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const update = (id: number, fn: (t: Turn) => Turn) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft('');
    const user: Turn = { id: ++turnSeq, role: 'user', text, steps: [], pending: false };
    const reply: Turn = { id: ++turnSeq, role: 'assistant', text: '', steps: [], pending: true };
    const history = [...turns, user]
      .filter((t) => t.text && !t.error)
      .map((t) => ({ role: t.role, content: t.text }));
    setTurns((prev) => [...prev, user, reply]);

    try {
      const res = await fetch('/api/vibe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-24),
          config: {
            brand: config.brand,
            domain: config.domain,
            personaName: persona,
            personaRole: role,
            personaVoice: config.persona?.voice,
            category: config.category,
            audience: config.audience,
            region: config.region,
            feel: config.feel,
            links: linksRef.current,
          },
        }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 429 ? 'A short pause — too many messages.' : 'offline');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          for (const line of block.split('\n')) {
            if (!line.startsWith('data:')) continue;
            let ev: UiEvent | { t: 'done' } | { t: 'error'; message?: string };
            try {
              ev = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (ev.t === 'done') continue;
            if (ev.t === 'error') {
              const message = ev.message;
              update(reply.id, (t) => ({ ...t, error: message || 'error' }));
              continue;
            }
            const uiEv = ev;
            update(reply.id, (t) =>
              uiEv.t === 'text' ? { ...t, text: t.text + uiEv.delta } : { ...t, steps: applyUi(t.steps, uiEv, 40) }
            );
          }
        }
      }
    } catch (e) {
      update(reply.id, (t) => ({
        ...t,
        error: e instanceof Error && e.message !== 'offline' ? e.message : 'The concierge is off duty for a moment.',
      }));
    } finally {
      update(reply.id, (t) => ({ ...t, pending: false }));
      setBusy(false);
    }
  };

  const LinkButton = ({ href, children }: { href?: string; children?: ReactNode }) => (
    <button
      type="button"
      className="mt-1 inline-flex items-center rounded-full px-3 py-1.5 font-medium text-white text-xs"
      style={{ background: accent }}
      onClick={() => {
        if (href?.startsWith('#')) frame.current?.contentWindow?.postMessage({ vibe: 'goto', href }, '*');
      }}
    >
      {children}
    </button>
  );

  if (!open) return null;

  return (
    <section
      className="vb-concierge"
      aria-label={`Chat with ${persona}`}
      style={{ '--concierge-accent': accent } as React.CSSProperties}
    >
      <header className="vb-concierge__head">
        <span className="vb-concierge__avatar" aria-hidden="true">
          {persona.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-sm">{persona}</span>
          <span className="block truncate text-muted-foreground text-xs">
            {role} · {config.brand || 'online'}
          </span>
        </span>
        <button type="button" className="vb-concierge__x" aria-label="Close chat" onClick={() => setOpen(false)}>
          <XIcon className="size-4" />
        </button>
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="gap-4 p-4">
          <Message from="assistant">
            <MessageContent>
              <MessageResponse>
                {config.greeting || `Hello — I'm ${persona}. Ask me anything about ${config.brand || 'us'}.`}
              </MessageResponse>
            </MessageContent>
          </Message>
          {turns.length === 0 && (config.suggestedQuestions ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(config.suggestedQuestions ?? []).map((q) => (
                <button key={q} type="button" className="vb-chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          {turns.map((t) => {
            if (t.role === 'user') {
              return (
                <Message from="user" key={t.id}>
                  <MessageContent>
                    <MessageResponse>{t.text}</MessageResponse>
                  </MessageContent>
                </Message>
              );
            }
            const { prose, jsx, open: cardOpen } = splitUi(t.text);
            const cleanedProse = prose.replace(/\[(web|page|people|finance):\d+\]/g, '');
            return (
              <Message from="assistant" key={t.id} className="max-w-full">
                <MessageContent className="w-full">
                  {(t.steps.length > 0 || (t.pending && !t.text)) && (
                    <AgentTrace
                      title={
                        t.pending
                          ? `${persona} is working…`
                          : `${persona} used ${t.steps.length} step${t.steps.length === 1 ? '' : 's'}`
                      }
                      steps={t.steps}
                      active={t.pending}
                      defaultOpen={t.pending}
                      className="vb-concierge__trace"
                    />
                  )}
                  {cleanedProse && <MessageResponse>{cleanedProse}</MessageResponse>}
                  <GenUi jsx={jsx} streaming={t.pending && cardOpen} LinkButton={LinkButton} />
                  {t.error && <p className="text-destructive text-xs">{t.error}</p>}
                </MessageContent>
              </Message>
            );
          })}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <form
        className="vb-concierge__row"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${persona}…`}
          aria-label={`Message ${persona}`}
          maxLength={2000}
        />
        <button type="submit" aria-label="Send" disabled={busy || !draft.trim()}>
          <SendIcon className="size-4" />
        </button>
      </form>
    </section>
  );
}
