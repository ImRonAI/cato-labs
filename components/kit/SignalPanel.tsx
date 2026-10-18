'use client';

import React, { useEffect, useRef, useState } from 'react';
import './kit.css';

/* ------------------------------------------------------------------ */
/*  SignalPanel — radical-transparency browser signals.                */
/*                                                                     */
/*  Everything is read locally on mount (client-side only), rendered   */
/*  back to the visitor, and handed to the parent via onSignals for    */
/*  the persona generator. Zero network calls: the "locality guess"    */
/*  is derived from the Intl timezone, never from a geo API.           */
/*                                                                     */
/*  onSignals fires once when the signal set is first assembled, and   */
/*  once more if the location row resolves (grant / decline), because  */
/*  that produces a new assembled signal set.                          */
/* ------------------------------------------------------------------ */

export interface BrowserSignals {
  timezone: string;
  timezoneCity: string;
  locale: string;
  languages: string[];
  platform: string;
  screen: { width: number; height: number; dpr: number };
  touch: boolean;
  colorScheme: 'light' | 'dark' | 'unknown';
  reducedMotion: boolean;
  connection?: { effectiveType?: string; saveData?: boolean };
  hardwareConcurrency?: number;
  deviceMemory?: number;
  referrer: string;
  utm: Record<string, string>;
  cookiesEnabled: boolean;
  location: {
    status: 'idle' | 'granted' | 'declined';
    lat?: number;
    lng?: number;
    locality?: string;
  };
}

type LocState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'granted'; lat: number; lng: number }
  | { status: 'declined' };

interface NavigatorExtras extends Navigator {
  connection?: { effectiveType?: string; saveData?: boolean };
  deviceMemory?: number;
  userAgentData?: { platform?: string };
}

function referrerHost(ref: string): string {
  try {
    return new URL(ref).hostname.replace(/^www\./, '');
  } catch {
    return ref;
  }
}

