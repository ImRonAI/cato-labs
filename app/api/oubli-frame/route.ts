import { oubliSiteUrl } from '@/lib/content/studio';

/**
 * GET /api/oubli-frame → { framable: boolean }
 *
 * Whether the Studio session on /capabilities/digital-products can end by showing the live
 * oubliai.com inside its window. The site is requested the way the window's iframe would
 * request it, anonymously and following redirects; it is framable only if the final page is
 * oubliai.com itself, answered 2xx, and its headers let another site frame it. (A deployment
 * behind Vercel Authentication, for example, redirects to vercel.com, which refuses framing.)
 */

const TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 6_000;
const siteHost = new URL(oubliSiteUrl).hostname;

/** per framing origin, since a frame-ancestors list may name origins */
const cache = new Map<string, { at: number; framable: boolean }>();

function allowsFraming(headers: Headers, origin: string): boolean {
  const csp = headers.get('content-security-policy') ?? '';
  const ancestors = /(?:^|;)\s*frame-ancestors\s+([^;]*)/i.exec(csp)?.[1].trim();
  if (ancestors) {
    const sources = ancestors.split(/\s+/);
    if (sources.includes("'none'")) return false;
    if (sources.includes('*')) return true;
    const { protocol, host, hostname } = new URL(origin);
    return sources.some((s) => {
      /* scheme source (https:), exact origin, or a bare host */
      if (s === protocol || s === origin || s === host || s === hostname) return true;
      const wild = /^(https?:\/\/)?\*\.(.+)$/.exec(s);
      return wild ? hostname.endsWith(`.${wild[2]}`) : false;
    });
  }
  const xfo = headers.get('x-frame-options')?.trim().toUpperCase();
  return xfo !== 'DENY' && xfo !== 'SAMEORIGIN';
}

async function probe(origin: string): Promise<boolean> {
  try {
    const res = await fetch(oubliSiteUrl, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    const host = new URL(res.url || oubliSiteUrl).hostname;
    const onSite = host === siteHost || host.endsWith(`.${siteHost}`);
    return onSite && res.ok && allowsFraming(res.headers, origin);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const hit = cache.get(origin);
  let framable: boolean;
  if (hit && Date.now() - hit.at < TTL_MS) {
    framable = hit.framable;
  } else {
    framable = await probe(origin);
    cache.set(origin, { at: Date.now(), framable });
  }
  return Response.json(
    { framable },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } },
  );
}
