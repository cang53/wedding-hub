"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GuestRow, GuestRsvp, GuestSide } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ActionError } from "@/components/action-error";
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

interface Props {
  initialGuests: GuestRow[];
}

type SortKey = "name" | "side" | "category" | "plus_one" | "rsvp" | "invited";
type SortDir = "asc" | "desc";

// Rank order for RSVP so sorting follows a meaningful progression.
const RSVP_RANK: Record<GuestRsvp, number> = { yes: 0, pending: 1, no: 2 };

function compareGuests(a: GuestRow, b: GuestRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "side":
      return a.side.localeCompare(b.side);
    case "category":
      return (a.category ?? "").localeCompare(b.category ?? "");
    case "plus_one":
      // Guests with a plus one sort first (true before false).
      return Number(b.plus_one) - Number(a.plus_one);
    case "rsvp":
      return RSVP_RANK[a.rsvp] - RSVP_RANK[b.rsvp];
    case "invited":
      return Number(b.invited) - Number(a.invited);
    default:
      return 0;
  }
}

export function GuestsClient({ initialGuests }: Props) {
  const [guests, setGuests] = useState<GuestRow[]>(initialGuests);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GuestRow | null>(null);
  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

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
  const pending = guests.filter((g) => g.rsvp === "pending").length;
  const plusOnes = guests.filter((g) => g.plus_one).length;

  const categories = [...new Set(guests.map((g) => g.category).filter(Boolean))] as string[];

  const filtered = categoryFilter
    ? guests.filter((g) => g.category === categoryFilter)
    : guests;

  const sorted = [...filtered].sort((a, b) => {
    const cmp = compareGuests(a, b, sortKey);
    // Stable tie-break on name so equal keys keep a predictable order.
    const resolved = cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    return sortDir === "asc" ? resolved : -resolved;
  });

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleDelete = (g: GuestRow) => {
    if (!confirm(`Delete "${g.name}"?`)) return;
    const rollback = guests;
    setGuests((prev) => prev.filter((x) => x.id !== g.id));
    startTransition(async () => {
      const { error } = await deleteGuest(g.id);
      if (error) {
        setGuests(rollback);
        setActionError(error);
      }
    });
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>guests</em>
          </h2>
          <p className="text-sm text-ink-soft">Who&rsquo;s celebrating with us.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ New guest</Button>
      </div>

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      {/* Stats row */}
      <div className="guest-stats mb-6">
        <div className="guest-stat">
          <div className="v">{total + plusOnes}</div>
          <div className="l">Total invited</div>
        </div>
        <div className="guest-stat">
          <div className="v" style={{ color: "var(--sage)" }}>{yesCount}</div>
          <div className="l">Confirmed</div>
        </div>
        <div className="guest-stat">
          <div className="v" style={{ color: "var(--burgundy)" }}>{noCount}</div>
          <div className="l">Declined</div>
        </div>
        <div className="guest-stat">
          <div className="v" style={{ color: "var(--gold)" }}>{pending}</div>
          <div className="l">Pending</div>
        </div>
        <div className="guest-stat">
          <div className="v">{plusOnes}</div>
          <div className="l">Plus ones</div>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="guest-filters mb-6">
        <button
          type="button"
          className={`filter-chip${categoryFilter === "" ? " active" : ""}`}
          onClick={() => setCategoryFilter("")}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`filter-chip${categoryFilter === c ? " active" : ""}`}
            onClick={() => setCategoryFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-paper border border-line rounded-[4px] shadow-soft p-2">
        {guests.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="guest-table w-full">
              <thead>
                <tr>
                  <SortHeader label="Name" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Side" sortKey="side" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Category" sortKey="category" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Plus 1" sortKey="plus_one" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="RSVP" sortKey="rsvp" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Invite" sortKey="invited" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <button
                        type="button"
                        className="font-medium text-left hover:text-burgundy transition-colors"
                        onClick={() => { setEditing(g); setDialogOpen(true); }}
                      >
                        {g.name}
                      </button>
                    </td>
                    <td>{g.side}</td>
                    <td>{g.category ?? "—"}</td>
                    <td>
                      {g.plus_one
                        ? `✓ ${g.plus_one_name ?? "Yes"}`
                        : "—"}
                    </td>
                    <td>
                      <span className={`rsvp-${g.rsvp}`}>{g.rsvp.toUpperCase()}</span>
                    </td>
                    <td>{g.invited ? "✓ Sent" : "—"}</td>
                    <td>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(g)}>×</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GuestDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
      />
    </section>
  );
}

function SortHeader({
  label, sortKey, activeKey, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-[0.15em] font-semibold text-[11px] hover:text-burgundy transition-colors"
      >
        {label}
        <span className={`text-[9px] leading-none ${active ? "opacity-100" : "opacity-30"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </button>
    </th>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-15 px-5 text-ink-soft">
      <div className="empty-ornament mb-3">♥</div>
      <p className="font-serif italic text-[22px]">No guests yet.</p>
      <p className="text-[13px] mt-2">Start with the closest family.</p>
    </div>
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
  // Re-sync when the dialog is reused for a different row. Adjusting state
  // during render is cheaper than an effect: React re-runs this component
  // before committing, so the stale value never reaches the DOM.
  const [syncedDefault, setSyncedDefault] = useState(defaultValue);
  if (syncedDefault !== defaultValue) {
    setSyncedDefault(defaultValue);
    setValue(defaultValue);
  }
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
  open, onOpenChange, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: GuestRow | null;
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
