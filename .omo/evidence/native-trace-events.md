# Native provider trace normalization evidence

Scope: `lib/native-agent-trace.ts` only. Root owns live UI acceptance; this report does not claim UI acceptance.

## Grounding
- Context7 resolve-library-id Perplexity returned `/llmstxt/perplexity_ai_llms_txt`; query-docs fetched native Agent schema and separated gateway-only reasoning events.
- Live documentation: https://docs.perplexity.ai/api-reference/agent-post.md and https://docs.perplexity.ai/docs/agent-api/skills.md fetched with curl -fsSL.
- Installed source inspected: `node_modules/@perplexity-ai/perplexity_ai/src/generated/api.ts` (ReasoningStep, SandboxResultsOutputItem, ResponseSkillLoadedEvent, output item types).

## Real persisted provider output inventory

Read-only invocation: `curl -fsSL http://127.0.0.1:3217/api/vibe-build?r=resp_5f4e5d66-c7be-48d0-b13a-aed0e740ba3b`
Observable: provider response `resp_5f4e5d66-c7be-48d0-b13a-aed0e740ba3b`, status `completed`, 21 output items.
```json
[
  {
    "output_index": 0,
    "type": "skill_loaded",
    "call_id": null,
    "name": "frontend-design",
    "file_id": null
  },
  {
    "output_index": 1,
    "type": "skill_loaded",
    "call_id": null,
    "name": "frontend-development",
    "file_id": null
  },
  {
    "output_index": 2,
    "type": "skill_loaded",
    "call_id": null,
    "name": "office/pdf",
    "file_id": null
  },
  {
    "output_index": 3,
    "type": "sandbox_write_file",
    "call_id": "toolu_bdrk_011zNQTt6T5AR3Khp5ebyjBS",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 4,
    "type": "sandbox_write_file",
    "call_id": "toolu_bdrk_01LibSqeXVq51CeXTNqPG3L1",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 5,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_012reCYW8FPaVsw4qQd3sU4i",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 6,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01LGHxD56wV3h5X22ECkfw5o",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 7,
    "type": "function_call",
    "call_id": "toolu_bdrk_01EHyaBuoae4v4GmTkE5C5eU",
    "name": "view_images",
    "file_id": null
  },
  {
    "output_index": 8,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01YbFL2eQL6YXJiwkbzQYmFs",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 9,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01P22bS4DEeZECqqZcDE6ciL",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 10,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01Fj7hYeNUpZC6YyUqeBuCBM",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 11,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01QcZcMWnWBgeQrUUkZMm79U",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 12,
    "type": "function_call",
    "call_id": "toolu_bdrk_01F9GeQrAGj9YpjaYKQjXegJ",
    "name": "view_images",
    "file_id": null
  },
  {
    "output_index": 13,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01VMQbSEFS3MYmzN1fXkunU2",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 14,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01TqXikw5AmVNdc1acYDTMQX",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 15,
    "type": "function_call",
    "call_id": "toolu_bdrk_01AyxGpHfiKZEJv7dnKuPWZz",
    "name": "view_images",
    "file_id": null
  },
  {
    "output_index": 16,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01N6ZFQFyeGRNji6uuFpQK8Z",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 17,
    "type": "function_call",
    "call_id": "toolu_bdrk_01MTUQMavTM7dAF9T8AjiTRm",
    "name": "view_images",
    "file_id": null
  },
  {
    "output_index": 18,
    "type": "share_file",
    "call_id": "toolu_bdrk_014XPxNHB4SqVRwcgzk6Qiyk",
    "name": null,
    "file_id": "2a175c2d-291b-4950-b4fd-39aa81441707"
  },
  {
    "output_index": 19,
    "type": "share_file",
    "call_id": "toolu_bdrk_01QjY1ZaEhjD7TAb7KpdhTFo",
    "name": null,
    "file_id": "b94648ac-e2fb-4b89-ad44-7cbd379a4bac"
  },
  {
    "output_index": 20,
    "type": "message",
    "call_id": null,
    "name": null,
    "file_id": null
  }
]
```

