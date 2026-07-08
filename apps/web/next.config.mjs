/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @pma/* are TS workspace packages consumed from source.
  transpilePackages: ["@pma/core", "@pma/db", "@pma/contracts"],
  experimental: { externalDir: true },
  // The codebase's source files use explicit ".js" specifiers on relative imports
  // (the TS "NodeNext"-style convention, e.g. `import { db } from "./db.js"` in a
  // `db.ts` file) so `tsc` resolves them under `moduleResolution: bundler`. Webpack
  // doesn't apply that same ".js" -> ".ts"/".tsx" fallback by default, so without this
  // alias it fails to resolve those imports once they're actually reachable from a
  // bundled route.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};
export default nextConfig;
