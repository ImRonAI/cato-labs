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

const copy = regionCopy('big-bear');

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
  path: '/regions/big-bear',
  keywords: [
    'AI consulting Big Bear',
    'vacation rental direct booking',
    'two-season marketing Big Bear',
    'cabin rental marketing',
    'guest concierge AI',
    'mountain business SEO',
    'weekend intent search',
  ],
});

/**
 * /regions/big-bear — the two-season town.
 * Scene: BigBearScene ("Twin Peaks") — the twin-peak skyline assembles out
 * of light; snow dust falls over the peaks and the snow line settles lower
 * on the ridgeline as winter arrives with the `angles` scroll. One deep-
 * blue cabin glows at the base. Hotspot 'bb-skyline' rides the cabin.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function BigBearPage() {
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
          className="container-x bbr-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="bbr-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="bbr-stat">
                <Reveal className="bbr-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="bbr-stat__label" delay={0.08 + i * 0.08}>
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
        className="container-x bbr-angles"
        aria-label="The local read"
      >
        <Reveal className="micro-label" delay={0}>
          The local read
        </Reveal>
        <Reveal as="p" className="bbr-angles__region" delay={0.08}>
          {copy.region}
        </Reveal>
        <div className="bbr-angles__grid">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="bbr-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 bbr-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="bbr-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three pillars ---------- */}
      <section
        data-scene-section="feature"
        className="container-x bbr-features"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="bbr-features__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="bbr-feature">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 bbr-feature__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="bbr-feature__body" delay={0.16}>
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
          className="container-x bbr-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 bbr-build__title" delay={0.08}>
            Built for the two-season town.
          </Reveal>
          <div className="bbr-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="bbr-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="bbr-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="bbr-build__example" delay={0.12}>
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
        className="container-x bbr-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 bbr-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede bbr-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="bbr-detail__bullets">
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
