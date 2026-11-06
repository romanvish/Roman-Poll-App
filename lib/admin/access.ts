import type { UserRole, UserStatus } from "@/generated/prisma/client";

export function isLastApprovedAdmin(role: UserRole, status: UserStatus, activeAdminCount: number): boolean {
  return role === "admin" && status === "approved" && activeAdminCount <= 1;
}
