"use client";

import { useEffect, useMemo, useState, useTransition, useActionState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useNow } from "@/lib/use-now";
import type { AgendaRow } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { usePageHeader } from "@/components/shell/header-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionError } from "@/components/action-error";
import {
  createAgendaEvent,
  deleteAgendaEvent,
  updateAgendaEvent,
} from "./actions";

function toLocalDateTimeParts(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function getAllDayDateParts(value: string) {
  const date = new Date(value);
  return {
    day: date.getUTCDate(),
    month: date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
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

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("agenda:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as AgendaRow;
          setEvents((prev) => prev.some((e) => e.id === row.id) ? prev : [...prev, row]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as AgendaRow;
          setEvents((prev) => prev.map((e) => (e.id === row.id ? row : e)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as AgendaRow;
          setEvents((prev) => prev.filter((e) => e.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ---- Sort: upcoming ascending, then past descending -----------------------

  const now = useNow();

  const sorted = useMemo(() => {
    const upcoming = events
      .filter((e) => new Date(e.date).getTime() >= now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const past = events
      .filter((e) => new Date(e.date).getTime() < now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return [...upcoming, ...past];
  }, [events, now]);

  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = (event: AgendaRow) => {
    if (!confirm(`Delete "${event.title}"?`)) return;
    const rollback = events;
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    startTransition(async () => {
      const { error } = await deleteAgendaEvent(event.id);
      if (error) {
        setEvents(rollback);
        setActionError(error);
      }
    });
  };

  const handleEdit = (event: AgendaRow) => { setEditing(event); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };

  usePageHeader("New event", handleNew);

  return (
    <section className="font-apple flex flex-col gap-6 text-[var(--fg)]">
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      {sorted.length === 0 ? (
        <div className="px-1 py-16 text-center">
          <p className="text-[17px] text-[var(--fg2)]">No events scheduled yet.</p>
          <p className="mt-2 text-[14px] text-[var(--fg3)]">Add appointments, deadlines, and key dates.</p>
        </div>
      ) : (
        <ListGroup>
          {sorted.map((e) => (
            <AgendaItem key={e.id} event={e} onEdit={() => handleEdit(e)} onDelete={() => handleDelete(e)} />
          ))}
        </ListGroup>
      )}

      <AgendaDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
      />
    </section>
  );
}

function AgendaItem({
  event, onEdit, onDelete,
}: {
  event: AgendaRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const d = new Date(event.date);
  const allDayParts = getAllDayDateParts(event.date);
  const day = event.all_day ? allDayParts.day : d.getDate();
  const month = event.all_day ? allDayParts.month : d.toLocaleDateString("en-GB", { month: "short" });
  const time = event.all_day ? null : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const now = useNow();
  const isPast = d.getTime() < now - 24 * 60 * 60 * 1000;

  return (
    <ListRow align="start" interactive className="group" style={isPast ? { opacity: 0.55 } : undefined}>
      <button type="button" onClick={onEdit} className="flex flex-1 items-start gap-3.5 text-left">
        <div className="w-14 flex-none text-center">
          <div className="text-[17px] font-[590] tracking-[-0.02em] tabular-nums">{day}</div>
          <div className="mt-0.5 text-[13px] text-[var(--fg3)]">{month}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] tracking-[-0.014em]">{event.title}</div>
          <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
            {[time, event.location, event.notes].filter(Boolean).join(" · ")}
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label="Delete event"
        onClick={onDelete}
        className="mt-0.5 flex-none text-[15px] leading-none text-[var(--fg3)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--accent)]"
      >
        ×
      </button>
    </ListRow>
  );
}

// ============================================================================
// Dialog — restyled with the rest of the shared dialogs later
// ============================================================================

function AgendaDialog({
  open, onOpenChange, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AgendaRow | null;
}) {
  const action = editing ? updateAgendaEvent.bind(null, editing.id) : createAgendaEvent;
  const isEdit = editing !== null;

  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true } | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  const editingLocalParts = editing ? toLocalDateTimeParts(editing.date) : null;
  const dateValue = editing
    ? editing.all_day ? editing.date.slice(0, 10) : editingLocalParts?.date ?? ""
    : "";
  const timeValue = editing && !editing.all_day ? editingLocalParts?.time ?? "" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? <>Edit <em>event</em></> : <>New <em>event</em></>}</DialogTitle>
          <DialogDescription>An appointment, deadline, or important date.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={editing?.title ?? ""} placeholder="e.g. Cake tasting" required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={dateValue} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="time">Time (optional)</Label>
              <Input id="time" name="time" type="time" defaultValue={timeValue} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input id="location" name="location" defaultValue={editing?.location ?? ""} placeholder="e.g. Charleroi" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
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
