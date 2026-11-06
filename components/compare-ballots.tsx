"use client";

import { useMemo, useState } from "react";
import type { PublishedEditionDetails } from "@/lib/server/public-voters";
import { compareBallotRanks } from "@/lib/poll/compare";

export function CompareBallots({ edition, initialLeftId, initialRightId }: { edition: PublishedEditionDetails; initialLeftId?: string; initialRightId?: string }) {
  const ids = new Set(edition.ballots.map((ballot) => ballot.voterId));
  const initialLeft = initialLeftId && ids.has(initialLeftId) ? initialLeftId : edition.ballots[0]?.voterId ?? "";
  const initialRight = initialRightId && ids.has(initialRightId) && initialRightId !== initialLeft
    ? initialRightId
    : edition.ballots.find((ballot) => ballot.voterId !== initialLeft)?.voterId ?? "";
  const [leftId, setLeftId] = useState(initialLeft);
  const [rightId, setRightId] = useState(initialRight);
  const left = edition.ballots.find((ballot) => ballot.voterId === leftId);
  const right = edition.ballots.find((ballot) => ballot.voterId === rightId);
  const rows = useMemo(() => {
    if (!left || !right || left.voterId === right.voterId) return [];
    return compareBallotRanks(left.entries, right.entries, edition.pollRanks);
  }, [edition.pollRanks, left, right]);
  const biggestDisagreement = [...rows].sort((a, b) => b.gap - a.gap || a.team.localeCompare(b.team))[0];

  function setSelection(side: "left" | "right", voterId: string) {
    if (side === "left") setLeftId(voterId);
    else setRightId(voterId);
    const params = new URLSearchParams(window.location.search);
    params.set(side, voterId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  if (edition.ballots.length < 2) return <div className="empty-panel"><strong>There are not two published ballots to compare.</strong><p>Comparisons appear once at least two voters have submitted ballots for this edition.</p></div>;

  return <section className="compare-explorer" aria-label="Compare two voter ballots">
    <div className="compare-selectors">
      <label><span>First voter</span><select value={leftId} onChange={(event) => setSelection("left", event.target.value)}>
        {edition.ballots.map((ballot) => <option key={ballot.voterId} value={ballot.voterId} disabled={ballot.voterId === rightId}>{ballot.voter}</option>)}
      </select></label>
      <span className="compare-versus" aria-hidden="true">VS</span>
      <label><span>Second voter</span><select value={rightId} onChange={(event) => setSelection("right", event.target.value)}>
        {edition.ballots.map((ballot) => <option key={ballot.voterId} value={ballot.voterId} disabled={ballot.voterId === leftId}>{ballot.voter}</option>)}
      </select></label>
    </div>
    {biggestDisagreement && <div className="disagreement-callout"><p>Biggest disagreement</p><strong>{biggestDisagreement.team}</strong><span>{biggestDisagreement.gap} ranking spots apart</span></div>}
    <div className="results-table-wrap"><table className="compare-table"><thead><tr><th>Poll</th><th>Team</th><th>{left?.voter ?? "First voter"}</th><th>{right?.voter ?? "Second voter"}</th><th>Gap</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.teamId}><td>{row.pollRank ?? "NR"}</td><th scope="row">{row.team}</th><td>{row.leftRank === 26 ? "NR" : row.leftRank}</td><td>{row.rightRank === 26 ? "NR" : row.rightRank}</td><td><strong>{row.gap}</strong></td></tr>)}
    </tbody></table></div>
  </section>;
}
