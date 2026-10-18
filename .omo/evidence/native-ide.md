# Native IDE implementation handoff

Status: implementation complete; final production build and actual Playwright UI acceptance are owned by the coordinating agent. No UI pass is claimed by this implementation executor.

## Provenance

Context7 resolved AI Elements to `/vercel/ai-elements`, then queried the official IDE composition and components. Official source: https://github.com/vercel/ai-elements/blob/main/apps/docs/content/examples/ide.mdx (captured as `.omo/evidence/ide-official-source.mdx`). Official reference page was supplied at `.omo/evidence/ai-elements-ide-reference.html`.

Executed `npx ai-elements@latest add file-tree terminal plan queue prompt-input checkpoint`. CLI exited 0, created 17 files and skipped 5 existing UI files; explicitly answered no to tooltip/separator overwrite prompts. Component registry payloads and source are captured as `.omo/evidence/{file-tree,terminal,plan,queue,prompt-input,checkpoint}-registry.json` and matching `-reference.tsx` files. CLI adds ansi-to-react, cmdk and component dependencies through package files. Existing agent/activity adapters and transport routes were not edited.

## Component / production data mapping

- Left: official FileTree/FileTreeFile renders provider `files` metadata. Click fetches actual fileHref response and UTF-8 decodes it. Unsupported/binary extensions offer actual download only. Explicit streamed HTML action reads real accumulated output; it is not represented as a provider file.
- Center: Preview/Code tabs retain mounted preview. Official CodeBlock with line numbers/copy renders fetched source or streaming HTML read only. Terminal composes official header/title/copy/content using actual sandbox code/stdout/stderr, with a truthful empty state.
- Right: official Plan/PlanHeader/PlanTitle/PlanDescription/PlanAction/PlanTrigger/PlanContent uses the real submitted brief. Queue sections Pending/Completed/Ended use actual build statuses and official section labels/count/icons, items, indicators and content. Only completed runs receive completed indicators.
- Conversation/Message/MessageContent/MessageResponse contain original prompt and unchanged NativeAgentTrace (Agent > Task > ChainOfThought children). PromptInput/Body/Textarea/Footer/Submit dispatch the original native transport and retain PDF/text attachments.
- Checkpoint restores the selected completed build's entry preview, clears page navigation state and selects its actual response ID as revision context.
- Build selector supports multiple parallel runs; visited canvas instances stay mounted while hidden to preserve active chat. Restore initially mounts only the last build. Chat pending/completed response IDs remain per-build; navigation passes fragments.
- Mobile panel tabs expose Files, Preview & code, Agent & brief without three-column overflow.

## Verification performed and outstanding actual UI scenarios

`npx tsc --noEmit` initially reported unsupported CodeBlock language `text`; captured `.omo/evidence/native-ide-tsc.log`. Corrected to official supported `log`. A concurrent earlier tsc invocation may report the same stale error. Coordinator requested no repeat typecheck and owns final production build; do not treat this log as a passing final gate.

Required real-UI acceptance, binary observables and artifact ownership:
1. Open actual studio desktop and 390px viewport: three official panels on desktop, one selected mobile panel and no horizontal document overflow. Capture screenshots and DOM measurements under coordinator's Playwright artifacts.
2. Submit actual provider brief: run appears in Pending; live preview receives streamed HTML; native Agent > Task > ChainOfThought displays real events; completion moves run to Completed. Capture request/response IDs and UI screenshots.
3. Select real provider source file: request `/api/vibe-files?r=...&f=...` returns source, CodeBlock shows matching filename/content/line numbers. Binary file displays download-only state. Capture actual network and visible content.
4. Terminal: real sandbox code/stdout/stderr matches trace; empty state persists if provider performed no sandbox work. Capture DOM and trace response.
5. Multiple real builds: selector switches among builds; opened canvases remain mounted; queued/background runs continue; responsive panel switching preserves state. Capture frame count and activity.
6. Completed checkpoint: navigate generated page, restore checkpoint, original entry returns; next revision POST uses completed response as previous_response_id. Capture actual request and restored preview.
7. Attach real PDF/text; cancel/reconnect real provider run; restore session; download actual shared files including provider ZIP. Capture actual requests and UI states. Existing transport behavior retained, not re-proven by static inspection.
