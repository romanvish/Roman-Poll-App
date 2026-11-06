import { z } from "zod";
import { profileLinksSchema } from "@/lib/schemas/content";
import { avatarPaths } from "@/lib/profile/avatars";

const optionalText = (max: number) => z.string().trim().max(max);

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  avatarPath: z.union([z.literal(""), z.enum(avatarPaths)]).transform((value) => value || null),
  tagline: optionalText(120),
  bio: z.string().max(2_000),
  title: optionalText(80),
  affiliation: optionalText(120),
  location: optionalText(100),
  specialties: z.string().max(500),
  links: z.string().max(1_500).transform((value) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("|");
    return separator < 0 ? { label: "", url: "" } : { label: line.slice(0, separator).trim(), url: line.slice(separator + 1).trim() };
  })).pipe(profileLinksSchema),
  favoriteTeamId: z.union([
    z.literal(""),
    z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
  ]).transform((value) => value === "" ? null : value),
}).strict().transform((profile) => ({
  ...profile,
  bio: profile.bio.split(/\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean),
  specialties: profile.specialties.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
}));
