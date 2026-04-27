"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BudgetRow, BudgetStatus, WeddingSavingsRow } from "@/types/db";
import { formatMoney, formatDate } from "@/lib/utils";
import { WEDDING_DATE } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBudgetItem, deleteBudgetItem, updateBudgetItem } from "./actions";
import { createSavingEntry, deleteSavingEntry, updateSavingEntry } from "./savings-actions";

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES = [
  "Venue", "Catering", "Photography", "Music", "Attire", "Flowers",
  "Stationery", "Rings", "Transport", "Beauty", "Decoration", "Other",
];

const STATUS_OPTIONS: { value: BudgetStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "deposit", label: "Deposit paid" },
  { value: "paid", label: "Fully paid" },
];

const SAVINGS_SOURCES = [
  "Celal salary", "Selver salary", "Joint savings", "Family gift", "Bonus", "Other",
];

// Romantic palette for charts. Same color order as the CSS palette tokens.
const CATEGORY_COLORS = [
  "#7a1f2b", // burgundy
  "#c79b3a", // gold
  "#c97b8b", // rose
  "#7c8a6b", // sage
  "#3d2c2e", // ink
  "#a85a48", // warm rust
  "#5a6b7a", // dusty blue
  "#b89968", // tan
  "#8a4a5e", // mauve
  "#6b8a85", // teal-sage
  "#a87a3a", // amber
  "#8a8a8a", // neutral
];

type Tab = "overview" | "savings" | "expenses";

// ============================================================================
// Helpers
// ============================================================================

