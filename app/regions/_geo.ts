import { site } from '@/lib/content';
import type { RegionCopy } from '@/lib/content/regions';
import { breadcrumbJsonLd, childPageJsonLd, type JsonLdObject } from '@/lib/seo';

export interface RegionGeoSpec {
  lat: number;
  lng: number;
  isoRegion: string;
  stateName: string;
  placeType?: 'City' | 'AdministrativeArea';
}

export const REGION_GEO: Record<string, RegionGeoSpec> = {
  'palm-springs': {
    lat: 33.8303,
    lng: -116.5453,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  'palm-desert': {
    lat: 33.7222,
    lng: -116.3745,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  indio: {
    lat: 33.7206,
    lng: -116.2156,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  'san-bernardino': {
    lat: 34.1083,
    lng: -117.2898,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  'big-bear': {
    lat: 34.2439,
    lng: -116.9114,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  'los-angeles': {
    lat: 34.0522,
    lng: -118.2437,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  'orange-county': {
    lat: 33.6846,
    lng: -117.8265,
    isoRegion: 'US-CA',
    stateName: 'California',
    placeType: 'AdministrativeArea',
  },
  'san-francisco': {
    lat: 37.7749,
    lng: -122.4194,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  napa: {
    lat: 38.2975,
    lng: -122.2869,
    isoRegion: 'US-CA',
    stateName: 'California',
  },
  phoenix: {
    lat: 33.4484,
    lng: -112.074,
    isoRegion: 'US-AZ',
    stateName: 'Arizona',
  },
  'salt-lake-city': {
    lat: 40.7608,
    lng: -111.891,
    isoRegion: 'US-UT',
    stateName: 'Utah',
  },
};

export function regionGeoMeta(copy: RegionCopy): { placename: string; region?: string } {
  const entry = REGION_GEO[copy.slug];
  return {
    placename: copy.city,
    region: entry?.isoRegion,
  };
}

export function regionAreaServedNode(copy: RegionCopy): JsonLdObject {
  const entry = REGION_GEO[copy.slug];
  if (!entry) {
    return {
      '@type': 'City',
      name: copy.city,
    };
  }
  return {
    '@type': entry.placeType ?? 'City',
    name: copy.city,
    containedInPlace: {
      '@type': 'State',
      name: entry.stateName,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: entry.lat,
      longitude: entry.lng,
    },
  };
}

export function regionChildJsonLd(copy: RegionCopy): JsonLdObject[] {
  const base = childPageJsonLd({
    crumbs: [
      { name: 'Regions', path: '/regions' },
      { name: copy.crumbLabel, path: `/regions/${copy.slug}` },
    ],
    faq: copy.faq,
  });

  const serviceNode: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${site.url}/regions/${copy.slug}#service`,
    name: `AI-native consulting in ${copy.city}`,
    description: copy.lede,
    url: `${site.url}/regions/${copy.slug}`,
    provider: { '@id': `${site.url}/#organization` },
    areaServed: regionAreaServedNode(copy),
  };

  return [...base, serviceNode];
}

export function regionsIndexJsonLd(allRegions: RegionCopy[], description: string): JsonLdObject[] {
  return [
    breadcrumbJsonLd([
      { name: 'Home', url: site.url },
      { name: 'Regions', url: `${site.url}/regions` },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${site.url}/regions#list`,
      name: `${site.name} service regions`,
      numberOfItems: allRegions.length,
      itemListElement: allRegions.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${r.city} — ${r.region}`,
        url: `${site.url}/regions/${r.slug}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${site.url}/regions#service`,
      name: `${site.name} regional strategy & AI implementation`,
      description,
      url: `${site.url}/regions`,
      provider: { '@id': `${site.url}/#organization` },
      areaServed: allRegions.map((r) => regionAreaServedNode(r)),
    },
  ];
}
