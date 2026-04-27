import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import { formatDate, formatMoney } from "@/lib/utils";
import type {
  TodoPriority,
  TodoRow,
  AgendaRow,
  BudgetRow,
  GuestRow,
  HoneymoonRow,
} from "@/types/db";

// Force dynamic rendering — every visit to /dashboard re-queries the DB.
// (Static rendering would cache stale stats per build.)
export const dynamic = "force-dynamic";

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

// Narrow row types for the limited fields each query selects. Keeps the
// dashboard's display logic typed without depending on the Supabase
// generated Database type.
type TodoStat = Pick<TodoRow, "id" | "text" | "priority" | "done">;
type AgendaStat = Pick<AgendaRow, "id" | "title" | "date" | "all_day" | "location">;
type BudgetStat = Pick<BudgetRow, "estimated" | "paid" | "status">;
type GuestStat = Pick<GuestRow, "rsvp" | "plus_one">;
type HoneymoonStat = Pick<HoneymoonRow, "id" | "favorite">;

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();

  const todayIso = new Date(new Date().toDateString()).toISOString();

  const [todosRes, agendaRes, budgetRes, guestsRes, honeymoonRes] = await Promise.all([
    supabase.from("todos").select("id, text, priority, done"),
    supabase
      .from("agenda")
      .select("id, title, date, all_day, location")
      .gte("date", todayIso)
      .order("date", { ascending: true })
      .limit(5),
    supabase.from("budget").select("estimated, paid, status"),
    supabase.from("guests").select("rsvp, plus_one"),
    supabase.from("honeymoon").select("id, favorite"),
  ]);

  const todos: TodoStat[] = (todosRes.data ?? []) as TodoStat[];
  const upcoming: AgendaStat[] = (agendaRes.data ?? []) as AgendaStat[];
  const budget: BudgetStat[] = (budgetRes.data ?? []) as BudgetStat[];
  const guests: GuestStat[] = (guestsRes.data ?? []) as GuestStat[];
  const honeymoon: HoneymoonStat[] = (honeymoonRes.data ?? []) as HoneymoonStat[];

  // ----- Stats ---------------------------------------------------------------

  const openTasks = todos.filter((t) => !t.done).length;

  const totalEst = budget.reduce((sum, b) => sum + Number(b.estimated ?? 0), 0);
  const totalPaid = budget.reduce((sum, b) => sum + Number(b.paid ?? 0), 0);
  const remaining = totalEst - totalPaid;

  const yes = guests.filter((g) => g.rsvp === "yes").length;
  const pending = guests.filter((g) => !g.rsvp || g.rsvp === "pending").length;
  const totalGuests = guests.length;
  const plusOnes = guests.filter((g) => g.plus_one).length;

  const honeymoonFavs = honeymoon.filter((h) => h.favorite).length;

  // ----- Top open tasks ------------------------------------------------------

  const topTasks = todos
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
    )
    .slice(0, 5);

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Panel header — matches prototype's .panel-header */}
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>overview</em>
          </h2>
          <p className="text-sm text-ink-soft">
            Everything that matters, all in one place.
          </p>
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid gap-5 mb-10 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div className="stat-card">
          <div className="label">Open tasks</div>
          <div className="value">
            <em>{openTasks}</em>
          </div>
          <div className="meta">{todos.length} total in the list</div>
        </div>

        <div className="stat-card">
          <div className="label">Budget remaining</div>
          <div className="value">
            <em>{formatMoney(remaining)}</em>
          </div>
          <div className="meta">
            {formatMoney(totalPaid)} paid of {formatMoney(totalEst)}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Guests confirmed</div>
          <div className="value">
            {yes} / <em>{totalGuests + plusOnes}</em>
          </div>
          <div className="meta">{pending} awaiting reply</div>
        </div>

        <div className="stat-card">
          <div className="label">Honeymoon picks</div>
          <div className="value">
            <em>{honeymoon.length}</em>
          </div>
          <div className="meta">
            {honeymoonFavs} favourited
          </div>
        </div>
      </div>

      {/* Next up + Open tasks side-by-side */}
      <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
        <div className="bg-paper border border-line p-7 rounded-[4px]">
          <h3 className="font-serif text-[26px] font-medium mb-4">
            Next <em>up</em>
          </h3>
          {upcoming.length === 0 ? (
            <p className="italic text-sm text-ink-soft py-3">
              No upcoming events. Add one in the Agenda tab.
            </p>
          ) : (
            <ul className="list-none">
              {upcoming.map((e) => (
                <li
                  key={e.id}
                  className="flex justify-between gap-3 py-2.5 border-b border-dashed border-line last:border-b-0 text-sm"
                >
                  <span className="text-ink">{e.title}</span>
                  <span className="text-ink-soft text-xs whitespace-nowrap">
                    {formatDate(e.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-paper border border-line p-7 rounded-[4px]">
          <h3 className="font-serif text-[26px] font-medium mb-4">
            Open <em>tasks</em>
          </h3>
          {topTasks.length === 0 ? (
            <p className="italic text-sm text-ink-soft py-3">
              All clear! Nothing on the list.
            </p>
          ) : (
            <ul className="list-none">
              {topTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex justify-between gap-3 py-2.5 border-b border-dashed border-line last:border-b-0 text-sm"
                >
                  <span className="text-ink">{t.text}</span>
                  <span
                    className={`text-xs uppercase tracking-[0.1em] whitespace-nowrap priority-${t.priority}`}
                  >
                    {t.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

