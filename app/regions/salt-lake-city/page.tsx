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

const copy = regionCopy('salt-lake-city');

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Regions', path: '/regions' },
    { name: copy.crumbLabel, path: `/regions/${copy.slug}` },
  ],
  faq: copy.faq,
});

/* The local angles are numbered structurally — the deck carries no index. */
const angles = copy.localAngles.map((a, i) => ({
  ...a,
  index: String(i + 1).padStart(2, '0'),
}));

export const metadata = pageMetadata({
  title: `AI-native consulting in ${copy.city}`,
  description: copy.lede,
  path: '/regions/salt-lake-city',
  keywords: [
    'AI consulting Salt Lake City',
    'AI-native consulting Utah',
    'Silicon Slopes marketing',
    'SaaS growth systems Utah',
    'category narrative design',
    'outdoor economy DTC brands',
    'Wasatch Front local SEO',
    '2034 Winter Olympics hospitality',
  ],
});

/**
 * /regions/salt-lake-city — the Silicon Slopes and the Wasatch.
 * Scene: SaltLakeCityScene ("The Ridge") — the Wasatch skyline assembles
 * out of light; a bright alpenglow sweep travels along the ridge crest as
 * `angles` scrolls, over a soft glow band and a small spire marker at the
 * base. Hotspot 'slc-skyline' rides the ridge crest.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function SaltLakeCityRegionPage() {
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
          className="container-x slc-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="slc-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="slc-stat">
                <Reveal className="slc-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="slc-stat__label" delay={0.08 + i * 0.08}>
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
        className="container-x slc-angles"
        aria-label="The local read"
      >
        <Reveal className="micro-label" delay={0}>
          The local read
        </Reveal>
        <div className="slc-angles__grid">
          {angles.map((a) => (
            <article key={a.index} className="slc-angle">
              <Reveal className="index-no" delay={0}>
                {a.index}
              </Reveal>
              <Reveal as="h3" className="h3 slc-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="slc-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the focus, three ways ---------- */}
      <section
        data-scene-section="feature"
        className="container-x slc-feature"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="slc-feature__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="slc-feature__block">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 slc-feature__block-title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="slc-feature__body" delay={0.16}>
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
          className="container-x slc-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 slc-build__title" delay={0.08}>
            Six practices, mapped to the corridor.
          </Reveal>
          <div className="slc-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="slc-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="slc-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="slc-build__example" delay={0.12}>
                  {p.example}
                </Reveal>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ---------- detail — working here, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x slc-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 slc-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede slc-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="slc-detail__bullets">
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
