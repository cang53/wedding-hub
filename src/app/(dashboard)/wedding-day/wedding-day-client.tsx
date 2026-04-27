"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
import { createWeddingDayEvent, deleteWeddingDayEvent, updateWeddingDayEvent } from "./actions";

const TIMELINE_START = 6;
const TIMELINE_END = 23;
const HOUR_HEIGHT = 64;

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

// "14:00:00" or "14:00" → "14:00"
function formatTime(timeStr: string): string {
  const parts = timeStr.split(":");
  return `${parts[0]}:${parts[1] ?? "00"}`;
}

// "14:00" → "2:00 PM"
function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function getCategoryColor(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("ceremony") || lower.includes("vow")) return "burgundy";
  if (lower.includes("reception") || lower.includes("dinner") || lower.includes("dance") || lower.includes("party")) return "gold";
  if (lower.includes("photo") || lower.includes("picture")) return "rose";
  if (lower.includes("prep") || lower.includes("makeup") || lower.includes("dress") || lower.includes("hair")) return "sage";
  return "ink-soft";
}

interface Props {
  initialItems: WeddingDayEventRow[];
}

export function WeddingDayClient({ initialItems }: Props) {
  const [items, setItems] = useState<WeddingDayEventRow[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WeddingDayEventRow | null>(null);
  const [, startTransition] = useTransition();

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

  const sorted = [...items].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));

  const handleDelete = (item: WeddingDayEventRow) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteWeddingDayEvent(item.id); });
  };

  // Calculate dynamic timeline range based on actual events.
  // If events go before 6am or after 11pm, expand to fit.
  const minHour = items.length === 0
    ? TIMELINE_START
    : Math.min(TIMELINE_START, ...items.map((e) => Math.floor(parseTime(e.start_time))));
  const maxHour = items.length === 0
    ? TIMELINE_END
    : Math.max(TIMELINE_END, ...items.map((e) => Math.ceil(parseTime(e.end_time))));

  const totalHours = maxHour - minHour;
  const totalDuration = items.reduce((sum, e) => sum + (parseTime(e.end_time) - parseTime(e.start_time)), 0);
  const earliestEvent = sorted[0];
  const latestEvent = sorted[sorted.length - 1];

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Panel header */}
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>wedding day</em>
          </h2>
          <p className="text-sm text-ink-soft">Plan the timeline of events from ceremony to celebration.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ Add event</Button>
      </div>

      {/* Stats overview */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8 max-md:grid-cols-1">
          <div className="stat-card">
            <div className="label">Events planned</div>
            <div className="value"><em>{items.length}</em></div>
            <div className="meta">{totalDuration.toFixed(1)} hours of celebration</div>
          </div>
          <div className="stat-card">
            <div className="label">Day starts at</div>
            <div className="value"><em>{earliestEvent ? formatTime12h(earliestEvent.start_time) : "—"}</em></div>
            <div className="meta">{earliestEvent?.title ?? ""}</div>
          </div>
          <div className="stat-card">
            <div className="label">Day ends at</div>
            <div className="value"><em>{latestEvent ? formatTime12h(latestEvent.end_time) : "—"}</em></div>
            <div className="meta">{latestEvent?.title ?? ""}</div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-paper border border-line rounded-[4px] shadow-soft p-7">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="wedding-timeline" style={{ minHeight: `${totalHours * HOUR_HEIGHT}px` }}>
            {/* Time markers */}
            <div className="timeline-labels">
              {Array.from({ length: totalHours + 1 }).map((_, i) => {
                const hour = minHour + i;
                const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                const ampm = hour >= 12 && hour < 24 ? "PM" : "AM";
                return (
                  <div key={hour} className="timeline-hour" style={{ height: `${HOUR_HEIGHT}px` }}>
                    <span className="timeline-time">{displayHour}:00 {ampm}</span>
                  </div>
                );
              })}
            </div>

            {/* Events */}
            <div className="timeline-events">
              {sorted.map((event) => {
                const startTime = parseTime(event.start_time);
                const endTime = parseTime(event.end_time);
                const duration = Math.max(0.5, endTime - startTime); // min 30min visual height
                const topOffset = (startTime - minHour) * HOUR_HEIGHT;
                const height = duration * HOUR_HEIGHT;
                const categoryColor = getCategoryColor(event.title);

                return (
                  <div
                    key={event.id}
                    className={`timeline-event event-${categoryColor}`}
                    style={{ top: `${topOffset}px`, height: `${height}px` }}
                    onClick={() => { setEditing(event); setDialogOpen(true); }}
                  >
                    <div className="timeline-event-inner">
                      <div className="timeline-event-time">
                        {formatTime(event.start_time)} – {formatTime(event.end_time)}
                      </div>
                      <div className="timeline-event-title">{event.title}</div>
                      {event.location && <div className="timeline-event-location">📍 {event.location}</div>}
                      {event.notes && height > 80 && (
                        <div className="timeline-event-notes">{event.notes}</div>
                      )}
                      <button
                        type="button"
                        className="timeline-event-delete"
                        aria-label="Delete event"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(event);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <WeddingDayDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
      />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-15 px-5 text-ink-soft">
      <div className="empty-ornament mb-3">◇</div>
      <p className="font-serif italic text-[22px]">No events planned yet.</p>
      <p className="text-[13px] mt-2">Add the ceremony, reception, photos — build your perfect day.</p>
    </div>
  );
}

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

  // Strip seconds from time fields for the input[type=time]
  const startDefault = editing ? formatTime(editing.start_time) : "";
  const endDefault = editing ? formatTime(editing.end_time) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>event</em></> : <>New <em>event</em></>}</DialogTitle>
          <DialogDescription>Add a moment to your wedding day timeline.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
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
            <p className="text-[11px] text-ink-soft mt-1">
              Tip: words like &ldquo;ceremony&rdquo;, &ldquo;reception&rdquo;, &ldquo;photos&rdquo;, &ldquo;preparation&rdquo; auto-color the timeline.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">Start time</Label>
              <Input
                id="start_time"
                name="start_time"
                type="time"
                defaultValue={startDefault}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end_time">End time</Label>
              <Input
                id="end_time"
                name="end_time"
                type="time"
                defaultValue={endDefault}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              name="location"
              defaultValue={editing?.location ?? ""}
              placeholder="e.g. Cathedral, Ballroom"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={editing?.notes ?? ""}
              placeholder="Any additional details..."
              rows={3}
            />
          </div>

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
