import { MUSIC_BPM } from '@/lib/content/journeyLayout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const PRESETS: Record<string, string> = {
  lobby: `Warm downtempo lounge for a Palm Springs hotel lobby, mid-century cool, soft Rhodes, brushed drums, ${MUSIC_BPM} BPM, instrumental`,
  pool: `Sunny poolside house set, desert afternoon, airy synths, steady four-on-the-floor kick, ${MUSIC_BPM} BPM, instrumental`,
  jingle: `Upbeat bright jingle bed for a weekend special, playful plucks and handclaps, ${MUSIC_BPM} BPM, instrumental`,
};

export async function POST(req: Request) {
  const key = process.env.XI_API_KEY || process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: 'Music is not configured.' }, { status: 503 });

  let rawBody: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      rawBody = parsed as Record<string, unknown>;
    }
  } catch {
    /* empty body */
  }

  const { output_format, preset, text, duration_seconds, prompt_influence, loop, ...rest } = rawBody;
  const outputFormat =
    typeof output_format === 'string' && output_format.trim() ? output_format.trim() : undefined;

  if (typeof text === 'string' && text.trim() && !rest.prompt && !rest.composition_plan) {
    const sfxUrl = new URL('https://api.elevenlabs.io/v1/sound-generation');
    if (outputFormat && outputFormat !== 'auto') {
      sfxUrl.searchParams.set('output_format', outputFormat);
    }
    const sfxPayload: Record<string, unknown> = { text: text.trim() };
    if (typeof duration_seconds === 'number' && Number.isFinite(duration_seconds)) {
      sfxPayload.duration_seconds = duration_seconds;
    }
    if (typeof prompt_influence === 'number' && Number.isFinite(prompt_influence)) {
      sfxPayload.prompt_influence = prompt_influence;
    }
    if (typeof loop === 'boolean') {
      sfxPayload.loop = loop;
    }
    if (typeof rest.model_id === 'string' && rest.model_id.trim()) {
      sfxPayload.model_id = rest.model_id.trim();
    }
    const upstream = await fetch(sfxUrl, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify(sfxPayload),
      signal: req.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return Response.json({ error: detail || 'Sound effect generation failed.' }, { status: upstream.status || 502 });
    }
    return new Response(upstream.body, {
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg',
        'cache-control': 'no-store',
      },
    });
  }

  const payload: Record<string, unknown> = {
    ...rest,
    model_id: typeof rest.model_id === 'string' && rest.model_id.trim() ? rest.model_id.trim() : 'music_v2_5',
  };

  if (!payload.prompt && !payload.composition_plan) {
    const presetKey = typeof preset === 'string' && preset in PRESETS ? preset : 'lobby';
    payload.prompt = PRESETS[presetKey];
  }

  const url = new URL('https://api.elevenlabs.io/v1/music/stream');
  url.searchParams.set('output_format', outputFormat || 'auto');

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: req.signal,
  });
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('[music] upstream', upstream.status, detail);
    return Response.json({ error: detail || 'The track could not be generated.' }, { status: upstream.status || 502 });
  }
  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg',
      'cache-control': 'no-store',
    },
  });
}
