/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows better-sqlite3 to work in API routes
  serverExternalPackages: ['better-sqlite3'],
}

module.exports = nextConfig
