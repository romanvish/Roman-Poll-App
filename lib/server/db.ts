import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseEnvironment } from "./env";

const globalDatabase = globalThis as unknown as { romanPollPrisma?: PrismaClient };

export function getDatabase(): PrismaClient {
  if (!globalDatabase.romanPollPrisma) {
    const { DATABASE_URL } = getDatabaseEnvironment();
    globalDatabase.romanPollPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: DATABASE_URL, max: 3, connectionTimeoutMillis: 10_000 }),
    });
  }
  return globalDatabase.romanPollPrisma;
}
