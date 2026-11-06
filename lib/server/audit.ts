import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export type AuditEntry = {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Prisma.InputJsonValue;
};

export function recordAdminAction(tx: Prisma.TransactionClient, entry: AuditEntry) {
  return tx.auditLog.create({ data: entry });
}
