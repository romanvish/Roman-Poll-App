"use client";

import { useEffect, useState } from "react";

export function LocalTime({ date, countdown = false }: { date: string; countdown?: boolean }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const target = new Date(date);
    const update = () => {
      if (!countdown) setLabel(target.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
      else {
        const remaining = target.getTime() - Date.now();
        if (remaining <= 0) setLabel("Deadline passed");
        else {
          const hours = Math.floor(remaining / 3_600_000);
          const minutes = Math.floor((remaining % 3_600_000) / 60_000);
          setLabel(`${hours}h ${minutes}m remaining`);
        }
      }
    };
    update();
    if (countdown) { const interval = window.setInterval(update, 60_000); return () => window.clearInterval(interval); }
  }, [countdown, date]);
  return <time dateTime={date}>{label || "Loading local time…"}</time>;
}
