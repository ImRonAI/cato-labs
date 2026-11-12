import {
  callBrowserTool,
  listServerResources,
  listServerResourceTemplates,
  listServerTools,
  readServerResource,
  resetServer,
  uiResourceForTool,
} from '@/lib/mcp-app/server';
import { ensureMistralBridge } from '@/lib/mistral-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const CATO_WORKFLOW_TOOLS = new Set([
  'get_page_knowledge_base',
  'check_discovery_availability',
  'trigger_qualify_book_confirm',
  'trigger_follow_up_sequence',
  'trigger_human_handoff',
  'trigger_daily_digest',
]);

function normalizeInteractiveToolName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('fastmcp_telnyx_mcp_a353.')) {
    return trimmed.slice('fastmcp_telnyx_mcp_a353.'.length);
  }
  for (const wfTool of CATO_WORKFLOW_TOOLS) {
    if (trimmed === wfTool || trimmed.endsWith(`.${wfTool}`)) {
      return wfTool;
    }
  }
  return trimmed;
}

async function callViaMistralBridge(name: string, args: Record<string, unknown>) {
  const baseUrl = await ensureMistralBridge();
  const res = await fetch(`${baseUrl}/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, arguments: args }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Mistral bridge tool call failed (${res.status})`);
  }
  return res.json();
}

export async function POST(req: Request) {
  let body: {
    op?: unknown;
    tool?: unknown;
    uri?: unknown;
    name?: unknown;
    arguments?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  try {
    if (body.op === 'resource') {
      const target =
        typeof body.uri === 'string' && body.uri
          ? body.uri
          : typeof body.tool === 'string' && body.tool
            ? body.tool
            : 'generate_prefab_ui';
      return Response.json(await uiResourceForTool(target));
    }
    if (body.op === 'call' && typeof body.name === 'string' && body.name) {
      const cleanName = normalizeInteractiveToolName(body.name);
      const args =
        typeof body.arguments === 'object' && body.arguments
          ? (body.arguments as Record<string, unknown>)
          : {};
      if (CATO_WORKFLOW_TOOLS.has(cleanName)) {
        return Response.json(await callViaMistralBridge(cleanName, args));
      }
      try {
        return Response.json(await callBrowserTool(cleanName, args));
      } catch {
        return Response.json(await callViaMistralBridge(cleanName, args));
      }
    }
    if (body.op === 'readResource' && typeof body.uri === 'string' && body.uri) {
      return Response.json(await readServerResource(body.uri));
    }
    if (body.op === 'listResources') {
      return Response.json(await listServerResources());
    }
    if (body.op === 'listResourceTemplates') {
      return Response.json(await listServerResourceTemplates());
    }
    if (body.op === 'listTools') {
      return Response.json(await listServerTools());
    }
    return Response.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (e) {
    resetServer();
    console.error('[mcp-app]', e);
    return Response.json(
      { error: e instanceof Error ? e.message : 'The tool server could not be reached.' },
      { status: 502 },
    );
  }
}
