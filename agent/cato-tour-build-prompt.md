# Build prompt: Cato the Robot tour on /capabilities/ai-agent-systems

You are the coding agent for the Cato Labs site (`/Users/tims-stuff/CatoWeb`). It is built with Next.js 15 App Router, React 19, TS strict and react-three-fiber.
Your job is to rebuild the agents-page tour that Cato leads. Do it in the **simplest way that loses none of the requirements below**.
Reuse what already exists. Add no new npm dependencies. Do not wrap tools.

The tour runs at `http://localhost:3000/capabilities/ai-agent-systems`. Start the dev server with `npm run dev`.

---

## 0. Read first (in this order)
1. `AGENTS.md`: **never add limits** of any kind (rate limits, caps, timeouts, truncation, max lengths) unless the owner asks. Keep `max_output_tokens` / `max_steps` exactly as they are.
2. `CLAUDE.md`: architecture, commands, env vars.
3. `CONTRACTS.md`: copy, styling, scene and file-ownership rules.
   - Exception: the colour spectrum in §4 is the owner's spec and **overrides** the white/ice-blue/electric-blue palette rule.
4. `UPGRADE_PLAN.md`: §0 has the owner's decisions and the music licensing rules. §2 covers Cato's architecture.
5. `.omo/evidence/cato-journeys-code-review.md`: the last review of the transition code.

The working tree has a lot of uncommitted work from earlier sessions. Don't revert it, and don't commit unless the owner asks.

## 1. Hard rules (owner)
- **No wrappers of any kind** around the Telnyx video call, the music tools, or Prefab/generative UI.
  - Call the existing tools and components as they are.
  - An animated panel may *surround* WebPreview/Prefab, but it must not modify them.
  - Visitor approval through ElevenLabs `onMCPToolApprovalRequest` stays. It is not a wrapper.
- **Don't overcomplicate.** Before you write code, post a short plan listing the files you will touch, then build. The owner is tired of plans that never get applied: build what you planned.
- Copy lives **only** in `@/lib/content` (`lib/content/agentJourney.ts`). New copy is a draft. Mark it for owner review, and invent **no results, metrics or testimonials**.
- Don't edit `app/globals.css` (append-only), `ScrollDirector.tsx`, `CanvasProvider.tsx` or `scroll-store.ts` without asking.
- Don't hand-edit `components/webgl/kit/cato/timmy-core.js`. It is generated. Use its API (`timmy-core.d.ts`): `play`, `scrub`, `release`, `beat`, `viseme`, `moves()`, `duration()`, `isLoop()`.
- `useFrame`: no allocations (reuse module-level temporaries) and no store subscriptions in render. Use the existing global Bloom; don't add a second EffectComposer. Keep draw calls under ~60.
- Reduced motion: snap to each stop, skip travel and pen animation, and show the finished visuals.

## 2. The tour (what to build)
Cato **leads with confidence** ("not wishy-washy") and qualifies the visitor as a lead throughout.

Opening, before stop 1, Cato asks three things:
1. What type of business the visitor runs.
2. What it does.
3. Its biggest headache.

He then picks one of **four business stories**: `enterprise`, `startup`, `family` (small family business) or `solo` (sole proprietor). Every story visits all nine stops.

The stories are a labelled, illustrative mock case study. Show a visible label such as "Illustrative example, not a real client".

### Stop order (exactly 9)
| # | id (new) | Capability |
|---|---|---|
| 1 | `video-call` | Video call (Telnyx `CreateRoom` via MCP `execute`) |
| 2 | `music` | Music (`generate_music` / `generate_sound_effect` client tools → `app/api/music/route.ts`, `DjTrack.tsx`) |
| 3 | `asset-gen` | Image / video / asset generation (`generate_image`, `generate_video`) |
| 4 | `seo-social` | SEO & social |
| 5 | `crm-automation` | CRM / work automation |
| 6 | `implementations` | Implementations & fine-tuning |
| 7 | `lead-support` | Lead gen & customer support |
| 8 | `knowledge` | Knowledge bases / tooling / protocols |
| 9 | `generative-ui` | Generative UI: the finale on the big screen |

