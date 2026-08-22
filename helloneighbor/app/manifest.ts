import type { MetadataRoute } from 'next';

/**
 * Makes the app installable — "Add to Home Screen" on iOS, a real install
 * prompt on Android. This is what gets HelloNeighbor onto a phone today,
 * independent of any app store review.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HelloNeighbor',
    short_name: 'HelloNeighbor',
    description:
      'Book the kids and teens in your neighborhood for trash cans, car washes, dog walks, tutoring and yard work.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#185FA5',
    categories: ['lifestyle', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
