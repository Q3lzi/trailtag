import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Leaflet's map instance is not safe against React 19's double-invoked
  // effects in development (it leaves the tile pane in a broken state on
  // re-init). Disabling Strict Mode avoids the double-mount entirely rather
  // than working around it inside every map component.
  reactStrictMode: false,
};

export default nextConfig;