import { z } from "zod";

const baseUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && url.pathname === "/" && !url.search && !url.hash;
}, "Expected an API origin without a path");

export const syncEnvironmentSchema = z.object({
  GAME_API_KEY: z.string().trim().min(1),
  GAME_API_BASE_URL: baseUrl.default("https://api.collegefootballdata.com"),
});
