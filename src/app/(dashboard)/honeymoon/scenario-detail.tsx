"use client";

import { useState } from "react";
import type { TripStageRow } from "@/types/db";
import { formatMoney, cn } from "@/lib/utils";
import { usePlanner } from "./use-planner";
import { InlineText, InlineNumber } from "./inline-edit";
import { AccommodationCard } from "./accommodation-card";
import {
  type ScenarioWithStages,
  type StageWithAccommodations,
  SCENARIO_COLORS,
  chosenAccommodation,
  scenarioTotal,
  scenarioNet,
  num,
  nightsBetween,
  perNight,
} from "./types";

export function ScenarioDetail({
  scenario,
  onClose,
}: {
  scenario: ScenarioWithStages;
  onClose: () => void;
}) {
  const { patchScenario, addStage, reorder } = usePlanner();
  const [dragId, setDragId] = useState<string | null>(null);
  const color = SCENARIO_COLORS[scenario.color] ?? SCENARIO_COLORS.sage;

  const total = scenarioTotal(scenario);
  const net = scenarioNet(scenario);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = scenario.stages.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorder(scenario.id, ids);
    setDragId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl h-full overflow-y-auto bg-cream shadow-lg animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-line px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("inline-block h-3 w-3 rounded-full", color.dot)} />
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", color.bg, color.text, color.border)}>
                {color.label}
              </span>
              {scenario.is_selected && (
                <span className="rounded-full bg-gold/20 text-gold px-2 py-0.5 text-[10px] uppercase tracking-wider">👑 Final</span>
              )}
            </div>
            <InlineText
              value={scenario.name}
              onCommit={(v) => patchScenario(scenario.id, { name: v })}
              className="font-serif text-[28px] leading-tight block"
            />
            <InlineText
              value={scenario.description ?? ""}
              onCommit={(v) => patchScenario(scenario.id, { description: v || null })}
              placeholder="Add a tagline…"
              className="text-sm text-ink-soft block"
            />
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-2xl text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {scenario.stages.length === 0 && (
            <p className="text-center text-ink-soft italic py-8">No stages yet. Add your first leg below.</p>
          )}

          {scenario.stages.map((stage) => (
            <StageCard
              key={stage.id}
              scenarioId={scenario.id}
              stage={stage}
              colorDot={color.dot}
              isDragging={dragId === stage.id}
              onDragStart={() => setDragId(stage.id)}
              onDragEnd={() => setDragId(null)}
              onDropOn={() => handleDrop(stage.id)}
            />
          ))}

          <button
            type="button"
            onClick={() => addStage(scenario.id)}
            className="w-full rounded-lg border border-dashed border-line py-3 text-sm text-ink-soft hover:border-ink hover:text-ink transition-colors"
          >
            + Add stage
          </button>
        </div>

        {/* Footer totals */}
        <div className="sticky bottom-0 bg-cream/95 backdrop-blur border-t border-line px-6 py-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">Total chosen</span>
            <span>{formatMoney(total)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-ink-soft flex items-center gap-1.5">
              Promo
              <InlineText
                value={scenario.promo_code ?? ""}
                onCommit={(v) => patchScenario(scenario.id, { promo_code: v || null })}
                placeholder="code"
                className="text-xs uppercase tracking-wider text-gold"
              />
            </span>
            <span className="text-sage">
              −<InlineNumber value={num(scenario.promo_amount)} onCommit={(v) => patchScenario(scenario.id, { promo_amount: v ?? 0 })} /> €
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-1 border-t border-line/60">
            <span className="text-sm font-medium">You pay</span>
            <span className="font-serif text-[26px] text-burgundy">{formatMoney(net)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageCard({
  scenarioId,
  stage,
  colorDot,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOn,
}: {
  scenarioId: string;
  stage: StageWithAccommodations;
  colorDot: string;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
}) {
  const { patchStage, removeStage, addAccommodation, patchAccommodation } = usePlanner();
  const [collapsed, setCollapsed] = useState(false);
  const chosen = chosenAccommodation(stage);
  const nights = num(stage.nights);

  const patch = (p: Partial<TripStageRow>) => patchStage(scenarioId, stage.id, p);

  /** Re-derive each accommodation's per-night price for a new night count. */
  const repriceFor = (newNights: number) => {
    for (const acc of stage.accommodations) {
      patchAccommodation(scenarioId, stage.id, acc.id, {
        price_per_night: perNight(acc.price_total, newNights),
      });
    }
  };

  const setNights = (n: number | null) => {
    const next = n ?? 0;
    patch({ nights: next });
    repriceFor(next);
  };

  /** Editing a date auto-computes nights (and reprices) when both are set. */
  const setDate = (key: "date_from" | "date_to", value: string | null) => {
    const from = key === "date_from" ? value : stage.date_from;
    const to = key === "date_to" ? value : stage.date_to;
    const computed = nightsBetween(from, to);
    if (computed != null) {
      patch({ [key]: value, nights: computed } as Partial<TripStageRow>);
      repriceFor(computed);
    } else {
      patch({ [key]: value } as Partial<TripStageRow>);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOn}
      className={cn(
        "rounded-lg bg-paper border border-line shadow-sm transition-opacity",
        isDragging && "opacity-40",
      )}
    >
      {/* Stage header */}
      <div className="flex items-center gap-2 p-4">
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing text-ink-soft/50 hover:text-ink-soft select-none"
          title="Drag to reorder"
        >
          ⠿
        </span>
        <InlineText
          value={stage.emoji ?? ""}
          onCommit={(v) => patch({ emoji: v || null })}
          placeholder="🏝️"
          className="text-lg"
        />
        <div className="min-w-0 flex-1">
          <InlineText
            value={stage.name}
            onCommit={(v) => patch({ name: v })}
            className="font-serif text-[20px] block"
          />
          <div className="flex items-center gap-2 text-xs text-ink-soft flex-wrap">
            <InlineText value={stage.destination ?? ""} onCommit={(v) => patch({ destination: v || null })} placeholder="destination" />
            <span>·</span>
            <span className="flex items-center gap-1">
              <InlineNumber value={nights} onCommit={setNights} /> nights
            </span>
          </div>
        </div>
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colorDot)} />
        <button type="button" onClick={() => setCollapsed((v) => !v)} className="text-ink-soft hover:text-ink text-xs px-1">
          {collapsed ? "▸" : "▾"}
        </button>
        <button
          type="button"
          onClick={() => { if (confirm(`Delete stage "${stage.name}"?`)) removeStage(scenarioId, stage.id); }}
          className="text-burgundy hover:text-burgundy-deep text-sm"
          aria-label="Delete stage"
        >
          ✕
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Dates */}
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <span>📅</span>
            <input
              type="date"
              value={stage.date_from ?? ""}
              onChange={(e) => setDate("date_from", e.target.value || null)}
              className="rounded-[2px] border border-line bg-paper px-1.5 py-0.5"
            />
            <span>→</span>
            <input
              type="date"
              value={stage.date_to ?? ""}
              onChange={(e) => setDate("date_to", e.target.value || null)}
              className="rounded-[2px] border border-line bg-paper px-1.5 py-0.5"
            />
          </div>

          {/* Notes */}
          <InlineText
            value={stage.notes ?? ""}
            onCommit={(v) => patch({ notes: v || null })}
            placeholder="Logistics, tips, halal spots…"
            multiline
            className="block text-[13px] text-ink-soft"
          />

          {/* Accommodations */}
          <div className="space-y-2">
            {stage.accommodations.map((acc) => (
              <AccommodationCard key={acc.id} scenarioId={scenarioId} stageId={stage.id} nights={nights} acc={acc} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => addAccommodation(scenarioId, stage.id)}
            className="w-full rounded-[2px] border border-dashed border-line py-2 text-xs text-ink-soft hover:border-ink hover:text-ink transition-colors"
          >
            + Add accommodation
          </button>

          {/* Stage footer */}
          <div className="pt-1 text-xs">
            {chosen ? (
              <span className="text-ink-soft">
                Chosen: <span className="text-ink font-medium">{chosen.name}</span> · {formatMoney(chosen.price_total)}
              </span>
            ) : (
              <span className="text-burgundy">⚠ No choice yet</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
