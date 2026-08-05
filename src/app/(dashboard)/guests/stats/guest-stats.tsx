import Link from "next/link";
import type { GuestRow, GuestSide } from "@/types/db";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { ProgressRing } from "@/components/ui/progress-ring";
import { collectGroups, groupColor, normalizeGroup, UNGROUPED_LABEL } from "../group-colors";
import { pct, tally, type Tally } from "../headcount";

const SIDE_LABEL: Record<GuestSide, string> = {
  groom: "Celal's side",
  bride: "Selver's side",
  both: "Both sides",
};

/** One slice of the list — a group, a side, a category — already counted. */
interface Slice {
  key: string;
  label: string;
  /** Dot colour; groups get their own, everything else borrows the accent. */
  color: string;
  counts: Tally;
}

function toSlices(
  guests: GuestRow[],
  buckets: { key: string; label: string; color: string; match: (g: GuestRow) => boolean }[],
): Slice[] {
  return buckets
    .map((b) => ({ key: b.key, label: b.label, color: b.color, counts: tally(guests.filter(b.match)) }))
    .filter((s) => s.counts.invitations > 0);
}

export function GuestStats({ guests }: { guests: GuestRow[] }) {
  const all = tally(guests);

  const groupNames = collectGroups(guests);
  const groupSlices = toSlices(guests, [
    ...groupNames.map((name) => ({
      key: name,
      label: name,
      color: groupColor(name).solid,
      match: (g: GuestRow) => normalizeGroup(g.guest_group) === name,
    })),
    {
      key: "__ungrouped",
      label: UNGROUPED_LABEL,
      color: "var(--fg3)",
      match: (g: GuestRow) => !normalizeGroup(g.guest_group),
    },
  ]).sort((a, b) => b.counts.heads - a.counts.heads);

  const sideSlices = toSlices(
    guests,
    (["groom", "bride", "both"] as GuestSide[]).map((side) => ({
      key: side,
      label: SIDE_LABEL[side],
      color: "var(--accent)",
      match: (g: GuestRow) => g.side === side,
    })),
  );

  const categoryNames = [...new Set(guests.map((g) => g.category).filter(Boolean))].sort() as string[];
  const categorySlices = toSlices(guests, [
    ...categoryNames.map((c) => ({
      key: c,
      label: c,
      color: "var(--fg2)",
      match: (g: GuestRow) => g.category === c,
    })),
    {
      key: "__uncategorised",
      label: "No category",
      color: "var(--fg3)",
      match: (g: GuestRow) => !g.category,
    },
  ]).sort((a, b) => b.counts.heads - a.counts.heads);

  const namedPlusOnes = guests.filter((g) => g.plus_one && g.plus_one_name).length;
  const noContact = guests.filter((g) => !g.email && !g.phone).length;
  const chase = guests.filter((g) => g.invited && g.rsvp === "pending").length;
  const notInvited = all.invitations - all.invited;

  if (guests.length === 0) {
    return (
      <section className="font-apple flex flex-col gap-6 text-[var(--fg)]">
        <BackLink />
        <div className="rounded-[16px] bg-[var(--card)] px-6 py-16 text-center">
          <p className="text-[17px] text-[var(--fg2)]">No guests yet — nothing to count.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="font-apple flex flex-col gap-[30px] text-[var(--fg)]">
      <div className="px-1">
        <BackLink />
        <div className="mt-3 text-[clamp(38px,6vw,54px)] font-bold leading-none tracking-[-0.04em] tabular-nums">
          {all.coming} of {all.heads} coming
        </div>
        <div className="mt-3 text-[16px] tracking-[-0.012em] text-[var(--fg2)]">
          {all.invitations} invitation{all.invitations === 1 ? "" : "s"} · {all.plusOnes} plus one
          {all.plusOnes === 1 ? "" : "s"} · counted as {all.heads} seat{all.heads === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-[12px] bg-[var(--card)] px-4 py-6 max-sm:grid-cols-1 max-sm:gap-6">
        <ProgressRing
          value={all.replied}
          total={all.invitations}
          label="Replies in"
          caption={`${all.replied} of ${all.invitations}`}
          color="var(--green)"
        />
        <ProgressRing
          value={all.invited}
          total={all.invitations}
          label="Invitations sent"
          caption={`${all.invited} of ${all.invitations}`}
          color="var(--accent)"
        />
        <ProgressRing
          value={all.coming}
          total={all.heads}
          label="Seats confirmed"
          caption={`${all.coming} of ${all.heads}`}
          color="var(--amber)"
        />
      </div>

      {/* Everything that has to add up, spelled out — a plus one always
          follows their host's answer, so the three RSVP lines total the seats. */}
      <ListGroup label="The headcount">
        <StatRow label="Invitations" value={all.invitations} note="rows in the guest list" />
        <StatRow label="Plus ones" value={all.plusOnes} note={`${namedPlusOnes} named`} />
        <StatRow label="Seats if everyone came" value={all.heads} emphasis />
        <StatRow label="Confirmed" value={all.coming} note={`${pct(all.coming, all.heads)}% of seats`} dot="var(--green)" />
        <StatRow label="Still to reply" value={all.pending} note={`${pct(all.pending, all.heads)}% of seats`} dot="var(--amber)" />
        <StatRow label="Declined" value={all.declined} note={`${pct(all.declined, all.heads)}% of seats`} dot="var(--red)" />
      </ListGroup>

      <Breakdown title="By group" slices={groupSlices} showChip />
      <Breakdown title="By side" slices={sideSlices} />
      <Breakdown title="By category" slices={categorySlices} />

      <ListGroup label="Still to chase">
        <StatRow label="Invitations not sent yet" value={notInvited} dot={notInvited > 0 ? "var(--amber)" : undefined} />
        <StatRow label="Invited but no answer" value={chase} dot={chase > 0 ? "var(--amber)" : undefined} />
        <StatRow label="Plus ones without a name" value={all.plusOnes - namedPlusOnes} />
        <StatRow label="No email and no phone" value={noContact} note="nobody to chase" />
      </ListGroup>
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href="/guests"
      className="inline-flex items-center gap-1 text-[15px] text-[var(--accent)] transition-opacity hover:opacity-60"
    >
      <span aria-hidden>‹</span>
      Guest list
    </Link>
  );
}

function StatRow({
  label, value, note, dot, emphasis = false,
}: {
  label: string;
  value: number;
  note?: string;
  dot?: string;
  emphasis?: boolean;
}) {
  return (
    <ListRow>
      <span className="flex min-w-0 items-center gap-2.5">
        {dot && <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: dot }} />}
        <span className={`truncate text-[17px] tracking-[-0.014em] ${emphasis ? "font-semibold" : ""}`}>
          {label}
        </span>
      </span>
      <span className="ml-auto flex flex-none items-baseline gap-2.5">
        {note && <span className="text-[13px] text-[var(--fg3)]">{note}</span>}
        <span className={`text-[17px] tabular-nums tracking-[-0.014em] ${emphasis ? "font-semibold" : "text-[var(--fg2)]"}`}>
          {value}
        </span>
      </span>
    </ListRow>
  );
}

