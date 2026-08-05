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

/** All group names present in a set of guests, alphabetical. */
export function collectGroups(guests: { guest_group: string | null }[]): string[] {
  const seen = new Map<string, string>();
  for (const g of guests) {
    const name = normalizeGroup(g.guest_group);
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
