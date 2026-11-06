import { z } from "zod";

export const rankingRouteParamsSchema = z.object({
  season: z.coerce.number().int().min(1900).max(2200),
  week: z.coerce.number().int().min(0).max(25),
});
