# Current rereview: public chat projection and native model guard

codeQualityStatus: WATCH
recommendation: APPROVE
blockers: []

This verdict supersedes the original findings below. Approval is limited to source correctness for the assigned privacy/native-compatibility boundary; actual production build and browser/provider acceptance remain pending with the root agent.

## Findings by severity

- CRITICAL: none.
- HIGH: none remaining in this bounded review.
- MEDIUM: none established.
- LOW: none established.

## Verified correction

- `lib/public-chat-response.ts:25` creates an explicit response field allowlist. It does not spread native response objects or forward output/tool/configuration fields. Provider error payloads become bounded, safe public messages.
- `lib/public-chat-response.ts:42` accepts only text deltas and known lifecycle/error event types. Text/ordering identity fields are retained; all raw tool items and reasoning events are omitted. This applies to POST and chat reconnect/cancel through forwardPublicChat; chat snapshot GET separately uses publicChatSnapshot.
- SSE projection at `lib/public-chat-response.ts:75` uses streaming UTF-8 decode, buffers split records, handles LF and CRLF frame separators, combines data lines, flushes remaining bytes, retains a safe heartbeat and DONE sentinel, and preserves native type/sequence_number. Malformed data errors the stream instead of falling back to raw passthrough. No native custom agent loop was introduced.
- `lib/native-response-access.ts:22` verifies authoritative returned ID and exact model, failing closed on absent/mismatched values or retrieval failure. Both POST continuation paths additionally require completed status.
- All ID entry points are covered: build POST/GET/DELETE, chat POST/GET/DELETE, and file listing/content GET. Build native full traces remain available for the exact builder model. Chat routes no longer re-export the raw builder handlers.
- `app/api/vibe-build/config.ts:38` now describes filtered native events accurately. Existing LiveCanvas still receives the response IDs/statuses required for pending recovery and completed previous_response_id continuity.

## Evidence and scope

Re-read the current six source files plus the config contract and LiveCanvas consumer. Inspected `.omo/evidence/chat-public-transport-tsc.log`; the artifact is empty, so it independently establishes no diagnostics but not an exit status. The worker reports successful tsc; this reviewer did not rerun it or claim a production/browser pass. No mocks, private-record extractions or outbound calls were performed.

The two-model partition is sufficient for the demonstrated current cross-route bypass, but does not authenticate individual visitors or distinguish arbitrary historical same-model account responses. That limitation is unchanged from the accepted bounded design. Public assistant text remains model-authored text; this review validates removal of raw tool-result transport, not a semantic guarantee about every model-generated sentence.

## Skill perspectives

remove-ai-slops and programming perspectives were consulted again against this correction. Boundary parsing/projection has a concrete privacy purpose; the shared verifier serves multiple real route boundaries, not speculative abstraction. No brittle prompt assertions, implementation-constant tests, deletion-only tests, or synthetic provider successes were added. No actionable slop/overfit violation was established for this focused change. Real browser checks of streamed text, continuation, recovery and blocked cross-route IDs remain required before the parent claims runtime acceptance.

---

# Historical first review (resolved by current correction)

# Public widget native stream boundary review

codeQualityStatus: BLOCK
recommendation: REQUEST_CHANGES

Scope: app/api/vibe-chat/route.ts, components/vibe/LiveCanvas.tsx, and the shared app/api/vibe-build/route.ts retrieval path. No implementation edits. The current files, not earlier reports, were inspected. ULW status reported ULW_LOOP_PLAN_MISSING, so this is the fallback evidence location.

## CRITICAL
None established.

## HIGH

