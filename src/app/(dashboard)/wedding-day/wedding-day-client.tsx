"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WeddingDayEventRow, WeddingDayAssignee } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { Segmented } from "@/components/ui/segmented";
import { usePageHeader } from "@/components/shell/header-context";
import { WEDDING_DATE } from "@/lib/config";
import { daysUntil } from "@/lib/utils";
import { createWeddingDayEvent, deleteWeddingDayEvent, updateWeddingDayEvent } from "./actions";

// ============================================================================
// Phases — boundaries fixed by start hour, per the design handoff.
// ============================================================================

type Phase = { key: string; label: string; fromHour: number; toHour: number };

const PHASES: Phase[] = [
  { key: "morning", label: "Morning", fromHour: 0, toHour: 11.25 },
  { key: "ceremony", label: "Ceremony", fromHour: 11.25, toHour: 15 },
  { key: "afternoon", label: "Afternoon", fromHour: 15, toHour: 18 },
  { key: "dinner", label: "Dinner", fromHour: 18, toHour: 21 },
  { key: "evening", label: "Evening", fromHour: 21, toHour: Infinity },
];

type ViewMode = "all" | "bride" | "groom";

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "all", label: "Both" },
  { value: "bride", label: "Selver" },
  { value: "groom", label: "Celal" },
];

const ASSIGNEE_LABEL: Record<WeddingDayAssignee, string> = { bride: "Selver", groom: "Celal", both: "" };

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

/** "13:00:00" -> "13:00"; a literal "24:00" (open-past-midnight data) renders as "00:00". */
function clock(timeStr: string): string {
  const [hRaw, mRaw] = timeStr.split(":");
  const h = hRaw === "24" ? "00" : hRaw.padStart(2, "0");
  return `${h}:${(mRaw ?? "00").padStart(2, "0")}`;
}

