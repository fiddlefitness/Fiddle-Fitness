import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Warning only instead of failing the build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // Add your redirects here
  redirects: async () => {
    return [
      {
        source: '/old-page',
        destination: '/new-page',
        permanent: true,
      },
      // Add more redirects as needed
    ];
  },
  // Other legacy config options you might need
  rewrites: async () => {
    return [];
  },
  headers: async () => {
    return [];
  },
  // Set these as needed
  trailingSlash: false,
  cleanUrls: true
}

export default nextConfig