# Telnyx voice readiness — read-only account verification

Checked 2026-10-16 at 11:53–12:01 UTC through the actual hosted MCP at `https://api.telnyx.com/v2/mcp`. Authentication succeeded; server identified itself as `telnyx_api` 3.0.0. Context7 current official documentation was consulted before the account read.

No application source, environment configuration, or account resource was changed. No call, message, fax, purchase, or other customer contact occurred. Secrets, phone numbers, resource IDs, customer names, prompts, and private endpoint URLs are excluded from these artifacts. Account responses were processed in memory only.

## Verified account resources

All list responses were complete: reported `total_pages` was 1 and total matched returned count.

| Resource | Observed result |
| --- | --- |
| Owned phone numbers | 2; both active and attached to a connection |
| Outbound voice profiles | 1; enabled |
| Call Control applications | 4; 1 active and linked to that enabled outbound profile |
| Active owned number attached to that Call Control application | 1 |
| TeXML applications | 11; 6 active and linked to the enabled outbound profile |
| AI assistants | 11, with complete instructions plus voice/telephony settings |
| Existing assistant name/instructions explicitly mentioning Cato | 0 |
| Base assistants with Telnyx voice, no tools, no MCP servers, no dynamic-variable webhook, no external LLM or LLM-secret reference | 10 |

The phone-number list does not expose an explicit outbound-capability boolean. Active ownership and a valid active application/profile association establish resource availability, not successful delivery. Destination permissions, account spend/credit restrictions, actual assistant speech, and telephone delivery were not exercised.

## Per-call instructions: supported, with an MCP schema gap

Current official documentation permits reusing a stored assistant with per-call instructions and greeting rather than creating or changing a persistent assistant. See [Attach an AI Assistant](https://developers.telnyx.com/docs/voice/programmable-voice/ai-assistant-start) and [Start AI Assistant](https://developers.telnyx.com/api-reference/call-commands/start-ai-assistant).

The **actual native MCP schema** for `start_ai_assistant_calls_actions` contains:

- `call_control_id` (required).
- `assistant.id` — existing assistant identifier.
- `assistant.instructions` — replaces the assistant's instructions for this call.
- Top-level `greeting` — opening spoken text.
- `command_id` — native duplicate-command prevention.

This is sufficient to provide a Cato-specific pitch on an already answered call without altering the base assistant. All base assistant configuration must still be inspected before selection; absence of Cato wording alone is not a blocker when a supported per-call override is used.

The [current REST Dial documentation](https://developers.telnyx.com/api-reference/call-commands/dial) supports an `assistant` object on `POST /v2/calls`, including `id`, `instructions`, and `greeting`, with automatic assistant startup after answer. **The live MCP `dial_calls` metadata returned in this session does not enumerate the `assistant` field.** However, the generic `invoke_api_endpoint` accepts `args` with arbitrary additional properties, and the endpoint input schema does not prohibit additional properties either. Consequently the documented REST payload can be supplied as `args` without violating these JSON schemas: `endpoint_name: "dial_calls"`, with `args` containing `connection_id`, `from`, `to`, and `assistant: {id, instructions, greeting}`. There is no separate `body` wrapper. This is grounded in current official REST documentation, not an invented field. Whether the current MCP implementation forwards every extra field unchanged has not been verified by a call. The narrower catalog is a metadata gap, not proof of rejection. `start_ai_assistant_calls_actions` remains a supported override option for an already answered call; blindly dialing and immediately issuing it is not an established equivalent.

Native `retrieve_status_calls` exposes `is_alive`, not a `call.answered` event. This inspection does not establish it as a reliable substitute for answer-event handling. The direct REST TeXML AI call operation exists in official docs, but no matching dedicated operation was returned by the current MCP catalog searches; other TeXML operations do exist. No inference of account incapability is drawn from that catalog difference.

## Minimal prompt correction

Tell the Haiku agent to discover current native schemas and use the officially documented one-step Dial assistant configuration through native `invoke_api_endpoint`: `args.assistant.id`, `args.assistant.instructions` for the Cato role, and `args.assistant.greeting` for an AI-disclosing Cato introduction. Use an inspected suitable existing assistant, owned caller ID, active account application/profile, visitor-provided number, and explicit call consent. Preserve existing assistant/account configuration. Do not retry a failed assistant-capable request by silently dropping the assistant configuration. If the native MCP rejects or fails to forward the documented fields, report that actual limitation. A successful dial response is only call initiation, not proof the visitor answered or the AI conversation began. For an already answered call, the separately discovered start command uses `assistant.instructions` and a top-level `greeting`.

The live `initiate_texml_calls` operation supports `Url` but does not enumerate an inline `Texml` or assistant field. Current [AIAssistant TeXML documentation](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/aiassistant) shows `id` and conversation-join attributes, without a documented instructions override. An inline TeXML override route was therefore not established.

Creating a dedicated Cato assistant is not inherently necessary. If chosen later, the inspected `create_ai_assistants` schema requires `name`, `model`, and `instructions`; voice/telephony settings are additional fields. This audit did not invoke it, select a model, create a resource, or verify caller binding for a newly created assistant.

## Evidence and limits

- `telnyx-voice-readiness-summary.json`: redacted counts, pagination, capability booleans, and schema-supported override fields.
- `telnyx-call-public-schemas.json`: actual public schemas for `dial_calls`, `start_ai_assistant_calls_actions`, `retrieve_status_calls`, `create_ai_assistants`, and `initiate_texml_calls`; no account values.
- `widget-telnyx-discovery.json`: prior native tool catalog, reverified here using `initialize` and `tools/list`.

Invoked account operations were exclusively schema-verified read-only `list_ai_assistants`, `list_phone_numbers`, `list_call_control_applications`, `list_texml_applications`, and `list_outbound_voice_profiles`. A transient discovery HTTP 503 was retried successfully and was not treated as absence of a capability. Final status: authentication and existing resource inventory verified; native per-call instruction override verified at schema level; complete outbound AI call through the current MCP schema remains unverified. Calls sent: **0**.
