import { pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { regions, type RegionCopy } from '@/lib/content/regions';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import RegionMoment from '@/components/webgl/scenes/regions/lib-a/RegionMomentPage';
import { regionChildJsonLd, regionGeoMeta } from '../_geo';
import './page.css';

function regionCopy(slug: string): RegionCopy {
  const hit = regions.find((r) => r.slug === slug);
  if (!hit) throw new Error(`regions deck is missing slug: ${slug}`);
  return hit;
}

const copy = regionCopy('napa');

const jsonLd = regionChildJsonLd(copy);

export const metadata = pageMetadata({
  title: `AI-native consulting in ${copy.city}`,
  description: copy.lede,
  path: '/regions/napa',
  geo: regionGeoMeta(copy),
  keywords: [
    'AI consulting Napa',
    'Wine Country marketing',
    'direct-to-consumer wine',
    'wine club retention',
    'guest experience automation',
    'tasting room marketing',
    'Napa hospitality brand systems',
    'wine club reactivation',
  ],
});

/**
 * /regions/napa — the valley sells considered experiences.
 * Scene: NapaScene ("Dawn Over the Contour Rows") — rolling Napa Valley
 * contour terraces and instanced vineyard trellises in refractive crystal;
 * during `moment`, low morning mist layers part and recede as sculpted vine
 * rows and luminous cluster nodes emerge under a raking dawn light.
 * Hotspot 'napa-skyline' rides the hillside estate crest.
 * Section ids are CONTRACT: hero (shell), stats, moment, angles, feature,
 * build, detail, faq/cta (shell).
 */
export default function NapaPage() {
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
          className="container-x nap-stats"
          aria-label="The market in numbers"
        >
          <Reveal className="micro-label" delay={0}>
            The market in numbers
          </Reveal>
          <div className="nap-stats__grid">
            {copy.stats.map((s, i) => (
              <div key={s.value} className="nap-stat">
                <Reveal className="nap-stat__value" delay={i * 0.08}>
                  {s.value}
                </Reveal>
                <Reveal as="p" className="nap-stat__label" delay={0.08 + i * 0.08}>
                  {s.label}
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- moment — the signature scroll moment (dwell) ---------- */}
      <RegionMoment copy={copy} />

      {/* ---------- angles — the valley, four ways ---------- */}
      <section
        data-scene-section="angles"
        className="container-x nap-angles"
        aria-label={`${copy.city} market angles`}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.region}
        </Reveal>
        <div className="nap-angles__grid">
          {copy.localAngles.map((a, i) => (
            <article key={a.title} className="nap-angle">
              <Reveal className="index-no" delay={0}>
                {String(i + 1).padStart(2, '0')}
              </Reveal>
              <Reveal as="h3" className="h3 nap-angle__title" delay={0.06}>
                {a.title}
              </Reveal>
              <Reveal as="p" className="nap-angle__body" delay={0.14}>
                {a.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- feature — the three engagements ---------- */}
      <section
        data-scene-section="feature"
        className="container-x nap-plays"
        aria-label="The engagements"
      >
        <Reveal className="micro-label" delay={0}>
          {copy.city}
        </Reveal>
        <div className="nap-plays__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="nap-play">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 nap-play__title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="nap-play__body" delay={0.16}>
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
          className="container-x nap-build"
          aria-label="What we build here"
        >
          <Reveal className="micro-label" delay={0}>
            What we build here
          </Reveal>
          <Reveal as="h2" className="h2 nap-build__title" delay={0.08}>
            Six practices, mapped to the valley.
          </Reveal>
          <div className="nap-build__grid">
            {copy.practiceMap.map((p, i) => (
              <article key={p.practice} className="nap-build__row">
                <Reveal className="index-no" delay={0}>
                  {String(i + 1).padStart(2, '0')}
                </Reveal>
                <Reveal as="h3" className="nap-build__practice" delay={0.06}>
                  {p.practice}
                </Reveal>
                <Reveal as="p" className="nap-build__example" delay={0.12}>
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
        className="container-x nap-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 nap-detail__title" delay={0.08}>
          <ProximityType>{copy.detail.title}</ProximityType>
        </Reveal>
        <Reveal as="p" className="lede nap-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="nap-detail__bullets">
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
