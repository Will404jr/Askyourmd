/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone",
  // Add this to handle reverse proxy
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
      trustHostHeader: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
