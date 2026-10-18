# Actual IDE file and clipboard verification

The production build including the chat transport boundary passed (`studio-chat-boundary-build.log`, command exit 0) and was started on port 3217.

Using the actual completed provider response `resp_e266a4c5-92be-4ab9-a8ef-f295280407ca` in the real IDE:

- Selecting the real `index.html` source rendered its read-only CodeBlock.
- Clicking the native source copy control copied 5,117 characters including the real document and Apple content to the browser clipboard. Evidence: `ide-real-copy.log`.
- Clicking the real download link completed an `index.html` download with no download failure. The saved artifact is `output/playwright/actual-provider-index.html` (5,123 UTF-8 bytes). Evidence: `ide-real-download-boundary-final.log`.
- The active multipage response reconnected through the guarded builder endpoint without starting another response. Evidence: `studio-chat-boundary-reconnected.log`.

Two earlier test-script attempts failed on selector/event assumptions: an unscoped Code tab matched native Sandbox tabs too, and a download did not emit the normal response event awaited by that script. The final checks scope the actual website tab and await Playwright's actual download event. Those earlier logs do not represent application failures and are not counted as passing evidence.

No mock files, synthetic provider events, or simulated downloads were used. This addendum does not establish generated multipage/chat/Telnyx call acceptance.
