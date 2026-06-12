import type {
  TripScenarioRow,
  TripStageRow,
  StageAccommodationRow,
  ScenarioColor,
  AccommodationPlatform,
} from "@/types/db";

/** A stage with its accommodation candidates attached. */
export interface StageWithAccommodations extends TripStageRow {
  accommodations: StageAccommodationRow[];
}

/** A scenario with its ordered stages (each with accommodations). */
export interface ScenarioWithStages extends TripScenarioRow {
  stages: StageWithAccommodations[];
}

// ---- Display helpers -------------------------------------------------------

/** Pastel palette for scenario badges — deliberately off the main palette. */
export const SCENARIO_COLORS: Record<
  ScenarioColor,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  sage: { label: "Sage", bg: "bg-[#e7ece1]", text: "text-[#4c5a3f]", border: "border-[#b9c7a9]", dot: "bg-[#8a9a7b]" },
  blush: { label: "Blush", bg: "bg-[#f6e6e6]", text: "text-[#8a4a4a]", border: "border-[#e0b9b9]", dot: "bg-[#c97a6e]" },
  sky: { label: "Sky", bg: "bg-[#e1e9f0]", text: "text-[#3f536a]", border: "border-[#aec3d6]", dot: "bg-[#6f93b3]" },
  lavender: { label: "Lavender", bg: "bg-[#eae6f3]", text: "text-[#574a78]", border: "border-[#c5b9e0]", dot: "bg-[#9483c0]" },
  sand: { label: "Sand", bg: "bg-[#f1e9da]", text: "text-[#6a5a3f]", border: "border-[#d6c5a9]", dot: "bg-[#b8956a]" },
  mint: { label: "Mint", bg: "bg-[#e0efe8]", text: "text-[#3f6a57]", border: "border-[#aed6c3]", dot: "bg-[#6fb393]" },
  peach: { label: "Peach", bg: "bg-[#f7ebe1]", text: "text-[#8a5e3f]", border: "border-[#e0c5ae]", dot: "bg-[#c9956e]" },
};

export const SCENARIO_COLOR_KEYS = Object.keys(SCENARIO_COLORS) as ScenarioColor[];

/** Platform badge styling. */
export const PLATFORM_BADGES: Record<
  AccommodationPlatform,
  { label: string; icon: string; className: string }
> = {
  Booking: { label: "Booking", icon: "🅱", className: "bg-[#e1e9f5] text-[#1a4a8a] border-[#aec3e0]" },
  Airbnb: { label: "Airbnb", icon: "◈", className: "bg-[#fbe7e4] text-[#c0492f] border-[#f0bcb2]" },
  TripAdvisor: { label: "TripAdvisor", icon: "◉", className: "bg-[#e2f0e4] text-[#2a7a3f] border-[#b2d9bb]" },
  Other: { label: "Other", icon: "○", className: "bg-cream-deep text-ink-soft border-line" },
};

export const PLATFORMS = Object.keys(PLATFORM_BADGES) as AccommodationPlatform[];

/** The chosen accommodation for a stage, or the first as a hint, or null. */
export function chosenAccommodation(
  stage: StageWithAccommodations,
): StageAccommodationRow | null {
  return stage.accommodations.find((a) => a.is_chosen) ?? null;
}

/** Sum of chosen accommodation prices across all stages. */
export function scenarioTotal(scenario: ScenarioWithStages): number {
  return scenario.stages.reduce((sum, stage) => {
    const chosen = chosenAccommodation(stage);
    return sum + (chosen?.price_total ?? 0);
  }, 0);
}

/** Total after subtracting the promo amount (never below zero). */
export function scenarioNet(scenario: ScenarioWithStages): number {
  return Math.max(0, scenarioTotal(scenario) - (scenario.promo_amount ?? 0));
}

export function totalNights(scenario: ScenarioWithStages): number {
  return scenario.stages.reduce((sum, s) => sum + (s.nights ?? 0), 0);
}
