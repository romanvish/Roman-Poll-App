import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { legacyArchiveSchema } from "../lib/schemas/legacy-archive";

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function relocateVoterPhotos(input: unknown): unknown {
  if (!Array.isArray(input)) return input;
  return input.map((value) => {
    if (typeof value !== "object" || value === null || !("photo" in value) || typeof value.photo !== "string") return value;
    const photo = value.photo.replace(/^\/voters\//, "/profile-images/voters/");
    return { ...value, photo };
  });
}

const sourceRoot = path.resolve(argument("--source", path.resolve(process.cwd(), "..", "Roman-Poll")));
const outputPath = path.resolve(argument("--output", path.join(process.cwd(), ".tmp", "roman-poll-2026-legacy.json")));
const dataRoot = path.join(sourceRoot, "data");
const archive = legacyArchiveSchema.parse({
  format: "roman-poll-legacy",
  version: 1,
  season: 2026,
  teams: await readJson(path.join(dataRoot, "teams.json")),
  voters: relocateVoterPhotos(await readJson(path.join(dataRoot, "voters.json"))),
  weeks: await Promise.all(Array.from({ length: 8 }, (_, week) => readJson(path.join(dataRoot, "2026", `Week${week}.json`)))),
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
console.log(`Validated ${archive.teams.length} teams, ${archive.voters.length} voters, and ${archive.weeks.length} editions.`);
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
