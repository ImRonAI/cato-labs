import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProactiveBubble from '@/components/kit/ProactiveBubble';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { studioSection } from '@/lib/content/studio';
import BuildSession from './_studio/BuildSession';
import './page.css';

const copy = capabilityChildren['digital-products'];

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
  title: 'Digital Products & Experiences',
  description:
    'Websites and applications treated as products — information architecture, editorial-grade interface design and Next.js engineering, built to convert and measured like a product.',
  path: '/capabilities/digital-products',
  keywords: [
    'website design and development',
    'Next.js development',
    'conversion architecture',
    'headless commerce',
    'Core Web Vitals',
    'product UX design',
  ],
});

/**
 * /capabilities/digital-products — the flagship child page.
 * Studio section: a Cato agent builds oubliai.com from one brief, writing the site's real
 * source, then opens the live site in the window (_studio/BuildSession).
 * The ten-flagship StreamSimulator lives on the homepage.
 * Section ids beyond the generic set: `studio` (owned by this page).
 */
export default function DigitalProductsPage() {
  return (
    <>
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
        {/* ---------- the three disciplines ---------- */}
        <section
          data-scene-section="feature"
          className="container-x section-y-sm"
          aria-label="What the practice covers"
        >
          <Reveal className="micro-label" delay={0}>
            The disciplines
          </Reveal>
          <div className="dp-features">
            {copy.features.map((f, i) => (
              <Reveal key={f.index} className="dp-feature" delay={0.08 + i * 0.08}>
                <span className="index-no" aria-hidden="true">
                  {f.index}
                </span>
                <h3 className="h3">{f.title}</h3>
                <p>{f.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- the studio: one brief becomes oubliai.com ---------- */}
        <section
          data-scene-section="studio"
          id="studio"
          className="container-x section-y"
          aria-label={studioSection.title}
        >
          <div className="dp-blockhead">
            <Reveal className="micro-label" delay={0}>
              {studioSection.eyebrow}
            </Reveal>
            <Reveal
              as="h2"
              className="h2"
              delay={0.08}
              style={{ marginBlock: '18px 22px' }}
            >
              <ProximityType>{studioSection.title}</ProximityType>
            </Reveal>
            <Reveal className="lede" delay={0.16}>
              {studioSection.lede}
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <BuildSession />
          </Reveal>
        </section>

        {/* ---------- the work ---------- */}
        <section
          data-scene-section="detail"
          className="container-x section-y"
          aria-label={copy.detail.title}
        >
          <div className="dp-detail">
            <div>
              <Reveal className="micro-label" delay={0}>
                {copy.detail.eyebrow}
              </Reveal>
              <Reveal
                as="h2"
                className="h2"
                delay={0.08}
                style={{ marginBlock: '18px 22px' }}
              >
                {copy.detail.title}
              </Reveal>
              <Reveal as="p" className="body-lg" delay={0.16}>
                {copy.detail.body}
              </Reveal>
            </div>
            <Reveal delay={0.22}>
              <ul className="tag-list dp-detail__tags" aria-label="Deliverables">
                {copy.detail.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      </ChildPageShell>

      {/* the agent that speaks first — invites visitors to watch the oubliai.com build */}
      <ProactiveBubble
        agentName="Azure"
        message="I design the flagships. Just below, watch one brief become oubliai.com: the plan, the 3D world, the code and the deploy. Then step inside the live site."
        ctaLabel="Watch the build"
        ctaHref="#studio"
        triggerSection="feature"
        avatarHue="#2e4bff"
      />
    </>
  );
}
