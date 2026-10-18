# Canvas generated form submission fix

The real generated widget at output/playwright/generated-cato-site/index.html uses a form submit listener that calls preventDefault() and then the native chat bridge. Root observed Chrome blocking the real Send button before that handler because the preview iframe lacked allow-forms.

Changed one line in components/vibe/LiveCanvas.tsx: added allow-forms to the existing iframe sandbox token list. No allow-same-origin was added, and the existing canvas-runtime.ts CSP form-action 'none' was left unchanged. Thus form submit handlers can run while the frame remains opaque and normal network form submissions remain blocked by CSP.

Grounded with Context7 resolve-library-id (MDN Web Docs), then query-docs /mdn/content, plus the current official pages:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action

MDN documents allow-forms as lifting the form submission restriction, the omission of allow-same-origin as preserving the special origin, and form-action 'none' as prohibiting form submission destinations.

Verification: npx tsc --noEmit exited 0; .omo/evidence/canvas-form-submit-tsc.log is empty on success. No simulated events, mocks, generated-site edits or shared-browser actions were used. Root subsequently rebuilt and passed the actual Send-button UI workflow. widget-send-button-actual-completion.log records the real native Haiku completion and prior-response continuity, including recall of the blue multipage Three.js project and no call consent. No call or text was requested or sent in that check.

SHA256 of components/vibe/LiveCanvas.tsx: 5ca3cdbba90cb68c813a16c36f4b0374e2f0f72c952bdffa0eb42c1391ed5a10