1. Raw account discovery results cross the public widget boundary. `app/api/vibe-chat/route.ts:64` returns upstream.body unchanged, and `components/vibe/LiveCanvas.tsx:98` posts every parsed event into the generated iframe. The configured workflow explicitly discovers existing phone numbers, applications and complete assistant configurations (`app/api/vibe-chat/route.ts:48`). Native MCP results are not just model prose: `/tmp/cato-trace-agent-post.md:1478` onward defines mcp_call.arguments and mcp_call.output, and output_item.done.item uses the OutputItem union. The official MCP documentation `/tmp/cato-trace-mcp.md`, Response shape, likewise explicitly states that output contains mcp_call with raw output text. ResponseCompletedEvent.response references ResponsesResponse, whose output contains those same items. A prompt asking the assistant not to disclose internal IDs cannot remove these transport fields. Any account information returned by discovery therefore goes to the browser and generated scripts whether or not the assistant quotes it. This is a verified dataflow/schema defect; no live private-record extraction was performed in this review.

2. Fixing only POST or postMessage leaves a direct retrieval bypass. `app/api/vibe-chat/route.ts:4` re-exports the builder GET/DELETE, and `app/api/vibe-build/route.ts:88` forwards the provider snapshot/stream for any syntactically valid response ID using the same account key. The public widget receives its chat response ID for continuation. It can retrieve the raw response through either route. Builder continuation similarly accepts a chat previous_response_id without checking response purpose, permitting chat conversation state to enter a fully exposed builder run. Apply response-purpose authorization to retrieval, cancellation and continuation, not just a frontend filter.

## MEDIUM
None separately established within this narrowly assigned boundary review.

## LOW
None.

## Smallest native-compatible correction

Keep the provider request and native agent execution exactly as configured. Add a server-side public-chat transport projection; this is response presentation, not an agent harness. Allow native text delta events with their documented text/ordering fields. Preserve native response lifecycle names, sequence numbers, response.id and response.status, and safe user-facing error codes/messages. For every lifecycle response object, explicitly select fields instead of spreading the full object; omit output, tools, instructions, reasoning and connector payloads. Drop output_item events, reasoning events, MCP arguments/results, catalog and other tool events from the public chat transport. Apply the same projection to non-stream snapshots and cancellation responses. Maintain completed IDs and pending IDs so LiveCanvas recovery and previous_response_id continue working. Builder full traces remain unchanged for authorized builder responses.

Close the alternate builder retrieval/continuation path with a server-verified purpose binding for response IDs (for example, a server-issued signed capability distinguishing build from chat, checked on GET/DELETE and previous_response_id). A raw response ID's syntax or its presence in browser storage is not a purpose check. Do not rely on an in-memory denylist or client-side filtering.

## Skill-perspective check

Consulted remove-ai-slops and programming SKILL.md. Boundary projection is warranted by an actual output trust boundary; it is not speculative normalization. No prompt-string tests, constant-mirroring tests, or deletion-only tests were proposed or accepted. Existing evidence was not treated as proof that private MCP results stay server-side. The current unprojected transport violates the boundary-purity perspective. Validation should use an actual native MCP run and browser network capture, confirming raw tool result data is absent from POST, GET/reconnect and alternate builder access while text, terminal state and a real follow-up remain functional. No mocks or outbound call are required to exercise that behavior.

blockers: server-side public-chat projection and closure of raw alternate retrieval/continuation paths.

## Follow-up: simpler native model binding accepted

The root proposed retrieving the authoritative provider response and checking response.model against the exact fixed route model before ID-based operations. This is sufficient for the demonstrated cross-route bypass under the current two-route invariant: build always creates anthropic/claude-opus-5-5; chat always creates anthropic/claude-haiku-5-5; neither allows browser model override. No active app/api import of the legacy lib/pplx.ts helper was found. A signed capability is therefore an example, not a requirement for this bounded correction.

Apply a fail-closed exact native model check to both routes' GET (including stream reconnect), DELETE, both POST previous_response_id inputs, and app/api/vibe-files/route.ts GET (listing and content). Chat retrieval/cancel must still project its payload. Reject absent model, mismatch, unresolved response and upstream lookup failure without forwarding raw provider content. Continuation should additionally require completed status as already required by the native API. No current two-route bypass was found when all these entry points enforce the model partition.

This provides route-purpose partitioning, not per-visitor ownership. Historical or independently created same-model responses in the same provider account are outside that invariant; no evidence of an active alternative same-model creator was found in the inspected API routes. Do not claim the model check authenticates a visitor or authorizes an account generally.
