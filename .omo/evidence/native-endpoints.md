# Native Agent API endpoints

Implemented files: `app/api/vibe-build/route.ts`, `app/api/vibe-build/config.ts`, `app/api/vibe-files/route.ts`. Shared concierge client `lib/pplx.ts` was left unchanged.

Validation invocation: `npx tsc --noEmit --incremental false` (working directory `/Users/tims-stuff/CatoWeb`). Observable: exit code 0, no diagnostics. This is static validation only; parent task owns actual UI and provider verification.

## Browser contract

- POST `/api/vibe-build`: JSON `{ "prompt": "brief" }`; optional `files` array of `{ "type": "input_file", "filename": "brief.pdf", "file_data": "data:application/pdf;base64,..." }`, optional native `previous_response_id`.
- GET `/api/vibe-build?r=resp_...`: native response snapshot.
- GET `/api/vibe-build?r=resp_...&stream=true&starting_after=42`: native resumed SSE after sequence 42.
- DELETE `/api/vibe-build?r=resp_...`: forwards POST to native cancel.
- GET `/api/vibe-files?r=resp_...`: native file metadata; append `&f=<file-id>` for bytes.

The server forwards upstream body bytes and HTTP status without transforming native events, manufacturing completion, running tools locally, or retrying calls. Only transport failures become 502. Missing server credentials become 503. Invalid local input becomes 400.

Configuration: `anthropic/claude-opus-5-5`, max output 128000, max steps 100, background/stream/store true. Six hosted tools: web_search, image_search, fetch_url, finance_search, people_search, sandbox. Native skills: builtin office, complete untruncated local frontend-design, complete self-contained inline frontend-development. No local skill references are sent without their instructions. Missing or oversized design skill throws visibly.

References used: local Perplexity API skill and create-agent-response schema, inline skill limits, background-mode resume documentation, working-with-files share_file documentation. Parent verified live docs before delegation: https://docs.perplexity.ai/llms.txt and https://docs.perplexity.ai/api-reference/agent-post.

Pending integration observations: actual provider acceptance, browser streamed canvas, cancellation/resume UI, attachment handling, native file downloads, and production trace inclusion of `.agents/skills/frontend-design/SKILL.md` must be verified by parent. No UI result is claimed here.
