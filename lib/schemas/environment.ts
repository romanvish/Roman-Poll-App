import { z } from "zod";

const postgresUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1;
  } catch {
    return false;
  }
}, "Expected a PostgreSQL connection URL");

export const databaseEnvironmentSchema = z.object({ DATABASE_URL: postgresUrl });
export const migrationEnvironmentSchema = z.object({ DIRECT_URL: postgresUrl });

const applicationOrigin = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}, "Expected an application origin without a path");

export const adminEmailsSchema = z.string().default("").transform((value) =>
  value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
).pipe(z.array(z.email()));

export const authEnvironmentSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: applicationOrigin,
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  ADMIN_EMAILS: adminEmailsSchema,
});

// Report variable names, never the supplied values (which may contain secrets).
export function parseEnvironment<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>): z.output<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Missing or invalid environment variables: ${names.join(", ")}. See .env.example.`);
  }
  return result.data;
}
