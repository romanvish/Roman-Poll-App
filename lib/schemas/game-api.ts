import { z } from "zod";

const nullableText = z.string().nullable().optional();

export const gameApiTeamSchema = z.object({
  id: z.number().int().positive(),
  school: z.string().trim().min(1),
  mascot: nullableText,
  abbreviation: nullableText,
  conference: nullableText,
  color: nullableText,
  logos: z.array(z.string()).nullable().optional(),
}).passthrough();

export const gameApiTeamListSchema = z.array(gameApiTeamSchema);

export const gameApiGameSchema = z.object({
  id: z.number().int().positive(),
  season: z.number().int(),
  week: z.number().int().positive(),
  startDate: z.string().datetime({ offset: true }),
  homeId: z.number().int().positive(),
  homeTeam: z.string().trim().min(1),
  homeConference: nullableText,
  homeClassification: z.string(),
  homePoints: z.number().int().nonnegative().nullable(),
  awayId: z.number().int().positive(),
  awayTeam: z.string().trim().min(1),
  awayConference: nullableText,
  awayClassification: z.string(),
  awayPoints: z.number().int().nonnegative().nullable(),
  status: z.string().trim().min(1),
}).passthrough().refine((game) => game.homeId !== game.awayId, "A game needs two distinct teams");

export const gameApiGameListSchema = z.array(gameApiGameSchema);
