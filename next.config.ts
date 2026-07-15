import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static build: the app is a read-only synthetic-data dashboard with
  // no server surface. `next build` writes the site to `out/`.
  output: "export",
};

export default nextConfig;
