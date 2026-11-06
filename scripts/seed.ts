import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { teamFixtureSchema } from "../lib/schemas/fixtures";
import { db, reportDatabaseError, requireLocalDatabase } from "./database";

async function main() {
  requireLocalDatabase();
  const teams = teamFixtureSchema.parse(JSON.parse(await readFile(new URL("../prisma/fixtures/teams.json", import.meta.url), "utf8")));
  const now = new Date();
  const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    const current = await tx.season.findFirst({ where: { isCurrent: true } });
    const season = await tx.season.upsert({
      where: { year: 2026 }, update: {},
      create: { id: "demo-season-2026", year: 2026, isCurrent: !current },
    });
    const week = await tx.week.upsert({
      where: { seasonId_number: { seasonId: season.id, number: 1 } }, update: {},
      create: { id: "demo-week-2026-1", seasonId: season.id, number: 1, label: "Week 1", status: "open", opensAt: now, deadline },
    });

    for (const team of teams) {
      await tx.team.upsert({ where: { id: team.id }, update: {}, create: { ...team, shortName: team.name, isFbs: true } });
      await tx.seasonTeam.upsert({
        where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } }, update: {},
        create: { seasonId: season.id, teamId: team.id, conference: team.conference, isFbs: true, isEligible: true },
      });
      await tx.teamWeekStat.upsert({
        where: { teamId_weekId: { teamId: team.id, weekId: week.id } }, update: {},
        create: { teamId: team.id, weekId: week.id },
      });
    }

    for (const [index, name] of ["Sam", "Alex", "Jordan"].entries()) {
      const user = await tx.user.upsert({
        where: { email: `${name.toLowerCase()}@demo.invalid` }, update: {},
        create: { id: `demo-voter-${index + 1}`, email: `${name.toLowerCase()}@demo.invalid`, name, displayName: name, status: "approved", favoriteTeamId: teams[index].id, bio: ["A fictional voter for local development."], tagline: "Always ready to talk football." },
      });
      const order = [...teams.slice(index * 3), ...teams.slice(0, index * 3)].slice(0, 25);
      await tx.ballot.upsert({
        where: { userId_weekId: { userId: user.id, weekId: week.id } }, update: {},
        create: {
          id: `demo-ballot-${randomUUID()}`, userId: user.id, weekId: week.id, status: "submitted", submittedAt: now,
          entries: { create: order.map((team, rank) => ({ teamId: team.id, rank: rank + 1 })) },
        },
      });
    }
  }, { timeout: 30_000 });
  console.log("Local fixtures ready: 2026 Week 1, 32 FBS teams, three approved demo voters, and three 25-team ballots. No results or sessions created. Existing data was preserved.");
}

main().catch(reportDatabaseError).finally(() => db.$disconnect());
