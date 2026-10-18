"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { createCanvasDocument } from "./canvas-runtime";
import "./live-canvas.css";

export type CanvasMetrics = { elements: number; paints: number; characters: number; activeElement: string };

type LiveCanvasProps = {
  html: string;
  streaming: boolean;
  agentId: string;
  agentName: string;
  onMetrics?: (metrics: CanvasMetrics) => void;
  onNavigate?: (href: string) => void;
  onRenderError?: (message: string) => void;
  previousChatResponseId?: string;
  onChatResponseId?: (id: string) => void;
  previousPendingChatResponseId?: string;
  onChatPendingResponseId?: (id: string | undefined) => void;
  initialFragment?: string;
};

export default function LiveCanvas({ html, streaming, agentId, agentName, onMetrics, onNavigate, onRenderError, previousChatResponseId, onChatResponseId, previousPendingChatResponseId, onChatPendingResponseId, initialFragment }: LiveCanvasProps) {
  const channel = useId();
  const iframe = useRef<HTMLIFrameElement>(null);
  const chatRequests = useRef(new Map<string, AbortController>());
  const latest = useRef({ html, streaming, agentId, agentName, onMetrics, onNavigate, onRenderError, previousChatResponseId, onChatResponseId, previousPendingChatResponseId, onChatPendingResponseId, initialFragment });
  const document = useMemo(() => createCanvasDocument(channel), [channel]);

  useEffect(() => {
    latest.current = { html, streaming, agentId, agentName, onMetrics, onNavigate, onRenderError, previousChatResponseId, onChatResponseId, previousPendingChatResponseId, onChatPendingResponseId, initialFragment };
  }, [html, streaming, agentId, agentName, onMetrics, onNavigate, onRenderError, previousChatResponseId, onChatResponseId, previousPendingChatResponseId, onChatPendingResponseId, initialFragment]);

  useEffect(() => {
    iframe.current?.contentWindow?.postMessage({ type: "render", channel, html, streaming, agentId, agentName, fragment: initialFragment }, "*");
  }, [html, streaming, agentId, agentName, channel, initialFragment]);

  useEffect(() => {
    const requests = chatRequests.current;
    const chat = async (requestId: string, input: string) => {
      const source = iframe.current?.contentWindow;
      if (!source) return;
      const send = (event: unknown) => source.postMessage({ type: 'cato:chat:event', requestId, event }, '*');
      if (requests.size) { send({ type: 'error', error: { message: 'Please wait for the current reply.' } }); return; }
      const controller = new AbortController();
      requests.set(requestId, controller);
      try {
        if (latest.current.previousPendingChatResponseId) {
          const pending = await fetch(`/api/vibe-chat?r=${encodeURIComponent(latest.current.previousPendingChatResponseId)}`, { signal: controller.signal });
          if (!pending.ok) throw new Error('The previous reply could not be retrieved. Please retry before starting another turn.');
          const snapshot = await pending.json();
          if (snapshot.status === 'completed' && typeof snapshot.id === 'string') {
            latest.current.previousChatResponseId = snapshot.id;
            latest.current.onChatResponseId?.(snapshot.id);
          } else if (!['failed', 'cancelled', 'incomplete'].includes(snapshot.status)) {
            throw new Error('The previous reply is still running. Please wait and retry; no new message was sent.');
          }
          latest.current.previousPendingChatResponseId = undefined;
          latest.current.onChatPendingResponseId?.(undefined);
          if (snapshot.status !== 'completed') throw new Error(snapshot.error?.message || 'The previous reply did not complete. You can now retry your message.');
        }
        const response = await fetch('/api/vibe-chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, previous_response_id: latest.current.previousChatResponseId || undefined }), signal: controller.signal,
        });
        if (!response.ok) {
          let message = response.status === 429 ? 'Please pause before sending another message.' : 'Chat is unavailable. Please try again.';
          try {
            const detail = await response.json();
            if (typeof detail?.error?.message === 'string') message = detail.error.message;
          } catch { /* Keep the readable HTTP error if the response is not JSON. */ }
          throw new Error(message);
        }
        if (!response.body) throw new Error('The chat response did not include a stream.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let ended = false;
        const consume = (block: string) => {
          const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (!data || data === '[DONE]') return;
          const event: unknown = JSON.parse(data);
          if (!event || typeof event !== 'object' || !('type' in event)) throw new Error('The chat stream was interrupted.');
          if ('response' in event && event.response && typeof event.response === 'object' && 'id' in event.response && typeof event.response.id === 'string') {
            if (event.type === 'response.completed') {
              latest.current.previousChatResponseId = event.response.id;
              latest.current.onChatResponseId?.(event.response.id);
            } else if (!['response.failed', 'response.cancelled', 'response.incomplete'].includes(String(event.type))) {
              latest.current.previousPendingChatResponseId = event.response.id;
              latest.current.onChatPendingResponseId?.(event.response.id);
            }
          }
          if (['response.completed', 'response.failed', 'response.cancelled', 'response.incomplete'].includes(String(event.type))) {
            latest.current.previousPendingChatResponseId = undefined;
            latest.current.onChatPendingResponseId?.(undefined);
          }
          send(event);
          if (['response.completed', 'response.failed', 'response.cancelled', 'response.incomplete', 'error'].includes(String(event.type))) ended = true;
        };
        try {
          for (;;) {
            const { done, value } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            let separator: RegExpExecArray | null;
            while ((separator = /\r?\n\r?\n/.exec(buffer))) {
              consume(buffer.slice(0, separator.index));
              buffer = buffer.slice(separator.index + separator[0].length);
            }
            if (done) break;
          }
          if (buffer.trim()) consume(buffer);
          if (!ended) throw new Error('The chat stream ended before the reply was complete.');
        } finally { reader.releaseLock(); }
      } catch (error) {
        if (!controller.signal.aborted) send({ type: 'error', error: { message: error instanceof Error ? error.message : 'Chat is unavailable.' } });
      } finally { requests.delete(requestId); }
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow) return;
      if (event.data?.type === 'cato:chat') {
        const { requestId, input } = event.data;
        if (typeof requestId !== 'string' || !requestId || requestId.length > 128 || typeof input !== 'string' || !input.trim() || input.length > 4000) return;
        void chat(requestId, input);
        return;
      }
      if (event.data?.channel !== channel) return;
      if (event.data.type === 'navigate' && typeof event.data.href === 'string') {
        if (requests.size) latest.current.onRenderError?.('Please wait for the current chat reply before changing pages.');
        else latest.current.onNavigate?.(event.data.href);
      }
      if (event.data.type === 'render-error' && typeof event.data.message === 'string') latest.current.onRenderError?.(event.data.message);
      if (event.data.type === "ready") {
        const { html, streaming, agentId, agentName, initialFragment } = latest.current;
        iframe.current?.contentWindow?.postMessage({ type: "render", channel, html, streaming, agentId, agentName, fragment: initialFragment }, "*");
      }
      if (event.data.type === "metrics") {
        const { elements, paints, characters, activeElement } = event.data;
        if ([elements, paints, characters].every((value) => typeof value === "number" && Number.isFinite(value)) && typeof activeElement === "string") {
          latest.current.onMetrics?.({ elements, paints, characters, activeElement });
        }
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      requests.forEach(controller => controller.abort());
      requests.clear();
    };
  }, [channel]);

  return <iframe ref={iframe} className="vibe-live-canvas" title={`${agentName} website preview`}
    sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={document}
    onLoad={() => {
      const { html, streaming, agentId, agentName, initialFragment } = latest.current;
      iframe.current?.contentWindow?.postMessage({ type: 'render', channel, html, streaming, agentId, agentName, fragment: initialFragment }, '*');
    }} />;
}
