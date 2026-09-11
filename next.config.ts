import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "trycloudflare.com"],
  async redirects() {
    return [
      { source: "/actor/profile", destination: "/actor/account", permanent: false },
      { source: "/actor/albums", destination: "/actor/account/albums", permanent: false },
    ];
  },
};

export default nextConfig;
