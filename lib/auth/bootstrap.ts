import { adminEmailsSchema } from "@/lib/schemas/environment";

export type InitialAccess = { role: "voter" | "admin"; status: "pending" | "approved" };

export function resolveInitialAccess(email: string, configuredAdminEmails: string): InitialAccess {
  const admins = new Set(adminEmailsSchema.parse(configuredAdminEmails));
  const isBootstrapAdmin = admins.has(email.trim().toLowerCase());
  return isBootstrapAdmin
    ? { role: "admin", status: "approved" }
    : { role: "voter", status: "pending" };
}
