import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Warning only instead of failing the build
    ignoreDuringBuilds: true,
  },
  /* config options here */
}

export default nextConfig
