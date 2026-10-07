/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['node:sqlite', 'better-sqlite3'],
  turbopack: {},
};

export default nextConfig;
