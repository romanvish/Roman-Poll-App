import { z } from "zod";

const applicationOrigin = z.string().url().refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && url.pathname === "/" && !url.search && !url.hash;
}, "Expected an origin without a path");

export const staticSiteEnvironmentSchema = z.object({ STATIC_SITE_ORIGIN: applicationOrigin });

export const publicPollSchema = z.object({
  season: z.number().int(),
  week: z.number().int(),
  label: z.string(),
  publishedAt: z.string().datetime({ offset: true }),
  voters: z.number().int().nonnegative(),
  rankings: z.array(z.object({ rank: z.number().int().positive(), team: z.string(), teamId: z.union([z.number().int(), z.string()]), record: z.string(), points: z.number().int().nonnegative(), firstPlaceVotes: z.number().int().nonnegative(), previousRank: z.number().int().positive().nullable() })),
  othersReceivingVotes: z.array(z.object({ team: z.string(), teamId: z.union([z.number().int(), z.string()]), points: z.number().int().positive() })),
  ballots: z.array(z.object({ voter: z.string(), teams: z.array(z.string()).length(25) })),
}).strict();

export type PublicPoll = z.infer<typeof publicPollSchema>;
