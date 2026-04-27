"use client";

import { useEffect, useMemo, useState, useTransition, useActionState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AgendaRow } from "@/types/db";
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
import {
  createAgendaEvent,
  deleteAgendaEvent,
  updateAgendaEvent,
} from "./actions";

function toLocalDateTimeParts(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const iso = local.toISOString();

  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
  };
}

function getAllDayDateParts(value: string) {
  const date = new Date(value);

  return {
    day: date.getUTCDate(),
    month: date
      .toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
      .toUpperCase(),
    year: date.getUTCFullYear(),
  };
}

interface Props {
  initialEvents: AgendaRow[];
}

export function AgendaClient({ initialEvents }: Props) {
  const [events, setEvents] = useState<AgendaRow[]>(initialEvents);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaRow | null>(null);

  // ---- Realtime -------------------------------------------------------------

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("agenda:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agenda" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as AgendaRow;
            setEvents((prev) =>
              prev.some((e) => e.id === row.id) ? prev : [...prev, row]
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as AgendaRow;
            setEvents((prev) => prev.map((e) => (e.id === row.id ? row : e)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as AgendaRow;
            setEvents((prev) => prev.filter((e) => e.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---- Sort: upcoming ascending, then past descending -----------------------

  const sorted = useMemo(() => {
    const now = Date.now();
    const upcoming = events
      .filter((e) => new Date(e.date).getTime() >= now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const past = events
      .filter((e) => new Date(e.date).getTime() < now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return [...upcoming, ...past];
  }, [events]);

  // ---- Actions --------------------------------------------------------------

  const [, startTransition] = useTransition();

  const handleDelete = (event: AgendaRow) => {
    if (!confirm(`Delete "${event.title}"?`)) return;
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    startTransition(() => {
      deleteAgendaEvent(event.id);
    });
  };

  const handleEdit = (event: AgendaRow) => {
    setEditing(event);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Panel header */}
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>agenda</em>
          </h2>
          <p className="text-sm text-ink-soft">
            Important dates and appointments leading up to the big day.
          </p>
        </div>
        <Button onClick={handleNew}>+ New event</Button>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="list-none">
          {sorted.map((e) => (
            <AgendaItem
              key={e.id}
              event={e}
              onEdit={() => handleEdit(e)}
              onDelete={() => handleDelete(e)}
            />
          ))}
        </ul>
      )}

      <AgendaDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
      />
    </section>
  );
}

// ============================================================================
// Single agenda item
// ============================================================================

function AgendaItem({
  event,
  onEdit,
  onDelete,
}: {
  event: AgendaRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const d = new Date(event.date);
  const localParts = toLocalDateTimeParts(event.date);
  const allDayParts = getAllDayDateParts(event.date);
  const day = event.all_day ? allDayParts.day : d.getDate();
  const month = event.all_day
    ? allDayParts.month
    : d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  const year = event.all_day ? allDayParts.year : d.getFullYear();
  const time = event.all_day
    ? null
    : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const isPast = d.getTime() < Date.now() - 24 * 60 * 60 * 1000;

  return (
    <li
      className={`grid grid-cols-[100px_1fr_auto] gap-6 py-5 border-b border-line items-center max-md:grid-cols-[80px_1fr] max-md:gap-4 ${
        isPast ? "opacity-55" : ""
      }`}
    >
      <div className="text-center font-serif">
        <div className="text-[38px] leading-none font-medium text-burgundy">
          {day}
        </div>
        <div className="text-[11px] tracking-[0.2em] text-ink-soft mt-1 font-sans">
          {month}
        </div>
        <div className="text-[11px] text-ink-soft mt-0.5 font-sans">{year}</div>
      </div>

      <div>
        <button
          type="button"
          onClick={onEdit}
          className="font-serif text-[22px] font-medium text-ink mb-1 text-left hover:text-burgundy transition-colors"
        >
          {event.title}
        </button>
        <div className="text-[13px] text-ink-soft space-y-1">
          {time && <div>{time}</div>}
          {event.location && <div>{event.location}</div>}
          {event.notes && <div className="italic">{event.notes}</div>}
        </div>
      </div>

      <Button
        variant="danger"
        size="sm"
        onClick={onDelete}
        className="self-center max-md:col-span-2 max-md:justify-self-start"
      >
        Delete
      </Button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-15 px-5 text-ink-soft">
      <div className="empty-ornament mb-3">❦</div>
      <p className="font-serif italic text-[22px]">No events scheduled yet.</p>
      <p className="text-[13px] mt-2">
        Add appointments, deadlines, and key dates.
      </p>
    </div>
  );
}

// ============================================================================
// Dialog
// ============================================================================

function AgendaDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AgendaRow | null;
}) {
  const action = editing
    ? updateAgendaEvent.bind(null, editing.id)
    : createAgendaEvent;
  const isEdit = editing !== null;

  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true } | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  // Pre-fill date/time inputs from the existing event timestamp.
  const editingLocalParts = editing ? toLocalDateTimeParts(editing.date) : null;
  const dateValue = editing
    ? editing.all_day
      ? editing.date.slice(0, 10)
      : editingLocalParts?.date ?? ""
    : "";
  const timeValue =
    editing && !editing.all_day
      ? editingLocalParts?.time ?? ""
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? (
              <>
                Edit <em>event</em>
              </>
            ) : (
              <>
                New <em>event</em>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            An appointment, deadline, or important date.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={editing?.title ?? ""}
              placeholder="e.g. Cake tasting"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={dateValue}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="time">Time (optional)</Label>
              <Input
                id="time"
                name="time"
                type="time"
                defaultValue={timeValue}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              name="location"
              defaultValue={editing?.location ?? ""}
              placeholder="e.g. Charleroi"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={editing?.notes ?? ""}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-burgundy">{state.error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
