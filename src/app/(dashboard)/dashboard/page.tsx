import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { formatMoney } from "@/lib/utils";
import { OverviewClient } from "./overview-client";
import type { TodoPriority, TodoRow, AgendaRow, BudgetRow, GuestRow, TripScenarioRow } from "@/types/db";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

type TodoStat = Pick<TodoRow, "id" | "text" | "priority" | "done">;
type AgendaStat = Pick<AgendaRow, "id" | "title" | "date" | "all_day" | "location">;
type BudgetStat = Pick<BudgetRow, "estimated" | "paid">;
type GuestStat = Pick<GuestRow, "rsvp" | "plus_one">;
type ScenarioStat = Pick<TripScenarioRow, "id" | "is_selected">;

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const todayIso = new Date(new Date().toDateString()).toISOString();

  const [todosRes, agendaRes, budgetRes, guestsRes, scenariosRes] = await Promise.all([
    supabase.from("todos").select("id, text, priority, done"),
    supabase
      .from("agenda")
      .select("id, title, date, all_day, location")
      .gte("date", todayIso)
      .order("date", { ascending: true })
      .limit(5),
    supabase.from("budget").select("estimated, paid"),
    supabase.from("guests").select("rsvp, plus_one"),
    // The Honeymoon screen itself is driven by trip_scenarios, not the legacy
    // honeymoon table — read the same source so this figure can't drift out
    // of sync with what's actually shown there.
    supabase.from("trip_scenarios").select("id, is_selected"),
  ]);

  const todos = (todosRes.data ?? []) as TodoStat[];
  const upcoming = (agendaRes.data ?? []) as AgendaStat[];
  const budget = (budgetRes.data ?? []) as BudgetStat[];
  const guests = (guestsRes.data ?? []) as GuestStat[];
  const scenarios = (scenariosRes.data ?? []) as ScenarioStat[];

  const remaining = budget.reduce((sum, b) => sum + Number(b.estimated ?? 0), 0)
    - budget.reduce((sum, b) => sum + Number(b.paid ?? 0), 0);

  const yes = guests.filter((g) => g.rsvp === "yes").length;
  const plusOnes = guests.filter((g) => g.plus_one).length;
  const guestTotal = guests.length + plusOnes;

  const chosenScenarios = scenarios.filter((s) => s.is_selected).length;

  const openTasks = todos.filter((t) => !t.done);
  const visibleTasks = openTasks
    .slice()
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
    .slice(0, 5)
    .map((t) => ({ id: t.id, text: t.text, priority: t.priority }));

  const standing = [
    { label: "Budget", value: `${formatMoney(remaining)} left` },
    { label: "Guests", value: `${yes} of ${guestTotal} confirmed` },
    {
      label: "Honeymoon",
      value: `${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"}, ${chosenScenarios} chosen`,
    },
  ];

  return (
    <OverviewClient
      standing={standing}
      upcoming={upcoming}
      visibleTasks={visibleTasks}
      otherOpenCount={openTasks.length - visibleTasks.length}
    />
  );
}
