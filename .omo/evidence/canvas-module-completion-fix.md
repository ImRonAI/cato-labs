# Inline module completion correction

Real generated Three.js and chat code ran, but the canvas reported `Script timed out: inline module` after 60 seconds. The renderer awaited an inline module's script.onload; that event is not required for inline scripts. The rejected await also skips the renderer's subsequent DOMContentLoaded/load completion dispatch. Any effect on startup must be evaluated separately from the offscreen requestAnimationFrame delay observed during reload; the blank offscreen frame was not caused by the module timeout.

The current HTML Living Standard proves the cause: script's `from an external file` flag is determined by src, and execute-the-script-element step 8 fires load only when that flag is true. Source: https://html.spec.whatwg.org/multipage/scripting.html#execute-the-script-element . Context7 /mdn/content was consulted first for dynamic script and module event semantics; the precise distinction was verified in the primary HTML Standard.

Changed only executeScripts in components/vibe/canvas-runtime.ts. Each inline module now receives a final native event dispatch after its original source. The runtime awaits that real execution signal, unique to canvas channel, script generation and module index. Success, script error and timeout remove the listener and timer. External scripts still use their native load/error events. No source URL conversion, Blob/data module, import-map change or CSP relaxation was introduced. Original module text and import resolution remain in place; top-level await still precedes the appended completion signal.

The companion defensive iframe onLoad replay is documented separately in canvas-reload-handshake-fix.md. Later real UI observation showed that the blank restored frame was waiting for an offscreen requestAnimationFrame, not proof of a lost handshake. Scrolling the IDE into view rendered the actual Three.js page (canvas-visible-reload-after.log).

Verification: npx tsc --noEmit exited 0 (.omo/evidence/canvas-module-completion-tsc.log). Root owns the production rebuild and real generated-page UI, reload, module/CDN, Send-button and native-chat acceptance. No mocked tests or synthetic provider events were used.

SHA256 of components/vibe/canvas-runtime.ts: aec3e07b7458625be641240dec6f8981dcc2b23a861a30094582ea29f43d7d0a
