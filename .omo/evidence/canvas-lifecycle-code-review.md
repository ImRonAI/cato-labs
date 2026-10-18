# Canvas lifecycle correction review

codeQualityStatus: WATCH
recommendation: APPROVE
blockers: []

Scope: current components/vibe/canvas-runtime.ts and components/vibe/LiveCanvas.tsx, specifically inline-module completion, iframe load replay and allow-forms. Read-only source review; no implementation changes, private account reads or outbound calls. Root owns the production UI acceptance.

## CRITICAL
None established.

## HIGH
None established.

## MEDIUM
None established in the bounded changes.

## LOW
None established.

## Lifecycle findings

`canvas-runtime.ts:73-88` now waits on an event appended to the actual inline module source. The event is unique to channel, script generation and script index; its listener is registered before the script is inserted. A newline and semicolon separate the signal from the original source. Top-level await executes before the signal, and module/import failures cannot falsely signal success. The success/error/timeout paths clear both timer and event listener. External scripts continue to use load/error rather than the inline mechanism. Import-map/source URL resolution and CSP are unchanged.

Duplicate render replays do not cause duplicate script execution: paint returns early for identical HTML/streaming values, and sets executed before starting the asynchronous script sequence (`canvas-runtime.ts:209-214,254-258`). Multiple incoming messages before the frame are coalesced. Generation checks before each script and final lifecycle dispatch prevent stale sequences from advancing after a document reset. The new completion signal does not change the existing reset behavior or introduce an additional execution path.

`LiveCanvas.tsx:154-157` resends the latest render payload on the iframe element load event without changing srcDoc or remounting the iframe. The existing ready and prop-change paths remain intact. Their duplicate messages pass through the same idempotent paint gate. The runtime's synthetic window load is not a new iframe navigation; even a redundant parent replay is harmless under the same gate.

`LiveCanvas.tsx:153` enables generated form event handlers with allow-forms while the bootstrap CSP retains form-action 'none' (`canvas-runtime.ts:2`). Thus JavaScript submit handlers can run and preventDefault, but native form navigation/submission remains blocked. The iframe still has an opaque origin because allow-same-origin is absent.

## Evidence and limits

Inspected `.omo/evidence/canvas-module-completion-fix.md`, `.omo/evidence/canvas-reload-handshake-fix.md`, the prior real browser lifecycle log, both current source files, and the two referenced tsc logs. The tsc logs are empty; worker reports exit 0, but this reviewer does not independently infer success from empty files. The prior lifecycle log shows actual HTML paint and an existing timeout message; it is not proof of current-code acceptance. Repeated real reloads, Three.js execution, no delayed inline-module timeout, and generated form/chat submission must still pass the root's browser validation.

## Skill perspectives

remove-ai-slops and programming criteria were consulted. No prompt-string tests, deletion-only tests, constant-mirroring assertions, fake provider events, or speculative production parsing were introduced. The completion signal addresses a concrete browser lifecycle mismatch and the replay addresses a reported real initialization race. No actionable overfit/slop defect was established in these bounded changes. This approval does not certify all unrelated renderer behavior or production runtime acceptance.