export function SignalPanel({
  onSignals,
}: {
  onSignals?: (s: BrowserSignals) => void;
}): React.JSX.Element {
  const [rows, setRows] = useState<{ label: string; value: string }[] | null>(null);
  const [loc, setLoc] = useState<LocState>({ status: 'idle' });
  const signalsRef = useRef<BrowserSignals | null>(null);
  const onSignalsRef = useRef(onSignals);
  onSignalsRef.current = onSignals;

  useEffect(() => {
    const nav = navigator as NavigatorExtras;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    const city = tz.includes('/') ? tz.split('/').pop()!.replace(/_/g, ' ') : tz;
    const offMin = -new Date().getTimezoneOffset();
    const offHrs = Math.abs(offMin) / 60;
    const gmt = `GMT${offMin >= 0 ? '+' : '-'}${Number.isInteger(offHrs) ? offHrs : offHrs.toFixed(1)}`;

    const languages =
      nav.languages && nav.languages.length ? Array.from(nav.languages) : [nav.language];
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const light = window.matchMedia('(prefers-color-scheme: light)').matches;
    const touch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const utm: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => {
      if (k.startsWith('utm_')) utm[k] = v;
    });

    const signals: BrowserSignals = {
      timezone: tz,
      timezoneCity: city,
      locale: nav.language,
      languages,
      platform: nav.userAgentData?.platform ?? nav.platform ?? 'Unknown',
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        dpr: window.devicePixelRatio ?? 1,
      },
      touch,
      colorScheme: dark ? 'dark' : light ? 'light' : 'unknown',
      reducedMotion: reduced,
      connection: nav.connection
        ? { effectiveType: nav.connection.effectiveType, saveData: nav.connection.saveData }
        : undefined,
      hardwareConcurrency: nav.hardwareConcurrency || undefined,
      deviceMemory: nav.deviceMemory,
      referrer: document.referrer || '',
      utm,
      cookiesEnabled: nav.cookieEnabled,
      location: { status: 'idle' },
    };
    signalsRef.current = signals;

    const r: { label: string; value: string }[] = [
      { label: 'Timezone', value: `${city} · ${gmt}` },
      {
        label: 'Locale',
        value:
          languages.length > 1 ? `${signals.locale} · also ${languages.slice(1).join(', ')}` : signals.locale,
      },
      { label: 'Platform', value: signals.platform },
      {
        label: 'Screen',
        value: `${signals.screen.width} × ${signals.screen.height} @ ${signals.screen.dpr}×`,
      },
      { label: 'Input', value: touch ? 'Touch (coarse pointer)' : 'Mouse (fine pointer)' },
      {
        label: 'Color scheme',
        value:
          signals.colorScheme === 'unknown'
            ? 'No preference'
            : signals.colorScheme === 'dark'
              ? 'Dark preference'
              : 'Light preference',
      },
      {
        label: 'Motion',
        value: reduced ? 'Reduced — we keep things still' : 'Full motion',
      },
    ];
    if (signals.connection?.effectiveType) {
      r.push({
        label: 'Connection',
        value: `${signals.connection.effectiveType}${signals.connection.saveData ? ' · data-saver on' : ''}`,
      });
    }
    if (signals.hardwareConcurrency) {
      r.push({ label: 'CPU threads', value: String(signals.hardwareConcurrency) });
    }
    if (signals.deviceMemory) {
      r.push({ label: 'Memory', value: `≈ ${signals.deviceMemory} GB` });
    }
    r.push({
      label: 'Arrival',
      value: signals.referrer ? `via ${referrerHost(signals.referrer)}` : 'Direct visit',
    });
    const utmKeys = Object.keys(utm);
    if (utmKeys.length) {
      r.push({
        label: 'Campaign',
        value: utmKeys.map((k) => `${k.replace('utm_', '')}: ${utm[k]}`).join(' · '),
      });
    }
    r.push({ label: 'Cookies', value: signals.cookiesEnabled ? 'Enabled' : 'Disabled' });

    setRows(r);
    onSignalsRef.current?.(signals);
  }, []);

  const emitLocation = (location: BrowserSignals['location']) => {
    if (!signalsRef.current) return;
    signalsRef.current = { ...signalsRef.current, location };
    onSignalsRef.current?.(signalsRef.current);
  };

  const shareLocation = () => {
    if (!('geolocation' in navigator)) {
      setLoc({ status: 'declined' });
      emitLocation({ status: 'declined' });
      return;
    }
    setLoc({ status: 'pending' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lng = Math.round(pos.coords.longitude * 100) / 100;
        setLoc({ status: 'granted', lat, lng });
        emitLocation({
          status: 'granted',
          lat,
          lng,
          locality: signalsRef.current?.timezoneCity,
        });
      },
      () => {
        setLoc({ status: 'declined' });
        emitLocation({ status: 'declined' });
      },
      { timeout: 12000, maximumAge: 300000 }
    );
  };

  const locDelay = (rows?.length ?? 0) * 55;

  return (
    <div className="kit-signals glass-card">
      <p className="micro-label">Everything your browser is already telling us</p>

      <div className="kit-sig-rows">
        {rows === null ? (
          <>
            <span className="kit-sr-only">Reading browser signals locally…</span>
            {[64, 48, 56].map((w, i) => (
              <div key={i} className="kit-sig-skel" style={{ width: `${w}%` }} aria-hidden="true" />
            ))}
          </>
        ) : (
          <>
            {rows.map((row, i) => (
              <div className="kit-sig-row" style={{ '--d': `${i * 55}ms` } as React.CSSProperties} key={row.label}>
                <span className="kit-sig-label">{row.label}</span>
                <span className="kit-sig-value">{row.value}</span>
              </div>
            ))}

            {/* location row — permission-gated */}
            <div className="kit-sig-row" style={{ '--d': `${locDelay}ms` } as React.CSSProperties}>
              <span className="kit-sig-label">Precise location</span>
              <span className="kit-sig-value">
                {loc.status === 'idle' && (
                  <button type="button" className="kit-mini-btn" onClick={shareLocation}>
                    Share precise location
                  </button>
                )}
                {loc.status === 'pending' && 'Requesting permission…'}
                {loc.status === 'granted' &&
                  `${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)} · near ${
                    signalsRef.current?.timezoneCity ?? 'you'
                  } (timezone guess)`}
                {loc.status === 'declined' && 'No problem — coarse signals only.'}
              </span>
            </div>
          </>
        )}
      </div>

      <p className="kit-sig-foot">
        <svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true">
          <rect x="0.75" y="5.25" width="9.5" height="7" rx="1.8" fill="none" stroke="var(--blue-400)" />
          <path
            d="M2.75 5.25V4a2.75 2.75 0 0 1 5.5 0v1.25"
            fill="none"
            stroke="var(--blue-400)"
          />
        </svg>
        Read locally, shown to you, never transmitted.
      </p>
    </div>
  );
}

export default SignalPanel;
