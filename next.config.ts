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
  // Add this for iron-session to work with the reverse proxy
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
