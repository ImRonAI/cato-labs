import {
  callBrowserTool,
  listServerResources,
  listServerResourceTemplates,
  listServerTools,
  readServerResource,
  resetServer,
  uiResourceForTool,
} from '@/lib/mcp-app/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

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
      const args =
        typeof body.arguments === 'object' && body.arguments
          ? (body.arguments as Record<string, unknown>)
          : {};
      return Response.json(await callBrowserTool(body.name, args));
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
