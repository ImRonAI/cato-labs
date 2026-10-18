# Cato Labs generated-site chat prompt change

Superseded implementation: the later native Agent API conversion is documented in `widget-chat-native-request.md`. This earlier report and typecheck describe the initial prompt update, not the final native route. Use the native report and parent build/UI evidence for final acceptance.

Scope: `app/api/vibe-chat/route.ts` only, plus this task's evidence files. No `.env` contents or secrets were read. No calls, messages, or other Telnyx mutations were executed during this task.

## Implemented

- System instructions identify the assistant as Cato Labs' AI implementation and web design representative, regardless of untrusted site configuration.
- Every incoming user message is wrapped with standing Cato Labs chat requirements; the supplied text remains JSON-encoded inside the same user message. Existing 4,000-character message and 24-message history limits remain. Assistant messages are not fabricated.
- Arrival instructions proactively ask the visitor's name/business/project and offer an optional AI call, with phone collection, AI disclosure and explicit destination-specific consent before an outbound call.
- Telnyx instructions require discovery of tools and endpoint schemas, real account-owned caller numbers, compatible existing assistant/connection resources, and a successful provider result before making success claims. Missing resources or failures produce honest limitations, with no SMS fallback or invented callback promise.
- Malformed request body/message/config shapes cannot cause the previous unchecked property/array operations to throw. Configuration is reduced to bounded strings and valid link objects.
- Existing native `run`, key handling, remote MCP registration, SSE conversion, `done` and `error` protocol are retained. The model is pinned to exactly `anthropic/claude-haiku-5-5`, removing the route-specific environment override.
- Responses explicitly use plain readable text for the generated HTML widget; the React/JSX generative UI guide and import were removed.

## Documentation verification

Context7 resolved `Perplexity Agent API` to `/perplexityai/perplexity-node`, then queried native `responses.create` instructions/input/streaming. It confirms system-level `instructions`, `input` message roles, and native streamed response events:
https://github.com/perplexityai/perplexity-node/blob/main/_autodocs/api-reference/responses.md
https://github.com/perplexityai/perplexity-node/blob/main/_autodocs/types.md

Context7 resolved `Telnyx` to `/websites/developers_telnyx`, then queried hosted MCP discovery and outbound AI calls. The official documentation confirms `https://api.telnyx.com/v2/mcp` and the discovery sequence `list_api_endpoints`, `get_api_endpoint_schema`, `invoke_api_endpoint`. Outbound TeXML AI calls require the existing connection, From/To numbers and AI assistant ID; the prompt defers actual endpoint parameters to discovery rather than hardcoding a call implementation:
https://developers.telnyx.com/llms.txt
https://developers.telnyx.com/api-reference/texml-rest-commands/initiate-an-outbound-ai-call

## Evidence and acceptance boundaries

| Scenario | Invocation / inspection | Binary observable | Artifact |
| --- | --- | --- | --- |
| Prompt and validation source changes | `diff -u .omo/evidence/widget-chat-route-before.ts.txt app/api/vibe-chat/route.ts` | Exact old/new route diff captured; only prompts and necessary input normalization change | `.omo/evidence/widget-chat-route.diff` |
| Full workspace TypeScript compilation before final plain-text/model-pin adjustment | `npx tsc --noEmit --incremental false` | PASS: exit 0, no TypeScript diagnostics; final build is delegated to parent | `.omo/evidence/widget-chat-typecheck.log` |
| Actual generated-widget UI, provider response, dismissal, contact/consent conversation | Parent executor's real Playwright run | Not claimed by this implementation subtask; parent owns actual UI acceptance | Parent's UI evidence |
| Real outbound AI call | Intentionally not invoked | Not tested; no outbound communication authorization was exercised by this subtask | No call artifact claimed |

`omo-agent-toolkit ulw-loop status --json` returned `ULW_LOOP_PLAN_MISSING` for the current session, so evidence is recorded under `.omo/evidence/`.
