import { NextRequest } from 'next/server';
import { BUILD_CONFIG, BUILD_INSTRUCTIONS, REASONING_EFFORTS, type ReasoningEffort } from './config';
import { verifyNativeResponse } from '@/lib/native-response-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;
const responseIdPattern = /^resp_[\w-]{1,128}$/;
const modelIdPattern = /^[a-z0-9_-]+\/[a-z0-9._-]+$/i;

type PplxModel = {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
};

function parseModelFamilyAndVersion(id: string): { family: string; version: number[] } {
  const [provider = '', rawName = ''] = id.split('/');
  let clean = rawName.replace(/-preview$/i, '').replace(/-\d{4,}$/i, '');
  if (provider === 'xai' && /^grok-/i.test(clean)) {
    clean = clean.replace(/-(?:reasoning|non-reasoning|multi-agent)$/i, '');
  }
  if (/^nemotron-/i.test(clean)) {
    const match = /^nemotron-(\d+(?:\.\d+)?)/i.exec(clean);
    if (match) {
      return { family: `${provider}/nemotron`, version: match[1].split('.').map(Number) };
    }
  }
  const claude = /^(claude-[a-z]+)-(\d+)(?:-(\d+))?$/i.exec(clean);
  if (claude) {
    return {
      family: `${provider}/${claude[1].toLowerCase()}`,
      version: [Number(claude[2]), Number(claude[3] ?? 0)],
    };
  }
  const tokens = clean.split('-');
  const familyTokens: string[] = [];
  let version = [0];
  let foundVersion = false;
  for (const tok of tokens) {
    if (!foundVersion && /^v?\d+(?:\.\d+)?$/i.test(tok)) {
      foundVersion = true;
      version = tok
        .replace(/^v/i, '')
        .split('.')
        .map((part, idx) => (idx === 1 && part === '20' ? 2 : Number(part)));
    } else {
      familyTokens.push(tok.toLowerCase());
    }
  }
  return { family: `${provider}/${familyTokens.join('-')}`, version };
}

function compareVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function filterLatestModels(models: PplxModel[]): PplxModel[] {
  const latest = new Map<string, { model: PplxModel; version: number[] }>();
  for (const model of models) {
    if (!model || typeof model.id !== 'string') continue;
    const { family, version } = parseModelFamilyAndVersion(model.id);
    const prev = latest.get(family);
    if (!prev || compareVersions(version, prev.version) >= 0) {
      latest.set(family, { model, version });
    }
  }
  return Array.from(latest.values()).map((entry) => entry.model);
}

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
  const { prompt, files, previous_response_id, model, reasoning_effort } = body as Record<string, unknown>;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return Response.json({ error: { message: 'A website brief is required.' } }, { status: 400 });
  }
  if (previous_response_id !== undefined && (typeof previous_response_id !== 'string' || !responseIdPattern.test(previous_response_id))) {
    return Response.json({ error: { message: 'Invalid previous response ID.' } }, { status: 400 });
  }
  const selectedModel = typeof model === 'string' && modelIdPattern.test(model) ? model : BUILD_CONFIG.model;
  const selectedEffort: ReasoningEffort =
    typeof reasoning_effort === 'string' && (REASONING_EFFORTS as readonly string[]).includes(reasoning_effort)
      ? (reasoning_effort as ReasoningEffort)
      : BUILD_CONFIG.reasoning.effort;

  const attachments: ({ type: 'input_file'; filename: string; file_data: string } | { type: 'input_text'; text: string })[] = [];
  if (files !== undefined && Array.isArray(files)) {
    for (const file of files) {
      if (!file || typeof file !== 'object' || typeof file.filename !== 'string' || !file.filename.trim()) continue;
      if (file.type === 'input_text' && typeof file.text === 'string') {
        attachments.push({ type: 'input_text', text: `Attached source: ${JSON.stringify(file.filename)}\n\n${file.text}` });
      } else if (file.type === 'input_file' && typeof file.file_data === 'string') {
        attachments.push({ type: 'input_file', filename: file.filename, file_data: file.file_data });
      }
    }
  }
  const key = process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY;
  if (!key) return Response.json({ error: { message: 'Studio API key is not configured.' } }, { status: 503 });
  try {
    const { max_output_tokens: defaultMaxTokens, ...baseConfig } = BUILD_CONFIG;
    return forward(await fetch('https://api.perplexity.ai/v1/agent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseConfig,
        model: selectedModel,
        reasoning: { effort: selectedEffort },
        ...(selectedModel.startsWith('anthropic/') ? { max_output_tokens: defaultMaxTokens } : {}),
        instructions: BUILD_INSTRUCTIONS,
        input: attachments.length > 0
          ? [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt.trim() }, ...attachments] }]
          : prompt.trim(),
        ...(previous_response_id ? { previous_response_id } : {}),
      }),
      cache: 'no-store',
    }));
  } catch {
    return Response.json({ error: { message: 'Could not connect to the Agent API.' } }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const key = process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY;
  if (!key) return Response.json({ error: { message: 'Studio API key is not configured.' } }, { status: 503 });

  if (req.nextUrl.searchParams.get('models') === 'true') {
    try {
      const upstream = await fetch('https://api.perplexity.ai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
        signal: req.signal,
      });
      if (!upstream.ok) return forward(upstream);
      const payload = (await upstream.json()) as { object?: string; data?: PplxModel[] };
      const data = Array.isArray(payload?.data) ? filterLatestModels(payload.data) : [];
      return Response.json({ object: 'list', data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ error: { message: 'Could not list models from the Agent API.' } }, { status: 502 });
    }
  }

  const id = req.nextUrl.searchParams.get('r') || '';
  const cursor = req.nextUrl.searchParams.get('starting_after');
  if (!responseIdPattern.test(id) || (cursor !== null && !/^\d+$/.test(cursor))) {
    return Response.json({ error: { message: 'Invalid response ID or stream cursor.' } }, { status: 400 });
  }
  const url = new URL(`https://api.perplexity.ai/v1/agent/${id}`);
  if (req.nextUrl.searchParams.get('stream') === 'true') {
    url.searchParams.set('stream', 'true');
    if (cursor !== null) url.searchParams.set('starting_after', cursor);
  }
  try {
    const verified = await verifyNativeResponse(id, undefined, key, req.signal);
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
    const verified = await verifyNativeResponse(id, undefined, key, req.signal);
    if (verified.error) return verified.error;
    return forward(await fetch(`https://api.perplexity.ai/v1/agent/${id}/cancel`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
    }));
  } catch {
    return Response.json({ error: { message: 'Could not cancel the agent response.' } }, { status: 502 });
  }
}
