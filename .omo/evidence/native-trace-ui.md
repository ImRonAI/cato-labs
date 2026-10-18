# Native trace UI implementation evidence

Scope: new components/vibe/NativeAgentTrace.tsx; official components/ai-elements/agent.tsx and missing components/ui/accordion.tsx; additive trace styles in studio.css. Existing concierge AgentTrace.tsx untouched. No package dependency edits required.

Official provenance: Context7 resolve-library-id AI Elements selected /vercel/ai-elements; query-docs fetched Agent composition/install documentation. Official docs fetched from https://elements.ai-sdk.dev/components/agent, /chain-of-thought, /task, /sandbox, /tool. Installed using `npx ai-elements@latest add agent` (ai-elements 1.9.1). CLI created Agent and Accordion only, skipped existing Badge/Button/Select/CodeBlock. Source: https://raw.githubusercontent.com/vercel/ai-elements/main/packages/elements/src/agent.tsx.

Exact source delta beyond CLI import aliases: `tool: Tool;` -> `tool: Tool & { description?: string };`. This is type-only compatibility with installed AI SDK 7, whose Tool description may be a function; upstream AgentTool directly renders description. No runtime behavior changed. Parent explicitly approved this narrow correction. Provenance verification and SHA256 hashes: native-trace-ui/provenance.json; captured upstream source: native-trace-ui/upstream-agent.tsx.txt.

Scenario: compile current actual application and new native component against actual normalization contract. Invocation: `npx tsc --noEmit`. Binary observable: exit code 0, no diagnostics. Artifact: native-trace-ui/typecheck.log.

Implementation: official Agent > Task > ChainOfThought, default-open Task/Chain; complete reasoning text through MessageResponse with streaming state; native search badges and images; all sandbox entries use Sandbox with Code/Output tabs and full source/output; fetch/direct calls use Tool with real inputs/output/errors. No fabricated trace steps. Provider failure state maps to output-error, including sandbox failed execution result. Safe external HTTP(S) result/file links. Unsupported code language uses log highlighting without changing code text.

Real provider/browser behavior is NOT validated by this worker. Parent owns Playwright acceptance and must record actual UI evidence before claiming end-to-end completion.

Parent review corrections included in final compile: finance sources nested under native results flatten into individual native SearchResult links (source records or URLs); category/tickers give provider-derived labels where flat titles are absent. File links prefer authenticated same-origin proxy whenever responseId exists. Existing native step roots expose data-native-trace-kind for actual UI acceptance assertions.
