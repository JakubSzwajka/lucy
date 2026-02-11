/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone for production (supports API routes)
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // Silence Turbopack warning - we need webpack for native module handling
  turbopack: {},
  webpack: (config) => {
    // Externalize native modules for Electron
    config.externals = [...(config.externals || []), "better-sqlite3"];

    return config;
  },
};

module.exports = nextConfig;
