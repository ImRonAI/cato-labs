# Public chat transport implementation

Implemented the boundary fix requested by chat-stream-boundary-code-review.md. This changes server response presentation and route-purpose checks only; native agent execution, tools, skills, exact models, token/step budgets, background/store/stream settings and previous_response_id remain intact.

## Exact changes

- `lib/native-response-access.ts`: retrieves the authoritative native response with the server key; requires both the expected fixed model and matching response ID. Missing/mismatched model, missing response or failed lookup returns a safe failure. Continuation additionally requires completed status. The helper does not forward provider lookup error payloads.
- `app/api/vibe-build/route.ts`: applies the Opus check before GET snapshots/reconnect streams, DELETE cancellation and POST previous_response_id. Verified snapshots retain all native fields; builder trace streams remain unmodified.
- `app/api/vibe-files/route.ts`: applies the Opus check before either listing files or fetching file bytes.
- `app/api/vibe-chat/route.ts`: replaces the builder GET/DELETE re-exports with Haiku-checked chat-specific operations. Applies the same Haiku check before continuation and public projection to POST, GET (including reconnect), and DELETE responses.
- `lib/public-chat-response.ts`: retains native response.output_text.delta type, delta, sequence_number, item_id, output_index and content_index; retains lifecycle names, sequence_number and an explicit response field allowlist (id, object, model, status, created_at, safe error). All raw output arrays, tool arguments/results, connector catalogs, reasoning and configuration are omitted. Snapshots omit output because the existing recovery code only needs ID/status/error; terminal events omit output to avoid duplicate text. Error payloads use fixed public messages rather than raw provider/tool strings. Original delta order and native sequence values remain unchanged, with gaps for omitted private events. SSE parsing handles CRLF, multi-line data and split UTF-8 chunks; safe keepalive comments and [DONE] framing are retained.
- `app/api/vibe-build/config.ts`: only widget transport contract wording changed, documenting the filtered native text/lifecycle contract and omitted private fields.

## Grounding

Read the native create-agent OpenAPI captured in `/tmp/cato-trace-agent-post.md`, including ResponsesResponse, ErrorInfo, ResponseStreamEvent, TextDeltaEvent, and lifecycle response schemas. Read the existing review and actual LiveCanvas consumer. Queried Context7 `/llmstxt/perplexity_ai_llms_txt` for current GET response model/status, native continuation/reconnect and text-delta semantics. Sources returned https://docs.perplexity.ai/api-reference/agent-get and https://docs.perplexity.ai/docs/agent-api/output-control.

## Verification

`npx tsc --noEmit` completed with exit code 0. Output: `.omo/evidence/chat-public-transport-tsc.log` (empty on success).

No fake events, mocks, placeholder provider calls or unit fixtures were introduced. This worker did not use the shared browser, restart the production server, create a real agent run or make a telephone call. Root is responsible for the required real UI/network acceptance and the subsequent production build.

The exact-model check partitions the two fixed routes; it is not visitor authentication or general account authorization. Public assistant text remains public assistant text; the projection prevents disclosure of raw connector payloads, not every possible model-generated statement.

## Source hashes

Recorded 2026-10-16T12:08:39.729101+00:00

- `app/api/vibe-chat/route.ts`: `a130632bb80631d50aefedd8475ddb884a7420023628f870e3cda8be3e3b33f0`
- `app/api/vibe-build/route.ts`: `d80fd71db3ac11a4ba76ca8ace5eccf1ba718d83313ce9c7a9a55edd57c385cf`
- `app/api/vibe-files/route.ts`: `dae7acf763a65cad1d5b47f0f9b4511b2d5f35a71255e9b128fbc0a2055297a3`
- `app/api/vibe-build/config.ts`: `90d942202a44ee36d0ba29ef4d4c1c2009ba58d4edd8e903c52e819946b43545`
- `lib/native-response-access.ts`: `e8c49b77602b13bf6f3d6e2a3ce8927eb999b5fcdb279ffc627ce76868b7c9b6`
- `lib/public-chat-response.ts`: `1d06364a78bf413d448ad0d9d06ac7bb8e17568494a53b4f47d7f55ef5c0f981`
