import "server-only";
import { databaseEnvironmentSchema, parseEnvironment } from "@/lib/schemas/environment";

export function getDatabaseEnvironment() {
  return parseEnvironment(databaseEnvironmentSchema, process.env);
}
