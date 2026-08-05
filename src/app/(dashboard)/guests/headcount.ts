import type { GuestRow, GuestRsvp } from "@/types/db";

/**
 * Two different numbers get called "guests", and mixing them up is how a
 * seating plan ends up short:
 *
 *  - an *invitation* is one row in the list;
 *  - a *head* is a person who needs a chair — the guest, plus their plus one.
 *
 * Everything that has to add up (the headline, the stats screen) counts heads
 * through here, and a plus one always inherits their host's RSVP: if the host
 * declines, their plus one isn't coming either.
 */

type CountableGuest = Pick<GuestRow, "plus_one" | "rsvp">;
type TallyableGuest = CountableGuest & Pick<GuestRow, "invited">;

/** Chairs needed for one invitation: the guest, and their plus one if any. */
export function heads(guest: Pick<GuestRow, "plus_one">): number {
  return 1 + (guest.plus_one ? 1 : 0);
}

/** Chairs needed for a set of invitations. */
export function totalHeads(guests: Pick<GuestRow, "plus_one">[]): number {
  return guests.reduce((sum, g) => sum + heads(g), 0);
}

/** Chairs needed by everyone whose RSVP is `rsvp`. */
export function headsWithRsvp(guests: CountableGuest[], rsvp: GuestRsvp): number {
  return totalHeads(guests.filter((g) => g.rsvp === rsvp));
}

export interface Tally {
  /** Rows in the list. */
  invitations: number;
  /** Invitations bringing someone. */
  plusOnes: number;
  /** Chairs needed if everyone said yes. */
  heads: number;
  /** Chairs confirmed, pending and declined — these three add up to `heads`. */
  coming: number;
  pending: number;
  declined: number;
  /** Invitations that have replied either way. */
  replied: number;
  /** Invitations marked as sent. */
  invited: number;
}

/** The full set of counts for any slice of the guest list. */
export function tally(guests: TallyableGuest[]): Tally {
  return {
    invitations: guests.length,
    plusOnes: guests.filter((g) => g.plus_one).length,
    heads: totalHeads(guests),
    coming: headsWithRsvp(guests, "yes"),
    pending: headsWithRsvp(guests, "pending"),
    declined: headsWithRsvp(guests, "no"),
    replied: guests.filter((g) => g.rsvp !== "pending").length,
    invited: guests.filter((g) => g.invited).length,
  };
}

/** Whole percent, guarding against an empty list. */
export function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
