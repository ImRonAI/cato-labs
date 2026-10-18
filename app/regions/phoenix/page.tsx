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

const copy = regionCopy('phoenix');

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
  path: '/regions/phoenix',
  keywords: [
    'AI consulting Phoenix',
    'AI-native consulting Arizona',
    'Phoenix local SEO',
    'home services marketing Phoenix',
    'semiconductor supplier marketing Arizona',
    'Valley of the Sun growth strategy',
    'voice AI answering Phoenix',
    'new-resident search capture',
  ],
});

/**
 * /regions/phoenix — the Valley of the Sun.
 * Scene: PhoenixScene — the Camelback skyline assembles out of light; a
 * deep-blue sun disc climbs as `angles` scrolls while a heat shimmer
 * rising off the valley floor intensifies the nearer it gets to the sun.
 * Hotspot 'phx-skyline' rides the Camelback head.
 * Section ids are CONTRACT: hero (shell), stats, angles, feature, build,
 * detail, faq/cta (shell).
 */
export default function PhoenixRegionPage() {
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
          className="container-x phx-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="phx-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="phx-stat">
                <Reveal className="phx-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="phx-stat__label" delay={0.08 + i * 0.08}>
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
        className="container-x phx-angles"
        aria-label="The local read"
      >
        <Reveal className="micro-label" delay={0}>
          The local read
        </Reveal>
        <div className="phx-angles__grid">
          {angles.map((a) => (
            <article key={a.index} className="phx-angle">
              <Reveal className="index-no" delay={0}>
                {a.index}
              </Reveal>
              <Reveal as="h3" className="h3 phx-angle__title" delay={0.08}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="phx-angle__body" delay={0.16}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the focus, three ways ---------- */}
      <section
        data-scene-section="feature"
        className="container-x phx-feature"
        aria-label="The focus"
      >
        <Reveal className="micro-label" delay={0}>
          The focus
        </Reveal>
        <div className="phx-feature__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="phx-feature__block">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 phx-feature__block-title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="phx-feature__body" delay={0.16}>
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
          className="container-x phx-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 phx-build__title" delay={0.08}>
            Six practices, mapped to the Valley.
          </Reveal>
          <div className="phx-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="phx-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="phx-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="phx-build__example" delay={0.12}>
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
        className="container-x phx-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 phx-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede phx-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="phx-detail__bullets">
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
