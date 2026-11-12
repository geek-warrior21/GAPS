import path from "node:path";
import { loadRootEnv } from "@gaps/db";
import type { NextConfig } from "next";

loadRootEnv({ startDir: import.meta.dirname });

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  transpilePackages: ["@gaps/contracts", "@gaps/domain", "@gaps/content", "@gaps/db", "@gaps/ai"],
};

export default nextConfig;
