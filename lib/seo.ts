import type { Metadata } from 'next';
import { practices, site } from './content';

/**
 * SEO foundation. Page agents call pageMetadata() per route;
 * the layout renders organizationJsonLd() + websiteJsonLd().
 */

export function pageMetadata({
  title,
  description,
  path = '/',
  keywords = [],
  geo,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  /**
   * Optional geo meta for service-area pages (regions/*): emits the
   * classic geo.placename / geo.region meta tags via Metadata.other.
   */
  geo?: { placename: string; region?: string };
}): Metadata {
  const url = `${site.url}${path}`;
  return {
    title,
    description,
    keywords: [...site.keywords, ...keywords],
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — ${site.name}`,
      description,
      url,
      siteName: site.name,
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — ${site.name}`,
      description,
    },
    ...(geo
      ? {
          other: {
            'geo.placename': geo.placename,
            ...(geo.region ? { 'geo.region': geo.region } : {}),
          },
        }
      : {}),
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${site.url}/#organization`,
    name: site.name,
    url: site.url,
    slogan: site.tagline,
    description: site.description,
    email: site.email,
    foundingDate: '2026',
    knowsAbout: site.keywords,
    sameAs: [],
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    name: site.name,
    url: site.url,
    publisher: { '@id': `${site.url}/#organization` },
    inLanguage: 'en',
  };
}

/**
 * OfferCatalog of the six practices — lets search engines and AI agents
 * enumerate Cato's services without parsing the page. Names and
 * descriptions come straight from the copy deck.
 */
export function serviceCatalogJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    '@id': `${site.url}/#services`,
    name: `${site.name} capabilities`,
    provider: { '@id': `${site.url}/#organization` },
    itemListElement: practices.map((practice, i) => ({
      '@type': 'Offer',
      position: i + 1,
      itemOffered: {
        '@type': 'Service',
        '@id': `${site.url}/capabilities#${practice.id}`,
        name: practice.title,
        description: practice.short,
        provider: { '@id': `${site.url}/#organization` },
        url: `${site.url}/capabilities#${practice.id}`,
      },
    })),
  };
}

/** BreadcrumbList JSON-LD for interior pages. */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * The full graph the root layout should render:
 * organization + website + service catalog, cross-linked by @id.
 * Swap the layout's JSON.stringify([organizationJsonLd(), websiteJsonLd()])
 * for JSON.stringify(layoutJsonLdGraph()).
 */
export function layoutJsonLdGraph() {
  return [organizationJsonLd(), websiteJsonLd(), serviceCatalogJsonLd()];
}

/* ---------------------------------------------------------- */
/*  Page-level JSON-LD builders                                */
/* ---------------------------------------------------------- */

export interface FaqEntry {
  q: string;
  a: string;
}

export type JsonLdObject = Record<string, unknown>;

/** Root-relative paths are resolved against the site origin. */
function absoluteUrl(url: string): string {
  return url.startsWith('http') ? url : `${site.url}${url}`;
}

/** Copy dates like "February 2026" become ISO 8601 for schema.org. */
function isoDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString();
}

/** FAQPage JSON-LD from a ChildCopy faq array. */
export function faqJsonLd(faq: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** Service JSON-LD for a capability or specialism page. */
export function serviceJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url: absoluteUrl(url),
    provider: { '@id': `${site.url}/#organization` },
  };
}

/** Article JSON-LD for journal entries. */
export function articleJsonLd({
  title,
  description,
  date,
  url,
}: {
  title: string;
  description: string;
  date: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: isoDate(date),
    dateModified: isoDate(date),
    author: { '@id': `${site.url}/#organization` },
    publisher: { '@id': `${site.url}/#organization` },
    mainEntityOfPage: absoluteUrl(url),
    inLanguage: 'en',
  };
}

/** CreativeWork JSON-LD for a documented engagement (case study). */
export function caseStudyJsonLd({
  client,
  headline,
  description,
  sector,
  services,
  url,
}: {
  client: string;
  headline: string;
  description: string;
  sector: string;
  services: string[];
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: `${client} — ${headline}`,
    description,
    url: absoluteUrl(url),
    author: { '@id': `${site.url}/#organization` },
    about: sector,
    keywords: services.join(', '),
    inLanguage: 'en',
  };
}

/**
 * Compose the per-page graph: BreadcrumbList (Home is prepended
 * automatically) + optional Service + optional FAQPage, in one array
 * ready for <JsonLd data={...} />.
 */
export function childPageJsonLd({
  crumbs,
  faq,
  service,
}: {
  /** Every crumb carries its path, including the current page (last). */
  crumbs: { name: string; path: string }[];
  faq?: FaqEntry[];
  service?: { name: string; description: string; url: string };
}): JsonLdObject[] {
  const graph: JsonLdObject[] = [
    breadcrumbJsonLd([
      { name: 'Home', url: site.url },
      ...crumbs.map((c) => ({ name: c.name, url: absoluteUrl(c.path) })),
    ]),
  ];
  if (service) graph.push(serviceJsonLd(service));
  if (faq && faq.length > 0) graph.push(faqJsonLd(faq));
  return graph;
}
