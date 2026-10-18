# Canvas CDN and navigation implementation evidence

Owned product file: `components/vibe/canvas-runtime.ts`.

## Direct validation
- Scenario: TypeScript compile of actual project including changed runtime.
- Invocation: `npx tsc --noEmit`.
- Binary observable: exit code 0.
- Artifact: `.omo/evidence/cdn-canvas-typecheck.log` (contains invocation and exit code, even with empty compiler output).

## Implemented behavior, UI acceptance pending parent validation
- HTTPS classic scripts load sequentially before following inline config; import maps and module scripts retain their types. Module completion is awaited.
- Script load errors/timeouts, JavaScript errors, and rejected promises post `render-error` with message; no synthetic success UI.
- Relative link click posts `{channel,type:"navigate",href}`. Hash links scroll inside the iframe. HTTPS/mailto/tel links use native default navigation with target=_blank and rel=noopener noreferrer; other absolute schemes remain blocked.
- CSP retains default-src none, adds HTTPS scripts and connections plus blob workers for asset decoders. No same-origin sandbox change.
- Streaming DOM reconciliation and actual element-bound cursor retained. Application scripts execute only on final closed HTML. Parent keys iframe by build/page to dispose old RAF/WebGL state.

Actual UI acceptance is assigned to parent, which owns LiveCanvas host/navigation integration. This document does not claim UI scenarios passed. Required scenarios: real generated Tailwind CDN/config styling, real Three.js import-map/module canvas, local generated page navigation, and actual script failure surfaced by host.

## Documentation fetched this attempt
Context7 resolve-library-id then query-docs:
- `/tailwindlabs/tailwindcss.com` and `/websites/tailwindcss`: https://tailwindcss.com/docs/installation/play-cdn. v4 uses https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4 with style type=text/tailwindcss and @theme CSS variables; tailwind.config JavaScript belongs v3. Official CDN described as development preview tooling.
- `/mrdoob/three.js`: official manual installation and docs/llms.txt; importmap mappings for three and three/addons must share a version, followed by type=module imports. Example version returned by current docs: 0.186.0.

No active currentAttemptDir: omo-agent-toolkit ulw-loop status --json returned ULW_LOOP_PLAN_MISSING; fallback evidence path used.

## Followup: external links and page fragments
- Product edit remains confined to canvas-runtime.ts.
- HTTPS/mailto/tel anchor clicks set target=_blank and rel=noopener noreferrer without preventing default; host owns popup sandbox flags.
- Optional render.fragment string restores a decoded element ID after final DOM paint and again after script completion/load plus one animation frame. Fragment-only updates also scroll.
- Initial typecheck artifact predates this followup. Parent explicitly owns renewed TypeScript and actual UI verification; no followup acceptance claimed here.
