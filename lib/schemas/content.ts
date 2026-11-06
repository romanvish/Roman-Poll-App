import { z } from "zod";

const text = z.string().trim().min(1);

export const editorialSchema = z.object({
  headline: text,
  dek: text,
  analysis: z.array(text),
  highlights: z.array(z.object({ label: text, title: text, body: text })),
}).strict();

export const profileLinksSchema = z.array(z.object({
  label: text,
  url: z.url().refine((value) => /^https?:\/\//i.test(value), {
    message: "Use an HTTP or HTTPS link",
  }),
}).strict());

export type WeekEditorial = z.infer<typeof editorialSchema>;
export type ProfileLink = z.infer<typeof profileLinksSchema>[number];
