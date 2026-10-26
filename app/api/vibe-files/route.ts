import { NextRequest } from 'next/server';
import { verifyNativeResponse } from '@/lib/native-response-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy native sandbox file metadata or bytes for in-canvas preview without file downloads. */
export async function GET(req: NextRequest) {
  const responseId = req.nextUrl.searchParams.get('r') || '';
  const fileId = req.nextUrl.searchParams.get('f');
  if (!/^resp_[\w-]{1,128}$/.test(responseId) || (fileId !== null && !/^[\w-]{1,128}$/.test(fileId))) {
    return Response.json({ error: { message: 'Invalid response or file ID.' } }, { status: 400 });
  }
  const key = process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY;
  if (!key) return Response.json({ error: { message: 'Studio API key is not configured.' } }, { status: 503 });
  const url = `https://api.perplexity.ai/v1/agent/${responseId}/files${fileId ? `/${fileId}/content` : ''}`;
  try {
    const verified = await verifyNativeResponse(responseId, undefined, key, req.signal);
    if (verified.error) return verified.error;
    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: req.signal });
    const headers = new Headers({
      'Content-Type': upstream.headers.get('content-type') || (fileId ? 'text/plain; charset=utf-8' : 'application/json'),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) headers.set('Retry-After', retryAfter);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: { message: 'Could not retrieve agent files.' } }, { status: 502 });
  }
}