### Transitions (stop → next)
| From → To | Move |
|---|---|
| 1 → 2 | dive |
| 2 → 3 | run sideways |
| 3 → 4 | shoe-jet flight |
| 4 → 5 | bungee |
| 5 → 6 | vault |
| 6 → 7 | glide / swing |
| 7 → 8 | swing / spiral |
| 8 → 9 | land, turn, pull the screen open |

**Dive and bungee must never be adjacent.** The current `journeys` array in the scene has them adjacent, so fix it.

### Timing
- Travel: **~0.55 s**, steering-driven.
- Scroll follow in `bus.ts` `goToStop`: **0.55 s**. Today it is `5.2`; the scene's `FALL_SECONDS` is `6`.
- If dive or bungee reads as a flash at 0.55 s, give those two ~1 s.
- Text fade: **0.12 s**. All of a stop's copy appears **at once**, with no stagger, so drop the staggered `Reveal` delays on stops.
- **8 s minimum hold** on each stop's heading and blurb, enforced in **page code, not the prompt**.
  - In `goToStop`, if less than 8 s has passed since arrival, queue the target and fire it when the hold ends.
  - The Next button and the voice `next_stop` tool both go through this path.
- Pen draw: about 0.3 s per logo, with several pens drawing at once.

### Finale (stop 9)
Cato lands, turns, and pulls open a large screen. The screen hosts the existing `components/mcp-app/PrefabView.tsx`, unmodified, showing what `generate_prefab_ui` renders for the visitor's story.

Optional and **only if the owner confirms**: also host AI Elements **WebPreview**.
- It is not installed. Only `components/ai-elements/jsx-preview.tsx` exists.
- Adding it means `npx ai-elements@latest add web-preview`, which copies source into `components/ai-elements/`. Ask before you run it in case it pulls in new packages.
- `next.config.mjs` sets no `X-Frame-Options` or `frame-ancestors`, so our own pages can be framed. External sites may refuse.

**Open decision, ask the owner:**
- The finale's "bare minimum" is undefined.
- The earlier local-search finale spec is the fallback option. Don't build it unasked:
  1. Map.
  2. Top 5 results.
  3. Visitor picks 3.
  4. Tabbed profiles with proactive person-search.

## 3. Motion: simplest approach
- Keep the per-transition `THREE.CatmullRomCurve3` paths in `AiAgentSystemsScene.tsx` (`stopPositions`, `journeys[].via`). Rename and reorder the kinds to match §2.
- Add **Reynolds steering** on top. Use only seek, arrive, path-follow and wander (idle sway). Reference: https://www.red3d.com/cwr/steer/gdc99/
  - Path-follow: advance `u` along `path.getPointAt(u)`.
  - Arrive: slow the approach near the end.
  - Smooth position and look with `THREE.MathUtils.damp`.
  - **Body lean comes from acceleration**: take velocity from the previous frame, project the acceleration onto the body's right and forward axes, then map that to roll and pitch.
- **Yuka is rejected** (new dependency), so do the vector math inline.
- Drive poses by **distance travelled**, not by the clock:
  - Use `core.scrub(move, distance / pathLength)` during travel.
  - Use `core.play(id)` at the stops.
  - Map moves per transition: dive `jump` + `flip`, run `run`, jet `jump` + a jet pose, bungee `jump` + `cheer`, vault `kungfu` + `flip`, glide/swing `spin`, spiral `spin`.
- `bus.ts` `setFallState` / `catoBus.falling` stay the contract between the DOM and the scene.

## 4. Visuals: pen-drawn, line → fill → 3D
Every element in a stop (logos, icons, frames):
1. Draws as a **line of light**.
2. **Fills**.
3. **Lifts into 3D**.

