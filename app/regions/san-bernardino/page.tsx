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

const copy = regionCopy('san-bernardino');

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
  path: '/regions/san-bernardino',
  keywords: [
    'AI consulting San Bernardino',
    'Inland Empire logistics marketing',
    'B2B marketing Inland Empire',
    'intake and scheduling automation',
    'voice AI answering San Bernardino',
    'regional search capture',
    'review and trust operations',
  ],
});

/**
 * /regions/san-bernardino — the crossroads, in transition.
 * Scene: SanBernardinoScene ("The Gap") — the mountain-gap skyline with
 * the light thread through the pass; freight packets ride the thread in
 * both directions, the corridor made visible. Hotspot 'sb-skyline' rides
 * the gap.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function SanBernardinoPage() {
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
          className="container-x sbd-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="sbd-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="sbd-stat">
                <Reveal className="sbd-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="sbd-stat__label" delay={0.08 + i * 0.08}>
                  {s.label}
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- moment — the signature scroll moment (dwell) ---------- */}
      <RegionMoment copy={copy} />

      {/* ---------- angles — the local read ---------- */}
      <section
        data-scene-section="angles"
        className="container-x sbd-angles"
        aria-label="The local read"
      >
        <Reveal className="micro-label" delay={0}>
          The local read
        </Reveal>
        <Reveal as="p" className="sbd-angles__region" delay={0.08}>
          {copy.region}
        </Reveal>
        <div className="sbd-angles__grid">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="sbd-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 sbd-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="sbd-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three pillars ---------- */}
      <section
        data-scene-section="feature"
        className="container-x sbd-features"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="sbd-features__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="sbd-feature">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 sbd-feature__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="sbd-feature__body" delay={0.16}>
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
          className="container-x sbd-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 sbd-build__title" delay={0.08}>
            Built for the crossroads.
          </Reveal>
          <div className="sbd-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="sbd-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="sbd-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="sbd-build__example" delay={0.12}>
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
        className="container-x sbd-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 sbd-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede sbd-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="sbd-detail__bullets">
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
