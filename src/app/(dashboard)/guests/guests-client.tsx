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
import { collectGroups, groupColor, normalizeGroup, UNGROUPED_LABEL } from "./group-colors";

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

// Tapping a row's RSVP pill advances it. Starting from the default
// "pending", one tap gets you to "Coming" — by far the most common outcome.
const NEXT_RSVP: Record<GuestRsvp, GuestRsvp> = {
  pending: "yes",
  yes: "no",
  no: "pending",
};

interface Props {
  initialGuests: GuestRow[];
}

type GuestView = "party" | "list" | "groups";
/** Ordering *within* each side's column — the split by side is the layout itself. */
type GroupBy = "none" | "rsvp" | "group";

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
  /** Every group name in use, offered as suggestions in the edit card. */
  const knownGroups = collectGroups(guests);

  const searchLower = search.trim().toLowerCase();
  const visibleGuests = (filter === "Everyone" ? guests : guests.filter((g) => g.category === filter))
    .filter((g) => !searchLower || g.name.toLowerCase().includes(searchLower))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleDelete = (g: GuestRow) => {
    if (!confirm(`Delete "${g.name}"?`)) return;
    setGuests((prev) => prev.filter((x) => x.id !== g.id));
    startTransition(() => { deleteGuest(g.id); });
  };

  /** Optimistically patch one field and persist via the existing updateGuest
   *  action, which expects a full FormData payload. */
  const patchGuest = (g: GuestRow, patch: Partial<GuestRow>) => {
    const next = { ...g, ...patch };
    setGuests((prev) => prev.map((x) => (x.id === g.id ? next : x)));
    const fd = new FormData();
    fd.set("name", next.name);
    fd.set("side", next.side);
    fd.set("category", next.category ?? "");
    fd.set("guest_group", next.guest_group ?? "");
    fd.set("plus_one", String(next.plus_one));
    fd.set("plus_one_name", next.plus_one_name ?? "");
    fd.set("rsvp", next.rsvp);
    fd.set("invited", String(next.invited));
    fd.set("email", next.email ?? "");
    fd.set("phone", next.phone ?? "");
    startTransition(() => { updateGuest(g.id, null, fd); });
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
          options={[
            { value: "list", label: "List" },
            { value: "groups", label: "Groups" },
            { value: "party", label: "Party" },
          ]}
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
            options={[
              { value: "none", label: "A–Z" },
              { value: "rsvp", label: "RSVP" },
              { value: "group", label: "Group" },
            ]}
            value={groupBy}
            onChange={setGroupBy}
          />
        )}
      </div>

      {(searchLower || filter !== "Everyone") && (
        <div className="flex items-center gap-3 px-1 text-[13px] text-[var(--fg3)]">
          <span>
            Showing {visibleGuests.length} of {total}
          </span>
          <button
            type="button"
            onClick={() => { setSearch(""); setFilter("Everyone"); }}
            className="text-[var(--accent)] hover:opacity-60"
          >
            Clear
          </button>
        </div>
      )}

      {view === "party" ? (
        <GuestParty guests={visibleGuests} onEdit={(g) => { setEditing(g); setDialogOpen(true); }} />
      ) : view === "groups" ? (
        <GuestGroups
          guests={visibleGuests}
          onEdit={(g) => { setEditing(g); setDialogOpen(true); }}
          onCycleRsvp={(g) => patchGuest(g, { rsvp: NEXT_RSVP[g.rsvp] })}
          onToggleInvited={(g) => patchGuest(g, { invited: !g.invited })}
        />
      ) : visibleGuests.length === 0 ? (
        <div className="rounded-[12px] bg-[var(--card)] px-1 py-14 text-center">
          <p className="text-[17px] text-[var(--fg2)]">
            {searchLower ? `No guests matching “${search.trim()}”.` : "No guests here yet."}
          </p>
          <button
            type="button"
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            className="mt-3 text-[15px] text-[var(--accent)] hover:opacity-60"
          >
            Add guest
          </button>
        </div>
      ) : (
        <GuestColumns
          guests={visibleGuests}
          groupBy={groupBy}
          onEdit={(g) => { setEditing(g); setDialogOpen(true); }}
          onCycleRsvp={(g) => patchGuest(g, { rsvp: NEXT_RSVP[g.rsvp] })}
          onToggleInvited={(g) => patchGuest(g, { invited: !g.invited })}
        />
      )}

      <GuestDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        knownGroups={knownGroups}
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

/**
 * A group's name in its own colour. The colour is derived from the name (see
 * `group-colors.ts`), so it needs nothing but the string to stay consistent
 * everywhere the group appears.
 */