Pen feel:
- The pen slows on corners and lifts between shapes.
- Lines "dry" and fade once drawn.
- The pen tip glows bright enough to catch the global Bloom.

Simplest implementation, with installed libraries only:
- Parse SVGs with `SVGLoader` (`three/examples/jsm/loaders/SVGLoader.js`).
- **Line:** `SVGLoader.pointsToStroke` gives a u-along-path attribute for a shader that does `if (vU > uDraw) discard;`.
  - Alternative: drei `<Line>` (three-stdlib `Line2` / `LineMaterial`) with `dashed`, `dashSize = gapSize = length`, and an animated `dashOffset`.
  - To slow on corners, step `uDraw` by arc length, scaled down where the curvature is high.
- **Fill:** `SVGLoader.createShapes(path)` → `ShapeGeometry`, with the opacity fading in.
- **3D:** the same shapes → shallow `ExtrudeGeometry` (`depth` ≈ 0.04–0.08, small bevel), with `scale.z` animated 0 → 1.
- Pen tip: one small emissive sprite per pen, colour above 1.0 so it blooms.

**Colour spectrum** for lines and glow, in order across the tour:
`['#7FD8E6','#2E4BFF','#0A1890','#6B2FD6','#8B5CF6','#3F2A9E','#7A2E6E']`
(baby blue/teal → blue → navy → purple → violet → indigo → plum).
**Logo fills keep their official brand colours.**

