import { z } from "zod";

export const seasonImportRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.enum(["dryRun", "commit"]), archive: z.unknown() }).strict(),
  z.object({ mode: z.literal("legacy"), action: z.enum(["dryRun", "commit"]), archive: z.unknown() }).strict(),
]);
