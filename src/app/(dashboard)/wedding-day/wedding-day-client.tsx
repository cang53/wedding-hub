"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WeddingDayEventRow } from "@/types/db";
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
  color: string; // CSS variable / class name
  description: string;
};

const PHASES: Phase[] = [
  { key: "morning", label: "Morning Prep", emoji: "🌅", startHour: 0, endHour: 11, color: "rose", description: "Getting ready, calm before the storm" },
  { key: "ceremony", label: "Ceremony", emoji: "💒", startHour: 11, endHour: 15, color: "burgundy", description: "The vows, the moment" },
  { key: "celebration", label: "Photos & Cocktails", emoji: "📸", startHour: 15, endHour: 18, color: "gold", description: "Capturing memories, mingling" },
  { key: "reception", label: "Reception & Dinner", emoji: "🍽️", startHour: 18, endHour: 21, color: "sage", description: "Speeches, food, toasts" },
  { key: "party", label: "Party & Dancing", emoji: "🎉", startHour: 21, endHour: 26, color: "ink", description: "Let's celebrate!" },
];

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
  events: Array<{ title: string; start_time: string; end_time: string; location?: string; notes?: string }>;
};

const TEMPLATES: Template[] = [
  {
    key: "classic",
    name: "Classic Wedding Day",
    emoji: "💒",
    description: "Traditional schedule from morning prep to evening party",
    events: [
      { title: "Hair & Makeup", start_time: "08:00", end_time: "11:00", location: "Bridal Suite", notes: "Bride + bridesmaids" },
      { title: "Groom Preparation", start_time: "10:00", end_time: "11:30", location: "Hotel Room" },
      { title: "First Look", start_time: "12:00", end_time: "12:30", location: "Garden", notes: "Private moment with photographer" },
      { title: "Ceremony", start_time: "13:00", end_time: "14:00", location: "Chapel", notes: "Guests arrive 30min early" },
      { title: "Cocktail Hour", start_time: "14:00", end_time: "15:30", location: "Terrace" },
      { title: "Family Photos", start_time: "14:30", end_time: "15:30", location: "Garden" },
      { title: "Reception & Dinner", start_time: "16:00", end_time: "19:00", location: "Ballroom" },
      { title: "Speeches & Toasts", start_time: "18:00", end_time: "18:45", location: "Ballroom" },
      { title: "First Dance", start_time: "19:30", end_time: "19:45", location: "Dance Floor" },
      { title: "Cake Cutting", start_time: "20:00", end_time: "20:15", location: "Ballroom" },
      { title: "Dancing & Party", start_time: "20:30", end_time: "23:30", location: "Dance Floor" },
      { title: "Send-off", start_time: "23:30", end_time: "00:00", location: "Entrance", notes: "Sparklers!" },
    ],
  },
  {
    key: "intimate",
    name: "Intimate Ceremony",
    emoji: "✨",
    description: "Smaller, simpler, more relaxed",
    events: [
      { title: "Getting Ready", start_time: "10:00", end_time: "13:00", location: "Bridal Suite" },
      { title: "Ceremony", start_time: "14:00", end_time: "14:30", location: "Garden", notes: "Short and meaningful" },
      { title: "Photos with Family", start_time: "14:30", end_time: "15:30", location: "Garden" },
      { title: "Lunch Reception", start_time: "16:00", end_time: "19:00", location: "Restaurant" },
      { title: "Toasts & Cake", start_time: "18:00", end_time: "18:45" },
    ],
  },
  {
    key: "evening",
    name: "Evening Affair",
    emoji: "🌙",
    description: "Late ceremony with reception into the night",
    events: [
      { title: "Bridal Prep", start_time: "14:00", end_time: "16:30", location: "Suite" },
      { title: "First Look & Photos", start_time: "16:30", end_time: "17:30" },
      { title: "Ceremony", start_time: "18:00", end_time: "18:45", location: "Venue" },
      { title: "Cocktail Hour", start_time: "18:45", end_time: "20:00" },
      { title: "Dinner", start_time: "20:00", end_time: "22:00" },
      { title: "Dancing", start_time: "22:00", end_time: "01:00" },
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
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<Date | null>(null);

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

  const sorted = useMemo(
    () => [...items].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)),
    [items]
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

  // Smart insights
  const insights = useMemo(() => {
    if (sorted.length === 0) return null;

    const totalDuration = sorted.reduce((sum, e) => sum + durationMinutes(e.start_time, e.end_time), 0);
    const dayStart = sorted[0];
    const dayEnd = sorted[sorted.length - 1];
    const dayLength = durationMinutes(dayStart.start_time, dayEnd.end_time);

    // Find gaps between consecutive events
    const gaps: Array<{ after: WeddingDayEventRow; before: WeddingDayEventRow; minutes: number }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = durationMinutes(sorted[i].end_time, sorted[i + 1].start_time);
      if (gap > 30) {
        gaps.push({ after: sorted[i], before: sorted[i + 1], minutes: gap });
      }
    }

    // Find overlaps
    const overlaps: Array<{ a: WeddingDayEventRow; b: WeddingDayEventRow }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (parseTime(sorted[i].end_time) > parseTime(sorted[i + 1].start_time)) {
        overlaps.push({ a: sorted[i], b: sorted[i + 1] });
      }
    }

    return { totalDuration, dayLength, dayStart, dayEnd, gaps, overlaps };
  }, [sorted]);

  // Days until wedding
  const days = daysUntil(WEDDING_DATE);
  const isWeddingDay = days === 0;

  // Find currently happening event (only if it's the wedding day)
  const currentEvent = useMemo(() => {
    if (!isWeddingDay || !now) return null;
    const currentTime = now.getHours() + now.getMinutes() / 60;
    return sorted.find((e) => {
      const start = parseTime(e.start_time);
      const end = parseTime(e.end_time);
      return currentTime >= start && currentTime < end;
    });
  }, [sorted, now, isWeddingDay]);

  // Find next upcoming event
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
      await createWeddingDayEvent(null, fd);
    }
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
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
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ Add event</Button>
        )}
      </div>

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
        <EmptyState onApplyTemplate={handleApplyTemplate} onAddManual={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <>
          {/* Stats bar */}
          {insights && (
            <div className="grid grid-cols-4 gap-4 mb-8 max-md:grid-cols-2 max-sm:grid-cols-1">
              <StatCard
                label="Events"
                value={String(items.length)}
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

          {/* Smart insights warnings */}
          {insights && (insights.overlaps.length > 0 || insights.gaps.length > 0) && (
            <div className="mb-6 space-y-2">
              {insights.overlaps.map((overlap, i) => (
                <div key={`overlap-${i}`} className="text-[13px] text-burgundy bg-burgundy/5 border border-burgundy/30 rounded-[4px] px-4 py-2.5 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>
                    <strong>{overlap.a.title}</strong> overlaps with <strong>{overlap.b.title}</strong>
                  </span>
                </div>
              ))}
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

          {/* Phase-grouped events */}
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

      <WeddingDayDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
      />
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
      {/* Phase header */}
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

      {/* Events in this phase */}
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

  // Map phase color to bg/border classes
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
          {/* Time and duration */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`font-mono text-[15px] font-medium ${colors.accent}`}>
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </span>
            <span className="text-[11px] text-ink-soft uppercase tracking-[0.2em]">
              {formatDuration(duration)}
            </span>
            {isCurrent && (
              <span className="text-[10px] uppercase tracking-[0.3em] text-burgundy font-bold animate-pulse">
                ● Now
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="font-serif text-[20px] text-ink mb-1 leading-tight">
            {event.title}
          </h4>

          {/* Location */}
          {event.location && (
            <div className="text-[13px] text-ink-soft mb-1">
              📍 {event.location}
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="text-[13px] text-ink-soft mt-2 italic line-clamp-2">
              {event.notes}
            </div>
          )}
        </div>

        {/* Delete button */}
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

      {/* Template cards */}
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

      {/* Or start blank */}
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: WeddingDayEventRow | null;
}) {
  const action = editing ? updateWeddingDayEvent.bind(null, editing.id) : createWeddingDayEvent;
  const [state, formAction, pending] = useActionState<{ error?: string; ok?: true } | null, FormData>(action, null);

  useEffect(() => { if (state?.ok) onOpenChange(false); }, [state, onOpenChange]);

  const startDefault = editing ? formatTime(editing.start_time) : "";
  const endDefault = editing ? formatTime(editing.end_time) : "";

  // Quick-pick suggestions
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add to day"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
