'use client';

import React, { useSyncExternalStore } from 'react';
import { catoBus, goToStop, subscribeCato } from '@/components/webgl/kit/cato/bus';
import { journeyCopy, journeyStops } from '@/lib/content/agentJourney';

/**
 * JourneyNav: on-page "Next stop" / "Previous stop" buttons for each stop.
 * Clicking queues the destination during the reading hold, then scrolls
 * the page to the target stop's copy with him.
 */
const snap = () => `${catoBus.stopIndex}:${catoBus.targetStop}:${catoBus.falling ? 1 : 0}:${catoBus.queuedStop}`;
const serverSnap = () => '0:0:0:null';

export default function JourneyNav({ index }: { index: number }) {
  useSyncExternalStore(subscribeCato, snap, serverSnap);
  const falling = catoBus.falling;
  const target = catoBus.targetStop;
  const prev = index > 0 ? journeyStops[index - 1] : null;
  const next = index < journeyStops.length - 1 ? journeyStops[index + 1] : null;

  return (
    <div className="aas-stop-nav">
      {next && (
        <button
          type="button"
          className="cato-btn"
          disabled={falling}
          onClick={() => goToStop(index + 1)}
        >
          {falling && target === index + 1
             ? journeyCopy.travelling
             : `${journeyCopy.next}: ${next.eyebrow}`}
        </button>
      )}
      {prev && (
        <button
          type="button"
          className="cato-btn cato-btn--ghost"
          disabled={falling}
          onClick={() => goToStop(index - 1)}
        >
          {journeyCopy.previous}
        </button>
      )}
      {catoBus.queuedStop !== null && catoBus.stopIndex === index && <p className="aas-queue" role="status">{journeyCopy.queued}</p>}
    </div>
  );
}
