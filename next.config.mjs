/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Barrel-file tree shaking for the two icon/animation libraries.
    // lucide-react alone ships 1400+ module re-exports; without this every
    // page pays the parse cost of the full barrel on mid-range phones.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  webpack: (config) => {
    // face-api.js / tfjs reference node builtins behind runtime guards;
    // neutralize them for the browser bundle.
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
    };
    // face-api's bundled dist detects environments with dynamic require()
    // calls; webpack can't statically extract them. This is expected and
    // harmless in the browser, so keep the build output clean.
    config.module.unknownContextCritical = false;
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