function GroupChip({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const color = groupColor(name);
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center gap-1.5 rounded-full whitespace-nowrap",
        size === "sm" ? "px-2 py-[1px] text-[12px]" : "px-2.5 py-[3px] text-[13px]"
      )}
      style={{ background: color.tint, color: "var(--fg)" }}
    >
      <span
        className="rounded-full"
        style={{ width: 6, height: 6, background: color.solid }}
      />
      <span className="max-w-[140px] truncate tracking-[-0.006em]">{name}</span>
    </span>
  );
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
        // The badge is washed in the guest's group colour and ringed in their
        // RSVP colour, so a row carries both at a glance.
        background: groupColor(guest.guest_group).tint,
        color: "var(--fg)",
        boxShadow: `inset 0 0 0 1.5px ${RSVP_DOT[guest.rsvp]}`,
      }}
    >
      {getInitials(guest.name)}
    </span>
  );
}

// ============================================================================
// List row — the name opens the edit dialog, but the two things you most
// often want to change (RSVP, whether the invite went out) are one tap
// each, and stored contact details become actual mailto/tel links so you
// can chase a reply without leaving the page.
// ============================================================================

function GuestListRow({
  guest, onEdit, onCycleRsvp, onToggleInvited, compact = false, hideGroup = false,
}: {
  guest: GuestRow;
  onEdit: () => void;
  onCycleRsvp: () => void;
  onToggleInvited: () => void;
  /** Side-by-side columns are too narrow for the contact links; the edit
   *  dialog still shows them. */
  compact?: boolean;
  /** Inside a group's own card or section the chip would just repeat the header. */
  hideGroup?: boolean;
}) {
  const group = normalizeGroup(guest.guest_group);
  // In split-column mode the column header already states the side, so the
  // row spends that space on category instead.
  const secondary = [
    compact ? null : SIDE_LABEL[guest.side],
    guest.category,
    guest.plus_one ? `plus ${guest.plus_one_name || "one"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <ListRow className="group">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3.5 text-left transition-opacity hover:opacity-70"
      >
        <GuestInitials guest={guest} />
        <div className="min-w-0">
          <div className="truncate text-[17px] tracking-[-0.014em]">{guest.name}</div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
            {group && !hideGroup && <GroupChip name={group} />}
            {secondary && <span className="truncate">{secondary}</span>}
          </div>
        </div>
      </button>

      <div className="ml-auto flex flex-none items-center gap-2">
        {!compact && guest.email && (
          <a
            href={`mailto:${guest.email}`}
            title={guest.email}
            className="hidden text-[13px] text-[var(--accent)] hover:opacity-60 sm:inline"
          >
            Email
          </a>
        )}
        {!compact && guest.phone && (
          <a
            href={`tel:${guest.phone}`}
            title={guest.phone}
            className="hidden text-[13px] text-[var(--accent)] hover:opacity-60 sm:inline"
          >
            Call
          </a>
        )}

        {!guest.invited && (
          <button
            type="button"
            onClick={onToggleInvited}
            title="Mark the invitation as sent"
            className="rounded-full px-2 py-0.5 text-[12px] whitespace-nowrap transition-opacity hover:opacity-70"
            style={{ background: "var(--fill)", color: "var(--fg3)" }}
          >
            No invite
          </button>
        )}

        <button
          type="button"
          onClick={onCycleRsvp}
          title={`Tap to mark as ${RSVP_LABEL[NEXT_RSVP[guest.rsvp]]}`}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[14px] whitespace-nowrap transition-opacity hover:opacity-70"
          style={{ background: "var(--fill)" }}
        >
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: RSVP_DOT[guest.rsvp] }} />
          <span className="tracking-[-0.01em] text-[var(--fg)]">{RSVP_LABEL[guest.rsvp]}</span>
        </button>
      </div>
    </ListRow>
  );
}

// ============================================================================
// List grouping — reorganizes the (already filtered/searched) list into
// sectioned ListGroups instead of one flat alphabetical run.
// ============================================================================

interface GuestSection {
  key: string;
  label?: React.ReactNode;
  guests: GuestRow[];
  /** True for group sections, where the row chips would repeat the header. */
  isGroup?: boolean;
}

function groupGuests(guests: GuestRow[], groupBy: GroupBy): GuestSection[] {
  if (groupBy === "none") return [{ key: "all", guests }];

  if (groupBy === "group") {
    const names = collectGroups(guests);
    const sections: GuestSection[] = names.map((name) => {
      const members = guests.filter((g) => normalizeGroup(g.guest_group) === name);
      return {
        key: name,
        isGroup: true,
        label: (
          <span className="flex items-center gap-2">
            <GroupChip name={name} />
            <span className="tabular-nums text-[var(--fg3)]">{members.length}</span>
          </span>
        ),
        guests: members,
      };
    });
    const ungrouped = guests.filter((g) => !normalizeGroup(g.guest_group));
    if (ungrouped.length > 0) {
      sections.push({
        key: "__ungrouped",
        isGroup: true,
        label: `${UNGROUPED_LABEL} (${ungrouped.length})`,
        guests: ungrouped,
      });
    }
    return sections;
  }

  const order: GuestRsvp[] = ["yes", "pending", "no"];
  return order
    .map((rsvp) => ({
      key: rsvp,
      label: `${RSVP_LABEL[rsvp]} (${guests.filter((g) => g.rsvp === rsvp).length})`,
      guests: guests.filter((g) => g.rsvp === rsvp),
    }))
    .filter((g) => g.guests.length > 0);
}

interface ColumnHandlers {
  onEdit: (g: GuestRow) => void;
  onCycleRsvp: (g: GuestRow) => void;
  onToggleInvited: (g: GuestRow) => void;
}

/**
 * Celal's guests on the left, Selver's on the right, so you can see how the
 * two halves of the room compare at a glance. Guests marked as belonging to
 * both sides get a full-width section underneath rather than being counted
 * twice. Stacks to a single column below lg, where two lists don't fit.
 */
function GuestColumns({
  guests, groupBy, ...handlers
}: { guests: GuestRow[]; groupBy: GroupBy } & ColumnHandlers) {
  const groom = guests.filter((g) => g.side === "groom");
  const bride = guests.filter((g) => g.side === "bride");
  const both = guests.filter((g) => g.side === "both");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <GuestColumn title={SIDE_LABEL.groom} guests={groom} groupBy={groupBy} {...handlers} />
        <GuestColumn title={SIDE_LABEL.bride} guests={bride} groupBy={groupBy} {...handlers} />
      </div>
      {both.length > 0 && (
        <GuestColumn title={SIDE_LABEL.both} guests={both} groupBy={groupBy} {...handlers} />
      )}
    </div>
  );
}

function GuestColumn({
  title, guests, groupBy, onEdit, onCycleRsvp, onToggleInvited,
}: { title: string; guests: GuestRow[]; groupBy: GroupBy } & ColumnHandlers) {
  const coming = guests.filter((g) => g.rsvp === "yes").length;
  const pending = guests.filter((g) => g.rsvp === "pending").length;
  const sections = groupGuests(guests, groupBy);

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2 px-[18px]">
        <span className="text-[15px] font-semibold tracking-[-0.016em]">{title}</span>
        <span className="text-[13px] tabular-nums text-[var(--fg2)]">
          {guests.length} · {coming} coming{pending > 0 ? ` · ${pending} pending` : ""}
        </span>
      </div>

      {guests.length === 0 ? (
        <ListGroup>
          <ListRow>
            <span className="text-[15px] text-[var(--fg2)]">No one on this side yet.</span>
          </ListRow>
        </ListGroup>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <ListGroup key={section.key} label={section.label}>
              {section.guests.map((g) => (
                <GuestListRow
                  key={g.id}
                  guest={g}
                  compact
                  hideGroup={section.isGroup}
                  onEdit={() => onEdit(g)}
                  onCycleRsvp={() => onCycleRsvp(g)}
                  onToggleInvited={() => onToggleInvited(g)}
                />
              ))}
            </ListGroup>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Groups view — the whole guest list re-cut by group instead of by side, so
// you can see each circle of people (uni, work, cousins…) as its own card
// with its own colour and its own RSVP tally.
// ============================================================================

function GuestGroups({
  guests, ...handlers
}: { guests: GuestRow[] } & ColumnHandlers) {
  const names = collectGroups(guests);
  const ungrouped = guests.filter((g) => !normalizeGroup(g.guest_group));

  if (guests.length === 0) {
    return (
      <div className="rounded-[16px] bg-[var(--card)] px-1 py-16 text-center">
        <p className="text-[15px] text-[var(--fg2)]">No guests match this filter.</p>
      </div>
    );
  }

  if (names.length === 0) {
    return (
      <div className="rounded-[16px] bg-[var(--card)] px-6 py-14 text-center">
        <p className="text-[17px] text-[var(--fg2)]">No groups yet.</p>
        <p className="mt-2 text-[15px] text-[var(--fg3)]">
          Open a guest and give them a group — “Uni friends”, “Work”, “Cousins” — and
          they’ll gather here, each group with its own colour.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {names.map((name) => (
        <GuestGroupCard
          key={name}
          name={name}
          guests={guests.filter((g) => normalizeGroup(g.guest_group) === name)}
          {...handlers}
        />
      ))}
      {ungrouped.length > 0 && (
        <GuestGroupCard name={null} guests={ungrouped} {...handlers} />
      )}
    </div>
  );
}

function GuestGroupCard({
  name, guests, onEdit, onCycleRsvp, onToggleInvited,
}: { name: string | null; guests: GuestRow[] } & ColumnHandlers) {
  const color = groupColor(name);
  const coming = guests.filter((g) => g.rsvp === "yes").length;
  const pending = guests.filter((g) => g.rsvp === "pending").length;
  const declined = guests.filter((g) => g.rsvp === "no").length;
  const plusOnes = guests.filter((g) => g.plus_one).length;

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div
        className="flex flex-col gap-2.5 rounded-[14px] px-[18px] py-3.5"
        style={{ background: color.tint }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-[10px] w-[10px] flex-none rounded-full"
              style={{ background: color.solid }}
            />
            <span className="truncate text-[17px] font-semibold tracking-[-0.018em]">
              {name ?? UNGROUPED_LABEL}
            </span>
          </span>
          <span className="flex-none text-[13px] tabular-nums text-[var(--fg2)]">
            {guests.length} guest{guests.length === 1 ? "" : "s"}
            {plusOnes > 0 ? ` · +${plusOnes}` : ""}
          </span>
        </div>

        <div className="flex h-[5px] overflow-hidden rounded-[3px] bg-[var(--fill)]">
          <div style={{ width: `${(coming / guests.length) * 100}%`, background: "var(--green)" }} />
          <div style={{ width: `${(pending / guests.length) * 100}%`, background: "var(--amber)" }} />
          <div style={{ width: `${(declined / guests.length) * 100}%`, background: "var(--red)" }} />
        </div>

        <div className="text-[13px] tabular-nums text-[var(--fg2)]">
          {coming} coming{pending > 0 ? ` · ${pending} pending` : ""}
          {declined > 0 ? ` · ${declined} declined` : ""}
        </div>
      </div>

      <ListGroup>
        {guests.map((g) => (
          <GuestListRow
            key={g.id}
            guest={g}
            compact
            hideGroup
            onEdit={() => onEdit(g)}
            onCycleRsvp={() => onCycleRsvp(g)}
            onToggleInvited={() => onToggleInvited(g)}
          />
        ))}
      </ListGroup>
    </div>
  );
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
      title={[
        guest.name,
        RSVP_LABEL[guest.rsvp],
        normalizeGroup(guest.guest_group),
        guest.plus_one ? `plus ${guest.plus_one_name || "one"}` : null,
      ].filter(Boolean).join(" · ")}
      className="guest-avatar relative flex items-center justify-center rounded-full font-semibold transition-transform hover:z-10 hover:scale-110"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background: groupColor(guest.guest_group).tint,
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

/**
 * Group picker for the edit card: type any name to create a group, or tap one
 * that already exists. The dot beside the field previews the colour the group
 * will wear across the app, which updates as you type.
 */
function GroupField({
  defaultValue, knownGroups,
}: {
  defaultValue: string;
  knownGroups: string[];
}) {
  // Remounted per guest by the caller's `key`, so the initial state is enough.
  const [value, setValue] = useState(defaultValue);

  const current = normalizeGroup(value);
  const color = groupColor(current);
  const options = current && !knownGroups.some((g) => g.toLowerCase() === current.toLowerCase())
    ? [...knownGroups, current]
    : knownGroups;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="guest_group">Group</Label>
      <div className="relative">
        <span
          className="pointer-events-none absolute top-1/2 left-3 h-[10px] w-[10px] -translate-y-1/2 rounded-full transition-colors"
          style={{ background: current ? color.solid : "var(--fill)", boxShadow: current ? "none" : "inset 0 0 0 1.5px var(--fg3)" }}
        />
        <Input
          id="guest_group"
          name="guest_group"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Uni friends, Work, Cousins…"
          autoComplete="off"
          className="pl-7"
        />
      </div>

      {(options.length > 0 || current) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {options.map((g) => {
            const active = current?.toLowerCase() === g.toLowerCase();
            const c = groupColor(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => setValue(active ? "" : g)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] whitespace-nowrap transition-opacity hover:opacity-70"
                style={{
                  background: active ? c.wash : "var(--fill)",
                  color: "var(--fg)",
                  boxShadow: active ? `inset 0 0 0 1.5px ${c.solid}` : "none",
                }}
              >
                <span className="h-[6px] w-[6px] rounded-full" style={{ background: c.solid }} />
                {g}
              </button>
            );
          })}
          {current && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="rounded-full px-2.5 py-1 text-[13px] text-[var(--fg2)] transition-opacity hover:opacity-70"
              style={{ background: "var(--fill)" }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GuestDialog({
  open, onOpenChange, editing, knownGroups, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: GuestRow | null;
  knownGroups: string[];
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

          <GroupField
            key={editing?.id ?? "new"}
            defaultValue={editing?.guest_group ?? ""}
            knownGroups={knownGroups}
          />

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
