import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { regions, type RegionCopy } from '@/lib/content/regions';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import RegionMoment from '@/components/webgl/scenes/regions/lib-a/RegionMomentPage';
import './page.css';

function regionCopy(slug: string): RegionCopy {
  const hit = regions.find((r) => r.slug === slug);
  if (!hit) throw new Error(`regions deck is missing slug: ${slug}`);
  return hit;
}

const copy = regionCopy('palm-springs');

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Regions', path: '/regions' },
    { name: copy.crumbLabel, path: `/regions/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'AI-native consulting in Palm Springs',
  description: copy.lede,
  path: '/regions/palm-springs',
  keywords: [
    'AI consulting Palm Springs',
    'Palm Springs marketing agency',
    'Coachella Valley strategy',
    'boutique hotel booking engine',
    'Modernism Week marketing',
    'seasonal demand capture',
    'voice AI concierge Palm Springs',
    'local SEO Palm Springs',
  ],
});

/**
 * /regions/palm-springs — the desert modern.
 * Scene: PalmSpringsScene ("The Desert Modern") — the windmill skyline
 * assembles out of dust; a deep-blue sun rises with `angles` progress,
 * a windmill rotor turns slowly over the plinth, and pool ripple rings
 * breathe across the desert floor. Hotspot 'ps-skyline' rides the skyline.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function PalmSpringsPage() {
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
          className="container-x ps-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="ps-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="ps-stat">
                <Reveal className="ps-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="ps-stat__label" delay={0.08 + i * 0.08}>
                  {s.label}
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- moment — the signature scroll moment (dwell) ---------- */}
      <RegionMoment copy={copy} />

      {/* ---------- angles — the four local angles ---------- */}
      <section
        data-scene-section="angles"
        className="container-x ps-angles"
        aria-label="The local angles"
      >
        <Reveal className="micro-label" delay={0}>
          The local angles
        </Reveal>
        <div className="ps-angles__grid">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="ps-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 ps-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="ps-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three pillars ---------- */}
      <section
        data-scene-section="feature"
        className="container-x ps-features"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="ps-features__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="ps-feature">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 ps-feature__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="ps-feature__body" delay={0.16}>
                {f.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- build — the practices, mapped to this market ---------- */}
      {copy.practiceMap && (
        <section
          data-scene-section="build"
          className="container-x ps-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 ps-build__title" delay={0.08}>
            Built for the desert modern market.
          </Reveal>
          <div className="ps-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="ps-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="ps-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="ps-build__example" delay={0.12}>
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
        className="container-x ps-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 ps-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede ps-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="ps-detail__bullets">
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
