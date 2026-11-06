import Link from "next/link";
import type { WeeklySuperlatives as WeeklySuperlativesData } from "@/lib/poll/insights";

export function WeeklySuperlatives({ items, publicVoterIds }: { items: WeeklySuperlativesData; publicVoterIds: string[] }) {
  const cards = [
    items.mostConsensus && { label: "Most consensus", team: items.mostConsensus.team, teamId: items.mostConsensus.teamId, detail: `${items.mostConsensus.rankSpread}-spot ballot range` },
    items.mostDebated && { label: "Most debated", team: items.mostDebated.team, teamId: items.mostDebated.teamId, detail: `${items.mostDebated.rankSpread}-spot ballot range` },
    items.biggestClimber && { label: "Biggest climber", team: items.biggestClimber.team, teamId: items.biggestClimber.teamId, detail: `Up ${items.biggestClimber.spots} spots` },
    items.boldestBallot && { label: "Boldest ballot", team: items.boldestBallot.team, teamId: items.boldestBallot.teamId, voter: items.boldestBallot.voter, voterId: items.boldestBallot.voterId, detail: `${Math.abs(items.boldestBallot.delta).toFixed(1)} spots from the field` },
  ].filter(Boolean) as Array<{ label: string; team: string; teamId: number | string; detail: string; voter?: string; voterId?: string }>;
  if (!cards.length) return null;
  const voterIds = new Set(publicVoterIds);
  return <section className="weekly-superlatives" aria-labelledby="superlatives-title">
    <div className="section-heading"><div><p className="eyebrow">By the numbers</p><h2 id="superlatives-title">Weekly superlatives</h2></div></div>
    <div className="superlative-grid">{cards.map((card) => <article key={card.label}>
      <p>{card.label}</p><strong><Link href={`/teams/${encodeURIComponent(String(card.teamId))}`}>{card.team}</Link></strong>
      <span>{card.voter && card.voterId && voterIds.has(card.voterId) ? <><Link href={`/voters/${encodeURIComponent(card.voterId)}`}>{card.voter}</Link> · </> : card.voter ? `${card.voter} · ` : null}{card.detail}</span>
    </article>)}</div>
  </section>;
}
