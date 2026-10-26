'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AppBridge,
  PostMessageTransport,
  buildAllowAttribute,
  type McpUiResourceCsp,
  type McpUiResourcePermissions,
  type McpUiSandboxProxyReadyNotification,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import type { McpUiStyles } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { sandboxUrl } from '@/lib/mcp-app/config';

const IMPLEMENTATION = { name: 'MCP Apps Host', version: '1.0.0' };

export const HOST_STYLE_VARIABLES: McpUiStyles = {
  '--color-background-primary': 'light-dark(#ffffff, #1a1a1a)',
  '--color-background-secondary': 'light-dark(#f5f5f5, #2d2d2d)',
  '--color-background-tertiary': 'light-dark(#e5e5e5, #404040)',
  '--color-background-inverse': 'light-dark(#1a1a1a, #ffffff)',
  '--color-background-ghost': 'light-dark(rgba(255,255,255,0), rgba(26,26,26,0))',
  '--color-background-info': 'light-dark(#eff6ff, #1e3a5f)',
  '--color-background-danger': 'light-dark(#fef2f2, #7f1d1d)',
  '--color-background-success': 'light-dark(#f0fdf4, #14532d)',
  '--color-background-warning': 'light-dark(#fefce8, #713f12)',
  '--color-background-disabled': 'light-dark(rgba(255,255,255,0.5), rgba(26,26,26,0.5))',
  '--color-text-primary': 'light-dark(#1f2937, #f3f4f6)',
  '--color-text-secondary': 'light-dark(#6b7280, #9ca3af)',
  '--color-text-tertiary': 'light-dark(#9ca3af, #6b7280)',
  '--color-text-inverse': 'light-dark(#f3f4f6, #1f2937)',
  '--color-text-ghost': 'light-dark(rgba(107,114,128,0.5), rgba(156,163,175,0.5))',
  '--color-text-info': 'light-dark(#1d4ed8, #60a5fa)',
  '--color-text-danger': 'light-dark(#b91c1c, #f87171)',
  '--color-text-success': 'light-dark(#15803d, #4ade80)',
  '--color-text-warning': 'light-dark(#a16207, #fbbf24)',
  '--color-text-disabled': 'light-dark(rgba(31,41,55,0.5), rgba(243,244,246,0.5))',
  '--color-border-primary': 'light-dark(#e5e7eb, #404040)',
  '--color-border-secondary': 'light-dark(#d1d5db, #525252)',
  '--color-border-tertiary': 'light-dark(#f3f4f6, #374151)',
  '--color-border-inverse': 'light-dark(rgba(255,255,255,0.3), rgba(0,0,0,0.3))',
  '--color-border-ghost': 'light-dark(rgba(229,231,235,0), rgba(64,64,64,0))',
  '--color-border-info': 'light-dark(#93c5fd, #1e40af)',
  '--color-border-danger': 'light-dark(#fca5a5, #991b1b)',
  '--color-border-success': 'light-dark(#86efac, #166534)',
  '--color-border-warning': 'light-dark(#fde047, #854d0e)',
  '--color-border-disabled': 'light-dark(rgba(229,231,235,0.5), rgba(64,64,64,0.5))',
  '--color-ring-primary': 'light-dark(#3b82f6, #60a5fa)',
  '--color-ring-secondary': 'light-dark(#6b7280, #9ca3af)',
  '--color-ring-inverse': 'light-dark(#ffffff, #1f2937)',
  '--color-ring-info': 'light-dark(#2563eb, #3b82f6)',
  '--color-ring-danger': 'light-dark(#dc2626, #ef4444)',
  '--color-ring-success': 'light-dark(#16a34a, #22c55e)',
  '--color-ring-warning': 'light-dark(#ca8a04, #eab308)',
  '--font-sans': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  '--font-mono': "ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace",
  '--font-weight-normal': '400',
  '--font-weight-medium': '500',
  '--font-weight-semibold': '600',
  '--font-weight-bold': '700',
  '--font-text-xs-size': '0.75rem',
  '--font-text-sm-size': '0.875rem',
  '--font-text-md-size': '1rem',
  '--font-text-lg-size': '1.125rem',
  '--font-heading-xs-size': '0.75rem',
  '--font-heading-sm-size': '0.875rem',
  '--font-heading-md-size': '1rem',
  '--font-heading-lg-size': '1.25rem',
  '--font-heading-xl-size': '1.5rem',
  '--font-heading-2xl-size': '1.875rem',
  '--font-heading-3xl-size': '2.25rem',
  '--font-text-xs-line-height': '1.4',
  '--font-text-sm-line-height': '1.4',
  '--font-text-md-line-height': '1.5',
  '--font-text-lg-line-height': '1.5',
  '--font-heading-xs-line-height': '1.4',
  '--font-heading-sm-line-height': '1.4',
  '--font-heading-md-line-height': '1.4',
  '--font-heading-lg-line-height': '1.3',
  '--font-heading-xl-line-height': '1.25',
  '--font-heading-2xl-line-height': '1.2',
  '--font-heading-3xl-line-height': '1.1',
  '--border-radius-xs': '2px',
  '--border-radius-sm': '4px',
  '--border-radius-md': '6px',
  '--border-radius-lg': '8px',
  '--border-radius-xl': '12px',
  '--border-radius-full': '9999px',
  '--border-width-regular': '1px',
  '--shadow-hairline': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  '--shadow-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
};

