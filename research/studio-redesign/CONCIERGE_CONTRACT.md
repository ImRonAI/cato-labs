# Studio Concierge contract (shared AI chat kit)

The AI concierge is ONE shared, centrally built and browser-verified kit. It renders
the official, unmodified Vercel AI Elements components (Task, Chain of Thought, Tool,
Prompt Input, JSX Preview), talks to the real Perplexity Agent API
(POST /api/studio-agent -> https://api.perplexity.ai/v1/agent, model
anthropic/claude-haiku-5-5, max_output_tokens 128000), and renders generative UI from the
oubliai Telnyx MCP server (generate_prefab_ui + search_prefab_components only).
The coordinator inlines the compiled kit into every page so each page stays ONE HTML file.

Site designers do NOT write chat code. They integrate the kit with these hooks:

1. Mount point, anywhere inside <body>:
     <div id="concierge-root"></div>
2. Injection marker, immediately before </body>, exactly:
     <!-- STUDIO-CONCIERGE:BEGIN --><!-- STUDIO-CONCIERGE:END -->
3. Triggers: any element with the attribute `data-concierge-open` opens the panel.
   Optional `data-concierge-prompt="..."` sends that message when clicked.
   Every page must have at least one elegant, deliberate entry point (e.g. a nav item,
   a hero secondary action, a section CTA). The kit also renders its own discreet
   launcher; set `data-concierge-launcher="off"` on #concierge-root to hide it if the
   site provides its own permanently visible trigger.
4. Theme tokens on :root (all required; the kit is styled exclusively from these):
     --concierge-bg            panel surface
     --concierge-fg            primary text
     --concierge-muted         subtle surface (code blocks, chips)
     --concierge-muted-fg      secondary text
     --concierge-accent        accent / primary action
     --concierge-accent-fg     text on accent
     --concierge-border        hairlines
     --concierge-font          body font-family stack
     --concierge-display-font  display font-family stack
     --concierge-radius        e.g. 2px / 10px
     --concierge-scheme        light | dark
5. Site context (JSON, untrusted descriptive data for the assistant):
     <script type="application/json" id="concierge-context">
     {
       "brand": "Aether Motors",
       "concierge": "The Aether Concierge",
       "intro": "One sentence the panel shows before the first message.",
       "sections": [{"id": "models", "label": "Models"}],
       "suggestions": ["Three short starter prompts", "...", "..."],
       "facts": "A compact paragraph of the business's offer, voice and key facts."
     }
     </script>
6. Do not load the Tailwind CDN (its preflight would restyle the kit). Use hand-written CSS.
7. Do not set global styles on `button, input, textarea, [role]` without scoping them
   away from `#concierge-root` (use `:where(...)` / `:not(#concierge-root *)`).
