import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: 'HelloNeighbor',
    template: '%s · HelloNeighbor',
  },
  description:
    'The neighborhood app for kids and teens with a hustle — book trash cans, car washes, dog walks and more.',
  applicationName: 'HelloNeighbor',
  appleWebApp: {
    capable: true,
    title: 'HelloNeighbor',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'HelloNeighbor',
    description:
      'The neighborhood runs on kids with a hustle. Set your prices, share one link, get booked.',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Let the layout breathe into the notch area when installed to the home screen.
  viewportFit: 'cover',
  themeColor: '#185FA5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