export interface PrefabRun {
  /** the tool arguments */
  input: Record<string, unknown>;
  /** the real CallToolResult (structuredContent carries the Prefab view) */
  result: Promise<CallToolResult>;
  /** optional tool name or resource URI (defaults to generate_prefab_ui / ui://prefab/generative.html) */
  tool?: string;
}

interface UiResourceData {
  html: string;
  csp?: McpUiResourceCsp;
  permissions?: McpUiResourcePermissions;
}

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch('/api/mcp-app', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? 'The tool server could not be reached.');
  return json as T;
}

export function callPrefabTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  return post<CallToolResult>({ op: 'call', name, arguments: args });
}

function loadSandboxProxy(
  iframe: HTMLIFrameElement,
  csp?: McpUiResourceCsp,
  permissions?: McpUiResourcePermissions,
): Promise<boolean> {
  if (iframe.src) return Promise.resolve(false);
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  const allowAttribute = buildAllowAttribute(permissions);
  if (allowAttribute) iframe.setAttribute('allow', allowAttribute);
  const readyNotification: McpUiSandboxProxyReadyNotification['method'] =
    'ui/notifications/sandbox-proxy-ready';
  const ready = new Promise<boolean>((resolve) => {
    const listener = ({ source, data }: MessageEvent) => {
      if (source === iframe.contentWindow && data?.method === readyNotification) {
        window.removeEventListener('message', listener);
        resolve(true);
      }
    };
    window.addEventListener('message', listener);
  });
  const url = new URL(sandboxUrl(window.location.origin));
  if (csp) url.searchParams.set('csp', JSON.stringify(csp));
  iframe.src = url.href;
  return ready;
}

function hookInitialized(bridge: AppBridge): Promise<void> {
  const prev = bridge.oninitialized;
  return new Promise<void>((resolve) => {
    bridge.oninitialized = (...args) => {
      resolve();
      bridge.oninitialized = prev;
      prev?.(...args);
    };
  });
}

