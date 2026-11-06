import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { authEnvironmentSchema, parseEnvironment } from "@/lib/schemas/environment";
import { resolveInitialAccess } from "@/lib/auth/bootstrap";
import { getDatabase } from "@/lib/server/db";

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured. Add the required values to .env.");
    this.name = "AuthConfigurationError";
  }
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return authInstance ??= createAuth();
}

function createAuth() {
    const result = authEnvironmentSchema.safeParse(process.env);
    if (!result.success) {
      // Never include invalid values: OAuth secrets appear in environment input.
      throw new AuthConfigurationError();
    }
    const environment = parseEnvironment(authEnvironmentSchema, process.env);
    const db = getDatabase();

    return betterAuth({
      baseURL: environment.BETTER_AUTH_URL,
      secret: environment.BETTER_AUTH_SECRET,
      trustedOrigins: [environment.BETTER_AUTH_URL],
      database: prismaAdapter(db, { provider: "postgresql" }),
      socialProviders: {
        google: {
          clientId: environment.GOOGLE_CLIENT_ID,
          clientSecret: environment.GOOGLE_CLIENT_SECRET,
          prompt: "select_account",
        },
      },
      user: {
        additionalFields: {
          displayName: { type: "string", required: false, input: false },
          role: { type: ["voter", "admin"], required: false, input: false },
          status: { type: ["pending", "approved", "disabled"], required: false, input: false },
        },
      },
      databaseHooks: {
        user: {
          create: {
            async before(user) {
              const access = resolveInitialAccess(user.email, environment.ADMIN_EMAILS.join(","));
              return { data: { ...user, displayName: user.name.trim(), ...access } };
            },
          },
        },
        session: {
          create: {
            async before(session) {
              const user = await db.user.findUnique({ where: { id: session.userId }, select: { status: true } });
              return user && user.status !== "disabled" ? undefined : false;
            },
          },
        },
      },
      rateLimit: { enabled: true, storage: "database", modelName: "rateLimit", window: 60, max: 120 },
      advanced: { database: { joins: true } },
      plugins: [nextCookies()],
    });
}