function durationMinutes(start: string, end: string): number {
  return Math.round((parseTime(end) - parseTime(start)) * 60);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins}`;
}

function getPhase(startTime: string): Phase {
  const hour = parseTime(startTime);
  return PHASES.find((p) => hour >= p.fromHour && hour < p.toHour) ?? PHASES[PHASES.length - 1];
}

// ============================================================================
// Templates — quick-start schedules
// ============================================================================

type Template = {
  key: string;
  name: string;
  description: string;
  events: Array<{
    title: string;
    start_time: string;
    end_time: string;
    location?: string;
    notes?: string;
    assignee?: WeddingDayAssignee;
  }>;
};

const TEMPLATES: Template[] = [
  {
    key: "classic",
    name: "Classic wedding day",
    description: "Traditional schedule from morning prep to evening party",
    events: [
      { title: "Hair & Makeup", start_time: "08:00", end_time: "11:00", location: "Bridal Suite", notes: "Bride + bridesmaids", assignee: "bride" },
      { title: "Groom Preparation", start_time: "10:00", end_time: "11:30", location: "Hotel Room", assignee: "groom" },
      { title: "First Look", start_time: "12:00", end_time: "12:30", location: "Garden", notes: "Private moment with photographer", assignee: "both" },
      { title: "Ceremony", start_time: "13:00", end_time: "14:00", location: "Chapel", notes: "Guests arrive 30min early", assignee: "both" },
      { title: "Cocktail Hour", start_time: "14:00", end_time: "15:30", location: "Terrace", assignee: "both" },
      { title: "Family Photos", start_time: "14:30", end_time: "15:30", location: "Garden", assignee: "both" },
      { title: "Reception & Dinner", start_time: "16:00", end_time: "19:00", location: "Ballroom", assignee: "both" },
      { title: "Speeches & Toasts", start_time: "18:00", end_time: "18:45", location: "Ballroom", assignee: "both" },
      { title: "First Dance", start_time: "19:30", end_time: "19:45", location: "Dance Floor", assignee: "both" },
      { title: "Cake Cutting", start_time: "20:00", end_time: "20:15", location: "Ballroom", assignee: "both" },
      { title: "Dancing & Party", start_time: "20:30", end_time: "23:30", location: "Dance Floor", assignee: "both" },
      { title: "Send-off", start_time: "23:30", end_time: "00:00", location: "Entrance", notes: "Sparklers!", assignee: "both" },
    ],
  },
  {
    key: "intimate",
    name: "Intimate ceremony",
    description: "Smaller, simpler, more relaxed",
    events: [
      { title: "Bride Getting Ready", start_time: "10:00", end_time: "13:00", location: "Bridal Suite", assignee: "bride" },
      { title: "Groom Getting Ready", start_time: "11:00", end_time: "13:00", location: "Suite", assignee: "groom" },
      { title: "Ceremony", start_time: "14:00", end_time: "14:30", location: "Garden", notes: "Short and meaningful", assignee: "both" },
      { title: "Photos with Family", start_time: "14:30", end_time: "15:30", location: "Garden", assignee: "both" },
      { title: "Lunch Reception", start_time: "16:00", end_time: "19:00", location: "Restaurant", assignee: "both" },
      { title: "Toasts & Cake", start_time: "18:00", end_time: "18:45", assignee: "both" },
    ],
  },
  {
    key: "evening",
    name: "Evening affair",
    description: "Late ceremony with reception into the night",
    events: [
      { title: "Bridal Prep", start_time: "14:00", end_time: "16:30", location: "Suite", assignee: "bride" },
      { title: "Groom Prep", start_time: "15:00", end_time: "16:30", location: "Suite", assignee: "groom" },
      { title: "First Look & Photos", start_time: "16:30", end_time: "17:30", assignee: "both" },
      { title: "Ceremony", start_time: "18:00", end_time: "18:45", location: "Venue", assignee: "both" },
      { title: "Cocktail Hour", start_time: "18:45", end_time: "20:00", assignee: "both" },
      { title: "Dinner", start_time: "20:00", end_time: "22:00", assignee: "both" },
      { title: "Dancing", start_time: "22:00", end_time: "01:00", assignee: "both" },
    ],
  },
];

// ============================================================================
// Main component
// ============================================================================

interface Props {
  initialItems: WeddingDayEventRow[];
}

export function WeddingDayClient({ initialItems }: Props) {
  const [items, setItems] = useState<WeddingDayEventRow[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WeddingDayEventRow | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const role = localStorage.getItem("wedding-role") as ViewMode | null;
    if (role === "bride" || role === "groom") setViewMode(role);
  }, []);

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("wedding_day_events:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "wedding_day_events" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as WeddingDayEventRow;
          setItems((prev) => prev.some((i) => i.id === row.id) ? prev : [...prev, row]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as WeddingDayEventRow;
          setItems((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as WeddingDayEventRow;
          setItems((prev) => prev.filter((i) => i.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredItems = useMemo(
    () => (viewMode === "all" ? items : items.filter((i) => i.assignee === viewMode || i.assignee === "both")),
    [items, viewMode]
  );

  const sorted = useMemo(
    () => [...filteredItems].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)),
    [filteredItems]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, { phase: Phase; events: WeddingDayEventRow[] }>();
    for (const event of sorted) {
      const phase = getPhase(event.start_time);
      if (!groups.has(phase.key)) groups.set(phase.key, { phase, events: [] });
      groups.get(phase.key)!.events.push(event);
    }
    return Array.from(groups.values());
  }, [sorted]);

  const days = daysUntil(WEDDING_DATE);
  const isWeddingDay = days === 0;

  const currentEvent = useMemo(() => {
    if (!isWeddingDay || !now) return null;
    const t = now.getHours() + now.getMinutes() / 60;
    return sorted.find((e) => t >= parseTime(e.start_time) && t < parseTime(e.end_time)) ?? null;
  }, [sorted, now, isWeddingDay]);

  const nextEvent = useMemo(() => {
    if (!isWeddingDay || !now) return null;
    const t = now.getHours() + now.getMinutes() / 60;
    return sorted.find((e) => parseTime(e.start_time) > t) ?? null;
  }, [sorted, now, isWeddingDay]);

  const handleDelete = (item: WeddingDayEventRow) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteWeddingDayEvent(item.id); });
  };

  const handleApplyTemplate = async (template: Template) => {
    if (items.length > 0) {
      if (!confirm(`This will add ${template.events.length} events to your day. Continue?`)) return;
    }
    for (const event of template.events) {
      const fd = new FormData();
      fd.set("title", event.title);
      fd.set("start_time", event.start_time);
      fd.set("end_time", event.end_time);
      fd.set("location", event.location ?? "");
      fd.set("notes", event.notes ?? "");
      fd.set("assignee", event.assignee ?? "both");
      const result = await createWeddingDayEvent(null, fd);
      if (result && "data" in result && result.data) {
        const created = result.data;
        setItems((prev) => prev.some((i) => i.id === created.id) ? prev : [...prev, created]);
      }
    }
  };

  const handleAddEvent = () => { setEditing(null); setDialogOpen(true); };

  usePageHeader(items.length > 0 ? "Add event" : undefined, handleAddEvent);

  const banner = currentEvent
    ? { label: "Happening now", event: currentEvent }
    : nextEvent
      ? { label: "Coming up next", event: nextEvent }
      : null;

  return (
    <section className="font-apple flex flex-col gap-[26px] text-[var(--fg)]">
      <Segmented options={VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />

      {sorted.length > 0 && (
        <div className="px-1 text-[16px] tracking-[-0.012em] text-[var(--fg2)]">
          {sorted.length} event{sorted.length === 1 ? "" : "s"}, {clock(sorted[0].start_time)} to {clock(sorted[sorted.length - 1].end_time)}
        </div>
      )}

      {banner && (
        <div>
          <div className="px-[18px] pb-[7px] text-[13px] tracking-[-0.004em] text-[var(--accent)]">{banner.label}</div>
          <ListGroup>
            <EventRow event={banner.event} />
          </ListGroup>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState onApplyTemplate={handleApplyTemplate} onAddManual={handleAddEvent} />
      ) : sorted.length === 0 ? (
        <div className="px-1 py-8 text-[15px] text-[var(--fg2)]">
          No events for this view. Switch views or add an event.
        </div>
      ) : (
        <>
          {grouped.map(({ phase, events }) => (
            <ListGroup key={phase.key} label={phase.label}>
              {events.map((event) => (
                <ListRow key={event.id} align="start" interactive className="group">
                  <button
                    type="button"
                    onClick={() => { setEditing(event); setDialogOpen(true); }}
                    className="flex flex-1 items-start gap-3.5 text-left"
                  >
                    <EventRowContent event={event} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete event"
                    onClick={() => handleDelete(event)}
                    className="mt-0.5 flex-none text-[15px] leading-none text-[var(--fg3)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--accent)]"
                  >
                    ×
                  </button>
                </ListRow>
              ))}
            </ListGroup>
          ))}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[13px] text-[var(--fg3)]">
            <span>Need more ideas?</span>
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleApplyTemplate(t)}
                className="text-[var(--accent)] transition-opacity hover:opacity-60"
              >
                Add {t.name}
              </button>
            ))}
          </div>
        </>
      )}

      {dialogOpen && (
        <WeddingDayDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
          editing={editing}
          onEventAdded={(event) => {
            setItems((prev) => prev.some((i) => i.id === event.id) ? prev : [...prev, event]);
          }}
          onEventUpdated={(event) => {
            setItems((prev) => prev.map((i) => (i.id === event.id ? event : i)));
          }}
        />
      )}
    </section>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

/** Read-only row content for the happening-now banner (no edit affordance). */
function EventRow({ event }: { event: WeddingDayEventRow }) {
  return (
    <ListRow align="start">
      <EventRowContent event={event} />
    </ListRow>
  );
}

function EventRowContent({ event }: { event: WeddingDayEventRow }) {
  const sub = [event.location, event.notes].filter(Boolean).join(" · ");
  const badge = ASSIGNEE_LABEL[event.assignee];
  return (
    <>
      <div className="w-16 flex-none">
        <div className="text-[17px] font-[590] tracking-[-0.02em] tabular-nums">{clock(event.start_time)}</div>
        <div className="mt-0.5 text-[13px] tabular-nums text-[var(--fg3)]">
          {formatDuration(durationMinutes(event.start_time, event.end_time))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] tracking-[-0.014em]">{event.title}</div>
        {sub && <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">{sub}</div>}
      </div>
      {badge && <span className="text-[14px] whitespace-nowrap text-[var(--fg2)]">{badge}</span>}
    </>
  );
}

function EmptyState({
  onApplyTemplate, onAddManual,
}: {
  onApplyTemplate: (t: Template) => void;
  onAddManual: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="px-1">
        <div className="text-[17px] tracking-[-0.014em]">Your wedding day awaits.</div>
        <p className="mt-1 text-[14px] text-[var(--fg2)]">Start from a template, or build it event by event.</p>
      </div>

      <ListGroup label="Start from a template">
        {TEMPLATES.map((t) => (
          <ListRow key={t.key} as="button" interactive onClick={() => onApplyTemplate(t)}>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] tracking-[-0.014em]">{t.name}</div>
              <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                {t.description} · {t.events.length} events
              </div>
            </div>
          </ListRow>
        ))}
      </ListGroup>

      <button
        type="button"
        onClick={onAddManual}
        className="self-start px-1 text-[15px] text-[var(--accent)] transition-opacity hover:opacity-60"
      >
        Build from scratch
      </button>
    </div>
  );
}

// ============================================================================
// Add/Edit dialog — restyled with the rest of the shared dialogs later
// ============================================================================

function WeddingDayDialog({
  open, onOpenChange, editing, onEventAdded, onEventUpdated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: WeddingDayEventRow | null;
  onEventAdded: (event: WeddingDayEventRow) => void;
  onEventUpdated: (event: WeddingDayEventRow) => void;
}) {
  const action = editing ? updateWeddingDayEvent.bind(null, editing.id) : createWeddingDayEvent;
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: WeddingDayEventRow } | null,
    FormData
  >(action, null);
  const [assignee, setAssignee] = useState<WeddingDayAssignee>(editing?.assignee ?? "both");

  useEffect(() => {
    if (state?.ok && state?.data) {
      if (editing) onEventUpdated(state.data); else onEventAdded(state.data);
      onOpenChange(false);
    }
  }, [state, onOpenChange, editing, onEventAdded, onEventUpdated]);

  const startDefault = editing ? clock(editing.start_time) : "";
  const endDefault = editing ? clock(editing.end_time) : "";

  const suggestions = [
    "Hair & Makeup", "Ceremony", "First Look", "Family Photos",
    "Cocktail Hour", "Dinner", "Speeches", "First Dance",
    "Cake Cutting", "Send-off",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>event</em></> : <>New <em>event</em></>}</DialogTitle>
          <DialogDescription>A moment in your wedding day timeline.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Event title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={editing?.title ?? ""}
              placeholder="e.g. Ceremony, Reception, Photos"
              required
              autoFocus
            />
            {!editing && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => {
                      const input = (e.currentTarget.closest("form")?.querySelector("#title") as HTMLInputElement);
                      if (input) input.value = s;
                    }}
                    className="text-[11px] px-2 py-1 rounded-full border border-line hover:border-burgundy hover:bg-burgundy/5 text-ink-soft hover:text-ink transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">Start time</Label>
              <Input id="start_time" name="start_time" type="time" defaultValue={startDefault} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end_time">End time</Label>
              <Input id="end_time" name="end_time" type="time" defaultValue={endDefault} required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Who&rsquo;s involved?</Label>
            <input type="hidden" name="assignee" value={assignee} />
            <div className="grid grid-cols-3 gap-2">
              {(["bride", "both", "groom"] as WeddingDayAssignee[]).map((opt) => {
                const active = assignee === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAssignee(opt)}
                    className={`flex items-center justify-center p-3 rounded-[4px] border-2 transition-all ${
                      active ? "border-burgundy bg-burgundy/5" : "border-line hover:border-ink/40"
                    }`}
                  >
                    <span className={`text-[12px] ${active ? "text-ink font-medium" : "text-ink-soft"}`}>
                      {opt === "bride" ? "Selver" : opt === "groom" ? "Celal" : "Both"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location <span className="text-ink-soft text-[11px]">(optional)</span></Label>
            <Input id="location" name="location" defaultValue={editing?.location ?? ""} placeholder="e.g. Cathedral, Ballroom" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes <span className="text-ink-soft text-[11px]">(optional)</span></Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} placeholder="Vendor info, what to bring, who's involved..." rows={3} />
          </div>

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add to day"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
