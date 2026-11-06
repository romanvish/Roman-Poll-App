import nextEnv from "@next/env";
import { getDatabase } from "../lib/server/db";
import { databaseEnvironmentSchema, parseEnvironment } from "../lib/schemas/environment";

nextEnv.loadEnvConfig(process.cwd());

export function requireLocalDatabase() {
  const { DATABASE_URL } = parseEnvironment(databaseEnvironmentSchema, process.env);
  const url = new URL(DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Seed and verification commands are for local databases only.");
  }
}

export const db = getDatabase();

export function reportDatabaseError(error: unknown) {
  // Driver errors can contain connection details. Do not print them or their stack.
  if (error instanceof Error && (
    error.message.startsWith("Missing or invalid environment variables:") ||
    error.message === "Seed and verification commands are for local databases only."
  )) {
    console.error(error.message);
  } else {
    console.error("Database command failed. Check configuration, Docker, and migration status. No connection details were logged.");
  }
  process.exitCode = 1;
}
