"use client";

import { formatMoney, cn } from "@/lib/utils";
import { usePlanner } from "./use-planner";
import {
  type ScenarioWithStages,
  SCENARIO_COLORS,
  chosenAccommodation,
  scenarioTotal,
  scenarioNet,
} from "./types";

/**
 * Side-by-side comparison of up to 3 scenarios. Rows are matched by
 * order_index (i.e. "stage 1 vs stage 1"); the longest itinerary sets the
 * row count. On mobile the columns scroll horizontally (2 fit at a time).
 */
export function CompareView({ scenarios }: { scenarios: ScenarioWithStages[] }) {
  const { selectFinal } = usePlanner();
  const cols = scenarios.slice(0, 3);
  const maxStages = Math.max(0, ...cols.map((s) => s.stages.length));

  if (cols.length === 0) {
    return <p className="text-center text-ink-soft italic py-12">Create a scenario to start comparing.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div
        className="grid gap-3 min-w-[640px]"
        style={{ gridTemplateColumns: `140px repeat(${cols.length}, minmax(180px, 1fr))` }}
      >
        {/* Header row */}
        <div />
        {cols.map((s) => {
          const color = SCENARIO_COLORS[s.color] ?? SCENARIO_COLORS.sage;
          return (
            <div key={s.id} className={cn("rounded-t-lg border px-3 py-2.5 text-center", color.bg, color.border)}>
              <div className="flex items-center justify-center gap-1.5">
                {s.is_selected && <span className="text-gold">👑</span>}
                <span className={cn("font-serif text-[17px] leading-tight", color.text)}>{s.name}</span>
              </div>
            </div>
          );
        })}

        {/* Stage rows */}
        {Array.from({ length: maxStages }).map((_, rowIdx) => (
          <RowGroup key={rowIdx} rowIdx={rowIdx} cols={cols} />
        ))}

        {/* Totals */}
        <div className="flex items-center text-xs font-medium uppercase tracking-wider text-ink-soft px-1">Total</div>
        {cols.map((s) => (
          <div key={s.id} className="border-x border-line bg-paper px-3 py-2 text-center text-sm">
            {formatMoney(scenarioTotal(s))}
          </div>
        ))}

        {/* Promo */}
        <div className="flex items-center text-xs font-medium uppercase tracking-wider text-ink-soft px-1">Promo</div>
        {cols.map((s) => (
          <div key={s.id} className="border-x border-line bg-paper px-3 py-2 text-center text-sm text-sage">
            {s.promo_amount ? `−${formatMoney(s.promo_amount)}` : "—"}
          </div>
        ))}

        {/* You pay */}
        <div className="flex items-center text-xs font-medium uppercase tracking-wider px-1">You pay</div>
        {cols.map((s) => (
          <div key={s.id} className="border-x border-b border-line bg-burgundy/5 px-3 py-2.5 text-center">
            <span className="font-serif text-[22px] text-burgundy">{formatMoney(scenarioNet(s))}</span>
          </div>
        ))}

        {/* Select as final */}
        <div />
        {cols.map((s) => (
          <div key={s.id} className="px-3 py-3 text-center">
            <button
              type="button"
              disabled={s.is_selected}
              onClick={() => {
                if (confirm(`Mark "${s.name}" as your final honeymoon plan?`)) selectFinal(s.id);
              }}
              className={cn(
                "w-full rounded-[2px] px-3 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors",
                s.is_selected
                  ? "bg-gold/20 text-gold cursor-default"
                  : "bg-ink text-cream hover:bg-burgundy",
              )}
            >
              {s.is_selected ? "👑 Selected" : "Select as final"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RowGroup({ rowIdx, cols }: { rowIdx: number; cols: ScenarioWithStages[] }) {
  // Label the row from the first scenario that has a stage at this index.
  const label =
    cols.map((s) => s.stages[rowIdx]).find(Boolean)?.name ?? `Stage ${rowIdx + 1}`;

  return (
    <>
      <div className="flex items-center text-xs text-ink-soft px-1 border-t border-line/50">{label}</div>
      {cols.map((s) => {
        const stage = s.stages[rowIdx];
        const chosen = stage ? chosenAccommodation(stage) : null;
        return (
          <div key={s.id} className="border-x border-t border-line/50 bg-paper px-3 py-2 text-center text-[13px]">
            {!stage ? (
              <span className="text-ink-soft/40">—</span>
            ) : chosen ? (
              <>
                <div className="truncate">{chosen.name}</div>
                <div className="text-ink-soft text-xs">{formatMoney(chosen.price_total)}</div>
              </>
            ) : (
              <span className="text-burgundy text-xs">No choice</span>
            )}
          </div>
        );
      })}
    </>
  );
}