/**
 * A stacked bar per slice, all drawn to the same scale (the biggest slice
 * fills the row) so the sections read as a chart rather than a table: bar
 * length compares slices, the colours inside compare answers.
 */
function Breakdown({ title, slices, showChip = false }: { title: string; slices: Slice[]; showChip?: boolean }) {
  if (slices.length === 0) return null;
  const widest = Math.max(...slices.map((s) => s.counts.heads));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3 px-[18px]">
        <span className="text-[15px] font-semibold tracking-[-0.016em]">{title}</span>
        <span className="flex items-center gap-3 text-[12px] text-[var(--fg3)]">
          <Legend color="var(--green)" label="coming" />
          <Legend color="var(--amber)" label="pending" />
          <Legend color="var(--red)" label="declined" />
        </span>
      </div>

      <div className="flex flex-col gap-3.5 rounded-[12px] bg-[var(--card)] px-[18px] py-4">
        {slices.map((s) => {
          const { coming, pending, declined, heads, invitations, plusOnes } = s.counts;
          return (
            <div key={s.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  {showChip ? (
                    <span
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-[1px] text-[13px]"
                      style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)` }}
                    >
                      <span className="h-[6px] w-[6px] flex-none rounded-full" style={{ background: s.color }} />
                      <span className="truncate">{s.label}</span>
                    </span>
                  ) : (
                    <span className="truncate text-[15px] tracking-[-0.012em]">{s.label}</span>
                  )}
                </span>
                <span className="flex-none text-[13px] tabular-nums text-[var(--fg2)]">
                  {coming}/{heads} seats
                  <span className="text-[var(--fg3)]">
                    {" "}· {invitations} invitation{invitations === 1 ? "" : "s"}
                    {plusOnes > 0 ? ` +${plusOnes}` : ""}
                  </span>
                </span>
              </div>

              <div
                className="flex h-[8px] overflow-hidden rounded-[4px] bg-[var(--fill)]"
                style={{ width: `${Math.max(6, (heads / widest) * 100)}%` }}
                title={`${coming} coming · ${pending} pending · ${declined} declined`}
              >
                <div style={{ width: `${(coming / heads) * 100}%`, background: "var(--green)" }} />
                <div style={{ width: `${(pending / heads) * 100}%`, background: "var(--amber)" }} />
                <div style={{ width: `${(declined / heads) * 100}%`, background: "var(--red)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
