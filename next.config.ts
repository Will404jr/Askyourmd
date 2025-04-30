/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone",
  // Add this to handle reverse proxy
  poweredByHeader: false,
  experimental: {
    serverActions: {
      trustHostHeader: true,
      allowedOrigins: ["login.microsoftonline.com", "askyourmd.nssfug.org"],
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
