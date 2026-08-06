"use client";

import { useState } from "react";
import { formatMoney, cn } from "@/lib/utils";
import { ActionError } from "@/components/action-error";
import { Segmented } from "@/components/ui/segmented";
import { usePageHeader } from "@/components/shell/header-context";
import { PlannerProvider, usePlanner } from "./use-planner";
import { ScenarioDetail } from "./scenario-detail";
import { CompareView } from "./compare-view";
import { type ScenarioWithStages, scenarioTotal, scenarioNet, totalNights } from "./types";

export function HoneymoonClient({
  initialScenarios,
}: {
  initialScenarios: ScenarioWithStages[];
}) {
  return (
    <PlannerProvider initialScenarios={initialScenarios}>
      <PlannerShell />
    </PlannerProvider>
  );
}

type View = "cards" | "compare";

function PlannerShell() {
  const { scenarios, addScenario, duplicate, error, dismissError } = usePlanner();
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>("cards");

  const openScenario = scenarios.find((s) => s.id === openId) ?? null;

  const handleNew = async () => {
    const id = await addScenario();
    if (id) setOpenId(id);
  };

  usePageHeader("New scenario", handleNew);

  return (
    <section className="font-apple flex flex-col gap-6 text-[var(--fg)]">
      {scenarios.length > 0 && (
        <Segmented
          options={[{ value: "cards", label: "Scenarios" }, { value: "compare", label: "Compare" }]}
          value={view}
          onChange={setView}
        />
      )}

      <ActionError message={error} onDismiss={dismissError} />

      {scenarios.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : view === "compare" ? (
        <CompareView scenarios={scenarios} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onOpen={() => setOpenId(s.id)}
              onDuplicate={async () => {
                const id = await duplicate(s.id);
                if (id) setOpenId(id);
              }}
            />
          ))}
        </div>
      )}

      {openScenario && (
        <ScenarioDetail scenario={openScenario} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}

function ScenarioCard({
  scenario, onOpen, onDuplicate,
}: {
  scenario: ScenarioWithStages;
  onOpen: () => void;
  onDuplicate: () => void;
}) {
  const { removeScenario, selectFinal } = usePlanner();
  const total = scenarioTotal(scenario);
  const net = scenarioNet(scenario);
  const discounted = net < total;
  const final = scenario.is_selected;
  const route = scenario.stages.map((st) => st.destination || st.name).join(" · ");

  return (
    <article
      className="flex flex-col overflow-hidden rounded-[12px] bg-[var(--card)]"
      style={final ? { boxShadow: "inset 0 0 0 1.5px var(--accent)" } : undefined}
    >
      <div className="flex flex-1 flex-col gap-3.5 px-5 pt-5 pb-[18px]">
        {final && (
          <span className="text-[12px] font-semibold tracking-[0.05em] text-[var(--accent)] uppercase">Chosen</span>
        )}

        <div>
          <button type="button" onClick={onOpen} className="text-left">
            <h3 className="text-[24px] leading-tight font-[680] tracking-[-0.03em] hover:opacity-70">
              {scenario.name}
            </h3>
          </button>
          {scenario.description && (
            <p className="mt-1 text-[15px] text-[var(--fg2)]">{scenario.description}</p>
          )}
        </div>

        {route && <div className="text-[15px] text-[var(--fg)]">{route}</div>}

        <div className="text-[14px] text-[var(--fg2)]">
          {totalNights(scenario)} nights · {scenario.stages.length} stage{scenario.stages.length === 1 ? "" : "s"}
          {discounted && scenario.promo_code ? ` · ${scenario.promo_code}` : ""}
        </div>

        <div className="mt-auto flex items-baseline gap-2.5">
          <span className="text-[28px] font-[680] tracking-[-0.035em] tabular-nums">{formatMoney(net)}</span>
          {discounted && (
            <span className="text-[16px] text-[var(--fg3)] tabular-nums line-through">{formatMoney(total)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-[var(--sep)] px-5 py-3">
        <button type="button" onClick={onOpen} className="text-[15px] text-[var(--accent)] hover:opacity-60">
          Edit
        </button>
        <button type="button" onClick={onDuplicate} className="text-[15px] text-[var(--accent)] hover:opacity-60">
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => { if (confirm(`Delete scenario "${scenario.name}"? This cannot be undone.`)) removeScenario(scenario.id); }}
          className="text-[15px] text-[var(--fg3)] hover:opacity-60"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={final}
          onClick={() => { if (confirm(`Mark "${scenario.name}" as your final honeymoon plan?`)) selectFinal(scenario.id); }}
          className={cn(
            "ml-auto text-[15px]",
            final ? "font-[590] text-[var(--accent)]" : "text-[var(--accent)] hover:opacity-60"
          )}
        >
          {final ? "Chosen" : "Choose"}
        </button>
      </div>
    </article>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="px-1 py-16 text-center">
      <p className="text-[17px] text-[var(--fg2)]">No scenarios yet.</p>
      <p className="mt-2 text-[14px] text-[var(--fg3)]">Create your first trip scenario and start comparing itineraries.</p>
      <button
        type="button"
        onClick={onNew}
        className="mt-6 text-[15px] text-[var(--accent)] hover:opacity-60"
      >
        New scenario
      </button>
    </div>
  );
}