export default function PrefabView({
  run,
  onDone,
  onContextUpdate,
  onSendMessage,
}: {
  run: PrefabRun;
  onDone?: (ok: boolean, result?: CallToolResult) => void;
  onContextUpdate?: (text: string) => void;
  onSendMessage?: (text: string) => void;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const frame = iframe.current;
    if (!frame) return;
    let bridge: AppBridge | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    let initializedOk = false;

    for (const [name, value] of Object.entries(HOST_STYLE_VARIABLES)) {
      document.documentElement.style.setProperty(name, String(value));
    }

    (async () => {
      const resource = await post<UiResourceData>({
        op: 'resource',
        tool: run.tool ?? 'generate_prefab_ui',
      });
      if (cancelled) return;
      await loadSandboxProxy(frame, resource.csp, resource.permissions);
      if (cancelled) return;

      bridge = new AppBridge(
        null,
        IMPLEMENTATION,
        {
          openLinks: {},
          serverTools: {},
          serverResources: {},
          updateModelContext: { text: {} },
        },
        {
          hostContext: {
            theme: 'light',
            platform: 'web',
            styles: { variables: HOST_STYLE_VARIABLES },
            containerDimensions: { maxHeight: 6000 },
            displayMode: 'inline',
            availableDisplayModes: ['inline', 'fullscreen'],
          },
        },
      );

      resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry || !bridge) return;
        const width = Math.round(entry.contentRect.width);
        if (width > 0) {
          bridge.sendHostContextChange({
            containerDimensions: { width, maxHeight: 6000 },
          });
        }
      });
      resizeObserver.observe(frame);

      bridge.oncalltool = async (params) =>
        callPrefabTool(params.name, (params.arguments ?? {}) as Record<string, unknown>);
      bridge.onreadresource = async (params) =>
        post({ op: 'readResource', uri: params.uri });
      bridge.onlistresources = async () =>
        post({ op: 'listResources' });
      bridge.onlistresourcetemplates = async () =>
        post({ op: 'listResourceTemplates' });
      bridge.onopenlink = async (params) => {
        window.open(params.url, '_blank', 'noopener,noreferrer');
        return {};
      };
      bridge.onmessage = async (params) => {
        const blocks = Array.isArray((params as { content?: unknown })?.content)
          ? ((params as { content: Array<{ type?: string; text?: string }> }).content)
          : [];
        const text = blocks.map((b) => b.text ?? '').filter(Boolean).join('\n');
        if (text) onSendMessage?.(text);
        return {};
      };
      bridge.onupdatemodelcontext = async (params) => {
        const parts: string[] = [];
        const blocks = Array.isArray((params as { content?: unknown })?.content)
          ? ((params as { content: Array<{ type?: string; text?: string }> }).content)
          : [];
        for (const b of blocks) if (b?.text) parts.push(b.text);
        if (params?.structuredContent && Object.keys(params.structuredContent).length > 0) {
          parts.push(JSON.stringify(params.structuredContent));
        }
        if (parts.length > 0) onContextUpdate?.(parts.join('\n'));
        return {};
      };
      bridge.onloggingmessage = () => undefined;
      bridge.onsizechange = async ({ width, height }) => {
        const style = getComputedStyle(frame);
        const isBorderBox = style.boxSizing === 'border-box';
        if (width !== undefined) {
          if (isBorderBox) {
            width += parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
          }
          frame.style.minWidth = `min(${width}px, 100%)`;
        }
        if (height !== undefined) {
          if (isBorderBox) {
            height += parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
          }
          frame.style.height = `${height}px`;
        }
      };
      bridge.onrequestdisplaymode = async (params) => {
        const newMode = params.mode === 'fullscreen' ? 'fullscreen' : 'inline';
        bridge?.sendHostContextChange({ displayMode: newMode });
        return { mode: newMode };
      };

      const initialized = hookInitialized(bridge);
      await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
      await bridge.sendSandboxResourceReady({
        html: resource.html,
        csp: resource.csp,
        permissions: resource.permissions,
      });
      await initialized;
      initializedOk = true;
      if (cancelled) return;
      bridge.sendToolInput({ arguments: run.input });
      run.result.then(
        (result) => {
          if (cancelled || !bridge) return;
          bridge.sendToolResult(result);
          onDone?.(!result.isError, result);
        },
        (e) => {
          if (cancelled || !bridge) return;
          bridge.sendToolCancelled({ reason: e instanceof Error ? e.message : String(e) });
          setError(e instanceof Error ? e.message : 'The tool did not render.');
          onDone?.(false);
        },
      );
    })().catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'The tool did not render.');
      onDone?.(false);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (bridge) {
        const b = bridge;
        (async () => {
          if (initializedOk) {
            try {
              await b.teardownResource({});
            } catch {
              /* Prefab renderer does not register ui/resource-teardown */
            }
          }
          await b.close();
        })();
      }
    };
  }, [run, onDone, onContextUpdate, onSendMessage]);

  return (
    <div className="prefab-view">
      <iframe ref={iframe} title="A tool Cato built" className="prefab-frame" />
      {error && <span className="cato-status">{error}</span>}
    </div>
  );
}
