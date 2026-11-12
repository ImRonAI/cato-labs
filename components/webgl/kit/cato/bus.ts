import { journeyStops, type JourneyStory } from '@/lib/content/agentJourney';
import { JOURNEY_COPY_SECONDS, JOURNEY_HOLD_MS, JOURNEY_TRAVEL_SECONDS } from '@/lib/content/journeyLayout';
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
  story: 'enterprise' as JourneyStory,
  tourStarted: false,
  screenOpen: false,
  /** Arrival is recorded when the page's copy is visible, not on route mount. */
  arrivedAt: 0,
  queuedStop: null as number | null,
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

export function setStory(story: JourneyStory) {
  if (catoBus.story === story) return;
  catoBus.story = story;
  notify();
}

export function setScreenOpen(open: boolean) {
  if (catoBus.screenOpen === open) return;
  catoBus.screenOpen = open;
  notify();
}

let holdTimer: ReturnType<typeof setTimeout> | undefined;

function releaseQueue() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = undefined;
  if (catoBus.falling || catoBus.queuedStop === null) return;
  const remaining = catoBus.arrivedAt + JOURNEY_HOLD_MS - performance.now();
  if (catoBus.arrivedAt && remaining > 0) {
    holdTimer = setTimeout(releaseQueue, remaining);
    return;
  }
  const target = catoBus.queuedStop;
  catoBus.queuedStop = null;
  goToStop(target);
}

/** The page calls this after a stop's whole copy enters the viewport. */
export function markStopVisible(index: number) {
  if (catoBus.falling || index !== catoBus.stopIndex || catoBus.arrivedAt) return;
  catoBus.arrivedAt = performance.now() + JOURNEY_COPY_SECONDS * 1000;
  releaseQueue();
  notify();
}

export function resetJourney() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = undefined;
  catoBus.queuedStop = null;
  catoBus.tourStarted = false;
  catoBus.arrivedAt = 0;
  catoBus.stopIndex = 0;
  catoBus.targetStop = 0;
  catoBus.stop = journeyStops[0].id;
  catoBus.falling = false;
  catoBus.screenOpen = false;
  notify();
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
 * Queue or trigger Cato's travel to `nextIndex` (0..8), scrolling to that
 * stop's copy in lockstep with his travel. Called ONLY from the on-page
 * Next/Previous buttons or the voice agent's client tool — never from scroll.
 */
export function goToStop(nextIndex: number): number {
  const N = journeyStops.length;
  if (!Number.isFinite(nextIndex)) return catoBus.targetStop;
  const clamped = Math.max(0, Math.min(N - 1, Math.round(nextIndex)));
  catoBus.tourStarted = true;
  if (clamped === catoBus.targetStop) {
    catoBus.queuedStop = null;
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = undefined;
    notify();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) document.getElementById(journeyStops[clamped].id)?.scrollIntoView({ behavior: 'instant' });
    else scrollToTarget(`#${journeyStops[clamped].id}`, { offset: 0, duration: JOURNEY_TRAVEL_SECONDS });
    return clamped;
  }
  if (!catoBus.falling && !catoBus.arrivedAt && clamped !== catoBus.stopIndex) {
    catoBus.queuedStop = clamped;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) document.getElementById(journeyStops[catoBus.stopIndex].id)?.scrollIntoView({ behavior: 'instant' });
    else scrollToTarget(`#${journeyStops[catoBus.stopIndex].id}`, { offset: 0, duration: JOURNEY_TRAVEL_SECONDS });
    notify();
    return clamped;
  }
  if (catoBus.falling || (catoBus.arrivedAt && performance.now() < catoBus.arrivedAt + JOURNEY_HOLD_MS)) {
    catoBus.queuedStop = clamped;
    releaseQueue();
    notify();
    return clamped;
  }
  const moving = clamped !== catoBus.stopIndex;
  catoBus.targetStop = clamped;
  catoBus.stop = journeyStops[clamped].id;
  catoBus.queuedStop = null;
  catoBus.screenOpen = false;
  catoBus.arrivedAt = 0;
  if (moving) catoBus.falling = true;
  notify();

  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const destination = document.getElementById(journeyStops[clamped].id);
  const scrollPosition = destination ? window.scrollY + destination.getBoundingClientRect().top : undefined;
  if (reduced) {
    destination?.scrollIntoView({ behavior: 'instant' });
  } else scrollToTarget(scrollPosition ?? `#${journeyStops[clamped].id}`, {
    offset: 0,
    duration: JOURNEY_TRAVEL_SECONDS,
    easing: easeInOutCubic,
  });
  return clamped;
}

/** Called by AiAgentSystemsScene when travel starts or finishes. */
export function setFallState(stopIndex: number, falling: boolean) {
  const nextId = journeyStops[stopIndex]?.id ?? catoBus.stop;
  if (catoBus.stopIndex === stopIndex && catoBus.falling === falling && catoBus.stop === nextId) return;
  catoBus.stopIndex = stopIndex;
  catoBus.falling = falling;
  catoBus.stop = nextId;
  if (!falling) {
    catoBus.arrivedAt = 0;
    // The page records arrival once this stop's copy is actually on screen.
  }
  notify();
}
