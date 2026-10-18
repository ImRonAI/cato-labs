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

const copy = regionCopy('palm-desert');

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
  path: '/regions/palm-desert',
  keywords: [
    'Palm Desert AI consulting',
    'El Paseo retail marketing',
    'luxury brand positioning',
    'country club member experience',
    'professional services marketing Palm Desert',
    'snowbird season marketing',
    'Coachella Valley consulting',
    'voice AI concierge',
  ],
});

/**
 * /regions/palm-desert — the mid-valley’s commercial center of gravity.
 * Scene: PalmDesertScene ("The Palms") — the palm-pair skyline floats over
 * a low glass reflecting pool; beneath it, the El Paseo vitrine row lights
 * in a slow boutique sweep. Hotspot 'pd-skyline' rides the skyline crown.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function PalmDesertPage() {
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
          className="container-x pd-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="pd-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="pd-stat">
                <Reveal className="pd-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="pd-stat__label" delay={0.08 + i * 0.08}>
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
        className="container-x pd-angles"
        aria-label="The local read"
      >
        <Reveal className="micro-label" delay={0}>
          The local read
        </Reveal>
        <div className="pd-angles__stack">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="pd-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 pd-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="pd-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three pillars, hairline grid ---------- */}
      <section
        data-scene-section="feature"
        className="container-x pd-features"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="pd-features__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="pd-feature">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 pd-feature__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="pd-feature__body" delay={0.16}>
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
          className="container-x pd-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 pd-build__title" delay={0.08}>
            Built for the mid-valley economy.
          </Reveal>
          <div className="pd-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="pd-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="pd-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="pd-build__example" delay={0.12}>
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
        className="container-x pd-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 pd-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede pd-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="pd-detail__bullets">
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
