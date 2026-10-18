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

const copy = regionCopy('indio');

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
  path: '/regions/indio',
  keywords: [
    'Indio AI consulting',
    'Coachella festival marketing',
    'festival economy capture',
    'Stagecoach marketing',
    'home services marketing Indio',
    'local SEO Indio',
    'bilingual voice AI answering',
    'Coachella Valley growth',
  ],
});

/**
 * /regions/indio — the City of Festivals.
 * Scene: IndioScene ("The Festival Grounds") — the festival-tent skyline
 * assembles out of dust above a field of ground lights that wake one by
 * one; a stage-wash beam sweeps slowly across the grounds. Hotspot
 * 'indio-skyline' rides the tent peaks.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function IndioPage() {
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
          className="container-x in-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="in-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="in-stat">
                <Reveal className="in-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="in-stat__label" delay={0.08 + i * 0.08}>
                  {s.label}
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- moment — the signature scroll moment (dwell) ---------- */}
      <RegionMoment copy={copy} />

      {/* ---------- angles — the local read, editorial blocks ---------- */}
      <section
        data-scene-section="angles"
        className="container-x in-angles"
        aria-label="The local read"
      >
        <Reveal className="micro-label" delay={0}>
          The local read
        </Reveal>
        <div className="in-angles__stack">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="in-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 in-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="in-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three pillars, hairline grid ---------- */}
      <section
        data-scene-section="feature"
        className="container-x in-features"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="in-features__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="in-feature">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 in-feature__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="in-feature__body" delay={0.16}>
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
          className="container-x in-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 in-build__title" delay={0.08}>
            Built for the festival city.
          </Reveal>
          <div className="in-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="in-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="in-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="in-build__example" delay={0.12}>
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
        className="container-x in-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 in-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede in-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="in-detail__bullets">
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
