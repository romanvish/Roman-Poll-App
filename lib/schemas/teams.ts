import { z } from "zod";

export const teamEligibilitySchema = z.object({
  seasonId: z.string().min(1).max(100),
  teamId: z.coerce.number().int().positive(),
  isEligible: z.enum(["true", "false"]).transform((value) => value === "true"),
}).strict();
