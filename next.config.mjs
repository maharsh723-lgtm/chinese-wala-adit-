/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['node:sqlite', 'better-sqlite3'],
  turbopack: {},
  outputFileTracingIncludes: {
    '/api/**/*': ['./database.db'],
  },
};

export default nextConfig;
