/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
  }
};

module.exports = nextConfig;
