import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import StreamSimulator from '@/components/kit/StreamSimulator';
import ProactiveBubble from '@/components/kit/ProactiveBubble';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { aurelleScript, studioAgents, aurelleBrand } from './buildScript';
import VibeCoder from './VibeCoder';
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
 * Studio section: four agents build AURELLE live (StreamSimulator).
 * Vibe section: three questions → a generated sketch of the visitor's own.
 * Section ids beyond the generic set: `studio`, `vibe` (owned by this page).
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

        {/* ---------- the studio: watch a site being born ---------- */}
        <section
          data-scene-section="studio"
          className="container-x section-y"
          aria-label="The Studio — watch a site being born"
        >
          <div className="dp-blockhead">
            <Reveal className="micro-label" delay={0}>
              The Studio
            </Reveal>
            <Reveal
              as="h2"
              className="h2"
              delay={0.08}
              style={{ marginBlock: '18px 22px' }}
            >
              <ProximityType>Watch a site being born.</ProximityType>
            </Reveal>
            <Reveal className="lede" delay={0.16}>
              This is how a Cato flagship is built: strategy, design, engineering and
              discoverability working the same canvas at the same time. Choose from ten
              bespoke HTML flagships below and watch four agents stream the source and render
              the live site in real time.
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <StreamSimulator
              script={aurelleScript}
              agents={studioAgents}
              brand={aurelleBrand}
              loop={false}
            />
          </Reveal>
        </section>

        {/* ---------- the sketch engine: vibe-code yours ---------- */}
        <section
          data-scene-section="vibe"
          id="vibe"
          className="container-x section-y"
          aria-label="Vibe-code yours"
        >
          <div className="dp-blockhead">
            <Reveal className="micro-label" delay={0}>
              The Sketch Engine
            </Reveal>
            <Reveal
              as="h2"
              className="h2"
              delay={0.08}
              style={{ marginBlock: '18px 22px' }}
            >
              <ProximityType>Vibe-code yours.</ProximityType>
            </Reveal>
            <Reveal className="lede" delay={0.16}>
              Describe what you&rsquo;re building. Your agent researches, designs
              and writes the website on a live canvas. Follow each element as it
              takes shape, then download the files or start another build.
            </Reveal>
          </div>
          <VibeCoder />
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

      {/* the agent that speaks first — invites visitors to the sketch engine */}
      <ProactiveBubble
        agentName="Azure"
        message="I design the flagships. One brief — your own words, as long as you like — and I will research your market and sketch yours live, right here on the page."
        ctaLabel="Sketch my site"
        ctaHref="#vibe"
        triggerSection="studio"
        avatarHue="#2e4bff"
      />
    </>
  );
}
