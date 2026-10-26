/**
 * Where the MCP Apps sandbox proxy is served. The MCP Apps spec requires the
 * sandbox to be a different origin from the host page. Production sets
 * NEXT_PUBLIC_MCP_SANDBOX_URL (https://sandbox.oubliai.com/mcp-sandbox,
 * pointed at this same deployment). In development the default swaps the
 * hostname (localhost ↔ 127.0.0.1), which is a different origin on the same server.
 */
export function sandboxUrl(pageOrigin: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_MCP_SANDBOX_URL;
  if (fromEnv) return fromEnv;
  const u = new URL(pageOrigin);
  u.hostname = u.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1';
  u.pathname = '/mcp-sandbox';
  return u.href;
}
