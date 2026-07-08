/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @pma/* are TS workspace packages consumed from source.
  transpilePackages: ["@pma/core", "@pma/db", "@pma/contracts"],
  experimental: { externalDir: true },
};
export default nextConfig;
