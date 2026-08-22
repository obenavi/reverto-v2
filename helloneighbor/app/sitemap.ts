import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const now = new Date();

  // Only the pages that should be found by search. Operator storefronts are
  // deliberately excluded — an operator shares their own link.
  return [
    { url: base, lastModified: now, priority: 1 },
    { url: `${base}/join`, lastModified: now, priority: 0.8 },
    { url: `${base}/guidelines`, lastModified: now, priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, priority: 0.3 },
    { url: `${base}/login`, lastModified: now, priority: 0.3 },
  ];
}
