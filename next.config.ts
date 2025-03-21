import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Warning only instead of failing the build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  /* config options here */
}

export default nextConfig
