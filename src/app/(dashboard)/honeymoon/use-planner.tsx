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

  /** Message from the last failed write, or null. */
  error: string | null;
  dismissError: () => void;

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
  const [error, setError] = useState<string | null>(null);

  /**
   * Fire an optimistic write and reconcile the outcome.
   *
   * These used to be `void api.x(...)`, which meant a rejected write left the
   * optimistic edit on screen looking saved until the next reload. Rolling the
   * whole tree back to `snapshot` is coarse but correct — the planner's state
   * is one nested structure, so there's no smaller unit to restore.
   */
  const run = (
    snapshot: ScenarioWithStages[],
    op: Promise<{ error: string } | { ok: true }>,
  ) => {
    void op.then((res) => {
      if ("error" in res) {
        setScenarios(snapshot);
        setError(res.error);
      }
    });
  };

  const dismissError = () => setError(null);

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
    if (!("ok" in res)) { setError(res.error); return undefined; }
    setScenarios((prev) => [...prev, { ...res.data, stages: [] }]);
    return res.data.id;
  };

  const duplicate: PlannerApi["duplicate"] = async (id) => {
    const res = await api.duplicateScenario(id);
    if (!("ok" in res)) { setError(res.error); return undefined; }
    setScenarios((prev) => [...prev, { ...res.data, stages: res.data.stages ?? [] }]);
    return res.data.id;
  };

  const patchScenario: PlannerApi["patchScenario"] = (id, patch) => {
    const snapshot = scenarios;
    mapScenario(id, (s) => ({ ...s, ...patch }));
    run(snapshot, api.updateScenario(id, patch));
  };

  const removeScenario: PlannerApi["removeScenario"] = (id) => {
    const snapshot = scenarios;
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    run(snapshot, api.deleteScenario(id));
  };

  const selectFinal: PlannerApi["selectFinal"] = (id) => {
    const snapshot = scenarios;
    setScenarios((prev) => prev.map((s) => ({ ...s, is_selected: s.id === id })));
    run(snapshot, api.selectScenarioAsFinal(id));
  };

  // -- stages --------------------------------------------------------------
  const addStage: PlannerApi["addStage"] = async (scenarioId) => {
    const res = await api.createStage(scenarioId, { name: "New stage", nights: 1 });
    if (!("ok" in res)) { setError(res.error); return; }
    mapScenario(scenarioId, (s) => ({
      ...s,
      stages: [...s.stages, { ...res.data, accommodations: [] }],
    }));
  };

  const patchStage: PlannerApi["patchStage"] = (scenarioId, stageId, patch) => {
    const snapshot = scenarios;
    mapStage(scenarioId, stageId, (st) => ({ ...st, ...patch }));
    run(snapshot, api.updateStage(stageId, patch));
  };

  const removeStage: PlannerApi["removeStage"] = (scenarioId, stageId) => {
    const snapshot = scenarios;
    mapScenario(scenarioId, (s) => ({
      ...s,
      stages: s.stages.filter((st) => st.id !== stageId),
    }));
    run(snapshot, api.deleteStage(stageId));
  };

  const reorder: PlannerApi["reorder"] = (scenarioId, orderedIds) => {
    const snapshot = scenarios;
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
    run(snapshot, api.reorderStages(orderedIds));
  };

  // -- accommodations ------------------------------------------------------
  const addAccommodation: PlannerApi["addAccommodation"] = async (scenarioId, stageId) => {
    const res = await api.createAccommodation(stageId, { name: "New option", platform: "Booking" });
    if (!("ok" in res)) { setError(res.error); return; }
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
    const snapshot = scenarios;
    mapStage(scenarioId, stageId, (st) => ({
      ...st,
      accommodations: st.accommodations.map((a) => (a.id === accId ? { ...a, ...patch } : a)),
    }));
    run(snapshot, api.updateAccommodation(accId, patch));
  };

  const removeAccommodation: PlannerApi["removeAccommodation"] = (scenarioId, stageId, accId) => {
    const snapshot = scenarios;
    mapStage(scenarioId, stageId, (st) => ({
      ...st,
      accommodations: st.accommodations.filter((a) => a.id !== accId),
    }));
    run(snapshot, api.deleteAccommodation(accId));
  };

  const choose: PlannerApi["choose"] = (scenarioId, stageId, accId) => {
    const snapshot = scenarios;
    mapStage(scenarioId, stageId, (st) => ({
      ...st,
      accommodations: st.accommodations.map((a) => ({ ...a, is_chosen: a.id === accId })),
    }));
    run(snapshot, api.chooseAccommodation(stageId, accId));
  };

  const value: PlannerApi = {
    scenarios,
    error,
    dismissError,
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
