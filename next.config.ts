import type { NextConfig } from "next";
const config: NextConfig = { distDir: process.env.CRM_BUILD_DIR || ".next", poweredByHeader: false, agentRules: false, experimental: {cpus: 1, staticGenerationMaxConcurrency: 1}, devIndicators: false, serverExternalPackages: ["pg", "@electric-sql/pglite"] };
export default config;
