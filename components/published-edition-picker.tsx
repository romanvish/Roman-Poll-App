"use client";

import { useRouter } from "next/navigation";

type Edition = { season: number; week: number; label: string };

export function PublishedEditionPicker({ editions, current, section }: {
  editions: Edition[];
  current: Pick<Edition, "season" | "week">;
  section: "ballots" | "compare";
}) {
  const router = useRouter();
  return <label className="edition-picker">
    <span>Browse editions</span>
    <select aria-label="Choose poll edition" value={`${current.season}-${current.week}`} onChange={(event) => {
      const [season, week] = event.target.value.split("-").map(Number);
      router.push(`/${section}/${season}/week/${week}`);
    }}>
      {editions.map((edition) => <option key={`${edition.season}-${edition.week}`} value={`${edition.season}-${edition.week}`}>{edition.season} · {edition.label}</option>)}
    </select>
  </label>;
}
