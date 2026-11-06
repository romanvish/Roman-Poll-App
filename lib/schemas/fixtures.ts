import { z } from "zod";

export const teamFixtureSchema = z.array(z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  abbreviation: z.string().trim().min(1),
  conference: z.string().trim().min(1),
}).strict()).min(30).superRefine((teams, context) => {
  if (new Set(teams.map((team) => team.id)).size !== teams.length) {
    context.addIssue({ code: "custom", message: "Team fixture IDs must be unique" });
  }
});
