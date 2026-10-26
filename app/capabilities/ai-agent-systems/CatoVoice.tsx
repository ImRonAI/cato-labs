'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import type { CallToolResult } from '@modelcontextprotocol/client';
import {
  catoBus,
  goToStop,
  setActivity,
  setMouth,
  setToolMove,
  subscribeCato,
  toolMoveFor,
} from '@/components/webgl/kit/cato/bus';
import { journeyStops } from '@/lib/content/agentJourney';
import { MUSIC_BPM } from '@/lib/content/journeyLayout';
import PrefabView, { callPrefabTool, type PrefabRun } from '@/components/mcp-app/PrefabView';

/**
 * CatoVoice: the "Talk to Cato" dock and the ElevenLabs voice session.
 *
 * - At 3s Cato offers to talk in a thought cloud. Audio and the microphone only
 *   start on the visitor's tap (browser autoplay policy).
 * - Public agent: the browser connects with NEXT_PUBLIC_ELEVENLABS_AGENT_ID
 *   (lock the agent to the site's domains with its allowlist).
 * - SDK events drive Cato's body through catoBus: onModeChange → speaking /
 *   listening; onMCPToolCall → working / success / error plus the matching
 *   Timmy scene (phone, texting, email, fax, video, desk), and its
 *   "awaiting_approval" state raises the Approve / Deny card, answered with
 *   sendMCPToolApprovalResult (@elevenlabs/react 1.18 has no approval-handler
 *   option on the hook, so this is the path its types expose).
 * - Lip-sync: getOutputVolume() sampled every frame while connected.
 * - The tour:
 *   1. Client tool `next_stop` (plus `previous_stop` and `go_to_stop`): when the
 *      visitor asks to move on, the voice agent calls `next_stop`, which starts
 *      Cato's 6s fall to the next ledge, scrolls the page to that stop's copy,
 *      and returns the new stop's copy to the agent.
 *   2. When the visitor clicks a stop's "Next stop" / "Previous stop" button on
 *      the page, the agent is notified via sendContextualUpdate.
 */

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_6201m59shqryftjr75gbrr36m2ra';

function resolveStopParam(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(journeyStops.length - 1, Math.round(raw) - 1));
  }
  if (typeof raw === 'string' && raw.trim()) {
    const q = raw.trim().toLowerCase();
    if (q === 'next' || q === 'forward') return null;
    if (q === 'prev' || q === 'previous' || q === 'back') {
      return Math.max(0, catoBus.targetStop - 1);
    }
    const num = Number(q);
    if (Number.isFinite(num) && num >= 1 && num <= journeyStops.length) return Math.round(num) - 1;
    const idx = journeyStops.findIndex(
      (s) => s.id === q || s.eyebrow.toLowerCase().includes(q) || s.titleLines.join(' ').toLowerCase().includes(q),
    );
    if (idx >= 0) return idx;
  }
  return null;
}

function stopSummary(idx: number): string {
  const s = journeyStops[idx];
  return `Successfully navigated to stop ${idx + 1} of ${journeyStops.length} (${s.id}): "${s.eyebrow}: ${s.titleLines.join(' ')}". On screen: ${s.body}`;
}

/*
 * A Prefab tool Cato built over voice. The SDK types the MCP result as
 * Record<string, any>[]; when it carries the real structuredContent it is used
 * as-is. Otherwise the page renders the same program through /api/mcp-app
 * (generate_prefab_ui only renders; it changes nothing) to get the full result.
 */
function prefabRunFrom(toolName: string, parameters: Record<string, unknown>, result: unknown): PrefabRun {
  const items = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  const full = items.find((r) => r && typeof r === 'object' && 'structuredContent' in r);
  if (full) return { tool: toolName, input: parameters, result: Promise.resolve(full as unknown as CallToolResult) };
  return { tool: toolName, input: parameters, result: callPrefabTool(toolName, parameters) };
}

