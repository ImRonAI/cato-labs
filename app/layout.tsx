import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './nav.css';
import './motion.css';
import { site } from '@/lib/content';
import { layoutJsonLdGraph } from '@/lib/seo';
import CanvasProvider from '@/components/webgl/CanvasProvider';
import ScrollDirector from '@/components/webgl/ScrollDirector';
import Nav from '@/components/ui/Nav';
import Footer from '@/components/ui/Footer';
import Cursor from '@/components/ui/Cursor';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  axes: ['opsz'],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  keywords: [...site.keywords],
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#fafbfe',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>

        {/* the living WebGL layer — persistent across routes */}
        <CanvasProvider />
        <ScrollDirector />

        <Nav />
        <main id="main" className="site-main">
          {children}
        </main>
        <Footer />

        <div className="grain" aria-hidden="true" />
        <Cursor />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(layoutJsonLdGraph()),
          }}
        />
      </body>
    </html>
  );
}
