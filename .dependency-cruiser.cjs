/** Enforces the hexagonal dependency rule: packages/core imports nothing infra. */
module.exports = {
  forbidden: [
    {
      name: "core-stays-pure",
      severity: "error",
      comment: "packages/core must not import infra (prisma/next/nest/vendor SDKs).",
      from: { path: "^packages/core/src" },
      to: {
        path: "node_modules/(@prisma|prisma|next|@nestjs|@anthropic-ai|googleapis|@octokit)",
      },
    },
    {
      name: "no-app-imports-from-core",
      severity: "error",
      comment: "core must not reach into apps/* or db/*.",
      from: { path: "^packages/core/src" },
      to: { path: "^(apps|db)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { extensions: [".ts", ".js"] },
  },
};
