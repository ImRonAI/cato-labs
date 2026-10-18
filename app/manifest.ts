import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';

/** PWA manifest — paper-white brand surface, SVG icon served from app/icon.svg. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafbfe',
    theme_color: '#fafbfe',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
