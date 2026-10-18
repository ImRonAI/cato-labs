# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cato Labs marketing site: Next.js 15 App Router, React 19, TypeScript strict, react-three-fiber, Tailwind v4 (AI Elements/shadcn only).
**Read `CONTRACTS.md` before touching pages or scenes** — it defines copy, styling, scene, section-id and file-ownership rules.
`PLAN.md` is the sitemap/expansion plan. Some CONTRACTS.md statements predate the AI studio (e.g. "no new dependencies";
the AI SDK, streamdown, shadcn/radix and the Perplexity SDK have since been added) — still don't add dependencies without asking.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build; this plus TS strict is the gate that must stay green
- `npx tsc --noEmit` — typecheck only
- `npm run lint` — wired to `next lint`, but ESLint is not installed; don't rely on it
- No unit-test framework exists. Verify changes in the real running UI (Playwright artifacts land in `.playwright-cli/`, `output/playwright/`).

Env (`.env.local`): `PERPLEXITY_API_KEY` (or `VIBE_PPLX_KEY`, which takes precedence) for all `/api/vibe-*` routes; `TELNYX_API_KEY` enables the Telnyx Remote MCP voice-call tool in chat.

## Architecture

### Persistent WebGL layer
`app/layout.tsx` mounts one `<CanvasProvider/>` + `<ScrollDirector/>` behind all routes; page DOM scrolls above it.
- `components/webgl/CanvasProvider.tsx` picks the scene by exact pathname: `scenes/registry.ts` (lazy, one entry per child route) first, then the eager map for `/`, `/capabilities`, `/approach`, `/contact`, else falls back to `HomeScene`. **A new route needs a registry entry** or it silently renders the home scene. A gsap "veil" covers route cuts (`veilBus` in `scroll-store.ts`).
- `ScrollDirector.tsx` publishes 0→1 progress for every `data-scene-section="<id>"` element into the zustand store; scenes read it transiently in `useFrame` via `getSectionProgress`/`sectionRange`/`smooth`/`pointer` from `components/webgl/scroll-store.ts`. Never subscribe in render.
- Shared scene building blocks: `scenes/shared/*` (SceneLightRig, ParticleField, GlassCluster), `webgl/lib/materials.tsx`, `webgl/lib/quality.ts` (`useQuality`), `webgl/kit/*` (RobotMascot, ProximityType, ParticleSculpture). Global Bloom+Vignette already runs — don't add another EffectComposer.
- `ScrollDirector` only kills its own section trackers on route change, so page-level GSAP ScrollTriggers survive (create them with cleanup). Lenis is the sole smooth-scroll engine.
- Scroll-scrubbed rigid-body set pieces use `components/webgl/lib/physics-bake.ts`: `useBakedSimulation({ key, steps, setup, beforeStep })` runs a real Rapier (`@dimforge/rapier3d-compat`, lazy-loaded wasm) simulation once, records every body's pose, and `sample(i, t, pos, quat)` scrubs it by section progress, so scrolling up rewinds exactly. The ref is `null` while baking; render the rest pose until then.

### Pages and content
- Every page's copy comes from `lib/content.ts` (core pages) and `lib/content/*.ts` (capabilities, agentsChildren, industries, regions, work, blog). Child pages look up their entry by slug, e.g. `industries.find(i => i.slug === 'legal')!`.
- Child pages are server components built on `components/ui/ChildPageShell.tsx` (breadcrumb, hero `data-scene-section="hero"`, FAQ, CTA). Each one exports `metadata = pageMetadata({...})` and renders `<JsonLd>` from `childPageJsonLd(...)` (`lib/seo.ts`). Page CSS lives next to the page (`page.css`); `app/globals.css` is append-only.
- `app/sitemap.ts`, `robots.ts`, `llms.txt`, `llms-full.txt` are derived from the content decks, so adding a deck entry updates SEO surfaces.

### Vibe Studio (AI website builder on `/capabilities/digital-products`)
- `VibeCoder.tsx` (client) → `POST /api/vibe-build` starts a background+streaming Perplexity Agent API run (`https://api.perplexity.ai/v1/agent`); `GET ?r=<resp_id>[&stream=true&starting_after=N]` resumes/reconnects; `DELETE` cancels. Run config, tools, inline skills and the system prompt are in `app/api/vibe-build/config.ts` (model `anthropic/claude-opus-5-5`). `config.ts` reads `.agents/skills/frontend-design/SKILL.md` at import and throws if missing.
- `/api/vibe-files` proxies sandbox file listings/downloads for a response. `/api/vibe-chat` is the chatbot backend for generated sites (model `anthropic/claude-haiku-5-5`, per-IP in-memory rate limit, optional Telnyx MCP). It filters upstream events to public text/lifecycle only (`lib/public-chat-response.ts`).
- All routes call `verifyNativeResponse` (`lib/native-response-access.ts`) so a response ID can only be used via the endpoint whose model created it. Continuations require a `completed` response.
- Generated HTML streams into a sandboxed iframe: `components/vibe/LiveCanvas.tsx` + `canvas-runtime.ts` (strict CSP document). The generated widget talks to the host through `postMessage({type:'cato:chat', requestId, input})` / `cato:chat:event`; the host proxies to `/api/vibe-chat` and tracks `previous_response_id`. The full contract is spelled out in `CHAT_WIDGET_REQUIREMENTS` in `config.ts`. `chatRuntime.ts`/`ConciergeChat.tsx` are an older bridge.
- Agent event parsing/trace UI: `lib/agent-events.ts`, `lib/native-agent-trace.ts`, `components/vibe/NativeAgentTrace.tsx`, built on AI Elements in `components/ai-elements/*` (shadcn, styles in `app/ai-elements.css`).
- Perplexity Agent API reference (OpenAPI spec, tool docs) is vendored in `.agents/skills/perplexity_agent_api/` — check it before changing request shapes.
