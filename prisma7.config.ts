import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";
import { migrationEnvironmentSchema, parseEnvironment } from "./lib/schemas/environment";

nextEnv.loadEnvConfig(process.cwd());

const directUrl = process.env.DIRECT_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node --conditions=react-server --import tsx scripts/seed.ts" },
  // Generation/builds need no live database. Migration commands reject a missing URL.
  datasource: directUrl ? { url: parseEnvironment(migrationEnvironmentSchema, process.env).DIRECT_URL } : undefined,
});
