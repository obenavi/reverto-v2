/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // For Vercel deployment
  },
  experimental: {
    esmExternals: true,
  },
};

module.exports = nextConfig;