function isPrefabCodeOrResult(parameters: Record<string, unknown>, result: unknown): boolean {
  const code = typeof parameters?.code === 'string' ? parameters.code : '';
  if (/_workspace|PrefabApp|prefab_ui|\$prefab/.test(code)) return true;
  try {
    const raw = JSON.stringify(result ?? '');
    if (raw.includes('$prefab')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

interface PendingApproval {
  id: string;
  tool: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export default function CatoVoice() {
  return (
    <ConversationProvider>
      <Dock />
    </ConversationProvider>
  );
}

function Dock() {
  const [offer, setOffer] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [note, setNote] = useState('');
  const [prefab, setPrefab] = useState<PrefabRun | null>(null);
  const voiceAudio = useRef<HTMLAudioElement | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReportedStop = useRef<number>(-1);

  const playGeneratedMusic = useCallback(async (params?: Record<string, unknown>) => {
    try {
      setToolMove('dj');
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params ?? {}),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? 'Music generation failed.');
      }
      const blob = await res.blob();
      if (voiceAudio.current?.src) URL.revokeObjectURL(voiceAudio.current.src);
      const a = voiceAudio.current ?? new Audio();
      voiceAudio.current = a;
      a.src = URL.createObjectURL(blob);
      a.onended = () => {
        catoBus.music = null;
        setToolMove(null);
      };
      catoBus.music = { bpm: MUSIC_BPM, audio: a };
      await a.play();
      return 'Audio generated and playing live on the page.';
    } catch (e) {
      catoBus.music = null;
      setToolMove(null);
      return e instanceof Error ? e.message : 'Music generation failed.';
    }
  }, []);

  const flash = useCallback((a: 'success' | 'error', text: string) => {
    setActivity(a);
    setNote(text);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      setActivity('listening');
      setToolMove(null);
    }, 4000);
  }, []);

  const moveStopFromAgent = useCallback((targetIdx: number) => {
    const idx = goToStop(targetIdx);
    lastReportedStop.current = idx;
    return stopSummary(idx);
  }, []);

  const conv = useConversation({
    clientTools: {
      next_stop: async (params?: { stop?: string | number; index?: string | number; id?: string }) => {
        const explicit = resolveStopParam(params?.stop ?? params?.index ?? params?.id);
        const target = explicit !== null ? explicit : Math.min(journeyStops.length - 1, catoBus.targetStop + 1);
        return moveStopFromAgent(target);
      },
      previous_stop: async () => {
        const target = Math.max(0, catoBus.targetStop - 1);
        return moveStopFromAgent(target);
      },
      go_to_stop: async (params?: { stop?: string | number; index?: string | number; id?: string }) => {
        const explicit = resolveStopParam(params?.stop ?? params?.index ?? params?.id);
        const target = explicit !== null ? explicit : Math.min(journeyStops.length - 1, catoBus.targetStop + 1);
        return moveStopFromAgent(target);
      },
      generate_music: async (params?: Record<string, unknown>) => playGeneratedMusic(params),
      generate_sound_effect: async (params?: Record<string, unknown>) => playGeneratedMusic(params),
    },
    onModeChange: ({ mode }) => setActivity(mode === 'speaking' ? 'speaking' : 'listening'),
    onConnect: () => {
      setActivity('listening');
      setNote('Connected. Cato is listening.');
    },
    onDisconnect: () => {
      setActivity('idle');
      setMouth(0, { aa: 0, O: 0, E: 0, SS: 0 });
      setToolMove(null);
      setPending(null);
      setNote('');
      lastReportedStop.current = -1;
    },
    onError: (message) => flash('error', message || 'Something went wrong.'),
    onMCPToolCall: (call) => {
      switch (call.state) {
        case 'loading': {
          const move = toolMoveFor(call.tool_name, call.parameters);
          if (move) setToolMove(move);
          setActivity('working');
          setNote(`Working: ${call.tool_name}`);
          break;
        }
        case 'awaiting_approval':
          setActivity('approval');
          setPending({
            id: call.tool_call_id,
            tool: call.tool_name,
            description: call.tool_description,
            parameters: call.parameters,
          });
          break;
        case 'success':
          setPending((p) => (p?.id === call.tool_call_id ? null : p));
          if (
            call.tool_name === 'generate_prefab_ui' ||
            (call.tool_name === 'execute' && isPrefabCodeOrResult(call.parameters, call.result))
          ) {
            setPrefab(prefabRunFrom(call.tool_name, call.parameters, call.result));
          }
          flash('success', `Done: ${call.tool_name}`);
          break;
        default:
          setPending((p) => (p?.id === call.tool_call_id ? null : p));
          flash('error', `${call.tool_name} did not complete.`);
      }
    },
  });

  const connected = conv.status === 'connected';
  const connecting = conv.status === 'connecting';
  const isSpeaking = conv.isSpeaking;

  /* offer to talk after 3s */
  useEffect(() => {
    const t = setTimeout(() => setOffer(true), 3000);
    return () => clearTimeout(t);
  }, []);

  /*
   * Audio-driven lip-sync from the WebRTC output AnalyserNode:
   * - Samples byte frequency bins (100-8000 Hz) via getOutputByteFrequencyData()
   *   and scalar volume via getOutputVolume() in requestAnimationFrame.
   * - Smooths mouth opening and formant visemes (aa, O, E, SS) with lerp.
   * - Resets to idle (0) when Cato stops speaking or disconnects.
   */
  const getFreq = conv.getOutputByteFrequencyData;
  const getVol = conv.getOutputVolume;
  useEffect(() => {
    if (!connected) {
      setMouth(0, { aa: 0, O: 0, E: 0, SS: 0 });
      return;
    }
    let raf = 0;
    let smoothedOpen = 0;
    let smoothedAA = 0;
    let smoothedO = 0;
    let smoothedE = 0;
    let smoothedSS = 0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      const speaking = isSpeaking || catoBus.activity === 'speaking';
      if (speaking) {
        const freq = getFreq();
        const binCount = freq.length;
        let sumAll = 0;
        let sumLow = 0;
        let sumMid = 0;
        let sumUpperMid = 0;
        let sumHigh = 0;

        const b1 = Math.max(1, Math.floor(binCount * 0.12));
        const b2 = Math.max(b1 + 1, Math.floor(binCount * 0.35));
        const b3 = Math.max(b2 + 1, Math.floor(binCount * 0.65));

        for (let i = 0; i < binCount; i++) {
          const v = freq[i];
          sumAll += v;
          if (i < b1) sumLow += v;
          else if (i < b2) sumMid += v;
          else if (i < b3) sumUpperMid += v;
          else sumHigh += v;
        }

        const avgAll = binCount > 0 ? sumAll / binCount : 0;
        const freqNorm = Math.min(1, Math.max(0, avgAll / 110));
        const volNorm = Math.min(1, Math.max(0, getVol() * 2.2));
        const targetOpen = Math.min(1, Math.max(freqNorm, volNorm));

        const low = b1 > 0 ? sumLow / (b1 * 255) : 0;
        const mid = b2 > b1 ? sumMid / ((b2 - b1) * 255) : 0;
        const upperMid = b3 > b2 ? sumUpperMid / ((b3 - b2) * 255) : 0;
        const high = binCount > b3 ? sumHigh / ((binCount - b3) * 255) : 0;
        const bandTotal = low + mid + upperMid + high;

        let targetAA = targetOpen;
        let targetO = 0;
        let targetE = 0;
        let targetSS = 0;
        if (bandTotal > 0.01) {
          const scale = Math.min(1.15, targetOpen * 1.25);
          targetO = (low / bandTotal) * scale;
          targetAA = (mid / bandTotal) * scale;
          targetE = (upperMid / bandTotal) * scale;
          targetSS = (high / bandTotal) * scale;
        }

        const k = targetOpen > smoothedOpen ? 0.42 : 0.26;
        smoothedOpen = lerp(smoothedOpen, targetOpen, k);
        smoothedAA = lerp(smoothedAA, targetAA, k);
        smoothedO = lerp(smoothedO, targetO, k);
        smoothedE = lerp(smoothedE, targetE, k);
        smoothedSS = lerp(smoothedSS, targetSS, k);
      } else {
        smoothedOpen = lerp(smoothedOpen, 0, 0.35);
        smoothedAA = lerp(smoothedAA, 0, 0.35);
        smoothedO = lerp(smoothedO, 0, 0.35);
        smoothedE = lerp(smoothedE, 0, 0.35);
        smoothedSS = lerp(smoothedSS, 0, 0.35);
        if (smoothedOpen < 0.005) {
          smoothedOpen = 0;
          smoothedAA = 0;
          smoothedO = 0;
          smoothedE = 0;
          smoothedSS = 0;
        }
      }

      setMouth(smoothedOpen, {
        aa: smoothedAA,
        O: smoothedO,
        E: smoothedE,
        SS: smoothedSS,
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setMouth(0, { aa: 0, O: 0, E: 0, SS: 0 });
    };
  }, [connected, isSpeaking, getFreq, getVol]);

  /* tell the agent which stop the visitor moved to via the on-page buttons */
  const sendContext = conv.sendContextualUpdate;
  useEffect(() => {
    if (!connected) return;
    const report = () => {
      const idx = catoBus.targetStop;
      if (idx === lastReportedStop.current) return;
      lastReportedStop.current = idx;
      sendContext(stopSummary(idx));
    };
    report();
    return subscribeCato(report);
  }, [connected, sendContext]);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
      setActivity('idle');
    },
    [],
  );

  const start = useCallback(async () => {
    setNote('');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNote('Cato needs your microphone to talk. Allow it in the browser and try again.');
      return;
    }
    conv.startSession({ agentId: AGENT_ID, connectionType: 'webrtc' });
  }, [conv]);

  const answer = useCallback(
    (ok: boolean) => {
      if (!pending) return;
      conv.sendMCPToolApprovalResult(pending.id, ok);
      setPending(null);
      setActivity(ok ? 'working' : 'listening');
      if (!ok) setNote('Declined. Nothing was sent.');
    },
    [conv, pending],
  );

  return (
    <div className="cato-dock" aria-live="polite">
      {prefab && (
        <div className="cato-cloud cato-prefab">
          <PrefabView
            run={prefab}
            onDone={(ok, result) => {
              if (!ok || !connected) return;
              const state = (result?.structuredContent as Record<string, unknown> | undefined)?.state;
              if (state && Object.keys(state).length > 0) {
                sendContext(`Tool loaded and active on screen. Initial state: ${JSON.stringify(state)}`);
              } else {
                sendContext('Tool loaded and active on screen.');
              }
            }}
            onContextUpdate={(text) => {
              if (connected) sendContext(`Live tool update: ${text}`);
            }}
            onSendMessage={(text) => {
              if (connected) conv.sendUserMessage(text);
            }}
          />
          <button type="button" className="cato-btn cato-btn--ghost" onClick={() => setPrefab(null)}>
            Close
          </button>
        </div>
      )}
      {pending && (
        <div className="cato-cloud cato-approval" role="alertdialog" aria-labelledby="cato-approval-title">
          <h3 id="cato-approval-title">Cato wants to run {pending.tool}</h3>
          {pending.description && <p>{pending.description}</p>}
          <p>
            <code>{JSON.stringify(pending.parameters)}</code>
          </p>
          <div className="cato-cloud-actions">
            <button type="button" className="cato-btn" onClick={() => answer(true)}>
              Approve
            </button>
            <button type="button" className="cato-btn cato-btn--ghost" onClick={() => answer(false)}>
              Deny
            </button>
          </div>
        </div>
      )}

      {!pending && offer && !dismissed && !connected && (
        <div className="cato-cloud">
          <p>
            Hi, I&apos;m Cato. I can call you, text you, or build you a tool while we talk. Want to try?
          </p>
          <div className="cato-cloud-actions">
            {AGENT_ID ? (
              <button type="button" className="cato-btn" onClick={start} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Talk to Cato'}
              </button>
            ) : (
              <span className="cato-status">Voice is not configured yet.</span>
            )}
            <button type="button" className="cato-btn cato-btn--ghost" onClick={() => setDismissed(true)}>
              Not now
            </button>
          </div>
        </div>
      )}

      {connected && (
        <button type="button" className="cato-btn cato-btn--ghost" onClick={() => conv.endSession()}>
          End conversation
        </button>
      )}
      {(dismissed || connected) && !connected && AGENT_ID && (
        <button type="button" className="cato-btn" onClick={start} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Talk to Cato'}
        </button>
      )}
      {note && <span className="cato-status">{note}</span>}
    </div>
  );
}
