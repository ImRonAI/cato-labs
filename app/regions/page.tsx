import Link from 'next/link';
import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { regionsIndex, regions } from '@/lib/content/regions';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import ProximityType from '@/components/webgl/kit/ProximityType';
import RegionStage from '@/components/webgl/scenes/regions/lib-a/RegionStage';
import './page.css';

export const metadata = pageMetadata({
  title: 'Regions',
  description: regionsIndex.lede,
  path: '/regions',
  keywords: [
    'AI consulting Palm Springs',
    'Coachella Valley marketing',
    'AI-native consultancy California',
    'regional market strategy',
    'local search capture',
    'hospitality marketing',
    'Silicon Slopes consulting',
  ],
});

const jsonLd = childPageJsonLd({
  crumbs: [{ name: regionsIndex.eyebrow, path: '/regions' }],
});

/* The valley mains open the index — the beachhead Cato knows deepest. */
const VALLEY_SLUGS = new Set(['palm-springs', 'palm-desert', 'indio']);
const valley = regions.filter((r) => VALLEY_SLUGS.has(r.slug));
const beyond = regions.filter((r) => !VALLEY_SLUGS.has(r.slug));
const indexNo = new Map(regions.map((r, i) => [r.slug, String(i + 1).padStart(2, '0')]));

/**
 * /regions — the eleven markets, as an editorial index.
 * Scene: RegionsScene ("Pin drop") — eleven glass pins hang over a contour
 * relief map; through the `moment` dwell they fall one by one onto their
 * true positions and ripple the contours. Section ids are CONTRACT:
 * hero, feature, detail, cta (+ `moment`, the dwell).
 */
export default function RegionsPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* ---------- hero ---------- */}
      <section
        data-scene-section="hero"
        className="reg-hero container-x"
        aria-label={regionsIndex.titleLines.join(' ')}
      >
        <div className="reg-hero__body">
          <Reveal as="p" className="micro-label" delay={0.05}>
            {regionsIndex.eyebrow}
          </Reveal>
          <h1 className="display-1 reg-hero__title">
            {regionsIndex.titleLines.map((line, i) => (
              <Reveal key={line} line as="span" delay={0.12 + i * 0.1}>
                <ProximityType>{line}</ProximityType>
              </Reveal>
            ))}
          </h1>
          <Reveal as="p" className="lede reg-hero__lede" delay={0.35}>
            {regionsIndex.lede}
          </Reveal>
        </div>
      </section>

      {/* ---------- moment — the pin drop: eleven markets land on the map ---------- */}
      <RegionStage
        label={regionsIndex.eyebrow}
        count={regions.length}
        ariaLabel="The eleven regions on the map"
      />

      {/* ---------- feature — the eleven regions, an editorial index ---------- */}
      <section
        data-scene-section="feature"
        className="container-x reg-index"
        aria-label="The eleven regions"
      >
        <ol className="reg-list">
          <li className="reg-group" aria-hidden="true">
            <span className="micro-label">Coachella Valley</span>
          </li>
          {valley.map((r) => (
            <RegionRow key={r.slug} region={r} no={indexNo.get(r.slug)!} delay={0} />
          ))}
          <li className="reg-group" aria-hidden="true">
            <span className="micro-label">Beyond the Valley</span>
          </li>
          {beyond.map((r) => (
            <RegionRow key={r.slug} region={r} no={indexNo.get(r.slug)!} delay={0} />
          ))}
        </ol>
      </section>

      {/* ---------- detail — the beachhead logic ---------- */}
      <section
        data-scene-section="detail"
        className="container-x reg-logic"
        aria-label="The beachhead logic"
      >
        <Reveal as="p" className="micro-label" delay={0}>
          The beachhead logic
        </Reveal>
        <Reveal as="h2" className="h2 reg-logic__title" delay={0.08}>
          Taken neighborhood by neighborhood.
        </Reveal>
        <div className="reg-logic__grid">
          <Reveal className="reg-logic__card glass-card" delay={0}>
            <h3 className="h3 reg-logic__card-title">Neighborhood intent</h3>
            <p className="reg-logic__card-body">
              People search by neighborhood, not by metro — and every market
              has its own calendar, its own corridors, its own way of asking.
              The intent architecture is mapped to the geography locals
              actually use before anything is built.
            </p>
          </Reveal>
          <Reveal className="reg-logic__card glass-card" delay={0.08}>
            <h3 className="h3 reg-logic__card-title">Local partnerships</h3>
            <p className="reg-logic__card-body">
              Engagements plug into the partners already on the ground —
              photographers, hospitality groups, clubs and civic networks —
              with Cato supplying the strategy, the systems and the build.
              Presence compounds through the networks that already carry trust.
            </p>
          </Reveal>
          <Reveal className="reg-logic__card glass-card" delay={0.16}>
            <h3 className="h3 reg-logic__card-title">Geographic schema</h3>
            <p className="reg-logic__card-body">
              Each market is marked up as the place it actually is — city,
              region, service area — so search engines and answer agents read
              the map exactly the way the business serves it. The beachhead is
              taken deliberately, then held.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- cta — mirrors the ChildPageShell band ---------- */}
      <section
        data-scene-section="cta"
        className="container-x cta-band"
        aria-label="Get started"
      >
        <Reveal className="micro-label" delay={0}>
          Begin
        </Reveal>
        <Reveal as="h2" className="display-2" delay={0.08}>
          Build beyond ordinary, anywhere.
        </Reveal>
        <Reveal
          className="lede"
          delay={0.16}
          style={{ maxWidth: '34rem', margin: '0 auto 34px' }}
        >
          Tell us the market you are taking. We will map it as it actually is
          — then engineer the system that takes it.
        </Reveal>
        <Reveal delay={0.24}>
          <CtaButton href="/contact" label="Start a build" variant="blue" />
        </Reveal>
      </section>
    </>
  );
}

function RegionRow({
  region,
  no,
  delay,
}: {
  region: (typeof regions)[number];
  no: string;
  delay: number;
}) {
  return (
    <li>
      <Reveal delay={delay}>
        <Link href={`/regions/${region.slug}`} className="reg-row">
          <span className="index-no">{no}</span>
          <span className="reg-row__place">
            <h3 className="h3 reg-row__title">{region.city}</h3>
            <span className="reg-row__region">{region.region}</span>
          </span>
          <span className="reg-row__lede">{region.lede}</span>
          <span className="reg-row__arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </Reveal>
    </li>
  );
}
