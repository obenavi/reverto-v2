import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HelloNeighbor - Run Your Neighborhood Business',
  description: 'Set your services, prices & schedule. Neighbors book online. You get paid.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-100">
        {children}
      </body>
    </html>
  )
}