function monthKey(iso: string): string {
  // "2026-04-15" -> "2026-04"
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  // "2026-04" -> "Apr 2026"
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

// ============================================================================
// Main component
// ============================================================================

interface Props {
  initialBudget: BudgetRow[];
  initialSavings: WeddingSavingsRow[];
}

export function BudgetClient({ initialBudget, initialSavings }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [budget, setBudget] = useState<BudgetRow[]>(initialBudget);
  const [savings, setSavings] = useState<WeddingSavingsRow[]>(initialSavings);

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [savingsDialogOpen, setSavingsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);
  const [editingSaving, setEditingSaving] = useState<WeddingSavingsRow | null>(null);

  const [, startTransition] = useTransition();

  // ---- Realtime: budget ----------------------------------------------------
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("budget:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "budget" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as BudgetRow;
          setBudget((prev) => prev.some((i) => i.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as BudgetRow;
          setBudget((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as BudgetRow;
          setBudget((prev) => prev.filter((i) => i.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ---- Realtime: savings ---------------------------------------------------
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("wedding_savings:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "wedding_savings" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as WeddingSavingsRow;
          setSavings((prev) => prev.some((i) => i.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as WeddingSavingsRow;
          setSavings((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as WeddingSavingsRow;
          setSavings((prev) => prev.filter((i) => i.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ---- Aggregations --------------------------------------------------------
  const totals = useMemo(() => {
    const estimated = budget.reduce((a, b) => a + (b.estimated ?? 0), 0);
    const paid = budget.reduce((a, b) => a + (b.paid ?? 0), 0);
    const saved = savings.reduce((a, s) => a + (s.amount ?? 0), 0);

    const today = new Date().toISOString().slice(0, 10);
    const monthsToWedding = Math.max(0, monthsBetween(today, WEDDING_DATE));

    // Months that have any savings activity (for "avg per month")
    const activeMonths = new Set(savings.map((s) => monthKey(s.saved_on))).size || 1;
    const avgMonthly = saved / activeMonths;

    const thisMonth = monthKey(today);
    const thisMonthSaved = savings
      .filter((s) => monthKey(s.saved_on) === thisMonth)
      .reduce((a, s) => a + s.amount, 0);

    // What still needs to be saved to cover estimated cost.
    const goalGap = Math.max(0, estimated - saved);
    const targetPerMonth = monthsToWedding > 0 ? goalGap / monthsToWedding : goalGap;

    // Coverage: how much of expected cost is already saved.
    const coveragePct = estimated > 0 ? Math.min(100, (saved / estimated) * 100) : 0;
    const paidPct = estimated > 0 ? Math.min(100, (paid / estimated) * 100) : 0;
    const cashOnHand = saved - paid; // what's saved but not yet spent

    return {
      estimated, paid, saved,
      coveragePct, paidPct, cashOnHand,
      monthsToWedding, avgMonthly, thisMonthSaved,
      goalGap, targetPerMonth,
    };
  }, [budget, savings]);

  // Spend by category
  const byCategory = useMemo(() => {
    const map = new Map<string, { estimated: number; paid: number }>();
    for (const b of budget) {
      const cat = b.category ?? "Other";
      const cur = map.get(cat) ?? { estimated: 0, paid: 0 };
      cur.estimated += b.estimated ?? 0;
      cur.paid += b.paid ?? 0;
      map.set(cat, cur);
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.estimated - a.estimated);
  }, [budget]);

  // Monthly savings (last 12 months ending at current month)
  const monthlySavings = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of savings) {
      const k = monthKey(s.saved_on);
      map.set(k, (map.get(k) ?? 0) + s.amount);
    }
    // Build a continuous series of last 12 months
    const series: { key: string; label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      series.push({ key, label: monthLabel(key), amount: map.get(key) ?? 0 });
    }
    return series;
  }, [savings]);

  // ---- Actions -------------------------------------------------------------
  const handleDeleteBudget = (item: BudgetRow) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setBudget((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteBudgetItem(item.id); });
  };

  const handleDeleteSaving = (item: WeddingSavingsRow) => {
    if (!confirm(`Delete this entry of ${formatMoney(item.amount)}?`)) return;
    setSavings((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteSavingEntry(item.id); });
  };

  // ---- Render --------------------------------------------------------------
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>budget</em>
          </h2>
          <p className="text-sm text-ink-soft">
            Plan, save, and pay — track every euro on the way to the altar.
          </p>
        </div>
        <div className="flex gap-2 max-md:flex-wrap">
          <Button variant="ghost" onClick={() => { setEditingSaving(null); setSavingsDialogOpen(true); }}>
            + Log savings
          </Button>
          <Button onClick={() => { setEditingBudget(null); setBudgetDialogOpen(true); }}>
            + New expense
          </Button>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div className="mb-8 flex gap-1 p-1 bg-cream-deep rounded-[6px] w-fit max-md:w-full">
        {([
          { key: "overview", label: "Overview", icon: "📊" },
          { key: "savings", label: "Savings", icon: "🪴" },
          { key: "expenses", label: "Expenses", icon: "💳" },
        ] as { key: Tab; label: string; icon: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              flex-1 px-5 py-2.5 rounded-[4px] text-[13px] transition-all flex items-center justify-center gap-2
              ${tab === t.key
                ? "bg-paper text-ink shadow-soft font-medium"
                : "text-ink-soft hover:text-ink"
              }
            `}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Views */}
      {tab === "overview" && (
        <OverviewView
          totals={totals}
          byCategory={byCategory}
          monthlySavings={monthlySavings}
          recentSavings={savings.slice(0, 5)}
          recentBudget={[...budget].sort((a, b) => (b.created_at > a.created_at ? 1 : -1)).slice(0, 5)}
        />
      )}

      {tab === "savings" && (
        <SavingsView
          savings={savings}
          totals={totals}
          onAdd={() => { setEditingSaving(null); setSavingsDialogOpen(true); }}
          onEdit={(s) => { setEditingSaving(s); setSavingsDialogOpen(true); }}
          onDelete={handleDeleteSaving}
        />
      )}

      {tab === "expenses" && (
        <ExpensesView
          budget={budget}
          totals={totals}
          onAdd={() => { setEditingBudget(null); setBudgetDialogOpen(true); }}
          onEdit={(b) => { setEditingBudget(b); setBudgetDialogOpen(true); }}
          onDelete={handleDeleteBudget}
        />
      )}

      {/* Dialogs (keyed to force fresh state on each open) */}
      {budgetDialogOpen && (
        <BudgetDialog
          key={editingBudget?.id ?? "new-budget"}
          open={budgetDialogOpen}
          onOpenChange={(o) => { setBudgetDialogOpen(o); if (!o) setEditingBudget(null); }}
          editing={editingBudget}
          onSaved={(row) => {
            setBudget((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              return exists ? prev.map((i) => (i.id === row.id ? row : i)) : [row, ...prev];
            });
          }}
        />
      )}

      {savingsDialogOpen && (
        <SavingsDialog
          key={editingSaving?.id ?? "new-saving"}
          open={savingsDialogOpen}
          onOpenChange={(o) => { setSavingsDialogOpen(o); if (!o) setEditingSaving(null); }}
          editing={editingSaving}
          onSaved={(row) => {
            setSavings((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              return exists ? prev.map((i) => (i.id === row.id ? row : i)) : [row, ...prev];
            });
          }}
        />
      )}
    </section>
  );
}

// ============================================================================
// Overview view — the "where do we stand" dashboard
// ============================================================================

function OverviewView({
  totals,
  byCategory,
  monthlySavings,
  recentSavings,
  recentBudget,
}: {
  totals: ReturnType<typeof computeTotalsType>;
  byCategory: { category: string; estimated: number; paid: number }[];
  monthlySavings: { key: string; label: string; amount: number }[];
  recentSavings: WeddingSavingsRow[];
  recentBudget: BudgetRow[];
}) {
  const onTrack = totals.targetPerMonth <= totals.avgMonthly && totals.estimated > 0;
  const noData = totals.estimated === 0 && totals.saved === 0;

  return (
    <div className="space-y-8">
      {/* Hero KPIs */}
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
        <KPI
          label="Saved so far"
          value={formatMoney(totals.saved)}
          accent="sage"
          meta={totals.estimated > 0 ? `${totals.coveragePct.toFixed(0)}% of estimated cost` : "your wedding fund"}
        />
        <KPI
          label="Estimated cost"
          value={formatMoney(totals.estimated)}
          accent="burgundy"
          meta={`${totals.paidPct.toFixed(0)}% already paid`}
        />
        <KPI
          label="Cash on hand"
          value={formatMoney(totals.cashOnHand)}
          accent={totals.cashOnHand >= 0 ? "gold" : "burgundy"}
          meta={totals.cashOnHand >= 0 ? "saved minus paid" : "paid more than saved"}
        />
        <KPI
          label="Months to wedding"
          value={String(totals.monthsToWedding)}
          accent="ink"
          meta={totals.targetPerMonth > 0
            ? `Save ${formatMoney(totals.targetPerMonth)}/mo to reach the goal`
            : "You've reached the goal!"}
        />
      </div>

      {noData && (
        <div className="bg-paper border border-dashed border-line rounded-[4px] p-10 text-center">
          <div className="text-[36px] mb-3">🌱</div>
          <p className="font-serif italic text-[22px] text-ink-soft mb-2">
            Your budget journey starts here.
          </p>
          <p className="text-[13px] text-ink-soft">
            Use <strong className="text-ink">Log savings</strong> to track money set aside,
            and <strong className="text-ink">New expense</strong> to track wedding costs.
          </p>
        </div>
      )}

      {!noData && (
        <>
          {/* Goal tracker — combines saved/paid/estimated in one bar */}
          <div className="bg-paper border border-line rounded-[4px] p-6 shadow-soft">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-ink-soft mb-1 font-medium">
                  The big picture
                </div>
                <h3 className="font-serif text-[22px] text-ink">
                  {onTrack
                    ? <>You&rsquo;re <em>on track</em> ♥</>
                    : totals.estimated === 0
                      ? <>Add expenses to set your <em>goal</em></>
                      : totals.saved >= totals.estimated
                        ? <>The wedding is <em>fully funded</em> 🎉</>
                        : <>A bit more to <em>save</em></>
                  }
                </h3>
              </div>
              <div className="text-[12px] text-ink-soft">
                Avg <strong className="text-ink">{formatMoney(totals.avgMonthly)}</strong> /month
                {" · "}
                Target <strong className="text-ink">{formatMoney(totals.targetPerMonth)}</strong> /month
              </div>
            </div>

            <ProgressLayered
              estimated={totals.estimated}
              saved={totals.saved}
              paid={totals.paid}
            />

            <div className="grid grid-cols-3 gap-4 mt-5 max-md:grid-cols-1 text-[12px]">
              <Legend swatch="#7c8a6b" label="Saved" value={formatMoney(totals.saved)} />
              <Legend swatch="#7a1f2b" label="Paid" value={formatMoney(totals.paid)} />
              <Legend swatch="#e6dccd" label="Goal (estimated)" value={formatMoney(totals.estimated)} />
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            {/* Donut: spend by category */}
            <div className="bg-paper border border-line rounded-[4px] p-6 shadow-soft">
              <div className="text-[11px] uppercase tracking-[0.3em] text-ink-soft mb-4 font-medium">
                Where the money goes
              </div>
              {byCategory.length === 0 ? (
                <p className="text-[13px] text-ink-soft italic">Add expenses to see the breakdown.</p>
              ) : (
                <div className="flex items-center gap-6 max-sm:flex-col">
                  <DonutChart data={byCategory.map((c, i) => ({
                    label: c.category,
                    value: c.estimated,
                    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                  }))} />
                  <div className="flex-1 space-y-1.5 min-w-0 w-full">
                    {byCategory.slice(0, 6).map((c, i) => {
                      const pct = totals.estimated > 0 ? (c.estimated / totals.estimated) * 100 : 0;
                      return (
                        <div key={c.category} className="flex items-center gap-3 text-[12px]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                          />
                          <span className="flex-1 truncate text-ink">{c.category}</span>
                          <span className="text-ink-soft">{pct.toFixed(0)}%</span>
                          <span className="font-mono text-ink w-20 text-right">{formatMoney(c.estimated)}</span>
                        </div>
                      );
                    })}
                    {byCategory.length > 6 && (
                      <div className="text-[11px] text-ink-soft italic pt-1">
                        +{byCategory.length - 6} more categories
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bar: monthly savings */}
            <div className="bg-paper border border-line rounded-[4px] p-6 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">
                  Monthly savings · last 12 months
                </div>
                <div className="text-[11px] text-ink-soft">
                  This month: <strong className="text-ink">{formatMoney(totals.thisMonthSaved)}</strong>
                </div>
              </div>
              <BarChart
                data={monthlySavings}
                target={totals.targetPerMonth}
              />
            </div>
          </div>

          {/* Recent activity feed */}
          <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            <ActivityCard
              title="Recent savings"
              emoji="🪴"
              empty="No savings logged yet."
              items={recentSavings.map((s) => ({
                key: s.id,
                title: s.source ?? "Saved",
                meta: formatDate(s.saved_on),
                value: `+${formatMoney(s.amount)}`,
                positive: true,
              }))}
            />
            <ActivityCard
              title="Recent expenses"
              emoji="💳"
              empty="No expenses tracked yet."
              items={recentBudget.map((b) => ({
                key: b.id,
                title: b.name,
                meta: b.category ?? "—",
                value: formatMoney(b.estimated),
                positive: false,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

// only used for type inference of the `totals` object above
declare function computeTotalsType(): {
  estimated: number; paid: number; saved: number;
  coveragePct: number; paidPct: number; cashOnHand: number;
  monthsToWedding: number; avgMonthly: number; thisMonthSaved: number;
  goalGap: number; targetPerMonth: number;
};

// ============================================================================
// Savings view — the "revenue" side
// ============================================================================

function SavingsView({
  savings,
  totals,
  onAdd,
  onEdit,
  onDelete,
}: {
  savings: WeddingSavingsRow[];
  totals: ReturnType<typeof computeTotalsType>;
  onAdd: () => void;
  onEdit: (s: WeddingSavingsRow) => void;
  onDelete: (s: WeddingSavingsRow) => void;
}) {
  const grouped = useMemo(() => {
    const sorted = [...savings].sort((a, b) => b.saved_on.localeCompare(a.saved_on));
    const map = new Map<string, WeddingSavingsRow[]>();
    for (const s of sorted) {
      const k = monthKey(s.saved_on);
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: monthLabel(key),
      items,
      total: items.reduce((a, s) => a + s.amount, 0),
    }));
  }, [savings]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
        <KPI label="Total saved" value={formatMoney(totals.saved)} accent="sage" meta={`${savings.length} entries`} />
        <KPI label="This month" value={formatMoney(totals.thisMonthSaved)} accent="gold" meta="logged so far" />
        <KPI label="Avg / month" value={formatMoney(totals.avgMonthly)} accent="ink" meta="across active months" />
        <KPI
          label="Need / month"
          value={formatMoney(totals.targetPerMonth)}
          accent="burgundy"
          meta={`to reach goal in ${totals.monthsToWedding}mo`}
        />
      </div>

      {savings.length === 0 ? (
        <div className="bg-paper border border-dashed border-line rounded-[4px] p-12 text-center">
          <div className="text-[36px] mb-3">🪴</div>
          <p className="font-serif italic text-[22px] text-ink-soft mb-3">
            No savings logged yet.
          </p>
          <p className="text-[13px] text-ink-soft mb-6 max-w-md mx-auto">
            Track money you put aside each month — salary contributions, gifts, anything earmarked for the wedding.
          </p>
          <Button onClick={onAdd}>+ Log your first savings</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.key} className="bg-paper border border-line rounded-[4px] shadow-soft overflow-hidden">
              <div className="flex items-baseline justify-between px-6 py-4 border-b border-line bg-cream/40">
                <div>
                  <div className="font-serif text-[20px] text-ink">{group.label}</div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-ink-soft mt-0.5">
                    {group.items.length} entr{group.items.length === 1 ? "y" : "ies"}
                  </div>
                </div>
                <div className="font-mono text-[20px] text-sage font-medium">
                  +{formatMoney(group.total)}
                </div>
              </div>
              <div className="divide-y divide-line">
                {group.items.map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-cream/30 transition-colors cursor-pointer"
                    onClick={() => onEdit(s)}
                  >
                    <div className="text-[20px]">💶</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate">
                        {s.source ?? "Savings"}
                      </div>
                      <div className="text-[12px] text-ink-soft truncate">
                        {formatDate(s.saved_on)}
                        {s.notes && <span className="ml-2 italic">· {s.notes}</span>}
                      </div>
                    </div>
                    <div className="font-mono text-sage font-medium">+{formatMoney(s.amount)}</div>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-soft hover:text-burgundy text-[18px]"
                      onClick={(e) => { e.stopPropagation(); onDelete(s); }}
                      aria-label="Delete saving"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Expenses view — the original budget table
// ============================================================================

function ExpensesView({
  budget,
  totals,
  onAdd,
  onEdit,
  onDelete,
}: {
  budget: BudgetRow[];
  totals: ReturnType<typeof computeTotalsType>;
  onAdd: () => void;
  onEdit: (b: BudgetRow) => void;
  onDelete: (b: BudgetRow) => void;
}) {
  const sorted = [...budget].sort((a, b) => (b.estimated ?? 0) - (a.estimated ?? 0));
  const remaining = totals.estimated - totals.paid;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
        <KPI label="Total estimated" value={formatMoney(totals.estimated)} accent="burgundy" meta={`${budget.length} line items`} />
        <KPI label="Total paid" value={formatMoney(totals.paid)} accent="gold" meta={`${totals.paidPct.toFixed(0)}% of budget`} />
        <KPI label="Remaining" value={formatMoney(remaining)} accent="ink" meta="still to pay" />
        <KPI
          label="Pending"
          value={String(budget.filter((b) => b.status === "pending").length)}
          accent="rose"
          meta={`${budget.filter((b) => b.status === "paid").length} fully paid`}
        />
      </div>

      <div className="bg-paper border border-line rounded-[4px] shadow-soft p-7">
        {budget.length === 0 ? (
          <div className="text-center py-12 px-5 text-ink-soft">
            <div className="text-[36px] mb-3">💳</div>
            <p className="font-serif italic text-[22px]">No expenses tracked yet.</p>
            <p className="text-[13px] mt-2 mb-6">Add the venue, dress, catering — anything that costs.</p>
            <Button onClick={onAdd}>+ Add first expense</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="budget-table w-full">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="num">Estimated</th>
                  <th className="num">Paid</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <button
                        type="button"
                        className="font-medium text-left hover:text-burgundy transition-colors"
                        onClick={() => onEdit(b)}
                      >
                        {b.name}
                      </button>
                      {b.vendor && (
                        <div className="text-xs text-ink-soft mt-0.5">{b.vendor}</div>
                      )}
                    </td>
                    <td>{b.category ?? "—"}</td>
                    <td>
                      <span className={`status-pill status-${b.status}`}>{b.status}</span>
                    </td>
                    <td className="num">{formatMoney(b.estimated)}</td>
                    <td className="num">{formatMoney(b.paid)}</td>
                    <td>
                      <Button variant="danger" size="sm" onClick={() => onDelete(b)}>×</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Reusable visual atoms
// ============================================================================

function KPI({
  label,
  value,
  meta,
  accent = "ink",
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: "burgundy" | "gold" | "sage" | "rose" | "ink";
}) {
  const accentColor: Record<string, string> = {
    burgundy: "border-l-burgundy",
    gold: "border-l-gold",
    sage: "border-l-sage",
    rose: "border-l-rose",
    ink: "border-l-ink",
  };
  return (
    <div className={`bg-paper border border-line border-l-[3px] ${accentColor[accent]} rounded-[4px] p-5 shadow-soft`}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-soft mb-2 font-medium">{label}</div>
      <div className="font-serif text-[26px] text-ink leading-tight"><em>{value}</em></div>
      {meta && <div className="text-[12px] text-ink-soft mt-2 truncate">{meta}</div>}
    </div>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: swatch }} />
      <span className="text-ink-soft uppercase tracking-[0.15em] text-[10px] font-medium">{label}</span>
      <span className="ml-auto font-mono text-ink">{value}</span>
    </div>
  );
}

/** Layered progress bar showing paid (front) inside saved (middle) inside estimated (back). */
function ProgressLayered({
  estimated,
  saved,
  paid,
}: {
  estimated: number;
  saved: number;
  paid: number;
}) {
  const max = Math.max(estimated, saved, paid, 1);
  const savedPct = (saved / max) * 100;
  const paidPct = (paid / max) * 100;
  const estimatedPct = (estimated / max) * 100;

  return (
    <div className="relative h-7 bg-cream-deep rounded-full overflow-hidden">
      {/* Saved (sage) */}
      <div
        className="absolute inset-y-0 left-0 bg-sage/70 transition-all duration-700"
        style={{ width: `${savedPct}%` }}
      />
      {/* Paid (burgundy) — drawn on top, indicates spent fraction */}
      <div
        className="absolute inset-y-0 left-0 bg-burgundy transition-all duration-700"
        style={{ width: `${paidPct}%` }}
      />
      {/* Estimated marker (vertical line) */}
      {estimated > 0 && estimatedPct < 100 && (
        <div
          className="absolute inset-y-0 w-0.5 bg-ink/60"
          style={{ left: `${estimatedPct}%` }}
          title={`Goal: ${formatMoney(estimated)}`}
        />
      )}
    </div>
  );
}

/** Pure-SVG donut chart. */
function DonutChart({
  data,
  size = 160,
  thickness = 28,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#f0e9dc"
          strokeWidth={thickness}
        />
        {data.map((d, i) => {
          const fraction = d.value / total;
          const dash = fraction * circumference;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${d.label}: ${formatMoney(d.value)}`}</title>
            </circle>
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-serif text-[20px] text-ink leading-none"><em>{formatMoney(total)}</em></div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-ink-soft mt-1">Total</div>
      </div>
    </div>
  );
}

/** Pure-SVG bar chart with a target dashed line. */
function BarChart({
  data,
  target,
}: {
  data: { key: string; label: string; amount: number }[];
  target: number;
}) {
  const max = Math.max(...data.map((d) => d.amount), target, 1);
  const height = 160;
  const barWidth = 22;
  const gap = 10;
  const width = data.length * (barWidth + gap);

  const yFor = (v: number) => height - (v / max) * (height - 20);
  const targetY = yFor(target);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 28} viewBox={`0 0 ${width} ${height + 28}`}>
        {/* Target line */}
        {target > 0 && (
          <>
            <line
              x1={0} x2={width}
              y1={targetY} y2={targetY}
              stroke="#7a1f2b"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
            <text
              x={width - 4} y={targetY - 4}
              textAnchor="end"
              fontSize={9}
              fill="#7a1f2b"
              fontFamily="monospace"
            >
              target {formatMoney(target)}
            </text>
          </>
        )}

        {data.map((d, i) => {
          const x = i * (barWidth + gap);
          const barHeight = Math.max(2, (d.amount / max) * (height - 20));
          const y = height - barHeight;
          const isCurrent = i === data.length - 1;
          return (
            <g key={d.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={isCurrent ? "#7c8a6b" : "#c79b3a"}
                opacity={d.amount === 0 ? 0.25 : 0.9}
                rx={2}
              >
                <title>{`${d.label}: ${formatMoney(d.amount)}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={height + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#7a6f60"
                fontFamily="ui-sans-serif"
              >
                {d.label.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ActivityCard({
  title,
  emoji,
  empty,
  items,
}: {
  title: string;
  emoji: string;
  empty: string;
  items: { key: string; title: string; meta: string; value: string; positive: boolean }[];
}) {
  return (
    <div className="bg-paper border border-line rounded-[4px] p-6 shadow-soft">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[18px]">{emoji}</span>
        <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] italic text-ink-soft">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-ink truncate">{it.title}</div>
                <div className="text-[11px] text-ink-soft truncate">{it.meta}</div>
              </div>
              <div className={`font-mono text-[13px] ${it.positive ? "text-sage" : "text-ink"}`}>
                {it.value}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Dialogs
// ============================================================================

function SelectField({
  name, defaultValue, options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => { setValue(defaultValue); }, [defaultValue]);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function BudgetDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: BudgetRow | null;
  onSaved: (row: BudgetRow) => void;
}) {
  const action = editing ? updateBudgetItem.bind(null, editing.id) : createBudgetItem;
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: BudgetRow } | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok && state?.data) {
      onSaved(state.data);
      onOpenChange(false);
    }
  }, [state, onOpenChange, onSaved]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>expense</em></> : <>New <em>expense</em></>}</DialogTitle>
          <DialogDescription>Track what&rsquo;s spent and what&rsquo;s left.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Item name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Photographer" required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <SelectField
                name="category"
                defaultValue={editing?.category ?? "Venue"}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <SelectField
                name="status"
                defaultValue={editing?.status ?? "pending"}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor">Vendor (optional)</Label>
            <Input id="vendor" name="vendor" defaultValue={editing?.vendor ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="estimated">Estimated (€)</Label>
              <Input id="estimated" name="estimated" type="number" min="0" step="1" defaultValue={editing?.estimated ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="paid">Already paid (€)</Label>
              <Input id="paid" name="paid" type="number" min="0" step="1" defaultValue={editing?.paid ?? "0"} />
            </div>
          </div>

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SavingsDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: WeddingSavingsRow | null;
  onSaved: (row: WeddingSavingsRow) => void;
}) {
  const action = editing ? updateSavingEntry.bind(null, editing.id) : createSavingEntry;
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: WeddingSavingsRow } | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok && state?.data) {
      onSaved(state.data);
      onOpenChange(false);
    }
  }, [state, onOpenChange, onSaved]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultDate = editing?.saved_on ?? todayIso;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>savings</em></> : <>Log <em>savings</em></>}</DialogTitle>
          <DialogDescription>Money set aside for the wedding.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Amount (€)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="1"
                defaultValue={editing?.amount ?? ""}
                placeholder="500"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="saved_on">Date</Label>
              <Input id="saved_on" name="saved_on" type="date" defaultValue={defaultDate} required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Source (optional)</Label>
            <SelectField
              name="source"
              defaultValue={editing?.source ?? "Joint savings"}
              options={SAVINGS_SOURCES.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} rows={2} placeholder="What this is for, who contributed..." />
          </div>

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
