"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WeddingDayEventRow, WeddingDayAssignee } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WEDDING_DATE } from "@/lib/config";
import { daysUntil } from "@/lib/utils";
import { createWeddingDayEvent, deleteWeddingDayEvent, updateWeddingDayEvent } from "./actions";

// ============================================================================
// Phase definitions — auto-derived from start time
// ============================================================================

type Phase = {
  key: string;
  label: string;
  emoji: string;
  startHour: number;
  endHour: number;
  color: string;
  description: string;
};

const PHASES: Phase[] = [
  { key: "morning", label: "Morning Prep", emoji: "🌅", startHour: 0, endHour: 11, color: "rose", description: "Getting ready, calm before the storm" },
  { key: "ceremony", label: "Ceremony", emoji: "💒", startHour: 11, endHour: 15, color: "burgundy", description: "The vows, the moment" },
  { key: "celebration", label: "Photos & Cocktails", emoji: "📸", startHour: 15, endHour: 18, color: "gold", description: "Capturing memories, mingling" },
  { key: "reception", label: "Reception & Dinner", emoji: "🍽️", startHour: 18, endHour: 21, color: "sage", description: "Speeches, food, toasts" },
  { key: "party", label: "Party & Dancing", emoji: "🎉", startHour: 21, endHour: 26, color: "ink", description: "Let's celebrate!" },
];

// View modes for dual perspective
type ViewMode = "all" | "bride" | "groom" | "split";

const VIEW_MODES: { key: ViewMode; label: string; emoji: string }[] = [
  { key: "all", label: "Both", emoji: "💑" },
  { key: "bride", label: "Bride", emoji: "👰" },
  { key: "groom", label: "Groom", emoji: "🤵" },
  { key: "split", label: "Side by side", emoji: "🤝" },
];

const ASSIGNEE_META: Record<WeddingDayAssignee, { emoji: string; label: string; shortLabel: string }> = {
  bride: { emoji: "👰", label: "Bride only", shortLabel: "Bride" },
  groom: { emoji: "🤵", label: "Groom only", shortLabel: "Groom" },
  both: { emoji: "💑", label: "Both partners", shortLabel: "Both" },
};

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

function formatTime(timeStr: string): string {
  const parts = timeStr.split(":");
  return `${parts[0]}:${parts[1] ?? "00"}`;
}

function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function getPhase(startTime: string): Phase {
  const hour = parseTime(startTime);
  return PHASES.find((p) => hour >= p.startHour && hour < p.endHour) ?? PHASES[PHASES.length - 1];
}

