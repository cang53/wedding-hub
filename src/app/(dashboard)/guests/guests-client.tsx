"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GuestRow, GuestRsvp, GuestSide } from "@/types/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { usePageHeader } from "@/components/shell/header-context";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createGuest, deleteGuest, updateGuest } from "./actions";

const SIDE_OPTIONS: { value: GuestSide; label: string }[] = [
  { value: "bride", label: "Bride's side" },
  { value: "groom", label: "Groom's side" },
  { value: "both", label: "Both" },
];

const CATEGORY_OPTIONS = [
  "Family — Close", "Family — Extended", "Friends — Close",
  "Friends", "Colleagues", "Other",
];

const RSVP_OPTIONS: { value: GuestRsvp; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const SIDE_LABEL: Record<GuestSide, string> = {
  bride: "Selver's side",
  groom: "Celal's side",
  both: "Both sides",
};

const RSVP_LABEL: Record<GuestRsvp, string> = {
  yes: "Coming",
  no: "Declined",
  pending: "Pending",
};

const RSVP_DOT: Record<GuestRsvp, string> = {
  yes: "var(--green)",
  no: "var(--red)",
  pending: "var(--amber)",
};

interface Props {
  initialGuests: GuestRow[];
}

export function GuestsClient({ initialGuests }: Props) {
  const [guests, setGuests] = useState<GuestRow[]>(initialGuests);
  const [filter, setFilter] = useState("Everyone");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GuestRow | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("guests:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as GuestRow;
          setGuests((prev) => prev.some((g) => g.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as GuestRow;
          setGuests((prev) => prev.map((g) => (g.id === row.id ? row : g)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as GuestRow;
          setGuests((prev) => prev.filter((g) => g.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const total = guests.length;
  const yesCount = guests.filter((g) => g.rsvp === "yes").length;
  const noCount = guests.filter((g) => g.rsvp === "no").length;
  const pendingCount = guests.filter((g) => g.rsvp === "pending").length;
  const plusOnes = guests.filter((g) => g.plus_one).length;

  const categories = [...new Set(guests.map((g) => g.category).filter(Boolean))] as string[];
  const filters = ["Everyone", ...categories];

  const visibleGuests = (filter === "Everyone" ? guests : guests.filter((g) => g.category === filter))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleDelete = (g: GuestRow) => {
    if (!confirm(`Delete "${g.name}"?`)) return;
    setGuests((prev) => prev.filter((x) => x.id !== g.id));
    startTransition(() => { deleteGuest(g.id); });
  };

  usePageHeader("Add guest", () => { setEditing(null); setDialogOpen(true); });

  return (
    <section className="font-apple flex flex-col gap-6 text-[var(--fg)]">
      <div className="px-1 py-0.5">
        <div className="text-[clamp(38px,6vw,54px)] font-bold leading-none tracking-[-0.04em] tabular-nums">
          {yesCount} of {total + plusOnes} coming
        </div>
        <div className="mt-3 text-[16px] tracking-[-0.012em] text-[var(--fg2)]">
          {pendingCount} still to reply · {noCount} declined · {plusOnes} plus one{plusOnes === 1 ? "" : "s"}
        </div>
        {total > 0 && (
          <div className="mt-[18px] flex h-[6px] max-w-[520px] overflow-hidden rounded-[3px] bg-[var(--fill)]">
            <div title={`${yesCount} coming`} style={{ width: `${(yesCount / total) * 100}%`, background: "var(--green)" }} />
            <div title={`${pendingCount} pending`} style={{ width: `${(pendingCount / total) * 100}%`, background: "var(--amber)" }} />
            <div title={`${noCount} declined`} style={{ width: `${(noCount / total) * 100}%`, background: "var(--red)" }} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "h-[30px] whitespace-nowrap rounded-full px-[13px] text-[14px] tracking-[-0.01em] transition-colors",
                active ? "bg-[var(--fg)] font-[560] text-[var(--bg)]" : "bg-[var(--fill)] font-[440] text-[var(--fg)]"
              )}
            >
              {f}
            </button>
          );
        })}
      </div>

      <ListGroup>
        {visibleGuests.length === 0 ? (
          <ListRow>
            <span className="text-[15px] text-[var(--fg2)]">No guests match this filter.</span>
          </ListRow>
        ) : (
          visibleGuests.map((g) => (
            <ListRow
              key={g.id}
              as="button"
              interactive
              onClick={() => { setEditing(g); setDialogOpen(true); }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[17px] tracking-[-0.014em]">{g.name}</div>
                <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                  {SIDE_LABEL[g.side]}{g.plus_one ? ` · plus ${g.plus_one_name || "one"}` : ""}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: RSVP_DOT[g.rsvp] }} />
                <span className="text-[15px] tracking-[-0.01em] text-[var(--fg2)]">{RSVP_LABEL[g.rsvp]}</span>
              </div>
            </ListRow>
          ))
        )}
      </ListGroup>

      <GuestDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        onDelete={handleDelete}
      />
    </section>
  );
}

function SelectField({
  name, defaultValue, options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => { setValue(defaultValue); }, [defaultValue]);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function GuestDialog({
  open, onOpenChange, editing, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: GuestRow | null;
  onDelete: (g: GuestRow) => void;
}) {
  const action = editing ? updateGuest.bind(null, editing.id) : createGuest;
  const [state, formAction, pending] = useActionState<{ error?: string; ok?: true } | null, FormData>(action, null);

  useEffect(() => { if (state?.ok) onOpenChange(false); }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>guest</em></> : <>New <em>guest</em></>}</DialogTitle>
          <DialogDescription>Add someone to the celebration.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Side</Label>
              <SelectField
                name="side"
                defaultValue={editing?.side ?? "both"}
                options={SIDE_OPTIONS}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <SelectField
                name="category"
                defaultValue={editing?.category ?? "Family — Close"}
                options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Plus 1?</Label>
              <SelectField
                name="plus_one"
                defaultValue={String(editing?.plus_one ?? false)}
                options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plus_one_name">Plus 1 name (if known)</Label>
              <Input id="plus_one_name" name="plus_one_name" defaultValue={editing?.plus_one_name ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>RSVP status</Label>
              <SelectField
                name="rsvp"
                defaultValue={editing?.rsvp ?? "pending"}
                options={RSVP_OPTIONS}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Invitation sent?</Label>
              <SelectField
                name="invited"
                defaultValue={String(editing?.invited ?? false)}
                options={[{ value: "false", label: "Not yet" }, { value: "true", label: "Yes" }]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={editing?.phone ?? ""} />
          </div>

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}

          <DialogFooter>
            {editing && (
              <Button
                type="button"
                variant="danger"
                className="mr-auto"
                onClick={() => { onDelete(editing); onOpenChange(false); }}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
