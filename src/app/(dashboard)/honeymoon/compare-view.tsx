"use client";

import { formatMoney, cn } from "@/lib/utils";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { usePlanner } from "./use-planner";
import { type ScenarioWithStages, chosenAccommodation, scenarioTotal, scenarioNet, totalNights } from "./types";

/**
 * Side-by-side comparison of up to 3 scenarios. Rows are matched by
 * order_index (i.e. "stage 1 vs stage 1"); the longest itinerary sets the
 * row count.
 */
export function CompareView({ scenarios }: { scenarios: ScenarioWithStages[] }) {
  const { selectFinal } = usePlanner();
  const cols = scenarios.slice(0, 3);
  const maxStages = Math.max(0, ...cols.map((s) => s.stages.length));
  const gridStyle = { gridTemplateColumns: `120px repeat(${cols.length}, 1fr)` };

  if (cols.length === 0) {
    return <p className="px-1 py-12 text-center text-[15px] text-[var(--fg2)]">Create a scenario to start comparing.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <ListGroup>
        <ListRow className="grid items-baseline gap-2.5" style={gridStyle}>
          <span className="text-[14px] font-semibold text-[var(--fg)]">Scenario</span>
          {cols.map((s) => (
            <span
              key={s.id}
              className="text-right text-[15px] font-[640] tabular-nums"
              style={{ color: s.is_selected ? "var(--accent)" : undefined }}
            >
              {s.name}
            </span>
          ))}
        </ListRow>

        <ListRow className="grid items-baseline gap-2.5" style={gridStyle}>
          <span className="text-[14px] text-[var(--fg2)]">Nights</span>
          {cols.map((s) => <Cell key={s.id} selected={s.is_selected}>{totalNights(s)}</Cell>)}
        </ListRow>

        <ListRow className="grid items-baseline gap-2.5" style={gridStyle}>
          <span className="text-[14px] text-[var(--fg2)]">Stages</span>
          {cols.map((s) => <Cell key={s.id} selected={s.is_selected}>{s.stages.length}</Cell>)}
        </ListRow>

        {Array.from({ length: maxStages }).map((_, rowIdx) => {
          const label = cols.map((s) => s.stages[rowIdx]).find(Boolean)?.name ?? `Stage ${rowIdx + 1}`;
          return (
            <ListRow key={rowIdx} className="grid items-baseline gap-2.5" style={gridStyle}>
              <span className="text-[14px] text-[var(--fg2)]">{label}</span>
              {cols.map((s) => {
                const stage = s.stages[rowIdx];
                const chosen = stage ? chosenAccommodation(stage) : null;
                return (
                  <Cell key={s.id} selected={s.is_selected}>
                    {!stage ? "—" : chosen ? formatMoney(chosen.price_total) : "No choice"}
                  </Cell>
                );
              })}
            </ListRow>
          );
        })}

        <ListRow className="grid items-baseline gap-2.5" style={gridStyle}>
          <span className="text-[14px] text-[var(--fg2)]">List price</span>
          {cols.map((s) => <Cell key={s.id} selected={s.is_selected}>{formatMoney(scenarioTotal(s))}</Cell>)}
        </ListRow>

        <ListRow className="grid items-baseline gap-2.5" style={gridStyle}>
          <span className="text-[14px] text-[var(--fg2)]">You pay</span>
          {cols.map((s) => <Cell key={s.id} selected={s.is_selected}>{formatMoney(scenarioNet(s))}</Cell>)}
        </ListRow>

        <ListRow className="grid items-baseline gap-2.5" style={gridStyle}>
          <span className="text-[14px] text-[var(--fg2)]">Per night</span>
          {cols.map((s) => {
            const nights = totalNights(s);
            return (
              <Cell key={s.id} selected={s.is_selected}>
                {nights > 0 ? formatMoney(Math.round(scenarioNet(s) / nights)) : "—"}
              </Cell>
            );
          })}
        </ListRow>

        <ListRow className="grid items-baseline gap-2.5" style={gridStyle}>
          <span />
          {cols.map((s) => (
            <span key={s.id} className="text-right">
              <button
                type="button"
                disabled={s.is_selected}
                onClick={() => { if (confirm(`Mark "${s.name}" as your final honeymoon plan?`)) selectFinal(s.id); }}
                className={cn("text-[15px] text-[var(--accent)]", s.is_selected ? "font-[590]" : "hover:opacity-60")}
              >
                {s.is_selected ? "Chosen" : "Choose"}
              </button>
            </span>
          ))}
        </ListRow>
      </ListGroup>
    </div>
  );
}

function Cell({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  return (
    <span
      className="text-right text-[15px] tabular-nums"
      style={{ color: selected ? "var(--accent)" : "var(--fg)" }}
    >
      {children}
    </span>
  );
}
