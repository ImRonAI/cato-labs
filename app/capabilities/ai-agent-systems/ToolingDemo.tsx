'use client';

import React, { useCallback, useState } from 'react';
import PrefabView, { callPrefabTool, type PrefabRun } from '@/components/mcp-app/PrefabView';
import { setToolMove } from '@/components/webgl/kit/cato/bus';

/**
 * ToolingDemo: on the tooling stop, without a voice session, the visitor asks
 * Cato to build a small tool. The page calls generate_prefab_ui on the Telnyx
 * MCP server with a Prefab program (the tool's own documented slider pattern)
 * and renders the result as an MCP App. Cato sits at his desk while it builds.
 */
const SAMPLE = `from prefab_ui.components import Column, Heading, Slider, Text
from prefab_ui.app import PrefabApp

with PrefabApp(state={"tip": 18}) as app:
    with Column(gap=4):
        Heading("Tip calculator")
        slider = Slider(value=18, min=0, max=40, name="tip")
        Text(f"Tip: {slider.rx}%")
`;

export default function ToolingDemo() {
  const [run, setRun] = useState<PrefabRun | null>(null);
  const [busy, setBusy] = useState(false);

  const build = () => {
    const input = { code: SAMPLE };
    setBusy(true);
    setToolMove('desk');
    setRun({ input, result: callPrefabTool('generate_prefab_ui', input) });
  };
  const done = useCallback(() => {
    setBusy(false);
    setToolMove(null);
  }, []);

  return (
    <div className="aas-tooling">
      <button type="button" className="cato-btn" onClick={build} disabled={busy}>
        {busy ? 'Cato is building…' : run ? 'Build it again' : 'Ask Cato to build a tool'}
      </button>
      {run && <PrefabView run={run} onDone={done} />}
    </div>
  );
}