### Logos: official SVGs only
- Put them in `public/logos/<slug>.svg`.
- Record each logo's source URL in `public/logos/SOURCES.md`.
- Use Simple Icons (https://simpleicons.org) or the brand's press kit. Don't redraw or alter the marks.
- You may fan the downloads out to subagents.

| Group | Logos |
|---|---|
| CRM / CX | Zendesk, HubSpot, Salesforce, Zoho, Intercom |
| Work tools | Jira, Asana, Linear, ClickUp |
| Model providers | Perplexity, Anthropic, OpenAI, Mistral, xAI |
| Fine-tuning | Hugging Face, Unsloth, Axolotl |
| Knowledge bases | Notion, Confluence, Guru, SharePoint |
| Protocol labels (text, not logos) | MCP, A2A, Agent Skills |

## 5. Files to touch
- `lib/content/agentJourney.ts`
  - Replace the 9 stops with §2's ids and order.
  - Add `stories: Record<'enterprise'|'startup'|'family'|'solo', string>` per stop, plus a `logos: string[]` slug list and an illustrative label.
  - Draft the copy and flag it for owner review.
- `lib/content/journeyLayout.ts`: `JOURNEY_STOP_VH` must still match `.aas-stop` `min-height` in `journey.css`.
- `components/webgl/kit/cato/bus.ts`
  - Add `catoBus.story` and `setStory()`.
  - `goToStop`: duration 0.55 s, plus the 8 s hold queue.
- `components/webgl/scenes/capabilities/children/AiAgentSystemsScene.tsx`
  - Reorder and rename the transitions.
  - Add steering and lean.
  - Replace `FALL_SECONDS`.
  - Add the stop-9 screen pull.
- New `components/webgl/kit/cato/PenDrawing.tsx`: one reusable SVG → line → fill → extrude component.
- `app/capabilities/ai-agent-systems/page.tsx`
  - Render the story line from `catoBus.story` through a small client child that subscribes with `subscribeCato`.
  - Render the 0.12 s all-at-once fade.
  - Add the finale screen container that hosts `PrefabView`.
- `app/capabilities/ai-agent-systems/journey.css`: fade, screen-pull panel, story label.
- `app/capabilities/ai-agent-systems/CatoVoice.tsx`
  - Add a `set_story` client tool next to `next_stop` / `previous_stop` / `go_to_stop`.
  - Update `resolveStopParam` for the new ids.
- `agent/cato-elevenlabs-system-prompt.md`: rewrite it (see §6), then push it to the live agent.
  - The agent ID is `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` in `.env.local`.
  - Push through the `elevenlabs` MCP or `PATCH /v1/convai/agents/{agent_id}`. Check the shape in `elevenlabs.json` with a script; don't read the whole file.
  - Register the `set_story` client tool on the agent the same way.

## 6. Cato's system prompt (rewrite)
- Give Cato **the points to hit, in order**: the opening qualification, then per stop the capability and how it solves this story's headache, then the lead ask. **Don't script his lines.**
- Tone: confident, decisive, concise. Qualify as you go: role, size, timeline, budget signal, best contact.
- Call `set_story` after the opening, and call `next_stop` to advance. The page enforces the 8 s hold, so the prompt needn't mention timing.
- Keep the existing tool sections: Telnyx `search` / `get_schema` / `execute`, Prefab `generate_prefab_ui`, ElevenLabs flows, Perplexity, Google Calendar, and the account resources. Update the stop list to §2.
- **Music rules** (ElevenLabs Music Terms, UPGRADE_PLAN §0):
  - No artist, songwriter, song, album or label names, and no lyrics in prompts. Cato must rephrase requests like "something like Drake" into genre and mood.
  - Cato picks the genre and mood himself. The visitor never gets raw prompt access.
  - No downloads of generated tracks.

## 7. Verify (required before you report done)
- `npx tsc --noEmit` and `npm run build` pass. There's no test framework, and `npm run lint` isn't usable.
- Real-UI check with the **agent-browser** skill on `/capabilities/ai-agent-systems`:
  - Screenshots at 1440 / 768 / 390, plus reduced motion, at each of the 9 stops and in mid-transition.
  - Save them to `output/playwright/cato-tour/`.
- Measure and confirm:
  - Travel ≈ 0.55 s.
  - Copy fade 0.12 s, all at once.
  - Next is ignored or queued until 8 s have passed.
  - Dive and bungee are not adjacent.
  - Logos draw, fill, then extrude, with brand colours intact.
  - `PrefabView` renders unmodified inside the stop-9 screen.
- Report every deviation from this prompt and every open owner question.

## 8. Skills and MCP servers that help
**Skills** (load with the skill tool):
- `react-three-fiber`
- `threejs-loaders` (SVGLoader)
- `threejs-geometry` (Shape / Extrude)
- `threejs-shaders` (draw-on discard)
- `threejs-animation`
- `agents` (ElevenLabs agent config and client tools)
- `music` (Eleven Music)
- `ai-elements` (WebPreview)
- `context7-mcp` (current docs for three / drei / @elevenlabs/react)
- `agent-browser` (UI QA)
- `diagnosing-bugs` (if something regresses)

**MCP servers / docs:**
- **CodeWiki** (https://codewiki.google): repo-level docs for `mrdoob/three.js`, `pmndrs/drei`, `pmndrs/react-three-fiber`, `elevenlabs/packages`, `vercel/ai-elements`. It isn't configured as an MCP in this workspace, so use it in the browser or with webfetch.
- **elevenlabs** MCP: `https://api.us.elevenlabs.io/v1/mcp` (OAuth, configured in OpenCode). Use it to update the agent prompt and tools.
- **oubliai-telnyx** FastMCP: `https://oubli-catolabs.fastmcp.app/mcp` (repo `~/TelnyxMCP`). These are the Telnyx and Prefab tools the agent calls.
- **Context7**: library docs (skill `context7-mcp`).
- Reference URLs:
  - https://threejs.org/docs/
  - https://drei.docs.pmnd.rs/
  - https://ai-sdk.dev/elements
  - https://elevenlabs.io/docs
  - https://www.red3d.com/cwr/steer/gdc99/
  - https://simpleicons.org

Local references:
- `node_modules/three/examples/jsm/loaders/SVGLoader.js`
- `node_modules/three-stdlib/lines/`
- `node_modules/@elevenlabs/react`
- `node_modules/@modelcontextprotocol/ext-apps`
- `.agents/skills/perplexity_agent_api/`
- `elevenlabs.json` (OpenAPI spec)
