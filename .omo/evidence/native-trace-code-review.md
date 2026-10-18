# Native trace code review

codeQualityStatus: WATCH
recommendation: APPROVE (code review only; provider acceptance remains partial)

Scope: lib/native-agent-trace.ts, components/vibe/NativeAgentTrace.tsx, app/capabilities/digital-products/VibeCoder.tsx, app/api/vibe-build/config.ts, app/api/vibe-build/route.ts. Read-only source review; no production edits or invented tests. No Git repository is present, so an exact historical diff was unavailable. Reports native-trace-events.md and native-trace-ui.md, actual installed SDK schema and native-trace-build.log were inspected. Root owns the active real-provider Playwright run; this report does not claim that acceptance passed. ulw-loop status returned ULW_LOOP_PLAN_MISSING; artifact uses fallback location.

## CRITICAL
None found.

## HIGH — resolved on re-review
1. Distinct provider thought notifications overwrite one another. lib/native-agent-trace.ts:68-70 uses call-derived identity plus :thought for every thought. Both image query and image result notifications have the same call_id and optional thought in the actual SDK schema (node_modules/@perplexity-ai/perplexity_ai/dist/generated/api.d.ts:789-819). put at lines 50-64 replaces the earlier thought when the later notification contains a different thought. This contradicts preserving all provider-exposed reasoning. Preserve independent notification identity (sequence number) separately from appendable reasoning channels. This is a schema-grounded correctness finding; no synthetic provider run was used to claim occurrence in the active run.

## MEDIUM — resolved on re-review
2. Queries can remain Running after the response has completed. lib/native-agent-trace.ts:174-176 assigns done=false to query notifications; web and fetch query schemas contain no stable call/item/output ID. hydrateNativeTrace at 132-139 only updates outputs from the snapshot, leaving these sequence-key entries untouched. components/vibe/NativeAgentTrace.tsx:25-27 labels them Running indefinitely. Represent them as query-submission notifications or finalize pending activity with truthful terminal state, without inventing result pairing or success.
3. A transient legacy hydration failure permanently disables retry. VibeCoder.tsx:135 initializes missing legacy trace to []; lines 148-150 publish failures, writing this array to session storage. On reload line 137 only fetches !build.trace, excluding the now-persisted empty array. Completed legacy cards cannot reconnect. Preserve a migration-needed marker until success or provide retry hydration.

## LOW
4. VibeCoder.tsx remains a 392-line multi-responsibility module containing transport, persistence, lifecycle and rendering. The programming/remove-ai-slops size perspective flags this existing structure. Historical diff unavailable; do not infer it was introduced by this focused trace change. A separate bounded extraction can improve maintainability, but it is not an acceptance blocker for this request.

## Skill-perspective check
Ran: explicitly loaded and consulted remove-ai-slops and programming SKILL.md. Boundary normalization of unknown provider events is necessary for the requested UI integration, not needless data extraction. No newly authored tests were supplied in scope; no deletion-only, tautological, constant-mirroring or brittle prompt tests were found. Compilation evidence is relevant but insufficient for provider mapping acceptance. The oversized lifecycle component violates the size perspective; the other material issues are correctness findings above. No unnecessary harness or preset was found.

## Positive observations and acceptance limits
Official Agent > Task > ChainOfThought composition is directly present. Search, image, Sandbox and Tool components are imported from actual installed AI Elements components. Both system and user prompt require all six configured hosted tools. High reasoning effort is in installed native schema. Full text strings are not deliberately capped, and encrypted content is not exposed as reasoning. No claim is made that prompts guarantee tool invocation. Real native tool counts, full reasoning fidelity, restore and UI interactions must be recorded by root before final approval.

Current code blockers: none. Historical findings above are retained for traceability and resolved as documented below. End-to-end acceptance remains partial; do not claim all six native tool mappings were exercised.

## Re-review of corrections
- Distinct thought notifications now use sequence-qualified identity (native-agent-trace.ts:87-92). True reasoning delta channels retain their append semantics. Original HIGH closed.
- Unidentifiable query notifications are submitted, and unresolved entries become ended/interrupted at terminal response (98-100,172-174). Native UI neutral labels omit success/running badges for these notifications. Original MEDIUM closed.
- VibeCoder traceHydrated and traceVersion markers remain false after failed legacy fetch and become true/version2 only after successful snapshot (137-151,174-178). Reload retries failures. Original MEDIUM closed.
- Snapshot output indexes are isolated from stream indexes, avoiding real provider GET snapshots that omit interim messages. Same-call sandbox entries consolidate.

Inspected actual artifacts: native-trace-live-response.json and native-trace-browser-state.json. Response resp_e266a4c5-92be-4ab9-a8ef-f295280407ca is completed and contains nine sandbox_results, four skill_loaded, two sandbox_write_file, two function_call, one finance_results, one share_file, one message. It does not establish native web, people, image or fetch output acceptance. Provider messages describe the unavailable direct tools; shell SDK research is not reclassified as a native tool result.

Read-only replay of actual saved browser trace through current hydrateNativeTrace with the actual GET payload used Node experimental-strip-types (no fabricated inputs, no mocks): before34 entries; after25; repeated hydration25; sandbox18 to9; pending0; all existing reasoning text retained. This is supplemental actual-data verification, not a replacement for root Playwright UI checks.

LOW residual: the old captured browser state already contains two identical finance output records under output:7 and output:5. Migration hydration keeps both because exact-payload matching updates one. Current snapshot namespace avoids introducing this old index mismatch in fresh runs. A third finance stream notification remains separately identifiable and intentionally cannot be guessed into a native call. No HIGH or CRITICAL remains in reviewed code.
