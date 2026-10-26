import { journeyStops } from '@/lib/content/agentJourney';
import { scrollToTarget } from '@/components/webgl/ScrollDirector';

/**
 * catoBus: the one mutable channel between Cato's DOM layer (voice session,
 * approval card, tool canvas, journey buttons) and his WebGL body.
 * The DOM writes, the scene reads in useFrame.
 */
export type CatoActivity =
  | 'idle' // no session
  | 'listening'
  | 'speaking'
  | 'working' // a tool call is running
  | 'approval' // waiting for the visitor to approve a tool
  | 'success'
  | 'error';

export interface CatoVisemes {
  aa: number;
  O: number;
  E: number;
  SS: number;
}

export const catoBus = {
  activity: 'idle' as CatoActivity,
  /** 0..1 mouth opening from lip-sync; decays when not refreshed */
  mouth: 0,
  mouthAt: 0,
  /** Formant-derived viseme weights (0..1) from WebRTC AnalyserNode frequency bins */
  visemes: { aa: 0, O: 0, E: 0, SS: 0 } as CatoVisemes,
  /** performance.now() of the last activity change, for one-shot reactions */
  changedAt: 0,
  /** Timmy scene move matching the tool Cato is using (phone, text, email…); null = none */
  toolMove: null as string | null,
  /** a DJ-stop track is playing: tempo and the audio element for its clock */
  music: null as { bpm: number; audio: HTMLAudioElement } | null,
  /** journey stop id Cato is currently at (or moving to) */
  stop: journeyStops[0].id as string | null,
  /** current ledge index (0..8) Cato is standing on (or departed from during a fall) */
  stopIndex: 0,
  /** destination ledge index (0..8) set only by Next/Previous button or voice agent tool */
  targetStop: 0,
  /** true while Cato is mid-fall between ledges */
  falling: false,
};

const listeners = new Set<() => void>();

export function subscribeCato(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

/*
 * The Telnyx server runs operations through `execute` (Python calling
 * call_tool("OperationName", …)), so the operation name is read from the call's
 * parameters. Names are the confirmed operations from the system prompt.
 */
const TOOL_MOVES: [RegExp, string][] = [
  [/DialCall|SpeakCall/, 'phone'],
  [/SendMessage/, 'text'],
  [/CreateEmailMessage/, 'email'],
  [/SendFax/, 'fax'],
  [/CreateRoom/, 'video'],
];

export function toolMoveFor(toolName: string, parameters: unknown): string | null {
  if (toolName === 'generate_prefab_ui' || toolName === 'search_prefab_components') return 'desk';
  let text = toolName;
  try {
    text += JSON.stringify(parameters);
  } catch {
    /* unserialisable parameters: match on the tool name only */
  }
  for (const [re, move] of TOOL_MOVES) if (re.test(text)) return move;
  return null;
}

export function setToolMove(move: string | null) {
  catoBus.toolMove = move;
}

export function setActivity(a: CatoActivity) {
  if (catoBus.activity === a) return;
  catoBus.activity = a;
  catoBus.changedAt = performance.now();
}

export function setMouth(v: number, visemes?: Partial<CatoVisemes>) {
  const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
  catoBus.mouth = clamped;
  catoBus.mouthAt = performance.now();
  if (visemes) {
    catoBus.visemes.aa = visemes.aa ?? clamped;
    catoBus.visemes.O = visemes.O ?? 0;
    catoBus.visemes.E = visemes.E ?? 0;
    catoBus.visemes.SS = visemes.SS ?? 0;
  } else {
    catoBus.visemes.aa = clamped;
    catoBus.visemes.O = 0;
    catoBus.visemes.E = 0;
    catoBus.visemes.SS = 0;
  }
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Trigger Cato's jump/fall to `nextIndex` (0..8) and scroll the page to that
 * stop's copy in lockstep with his 6s fall. Called ONLY from the on-page
 * Next/Previous buttons or the voice agent's client tool — never from scroll.
 */
export function goToStop(nextIndex: number, fromIndex?: number): number {
  const N = journeyStops.length;
  const clamped = Math.max(0, Math.min(N - 1, Math.round(nextIndex)));
  if (fromIndex !== undefined && !catoBus.falling) {
    const fromClamped = Math.max(0, Math.min(N - 1, Math.round(fromIndex)));
    if (catoBus.stopIndex !== fromClamped) {
      catoBus.stopIndex = fromClamped;
    }
  }
  const moving = clamped !== catoBus.stopIndex;
  catoBus.targetStop = clamped;
  catoBus.stop = journeyStops[clamped].id;
  if (moving) catoBus.falling = true;
  notify();

  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  scrollToTarget(`#${journeyStops[clamped].id}`, {
    offset: 0,
    duration: reduced ? 0 : moving ? 5.2 : 1.4,
    easing: easeInOutCubic,
  });
  return clamped;
}

/** Called by AiAgentSystemsScene when a fall starts or finishes. */
export function setFallState(stopIndex: number, falling: boolean) {
  const nextId = journeyStops[stopIndex]?.id ?? catoBus.stop;
  if (catoBus.stopIndex === stopIndex && catoBus.falling === falling && catoBus.stop === nextId) return;
  catoBus.stopIndex = stopIndex;
  catoBus.falling = falling;
  catoBus.stop = nextId;
  notify();
}
