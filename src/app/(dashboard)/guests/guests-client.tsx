"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GuestRow, GuestRsvp, GuestSide } from "@/types/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { Segmented } from "@/components/ui/segmented";
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

type GuestView = "party" | "list";
type GroupBy = "none" | "rsvp" | "side";

export function GuestsClient({ initialGuests }: Props) {
  const [guests, setGuests] = useState<GuestRow[]>(initialGuests);
  const [filter, setFilter] = useState("Everyone");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<GuestView>("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
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

  const searchLower = search.trim().toLowerCase();
  const visibleGuests = (filter === "Everyone" ? guests : guests.filter((g) => g.category === filter))
    .filter((g) => !searchLower || g.name.toLowerCase().includes(searchLower))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const guestGroups = groupGuests(visibleGuests, groupBy);

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

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search guests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1"
        />
        <Segmented
          options={[{ value: "list", label: "List" }, { value: "party", label: "Party" }]}
          value={view}
          onChange={setView}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        {view === "list" && (
          <Segmented
            options={[{ value: "none", label: "A–Z" }, { value: "rsvp", label: "RSVP" }, { value: "side", label: "Side" }]}
            value={groupBy}
            onChange={setGroupBy}
          />
        )}
      </div>

      {view === "party" ? (
        <GuestParty guests={visibleGuests} onEdit={(g) => { setEditing(g); setDialogOpen(true); }} />
      ) : visibleGuests.length === 0 ? (
        <ListGroup>
          <ListRow>
            <span className="text-[15px] text-[var(--fg2)]">No guests match this search.</span>
          </ListRow>
        </ListGroup>
      ) : (
        <div className="flex flex-col gap-6">
          {guestGroups.map((group) => (
            <ListGroup key={group.label ?? "all"} label={group.label}>
              {group.guests.map((g) => (
                <ListRow
                  key={g.id}
                  as="button"
                  interactive
                  onClick={() => { setEditing(g); setDialogOpen(true); }}
                >
                  <GuestInitials guest={g} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] tracking-[-0.014em]">{g.name}</div>
                    <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                      {SIDE_LABEL[g.side]}{g.plus_one ? ` · plus ${g.plus_one_name || "one"}` : ""}
                    </div>
                  </div>
                  <span className="ml-auto text-[15px] whitespace-nowrap tracking-[-0.01em] text-[var(--fg2)]">
                    {RSVP_LABEL[g.rsvp]}
                  </span>
                </ListRow>
              ))}
            </ListGroup>
          ))}
        </div>
      )}

      <GuestDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        onDelete={handleDelete}
      />
    </section>
  );
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/** Small static initials badge with an RSVP-colored ring, used in list rows. */
function GuestInitials({ guest, size = 32 }: { guest: GuestRow; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "var(--fill)",
        color: "var(--fg)",
        boxShadow: `inset 0 0 0 1.5px ${RSVP_DOT[guest.rsvp]}`,
      }}
    >
      {getInitials(guest.name)}
    </span>
  );
}

// ============================================================================
// List grouping — reorganizes the (already filtered/searched) list into
// sectioned ListGroups instead of one flat alphabetical run.
// ============================================================================

function groupGuests(guests: GuestRow[], groupBy: "none" | "rsvp" | "side"): { label?: string; guests: GuestRow[] }[] {
  if (groupBy === "none") return [{ guests }];

  if (groupBy === "rsvp") {
    const order: GuestRsvp[] = ["yes", "pending", "no"];
    return order
      .map((rsvp) => ({ label: `${RSVP_LABEL[rsvp]} (${guests.filter((g) => g.rsvp === rsvp).length})`, guests: guests.filter((g) => g.rsvp === rsvp) }))
      .filter((g) => g.guests.length > 0);
  }

  const order: GuestSide[] = ["groom", "bride", "both"];
  return order
    .map((side) => ({ label: `${SIDE_LABEL[side]} (${guests.filter((g) => g.side === side).length})`, guests: guests.filter((g) => g.side === side) }))
    .filter((g) => g.guests.length > 0);
}

// ============================================================================
// Party view — a little crowd of avatars per side, standing around and
// idling. Purely a fun alternate view; the List view stays the practical
// one for scanning details.
// ============================================================================

function GuestParty({ guests, onEdit }: { guests: GuestRow[]; onEdit: (g: GuestRow) => void }) {
  const groomGuests = guests.filter((g) => g.side === "groom");
  const brideGuests = guests.filter((g) => g.side === "bride");
  const bothGuests = guests.filter((g) => g.side === "both");

  if (guests.length === 0) {
    return (
      <div className="rounded-[16px] bg-[var(--card)] px-1 py-16 text-center">
        <p className="text-[15px] text-[var(--fg2)]">No guests match this filter.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <GuestBox title="Celal's side" guests={groomGuests} onEdit={onEdit} />
        <GuestBox title="Selver's side" guests={brideGuests} onEdit={onEdit} />
      </div>
      {bothGuests.length > 0 && <GuestBox title="Together" guests={bothGuests} onEdit={onEdit} />}
    </div>
  );
}

function GuestBox({
  title, guests, onEdit,
}: {
  title: string;
  guests: GuestRow[];
  onEdit: (g: GuestRow) => void;
}) {
  return (
    <div className="min-w-[240px] flex-1 rounded-[16px] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[13px] tracking-[-0.004em] text-[var(--fg2)]">{title}</span>
        <span className="text-[13px] tabular-nums text-[var(--fg3)]">{guests.length}</span>
      </div>
      {guests.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-[var(--fg3)]">No one here yet.</div>
      ) : (
        <div className="flex flex-wrap gap-3 px-1 pb-1">
          {guests.map((g) => <GuestAvatar key={g.id} guest={g} onClick={() => onEdit(g)} />)}
        </div>
      )}
    </div>
  );
}

function GuestAvatar({ guest, onClick }: { guest: GuestRow; onClick: () => void }) {
  const seed = hashString(guest.id);
  const size = 44 + (seed % 12); // 44-55px, so the crowd isn't a rigid grid
  const bobDelay = ((seed >> 4) % 30) / 10; // 0-2.9s
  const bobDuration = 2.6 + ((seed >> 8) % 10) / 10; // 2.6-3.5s

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${guest.name} · ${RSVP_LABEL[guest.rsvp]}${guest.plus_one ? ` · plus ${guest.plus_one_name || "one"}` : ""}`}
      className="guest-avatar relative flex items-center justify-center rounded-full font-semibold transition-transform hover:z-10 hover:scale-110"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background: "var(--fill)",
        color: "var(--fg)",
        boxShadow: `inset 0 0 0 2px ${RSVP_DOT[guest.rsvp]}`,
        "--bob-delay": `${bobDelay}s`,
        "--bob-duration": `${bobDuration}s`,
      } as React.CSSProperties}
    >
      {getInitials(guest.name)}
      {guest.plus_one && (
        <span
          className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
          style={{ background: "var(--card)", color: "var(--fg2)", boxShadow: "0 0 0 2px var(--card)" }}
        >
          +1
        </span>
      )}
    </button>
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
