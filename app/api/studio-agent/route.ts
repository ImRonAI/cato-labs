import { NextRequest } from 'next/server';
import { ensureMistralBridge } from '@/lib/mistral-bridge';
import { currentWeather, describeGeo, localClock, partOfDay, resolveVisitorGeo } from '@/lib/studio-geo';
import { slugFromPath, studioKnowledgeBase } from '@/lib/studio-kb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const responseIdPattern = /^[\w-]{1,128}$/;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { message: 'Invalid JSON request.' } }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: { message: 'A message is required.' } }, { status: 400 });
  }

  const { input, previous_response_id, context, page } = body as Record<string, unknown>;
  if (typeof input !== 'string' || !input.trim()) {
    return Response.json({ error: { message: 'A message is required.' } }, { status: 400 });
  }
  if (
    previous_response_id !== undefined &&
    previous_response_id !== null &&
    (typeof previous_response_id !== 'string' || !responseIdPattern.test(previous_response_id))
  ) {
    return Response.json({ error: { message: 'Invalid previous_response_id.' } }, { status: 400 });
  }
  if (!process.env.MISTRAL_API_KEY) {
    return Response.json({ error: { message: 'Mistral API key is not configured.' } }, { status: 503 });
  }

  const ctx =
    context && typeof context === 'object' && !Array.isArray(context) ? (context as Record<string, unknown>) : {};
  const slug =
    slugFromPath(page) ||
    slugFromPath(req.headers.get('referer')) ||
    (typeof ctx.slug === 'string' ? ctx.slug : undefined);
  const kb = studioKnowledgeBase(slug);

  const geo = await resolveVisitorGeo(req).catch(() => null);
  const weather = await currentWeather(geo?.lat, geo?.lon).catch(() => null);
  const clock = localClock(geo?.timezone);
  const visitorLine = geo
    ? [
        describeGeo(geo),
        clock ? `local time ${clock.weekday} ${clock.time} (${partOfDay(clock.hour)})` : '',
        geo.timezone ? `time zone ${geo.timezone}` : '',
        weather ? `${weather.tempC}°C, ${weather.label}` : '',
      ]
        .filter(Boolean)
        .join('; ')
    : '';

  const brand = str(ctx.brand) || 'this studio';
  const concierge = str(ctx.concierge) || `${brand} Concierge`;
  const tone = str(ctx.tone);
  const facts = str(ctx.facts);

  try {
    const bridgeUrl = await ensureMistralBridge();
    const upstream = await fetch(`${bridgeUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        input: input.trim(),
        ...(typeof previous_response_id === 'string' ? { previous_response_id } : {}),
        slug: slug ?? null,
        brand,
        concierge,
        tone,
        facts,
        visitor_line: visitorLine,
        kb,
      }),
      cache: 'no-store',
      signal: req.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      return Response.json(
        { error: { message: errText || `Mistral Concierge Bridge returned ${upstream.status}.` } },
        { status: upstream.status || 502 }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Studio-KB': kb ? `${slug}:${kb.length}` : 'none',
        'X-Concierge-Model': 'zai-glm-5-3-flash',
      },
    });
  } catch (error) {
    return Response.json(
      { error: { message: error instanceof Error ? error.message : 'Mistral Concierge connection failed.' } },
      { status: 502 }
    );
  }
}