function durationMinutes(start: string, end: string): number {
  return Math.round((parseTime(end) - parseTime(start)) * 60);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ============================================================================
// Templates — quick-start schedules
// ============================================================================

type Template = {
  key: string;
  name: string;
  emoji: string;
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
    name: "Classic Wedding Day",
    emoji: "💒",
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
    name: "Intimate Ceremony",
    emoji: "✨",
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
    name: "Evening Affair",
    emoji: "🌙",
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
// Main Component
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

  // Read view mode from localStorage on mount (sync with role choice)
  useEffect(() => {
    const role = localStorage.getItem("wedding-role") as ViewMode | null;
    if (role === "bride" || role === "groom") {
      setViewMode(role);
    }
  }, []);

  // Update "now" every minute for live indicator
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

  // Filter by view mode (bride sees bride+both, groom sees groom+both, all sees all, split shows all)
  const filteredItems = useMemo(() => {
    if (viewMode === "all" || viewMode === "split") return items;
    return items.filter((i) => i.assignee === viewMode || i.assignee === "both");
  }, [items, viewMode]);

  const sorted = useMemo(
    () => [...filteredItems].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)),
    [filteredItems]
  );

  // Group by phase
  const grouped = useMemo(() => {
    const groups = new Map<string, { phase: Phase; events: WeddingDayEventRow[] }>();
    for (const event of sorted) {
      const phase = getPhase(event.start_time);
      if (!groups.has(phase.key)) {
        groups.set(phase.key, { phase, events: [] });
      }
      groups.get(phase.key)!.events.push(event);
    }
    return Array.from(groups.values());
  }, [sorted]);

  // Smart insights (over filtered items)
  const insights = useMemo(() => {
    if (sorted.length === 0) return null;

    const totalDuration = sorted.reduce((sum, e) => sum + durationMinutes(e.start_time, e.end_time), 0);
    const dayStart = sorted[0];
    const dayEnd = sorted[sorted.length - 1];
    const dayLength = durationMinutes(dayStart.start_time, dayEnd.end_time);

    const gaps: Array<{ after: WeddingDayEventRow; before: WeddingDayEventRow; minutes: number }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = durationMinutes(sorted[i].end_time, sorted[i + 1].start_time);
      if (gap > 30) {
        gaps.push({ after: sorted[i], before: sorted[i + 1], minutes: gap });
      }
    }

    const overlaps: Array<{ a: WeddingDayEventRow; b: WeddingDayEventRow }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (parseTime(sorted[i].end_time) > parseTime(sorted[i + 1].start_time)) {
        overlaps.push({ a: sorted[i], b: sorted[i + 1] });
      }
    }

    return { totalDuration, dayLength, dayStart, dayEnd, gaps, overlaps };
  }, [sorted]);

  // Counts per assignee for the view mode tabs
  const counts = useMemo<Record<ViewMode, number>>(() => ({
    all: items.length,
    bride: items.filter((i) => i.assignee === "bride" || i.assignee === "both").length,
    groom: items.filter((i) => i.assignee === "groom" || i.assignee === "both").length,
    split: items.length,
  }), [items]);

  const days = daysUntil(WEDDING_DATE);
  const isWeddingDay = days === 0;

  const currentEvent = useMemo(() => {
    if (!isWeddingDay || !now) return null;
    const currentTime = now.getHours() + now.getMinutes() / 60;
    return sorted.find((e) => {
      const start = parseTime(e.start_time);
      const end = parseTime(e.end_time);
      return currentTime >= start && currentTime < end;
    });
  }, [sorted, now, isWeddingDay]);

  const nextEvent = useMemo(() => {
    if (!isWeddingDay || !now) return null;
    const currentTime = now.getHours() + now.getMinutes() / 60;
    return sorted.find((e) => parseTime(e.start_time) > currentTime);
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

  const handleAddEvent = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>wedding day</em>
          </h2>
          <p className="text-sm text-ink-soft">
            {days > 0
              ? `${days} day${days === 1 ? "" : "s"} to plan the perfect timeline`
              : days === 0
              ? "Today is the day! ♥"
              : "Looking back on your perfect day"}
          </p>
        </div>
        {items.length > 0 && (
          <Button onClick={handleAddEvent}>+ Add event</Button>
        )}
      </div>

      {/* View mode tabs (bride/groom/both) */}
      {items.length > 0 && (
        <div className="mb-6 flex items-center gap-2 max-md:flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft mr-2">View:</span>
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-[4px] border transition-all text-[13px]
                ${viewMode === mode.key
                  ? "border-burgundy bg-burgundy/5 text-ink font-medium"
                  : "border-line text-ink-soft hover:border-ink hover:text-ink"
                }
              `}
            >
              <span>{mode.emoji}</span>
              <span>{mode.label}</span>
              <span className="text-[11px] text-ink-soft">({counts[mode.key]})</span>
            </button>
          ))}
        </div>
      )}

      {/* "Now" banner — only on wedding day */}
      {isWeddingDay && (currentEvent || nextEvent) && (
        <div className="mb-6 p-5 rounded-[4px] border border-burgundy bg-burgundy/5 animate-pulse">
          {currentEvent ? (
            <>
              <div className="text-[11px] uppercase tracking-[0.3em] text-burgundy mb-1 font-medium">
                ● Happening now
              </div>
              <div className="font-serif text-[24px] text-ink">{currentEvent.title}</div>
              {currentEvent.location && (
                <div className="text-sm text-ink-soft mt-1">📍 {currentEvent.location}</div>
              )}
              <div className="text-[12px] text-ink-soft mt-2">
                Until {formatTime12h(currentEvent.end_time)}
              </div>
            </>
          ) : nextEvent ? (
            <>
              <div className="text-[11px] uppercase tracking-[0.3em] text-burgundy mb-1 font-medium">
                Coming up next
              </div>
              <div className="font-serif text-[24px] text-ink">{nextEvent.title}</div>
              <div className="text-sm text-ink-soft mt-1">
                Starts at {formatTime12h(nextEvent.start_time)}
                {nextEvent.location && ` · 📍 ${nextEvent.location}`}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Empty state with templates */}
      {items.length === 0 ? (
        <EmptyState onApplyTemplate={handleApplyTemplate} onAddManual={handleAddEvent} />
      ) : sorted.length === 0 ? (
        // Filtered to nothing
        <div className="text-center py-16 text-ink-soft">
          <div className="font-serif text-[24px] italic mb-2">No events for this view</div>
          <p className="text-sm">Switch to another view or add events for {viewMode === "bride" ? "the bride" : "the groom"}.</p>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          {insights && (
            <div className="grid grid-cols-4 gap-4 mb-8 max-md:grid-cols-2 max-sm:grid-cols-1">
              <StatCard
                label="Events"
                value={String(sorted.length)}
                meta={`${formatDuration(insights.totalDuration)} of activity`}
              />
              <StatCard
                label="Day starts"
                value={formatTime12h(insights.dayStart.start_time)}
                meta={insights.dayStart.title}
              />
              <StatCard
                label="Day ends"
                value={formatTime12h(insights.dayEnd.end_time)}
                meta={insights.dayEnd.title}
              />
              <StatCard
                label="Total span"
                value={formatDuration(insights.dayLength)}
                meta={`${grouped.length} phase${grouped.length === 1 ? "" : "s"}`}
              />
            </div>
          )}

          {/* Smart insights — gaps only (overlaps are expected when bride/groom are doing different things) */}
          {insights && insights.gaps.length > 0 && (
            <div className="mb-6 space-y-2">
              {insights.gaps.map((gap, i) => (
                <div key={`gap-${i}`} className="text-[13px] text-ink-soft bg-paper border border-line rounded-[4px] px-4 py-2.5 flex items-center gap-2">
                  <span>⏳</span>
                  <span>
                    {formatDuration(gap.minutes)} gap between <strong>{gap.after.title}</strong> and <strong>{gap.before.title}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Main view: phase-grouped (default) OR side-by-side bride/groom */}
          {viewMode === "split" ? (
            <SideBySideView
              items={items}
              currentEventId={currentEvent?.id ?? null}
              onEdit={(e) => { setEditing(e); setDialogOpen(true); }}
            />
          ) : (
            <div className="space-y-8">
              {grouped.map(({ phase, events }) => (
                <PhaseSection
                  key={phase.key}
                  phase={phase}
                  events={events}
                  currentEventId={currentEvent?.id ?? null}
                  onEdit={(e) => { setEditing(e); setDialogOpen(true); }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Add more templates section */}
          <div className="mt-12 pt-8 border-t border-line">
            <p className="text-[11px] uppercase tracking-[0.3em] text-ink-soft mb-4 text-center">
              Need more ideas?
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleApplyTemplate(t)}
                  className="text-[13px] px-4 py-2 rounded-[4px] border border-line hover:border-burgundy hover:bg-burgundy/5 transition-colors"
                >
                  {t.emoji} Add {t.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/*
        KEY FIX: Force a fresh dialog/form mount each time it opens by keying
        on the editing id (or "new"). This guarantees useActionState resets
        and stale data from a previous submission can't leak through.
      */}
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

function StatCard({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div className="border border-line rounded-[4px] p-5 bg-paper">
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-soft mb-2 font-medium">{label}</div>
      <div className="font-serif text-[26px] text-ink leading-tight"><em>{value}</em></div>
      {meta && <div className="text-[12px] text-ink-soft mt-2 truncate">{meta}</div>}
    </div>
  );
}

function PhaseSection({
  phase,
  events,
  currentEventId,
  onEdit,
  onDelete,
}: {
  phase: Phase;
  events: WeddingDayEventRow[];
  currentEventId: string | null;
  onEdit: (e: WeddingDayEventRow) => void;
  onDelete: (e: WeddingDayEventRow) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[24px]">{phase.emoji}</span>
        <div>
          <h3 className="font-serif text-[22px] text-ink">{phase.label}</h3>
          <p className="text-[12px] text-ink-soft italic">{phase.description}</p>
        </div>
        <div className="flex-1 border-b border-dashed border-line ml-2" />
        <span className="text-[11px] text-ink-soft uppercase tracking-[0.2em]">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-3 ml-1">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            phaseColor={phase.color}
            isCurrent={event.id === currentEventId}
            onEdit={() => onEdit(event)}
            onDelete={() => onDelete(event)}
          />
        ))}
      </div>
    </div>
  );
}

function EventCard({
  event,
  phaseColor,
  isCurrent,
  onEdit,
  onDelete,
}: {
  event: WeddingDayEventRow;
  phaseColor: string;
  isCurrent: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const duration = durationMinutes(event.start_time, event.end_time);
  const assignee = event.assignee ?? "both";

  const colorMap: Record<string, { border: string; bg: string; accent: string }> = {
    rose: { border: "border-l-rose", bg: "hover:bg-rose/5", accent: "text-rose" },
    burgundy: { border: "border-l-burgundy", bg: "hover:bg-burgundy/5", accent: "text-burgundy" },
    gold: { border: "border-l-gold", bg: "hover:bg-gold/5", accent: "text-gold" },
    sage: { border: "border-l-sage", bg: "hover:bg-sage/5", accent: "text-sage" },
    ink: { border: "border-l-ink", bg: "hover:bg-ink/5", accent: "text-ink" },
  };
  const colors = colorMap[phaseColor] ?? colorMap.ink;

  return (
    <div
      onClick={onEdit}
      className={`
        group relative border border-line ${colors.border} border-l-[3px]
        bg-paper rounded-[4px] p-5 cursor-pointer transition-all
        ${colors.bg} hover:shadow-soft
        ${isCurrent ? "ring-2 ring-burgundy ring-offset-2 ring-offset-cream" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2 flex-wrap">
            <span className={`font-mono text-[15px] font-medium ${colors.accent}`}>
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </span>
            <span className="text-[11px] text-ink-soft uppercase tracking-[0.2em]">
              {formatDuration(duration)}
            </span>
            {/* Assignee badge */}
            <span
              className={`
                text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1
                ${assignee === "bride" ? "border-rose text-rose bg-rose/5" : ""}
                ${assignee === "groom" ? "border-sage text-sage bg-sage/5" : ""}
                ${assignee === "both" ? "border-line text-ink-soft bg-cream" : ""}
              `}
              title={ASSIGNEE_META[assignee].label}
            >
              <span>{ASSIGNEE_META[assignee].emoji}</span>
              <span>{ASSIGNEE_META[assignee].shortLabel}</span>
            </span>
            {isCurrent && (
              <span className="text-[10px] uppercase tracking-[0.3em] text-burgundy font-bold animate-pulse">
                ● Now
              </span>
            )}
          </div>

          <h4 className="font-serif text-[20px] text-ink mb-1 leading-tight">
            {event.title}
          </h4>

          {event.location && (
            <div className="text-[13px] text-ink-soft mb-1">
              📍 {event.location}
            </div>
          )}

          {event.notes && (
            <div className="text-[13px] text-ink-soft mt-2 italic line-clamp-2">
              {event.notes}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Delete event"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-soft hover:text-burgundy text-[18px] leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Side-by-side bride/groom timeline
// ============================================================================

function SideBySideView({
  items,
  currentEventId,
  onEdit,
}: {
  items: WeddingDayEventRow[];
  currentEventId: string | null;
  onEdit: (e: WeddingDayEventRow) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-ink-soft">
        <p className="font-serif text-[22px] italic">No events to compare yet.</p>
      </div>
    );
  }

  // Determine the time range from all events
  const minHour = Math.floor(Math.min(...items.map((e) => parseTime(e.start_time))));
  const maxHour = Math.ceil(Math.max(...items.map((e) => parseTime(e.end_time))));
  const totalHours = Math.max(1, maxHour - minHour);
  const HOUR_HEIGHT = 80; // pixels per hour

  // Sort events by start time so overlapping ones layer predictably
  const sorted = [...items].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));

  // Helper to position an event vertically
  const positionEvent = (event: WeddingDayEventRow) => {
    const startTime = parseTime(event.start_time);
    const endTime = parseTime(event.end_time);
    const duration = Math.max(0.75, endTime - startTime);
    return {
      top: (startTime - minHour) * HOUR_HEIGHT,
      height: duration * HOUR_HEIGHT,
    };
  };

  // Find moments when both partners are together
  const togetherMoments = sorted.filter((e) => e.assignee === "both");

  return (
    <div className="bg-paper border border-line rounded-[4px] shadow-soft overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_1fr] border-b border-line bg-cream">
        <div className="p-4 text-center">
          <span className="text-[10px] uppercase tracking-[0.3em] text-ink-soft font-medium">Time</span>
        </div>
        <div className="p-4 text-center border-l border-line">
          <div className="text-[28px] mb-1">👰</div>
          <div className="font-serif text-[16px] text-ink">Bride</div>
        </div>
        <div className="p-4 text-center border-l border-line">
          <div className="text-[28px] mb-1">🤵</div>
          <div className="font-serif text-[16px] text-ink">Groom</div>
        </div>
      </div>

      {/* Timeline body */}
      <div className="grid grid-cols-[80px_1fr_1fr]" style={{ height: `${totalHours * HOUR_HEIGHT}px` }}>
        {/* Time column */}
        <div className="relative border-r border-line">
          {Array.from({ length: totalHours + 1 }).map((_, i) => {
            const hour = minHour + i;
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour >= 12 && hour < 24 ? "PM" : "AM";
            return (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-start justify-center pt-1"
                style={{ top: `${i * HOUR_HEIGHT}px` }}
              >
                <span className="text-[11px] font-mono text-ink-soft">
                  {displayHour}:00 {ampm}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bride column */}
        <div className="relative border-r border-line">
          {/* Hourly gridlines */}
          {Array.from({ length: totalHours }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-dashed border-line/50"
              style={{ top: `${i * HOUR_HEIGHT}px` }}
            />
          ))}
          {/* Events */}
          {sorted
            .filter((e) => e.assignee === "bride" || e.assignee === "both")
            .map((event) => {
              const { top, height } = positionEvent(event);
              return (
                <SplitEventCard
                  key={`b-${event.id}`}
                  event={event}
                  isCurrent={event.id === currentEventId}
                  side="bride"
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={() => onEdit(event)}
                />
              );
            })}
        </div>

        {/* Groom column */}
        <div className="relative">
          {Array.from({ length: totalHours }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-dashed border-line/50"
              style={{ top: `${i * HOUR_HEIGHT}px` }}
            />
          ))}
          {sorted
            .filter((e) => e.assignee === "groom" || e.assignee === "both")
            .map((event) => {
              const { top, height } = positionEvent(event);
              return (
                <SplitEventCard
                  key={`g-${event.id}`}
                  event={event}
                  isCurrent={event.id === currentEventId}
                  side="groom"
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={() => onEdit(event)}
                />
              );
            })}
        </div>
      </div>

      {/* Legend / "together" moments callout */}
      {togetherMoments.length > 0 && (
        <div className="border-t border-line p-4 bg-burgundy/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[16px]">💑</span>
            <span className="text-[11px] uppercase tracking-[0.3em] text-burgundy font-medium">
              Together moments
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {togetherMoments.map((e) => (
              <div
                key={e.id}
                className="text-[12px] px-3 py-1 rounded-full border border-burgundy/30 bg-paper text-ink"
              >
                <span className="font-mono text-ink-soft mr-1.5">{formatTime(e.start_time)}</span>
                {e.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SplitEventCard({
  event,
  isCurrent,
  side,
  style,
  onClick,
}: {
  event: WeddingDayEventRow;
  isCurrent: boolean;
  side: "bride" | "groom";
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const isBoth = event.assignee === "both";
  const heightPx =
    typeof style.height === "number"
      ? style.height
      : typeof style.height === "string"
        ? Number.parseFloat(style.height)
        : 0;
  const isTiny = heightPx > 0 && heightPx < 56;
  const isCompact = heightPx >= 56 && heightPx < 84;
  // Color scheme: bride = rose, groom = sage, both = burgundy (linking)
  const colorClass = isBoth
    ? "bg-burgundy/10 border-burgundy text-ink hover:bg-burgundy/15"
    : side === "bride"
      ? "bg-rose/10 border-rose/60 text-ink hover:bg-rose/15"
      : "bg-sage/10 border-sage/60 text-ink hover:bg-sage/15";

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`
        absolute left-2 right-2 rounded-[4px] border text-left overflow-hidden
        transition-all hover:shadow-soft hover:z-10 cursor-pointer
        ${isTiny ? "p-1.5" : isCompact ? "p-2" : "p-2.5"}
        ${colorClass}
        ${isCurrent ? "ring-2 ring-burgundy ring-offset-1 z-10" : ""}
      `}
    >
      <div
        className={`
          font-mono text-ink-soft whitespace-nowrap
          ${isTiny ? "text-[9px] mb-0" : isCompact ? "text-[9px] mb-0.5" : "text-[10px] mb-0.5"}
        `}
      >
        {formatTime(event.start_time)}–{formatTime(event.end_time)}
        {isBoth && <span className="ml-1.5 text-burgundy">💑</span>}
      </div>
      <div
        className={`
          font-serif font-medium text-ink break-words
          ${isTiny ? "text-[11px] leading-[1.1] line-clamp-1" : ""}
          ${isCompact ? "text-[12px] leading-[1.15] line-clamp-2" : ""}
          ${!isTiny && !isCompact ? "text-[13px] leading-tight line-clamp-2" : ""}
        `}
      >
        {event.title}
      </div>
      {!isTiny && event.location && (
        <div className={`text-ink-soft break-words ${isCompact ? "text-[9px] mt-0.5 line-clamp-1" : "text-[10px] mt-0.5 line-clamp-2"}`}>
          📍 {event.location}
        </div>
      )}
    </button>
  );
}

function EmptyState({
  onApplyTemplate,
  onAddManual,
}: {
  onApplyTemplate: (t: Template) => void;
  onAddManual: () => void;
}) {
  return (
    <div className="text-center py-12 px-5">
      <div className="font-serif text-[28px] italic text-ink-soft mb-2">
        Your wedding day awaits ✨
      </div>
      <p className="text-[14px] text-ink-soft mb-10 max-w-md mx-auto">
        Start with a template to instantly map out your day, or build it event by event.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
        {TEMPLATES.map((template) => (
          <button
            key={template.key}
            onClick={() => onApplyTemplate(template)}
            className="text-left p-6 rounded-[4px] border-2 border-line hover:border-burgundy hover:bg-burgundy/5 transition-all group"
          >
            <div className="text-[36px] mb-3 group-hover:scale-110 transition-transform">
              {template.emoji}
            </div>
            <h3 className="font-serif text-[20px] text-ink mb-1">{template.name}</h3>
            <p className="text-[12px] text-ink-soft mb-3 leading-relaxed">
              {template.description}
            </p>
            <div className="text-[11px] uppercase tracking-[0.2em] text-burgundy font-medium">
              {template.events.length} events →
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="border-t border-line w-16" />
        <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft">or</span>
        <div className="border-t border-line w-16" />
      </div>

      <Button onClick={onAddManual} className="mt-6">
        + Build from scratch
      </Button>
    </div>
  );
}

// ============================================================================
// Add/Edit Dialog
// ============================================================================

function WeddingDayDialog({
  open,
  onOpenChange,
  editing,
  onEventAdded,
  onEventUpdated,
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

  // Track which assignee is selected (controlled to support pill buttons)
  const [assignee, setAssignee] = useState<WeddingDayAssignee>(editing?.assignee ?? "both");

  useEffect(() => {
    if (state?.ok && state?.data) {
      if (editing) {
        onEventUpdated(state.data);
      } else {
        onEventAdded(state.data);
      }
      onOpenChange(false);
    }
  }, [state, onOpenChange, editing, onEventAdded, onEventUpdated]);

  const startDefault = editing ? formatTime(editing.start_time) : "";
  const endDefault = editing ? formatTime(editing.end_time) : "";

  const suggestions = [
    "Hair & Makeup", "Ceremony", "First Look", "Family Photos",
    "Cocktail Hour", "Dinner", "Speeches", "First Dance",
    "Cake Cutting", "Send-off"
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

          {/* Assignee selector */}
          <div className="flex flex-col gap-2">
            <Label>Who's involved?</Label>
            <input type="hidden" name="assignee" value={assignee} />
            <div className="grid grid-cols-3 gap-2">
              {(["bride", "both", "groom"] as WeddingDayAssignee[]).map((opt) => {
                const meta = ASSIGNEE_META[opt];
                const active = assignee === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAssignee(opt)}
                    className={`
                      flex flex-col items-center justify-center gap-1 p-3 rounded-[4px] border-2 transition-all
                      ${active
                        ? "border-burgundy bg-burgundy/5"
                        : "border-line hover:border-ink/40"
                      }
                    `}
                  >
                    <span className="text-[24px]">{meta.emoji}</span>
                    <span className={`text-[12px] ${active ? "text-ink font-medium" : "text-ink-soft"}`}>
                      {meta.shortLabel}
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
