import { NextRequest } from 'next/server';
import { BUILD_CONFIG, BUILD_INSTRUCTIONS, RESEARCH_CONFIG, RESEARCH_INSTRUCTIONS, buildUserInput, researchUserInput } from './config';
import { verifyNativeResponse } from '@/lib/native-response-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;
const responseIdPattern = /^resp_[\w-]{1,128}$/;

function forward(upstream: Response) {
  const headers = new Headers({
    'Content-Type': upstream.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-store, no-transform',
    'X-Accel-Buffering': 'no',
  });
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) headers.set('Retry-After', retryAfter);
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: { message: 'Invalid JSON request.' } }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: { message: 'A website brief is required.' } }, { status: 400 });
  }
  const { prompt, files, previous_response_id, phase } = body as Record<string, unknown>;
  const research = phase === 'research';
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > 2000) {
    return Response.json({ error: { message: 'The brief must contain 1–2000 characters.' } }, { status: 400 });
  }
  if (previous_response_id !== undefined && (typeof previous_response_id !== 'string' || !responseIdPattern.test(previous_response_id))) {
    return Response.json({ error: { message: 'Invalid previous response ID.' } }, { status: 400 });
  }
  const attachments: ({ type: 'input_file'; filename: string; file_data: string } | { type: 'input_text'; text: string })[] = [];
  if (files !== undefined) {
    if (!Array.isArray(files) || files.length > 10) return Response.json({ error: { message: 'Attach up to 10 documents.' } }, { status: 400 });
    let bytes = 0;
    for (const file of files) {
      if (!file || typeof file !== 'object' || typeof file.filename !== 'string' || !file.filename.trim() || Buffer.byteLength(file.filename, 'utf8') > 255) {
        return Response.json({ error: { message: 'Each attachment requires a filename of at most 255 bytes.' } }, { status: 400 });
      }
      if (file.type === 'input_text' && typeof file.text === 'string') {
        bytes += Buffer.byteLength(file.text, 'utf8');
        attachments.push({ type: 'input_text', text: `Attached source: ${JSON.stringify(file.filename)}\n\n${file.text}` });
      } else if (file.type === 'input_file' && /\.pdf$/i.test(file.filename) && typeof file.file_data === 'string' && /^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/.test(file.file_data)) {
        bytes += Buffer.byteLength(file.file_data.slice(file.file_data.indexOf(',') + 1), 'base64');
        attachments.push({ type: 'input_file', filename: file.filename, file_data: file.file_data });
      } else {
        return Response.json({ error: { message: 'Attach a PDF document or UTF-8 text/source content.' } }, { status: 400 });
      }
      if (bytes > 2.5 * 1024 * 1024) return Response.json({ error: { message: 'Attached documents must total 2.5 MB or less.' } }, { status: 413 });
    }
  }
  const key = process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY;
  if (!key) return Response.json({ error: { message: 'Studio API key is not configured.' } }, { status: 503 });
  try {
    if (typeof previous_response_id === 'string') {
      const verified = await verifyNativeResponse(previous_response_id, BUILD_CONFIG.model, key, req.signal, true);
      if (verified.error) return verified.error;
    }
    return forward(await fetch('https://api.perplexity.ai/v1/agent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(research ? RESEARCH_CONFIG : BUILD_CONFIG),
        instructions: research ? RESEARCH_INSTRUCTIONS : BUILD_INSTRUCTIONS,
        input: [{ role: 'user', content: [{ type: 'input_text', text: research ? researchUserInput(prompt.trim()) : buildUserInput(prompt.trim()) }, ...attachments] }],
        ...(previous_response_id ? { previous_response_id } : {}),
      }),
      cache: 'no-store',
    }));
  } catch {
    return Response.json({ error: { message: 'Could not connect to the Agent API.' } }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('r') || '';
  const cursor = req.nextUrl.searchParams.get('starting_after');
  if (!responseIdPattern.test(id) || (cursor !== null && !/^\d+$/.test(cursor))) {
    return Response.json({ error: { message: 'Invalid response ID or stream cursor.' } }, { status: 400 });
  }
  const key = process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY;
  if (!key) return Response.json({ error: { message: 'Studio API key is not configured.' } }, { status: 503 });
  const url = new URL(`https://api.perplexity.ai/v1/agent/${id}`);
  if (req.nextUrl.searchParams.get('stream') === 'true') {
    url.searchParams.set('stream', 'true');
    if (cursor !== null) url.searchParams.set('starting_after', cursor);
  }
  try {
    const verified = await verifyNativeResponse(id, BUILD_CONFIG.model, key, req.signal);
    if (verified.error) return verified.error;
    if (req.nextUrl.searchParams.get('stream') !== 'true') {
      return Response.json(verified.snapshot, { headers: { 'Cache-Control': 'no-store' } });
    }
    return forward(await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: req.signal }));
  } catch {
    return Response.json({ error: { message: 'Could not retrieve the agent response.' } }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('r') || '';
  if (!responseIdPattern.test(id)) return Response.json({ error: { message: 'Invalid response ID.' } }, { status: 400 });
  const key = process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY;
  if (!key) return Response.json({ error: { message: 'Studio API key is not configured.' } }, { status: 503 });
  try {
    const verified = await verifyNativeResponse(id, BUILD_CONFIG.model, key, req.signal);
    if (verified.error) return verified.error;
    return forward(await fetch(`https://api.perplexity.ai/v1/agent/${id}/cancel`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
    }));
  } catch {
    return Response.json({ error: { message: 'Could not cancel the agent response.' } }, { status: 502 });
  }
}