Read-only invocation: `curl -fsSL http://127.0.0.1:3217/api/vibe-build?r=resp_5d73bc0d-bd73-44fd-8274-838e80396401`
Observable: provider response `resp_5d73bc0d-bd73-44fd-8274-838e80396401`, status `completed`, 7 output items.
```json
[
  {
    "output_index": 0,
    "type": "skill_loaded",
    "call_id": null,
    "name": "frontend-design",
    "file_id": null
  },
  {
    "output_index": 1,
    "type": "skill_loaded",
    "call_id": null,
    "name": "frontend-development",
    "file_id": null
  },
  {
    "output_index": 2,
    "type": "sandbox_write_file",
    "call_id": "toolu_bdrk_014KH4Ef2vbkQ2GWEXM5GEbT",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 3,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01SnTwoGFKtbfj2B6kPVz8WJ",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 4,
    "type": "sandbox_results",
    "call_id": "toolu_bdrk_01XiYkZXgh3bpYgY82MsrrPL",
    "name": null,
    "file_id": null
  },
  {
    "output_index": 5,
    "type": "share_file",
    "call_id": "toolu_bdrk_019NrwsCCFatti3Gg4kc4jef",
    "name": null,
    "file_id": "d557efde-12a4-4e68-9053-b8114aa28aa4"
  },
  {
    "output_index": 6,
    "type": "message",
    "call_id": null,
    "name": null,
    "file_id": null
  }
]
```

## Compiler scenario
Scenario: standalone strict checking of the new production reducer, with no mocks or synthetic event tests.
Invocation: `npx tsc --noEmit --strict --skipLibCheck --target ES2020 --moduleResolution bundler --module esnext lib/native-agent-trace.ts`
Binary observable: exit code 0.
```text
(no compiler diagnostics)
```

## Implementation criteria and limits
- Full reasoning content and summary parts retain provider item ID plus their separate content/summary indexes. Event thought text remains provider-authored. No encrypted reasoning or obfuscation is rendered as text.
- Full native search, image, finance and people payload records remain available; no result-count or text-length caps, invented hits, or sandbox CLI reclassification exist.
- Sandbox code, language and all result rows are retained; stdout/stderr are concatenated without truncation and nonzero exits expose the original result as error.
- Native fetch URL appears as directTool; skill/file/file-operation records come from actual native output types.
- applyNativeTrace hydrates event.response. hydrateNativeTrace accepts the native response itself. Caller must reset entries for a different response ID.
- Identity uses item_id/id, call_id or output_index. Provider events without any such identity use sequence_number; concurrent unidentifiable query/result events intentionally remain separate rather than being paired by latest-open heuristics.
- Skill-loaded stream events lack identifiers beyond name/sequence; stream notification and persisted output can therefore remain separately visible when the provider supplies no shared identity. This preserves all observed records instead of guessing call identity.
- Actual UI rendering, stream execution and reload acceptance are delegated to the root integration and are not claimed by this compile-only scenario.

Artifact: `.omo/evidence/native-trace-events.md`
Source SHA256: `8c469733070652b9b2dfdc0fd72b5ffc14088e11cde3911207debe477948b62d`

## Reviewer follow-up: notification reasoning and terminal state

Changes: thought notification IDs now include sequence number, retaining differing thoughts from the same call and making sequence replay idempotent. Reasoning deltas continue to use item/channel/index identity. Identifierless query notifications have done=true/status=submitted. Terminal hydration closes remaining active records with ended or interrupted rather than asserting success. Native in_progress items in terminal snapshots also close neutrally. Image query/result merging excludes reasoning records sharing call IDs. Empty snapshot reasoning preserves existing streamed text; native part/output indexes are not shifted by filtering.

Scenario: strict compile of final revised production reducer.
Invocation: `npx tsc --noEmit --strict --skipLibCheck --target ES2020 --moduleResolution bundler --module esnext lib/native-agent-trace.ts`
Binary observable: exit code 0.
```text
(no compiler diagnostics)
```

