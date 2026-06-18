"use client";

import { useState } from "react";
import type { StageAccommodationRow, AccommodationPlatform } from "@/types/db";
import { formatMoney, cn } from "@/lib/utils";
import { usePlanner } from "./use-planner";
import { InlineText, InlineNumber } from "./inline-edit";
import { PLATFORM_BADGES, PLATFORMS, num, perNight } from "./types";

const AMENITIES: { key: keyof StageAccommodationRow; icon: string; label: string }[] = [
  { key: "breakfast", icon: "🍳", label: "Breakfast" },
  { key: "pool", icon: "🏊", label: "Pool" },
  { key: "ac", icon: "❄️", label: "AC" },
  { key: "halal_nearby", icon: "🥩", label: "Halal nearby" },
];

export function AccommodationCard({
  scenarioId,
  stageId,
  nights,
  acc,
}: {
  scenarioId: string;
  stageId: string;
  nights: number;
  acc: StageAccommodationRow;
}) {
  const { patchAccommodation, removeAccommodation, choose } = usePlanner();
  const [expanded, setExpanded] = useState(false);

  const patch = (p: Partial<StageAccommodationRow>) =>
    patchAccommodation(scenarioId, stageId, acc.id, p);

  /** When the total changes, recompute the per-night price automatically. */
  const patchTotal = (total: number | null) =>
    patch({ price_total: total, price_per_night: perNight(total, nights) });

  const badge = PLATFORM_BADGES[acc.platform] ?? PLATFORM_BADGES.Other;
  const displayPerNight = acc.price_per_night != null ? num(acc.price_per_night) : perNight(acc.price_total, nights);

  return (
    <div
      className={cn(
        "rounded-lg border bg-paper transition-all",
        acc.is_chosen
          ? "border-l-[3px] border-l-burgundy border-y border-r border-y-line border-r-line bg-burgundy/5 shadow-sm"
          : "border-line hover:border-ink/30",
      )}
    >
      {/* Collapsed header row — always visible */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-ink-soft hover:text-ink text-xs w-4 shrink-0"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", badge.className)}>
              <span>{badge.icon}</span>
            </span>
            <InlineText
              value={acc.name}
              onCommit={(v) => patch({ name: v })}
              placeholder="Name"
              className="font-medium text-[15px]"
            />
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-serif text-[18px] leading-none">
            <InlineNumber
              value={acc.price_total != null ? num(acc.price_total) : null}
              onCommit={patchTotal}
              placeholder="—"
            />
            <span className="text-xs text-ink-soft"> €</span>
          </div>
          {displayPerNight != null && (
            <div className="text-[11px] text-ink-soft">{formatMoney(displayPerNight)}/night</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => choose(scenarioId, stageId, acc.id)}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors",
            acc.is_chosen
              ? "bg-burgundy text-cream"
              : "border border-line text-ink-soft hover:border-burgundy hover:text-burgundy",
          )}
        >
          {acc.is_chosen ? "✓ Chosen" : "Choose"}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-line/70 px-4 py-3 space-y-3 text-sm">
          {/* Platform + rating + per-night */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              Platform:
              <select
                value={acc.platform}
                onChange={(e) => patch({ platform: e.target.value as AccommodationPlatform })}
                className="rounded-[2px] border border-line bg-paper px-1.5 py-0.5 text-ink"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              ⭐
              <InlineNumber value={acc.rating != null ? num(acc.rating) : null} onCommit={(v) => patch({ rating: v })} placeholder="?" />
              /
              <InlineNumber value={acc.rating_count} onCommit={(v) => patch({ rating_count: v })} placeholder="0" />
              <span>avis</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              €/night:
              <InlineNumber value={displayPerNight} onCommit={(v) => patch({ price_per_night: v })} placeholder="—" />
            </span>
          </div>

          {/* Amenity toggles */}
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((am) => {
              const on = Boolean(acc[am.key]);
              return (
                <button
                  key={am.key}
                  type="button"
                  onClick={() => patch({ [am.key]: !on } as Partial<StageAccommodationRow>)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    on
                      ? "border-sage bg-sage/15 text-ink"
                      : "border-line text-ink-soft/60 hover:border-ink/40",
                  )}
                >
                  {am.icon} {am.label}
                </button>
              );
            })}
          </div>

          {/* Pros / cons */}
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-sage mb-1">Pros</div>
              <InlineText value={acc.pros ?? ""} onCommit={(v) => patch({ pros: v || null })} placeholder="Add pros…" multiline className="block text-[13px]" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-rose mb-1">Cons</div>
              <InlineText value={acc.cons ?? ""} onCommit={(v) => patch({ cons: v || null })} placeholder="Add cons…" multiline className="block text-[13px]" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft mb-1">Notes</div>
            <InlineText value={acc.notes ?? ""} onCommit={(v) => patch({ notes: v || null })} placeholder="Add notes…" multiline className="block text-[13px]" />
          </div>

          {/* URL + actions */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 min-w-0 text-[13px]">
              <span className="text-ink-soft text-xs mr-1">Link:</span>
              <InlineText value={acc.url ?? ""} onCommit={(v) => patch({ url: v || null })} placeholder="https://…" className="break-all" />
            </div>
            {acc.url && (
              <a
                href={acc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-[2px] border border-ink px-2.5 py-1 text-[11px] uppercase tracking-wider hover:bg-ink hover:text-cream transition-colors"
              >
                Open ↗
              </a>
            )}
            <button
              type="button"
              onClick={() => removeAccommodation(scenarioId, stageId, acc.id)}
              className="shrink-0 text-burgundy hover:text-burgundy-deep text-sm"
              aria-label="Delete accommodation"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
