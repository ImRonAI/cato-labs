import RegionStage from './RegionStage';
import type { RegionCopy } from '@/lib/content/regions';

/**
 * The region child pages' signature-moment dwell, labelled from the deck:
 * the eyebrow is the region's own name, the caption its wider region.
 * Server-safe wrapper (RegionStage is the client island).
 */
export default function RegionMoment({ copy }: { copy: RegionCopy }) {
  return (
    <RegionStage
      label={copy.city}
      caption={copy.region}
      ariaLabel={`${copy.city}, ${copy.region}`}
    />
  );
}
