# CATO LABS — Build Contracts

This document is the law for every agent working on this codebase.
Read it fully before writing a line. Consistency is king.

## What this site is

Next.js 15 (App Router) + TypeScript + react-three-fiber site for **Cato Labs**,
an AI-native strategy & implementation consultancy. One **persistent WebGL
canvas** sits behind every route; DOM content scrolls above it. The brand:
luminous minimalism — paper-white space (`--paper #fafbfe`), ink type
(`--ink #0a0c12`), electric blue (`--blue #2e4bff`), refractive glass, fine
particle dust. Boldly minimal. Generous white space. Epic but simple.

## Hard rules

1. **Copy comes from `@/lib/content` only.** Never invent new marketing copy;
   import `home`, `capabilitiesPage`, `approachPage`, `contactPage`,
   `practices`, `approachStages`, `site`, `footer`.
2. **No new dependencies.** Installed: three, @react-three/fiber,
   @react-three/drei, @react-three/postprocessing, gsap (+ScrollTrigger),
   lenis, zustand, next, react.
3. **Styling:** use the classes in `app/globals.css` (`.display-1/2`, `.h2`,
   `.lede`, `.micro-label`, `.container-x`, `.section-y`, `.btn`, `.glass-card`,
   `.tag-list`, `.rule`, `.index-no`, `.scrim`, `.reveal`…) plus inline styles
   for one-off layout. Page-specific CSS lives in a route-scoped stylesheet
   (e.g. `app/home.css`, `app/capabilities/capabilities.css`) imported by that
   page — never edit `app/globals.css`.
4. **TypeScript strict must pass.** `npm run build` must stay green.
5. **'use client' correctly.** Pages stay server components (for metadata)
   unless they need hooks — then extract a small client child instead of
   flipping the page. Scene files are always client components.
6. **Accessibility/SEO:** exactly one `<h1>` per page, semantic sections with
   `aria-label` where useful, real DOM text (never text baked into canvas),
   alt text on any img.

## The scroll ↔ scene contract

`components/webgl/ScrollDirector.tsx` tracks every element carrying
`data-scene-section="<id>"` and publishes its 0→1 viewport progress to the
zustand store. Scenes read it transiently inside `useFrame`:

```ts
import { getSectionProgress, sectionRange, smooth, pointer } from '@/components/webgl/scroll-store';

useFrame((state, delta) => {
  const hero = getSectionProgress('hero');           // 0..1
  const push = smooth(sectionRange(hero, 0.2, 0.9)); // remap+clamp+ease
  // mutate refs/uniforms/camera here — never setState
});
```

- `pointer.x / pointer.y` — normalized mouse (-1..1), always available.
- `useQuality()` from `@/components/webgl/lib/quality` returns
  `{ dpr, particles, bloom, animate, compact }`. Scale particle counts by
  `q.particles`; when `q.animate === false` (reduced motion) render a static
  composition.
- **Never subscribe to the store in render** — transient reads only.

### Section ids (fixed)

| Route | ids |
|---|---|
| `/` | `hero`, `manifesto`, `practices`, `approach-teaser`, `cta` |
| `/capabilities` | `cap-hero`, `strategy`, `agents`, `product`, `brand`, `growth`, `operations`, `cap-outro` |
| `/approach` | `app-hero`, `evidence`, `truth`, `decision`, `implementation`, `tradeoff`, `app-outro` |
| `/contact` | `contact-hero`, `contact-form` |

Capability sections ALSO carry `id={practice.id}` for anchor deep-links.

## Scene authoring rules

Scene components render inside the shared `<Canvas>` (32° fov, camera at
`[0,0,9]`, fog `#fafbfe` 14→30). They are plain R3F component trees:

- Always include `<SceneLightRig />` (`scenes/shared/SceneLightRig`) — the
  shared procedural studio environment. Do not add `<Environment>` HDR files.
- Compose shared primitives: `scenes/shared/ParticleField` (blue dust),
  `scenes/shared/GlassCluster` (refractive shard monolith),
  `@/components/webgl/lib/materials` → `<GlassMaterial kind="crystal|pane|core"/>`
  (physical transmission + dispersion).
- You MAY add your own geometries, shaders (GLSL strings), lines, instancing —
  encouraged for the wow — but keep the palette: white/ice-blue/electric blue,
  and keep motion slow, confident, eased.
- Camera: mutate `state.camera` in useFrame with lerp (`* 0.05` damping) and
  `lookAt`. Scenes own the camera while mounted.
- Perf: no allocations in useFrame (reuse Vector3/Color temp objects),
  instancing for >100 meshes, scale counts by `q.particles`, keep draw calls
  < ~60. Postprocessing (Bloom+Vignette) already runs globally — do not add
  another EffectComposer.
- Intro: give your scene a mount animation (useRef start time + elapsed in
  useFrame, or gsap on uniforms) — routes cut under a light veil, the scene
  should feel like it assembles out of light.

## DOM choreography

- `<Reveal delay={0.1}>…</Reveal>` — rise + de-blur on enter.
- `<Reveal line>` — masked-line reveal for each headline line (wrap each line).
- `<CtaButton href label variant />` from `@/components/ui/Magnetic`.
- Headlines: `display-1` for page heroes, `display-2`/`h2` for sections.
- Every section eyebrow uses `.micro-label`.
- Sections that read over busy GL may wrap copy in `.scrim` or use
  `.glass-card` / `.scrim-hard` — sparingly; white space is the luxury.

## File ownership (do not edit outside your lane)

- Core (do NOT touch): `app/layout.tsx`, `app/globals.css` (append-only),
  `components/webgl/CanvasProvider.tsx`, `ScrollDirector.tsx`,
  `scroll-store.ts`, `lib/quality.ts`, `lib/materials.tsx`,
  `scenes/shared/*`, `components/ui/*` (you may use, not modify),
  `lib/content.ts` (request changes via your report, don't edit).
