"use client";

import { useState } from "react";
import { formatMoney, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/action-error";
import { PlannerProvider, usePlanner } from "./use-planner";
import { ScenarioDetail } from "./scenario-detail";
import { CompareView } from "./compare-view";
import {
  type ScenarioWithStages,
  SCENARIO_COLORS,
  scenarioTotal,
  scenarioNet,
  totalNights,
} from "./types";

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

function PlannerShell() {
  const { scenarios, addScenario, duplicate, error, dismissError } = usePlanner();
  const [openId, setOpenId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const openScenario = scenarios.find((s) => s.id === openId) ?? null;

  const handleNew = async () => {
    const id = await addScenario();
    if (id) setOpenId(id);
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>honeymoon</em>
          </h2>
          <p className="text-sm text-ink-soft">Build, simulate and compare full trip scenarios stage by stage.</p>
        </div>
        <div className="flex items-center gap-2">
          {scenarios.length > 0 && (
            <Button variant="ghost" onClick={() => setComparing((v) => !v)}>
              {comparing ? "← Scenarios" : "Compare"}
            </Button>
          )}
          <Button onClick={handleNew}>+ New scenario</Button>
        </div>
      </div>

      <ActionError message={error} onDismiss={dismissError} />

      {scenarios.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : comparing ? (
        <CompareView scenarios={scenarios} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
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
  scenario,
  onOpen,
  onDuplicate,
}: {
  scenario: ScenarioWithStages;
  onOpen: () => void;
  onDuplicate: () => void;
}) {
  const { removeScenario, selectFinal } = usePlanner();
  const color = SCENARIO_COLORS[scenario.color] ?? SCENARIO_COLORS.sage;
  const total = scenarioTotal(scenario);
  const net = scenarioNet(scenario);
  const discounted = net < total;

  return (
    <article
      className={cn(
        "rounded-lg bg-paper border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-lg",
        scenario.is_selected ? "border-gold" : "border-line",
      )}
    >
      {/* Color strip + title */}
      <div className={cn("px-5 pt-4 pb-3 border-b", color.bg, color.border)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-full", color.dot)} />
              {scenario.is_selected && (
                <span className="text-[11px] uppercase tracking-wider text-gold font-medium">👑 Final plan</span>
              )}
            </div>
            <button onClick={onOpen} className="text-left">
              <h3 className={cn("font-serif text-[22px] leading-tight hover:underline", color.text)}>{scenario.name}</h3>
            </button>
            {scenario.description && (
              <p className="text-xs text-ink-soft mt-0.5 line-clamp-1">{scenario.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 flex-1 flex flex-col gap-3">
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <span>{scenario.stages.length} stages</span>
          <span>·</span>
          <span>{totalNights(scenario)} nights</span>
        </div>

        {/* Mini timeline */}
        {scenario.stages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {scenario.stages.map((st, i) => (
              <span key={st.id} className="flex items-center gap-1">
                <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[11px] text-ink">
                  {st.emoji ? `${st.emoji} ` : ""}{st.name} {st.nights}n
                </span>
                {i < scenario.stages.length - 1 && <span className="text-ink-soft/50 text-[10px]">→</span>}
              </span>
            ))}
          </div>
        )}

        {/* Cost */}
        <div className="mt-auto pt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink-soft">Total</span>
            <span className={cn("text-sm", discounted && "line-through text-ink-soft/60")}>{formatMoney(total)}</span>
          </div>
          {discounted && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gold uppercase tracking-wider">{scenario.promo_code || "Promo"}</span>
              <span className="font-serif text-[24px] text-burgundy">{formatMoney(net)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-line px-3 py-2 text-[11px]">
        <button onClick={onOpen} className="rounded-[2px] px-2 py-1 uppercase tracking-wider text-ink-soft hover:text-ink hover:bg-cream-deep">Edit</button>
        <button onClick={onDuplicate} className="rounded-[2px] px-2 py-1 uppercase tracking-wider text-ink-soft hover:text-ink hover:bg-cream-deep">Duplicate</button>
        <button
          onClick={() => { if (confirm(`Delete scenario "${scenario.name}"? This cannot be undone.`)) removeScenario(scenario.id); }}
          className="rounded-[2px] px-2 py-1 uppercase tracking-wider text-burgundy hover:bg-burgundy/10"
        >
          Delete
        </button>
        <button
          onClick={() => { if (!scenario.is_selected && confirm(`Mark "${scenario.name}" as your final honeymoon plan?`)) selectFinal(scenario.id); }}
          disabled={scenario.is_selected}
          className={cn(
            "ml-auto rounded-[2px] px-2.5 py-1 uppercase tracking-wider transition-colors",
            scenario.is_selected ? "text-gold cursor-default" : "bg-ink text-cream hover:bg-burgundy",
          )}
        >
          {scenario.is_selected ? "👑 Final" : "Select as final"}
        </button>
      </div>
    </article>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-20 px-5 text-ink-soft">
      <div className="text-6xl mb-4 opacity-40">🗺️</div>
      <p className="font-serif italic text-[26px] text-ink mb-2">No scenarios yet.</p>
      <p className="text-[13px] mb-6">Create your first trip scenario and start comparing itineraries.</p>
      <Button onClick={onNew}>+ New scenario</Button>
    </div>
  );
}
