# Cato Labs — "Next Level" Upgrade Plan (v1, draft for owner approval)

Status: **PLAN ONLY — no code has been changed.** It continues the 2026-10-17 session in `LastAgent.txt`, which stopped
at a usage limit before writing its plan. Inputs: three completed exploration reports (agents page and integrations,
WebGL inventory of all 43 routes, design system and contracts) and that session's API research.

---

## 0. Decisions so far, and open questions

| # | Topic | Status |
|---|---|---|
| D1 | Where Rivet's journey lives | ✅ **`/capabilities/ai-agent-systems`** (owner). No new route. Keeps the URL's SEO. |
| D2 | Email provider | ✅ **Telnyx Email** (owner: "Yes they do"). Confirmed: `POST https://api.telnyx.com/v2/email_messages` (Bearer key; `from` must be a verified sender domain; `sandbox_mode` for testing). The last session was wrong to say Telnyx has no email API. Nothing else is needed (no Resend, no Supabase). |
| D3 | Abuse protection for outbound actions | ⚠️ Owner answered **"Alert and Approve."** That could mean two things — see Q2. |
| Q1 | Agent's name | ❓ Not answered. The file is `Timmy.html`; the character inside is called **Rivet**; the page's current bubble agent is **Meridian**. |
| Q2 | "Alert and Approve": who approves? | ❓ (a) **Visitor approves** in an on-page dialog (ElevenLabs `onMCPToolApprovalRequest`). This alone doesn't stop toll fraud or harassment, because the visitor is the possible abuser. (b) **Cato staff are alerted** (SMS/email to Tim) and approve before the action runs. Safe, but slow for a live demo. (c) **Both** (recommended): the visitor confirms on the page, then actions to any number/email other than the visitor's own verified one need staff approval. Server caps apply in every case. |
| Q3 | New dependencies (CLAUDE.md says ask first) | ❓ `@elevenlabs/react` (voice agent SDK), `@google/genai` (Lyria RealTime, server-side only). Optional: vendor HeadAudio (MIT, plain files, no npm package). |
| Q4 | New marketing copy | ❓ The 9 journey sections need headlines and body text in `lib/content/capabilities.ts` (rule: copy comes from the content decks only). Should I draft it for your review? |
| Q5 | Initialise git first? | ❓ This folder is **not a git repo**. Strongly recommended before any execution wave so every change can be reviewed and rolled back. |

---

## 1. Ground truth (what exists today)

- **Agents page** = `/capabilities/ai-agent-systems` (`app/capabilities/ai-agent-systems/page.tsx`).
  - Sections: `hero → signature (280vh domino dwell) → feature → detail → persona → faq → cta`.
  - Scene: `AiAgentSystemsScene.tsx`, "The Relay": ~50 baked Rapier dominoes. It has no robot.
- **The "robot" today** = two 2D SVG faces:
  - `AgentPersona.tsx`
  - `components/kit/ProactiveBubble.tsx` ("Meridian")
  - The 3D `RobotMascot.tsx` is mounted nowhere.
- **Timmy.html** (`~/Downloads`, 3,295 lines, 207 KB) is a self-contained procedural **SVG** robot rig named "Rivet":
  - Software 3D projection, IK, about 30 moves, 13 prop scenes (desk, phone call, guitar, DJ, painting…), and a HUD reasoning trace.
  - Oculus viseme mouth table: `speak()` drives it from text, and `rivet.viseme(key, v)` accepts external lip-sync.
  - Other hooks: `rivet.beat(bpm, phase)` and `rivet.play(id)`. There is also a desk/typing scene already.
  - Palette: the accent is `#FF5A1F` (the `--accent` CSS var, `defMat('accent')`, `defMat('paint')`, `rgb(255,90,31)` ×6). The LED is `#7DF3FF`.
  - Fonts it loads: Big Shoulders / IBM Plex. These must be swapped to Inter to match the site.
- **No** ElevenLabs, Lyria, WebAudio or WebSocket code exists. There is **no** lead backend either: the contact form is a `mailto:`.
- `/api/vibe-chat` already uses the Telnyx Remote MCP through the Perplexity Agent API, but it **removes tool events** before they reach the browser. So it can't drive animations.
- The WebGL canvas has `pointer-events: none`. Interactive characters must live in the DOM, which suits Rivet because he is SVG.

## 2. Architecture for Rivet (the agents page)

