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

const copy = regionCopy('orange-county');

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
  path: '/regions/orange-county',
  keywords: [
    'AI consulting Orange County',
    'Irvine tech marketing',
    'Orange County local SEO',
    'medical device marketing Irvine',
    'Anaheim hospitality marketing',
    'bilingual marketing Orange County',
    'appointment business systems',
    'voice AI answering Orange County',
  ],
});

/**
 * /regions/orange-county — a patchwork of thirty-four cities.
 * Scene: OrangeCountyScene ("The Pier") — the pier skyline over a
 * sine-displaced azure water sheet with a surfer dot; swell sets roll in
 * under the pier in looping trains. Hotspot 'oc-skyline' rides the hut.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function OrangeCountyPage() {
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
          className="container-x oc-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="oc-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="oc-stat">
                <Reveal className="oc-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="oc-stat__label" delay={0.08 + i * 0.08}>
                  {s.label}
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- angles — the local read ---------- */}
      <section
        data-scene-section="angles"
        className="container-x oc-angles"
        aria-label="Local angles"
      >
        <Reveal className="micro-label" delay={0}>
          Local angles
        </Reveal>
        <div className="oc-angles__grid">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="oc-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 oc-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="oc-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three pillars ---------- */}
      <section
        data-scene-section="feature"
        className="container-x oc-features"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="oc-features__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="oc-feature">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 oc-feature__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="oc-feature__body" delay={0.16}>
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
          className="container-x oc-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 oc-build__title" delay={0.08}>
            Six practices, mapped to the county.
          </Reveal>
          <div className="oc-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="oc-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="oc-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="oc-build__example" delay={0.12}>
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
        className="container-x oc-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 oc-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede oc-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="oc-detail__bullets">
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
