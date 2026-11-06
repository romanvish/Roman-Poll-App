"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, MoveDown, MoveUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveBallotDraft, submitBallot } from "@/app/current/ballot-actions";

export type BallotTeam = { id: number; name: string; abbreviation: string; logoUrl: string | null; conference: string; record: string; conferenceRecord: string; lastResult: string; nextOpponent: string };

type Props = { weekId: string; teams: BallotTeam[]; initialTeamIds: number[]; previousTeamIds: number[] };

function RankedRow({ team, rank, expanded, onExpand, onRemove, onMove, canEdit }: {
  team: BallotTeam; rank: number; expanded: boolean; onExpand: () => void; onRemove: () => void;
  onMove: (rank: number) => void; canEdit: boolean;
}) {
  const [targetRank, setTargetRank] = useState(String(rank));
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: team.id, disabled: !canEdit });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .35 : 1 };
  return <li ref={setNodeRef} style={style} className="ranked-row">
    <div className="ranked-row-main">
      <button ref={setActivatorNodeRef} type="button" className="drag-grip" {...attributes} {...listeners} disabled={!canEdit} aria-label={`Drag ${team.name}, ranked ${rank}`}><GripVertical size={19} aria-hidden="true" /></button>
      <span className="rank-number">{rank}</span>
      {team.logoUrl && <Image className="team-logo" src={team.logoUrl} alt="" width={28} height={28} unoptimized />}
      <button type="button" className="team-expand" onClick={onExpand} aria-expanded={expanded}><span><strong>{team.name}</strong><small>{team.record} · {team.conference}</small></span><ChevronDown size={16} aria-hidden="true" /></button>
      {canEdit && <div className="rank-actions">
        <button type="button" aria-label={`Move ${team.name} up`} onClick={() => onMove(rank - 1)} disabled={rank === 1}><MoveUp size={17} /></button>
        <button type="button" aria-label={`Move ${team.name} down`} onClick={() => onMove(rank + 1)} disabled={rank === 25}><MoveDown size={17} /></button>
        <input aria-label={`Move ${team.name} to rank`} type="number" min={1} max={25} value={targetRank} onChange={(event) => setTargetRank(event.target.value)} onBlur={() => setTargetRank(String(rank))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onMove(Number(targetRank)); } }} />
        <button type="button" aria-label={`Remove ${team.name}`} onClick={onRemove}><Trash2 size={17} /></button>
      </div>}
    </div>
    {expanded && <div className="team-expanded"><span>Record <strong>{team.record}</strong></span><span>Conference <strong>{team.conferenceRecord}</strong></span><span>Last result <strong>{team.lastResult}</strong></span><span>Next <strong>{team.nextOpponent}</strong></span></div>}
  </li>;
}

export function BallotEditor({ weekId, teams, initialTeamIds, previousTeamIds }: Props) {
  const [orderedIds, setOrderedIds] = useState(initialTeamIds);
  const [search, setSearch] = useState("");
  const [conference, setConference] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState("Saving draft…");
  const [submitMessage, setSubmitMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const selected = useMemo(() => new Set(orderedIds), [orderedIds]);
  const conferences = useMemo(() => [...new Set(teams.map((team) => team.conference))].sort(), [teams]);
  const pool = teams.filter((team) => !selected.has(team.id) && (conference === "all" || team.conference === conference) && team.name.toLowerCase().includes(search.toLowerCase()));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const snapshot = [...orderedIds];
    const timer = window.setTimeout(() => {
      queue.current = queue.current.then(async () => {
        const result = await saveBallotDraft(weekId, snapshot);
        setSaveMessage(result.ok ? "Saved" : result.message);
      }).catch(() => setSaveMessage("Could not save draft."));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [orderedIds, weekId]);

  function moveTeam(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= orderedIds.length || fromIndex < 0) return;
    setSaveMessage("Saving draft…");
    setOrderedIds((ids) => arrayMove(ids, fromIndex, toIndex));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      setSaveMessage("Saving draft…");
      setOrderedIds((ids) => arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id))));
    }
  }

  async function submit() {
    setBusy(true);
    setSubmitMessage("");
    try {
      await queue.current;
      const result = await submitBallot(weekId, orderedIds);
      setSubmitMessage(result.message);
    } catch {
      setSubmitMessage("The ballot could not be submitted. Try again.");
    } finally { setBusy(false); }
  }

  function startPrevious() {
    const allowed = previousTeamIds.filter((id) => teamById.has(id));
    setSaveMessage("Saving draft…");
    setOrderedIds(allowed.slice(0, 25));
  }

  return <div className="ballot-editor">
    <section className="team-pool" aria-labelledby="team-pool-title">
      <div className="ballot-panel-heading"><div><p className="eyebrow">Available teams</p><h2 id="team-pool-title">Build your ballot</h2></div><span>{teams.length} eligible</span></div>
      <label className="team-search">Search teams<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></label>
      <label className="team-search">Conference<select value={conference} onChange={(event) => setConference(event.target.value)}><option value="all">All conferences</option>{conferences.map((item) => <option key={item}>{item}</option>)}</select></label>
      <ul className="pool-list">{pool.slice(0, 60).map((team) => <li key={team.id}><div>{team.logoUrl && <Image className="team-logo" src={team.logoUrl} alt="" width={28} height={28} unoptimized />}<span><strong>{team.name}</strong><small>{team.record} · {team.conference}</small></span></div><Button type="button" size="icon" variant="outline" aria-label={`Add ${team.name}`} disabled={orderedIds.length >= 25} onClick={() => { if (!selected.has(team.id) && orderedIds.length < 25) { setSaveMessage("Saving draft…"); setOrderedIds((ids) => [...ids, team.id]); } }}><Plus size={17} /></Button></li>)}{pool.length === 0 && <li className="pool-empty">No teams match this search.</li>}</ul>
    </section>
    <section className="ranked-panel" aria-labelledby="ranked-title">
      <div className="ballot-panel-heading"><div><p className="eyebrow">Your picks</p><h2 id="ranked-title">Top 25</h2></div><span>{orderedIds.length}/25</span></div>
      {previousTeamIds.length > 0 && <Button type="button" variant="outline" className="prefill-button" onClick={startPrevious}>Start from my last ballot</Button>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => { setActiveId(Number(active.id)); setExpandedId(null); }} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <ol className="ranked-list">{orderedIds.map((id, index) => {
            const team = teamById.get(id);
            return team ? <RankedRow key={id} team={team} rank={index + 1} expanded={expandedId === id && activeId === null} onExpand={() => setExpandedId((current) => current === id ? null : id)} onRemove={() => { setSaveMessage("Saving draft…"); setOrderedIds((ids) => ids.filter((item) => item !== id)); }} onMove={(rank) => moveTeam(index, rank - 1)} canEdit /> : null;
          })}{Array.from({ length: 25 - orderedIds.length }, (_, index) => <li className="empty-rank-slot" key={`empty-${orderedIds.length + index + 1}`}><span>{orderedIds.length + index + 1}</span><em>Add a team to this spot</em></li>)}</ol>
        </SortableContext>
        <DragOverlay>{activeId !== null && teamById.get(activeId) ? <div className="drag-overlay">{teamById.get(activeId)?.name}</div> : null}</DragOverlay>
      </DndContext>
      <div className="ballot-status"><span aria-live="polite">{saveMessage}</span><Button type="button" onClick={submit} disabled={orderedIds.length !== 25 || busy}>{busy ? "Submitting…" : "Submit ballot"}</Button></div>
      {submitMessage && <p className="form-message" role="status">{submitMessage}</p>}
    </section>
  </div>;
}
