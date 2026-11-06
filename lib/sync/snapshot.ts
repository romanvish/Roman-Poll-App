import type { z } from "zod";
import type { gameApiGameSchema } from "@/lib/schemas/game-api";

export type SyncGame = z.infer<typeof gameApiGameSchema>;
export type TeamSnapshot = {
  teamId: number;
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
  lastResult: Record<string, unknown> | null;
  nextOpponent: Record<string, unknown> | null;
};

export function buildTeamSnapshots(teamIds: number[], games: SyncGame[], now: Date): TeamSnapshot[] {
  return teamIds.map((teamId) => {
    const completed = games.filter((game) => game.status.toLowerCase() === "completed" && game.homePoints !== null && game.awayPoints !== null && (game.homeId === teamId || game.awayId === teamId));
    const upcoming = games.filter((game) => new Date(game.startDate) > now && (game.homeId === teamId || game.awayId === teamId)).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    let wins = 0;
    let losses = 0;
    let confWins = 0;
    let confLosses = 0;
    for (const game of completed) {
      const home = game.homeId === teamId;
      const own = home ? game.homePoints! : game.awayPoints!;
      const opponent = home ? game.awayPoints! : game.homePoints!;
      if (own > opponent) wins++;
      else if (own < opponent) losses++;
      const ownConference = home ? game.homeConference : game.awayConference;
      const opponentConference = home ? game.awayConference : game.homeConference;
      if (ownConference && ownConference === opponentConference) {
        if (own > opponent) confWins++;
        else if (own < opponent) confLosses++;
      }
    }
    const last = completed.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    const lastHome = last?.homeId === teamId;
    const opponent = upcoming ? (upcoming.homeId === teamId ? upcoming.awayTeam : upcoming.homeTeam) : null;
    const lastOpponent = last ? (lastHome ? last.awayTeam : last.homeTeam) : null;
    const ownPoints = last ? (lastHome ? last.homePoints : last.awayPoints) : null;
    const opponentPoints = last ? (lastHome ? last.awayPoints : last.homePoints) : null;
    const result = last && ownPoints !== null && opponentPoints !== null
      ? { opponent: lastOpponent, result: ownPoints > opponentPoints ? "W" : ownPoints < opponentPoints ? "L" : "T", score: `${ownPoints}-${opponentPoints}`, date: last.startDate }
      : null;
    return {
      teamId, wins, losses, confWins, confLosses, lastResult: result,
      nextOpponent: upcoming ? { opponent, date: upcoming.startDate, isHome: upcoming.homeId === teamId } : null,
    };
  });
}
