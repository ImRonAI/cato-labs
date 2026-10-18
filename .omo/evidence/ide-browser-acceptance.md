# AI Elements IDE browser acceptance

Current scope: the blue IDE in the digital-products vibe coding area. Tested through the actual production build on `http://127.0.0.1:3217/capabilities/digital-products#vibe` using the Playwright skill, real provider responses, and real shared files. No mocked requests, synthetic provider events, or fabricated project data were used.

## Verified

- Production build after parity corrections: `ide-parity-build.log`, exit 0. Worker TypeScript check also passed.
- Desktop: real FileTree, CodeBlock, Terminal, Plan/Task, Queue, Conversation, Checkpoint, and PromptInput. The three panels measured approximately 179/621/345 pixels inside the 1440-pixel viewport, without document overflow. Brand color resolves to site blue `#2e4bff`; the mark is an SVG. Evidence: `ide-final-desktop-ui.log`, `output/playwright/ide-final-desktop.png`.
- Mobile: 390-pixel viewport and 390-pixel document width; Files, Agent & brief, and Preview & code each reveal only the selected panel. Evidence: `ide-final-mobile-ui.log`, `output/playwright/ide-final-mobile.png`, `output/playwright/ide-final-mobile-viewport.png`.
- Actual provider source selection: shared `index.html` fetch returned HTTP 200 and 5,117 decoded characters. The native code view rendered its filename, syntax highlighting and line numbers. The first response-time check preceded React's completed render; `ide-file-rendered.log` verifies the subsequent rendered filename and source. Evidence: `ide-real-file-fetch.log`, `ide-file-rendered.log`.
- Preview executes the actual generated theme control. Dark-to-light transition was observed in the iframe DOM. Switching to New build and back retained the mounted iframe and dark theme. Evidence: `ide-preview-control.log`, `ide-final-desktop-ui.log`.
- Checkpoint is inside ConversationContent and selects the completed response for revision. Evidence: `ide-checkpoint-ui.log`, `ide-final-mobile-ui.log`.
- Native Plan Tasks display actual observed provider operations, including an actual sandbox error, and real shared files. They do not invent future steps or turn failed work into success. Evidence: `ide-final-mobile-ui.log`.
- Reconnecting the actual ongoing Opus response `resp_2e869cbc-b08e-4bc9-a010-75c068afb44e` after the rebuild resumed sequence delivery. No new build was submitted by reconnecting.
- The new native PromptInput submitted a real brief to the provider. Stop cancelled the accepted response `resp_7af8342b-add7-48fc-bf01-b30b53fc31dd`, and the native Queue moved it to Ended with cancelled status. Evidence: `ide-submit-cancel-ui.log`.
- No browser console errors were observed in these IDE scenarios. Existing CSS preload warnings remain.

## Scope and remaining acceptance

The official example uses illustrative planned tasks and files. This implementation uses real provider work and actual builds in Plan/Queue; it does not claim the API supplies a structured implementation plan. Native folder composition is present, but the completed real response used for this pass exposes only a root-level file, so folder interaction is not asserted as a real-data UI pass.

The ongoing multipage provider run, its CDN/Three.js output, generated Haiku widget continuation, and Telnyx calling are separate acceptance scenarios. This IDE report does not claim those have passed. No outbound call or SMS was placed.
