import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { regions, type RegionCopy } from '@/lib/content/regions';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import MomentDwell from '@/components/webgl/scenes/regions/lib-b/MomentDwell';
import './page.css';

function regionCopy(slug: string): RegionCopy {
  const hit = regions.find((r) => r.slug === slug);
  if (!hit) throw new Error(`regions deck is missing slug: ${slug}`);
  return hit;
}

const copy = regionCopy('los-angeles');

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
  path: '/regions/los-angeles',
  keywords: [
    'AI consulting Los Angeles',
    'brand strategy Los Angeles',
    'DTC brand growth systems',
    'neighborhood local SEO Los Angeles',
    'AI agents Los Angeles',
    'answer engine optimization',
    'World Cup 2026 marketing',
    'LA28 Olympics marketing',
  ],
});

/**
 * /regions/los-angeles — a hundred markets wearing one name.
 * Scene: LosAngelesScene ("The Basin of Light") — the tower-cluster skyline
 * over a breathing sprawl of city lights; a premiere-night search beacon
 * sweeps the basin in a slow loop while the camera pulls back on `angles`.
 * Hotspot 'la-skyline' rides the spire anchor.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell). `moment` is the signature dwell (lib-b).
 */
export default function LosAngelesPage() {
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
          className="container-x la-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="la-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="la-stat">
                <Reveal className="la-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="la-stat__label" delay={0.08 + i * 0.08}>
                  {s.label}
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- moment — the signature scroll dwell (Clapperboard) ---------- */}
      <MomentDwell city={copy.city} region={copy.region} />

      {/* ---------- angles — the local read ---------- */}
      <section
        data-scene-section="angles"
        className="container-x la-angles"
        aria-label="Local angles"
      >
        <Reveal className="micro-label" delay={0}>
          Local angles
        </Reveal>
        <div className="la-angles__grid">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="la-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 la-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="la-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three pillars ---------- */}
      <section
        data-scene-section="feature"
        className="container-x la-features"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="la-features__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="la-feature">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 la-feature__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="la-feature__body" delay={0.16}>
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
          className="container-x la-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 la-build__title" delay={0.08}>
            Built for the hundred markets.
          </Reveal>
          <div className="la-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="la-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="la-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="la-build__example" delay={0.12}>
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
        className="container-x la-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 la-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede la-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="la-detail__bullets">
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
