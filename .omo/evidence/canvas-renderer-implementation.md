# Progressive canvas implementation

Scope: components/vibe/LiveCanvas.tsx, components/vibe/canvas-runtime.ts, components/vibe/live-canvas.css.

Validation performed: targeted TypeScript compilation, after final changes.

Invocation:

```sh
./node_modules/.bin/tsc --noEmit --skipLibCheck --strict --target ES2020 --module esnext --moduleResolution bundler --jsx react-jsx --lib dom,dom.iterable,esnext components/vibe/LiveCanvas.tsx components/vibe/canvas-runtime.ts
```

Observed result: exit code 0, empty stdout/stderr. Tool chunk 3a7e8b.

Implementation: stable srcDoc bootstrap receives cumulative HTML using per-instance channel messages; verifies parent source. DOMParser parses incomplete HTML inertly, removes scripts before reconciliation, and updates matching DOM nodes in place. New markup is painted at animation-frame cadence. Actual changed div/section ancestor bounds drive the drawing outline and named cursor, with resize/scroll handling and reduced-motion support. Closed shadow DOM isolates drawing controls from generated CSS. Parent validates iframe source and channel before accepting metrics. Inline scripts execute once after streaming ends and the document has a closing html tag. External scripts are blocked.

Security configuration: iframe sandbox allow-scripts without allow-same-origin; CSP disallows connections, objects, frames, base URLs and form actions. HTTPS styles/images/fonts/media are allowed. Non-anchor navigation clicks are prevented. No partial scripts execute.

Integration requirement: use a response/run identifier as the React key when starting a new generation, so previously completed generated script timers cannot survive into the next run.

Not validated here: browser rendering, real provider streaming, interaction of generated final scripts, mobile viewport behavior. Parent owns real UI/provider verification. Compilation is not evidence that those scenarios passed.

## Idempotency repair

Read-only source inspection identified two initial render send paths in LiveCanvas (props effect and ready reply). Previously every message reconciled the body even when HTML and streaming state were unchanged. A repeated final render therefore restored text changed by a user's interaction to its original generated value. Already-installed event listeners could remain, explaining why removing executable script elements was not sufficient to explain lost state.

Repair in canvas-runtime.ts: update the cursor label first, then skip DOM reconciliation when HTML and streaming state equal the last painted values. Redrawing the outline remains allowed. Agent metadata messages continue to replace current message state; name-only changes update the label. Root's HTML attribute synchronization and scrolling changes were preserved. No speculative script-readiness changes were made.

Targeted TypeScript invocation above rerun after the repair: exit code 0, empty stdout/stderr, tool chunk 3e1af7. Root owns rebuilding and the real UI click/reload verification; that scenario has not been independently validated by this worker.
