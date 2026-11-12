import { NextRequest } from 'next/server';
import { ensureMistralBridge } from '@/lib/mistral-bridge';
import {
  currentWeather,
  describeGeo,
  haversineKm,
  localClock,
  partOfDay,
  resolveVisitorGeo,
} from '@/lib/studio-geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface SiteLocation {
  name: string;
  lat: number;
  lon: number;
  tz?: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readLocations(raw: unknown): SiteLocation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => (l && typeof l === 'object' ? (l as Record<string, unknown>) : {}))
    .filter((l) => typeof l.name === 'string' && typeof l.lat === 'number' && typeof l.lon === 'number')
    .map((l) => ({ name: str(l.name), lat: l.lat as number, lon: l.lon as number, tz: str(l.tz) || undefined }));
}

function roundKm(km: number): number {
  if (km < 50) return Math.round(km);
  if (km < 1000) return Math.round(km / 10) * 10;
  return Math.round(km / 50) * 50;
}

function sanitizeGreeting(text: string): string {
  let t = text
    .replace(/\[(?:web|\d)[^\]]*\]/g, '')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const leak = t.search(/\b(let me|word count|count:|draft|note:|revised|here is|here's)\b|\(\d+\)|\d+\s*words?\b/i);
  if (leak > 0) t = t.slice(0, leak);
  return t.replace(/^["“'‘]+|["”'’]+$/g, '').trim();
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    /* empty body is fine */
  }

  const ctx = body.context && typeof body.context === 'object' ? (body.context as Record<string, unknown>) : {};
  const brand = str(ctx.brand) || 'this studio';
  const concierge = str(ctx.concierge) || `${brand} concierge`;
  const facts = str(ctx.facts);
  const tone = str(ctx.tone);
  const locations = readLocations(ctx.locations);

  const [geo] = await Promise.all([resolveVisitorGeo(req)]);
  const weather = await currentWeather(geo?.lat, geo?.lon);
  const clock = localClock(geo?.timezone);

  let nearest: { name: string; km: number; localTime?: string } | null = null;
  if (geo?.lat !== undefined && geo?.lon !== undefined && locations.length) {
    for (const l of locations) {
      const km = haversineKm(geo.lat, geo.lon, l.lat, l.lon);
      if (!nearest || km < nearest.km) nearest = { name: l.name, km, localTime: localClock(l.tz)?.time };
    }
    if (nearest) nearest.km = roundKm(nearest.km);
  }

  const visitor = {
    city: geo?.city,
    region: geo?.region,
    country: geo?.country || geo?.countryCode,
    localTime: clock?.time,
    weekday: clock?.weekday,
    partOfDay: clock ? partOfDay(clock.hour) : undefined,
    weather: weather ? { tempC: weather.tempC, label: weather.label } : undefined,
    nearest,
  };

  const place = geo?.city || geo?.region || geo?.country;
  const fallback = place
    ? `Good ${visitor.partOfDay && visitor.partOfDay !== 'late night' && visitor.partOfDay !== 'late evening' ? visitor.partOfDay : 'evening'}, and welcome from ${place}. I'm ${concierge}. Ask me anything about ${brand}; I'm happy to help you find your way.`
    : `Welcome. I'm ${concierge}. Ask me anything about ${brand}; I'm happy to help you find your way.`;

  if (!process.env.MISTRAL_API_KEY) {
    return Response.json({ text: fallback, responseId: null, visitor, source: 'template' });
  }

  const signals = [
    `Approximate city: ${describeGeo(geo)}`,
    visitor.localTime ? `Visitor part of day: ${visitor.weekday} ${visitor.partOfDay}` : '',
    weather ? `Weather there now: ${weather.tempC}°C, ${weather.label}` : '',
    nearest ? `Nearest ${brand} location: ${nearest.name}, about ${nearest.km.toLocaleString('en-US')} km away` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const instructions = `You are "${concierge}", the AI concierge for ${brand} (a flagship concept showcase built by Cato Labs). A visitor has just arrived on the website. Write the very first message you proactively send them.

BRAND FACTS (only source of truth; do not invent anything beyond them):
${facts}
${tone ? `Tone: ${tone}` : ''}

APPROXIMATE VISITOR SIGNALS (derived from the network connection, city-level only, may be wrong):
${signals || 'none available'}

WRITE THE GREETING:
- Exactly two short sentences (under 45 words in total). Output only the message itself: no preamble, no notes, no word counts, no drafts, no markdown, no emoji, no quotation marks, no sign-off, no citations.
- Warm, poised and in the brand voice. Make it feel personal with exactly ONE light local touch: the city name, or the time of day, or the weather. Never more than one, never more than a passing phrase.
- If a nearest location is listed and it is reasonably relevant, you may relate it to the visitor (for example roughly how far it is). Do not do this if no location is listed.
- Never state a clock time. Only use the visitor's part of day (e.g. "Good evening") if it is listed, and never describe the time at the brand's location.
- Never mention IP addresses, coordinates, tracking, location detection, or how you know where they are. Never guess at their identity, wealth, age, gender, job or reason for visiting. Never claim to see or remember them.
- Do not quote prices, returns, or claims not in the facts.
- End with one gentle, open question or invitation that relates to ${brand}.
- If the signals are unknown, write a warm greeting without any location reference.`;

  try {
    const bridgeUrl = await ensureMistralBridge();
    const upstream = await fetch(`${bridgeUrl}/greeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructions,
        input: '(The visitor has just opened the page. Send your proactive welcome message now.)',
      }),
      cache: 'no-store',
      signal: req.signal,
    });
    if (!upstream.ok) throw new Error(`Mistral greeting bridge ${upstream.status}`);
    const data = (await upstream.json()) as { text?: unknown; responseId?: unknown };
    const text = sanitizeGreeting(str(data.text));
    if (!text) throw new Error('empty greeting');
    return Response.json({
      text,
      responseId: typeof data.responseId === 'string' && /^[\w-]{1,128}$/.test(data.responseId) ? data.responseId : null,
      visitor,
      source: 'mistral-glm-5.3-flash',
    });
  } catch (err) {
    console.warn('[studio-greeting] falling back to template:', err instanceof Error ? err.message : err);
    return Response.json({ text: fallback, responseId: null, visitor, source: 'template' });
  }
}
