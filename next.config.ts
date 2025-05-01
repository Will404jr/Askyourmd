/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone",
  // Add this to handle reverse proxy
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "login.microsoftonline.com",
        "askyourmd.nssfug.org",
        "auth.askyourmd.nssfug.org",
      ],
    },
    // Add this to trust the proxy headers
    trustHostHeader: true,
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
  env: {
    NEXT_PUBLIC_AUTH_SERVICE_URL: "http://localhost:4000", // Change to your actual auth service URL in production
    AUTH_SERVICE_URL: "http://localhost:4000", // Server-side URL for the auth service
  },
};

export default nextConfig;
