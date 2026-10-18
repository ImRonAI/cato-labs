# Native IDE parity finishing pass

Only application files changed: `app/capabilities/digital-products/VibeCoder.tsx` and `studio.css`. Parent retains build/server/browser acceptance ownership.

## Grounding

Read the official IDE tutorial and full embedded demo source from `.omo/evidence/ai-elements-ide-reference.html`, especially native Plan > Task > TaskContent > TaskItemFile and ConversationContent > Checkpoint. Resolved AI Elements through Context7 and queried `/vercel/ai-elements` for these compositions. Inspected current installed official FileTree, Task and Plan source; no primitive files changed.

## Changes

- Real provider filename path segments now form recursive native FileTreeFolder nodes. Leaf paths remain exact provider file IDs, preserving real selection and download lookup. Root files remain root files; no directory is invented without filename metadata. Each selected build has its own FileTree instance.
- Plan now contains native Task/TaskTrigger/TaskContent/TaskItem for actual observed provider work and TaskItemFile chips for actual shared provider files. File chips open the real source file through the existing fetch path. No future plan, fabricated task, or assumed success status is added. Native provider statuses are displayed when present; errors remain errors.
- Existing Queue continues to show actual build states per parent direction. The provider does not supply a structured implementation plan/task queue, so this is a real-data adaptation and must not be presented as generated planning data.
- Native Checkpoint now lives inside ConversationContent after the response/actions and before PromptInput. Its actual completed-response restore callback is preserved.
- Corrected Plan styling to native `plan-content` and `plan-title` slots.
- Added a coherent custom-property layer for surface, text, brand, terminal, error, spacing, type and radii. Studio brand derives from site `--blue`; surfaces/text derive from site paper/ink tokens; native component tokens inherit the same palette.
- Replaced emoji asterisk glyphs with actual Lucide AsteriskIcon SVGs so brand color applies.
- Transport, live canvas instances, pending-chat state, native trace adaptation, navigation and provider API behavior are unchanged.

## Verification

`npx tsc --noEmit --incremental false` exited 0 with no diagnostics. No mocks, fake provider data, or isolated test substitutes were introduced. No Next build was run because the parent is testing the actual UI on its server. Patch and final hashes are adjacent evidence artifacts. Root must still validate the new compiled UI, native folder toggles if real nested filenames are available, provider-work/file Tasks, checkpoint scroll placement, and blue SVGs at desktop/mobile sizes.
