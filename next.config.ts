/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone",
  // Add this to handle reverse proxy
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: ["login.microsoftonline.com", "askyourmd.nssfug.org"],
    },
    // Add this to trust the proxy headers
    trustHostHeader: true,
    appDir: true,
    serverComponentsExternalPackages: [],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add this for iron-session to work with the reverse proxy
  async headers() {
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

export default nextConfig;
