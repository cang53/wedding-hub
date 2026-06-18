"use client";

import { createContext, useContext, useState } from "react";
import type {
  TripScenarioRow,
  TripStageRow,
  StageAccommodationRow,
} from "@/types/db";
import type { ScenarioWithStages, StageWithAccommodations } from "./types";
import { SCENARIO_COLOR_KEYS } from "./types";
import * as api from "./actions";

// ============================================================================
// Planner store — single source of truth for the scenario tree.
//
// Creates await the server then patch local state (avoids temp-id juggling for
// nested children). Updates / deletes / choose / reorder apply optimistically.
// ============================================================================

interface PlannerApi {
  scenarios: ScenarioWithStages[];

  addScenario: () => Promise<string | undefined>;
  duplicate: (id: string) => Promise<string | undefined>;
  patchScenario: (id: string, patch: Partial<TripScenarioRow>) => void;
  removeScenario: (id: string) => void;
  selectFinal: (id: string) => void;

  addStage: (scenarioId: string) => Promise<void>;
  patchStage: (scenarioId: string, stageId: string, patch: Partial<TripStageRow>) => void;
  removeStage: (scenarioId: string, stageId: string) => void;
  reorder: (scenarioId: string, orderedIds: string[]) => void;

  addAccommodation: (scenarioId: string, stageId: string) => Promise<void>;
  patchAccommodation: (
    scenarioId: string,
    stageId: string,
    accId: string,
    patch: Partial<StageAccommodationRow>,
  ) => void;
  removeAccommodation: (scenarioId: string, stageId: string, accId: string) => void;
  choose: (scenarioId: string, stageId: string, accId: string) => void;
}

const PlannerContext = createContext<PlannerApi | null>(null);

export function usePlanner(): PlannerApi {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within <PlannerProvider>");
  return ctx;
}

export function PlannerProvider({
  initialScenarios,
  children,
}: {
  initialScenarios: ScenarioWithStages[];
  children: React.ReactNode;
}) {
  const [scenarios, setScenarios] = useState<ScenarioWithStages[]>(initialScenarios);

  // -- small helpers to update nested state immutably ----------------------
  const mapScenario = (id: string, fn: (s: ScenarioWithStages) => ScenarioWithStages) =>
    setScenarios((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));

  const mapStage = (
    scenarioId: string,
    stageId: string,
    fn: (st: StageWithAccommodations) => StageWithAccommodations,
  ) =>
    mapScenario(scenarioId, (s) => ({
      ...s,
      stages: s.stages.map((st) => (st.id === stageId ? fn(st) : st)),
    }));

  // -- scenarios -----------------------------------------------------------
  const addScenario: PlannerApi["addScenario"] = async () => {
    const color = SCENARIO_COLOR_KEYS[scenarios.length % SCENARIO_COLOR_KEYS.length];
    const res = await api.createScenario({
      name: `Scenario ${String.fromCharCode(65 + scenarios.length)}`,
      color,
    });
    if (!("ok" in res)) return undefined;
    setScenarios((prev) => [...prev, { ...res.data, stages: [] }]);
    return res.data.id;
  };

  const duplicate: PlannerApi["duplicate"] = async (id) => {
    const res = await api.duplicateScenario(id);
    if (!("ok" in res)) return undefined;
    setScenarios((prev) => [...prev, { ...res.data, stages: res.data.stages ?? [] }]);
    return res.data.id;
  };

  const patchScenario: PlannerApi["patchScenario"] = (id, patch) => {
    mapScenario(id, (s) => ({ ...s, ...patch }));
    void api.updateScenario(id, patch);
  };

  const removeScenario: PlannerApi["removeScenario"] = (id) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    void api.deleteScenario(id);
  };

  const selectFinal: PlannerApi["selectFinal"] = (id) => {
    setScenarios((prev) => prev.map((s) => ({ ...s, is_selected: s.id === id })));
    void api.selectScenarioAsFinal(id);
  };

  // -- stages --------------------------------------------------------------
  const addStage: PlannerApi["addStage"] = async (scenarioId) => {
    const res = await api.createStage(scenarioId, { name: "New stage", nights: 1 });
    if (!("ok" in res)) return;
    mapScenario(scenarioId, (s) => ({
      ...s,
      stages: [...s.stages, { ...res.data, accommodations: [] }],
    }));
  };

  const patchStage: PlannerApi["patchStage"] = (scenarioId, stageId, patch) => {
    mapStage(scenarioId, stageId, (st) => ({ ...st, ...patch }));
    void api.updateStage(stageId, patch);
  };

  const removeStage: PlannerApi["removeStage"] = (scenarioId, stageId) => {
    mapScenario(scenarioId, (s) => ({
      ...s,
      stages: s.stages.filter((st) => st.id !== stageId),
    }));
    void api.deleteStage(stageId);
  };

  const reorder: PlannerApi["reorder"] = (scenarioId, orderedIds) => {
    mapScenario(scenarioId, (s) => {
      const byId = new Map(s.stages.map((st) => [st.id, st]));
      const stages = orderedIds
        .map((id, index) => {
          const st = byId.get(id);
          return st ? { ...st, order_index: index } : null;
        })
        .filter((x): x is StageWithAccommodations => x !== null);
      return { ...s, stages };
    });
    void api.reorderStages(orderedIds);
  };

  // -- accommodations ------------------------------------------------------
  const addAccommodation: PlannerApi["addAccommodation"] = async (scenarioId, stageId) => {
    // Auto-choose the first option in an otherwise empty stage so the stage
    // immediately contributes to the scenario total.
    const stage = scenarios.find((s) => s.id === scenarioId)?.stages.find((st) => st.id === stageId);
    const isFirst = (stage?.accommodations.length ?? 0) === 0;
    const res = await api.createAccommodation(stageId, {
      name: "New option",
      platform: "Booking",
      is_chosen: isFirst,
    });
    if (!("ok" in res)) return;
    mapStage(scenarioId, stageId, (st) => ({
      ...st,
      accommodations: [...st.accommodations, res.data],
    }));
  };

  const patchAccommodation: PlannerApi["patchAccommodation"] = (
    scenarioId,
    stageId,
    accId,
    patch,
  ) => {
    mapStage(scenarioId, stageId, (st) => ({
      ...st,
      accommodations: st.accommodations.map((a) => (a.id === accId ? { ...a, ...patch } : a)),
    }));
    void api.updateAccommodation(accId, patch);
  };

  const removeAccommodation: PlannerApi["removeAccommodation"] = (scenarioId, stageId, accId) => {
    mapStage(scenarioId, stageId, (st) => ({
      ...st,
      accommodations: st.accommodations.filter((a) => a.id !== accId),
    }));
    void api.deleteAccommodation(accId);
  };

  const choose: PlannerApi["choose"] = (scenarioId, stageId, accId) => {
    mapStage(scenarioId, stageId, (st) => ({
      ...st,
      accommodations: st.accommodations.map((a) => ({ ...a, is_chosen: a.id === accId })),
    }));
    void api.chooseAccommodation(stageId, accId);
  };

  const value: PlannerApi = {
    scenarios,
    addScenario,
    duplicate,
    patchScenario,
    removeScenario,
    selectFinal,
    addStage,
    patchStage,
    removeStage,
    reorder,
    addAccommodation,
    patchAccommodation,
    removeAccommodation,
    choose,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}
