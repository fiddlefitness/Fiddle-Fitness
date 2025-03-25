/** @type {import('next').NextConfig} */
const nextConfig = {
  // Start with bare essentials
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Force setting routes to undefined to prevent conflict
  // @ts-ignore - Explicitly override the problematic property
  routes: undefined,
  // Legacy properties
  rewrites: async () => {
    return [];
  },
  redirects: async () => {
    return [];
  }
}

module.exports = nextConfig;