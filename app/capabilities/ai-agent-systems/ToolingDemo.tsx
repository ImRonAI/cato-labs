'use client';

import React, { useCallback, useState, useSyncExternalStore } from 'react';
import PrefabView, { callPrefabTool, type PrefabRun } from '@/components/mcp-app/PrefabView';
import { catoBus, setToolMove, subscribeCato } from '@/components/webgl/kit/cato/bus';
import { journeyCopy, storyPrefabs } from '@/lib/content/agentJourney';

/**
 * The finale calls the existing tool and renders PrefabView unchanged.
 * Voice-generated tools occupy the adjacent portal slot in the same screen.
 */
const snapshot = () => `${catoBus.story}:${catoBus.screenOpen}`;
const serverSnapshot = () => 'enterprise:false';

export default function ToolingDemo() {
  useSyncExternalStore(subscribeCato, snapshot, serverSnapshot);
  const [built, setBuilt] = useState<{ story: typeof catoBus.story; run: PrefabRun } | null>(null);
  const run = built?.story === catoBus.story ? built.run : null;
  const [busy, setBusy] = useState(false);
  const building = busy && built?.story === catoBus.story;

  const build = () => {
    const input = { code: storyPrefabs[catoBus.story] };
    setBusy(true);
    setToolMove('desk');
    setBuilt({ story: catoBus.story, run: { input, result: callPrefabTool('generate_prefab_ui', input) } });
  };
  const done = useCallback(() => {
    setBusy(false);
    setToolMove(null);
  }, []);

  return (
    <div className="aas-finale-screen" data-open={catoBus.screenOpen} aria-label={journeyCopy.finale}>
      <div className="aas-screen-content">
        <p className="aas-story-label">{journeyCopy.illustrative}</p>
        <div id="aas-finale-voice-slot" />
        <button type="button" className="cato-btn" onClick={build} disabled={building}>
          {building ? journeyCopy.building : run ? journeyCopy.rebuild : journeyCopy.build}
        </button>
        {run && <PrefabView run={run} onDone={done} />}
      </div>
    </div>
  );
}
