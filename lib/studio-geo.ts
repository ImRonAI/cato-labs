import type { NextRequest } from 'next/server';

/**
 * City-level visitor geolocation for the studio concierge.
 * Production (Vercel) reads the edge geo headers; elsewhere it falls back to a
 * cached IP lookup. Nothing finer than city is ever returned or stored.
 */
export interface VisitorGeo {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
}

export interface VisitorWeather {
  tempC: number;
  label: string;
  isDay: boolean;
}

const geoCache = new Map<string, { at: number; geo: VisitorGeo | null }>();
const weatherCache = new Map<string, { at: number; weather: VisitorWeather | null }>();
const GEO_TTL = 6 * 60 * 60 * 1000;
const WEATHER_TTL = 20 * 60 * 1000;

function header(req: NextRequest, name: string): string | undefined {
  const raw = req.headers.get(name);
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw).trim() || undefined;
  } catch {
    return raw.trim() || undefined;
  }
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number.parseFloat(v) : typeof v === 'number' ? v : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === 'unknown' ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    ip.startsWith('fe80') ||
    ip.startsWith('::ffff:127.')
  );
}

export async function resolveVisitorGeo(req: NextRequest): Promise<VisitorGeo | null> {
  const city = header(req, 'x-vercel-ip-city');
  const countryCode = header(req, 'x-vercel-ip-country');
  if (city || countryCode) {
    return {
      city,
      region: header(req, 'x-vercel-ip-country-region'),
      countryCode,
      lat: num(header(req, 'x-vercel-ip-latitude')),
      lon: num(header(req, 'x-vercel-ip-longitude')),
      timezone: header(req, 'x-vercel-ip-timezone'),
    };
  }

  const ip = clientIp(req);
  const local = isPrivateIp(ip);
  // A private address in production means a proxy we can't see through; don't guess.
  if (local && process.env.NODE_ENV === 'production') return null;

  const key = local ? 'self' : ip;
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < GEO_TTL) return hit.geo;

  let geo: VisitorGeo | null = null;
  try {
    const url = `https://ipwho.is/${local ? '' : encodeURIComponent(ip)}?fields=success,city,region,country,country_code,latitude,longitude,timezone`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = (await res.json()) as Record<string, unknown>;
    if (data && data.success) {
      const tz = data.timezone as Record<string, unknown> | undefined;
      geo = {
        city: typeof data.city === 'string' ? data.city : undefined,
        region: typeof data.region === 'string' ? data.region : undefined,
        country: typeof data.country === 'string' ? data.country : undefined,
        countryCode: typeof data.country_code === 'string' ? data.country_code : undefined,
        lat: num(data.latitude),
        lon: num(data.longitude),
        timezone: tz && typeof tz.id === 'string' ? tz.id : undefined,
      };
    }
  } catch {
    geo = null;
  }
  if (geo && geo.lat !== undefined && geo.lon !== undefined && (!geo.city || /[-/]/.test(geo.city))) {
    geo.city = (await reverseLocality(geo.lat, geo.lon)) || geo.city;
  }
  geoCache.set(key, { at: Date.now(), geo });
  return geo;
}

/** IP databases often return metro names ("Cathedral City-Palm Desert"); prefer the locality. */
async function reverseLocality(lat: number, lon: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&localityLanguage=en`,
      { cache: 'no-store' }
    );
    const data = (await res.json()) as { locality?: unknown; city?: unknown };
    const name = typeof data.locality === 'string' && data.locality ? data.locality : typeof data.city === 'string' ? data.city : '';
    return name || undefined;
  } catch {
    return undefined;
  }
}

const WMO: Record<number, string> = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'passing showers', 81: 'showers', 82: 'heavy showers', 85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorms', 96: 'thunderstorms', 99: 'thunderstorms',
};

export async function currentWeather(lat?: number, lon?: number): Promise<VisitorWeather | null> {
  if (lat === undefined || lon === undefined) return null;
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < WEATHER_TTL) return hit.weather;
  let weather: VisitorWeather | null = null;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,weather_code,is_day`,
      { cache: 'no-store' }
    );
    const data = (await res.json()) as { current?: Record<string, unknown> };
    const c = data.current;
    const t = num(c?.temperature_2m);
    const code = num(c?.weather_code);
    if (t !== undefined) {
      weather = { tempC: Math.round(t), label: WMO[code ?? -1] ?? 'mild', isDay: c?.is_day === 1 };
    }
  } catch {
    weather = null;
  }
  weatherCache.set(key, { at: Date.now(), weather });
  return weather;
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLon = r(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function localClock(timeZone?: string): { time: string; hour: number; weekday: string } | null {
  if (!timeZone) return null;
  try {
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(now);
    return { time, hour: Number.parseInt(time.slice(0, 2), 10), weekday };
  } catch {
    return null;
  }
}

export function partOfDay(hour: number): string {
  if (hour < 5) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late evening';
}

/** One-line, city-level summary for model instructions. */
export function describeGeo(geo: VisitorGeo | null): string {
  if (!geo) return 'unknown';
  const parts = [geo.city, geo.region, geo.country || geo.countryCode].filter(Boolean);
  return parts.length ? parts.join(', ') : 'unknown';
}
