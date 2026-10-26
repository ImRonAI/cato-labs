import {
  RESOURCE_MIME_TYPE,
  getToolUiResourceUri,
  type McpUiResourceCsp,
  type McpUiResourcePermissions,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
  type CallToolResult,
  type Resource,
  type Tool,
} from '@modelcontextprotocol/client';

/**
 * Direct MCP connection to the Oubliai Telnyx FastMCP server, implementing
 * TelnyxMCP packages/app/src/host/connection.ts and implementation.ts directly
 * without tool restrictions or wrappers.
 */

const IMPLEMENTATION = { name: 'Oubliai Host', version: '1.0.0' };
const DEFAULT_RENDERER_URI = 'ui://prefab/generative.html';

export interface UiResourceData {
  html: string;
  csp?: McpUiResourceCsp;
  permissions?: McpUiResourcePermissions;
}

interface ServerInfo {
  client: Client;
  tools: Map<string, Tool>;
  resources: Map<string, Resource>;
}

async function connectWithFallback(serverUrl: URL, headers: Record<string, string>): Promise<Client> {
  const requestInit: RequestInit = { headers };
  try {
    const client = new Client(IMPLEMENTATION);
    await client.connect(new StreamableHTTPClientTransport(serverUrl, { requestInit }));
    return client;
  } catch (streamableError) {
    console.info('[mcp-app] Streamable HTTP failed:', streamableError);
  }
  const client = new Client(IMPLEMENTATION);
  await client.connect(new SSEClientTransport(serverUrl, { requestInit }));
  return client;
}

let pending: Promise<ServerInfo> | null = null;

export function server(): Promise<ServerInfo> {
  if (!pending) {
    const url = process.env.OUBLIAI_MCP_URL || 'https://oubli-catolabs.fastmcp.app/mcp';
    const key = process.env.HORIZON_API_KEY;
    if (!url || !key) return Promise.reject(new Error('MCP server is not configured'));
    pending = (async () => {
      const client = await connectWithFallback(new URL(url), { Authorization: `Bearer ${key}` });
      const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t] as const));
      const resources = new Map((await client.listResources()).resources.map((r) => [r.uri, r] as const));
      return { client, tools, resources };
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

export function resetServer() {
  pending = null;
}

function readUiMeta(meta: unknown): UiResourceData | undefined {
  if (typeof meta !== 'object' || meta === null) return undefined;
  const ui = (meta as Record<string, unknown>)['ui'];
  if (typeof ui !== 'object' || ui === null) return undefined;
  return ui as UiResourceData;
}

export async function uiResourceForTool(toolOrUri: string): Promise<UiResourceData> {
  const info = await server();
  let uri: string | undefined;
  if (toolOrUri.startsWith('ui://')) {
    uri = toolOrUri;
  } else {
    const tool = info.tools.get(toolOrUri) ?? info.tools.get('generate_prefab_ui');
    uri = (tool ? getToolUiResourceUri(tool) : undefined) ?? DEFAULT_RENDERER_URI;
  }
  const resource = await info.client.readResource({ uri });
  if (resource.contents.length !== 1) throw new Error(`Unexpected contents count: ${resource.contents.length}`);
  const content = resource.contents[0];
  if (!content) throw new Error(`Resource not found: ${uri}`);
  if (content.mimeType !== RESOURCE_MIME_TYPE) throw new Error(`Unsupported MIME type: ${content.mimeType}`);
  const html = 'blob' in content ? atob(content.blob) : content.text;
  const record = content as unknown as Record<string, unknown>;
  const contentMeta = readUiMeta(record['_meta'] ?? record['meta']);
  const listing = info.resources.get(uri) as (Resource & { _meta?: unknown }) | undefined;
  const uiMeta = contentMeta ?? readUiMeta(listing?._meta);
  return { html, csp: uiMeta?.csp, permissions: uiMeta?.permissions };
}

/**
 * Direct implementation of TelnyxMCP packages/app/src/host/implementation.ts
 * oncalltool: calls the tool directly on the MCP server, and if it is a
 * CodeMode operation behind `execute` ("Unknown tool: ..."), invokes it via
 * `execute` with `return await call_tool(name, args)` and parses JSON into
 * `structuredContent`.
 */
export async function callBrowserTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const info = await server();
  const direct = (await info.client.callTool({ name, arguments: args })) as CallToolResult;
  const firstBlock = direct.content?.[0];
  const firstText =
    direct.isError && firstBlock && 'text' in firstBlock && typeof firstBlock.text === 'string'
      ? firstBlock.text
      : '';
  if (!firstText.startsWith('Unknown tool:')) {
    return direct;
  }
  const code = `return await call_tool(${JSON.stringify(name)}, ${JSON.stringify(args ?? {})})`;
  const viaExecute = (await info.client.callTool({
    name: 'execute',
    arguments: { code },
  })) as CallToolResult;
  const execBlock = viaExecute.content?.[0];
  if (
    !viaExecute.isError &&
    !viaExecute.structuredContent &&
    execBlock &&
    'text' in execBlock &&
    typeof execBlock.text === 'string'
  ) {
    try {
      const parsed: unknown = JSON.parse(execBlock.text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          ...viaExecute,
          structuredContent: parsed as Record<string, unknown>,
        };
      }
    } catch {
      /* leave text result as-is */
    }
  }
  return viaExecute;
}

export async function readServerResource(uri: string) {
  const info = await server();
  return info.client.readResource({ uri });
}

export async function listServerResources() {
  const info = await server();
  return info.client.listResources();
}

export async function listServerResourceTemplates() {
  const info = await server();
  return info.client.listResourceTemplates();
}

export async function listServerTools() {
  const info = await server();
  return info.client.listTools();
}
