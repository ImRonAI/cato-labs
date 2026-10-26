'use client';

import React, { useEffect, useRef, useState } from 'react';
import { catoBus, setToolMove } from '@/components/webgl/kit/cato/bus';
import { MUSIC_BPM } from '@/lib/content/journeyLayout';

/**
 * DjTrack: on the entertainment stop, the visitor asks Cato for a track.
 * /api/music streams an original instrumental from ElevenLabs Music; while it
 * plays, Cato steps up to the DJ booth and locks to its tempo (catoBus.music).
 */
const PRESETS = [
  { id: 'lobby', label: 'Lobby loop' },
  { id: 'pool', label: 'Pool-deck set' },
  { id: 'jingle', label: 'Weekend jingle' },
];

export default function DjTrack() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      audio.current?.pause();
      if (audio.current?.src) URL.revokeObjectURL(audio.current.src);
      catoBus.music = null;
      setToolMove(null);
    },
    [],
  );

  async function play(options: string | Record<string, unknown>) {
    setError('');
    setState('loading');
    audio.current?.pause();
    try {
      const payload = typeof options === 'string' ? { preset: options } : options;
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'The track could not be generated.');
      }
      const blob = await res.blob();
      if (audio.current?.src) URL.revokeObjectURL(audio.current.src);
      const a = audio.current ?? new Audio();
      audio.current = a;
      a.src = URL.createObjectURL(blob);
      a.onended = () => {
        setState('idle');
        catoBus.music = null;
        setToolMove(null);
      };
      catoBus.music = { bpm: MUSIC_BPM, audio: a };
      setToolMove('dj');
      await a.play();
      setState('playing');
    } catch (e) {
      setState('idle');
      catoBus.music = null;
      setToolMove(null);
      setError(e instanceof Error ? e.message : 'The track could not be generated.');
    }
  }

  function stop() {
    audio.current?.pause();
    catoBus.music = null;
    setToolMove(null);
    setState('idle');
  }

  return (
    <div className="aas-dj">
      <div className="aas-dj-row">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="cato-btn cato-btn--ghost" disabled={state === 'loading'} onClick={() => play(p.id)}>
            {p.label}
          </button>
        ))}
        {state === 'playing' && (
          <button type="button" className="cato-btn" onClick={stop}>
            Stop
          </button>
        )}
      </div>
      {state === 'loading' && <span className="cato-status">Cato is composing…</span>}
      {error && <span className="cato-status">{error}</span>}
    </div>
  );
}
