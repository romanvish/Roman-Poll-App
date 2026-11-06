import { z } from "zod";

export const adminUserActionSchema = z.object({
  userId: z.string().trim().min(1).max(100),
  action: z.enum(["approve", "disable", "promote", "demote"]),
}).strict();

export const userFilterSchema = z.enum(["all", "pending", "approved", "disabled"]).default("all");
