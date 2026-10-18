# Native Cato Labs chatbot API

This supersedes the earlier message-array/SSE-adapter implementation documented in `widget-chat-prompt.md`.

## Implemented request contract

Browser endpoint: `POST /api/vibe-chat`, JSON content type. The first request sends only the current turn:

```json
{
  "input": "A visitor has opened the generated website. Introduce Cato Labs and offer help with their website and AI implementation project."
}
```

Follow-up browser code uses the ID from a real `response.completed` event, with no replayed conversation array:

```ts
const body = {
  input: visitorMessage,
  ...(completedResponseId ? { previous_response_id: completedResponseId } : {}),
};
const response = await fetch('/api/vibe-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
```

`input.trim()` must contain 1–4000 characters. `previous_response_id`, when supplied, must match `/^resp_[\w-]{1,128}$/`. The provider validates whether the referenced response exists and is complete. Provider HTTP statuses and error bodies pass through unchanged.

## Actual server configuration

The executable implementation is `app/api/vibe-chat/route.ts`; a source snapshot is captured in `widget-chat-native-route.ts.txt`.

The server sends one native `POST https://api.perplexity.ai/v1/agent` per turn:

- Spreads the imported `BUILD_CONFIG` directly, inheriting `max_output_tokens: 128000`, `max_steps: 100`, `reasoning: { effort: 'high' }`, `background: true`, `stream: true`, `store: true`, six hosted tools, native Office, and the complete shared inline frontend skills.
- Overrides `model` to exactly `anthropic/claude-haiku-5-5`.
- Appends the native MCP tool when `TELNYX_API_KEY` is configured: `type: 'mcp'`, `server_url: 'https://api.telnyx.com/v2/mcp'`, `server_label: 'telnyx'`, `authorization` from that server environment variable, `defer_loading: true`, `require_approval: 'never'`.
- Supplies the Cato Labs system instructions each turn and one user input item containing the standing chat requirements plus the current visitor text. No synthetic assistant messages or client-replayed history are constructed.
- Supplies `previous_response_id` only when provided by the caller.
- Uses the same server-side `VIBE_PPLX_KEY || PERPLEXITY_API_KEY` selection as the builder for the Authorization header. No credential value is recorded in these artifacts.

Native provider response bytes and status are forwarded through `new Response(upstream.body, ...)`. There is no `lib/pplx`, custom agent loop, `toUi` conversion, synthetic `done`, or translated provider SSE vocabulary in this route.

`GET /api/vibe-chat?r=<response ID>` retrieves the native response; adding `stream=true&starting_after=<sequence number>` reconnects the native stream. `DELETE /api/vibe-chat?r=<response ID>` invokes native cancellation. These handlers are re-exported from `vibe-build/route.ts` to keep their behavior identical. The parent owns client-side completed-ID commitment and stream parsing.

The Cato Labs plain-text prompt, proactive introduction, visitor name/business/project/phone collection, AI-caller disclosure, explicit call consent, real account-resource discovery, and honest failure reporting remain. No external call or message was executed during this implementation.

## Documentation checked

Context7 query: `/llmstxt/perplexity_ai_llms_txt`, native Agent API conversation state and background streaming/reconnect.

- https://docs.perplexity.ai/docs/agent-api/conversation-state confirms that follow-ups send only the new user turn and `previous_response_id` pointing to a completed response.
- https://docs.perplexity.ai/docs/agent-api/background-mode confirms native streaming, sequence-number reconnect, and plain GET fallback when reconnect expires.
- Prior Telnyx Context7 verification documented in `widget-chat-prompt.md` confirms hosted MCP and schema-discovery sequence.

## Verification status

| Scenario | Invocation / inspection | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| Native route source conversion | `diff -u .omo/evidence/widget-chat-route-before-native.ts.txt app/api/vibe-chat/route.ts` | Source diff contains direct native fetch, shared config import, new-turn input/previous_response_id, GET/DELETE re-export and no UI event adapter | `.omo/evidence/widget-chat-native-route.diff` |
| Exact final route snapshot | `cp app/api/vibe-chat/route.ts .omo/evidence/widget-chat-native-route.ts.txt` | Nonempty source snapshot contains implemented request and response handling | `.omo/evidence/widget-chat-native-route.ts.txt` |
| Final type/build verification and real UI conversation chain | Parent executor's actual build and Playwright workflow | Pending parent execution; the earlier typecheck log predates this rewrite and is not evidence for it | Parent evidence required |
| Real outbound call | Not invoked | Not tested or claimed | No call artifact claimed |

Only `app/api/vibe-chat/route.ts` and this subtask's evidence files were modified. Other agents own the builder config and canvas native event contract.
