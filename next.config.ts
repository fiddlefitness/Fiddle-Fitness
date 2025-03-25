/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Important: Remove any of these properties if present
  // rewrites: async () => { ... },
  // redirects: async () => { ... },
  // headers: async () => { ... },
  // cleanUrls: true,
  // trailingSlash: false
}

module.exports = nextConfig