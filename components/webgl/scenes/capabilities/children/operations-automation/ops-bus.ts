import type { ProcessId } from '@/lib/content/overhaul/cap-ops';

/**
 * opsBus — mutable module-level bridge between the DOM Automation Studio
 * and OperationsAutomationScene. DOM components write; WebGL useFrame reads
 * transiently with zero React re-renders.
 */
export const opsBus = {
  processId: 'lead-intake' as ProcessId,
  /** 0..4 corresponding to the 5 physical glass stations on the sorting machine (-1 = all idle/ambient) */
  activeStation: 0 as number,
  /** true while a Studio payload run is actively stepping through the graph */
  isRunning: false,
  /** 0..1 normalized position of the Studio's active token along the 3D machine */
  runProgress: 1,
  /** true when the classifier/diverter routes the payload onto the Human Escalation Spur */
  escalated: false,
  /** station enabled flags [trigger, extract, classify, route, update+notify] */
  stationEnabled: [true, true, true, true, true] as [boolean, boolean, boolean, boolean, boolean],
  /** performance.now() of the last station change or run start */
  pulseAt: 0,
  /** count of completed runs in the session */
  completedRuns: 2,
};

const listeners = new Set<() => void>();

export function subscribeOpsBus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function setOpsProcess(processId: ProcessId) {
  opsBus.processId = processId;
  opsBus.pulseAt = typeof performance !== 'undefined' ? performance.now() : 0;
  notify();
}

export function setOpsStation(stationIndex: number) {
  opsBus.activeStation = stationIndex;
  opsBus.pulseAt = typeof performance !== 'undefined' ? performance.now() : 0;
  notify();
}

export function setOpsRunState(patch: {
  isRunning?: boolean;
  runProgress?: number;
  activeStation?: number;
  escalated?: boolean;
  completedRuns?: number;
}) {
  if (patch.isRunning !== undefined) opsBus.isRunning = patch.isRunning;
  if (patch.runProgress !== undefined) opsBus.runProgress = patch.runProgress;
  if (patch.activeStation !== undefined) opsBus.activeStation = patch.activeStation;
  if (patch.escalated !== undefined) opsBus.escalated = patch.escalated;
  if (patch.completedRuns !== undefined) opsBus.completedRuns = patch.completedRuns;
  opsBus.pulseAt = typeof performance !== 'undefined' ? performance.now() : 0;
  notify();
}

export function setOpsStationEnabled(
  flags: [boolean, boolean, boolean, boolean, boolean],
) {
  opsBus.stationEnabled = flags;
  opsBus.pulseAt = typeof performance !== 'undefined' ? performance.now() : 0;
  notify();
}
