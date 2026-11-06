import { z } from "zod";

export const publishedEditionParamsSchema = z.object({
  season: z.coerce.number().int().min(1900).max(2200),
  week: z.coerce.number().int().min(0).max(30),
});

export const publicVoterIdSchema = z.string().trim().min(1).max(128);
