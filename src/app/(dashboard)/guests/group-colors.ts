/**
 * Guest groups ("Uni friends", "Work", "Neighbours", …) are free-form text —
 * you make one by typing it on a guest. Their colour is *derived* from the
 * name rather than stored, so the same group always looks the same on every
 * device without anyone having to pick a swatch.
 *
 * The palette is deliberately mid-tone: each hue sits comfortably on both the
 * light and dark backgrounds, and the tints are produced with `color-mix`
 * against the current surface so they follow the theme.
 */

export interface GroupColor {
  /** The saturated hue — dots, rings, header bars. */
  solid: string;
  /** Faint background wash for chips and cards. */
  tint: string;
  /** Slightly stronger wash for headers. */
  wash: string;
}

const PALETTE = [
  "#5e5ce6", // indigo
  "#0f9aa3", // teal
  "#d9663d", // orange
  "#d94f86", // pink
  "#3d9a5f", // green
  "#9a5cd6", // purple
  "#3a7fd5", // blue
  "#b8860b", // amber
  "#c2415f", // rose (the app accent)
  "#5a8f7b", // sage
] as const;

const NEUTRAL: GroupColor = {
  solid: "var(--fg3)",
  tint: "var(--fill)",
  wash: "var(--fill)",
};

/** Label used wherever ungrouped guests need a heading of their own. */
export const UNGROUPED_LABEL = "No group";

/** Trims and collapses whitespace; empty strings become `null`. */
export function normalizeGroup(group: string | null | undefined): string | null {
  const trimmed = (group ?? "").trim().replace(/\s+/g, " ");
  return trimmed || null;
}

/**
 * The identity of a group. "Uni friends" and "uni friends" are one group that
 * happens to have been typed two ways, so membership is always tested on this
 * key — never on the display string, which is only ever one of the spellings.
 */
export function groupKey(group: string | null | undefined): string | null {
  return normalizeGroup(group)?.toLowerCase() ?? null;
}

/** True when two group strings name the same group (including both empty). */
export function sameGroup(a: string | null | undefined, b: string | null | undefined): boolean {
  return groupKey(a) === groupKey(b);
}

/** Everyone in one group, whichever way their group name is spelled. */
export function guestsInGroup<T extends { guest_group: string | null }>(
  guests: T[],
  group: string | null,
): T[] {
  return guests.filter((g) => sameGroup(g.guest_group, group));
}

/** Stable, case-insensitive hash so "Uni" and "uni" land on the same colour. */
function hashGroup(group: string): number {
  const key = group.toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The colour for a group name — deterministic, and neutral grey for none. */
export function groupColor(group: string | null | undefined): GroupColor {
  const name = normalizeGroup(group);
  if (!name) return NEUTRAL;
  const solid = PALETTE[hashGroup(name) % PALETTE.length];
  return {
    solid,
    tint: `color-mix(in srgb, ${solid} 14%, transparent)`,
    wash: `color-mix(in srgb, ${solid} 22%, transparent)`,
  };
}

/**
 * All group names present in a set of guests, alphabetical.
 *
 * Where a group has been typed with different capitalisation, the spelling
 * used by the most guests wins (ties broken alphabetically) — picking the
 * *first* one seen would make the label depend on the order of the list, so
 * adding a guest could silently re-spell a group and drop everyone whose
 * spelling no longer matched.
 */
export function collectGroups(guests: { guest_group: string | null }[]): string[] {
  const spellings = new Map<string, Map<string, number>>();
  for (const g of guests) {
    const name = normalizeGroup(g.guest_group);
    if (!name) continue;
    const key = name.toLowerCase();
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    spellings.set(key, counts);
  }

  return [...spellings.values()]
    .map((counts) =>
      [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
    )
    .sort((a, b) => a.localeCompare(b));
}
