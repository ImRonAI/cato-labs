import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { regions, type RegionCopy } from '@/lib/content/regions';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import './page.css';

function regionCopy(slug: string): RegionCopy {
  const hit = regions.find((r) => r.slug === slug);
  if (!hit) throw new Error(`regions deck is missing slug: ${slug}`);
  return hit;
}

const copy = regionCopy('san-francisco');

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Regions', path: '/regions' },
    { name: copy.crumbLabel, path: `/regions/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: `AI-native consulting in ${copy.city}`,
  description: copy.lede,
  path: '/regions/san-francisco',
  keywords: [
    'AI consulting San Francisco',
    'category design & narrative',
    'agent-native products',
    'product-led web experience',
    'voice AI & generative UI',
    'technical content systems',
    'SaaS & AI startup consulting',
    'San Francisco hospitality marketing',
  ],
});

/**
 * /regions/san-francisco — buyers who read the docs.
 * Scene: SanFranciscoScene ("The Fog") — an ice-colored fog band rolls
 * through the Transamerica skyline, parting around the pyramid, while a
 * tiny cable-car marker glides along its wire on the hillside; on the
 * `angles` beat the fog thins and the skyline brightens. Hotspot
 * 'sf-skyline' rides the pyramid apex.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function SanFranciscoPage() {
  return (
    <ChildPageShell
      crumbs={[
        { label: 'Regions', href: '/regions' },
        { label: copy.crumbLabel },
      ]}
      eyebrow={copy.eyebrow}
      titleLines={copy.titleLines}
      lede={copy.lede}
      faq={copy.faq}
      cta={copy.cta}
    >
      <JsonLd data={jsonLd} />
      {/* ---------- stats — the market in numbers ---------- */}
      {copy.stats && (
        <section
          data-scene-section="stats"
          className="container-x sfr-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="sfr-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="sfr-stat">
                <Reveal className="sfr-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="sfr-stat__label" delay={0.08 + i * 0.08}>
                  {s.label}
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- angles — the market, four ways ---------- */}
      <section
        data-scene-section="angles"
        className="container-x sfr-angles"
        aria-label={`${copy.city} market angles`}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.region}
        </Reveal>
        <div className="sfr-angles__grid">
          {copy.localAngles.map((a) => (
            <article key={a.title} className="sfr-angle">
              <Reveal as="h3" className="h3 sfr-angle__title" delay={0.06}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="sfr-angle__body" delay={0.14}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three engagements ---------- */}
      <section
        data-scene-section="feature"
        className="container-x sfr-plays"
        aria-label="The engagements"
      >
        <Reveal className="micro-label" delay={0}>
          {copy.city}
        </Reveal>
        <div className="sfr-plays__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="sfr-play">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 sfr-play__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="sfr-play__body" delay={0.16}>
                {f.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- build — the six practices, mapped ---------- */}
      {copy.practiceMap && (
        <section
          data-scene-section="build"
          className="container-x sfr-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 sfr-build__title" delay={0.08}>
            Six practices, mapped to the city.
          </Reveal>
          <div className="sfr-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="sfr-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="sfr-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="sfr-build__example" delay={0.12}>
                  {p.example}
                </Reveal>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x sfr-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 sfr-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede sfr-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="sfr-detail__bullets">
          {copy.detail.bullets.map((b, i) => (
            <Reveal as="li" key={b} delay={0.1 + i * 0.05}>
              {b}
            </Reveal>
          ))}
        </ul>
      </section>
    </ChildPageShell>
  );
}
