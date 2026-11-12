import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import { STUDIO_COPY } from '@/lib/content/overhaul/cap-ops';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import AutomationStudio, {
  MachineStageHud,
} from './_studio/AutomationStudio';
import './page.css';

const copy = capabilityChildren['operations-automation'];

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Capabilities', path: '/capabilities' },
    { name: copy.crumbLabel, path: `/capabilities/${copy.slug}` },
  ],
  service: {
    name: copy.crumbLabel,
    description: copy.lede,
    url: `/capabilities/${copy.slug}`,
  },
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Operations & Automation',
  description:
    'Cato Labs operations & automation: support operations & helpdesk design, workflow automation, system-to-system integration, SOPs & escalation logic and support analytics. Support, workflows and measurement redesigned as one system — so the business runs on rails and growth stops meaning headcount.',
  path: '/capabilities/operations-automation',
  keywords: [
    'operations consulting',
    'workflow automation',
    'business process automation',
    'helpdesk design',
    'support operations',
    'system integration',
    'support analytics',
    'retention automation',
    'SOP design',
    'AI operations',
  ],
});

/**
 * /capabilities/operations-automation — scale without scaling headcount.
 * Scene: OperationsAutomationScene ("The Glass Sorting & Dispatch Line").
 * Section ids are CONTRACT: hero (shell), machine, studio, feature, detail, faq/cta (shell).
 */
export default function Page() {
  return (
    <ChildPageShell
      crumbs={[
        { label: 'Capabilities', href: '/capabilities' },
        { label: copy.crumbLabel },
      ]}
      eyebrow={copy.eyebrow}
      titleLines={copy.titleLines}
      lede={copy.lede}
      faq={copy.faq}
      cta={copy.cta}
    >
      <JsonLd data={jsonLd} />

      {/* ---------- machine — 5-station glass sorting line showcase ---------- */}
      <section
        data-scene-section="machine"
        className="ops-machine"
        aria-label={STUDIO_COPY.machineTitle}
      >
        <MachineStageHud />
      </section>

      {/* ---------- studio — THE AUTOMATION STUDIO signature experience ---------- */}
      <section
        data-scene-section="studio"
        id="studio"
        className="container-x ops-studio-section"
        aria-label={STUDIO_COPY.title}
      >
        <div className="ops-studio-head">
          <Reveal className="micro-label">{STUDIO_COPY.eyebrow}</Reveal>
          <Reveal as="h2" className="h2 ops-studio-head__title" delay={0.08}>
            <ProximityType>{STUDIO_COPY.title}</ProximityType>
          </Reveal>
          <Reveal as="p" className="lede" delay={0.14}>
            {STUDIO_COPY.lede}
          </Reveal>
        </div>
        <AutomationStudio />
      </section>

      {/* ---------- feature — the three disciplines ---------- */}
      <section
        data-scene-section="feature"
        className="container-x ops-feature"
        aria-label="The practice"
      >
        <Reveal className="micro-label">The practice</Reveal>
        <Reveal as="h2" className="h2 ops-feature__title" delay={0.08}>
          <ProximityType>From handoffs to rails.</ProximityType>
        </Reveal>
        <div className="ops-feature__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="ops-feature__block">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 ops-feature__block-title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="ops-feature__body" delay={0.16}>
                {f.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x ops-detail"
        aria-label={copy.detail.title}
      >
        <div className="ops-detail__card">
          <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
          <Reveal as="h2" className="h2 ops-detail__title" delay={0.08}>
            {copy.detail.title}
          </Reveal>
          <Reveal as="p" className="lede ops-detail__body" delay={0.16}>
            {copy.detail.body}
          </Reveal>
          <ul className="ops-detail__bullets">
            {copy.detail.bullets.map((b, i) => (
              <Reveal as="li" key={b} delay={0.1 + i * 0.05}>
                {b}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </ChildPageShell>
  );
}
