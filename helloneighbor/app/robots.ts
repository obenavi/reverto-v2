import type { MetadataRoute } from 'next';

/**
 * /m/<token> and /consent/<token> put a credential in the URL. Those pages are
 * already noindex, but a crawler that finds a shared link should not fetch
 * them at all — and /dashboard and /admin have nothing to index.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/m/', '/consent/', '/dashboard', '/admin', '/api/'],
    },
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
