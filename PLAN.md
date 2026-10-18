# CATO LABS — Site Expansion Plan (v2, owner-amended)
*The swarm executes against this document. v1 constraints unchanged: blue-only
visual spectrum, luminous minimalism, SEO-at-birth, one persistent canvas,
radical transparency on browser data.*

## Sitemap (38 new URLs)

```
/work                                portfolio index (case cards)
/work/resting-art                    detail — the substantiated luxury-furniture engagement

/capabilities/strategy-transformation
/capabilities/ai-agent-systems       ★ RobotMascot + "Your Cato Agent" generator
├─ /capabilities/ai-agent-systems/voice-ai
├─ /capabilities/ai-agent-systems/generative-ui
├─ /capabilities/ai-agent-systems/customer-experience
└─ /capabilities/ai-agent-systems/knowledge-architecture
/capabilities/digital-products       ★ Stitch-style stream + vibe-code + proactive bubble
/capabilities/brand-creative
/capabilities/growth-distribution    ★ revenue chart + partnerships + social particle logos
/capabilities/operations-automation

/industries (index + 12)
ecommerce-retail · professional-services · hospitality · real-estate ·
health-wellness · home-services · legal · financial-services ·
dental-med-spa · fitness-studios · saas-startups · architecture-interior-design

/regions (index + 11)
palm-springs · palm-desert · indio          (Coachella Valley mains)
san-bernardino · big-bear · los-angeles · orange-county ·
san-francisco · napa · phoenix · salt-lake-city

/blog                              index — design showcase (entries as designed cards)
/blog/the-anatomy-of-delight       ONE sample article — demonstrates the reading
                                   experience (owner writes real articles later)
```

Nav gains **Work**; footer columns regroup (Practice / Capabilities / Industries / Regions).

## Waves (execution order)

- **Wave 0** — me: lazy scene registry (all 38 routes pre-wired to scene files),
  BlueSpectrum tokens + glass presets, ChildPageShell, placeholders. Agents (3,
  parallel): Kit A visuals (RobotMascot, ProximityType, ParticleSculpture,
  SkylineSampler), Kit B interactions (StreamSimulator, ChartDraw, SignalPanel,
  ProactiveBubble), Copy deck (`lib/content/*` for every page incl. nav/footer).
- **Wave 1** — 7 agents: six capability children + the four agent-system
  grandchildren (split across two agents).
- **Wave 2** — 6 agents: portfolio (1 agent) + industries index + 11 of 12
  industry children spread across 5 agents.
- **Wave 3** — 6 agents: 12th industry + regions index + 11 region children.
- **Wave 4** — 2 agents: blog showcase + SEO mesh (sitemap, robots, llms.txt,
  FAQPage/Service/Article/Breadcrumb schema everywhere, internal-link audit).

Build + screenshot validation after every wave. File ownership per agent:
its route dir + its scene file(s) + its page CSS. Generic child-page section
ids: `hero`, `feature`, `detail`, `faq`, `cta` (+ page-specific extras owned
by that page's agent).
