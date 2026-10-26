import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps';

/**
 * GET /mcp-sandbox?csp=<json> — the MCP Apps sandbox proxy page (built from the
 * owner's TelnyxMCP sandbox by scripts/build-mcp-sandbox.mjs), with the CSP set
 * as an HTTP header from the resource's declared domains. The CSP builder is
 * TelnyxMCP's serve.ts `buildCspHeader`, unchanged. Only answered on the
 * sandbox origin, never on the page origin (as serve.ts does for its host port).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeCspDomains(domains?: string[]): string[] {
  if (!domains) return [];
  return domains.filter((d) => typeof d === 'string' && !/[;\r\n'" ]/.test(d));
}

function buildCspHeader(csp?: McpUiResourceCsp): string {
  const resourceDomains = sanitizeCspDomains(csp?.resourceDomains).join(' ');
  const connectDomains = sanitizeCspDomains(csp?.connectDomains).join(' ');
  const frameDomains = sanitizeCspDomains(csp?.frameDomains).join(' ') || null;
  const baseUriDomains = sanitizeCspDomains(csp?.baseUriDomains).join(' ') || null;
  const directives = [
    "default-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: ${resourceDomains}`.trim(),
    `style-src 'self' 'unsafe-inline' blob: data: ${resourceDomains}`.trim(),
    `img-src 'self' data: blob: ${resourceDomains}`.trim(),
    `font-src 'self' data: blob: ${resourceDomains}`.trim(),
    `media-src 'self' data: blob: ${resourceDomains}`.trim(),
    `connect-src 'self' ${connectDomains}`.trim(),
    `worker-src 'self' blob: ${resourceDomains}`.trim(),
    frameDomains ? `frame-src ${frameDomains}` : "frame-src 'none'",
    "object-src 'none'",
    baseUriDomains ? `base-uri ${baseUriDomains}` : "base-uri 'none'",
  ];
  return directives.join('; ');
}

export async function GET(req: Request) {
  let csp: McpUiResourceCsp | undefined;
  const raw = new URL(req.url).searchParams.get('csp');
  if (raw) {
    try {
      csp = JSON.parse(raw);
    } catch {
      console.warn('[sandbox] invalid csp query param');
    }
  }
  const html = await readFile(path.join(process.cwd(), 'lib/mcp-app/sandbox.html'), 'utf8');
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy': buildCspHeader(csp),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
