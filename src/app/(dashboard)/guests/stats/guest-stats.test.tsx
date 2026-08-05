import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GuestRow } from "@/types/db";
import { GuestStats } from "./guest-stats";

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

describe("GuestStats", () => {
  it("leads with the confirmed seats out of the total", () => {
    render(
      <GuestStats
        guests={[
          guest({ name: "Ada", rsvp: "yes", plus_one: true, guest_group: "Uni friends" }),
          guest({ name: "Ben", rsvp: "no", guest_group: "Uni friends" }),
          guest({ name: "Cem", rsvp: "pending" }),
        ]}
      />,
    );
    expect(screen.getByText("2 of 4 coming")).toBeInTheDocument();
    expect(screen.getByText("Uni friends")).toBeInTheDocument();
  });

  it("says so when there is nothing to count", () => {
    render(<GuestStats guests={[]} />);
    expect(screen.getByText(/nothing to count/)).toBeInTheDocument();
  });
});
