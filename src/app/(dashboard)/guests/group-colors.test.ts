import { describe, expect, it } from "vitest";
import { collectGroups, groupColor, guestsInGroup, normalizeGroup, sameGroup } from "./group-colors";

const guest = (name: string, guest_group: string | null) => ({ name, guest_group });

describe("group names", () => {
  it("trims and collapses whitespace, and treats blanks as no group", () => {
    expect(normalizeGroup("  Uni   friends ")).toBe("Uni friends");
    expect(normalizeGroup("   ")).toBeNull();
    expect(normalizeGroup(null)).toBeNull();
  });

  it("treats different capitalisations as the same group", () => {
    expect(sameGroup("Uni friends", "uni friends")).toBe(true);
    expect(sameGroup("Uni friends", "Work")).toBe(false);
    expect(sameGroup(null, "")).toBe(true);
    expect(groupColor("uni friends").solid).toBe(groupColor("Uni Friends").solid);
  });
});

describe("collectGroups", () => {
  it("lists one entry per group, alphabetically", () => {
    expect(collectGroups([
      guest("Ada", "Work"),
      guest("Ben", "Uni friends"),
      guest("Cem", null),
    ])).toEqual(["Uni friends", "Work"]);
  });

  // The bug: adding a guest re-ordered the list, which flipped which spelling
  // of a group became canonical — and every guest spelling it the other way
  // fell out of all the buckets and vanished from the Groups view.
  it("picks the same spelling no matter what order the guests arrive in", () => {
    const ada = guest("Ada", "Uni friends");
    const ben = guest("Ben", "Uni friends");
    const zoe = guest("Zoe", "uni friends");

    expect(collectGroups([ada, ben, zoe])).toEqual(["Uni friends"]);
    expect(collectGroups([zoe, ada, ben])).toEqual(["Uni friends"]);
  });

  it("keeps every guest in a bucket even when spellings differ", () => {
    const guests = [
      guest("Ada", "Uni friends"),
      guest("Ben", "uni friends"),
      guest("Zoe", "UNI FRIENDS"),
    ];
    const shown = collectGroups(guests).flatMap((name) => guestsInGroup(guests, name));
    expect(shown.map((g) => g.name)).toEqual(["Ada", "Ben", "Zoe"]);
  });
});
