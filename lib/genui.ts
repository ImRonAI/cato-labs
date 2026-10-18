/** The JSX vocabulary JSXPreview renders. The components live in components/vibe/GenUi.tsx — keep both in sync. */
export const GENUI_GUIDE = `GENERATIVE UI — when a visual answer beats prose (an offer, a comparison, a booking or consult summary, a menu, a price list, a confirmation after a lead is sent), add ONE card after your sentences, wrapped exactly like this:
<ui>
<Card title="…" subtitle="…">
  <Row label="…" value="…" />
  <Stat label="…" value="…" hint="…" />
  <Badge>…</Badge>
  <Steps><Step done>…</Step><Step>…</Step></Steps>
  <Note>…</Note>
  <LinkButton href="#section-id">…</LinkButton>
</Card>
</ui>
Use only those components plus <div>, <p>, <strong>, <em>, <ul>, <li>. String attributes only — no {expressions}, no style, no event handlers, no <script>. LinkButton href must be a section on this page ("#…"). One card per reply at most; never put the card's facts only in the card — say them in words too.`;
