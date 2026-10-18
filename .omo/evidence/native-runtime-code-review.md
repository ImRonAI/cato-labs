# Native runtime code review

codeQualityStatus: BLOCK
recommendation: REQUEST_CHANGES

Scope: current source for LiveCanvas.tsx, canvas-runtime.ts, vibe-chat/route.ts, vibe-build/config.ts, and VibeCoder.tsx navigation/state. Read-only review; only report artifacts written. No UI verification or outbound call was performed.

## Evidence and limits

The workspace has no .git directory, so a complete baseline diff could not be obtained. Inspected the available `.omo/evidence/widget-chat-native-route.diff` against current source; inspected `.omo/evidence/widget-chat-native-request.md` and `.omo/evidence/multipage-provider-response.json`. The latter was in_progress, not completed, at inspection and cannot prove successful multipage delivery. The request report explicitly states UI acceptance is pending. No notepad path was supplied or discovered. `omo-agent-toolkit ulw-loop status --json` returned ULW_LOOP_PLAN_MISSING for the current session, so this uses the fallback evidence directory. Concurrent UI work may move line numbers.

## CRITICAL

None established.

## HIGH

1. **Page navigation abandons an active native background chat and allows a second concurrent turn.** `app/capabilities/digital-products/VibeCoder.tsx:405` keys LiveCanvas by page filename. Navigation changes that filename at line 250 and unmounts the bridge. `components/vibe/LiveCanvas.tsx:116-119` aborts its fetch and discards the pending request map; the only durable chat state is a completed ID committed at lines 68-70. No response.created ID or sequence is retained, and no native cancellation/reconnect is attempted. The upstream request explicitly runs in background mode. Thus navigating while a reply/tool operation is running leaves that operation running while the next page starts a new turn against the old completed ID. The pending reply and tool result cannot be recovered by this client, violating the one-turn and cross-page conversation contract. For a consented call, retrying on the new page can submit a second call without the first result in conversation history. Keep the chat transport/pending native response at website scope across iframe remounts (and recover interrupted native streams), or prevent page transitions until the turn is terminal. Do not substitute the pending ID as previous_response_id.

## MEDIUM

1. **Ordinary external navigation is silently disabled.** `components/vibe/canvas-runtime.ts:181-184` prevents default for every non-fragment link, but only forwards relative URLs. HTTPS, mailto and tel links therefore do nothing, including normal generated contact/reference links. Support appropriate external navigation via a host-side action or provide an explicit unavailable outcome. This is an actual control failure, not a proposed security policy expansion.

2. **Cross-page fragment destinations are lost.** `app/capabilities/digital-products/VibeCoder.tsx:239-250` resolves the destination but retains only pathname/filename and HTML. A link such as `services.html#pricing` loads the page at its start, and clicking `index.html#section` on the already selected index page may not rerender at all. The local `#section` handler at `canvas-runtime.ts:174-179` cannot recover the discarded hash. Preserve and apply the destination fragment after rendering. Query state is likewise discarded; support it if generated controls rely on it.

## LOW

1. Programming perspective: `canvas-runtime.ts:26-28` uses non-null assertions; `vibe-chat/route.ts:76` uses a record assertion at the request boundary. These violate the strict skill perspective but are not independently demonstrated runtime failures. The parsed fixed shadow template makes the former predictable, and manual request guards follow the latter. Avoid broad unrelated refactors during this fix.

## Contract checks and skill pass

Loaded and consulted omo:programming, its TypeScript reference, and omo:remove-ai-slops. The overfit/slop pass ran over the supplied production scope and available diff. No new tests were supplied in that diff; no deletion-only, prose-pinning, tautological, constant-mirroring, or mock tests were added or run by this review. No needless production extraction/normalization was established: stream framing, document reconciliation and request-boundary guards serve actual contracts. Programming exceptions are listed under LOW. No independent remove-ai-slops violation warrants blocking beyond the lifecycle correctness issue.

Shared BUILD_CONFIG has the requested Opus configuration, 128000 output tokens, 100 steps, background/stream/store true, six hosted tools and shared skills. Chat spreads it and overrides only the model plus its MCP tools/instructions/input. Telnyx authorization is read from server environment; no literal secret was found in reviewed source. Native SSE passes through unchanged, and completed response IDs are committed only on response.completed. Widget requirements are in both system and user build prompts; no widget markup is injected by the platform. Script execution preserves source order and waits for external/module scripts, so the v3 Tailwind config-after-CDN sequence and import-map-before-module sequence are supported by static inspection. These statements do not establish real provider, CDN, Three.js, or UI acceptance.

## Blockers

- Fix website-scoped pending chat lifetime/recovery across page navigation, then exercise an actual in-flight chat navigation in the real UI.
- Real UI/provider acceptance remains outstanding and must not be represented as passed by this code review.

## Fresh static verification

`./node_modules/.bin/tsc --noEmit --incremental false` completed with exit code 0 and no diagnostics during this review. This verifies TypeScript compilation only, not the lifecycle or navigation outcomes above. No lint/security scanner was run; no synthetic or mock tests were used. Actual Playwright/provider verification is owned by the parent executor.