### 2.1 Rendering layer
- Port Timmy.html into `components/rivet/` as a client module. The rig and props become a TS module, and the stage is an `<svg>` in a fixed overlay above the persistent canvas.
  - Remove the dev UI (key dock, fps HUD).
  - Keep the reasoning-trace HUD, because it becomes the "thinking" layer.
- **Recolour (owner spec):** primary accent `#FF5A1F` → **Cato electric blue `#2e4bff`** (the token family; `#4536f9` from `UI.png` is the only "blurple" anywhere and fails the site's own violet band). The previous **orange surfaces → white `#ffffff`**. Shell, panel and graphite stay. LED `#7DF3FF` → `--blue-300 #b9c9ff` so everything stays blue-only (PLAN.md rule).
- **Thought bubble:** replace the HUD card with a classic cloud bubble: a lobed SVG path plus three trailing puffs toward Rivet's head. Inter text, glass fill `rgba(255,255,255,.78)` with blur, and a `--line` hairline.
- Reduced motion: Rivet holds a static pose, and the journey falls back to normal sections with no flips.

### 2.2 Scroll journey: "the fall"
Nine stops, each a `data-scene-section`:
1. `omnichannel`
2. `entertainment`
3. `tooling`
4. `automation`
5. `frameworks` (Top frameworks & agent homes)
6. `seo-marketing`
7. `lead-gen`
8. `lead-qualify`
9. `support-compliance` (Customer support & compliance industries)

How each stop plays:
- Each stop is a dwell of about 180vh with a sticky stage.
  - On entry, Rivet **walks** in and runs that section's move set (scroll-scrubbed: `play()` is driven by progress, not time).
  - On exit, he jumps off the ledge and **falls to the next stop with a trick**.
- **Trick rotation:** backflip, front flip, corkscrew, cannonball, starfish, superman, double twist, handspring, moonwalk-off. Shuffled once per visit with a seeded order, so **no trick repeats** along the way. Scrolling back up rewinds the same trick.
- **The camera falls with him:** the WebGL scene camera descends the same Y distance in lock-step (a new `AgentJourneyScene` replaces "The Relay"), and the SVG overlay keeps Rivet framed. The domino relay is reused as the **Process Automation** stop's set piece.
- The ScrollDirector stale-progress bug (§5, B1) must be fixed first, or stops will show the previous page's values.

### 2.3 Voice agent and lead capture: ElevenLabs Agents
- Create a new ElevenLabs agent, "Cato — Rivet". The workspace has only "Atlas — Cato Labs Brand Intake" and two blank agents, and no MCP servers yet.
- **Browser:** `@elevenlabs/react` (`ConversationProvider` / `useConversationControls`). The session token is minted server-side by a new `/api/agent-session` route, so the API key never reaches the browser.
- **Driving actions from events** (documented callbacks):

  | Event | Rivet does |
  |---|---|
  | `onModeChange` speaking/listening | talk / listen idle |
  | `onAgentToolRequest` / `onAgentToolResponse` | sits at the **desk** typing (native scene) |
  | `onMCPToolCall` (state `loading/awaiting_approval/success/failure`), by tool | **phone call** scene / **texting** / **email** / **fax** / **video call** |
  | client tools (`setMood`, `playScene`, `showSection`) | the agent can trigger moves and scroll to a stop |

- **Lip-sync (the "library or solution" requirement):**
  - **Primary:** ElevenLabs `onAudioAlignment` gives `chars[]`, `char_start_times_ms[]` and `char_durations_ms[]`. These map to Rivet's existing text→viseme table, so the mouth matches the actual words with no extra library. ⚠️ Need to verify that alignment is emitted on the chosen connection type (WebSocket vs WebRTC) before committing.
  - **Fallback:** vendor **HeadAudio** (met4citizen, MIT). It's an AudioWorklet that turns the output audio into Oculus visemes. Feed it to `rivet.viseme()` with a `DelayNode` of about 100 ms.
- **"Proactive after ~3 seconds":** browsers block audio playback and microphone access until the user interacts with the page (autoplay policy). So at 3 s Rivet waves, says his greeting in the thought bubble, and shows a **"Talk to Rivet"** button. One tap starts the voice session, and the agent opens with `firstMessage`. Starting voice without a tap isn't possible on Chrome or Safari.
- **Leads:** an ElevenLabs server webhook tool `saveLead` posts to `/api/lead`. The server validates the fields, emails `hello@catolabs.com` via **Telnyx Email**, and texts the team. Persistence is staff email/SMS only, unless you want a store.

### 2.4 Telnyx Remote MCP (calls / SMS / fax / video / email)
- Register `https://api.telnyx.com/v2/mcp` as an **ElevenLabs MCP server**:
  - `transport: STREAMABLE_HTTP`
  - `secret_token` = Telnyx key stored as a workspace secret (Telnyx docs: `Authorization: Bearer <key>`)
  - `approval_policy: require_approval_all`, which fits "Alert and Approve"
  - `pre_tool_speech: force`, so Rivet says what he's about to do
- Doing this in ElevenLabs means tool events reach the browser natively. The `/api/vibe-chat` filtering problem doesn't apply.
- Telnyx's MCP is generic: `list_api_endpoints` / `get_api_endpoint_schema` / `invoke_api_endpoint` (saved discovery in `.omo/evidence/widget-telnyx-discovery.json`). Rivet's action is chosen by inspecting which endpoint is invoked (`calls` / `messages` / `faxes` / `rooms` / `email_messages`).
- **Server-side guard (required whatever Q2's answer is):** don't give the agent raw `invoke_api_endpoint` with no limits. Wrap outbound actions in our own webhook tools (`callMe`, `textMe`, `emailMe`, `faxMe`, `videoRoom`) that do these things:
  - Enforce per-IP, per-destination and daily caps.
  - Validate destinations and block premium/international numbers.
  - Apply the approval flow.
  - Call Telnyx REST.
  
  The MCP itself then only does read-only discovery. This is the main abuse control.
- **Prerequisites on your Telnyx account:**
  - A voice-enabled number and connection.
  - A messaging profile with **10DLC brand and campaign registration** (US A2P SMS is blocked without it).
  - A fax-capable connection, plus a public PDF `media_url`.
  - A Video Rooms API key.
  - A **verified email sender domain** (e.g. `catolabs.com`).

### 2.5 "Impressive Tooling" stop: build a tool live, check it's safe, run it
1. The visitor asks Rivet for a tool. He calls the webhook tool `buildTool`, which hits `/api/tool-forge`.
2. `/api/tool-forge` runs a **Perplexity Agent API** call with the `sandbox` tool (the same pattern as `vibe-build`). It returns a single self-contained JS/HTML tool.
3. The code goes to the **Perplexity Decisions API**: `POST https://api.perplexity.ai/v1/decisions`, Bearer key, model `pplx-decider-latest`, `state` = code plus request. It asks these `noul` questions:
   - `is_safe`
   - `no_network_exfiltration`
   - `no_credential_access`
   - `matches_request`
   - `no_harmful_content`
4. If every probability of "yes" is ≥ 0.9 (threshold to tune), the tool runs right there on the page inside the existing **strict-CSP sandboxed iframe** (`components/vibe/LiveCanvas.tsx` + `canvas-runtime.ts`). Rivet celebrates.
5. Otherwise the tool returns a text result, "I can't implement that tool for safety reasons — want X instead?", and Rivet speaks it and offers an alternative.
6. Pricing is $0.02 per 1M input tokens with free output; rate limit 10 req/s per org. Uses the existing `PERPLEXITY_API_KEY`.

### 2.6 "Entertainment & Leisure" stop: music matched to the moves
- **Lyria RealTime** (`@google/genai`, `models/lyria-realtime-exp`, experimental):
  - Instrumental only, 48 kHz stereo PCM chunks, steered with `setWeightedPrompts` and `bpm`.
  - **Ephemeral tokens currently fail with Lyria** (open Google forum thread), so it needs a **server-side relay**. Next route handlers can't hold a WebSocket open, so this means a small Node relay or an edge WebSocket service. ⚠️ An infrastructure decision is needed.
- **Eleven Music** (`/v1/music`, `/v1/music/detailed/stream`, `/v1/music/plan` free, `model_id music_v2_5`): server-proxied songs with vocals, plus `with_timestamps`.
- **Genre → scene mapping:**

  | Genre | Scene |
  |---|---|
  | electronic / techno | `dj` |
  | acoustic / folk / rock | `guitar` |
  | jazz / lo-fi | the chill scene |
  | anything with vocals | sing (sung visemes with Eleven timestamps) |

- `rivet.beat(bpm)` locks his moves to the generated tempo.

## 3. Site-wide "heighten, don't change"
The design system stays exactly as it is (paper / ink / electric blue, Inter, glass, dust). Upgrades are visual depth and scroll choreography.

| Priority | Routes (current score /10) | Direction |
|---|---|---|
| P0 | **Regions** — orange-county 5, san-francisco 5, napa 4, phoenix 4, salt-lake-city 4 | Each gets a real scroll-scrubbed set piece in a `moment` dwell, like the strong five. OC: a swell builds into a barrel the camera rides through. SF: the camera climbs out of the fog over the bridge and a cable car crests the hill. Napa: dawn mist burns off the rows, then the vines grow in. Phoenix: a heat-haze sunrise behind Camelback, then monsoon lightning reveals the grid. SLC: an alpenglow sweep with the camera rising up the Wasatch face to the spire. |
| P0 | Regions — palm-springs 8, palm-desert 7, indio 7, san-bernardino 6, big-bear 8, LA 8 | Heighten: a sky gradient pass, a cinematic camera path through each dwell, a hero-to-moment handoff, and a shared "arrival" title card. |
| P1 | Weak capability pages: growth-distribution 3, digital-products 4, brand-creative 4, customer-experience 6, knowledge-architecture 5 (its dwell plays nothing) | A new hero set piece for each, and wire up the dead dwells. |
| P1 | Industries scoring 3–4 (ecommerce, professional, health, fitness, hospitality, real-estate, home-services, dental, saas, architecture) | Give each a `moment` dwell. Four already mount a `moment` rail that their scenes ignore. |
| P2 | Strong pages (home 9, contact 9, approach 8, blog 8) | Polish only: a tone-mapping fix, the intro-from-light pass, and transitions. |

Conventions every scene workstream follows (CONTRACTS.md):
- `SceneLightRig`
- No allocations in `useFrame`
- `q.particles` / `q.animate`
- Fewer than ~60 draw calls
- No second EffectComposer
- Copy only from `lib/content`

## 4. Execution waves (parallel subagents)
Each wave ends with `npm run build`, `tsc`, and Playwright screenshots at 1440 / 768 / 390 plus reduced-motion. Each agent gets one lane (its route dir, scene file and page CSS), following PLAN.md's model.

| Wave | Agents (in parallel) | Lane |
|---|---|---|
| 0 | 1 — me | git init (Q5), core fixes B1–B4 (each needs your approval), approved dependencies, content deck copy (Q4) |
| 1 | A: Rivet port + recolour + bubble · B: ElevenLabs agent + session/lead/tool routes + Telnyx guards · C: journey scene + scroll choreography | `components/rivet/*` · `app/api/agent-*`, `app/api/lead` · `scenes/capabilities/children/AiAgentSystemsScene.tsx`, page |
| 2 | D: tool-forge + Decisions · E: music (Lyria relay + Eleven Music) · F: lip-sync integration and QA | own API routes and modules |
| 3 | 5 region agents (one per weak region) + 1 heighten agent for the strong six | `app/regions/<slug>`, `scenes/regions/children/<Slug>Scene.tsx` |
| 4 | 3 agents: capabilities P1, industries P1 (two halves) | per route |

**Template for subagent prompts.** Every brief includes:
- Role and the "heighten, not change" mandate.
- The required reading: CLAUDE.md, CONTRACTS.md, this plan's section.
- Its file lane: what it may and may not touch.
- The scroll and scene contract, with exact section ids and the dwell math.
- Performance budgets.
- Acceptance criteria: one written "money shot" frame, the scroll beats in percentages, reduced-motion behaviour, and build green.
- Required evidence: screenshots, plus a report of every place it deviated.
- Never invent copy; request it.

## 5. Bugs found during the read-only exploration (not yet fixed)
Each of these was inferred from reading the code. Per your rule, a fix only goes in once it's validated against the library's docs or source, and you've approved it.

- **B1** — `scroll-store` never resets `sections`, and a new ScrollTrigger below the fold doesn't fire. Pages inherit stale progress, so region set pieces can start "already played". Blocks §2.2 and §3.
- **B2** — Tone mapping differs between tiers. The postprocessing composer forces `NoToneMapping`, while the low tier uses ACES, so colours shift between devices.
- **B3** — Bloom threshold 0.86 vs paper luminance (~0.965 linear). The background may bloom. Needs an A/B screenshot.
- **B4** — The GrowthDistribution hotspot y-axis is flipped (`_proj.y*0.5+0.5` vs ProximityType's `0.5-_proj.y*0.5`), and it allocates an object per update.
- **B5** — On mobile, `signature.css` sets 240vh, but `signature.ts` assumes 280vh. The ops dwell has the same kind of drift.
- **B6** — Five 280vh dwells play nothing (dental, fitness, saas, architecture, knowledge-architecture).
- **B7** — Lenis isn't disabled under `prefers-reduced-motion`.
