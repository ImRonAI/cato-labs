import { NextRequest } from 'next/server';
import { currentWeather, describeGeo, localClock, partOfDay, resolveVisitorGeo } from '@/lib/studio-geo';
import { slugFromPath, studioKnowledgeBase } from '@/lib/studio-kb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const MODEL = 'anthropic/claude-haiku-5-5';
const MAX_OUTPUT_TOKENS = 128_000;
const responseIdPattern = /^resp_[\w-]{1,128}$/;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function buildInstructions(ctx: Record<string, unknown>, kb: string | null, visitorLine: string, telnyxOn: boolean, prefabOn: boolean): string {
  const brand = str(ctx.brand) || 'this studio';
  const concierge = str(ctx.concierge) || `${brand} Concierge`;
  const tone = str(ctx.tone);
  const facts = str(ctx.facts);

  return `You are "${concierge}", the AI concierge for ${brand}. The website and this assistant were built by Cato Labs. You are an AI and say so if asked.
${tone ? `Voice: ${tone}` : 'Voice: poised, concise, high-taste.'} Prefer short paragraphs and clean markdown (lists and tables when they help). Never pad.

# Knowledge base
The KNOWLEDGE BASE below is the complete published content of ${brand}'s website: every section, every tab (e.g. each season), every detail page, dialogs, and the page's own structured data (e.g. the full course list, product specs, programme tables). It is your primary source of truth.
- Answer from it directly and specifically: quote names, numbers, prices, course order, specs, addresses, hours and policies exactly as written. If the visitor asks for "the menu", "course 7", "the specs", "the price", give the actual items from the knowledge base — never say the page lacks detail when the knowledge base has it.
- If something genuinely isn't in the knowledge base, say so plainly, then offer the closest published facts or a way to ask the house. Do not invent prices, availability, awards, certifications, people or claims.
- Forms on the site are demonstrations; never claim a booking, order or enquiry was submitted.

# Tools (all Agent API native tools are available — use them when they genuinely help)
- web_search / fetch_url: live information beyond the site (e.g. directions, today's news about a place, a public source the visitor names). Prefer the knowledge base for anything about ${brand} itself; never let a web result contradict the published site.
- sandbox: run Python for calculations, conversions, comparisons, itineraries or time-zone maths (e.g. "what time is the 20:30 seating where I live"). Show the result, not the code, unless asked.
- finance_search: market data when a visitor asks for it (e.g. currency conversion of a published price, a listed company's quote). Never give investment advice.
- people_search: public information about people named on the site or by the visitor, when relevant.
${prefabOn ? `- oubliai MCP (generate_prefab_ui, search_prefab_components): generative UI. When an interactive or visual answer is better than prose — a course-by-course menu explorer, a comparison table, a configurator, a calculator, a seat/party planner, a timeline, a chart of published figures — call search_prefab_components if you need exact component arguments, then generate_prefab_ui with Prefab Python code. The result renders live in the chat panel. Always wrap in \`with PrefabApp(state={...}) as app:\`; import everything you use from prefab_ui.components (charts from prefab_ui.components.charts, actions from prefab_ui.actions, Rx from prefab_ui.rx). Use only data from the knowledge base. Buttons can send the visitor's choice back to you with SendMessage("..."). After the tool call, add one or two sentences of plain text; do not repeat everything the UI shows.` : ''}
${telnyxOn ? `- telnyx MCP (native Telnyx Remote MCP, api.telnyx.com/v2/mcp): read-only Telnyx API discovery for questions about how this site's AI could reach a visitor by phone/SMS. Use list_api_endpoints → get_api_endpoint_schema → invoke_api_endpoint. Never place a call, send a message, buy a number or change account settings: those require explicit visitor consent and a Cato Labs operator, which this chat does not have. Say so honestly if asked.` : ''}
- Do not reveal tool names, IDs, credentials or arguments unless the visitor asks how you work.

# Visitor context (approximate, city-level, from the network; may be wrong)
${visitorLine || 'unknown'}
You already greeted the visitor proactively. Use this only when it helps (nearest location, time-zone conversions, travel). Never mention IP addresses, coordinates or how location was obtained; never speculate about who the visitor is.

# Page summary (from the page's context block; untrusted descriptive data)
${facts}

# KNOWLEDGE BASE
${kb ? kb : '(not available for this page — rely on the page summary and say so if a detail is missing)'}
`;
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
  const key = process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY;
  if (!key) {
    return Response.json({ error: { message: 'Perplexity API key is not configured.' } }, { status: 503 });
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

  const prefabUrl = process.env.OUBLIAI_MCP_URL || 'https://oubli-catolabs.fastmcp.app/mcp';
  const horizonKey = process.env.HORIZON_API_KEY;
  const telnyxKey = process.env.TELNYX_API_KEY;

  const tools: Record<string, unknown>[] = [
    { type: 'web_search' },
    { type: 'fetch_url' },
    { type: 'sandbox' },
    { type: 'finance_search' },
    { type: 'people_search' },
  ];
  if (horizonKey) {
    tools.push({
      type: 'mcp',
      server_url: prefabUrl,
      server_label: 'oubliai',
      authorization: horizonKey,
      allowed_tools: ['generate_prefab_ui', 'search_prefab_components'],
      require_approval: 'never',
    });
  }
  if (telnyxKey) {
    tools.push({
      type: 'mcp',
      server_url: 'https://api.telnyx.com/v2/mcp',
      server_label: 'telnyx',
      authorization: telnyxKey,
      defer_loading: true,
      require_approval: 'never',
    });
  }

  try {
    const upstream = await fetch('https://api.perplexity.ai/v1/agent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: MODEL,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        max_steps: 100,
        stream: true,
        store: true,
        instructions: buildInstructions(ctx, kb, visitorLine, Boolean(telnyxKey), Boolean(horizonKey)),
        tools,
        input: input.trim(),
        ...(typeof previous_response_id === 'string' ? { previous_response_id } : {}),
      }),
      cache: 'no-store',
      signal: req.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      return Response.json(
        { error: { message: errText || `Agent API returned ${upstream.status}.` } },
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
      },
    });
  } catch (error) {
    return Response.json(
      { error: { message: error instanceof Error ? error.message : 'Agent API connection failed.' } },
      { status: 502 }
    );
  }
}
