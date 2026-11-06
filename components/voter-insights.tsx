import type { VoterLens as VoterLensData } from "@/lib/poll/insights";
import Link from "next/link";

function DeltaList({ items, direction }: { items: VoterLensData["higher"]; direction: "higher" | "lower" }) {
  const title = direction === "higher" ? "Higher than the field" : "Lower than the field";
  return <div className={`voter-delta-card ${direction}`}>
    <h3>{title}</h3>
    {items.length ? <ol>{items.map((item) => <li key={item.teamId}><strong><Link href={`/teams/${encodeURIComponent(String(item.teamId))}`}>{item.team}</Link></strong><span>{Math.abs(item.delta).toFixed(1)} spots</span></li>)}</ol> : <p>No notable differences in this direction.</p>}
  </div>;
}

export function VoterInsights({ lens, title }: { lens: VoterLensData; title: string }) {
  return <section className="voter-insights" aria-label={title}>
    <div className="section-heading"><div><p className="eyebrow">Compared with the rest of the panel</p><h2>{title}</h2></div></div>
    {lens.available ? <div className="voter-delta-grid"><DeltaList items={lens.higher} direction="higher" /><DeltaList items={lens.lower} direction="lower" /></div> : <div className="empty-panel"><strong>Not enough ballots to compare yet.</strong><p>Once another voter submits a ballot for these editions, this breakdown will appear.</p></div>}
  </section>;
}
