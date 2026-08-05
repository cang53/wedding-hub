import { describe, expect, it } from "vitest";
import type { GuestRow } from "@/types/db";
import { heads, pct, tally, totalHeads } from "./headcount";

function guest(partial: Partial<GuestRow>): GuestRow {
  return {
    id: crypto.randomUUID(),
    name: "Someone",
    side: "both",
    category: null,
    guest_group: null,
    plus_one: false,
    plus_one_name: null,
    rsvp: "pending",
    invited: false,
    email: null,
    phone: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("headcount", () => {
  it("counts a guest with a plus one as two seats", () => {
    expect(heads(guest({ plus_one: false }))).toBe(1);
    expect(heads(guest({ plus_one: true }))).toBe(2);
  });

  it("keeps the RSVP split adding up to the total seats", () => {
    const guests = [
      guest({ rsvp: "yes", plus_one: true }),
      guest({ rsvp: "yes" }),
      guest({ rsvp: "pending", plus_one: true }),
      guest({ rsvp: "no", plus_one: true }),
      guest({ rsvp: "no" }),
    ];
    const t = tally(guests);

    expect(t.invitations).toBe(5);
    expect(t.plusOnes).toBe(3);
    expect(t.heads).toBe(8);
    expect(t.coming).toBe(3);
    expect(t.pending).toBe(2);
    expect(t.declined).toBe(3);
    expect(t.coming + t.pending + t.declined).toBe(t.heads);
  });

  it("counts replies and sent invitations per invitation, not per seat", () => {
    const t = tally([
      guest({ rsvp: "yes", plus_one: true, invited: true }),
      guest({ rsvp: "no", invited: true }),
      guest({ rsvp: "pending", invited: false }),
    ]);
    expect(t.replied).toBe(2);
    expect(t.invited).toBe(2);
  });

  it("handles an empty list without dividing by zero", () => {
    expect(totalHeads([])).toBe(0);
    expect(pct(0, 0)).toBe(0);
    expect(pct(3, 4)).toBe(75);
  });
});