Read-only native grounding invocation: `curl -fsSL http://127.0.0.1:3217/api/vibe-build?r=resp_e266a4c5-92be-4ab9-a8ef-f295280407ca`
Observed status: in_progress. Finance output has no item_id/call_id; source entries are native string URLs. Duplicate notifications cannot be linked safely to persisted outputs without provider identity. Actual finance item:
```json
[
  {
    "categories": [
      "quote"
    ],
    "results": [
      {
        "category": "quote",
        "content": "## AAPL Quote\nQuote field guide: `price` is the latest quote/current price. Use `price` for latest price, current price, latest quote, or latest close/closing price unless the user explicitly asks for previous close. `previousClose` is the prior session close. Use `dayLow`, `dayHigh`, or `open` only when the user asks for low, high, or open.\n| symbol | name | timestamp | fetched_at | market_status | price | change | changesPercentage | marketCap | previousClose | yearLow | yearHigh |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| AAPL | Apple Inc. | 2026-10-15 20:00:01 UTC | 2026-10-16 11:19:26 UTC | pre_market | 342 | -0.96 | -0.28 | 4,991,209,560,000 | 342.96 | 243.42 | 348.15 |\n\nData available in: `AAPL_quotes_3a79b0.csv` (row key column: symbol)",
        "sources": [
          "https://www.perplexity.ai/finance/AAPL"
        ],
        "tickers": [
          "AAPL"
        ]
      }
    ],
    "tickers": [
      "AAPL"
    ],
    "type": "finance_results"
  }
]
```
Actual UI execution remains owned by root; compile success is not reported as runtime acceptance.
Source SHA256: `5c82155dd779a793494a39041fa463537eba7d1982cc6747a1c4a6feffe705cc`

## Actual provider snapshot identity scenario

Invocation: strict TypeScript compile to /tmp/cato-native-trace-compiled; Node loads hydrateNativeTrace with `.omo/evidence/native-trace-browser-state.json` and read-only GET `/api/vibe-build?r=resp_e266a4c5-92be-4ab9-a8ef-f295280407ca`. No events or provider outputs fabricated.

Binary observable: PASS (duplicate sandbox call IDs removed, repeated hydration entry count stable, all prior skill identities retain names).
```json
{
  "scenario": "Hydrate actual captured browser trace with actual provider GET; repeat same snapshot",
  "responseId": "resp_e266a4c5-92be-4ab9-a8ef-f295280407ca",
  "before": 20,
  "after": 18,
  "repeated": 18,
  "duplicateSandboxCallIds": [],
  "skillsBefore": [
    [
      "output:1",
      "frontend-design"
    ],
    [
      "output:2",
      "frontend-development"
    ],
    [
      "output:3",
      "search"
    ],
    [
      "output:4",
      "finance_sandbox"
    ],
    [
      "event:response.skill.loaded:32",
      "frontend-design"
    ],
    [
      "event:response.skill.loaded:36",
      "finance_sandbox"
    ]
  ],
  "skillsAfter": [
    [
      "output:1",
      "frontend-design"
    ],
    [
      "output:2",
      "frontend-development"
    ],
    [
      "output:3",
      "search"
    ],
    [
      "output:4",
      "finance_sandbox"
    ],
    [
      "event:response.skill.loaded:32",
      "frontend-design"
    ],
    [
      "event:response.skill.loaded:36",
      "finance_sandbox"
    ]
  ],
  "remainingActive": 7
}
```

Final identity revision compile invocation: `npx tsc --noEmit --strict --skipLibCheck --target ES2020 --moduleResolution bundler --module esnext lib/native-agent-trace.ts`
Binary observable: exit 0.
```text
(no compiler diagnostics)
```
Final source SHA256: `f17d723a2074f1665f1d9a34f26675150de45d5c871b5c7bf41f2ac6e126bfb4`
