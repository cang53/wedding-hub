"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type {
  LifeIncomeRow,
  LifeExpenseRow,
  LifePurchaseRow,
  LifeSettingsRow,
  LifePerson,
  StartingCashMode,
  ExpenseType,
  WeddingSavingsRow,
} from "@/types/db";
import { formatMoney, formatDate } from "@/lib/utils";
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
import {
  createIncome, updateIncome, deleteIncome,
  createExpense, updateExpense, deleteExpense,
  createPurchase, updatePurchase, deletePurchase, togglePurchaseScheduled,
  updateSettings,
} from "./actions";
import { createSavingEntry, updateSavingEntry, deleteSavingEntry } from "../budget/savings-actions";

// ============================================================================
// Constants
// ============================================================================

const EXPENSE_CATEGORIES = [
  "Rent", "Mortgage", "Credit", "Utilities", "Internet", "Phone",
  "Insurance", "Food", "Transport", "Subscriptions", "Wedding", "Other",
];

const PURCHASE_CATEGORIES = [
  "Furniture", "Appliances", "Electronics", "Deposit", "Renovation",
  "Decor", "Vehicle", "Other",
];

const SAVINGS_SOURCES = [
  "Celal salary", "Selver salary", "Joint savings", "Family gift", "Bonus", "Other",
];

const PERSON_OPTIONS: { value: LifePerson; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "groom", label: "Groom" },
  { value: "bride", label: "Bride" },
];

// ============================================================================
// Helpers — month math
// ============================================================================

/** "2026-09" -> Date(2026, 8, 1). */
function monthToDate(m: string): Date {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1);
}

/** Date -> "2026-09". */
function dateToMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" -> "Sep 2026". */
function monthLabel(m: string): string {
  const d = monthToDate(m);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Short label for chart axes. "2026-09" -> "Sep '26". */
function monthShort(m: string): string {
  const d = monthToDate(m);
  return d.toLocaleDateString("en-GB", { month: "short" }) + " '" + String(d.getFullYear()).slice(-2);
}

function monthsList(start: string, count: number): string[] {
  const out: string[] = [];
  const d = monthToDate(start);
  for (let i = 0; i < count; i++) {
    out.push(dateToMonth(d));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** True if a recurring stream with optional [start, end] window is active in `current` month. */
function isActiveInMonth(start: string | null, end: string | null, current: string): boolean {
  if (start && current < start) return false;
  if (end && current > end) return false;
  return true;
}

function personShare(payer: LifePerson, groomPct: number | null, side: "groom" | "bride"): number {
  if (payer === side) return 1;
  if (payer === "both") {
    const g = (groomPct ?? 50) / 100;
    return side === "groom" ? g : 1 - g;
  }
  return 0;
}

/** Pre-built list of YYYY-MM strings starting from the current month, spanning 10 years forward. */
const MONTH_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < 120; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const value = dateToMonth(d);
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
})();

// Radix's Select does not allow SelectItem value="" — use a sentinel for "none".
const NO_MONTH = "__none__";

function MonthSelect({ name, defaultValue, placeholder = "Select month…", required = false }: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  // Internal value uses NO_MONTH as the sentinel for "no selection";
  // the hidden input that the form submits stores "" instead.
  const [value, setValue] = useState<string>(defaultValue ? defaultValue : NO_MONTH);
  useEffect(() => { setValue(defaultValue ? defaultValue : NO_MONTH); }, [defaultValue]);

  const submittedValue = value === NO_MONTH ? "" : value;

  return (
    <>
      <input type="hidden" name={name} value={submittedValue} />
      <Select value={value} onValueChange={setValue} required={required}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {!required && (
            <SelectItem value={NO_MONTH}>— none —</SelectItem>
          )}
          {MONTH_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Client-side amortisation (mirrors server logic). */
function calcMonthlyPayment(principal: number, months: number, annualRate: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

// ============================================================================
// Main client
// ============================================================================

interface Props {
  initialIncome: LifeIncomeRow[];
  initialExpenses: LifeExpenseRow[];
  initialPurchases: LifePurchaseRow[];
  initialSettings: LifeSettingsRow;
  initialSavings: WeddingSavingsRow[];
  totalPaidOnWedding: number;
}

export function LifeBudgetClient({
  initialIncome,
  initialExpenses,
  initialPurchases,
  initialSettings,
  initialSavings,
  totalPaidOnWedding,
}: Props) {
  const [income, setIncome] = useState<LifeIncomeRow[]>(initialIncome);
  const [expenses, setExpenses] = useState<LifeExpenseRow[]>(initialExpenses);
  const [purchases, setPurchases] = useState<LifePurchaseRow[]>(initialPurchases);
  const [settings, setSettings] = useState<LifeSettingsRow>(initialSettings);
  const [savings, setSavings] = useState<WeddingSavingsRow[]>(initialSavings);

  const [incomeDialog, setIncomeDialog] = useState<{ open: boolean; editing: LifeIncomeRow | null }>({ open: false, editing: null });
  const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; editing: LifeExpenseRow | null }>({ open: false, editing: null });
  const [purchaseDialog, setPurchaseDialog] = useState<{ open: boolean; editing: LifePurchaseRow | null }>({ open: false, editing: null });
  const [savingsDialog, setSavingsDialog] = useState<{ open: boolean; editing: WeddingSavingsRow | null }>({ open: false, editing: null });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [expandedSavingsOpen, setExpandedSavingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<"joint" | "groom" | "bride">("joint");
  const [expandedSection, setExpandedSection] = useState<"income" | "expense" | "purchase" | null>(null);

  const [, startTransition] = useTransition();

  // Starting cash: total saved minus what's already been paid on the wedding.
  const weddingCashOnHand = useMemo(
    () => Math.max(0, savings.reduce((a, s) => a + Number(s.amount), 0) - totalPaidOnWedding),
    [savings, totalPaidOnWedding]
  );

  // Starting cash resolves from settings + (optionally) the reactive wedding cash on hand.
  const startingCash = settings.starting_cash_mode === "from_wedding"
    ? weddingCashOnHand
    : Number(settings.starting_cash_manual ?? 0);

  // ---- Projection ---------------------------------------------------------
  const projection = useMemo(() => {
    const months = monthsList(settings.start_month, settings.horizon_months);
    let cumulative = startingCash;

    const series = months.map((month) => {
      const monthIncome = income
        .filter((i) => isActiveInMonth(i.start_month, i.end_month, month))
        .reduce((a, i) => a + Number(i.amount), 0);

      const monthFixed = expenses
        .filter((e) => isActiveInMonth(e.start_month, e.end_month, month))
        .reduce((a, e) => a + Number(e.amount), 0);

      const monthPurchases = purchases
        .filter((p) => p.scheduled && p.target_month === month)
        .reduce((a, p) => a + Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)), 0);

      const totalOut = monthFixed + monthPurchases;
      const net = monthIncome - totalOut;
      cumulative += net;

      return { month, income: monthIncome, fixed: monthFixed, purchases: monthPurchases, net, cumulative };
    });

    return series;
  }, [income, expenses, purchases, settings, startingCash]);

  // ---- KPIs ---------------------------------------------------------------
  const kpis = useMemo(() => {
    const firstMonth = settings.start_month;
    const monthlyIncome = income
      .filter((i) => isActiveInMonth(i.start_month, i.end_month, firstMonth))
      .reduce((a, i) => a + Number(i.amount), 0);
    const monthlyFixed = expenses
      .filter((e) => isActiveInMonth(e.start_month, e.end_month, firstMonth))
      .reduce((a, e) => a + Number(e.amount), 0);
    const monthlyNet = monthlyIncome - monthlyFixed;

    // Runway: starting cash divided by monthly burn (when income < expenses).
    const burn = monthlyFixed - monthlyIncome;
    const runwayMonths = burn > 0 ? Math.floor(startingCash / burn) : Infinity;

    // Find first month cumulative goes negative (burn-out).
    const burnOutIdx = projection.findIndex((p) => p.cumulative < 0);
    const burnOutMonth = burnOutIdx >= 0 ? projection[burnOutIdx].month : null;

    // Break-even: first month after a dip where cumulative climbs back ≥ 0.
    let breakEvenMonth: string | null = null;
    let dipped = false;
    for (const p of projection) {
      if (p.cumulative < 0) dipped = true;
      else if (dipped && p.cumulative >= 0) { breakEvenMonth = p.month; break; }
    }

    const minCumulative = projection.reduce((m, p) => Math.min(m, p.cumulative), startingCash);
    const endCumulative = projection.length > 0 ? projection[projection.length - 1].cumulative : startingCash;

    const savingsRate = monthlyIncome > 0 ? (monthlyNet / monthlyIncome) * 100 : 0;

    return {
      monthlyIncome, monthlyFixed, monthlyNet, savingsRate,
      runwayMonths, burnOutMonth, breakEvenMonth,
      minCumulative, endCumulative,
    };
  }, [income, expenses, projection, settings, startingCash]);

  // ---- Action handlers ----------------------------------------------------
  const handleDeleteIncome = (item: LifeIncomeRow) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setIncome((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteIncome(item.id); });
  };
  const handleDeleteExpense = (item: LifeExpenseRow) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setExpenses((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteExpense(item.id); });
  };
  const handleDeletePurchase = (item: LifePurchaseRow) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setPurchases((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deletePurchase(item.id); });
  };
  const handleToggleScheduled = (item: LifePurchaseRow) => {
    const next = !item.scheduled;
    setPurchases((prev) => prev.map((p) => (p.id === item.id ? { ...p, scheduled: next } : p)));
    startTransition(() => { togglePurchaseScheduled(item.id, next); });
  };
  const handleDeleteSaving = (item: WeddingSavingsRow) => {
    if (!confirm(`Delete this entry of ${formatMoney(item.amount)}?`)) return;
    setSavings((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteSavingEntry(item.id); });
  };

  // ---- Preview slices (3 most recent / soonest) --------------------------
  const recentIncome = useMemo(() =>
    [...income].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3),
    [income]);
  const recentExpenses = useMemo(() =>
    [...expenses].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3),
    [expenses]);
  const recentPurchases = useMemo(() => {
    const today = dateToMonth(new Date());
    return [...purchases].sort((a, b) => {
      const af = a.target_month >= today, bf = b.target_month >= today;
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      if (af) return a.target_month.localeCompare(b.target_month);
      return b.target_month.localeCompare(a.target_month);
    }).slice(0, 3);
  }, [purchases]);

  // ---- Render -------------------------------------------------------------
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            Life <em>after</em>
          </h2>
          <p className="text-sm text-ink-soft">
            Salaries, monthly bills, big purchases — see when the cashflow turns positive.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setSettingsOpen(true)}>⚙ Settings</Button>
      </div>

      {/* Settings strip — quick read-only summary */}
      <div className="mb-6 px-5 py-3 bg-cream-deep/60 border border-line rounded-[4px] flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
        <span className="text-ink-soft">
          Starting <strong className="text-ink font-mono">{monthLabel(settings.start_month)}</strong>
        </span>
        <span className="text-ink-soft">
          Horizon <strong className="text-ink font-mono">{settings.horizon_months}mo</strong>
        </span>
        <span className="text-ink-soft">
          Starting cash <strong className="text-ink font-mono">{formatMoney(startingCash)}</strong>
          <span className="ml-1 text-ink-soft italic">
            ({settings.starting_cash_mode === "from_wedding" ? "from wedding" : "manual"})
          </span>
        </span>
      </div>

      <ViewSwitcher view={view} onChange={setView} />

      {view === "joint" && (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 mb-8">
        <KPI
          label="Monthly income"
          value={formatMoney(kpis.monthlyIncome)}
          accent="sage"
          meta={`${income.length} stream${income.length === 1 ? "" : "s"}`}
        />
        <KPI
          label="Monthly fixed"
          value={formatMoney(kpis.monthlyFixed)}
          accent="burgundy"
          meta={`${expenses.length} bill${expenses.length === 1 ? "" : "s"}`}
        />
        <KPI
          label="Monthly net"
          value={formatMoney(kpis.monthlyNet)}
          accent={kpis.monthlyNet >= 0 ? "sage" : "burgundy"}
          meta={kpis.monthlyIncome > 0 ? `${kpis.savingsRate.toFixed(0)}% savings rate` : "—"}
        />
        <KPI
          label="Break-even"
          value={
            kpis.burnOutMonth === null
              ? "Always +"
              : kpis.breakEvenMonth
                ? monthLabel(kpis.breakEvenMonth)
                : "Beyond horizon"
          }
          accent="gold"
          meta={kpis.burnOutMonth ? `Dips below 0 in ${monthLabel(kpis.burnOutMonth)}` : "Cumulative cash never negative"}
        />
        <KPI
          label="Runway"
          value={kpis.runwayMonths === Infinity ? "∞" : `${kpis.runwayMonths}mo`}
          accent="ink"
          meta={kpis.runwayMonths === Infinity ? "Income covers fixed costs" : "If income stopped"}
        />
      </div>

      {/* Cashflow chart */}
      <div className="bg-paper border border-line rounded-[4px] p-6 shadow-soft mb-8">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-soft mb-1 font-medium">
              Cashflow projection
            </div>
            <h3 className="font-serif text-[22px] text-ink">
              {kpis.endCumulative >= 0
                ? <>You end up with <em>{formatMoney(kpis.endCumulative)}</em></>
                : <>Cumulative dips to <em className="text-burgundy">{formatMoney(kpis.minCumulative)}</em></>
              }
            </h3>
          </div>
          <div className="text-[12px] text-ink-soft">
            Toggle purchases on/off below to see scenarios live.
          </div>
        </div>
        <CashflowChart projection={projection} purchases={purchases.filter((p) => p.scheduled)} />
        <div className="grid grid-cols-4 gap-4 mt-5 max-md:grid-cols-2 text-[12px]">
          <Legend swatch="#7c8a6b" label="Monthly income" />
          <Legend swatch="#7a1f2b" label="Fixed bills" />
          <Legend swatch="#c79b3a" label="One-off purchases" />
          <Legend swatch="#3d2c2e" label="Cumulative cash" />
        </div>
      </div>

      {/* Per-person card */}
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1 mb-8">
        <PersonMonthly name="Groom" accent="sage" income={income} expenses={expenses} purchases={purchases} person="groom" />
        <PersonMonthly name="Bride" accent="rose" income={income} expenses={expenses} purchases={purchases} person="bride" />
      </div>

      {/* Three sections */}
      <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
        <SectionCard
          title="Income"
          emoji="💼"
          accent="sage"
          empty="Add salaries or other monthly income."
          totalCount={income.length}
          onAdd={() => setIncomeDialog({ open: true, editing: null })}
          onViewAll={() => setExpandedSection("income")}
          items={recentIncome.map((i) => ({
            id: i.id,
            primary: i.name,
            secondary: `${personLabel(i.person)}${i.start_month ? ` · from ${monthLabel(i.start_month)}` : ""}${i.end_month ? ` · until ${monthLabel(i.end_month)}` : ""}`,
            value: `+${formatMoney(i.amount)}/mo`,
            valueClass: "text-sage",
            onClick: () => setIncomeDialog({ open: true, editing: i }),
            onDelete: () => handleDeleteIncome(i),
          }))}
        />

        <SectionCard
          title="Recurring expenses"
          emoji="🔁"
          accent="burgundy"
          empty="Add rent, utilities, subscriptions…"
          totalCount={expenses.length}
          onAdd={() => setExpenseDialog({ open: true, editing: null })}
          onViewAll={() => setExpandedSection("expense")}
          items={recentExpenses.map((e) => ({
            id: e.id,
            primary: e.name,
            secondary: e.expense_type === "credit"
              ? `Credit · ${e.credit_months}mo${e.credit_interest_rate ? ` @ ${e.credit_interest_rate}%` : ""} · ${e.start_month ? monthLabel(e.start_month) : "?"} → ${e.end_month ? monthLabel(e.end_month) : "?"} · ${payerLabel(e.payer, e.payer_groom_pct)}`
              : `${e.category ?? "—"} · ${payerLabel(e.payer, e.payer_groom_pct)}`,
            value: `−${formatMoney(e.amount)}/mo`,
            valueClass: "text-burgundy",
            onClick: () => setExpenseDialog({ open: true, editing: e }),
            onDelete: () => handleDeleteExpense(e),
          }))}
        />

        <SectionCard
          title="One-time purchases"
          emoji="🛋️"
          accent="gold"
          empty="Plan furniture, appliances, big buys."
          totalCount={purchases.length}
          onAdd={() => setPurchaseDialog({ open: true, editing: null })}
          onViewAll={() => setExpandedSection("purchase")}
          items={recentPurchases.map((p) => {
            const paid = Number(p.already_paid ?? 0);
            const remaining = Math.max(0, Number(p.amount) - paid);
            return {
              id: p.id,
              primary: p.name,
              secondary: paid > 0
                ? `${p.category ?? "—"} · ${monthLabel(p.target_month)} · ${formatMoney(paid)} paid of ${formatMoney(p.amount)} · ${payerLabel(p.payer, p.payer_groom_pct)}`
                : `${p.category ?? "—"} · ${monthLabel(p.target_month)} · ${payerLabel(p.payer, p.payer_groom_pct)}`,
              value: paid > 0 ? `−${formatMoney(remaining)}` : `−${formatMoney(p.amount)}`,
              valueClass: p.scheduled ? (remaining === 0 ? "text-sage" : "text-burgundy") : "text-ink-soft line-through",
              onClick: () => setPurchaseDialog({ open: true, editing: p }),
              onDelete: () => handleDeletePurchase(p),
              onToggle: () => handleToggleScheduled(p),
              toggled: p.scheduled,
            };
          })}
        />
      </div>

      {/* Wedding savings section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">Wedding savings</div>
            <div className="font-serif text-[18px] text-ink mt-0.5">
              Your pot at the start of life after — <em>{formatMoney(weddingCashOnHand)}</em> cash on hand
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setTransferDialogOpen(true)}>⇄ Transfer to Common</Button>
            <Button variant="ghost" size="sm" onClick={() => setExpandedSavingsOpen(true)}>Show all ↗</Button>
            <Button size="sm" onClick={() => setSavingsDialog({ open: true, editing: null })}>+ Log savings</Button>
          </div>
        </div>
        <SavingsPots
          savings={savings}
          onEdit={(s) => setSavingsDialog({ open: true, editing: s })}
          onDelete={handleDeleteSaving}
        />
      </div>
      </>
      )}

      {(view === "groom" || view === "bride") && (
        <PersonView
          person={view}
          income={income}
          expenses={expenses}
          purchases={purchases}
          settings={settings}
          onEditIncome={(i) => setIncomeDialog({ open: true, editing: i })}
          onEditExpense={(e) => setExpenseDialog({ open: true, editing: e })}
          onEditPurchase={(p) => setPurchaseDialog({ open: true, editing: p })}
          onAdd={(type) => {
            if (type === "income") setIncomeDialog({ open: true, editing: null });
            else if (type === "expense") setExpenseDialog({ open: true, editing: null });
            else setPurchaseDialog({ open: true, editing: null });
          }}
        />
      )}

      {/* Expanded section dialogs */}
      {expandedSection === "income" && (
        <ExpandedIncomeDialog
          open
          onOpenChange={(o) => { if (!o) setExpandedSection(null); }}
          income={income}
          onEdit={(i) => { setExpandedSection(null); setIncomeDialog({ open: true, editing: i }); }}
          onDelete={handleDeleteIncome}
          onAdd={() => { setExpandedSection(null); setIncomeDialog({ open: true, editing: null }); }}
        />
      )}
      {expandedSection === "expense" && (
        <ExpandedExpensesDialog
          open
          onOpenChange={(o) => { if (!o) setExpandedSection(null); }}
          expenses={expenses}
          onEdit={(e) => { setExpandedSection(null); setExpenseDialog({ open: true, editing: e }); }}
          onDelete={handleDeleteExpense}
          onAdd={() => { setExpandedSection(null); setExpenseDialog({ open: true, editing: null }); }}
        />
      )}
      {expandedSection === "purchase" && (
        <ExpandedPurchasesDialog
          open
          onOpenChange={(o) => { if (!o) setExpandedSection(null); }}
          purchases={purchases}
          onEdit={(p) => { setExpandedSection(null); setPurchaseDialog({ open: true, editing: p }); }}
          onDelete={handleDeletePurchase}
          onToggleScheduled={handleToggleScheduled}
          onAdd={() => { setExpandedSection(null); setPurchaseDialog({ open: true, editing: null }); }}
        />
      )}

      {/* Dialogs */}
      {settingsOpen && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          weddingCashOnHand={weddingCashOnHand}
          onSaved={(s) => setSettings(s)}
        />
      )}

      {incomeDialog.open && (
        <IncomeDialog
          key={incomeDialog.editing?.id ?? "new"}
          open={incomeDialog.open}
          onOpenChange={(o) => setIncomeDialog({ open: o, editing: o ? incomeDialog.editing : null })}
          editing={incomeDialog.editing}
          onSaved={(row) => {
            setIncome((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              return exists ? prev.map((i) => (i.id === row.id ? row : i)) : [row, ...prev];
            });
          }}
        />
      )}

      {expenseDialog.open && (
        <ExpenseDialog
          key={expenseDialog.editing?.id ?? "new"}
          open={expenseDialog.open}
          onOpenChange={(o) => setExpenseDialog({ open: o, editing: o ? expenseDialog.editing : null })}
          editing={expenseDialog.editing}
          onSaved={(row) => {
            setExpenses((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              return exists ? prev.map((i) => (i.id === row.id ? row : i)) : [row, ...prev];
            });
          }}
        />
      )}

      {purchaseDialog.open && (
        <PurchaseDialog
          key={purchaseDialog.editing?.id ?? "new"}
          open={purchaseDialog.open}
          onOpenChange={(o) => setPurchaseDialog({ open: o, editing: o ? purchaseDialog.editing : null })}
          editing={purchaseDialog.editing}
          defaultMonth={settings.start_month}
          onSaved={(row) => {
            setPurchases((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              const next = exists ? prev.map((i) => (i.id === row.id ? row : i)) : [...prev, row];
              return next.sort((a, b) => a.target_month.localeCompare(b.target_month));
            });
          }}
        />
      )}

      {savingsDialog.open && (
        <SavingsDialog
          key={savingsDialog.editing?.id ?? "new-saving"}
          open={savingsDialog.open}
          onOpenChange={(o) => setSavingsDialog({ open: o, editing: o ? savingsDialog.editing : null })}
          editing={savingsDialog.editing}
          onSaved={(row) => {
            setSavings((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              return exists ? prev.map((i) => (i.id === row.id ? row : i)) : [row, ...prev];
            });
          }}
        />
      )}

      {transferDialogOpen && (
        <TransferDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onSaved={(row) => setSavings((prev) => [row, ...prev])}
        />
      )}

      {expandedSavingsOpen && (
        <ExpandedSavingsDialog
          open={expandedSavingsOpen}
          onOpenChange={setExpandedSavingsOpen}
          savings={savings}
          onEdit={(s) => { setSavingsDialog({ open: true, editing: s }); }}
          onDelete={handleDeleteSaving}
          onAdd={() => setSavingsDialog({ open: true, editing: null })}
        />
      )}
    </section>
  );
}

// ============================================================================
// Display helpers
// ============================================================================

function personLabel(p: LifePerson): string {
  return p === "both" ? "Joint" : p === "groom" ? "Groom" : "Bride";
}

function payerLabel(payer: LifePerson, pct: number | null): string {
  if (payer === "both") return `Both (${pct ?? 50}% groom)`;
  return payer === "groom" ? "Groom" : "Bride";
}

// ============================================================================
// Cashflow chart — pure SVG
// ============================================================================

type ProjectionPoint = {
  month: string;
  income: number;
  fixed: number;
  purchases: number;
  net: number;
  cumulative: number;
};

function CashflowChart({
  projection,
  purchases,
}: {
  projection: ProjectionPoint[];
  purchases: LifePurchaseRow[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (projection.length === 0) {
    return <p className="text-[13px] italic text-ink-soft text-center py-12">Adjust settings to see the projection.</p>;
  }

  const width = 920;
  const height = 340;
  const padTop = 28;
  const padBottom = 42;
  const padLeft = 68;
  const padRight = 20;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  // Cumulative Y scale
  const cumValues = projection.map((p) => p.cumulative);
  const rawMin = Math.min(0, ...cumValues);
  const rawMax = Math.max(0, ...cumValues);
  const cushion = (rawMax - rawMin) * 0.08 || 500;
  const yMin = rawMin - cushion;
  const yMax = rawMax + cushion;
  const range = yMax - yMin || 1;

  const yFor = (v: number) => padTop + ((yMax - v) / range) * innerH;
  const zeroY = yFor(0);

  // Bar scale: normalised to 28% of chart height so bars are always visible
  const maxFlow = Math.max(...projection.map((p) => Math.max(p.income, p.fixed + p.purchases)), 1);
  const barH = (v: number) => Math.max(1, (v / maxFlow) * innerH * 0.28);

  const stepX = innerW / Math.max(1, projection.length);
  const xFor = (i: number) => padLeft + (i + 0.5) * stepX;
  const barW = Math.min(stepX * 0.28, 10);

  // Cumulative path
  const linePath = projection.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.cumulative)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(projection.length - 1)} ${zeroY} L ${xFor(0)} ${zeroY} Z`;

  // Gradient split at zero
  const zeroFrac = Math.max(0.001, Math.min(0.999, (zeroY - padTop) / innerH));

  // Find break-even crossing
  let breakEvenIdx: number | null = null;
  let dipped = false;
  for (let i = 0; i < projection.length; i++) {
    if (projection[i].cumulative < 0) dipped = true;
    else if (dipped && projection[i].cumulative >= 0) { breakEvenIdx = i; break; }
  }

  // Y-axis ticks
  const tickValues: number[] = [];
  for (let i = 0; i <= 6; i++) tickValues.push(yMin + (range * i) / 6);

  const labelEvery = Math.max(1, Math.ceil(projection.length / 14));

  return (
    <div className="relative overflow-x-auto select-none">
      {/* Hover tooltip */}
      {hoveredIdx !== null && (() => {
        const p = projection[hoveredIdx];
        const cx = xFor(hoveredIdx);
        const relX = cx - padLeft;
        const flipLeft = relX > innerW * 0.62;
        return (
          <div
            className="absolute top-6 pointer-events-none z-10 bg-ink/95 text-cream text-[11px] rounded-[6px] px-3.5 py-2.5 shadow-xl min-w-[170px] backdrop-blur-sm"
            style={{ left: Math.max(0, flipLeft ? cx - 182 : cx - padLeft + 14) }}
          >
            <div className="font-serif text-[13px] mb-2 border-b border-cream/15 pb-1.5">{monthLabel(p.month)}</div>
            <div className="space-y-1">
              <div className="flex justify-between gap-6">
                <span className="text-cream/50">Income</span>
                <span className="text-[#a8c49a] font-mono">+{formatMoney(p.income)}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-cream/50">Bills</span>
                <span className="text-[#c47a7a] font-mono">−{formatMoney(p.fixed)}</span>
              </div>
              {p.purchases > 0 && (
                <div className="flex justify-between gap-6">
                  <span className="text-cream/50">Purchases</span>
                  <span className="text-[#e0ba6a] font-mono">−{formatMoney(p.purchases)}</span>
                </div>
              )}
              <div className="flex justify-between gap-6 pt-1 mt-1 border-t border-cream/15">
                <span className="text-cream/50">Net</span>
                <span className={`font-mono font-semibold ${p.net >= 0 ? "text-[#a8c49a]" : "text-[#c47a7a]"}`}>
                  {p.net >= 0 ? "+" : ""}{formatMoney(p.net)}
                </span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-cream/50">Cash</span>
                <span className={`font-mono font-semibold ${p.cumulative >= 0 ? "text-[#a8c49a]" : "text-[#c47a7a]"}`}>
                  {formatMoney(p.cumulative)}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[640px] cursor-crosshair"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const svgX = (e.clientX - rect.left) * (width / rect.width);
          const idx = Math.floor((svgX - padLeft) / stepX);
          setHoveredIdx(idx >= 0 && idx < projection.length ? idx : null);
        }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          {/* Gradient for cumulative area: green above zero, red below */}
          <linearGradient id="areaGrad" x1="0" y1={padTop} x2="0" y2={padTop + innerH} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7c8a6b" stopOpacity="0.45" />
            <stop offset={zeroFrac * 0.88} stopColor="#7c8a6b" stopOpacity="0.12" />
            <stop offset={zeroFrac} stopColor="#7a1f2b" stopOpacity="0.12" />
            <stop offset="1" stopColor="#7a1f2b" stopOpacity="0.45" />
          </linearGradient>
          {/* Income bar gradient (top = solid, bottom = transparent) */}
          <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c8a6b" stopOpacity="0.9" />
            <stop offset="1" stopColor="#7c8a6b" stopOpacity="0.35" />
          </linearGradient>
          {/* Expense bar gradient */}
          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a1f2b" stopOpacity="0.35" />
            <stop offset="1" stopColor="#7a1f2b" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Chart area background */}
        <rect x={padLeft} y={padTop} width={innerW} height={innerH} fill="#faf5e9" opacity="0.5" rx={3} />

        {/* Grid lines */}
        {tickValues.map((v, i) => {
          const y = yFor(v);
          if (y < padTop - 2 || y > padTop + innerH + 2) return null;
          const isZero = Math.abs(v) < range * 0.001;
          return (
            <line key={i}
              x1={padLeft} x2={width - padRight} y1={y} y2={y}
              stroke={isZero ? "#3d2c2e" : "#e6dccd"}
              strokeWidth={isZero ? 1.5 : 0.8}
              strokeDasharray={isZero ? "5 4" : undefined}
              opacity={isZero ? 0.6 : 1}
            />
          );
        })}

        {/* Y-axis labels */}
        {tickValues.map((v, i) => {
          const y = yFor(v);
          if (y < padTop - 6 || y > padTop + innerH + 6) return null;
          return (
            <text key={i} x={padLeft - 10} y={y + 3.5} textAnchor="end" fontSize={10} fill="#7a6f60" fontFamily="monospace">
              {formatMoneyShort(v)}
            </text>
          );
        })}

        {/* Hover column highlight */}
        {hoveredIdx !== null && (
          <rect
            x={padLeft + hoveredIdx * stepX}
            y={padTop}
            width={stepX}
            height={innerH}
            fill="#3d2c2e"
            opacity={0.045}
          />
        )}

        {/* Income bars — going UP from zero axis */}
        {projection.map((p, i) => {
          const cx = xFor(i);
          const h = barH(p.income);
          return (
            <rect key={"inc-" + p.month}
              x={cx - barW - 1}
              y={zeroY - h}
              width={barW}
              height={h}
              fill="url(#incGrad)"
              opacity={hoveredIdx === i ? 1 : 0.7}
              rx={1.5}
            />
          );
        })}

        {/* Expense bars — going DOWN from zero axis (fixed + purchases stacked) */}
        {projection.map((p, i) => {
          const cx = xFor(i);
          const fixH = barH(p.fixed);
          const purH = p.purchases > 0 ? barH(p.purchases) : 0;
          return (
            <g key={"exp-" + p.month}>
              <rect
                x={cx + 1}
                y={zeroY}
                width={barW}
                height={fixH}
                fill="url(#expGrad)"
                opacity={hoveredIdx === i ? 0.95 : 0.65}
                rx={1.5}
              />
              {purH > 0 && (
                <rect
                  x={cx + 1}
                  y={zeroY + fixH}
                  width={barW}
                  height={purH}
                  fill="#c79b3a"
                  opacity={hoveredIdx === i ? 1 : 0.75}
                  rx={1.5}
                />
              )}
            </g>
          );
        })}

        {/* Cumulative area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Cumulative line */}
        <path d={linePath} fill="none" stroke="#3d2c2e" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Cumulative dots — colored by positive/negative */}
        {projection.map((p, i) => (
          <circle key={"cd-" + p.month}
            cx={xFor(i)}
            cy={yFor(p.cumulative)}
            r={hoveredIdx === i ? 4.5 : 2.5}
            fill={p.cumulative >= 0 ? "#7c8a6b" : "#7a1f2b"}
            stroke="#faf5e9"
            strokeWidth={hoveredIdx === i ? 1.5 : 1}
          />
        ))}

        {/* Break-even marker */}
        {breakEvenIdx !== null && (() => {
          const p = projection[breakEvenIdx];
          const cx = xFor(breakEvenIdx);
          const cy = yFor(p.cumulative);
          const labelRight = cx < padLeft + innerW * 0.75;
          return (
            <g>
              <line x1={cx} x2={cx} y1={padTop} y2={cy - 12} stroke="#c79b3a" strokeWidth={1} strokeDasharray="4 3" opacity={0.55} />
              <circle cx={cx} cy={cy} r={8} fill="#c79b3a" opacity={0.9} />
              <circle cx={cx} cy={cy} r={4} fill="#faf5e9" opacity={0.8} />
              <text
                x={labelRight ? cx + 12 : cx - 12}
                y={cy - 10}
                textAnchor={labelRight ? "start" : "end"}
                fontSize={9.5}
                fill="#c79b3a"
                fontFamily="ui-sans-serif"
                fontWeight="700"
                letterSpacing="0.08em"
              >
                BREAK EVEN
              </text>
            </g>
          );
        })()}

        {/* Hover vertical crosshair */}
        {hoveredIdx !== null && (
          <line
            x1={xFor(hoveredIdx)} x2={xFor(hoveredIdx)}
            y1={padTop} y2={padTop + innerH}
            stroke="#3d2c2e" strokeWidth={1} strokeDasharray="5 4" opacity={0.25}
          />
        )}

        {/* X-axis labels */}
        {projection.map((p, i) => {
          if (i % labelEvery !== 0 && i !== projection.length - 1) return null;
          const active = hoveredIdx === i;
          return (
            <text key={"xl-" + p.month}
              x={xFor(i)}
              y={height - 14}
              textAnchor="middle"
              fontSize={active ? 10 : 9.5}
              fill={active ? "#3d2c2e" : "#7a6f60"}
              fontFamily="ui-sans-serif"
              fontWeight={active ? "700" : "400"}
            >
              {monthShort(p.month)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/** Compact money for chart axis: €1.2k, €750, etc. */
function formatMoneyShort(n: number): string {
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

// ============================================================================
// Personal cashflow chart (per-person savings trajectory)
// ============================================================================

type PersonPoint = { month: string; net: number; cumulative: number; totalIn: number; totalOut: number };

function PersonCashflowChart({ projection, person }: { projection: PersonPoint[]; person: "groom" | "bride" }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (projection.length === 0) return null;

  const color = person === "groom" ? "#7c8a6b" : "#a85c72";
  const W = 860, H = 190, pT = 18, pB = 36, pL = 60, pR = 16;
  const iW = W - pL - pR, iH = H - pT - pB;

  const cumValues = projection.map((p) => p.cumulative);
  const rawMin = Math.min(0, ...cumValues);
  const rawMax = Math.max(0, ...cumValues);
  const pad = Math.max((rawMax - rawMin) * 0.1, 100);
  const yMin = rawMin - pad, yMax = rawMax + pad, range = yMax - yMin || 1;

  const yFor = (v: number) => pT + ((yMax - v) / range) * iH;
  const zeroY = yFor(0);
  const zeroFrac = Math.max(0.001, Math.min(0.999, (zeroY - pT) / iH));

  const stepX = iW / Math.max(1, projection.length);
  const xFor = (i: number) => pL + (i + 0.5) * stepX;
  const barW = Math.min(stepX * 0.45, 12);

  const linePath = projection.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.cumulative)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(projection.length - 1)} ${zeroY} L ${xFor(0)} ${zeroY} Z`;
  const maxFlow = Math.max(...projection.map((p) => Math.max(p.totalIn, p.totalOut)), 1);
  const labelEvery = Math.max(1, Math.ceil(projection.length / 12));

  return (
    <div className="relative overflow-x-auto select-none">
      {hoveredIdx !== null && (() => {
        const p = projection[hoveredIdx];
        const cx = xFor(hoveredIdx);
        const flip = cx - pL > iW * 0.65;
        return (
          <div
            className="absolute top-3 pointer-events-none z-10 bg-ink/92 text-cream text-[11px] rounded-[5px] px-3 py-2 shadow-lg min-w-[150px]"
            style={{ left: Math.max(0, flip ? cx - 166 : cx - pL + 10) }}
          >
            <div className="font-serif text-[12px] mb-1.5 border-b border-cream/15 pb-1">{monthLabel(p.month)}</div>
            <div className="space-y-1">
              <div className="flex justify-between gap-5"><span className="text-cream/50">In</span><span className="font-mono" style={{ color }}>{formatMoney(p.totalIn)}</span></div>
              <div className="flex justify-between gap-5"><span className="text-cream/50">Out</span><span className="font-mono text-[#c47a7a]">{formatMoney(p.totalOut)}</span></div>
              <div className="flex justify-between gap-5 border-t border-cream/15 pt-1">
                <span className="text-cream/50">Savings</span>
                <span className="font-mono font-semibold" style={{ color: p.cumulative >= 0 ? color : "#c47a7a" }}>{formatMoney(p.cumulative)}</span>
              </div>
            </div>
          </div>
        );
      })()}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="min-w-[480px] cursor-crosshair"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const idx = Math.floor(((e.clientX - r.left) * (W / r.width) - pL) / stepX);
          setHoveredIdx(idx >= 0 && idx < projection.length ? idx : null);
        }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id={`pg-${person}`} x1="0" y1={pT} x2="0" y2={pT + iH} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={color} stopOpacity="0.5" />
            <stop offset={zeroFrac * 0.82} stopColor={color} stopOpacity="0.12" />
            <stop offset={zeroFrac} stopColor="#7a1f2b" stopOpacity="0.12" />
            <stop offset="1" stopColor="#7a1f2b" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* Zero dashed line */}
        {zeroY >= pT && zeroY <= pT + iH && (
          <line x1={pL} x2={W - pR} y1={zeroY} y2={zeroY} stroke="#3d2c2e" strokeWidth={1} strokeDasharray="4 4" opacity={0.35} />
        )}
        {/* Y labels: min, zero, max */}
        {[rawMin, 0, rawMax].filter((v) => {
          const y = yFor(v);
          return y >= pT + 6 && y <= pT + iH - 6;
        }).map((v, i) => (
          <text key={i} x={pL - 8} y={yFor(v) + 3.5} textAnchor="end" fontSize={9} fill="#7a6f60" fontFamily="monospace">
            {formatMoneyShort(v)}
          </text>
        ))}
        {/* Hover column */}
        {hoveredIdx !== null && <rect x={pL + hoveredIdx * stepX} y={pT} width={stepX} height={iH} fill="#3d2c2e" opacity={0.04} />}
        {/* Net bars */}
        {projection.map((p, i) => {
          const h = Math.max(1, (Math.abs(p.net) / maxFlow) * iH * 0.32);
          const y = p.net >= 0 ? zeroY - h : zeroY;
          return (
            <rect key={p.month} x={xFor(i) - barW / 2} y={y} width={barW} height={h}
              fill={p.net >= 0 ? color : "#7a1f2b"} opacity={hoveredIdx === i ? 0.9 : 0.5} rx={1.5}
            />
          );
        })}
        {/* Area + line */}
        <path d={areaPath} fill={`url(#pg-${person})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {projection.map((p, i) => (
          <circle key={p.month} cx={xFor(i)} cy={yFor(p.cumulative)}
            r={hoveredIdx === i ? 4.5 : 2.5}
            fill={p.cumulative >= 0 ? color : "#7a1f2b"} stroke="#faf5e9" strokeWidth={1}
          />
        ))}
        {/* Crosshair */}
        {hoveredIdx !== null && <line x1={xFor(hoveredIdx)} x2={xFor(hoveredIdx)} y1={pT} y2={pT + iH} stroke="#3d2c2e" strokeWidth={1} strokeDasharray="4 3" opacity={0.2} />}
        {/* X labels */}
        {projection.map((p, i) => {
          if (i % labelEvery !== 0 && i !== projection.length - 1) return null;
          return (
            <text key={p.month} x={xFor(i)} y={H - 12} textAnchor="middle"
              fontSize={9.5} fill={hoveredIdx === i ? "#3d2c2e" : "#7a6f60"} fontFamily="ui-sans-serif">
              {monthShort(p.month)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================================
// Personal view — Groom or Bride
// ============================================================================

function PersonView({
  person, income, expenses, purchases, settings,
  onEditIncome, onEditExpense, onEditPurchase, onAdd,
}: {
  person: "groom" | "bride";
  income: LifeIncomeRow[];
  expenses: LifeExpenseRow[];
  purchases: LifePurchaseRow[];
  settings: LifeSettingsRow;
  onEditIncome: (i: LifeIncomeRow) => void;
  onEditExpense: (e: LifeExpenseRow) => void;
  onEditPurchase: (p: LifePurchaseRow) => void;
  onAdd: (type: "income" | "expense" | "purchase") => void;
}) {
  const todayMonth = dateToMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);

  const accentBorder = person === "groom" ? "border-l-sage" : "border-l-rose";
  const accentText = person === "groom" ? "text-sage" : "text-rose";
  const personName = person === "groom" ? "Groom" : "Bride";

  // Month snapshot
  const snap = useMemo(() => {
    const m = selectedMonth;
    const myIncome = income
      .filter((i) => i.person === person && isActiveInMonth(i.start_month, i.end_month, m))
      .reduce((a, i) => a + Number(i.amount), 0);
    const commonIncome = income
      .filter((i) => i.person === "both" && isActiveInMonth(i.start_month, i.end_month, m))
      .reduce((a, i) => a + Number(i.amount) * 0.5, 0);
    const myBills = expenses
      .filter((e) => e.payer === person && isActiveInMonth(e.start_month, e.end_month, m))
      .reduce((a, e) => a + Number(e.amount), 0);
    const sharedBills = expenses
      .filter((e) => e.payer === "both" && isActiveInMonth(e.start_month, e.end_month, m))
      .reduce((a, e) => a + Number(e.amount) * personShare(e.payer, e.payer_groom_pct, person), 0);
    const myPurch = purchases
      .filter((p) => p.scheduled && p.target_month === m && p.payer === person)
      .reduce((a, p) => a + Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)), 0);
    const sharedPurch = purchases
      .filter((p) => p.scheduled && p.target_month === m && p.payer === "both")
      .reduce((a, p) => a + Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)) * personShare(p.payer, p.payer_groom_pct, person), 0);
    const totalIn = myIncome + commonIncome;
    const totalOut = myBills + sharedBills + myPurch + sharedPurch;
    return { myIncome, commonIncome, myBills, sharedBills, myPurch, sharedPurch, totalIn, totalOut, net: totalIn - totalOut };
  }, [selectedMonth, income, expenses, purchases, person]);

  // Personal projection
  const personProjection = useMemo((): PersonPoint[] => {
    const months = monthsList(settings.start_month, settings.horizon_months);
    let cumulative = 0;
    return months.map((month) => {
      const myInc = income
        .filter((i) => i.person === person && isActiveInMonth(i.start_month, i.end_month, month))
        .reduce((a, i) => a + Number(i.amount), 0);
      const comInc = income
        .filter((i) => i.person === "both" && isActiveInMonth(i.start_month, i.end_month, month))
        .reduce((a, i) => a + Number(i.amount) * 0.5, 0);
      const myExp = expenses
        .filter((e) => e.payer === person && isActiveInMonth(e.start_month, e.end_month, month))
        .reduce((a, e) => a + Number(e.amount), 0);
      const shExp = expenses
        .filter((e) => e.payer === "both" && isActiveInMonth(e.start_month, e.end_month, month))
        .reduce((a, e) => a + Number(e.amount) * personShare(e.payer, e.payer_groom_pct, person), 0);
      const myP = purchases
        .filter((p) => p.scheduled && p.target_month === month)
        .reduce((a, p) => a + Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)) * personShare(p.payer, p.payer_groom_pct, person), 0);
      const totalIn = myInc + comInc;
      const totalOut = myExp + shExp + myP;
      const net = totalIn - totalOut;
      cumulative += net;
      return { month, totalIn, totalOut, net, cumulative };
    });
  }, [income, expenses, purchases, settings, person]);

  const savingsRate = snap.totalIn > 0 ? (snap.net / snap.totalIn) * 100 : 0;

  return (
    <div className="animate-in fade-in duration-200">
      {/* Month selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">Snapshot for</span>
        <div className="w-52">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Flow summary — 3 cards */}
      <div className="grid grid-cols-3 gap-4 mb-6 max-md:grid-cols-1">
        {/* What's in */}
        <div className={`bg-paper border border-line border-l-[3px] ${accentBorder} rounded-[4px] p-5 shadow-soft`}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-soft mb-3 font-medium">What&rsquo;s coming in</div>
          <div className="font-serif text-[26px] mb-3"><em className={accentText}>+{formatMoney(snap.totalIn)}</em></div>
          <div className="space-y-1.5 text-[12px]">
            {snap.myIncome > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-soft truncate">Personal income</span>
                <span className="font-mono text-sage shrink-0">+{formatMoney(snap.myIncome)}</span>
              </div>
            )}
            {snap.commonIncome > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-soft flex items-center gap-1 truncate">
                  <span className="text-gold text-[10px]">⇄</span> Common fund (50%)
                </span>
                <span className="font-mono text-gold shrink-0">+{formatMoney(snap.commonIncome)}</span>
              </div>
            )}
            {snap.totalIn === 0 && <p className="italic text-ink-soft text-[11px]">No income tagged to {personName}.</p>}
          </div>
        </div>

        {/* What's out */}
        <div className="bg-paper border border-line border-l-[3px] border-l-burgundy rounded-[4px] p-5 shadow-soft">
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-soft mb-3 font-medium">What&rsquo;s going out</div>
          <div className="font-serif text-[26px] mb-3"><em className="text-burgundy">−{formatMoney(snap.totalOut)}</em></div>
          <div className="space-y-1.5 text-[12px]">
            {snap.myBills > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-soft truncate">Personal bills</span>
                <span className="font-mono text-burgundy shrink-0">−{formatMoney(snap.myBills)}</span>
              </div>
            )}
            {snap.sharedBills > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-soft flex items-center gap-1 truncate">
                  <span className="text-gold text-[10px]">⇄</span> Share of joint bills
                </span>
                <span className="font-mono text-burgundy shrink-0">−{formatMoney(snap.sharedBills)}</span>
              </div>
            )}
            {(snap.myPurch + snap.sharedPurch) > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-soft truncate">Purchases this month</span>
                <span className="font-mono text-gold shrink-0">−{formatMoney(snap.myPurch + snap.sharedPurch)}</span>
              </div>
            )}
            {snap.totalOut === 0 && <p className="italic text-ink-soft text-[11px]">No costs this month.</p>}
          </div>
        </div>

        {/* Net */}
        <div className={`bg-paper border border-line border-l-[3px] ${snap.net >= 0 ? accentBorder : "border-l-burgundy"} rounded-[4px] p-5 shadow-soft`}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-soft mb-3 font-medium">Personal net</div>
          <div className={`font-serif text-[26px] mb-3 ${snap.net < 0 ? "text-burgundy" : ""}`}>
            <em>{snap.net >= 0 ? "+" : ""}{formatMoney(snap.net)}</em>
          </div>
          {snap.totalIn > 0 && (
            <>
              <div className="text-[12px] text-ink-soft mb-2">
                {snap.net >= 0
                  ? `${savingsRate.toFixed(0)}% savings rate`
                  : `Deficit — spending more than earning`}
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${snap.net >= 0 ? (person === "groom" ? "bg-sage" : "bg-rose") : "bg-burgundy"}`}
                  style={{ width: `${Math.min(100, Math.abs(savingsRate))}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Personal savings chart */}
      <div className="bg-paper border border-line rounded-[4px] p-5 shadow-soft mb-6">
        <div className="flex items-baseline justify-between mb-1 gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">{personName} · personal savings trajectory</div>
            <p className="text-[12px] text-ink-soft italic mt-0.5">
              Cumulative personal balance over the projection (starting from €0).
            </p>
          </div>
          {(() => {
            const last = personProjection[personProjection.length - 1];
            return last ? (
              <div className={`font-serif text-[18px] shrink-0 ${last.cumulative >= 0 ? accentText : "text-burgundy"}`}>
                <em>{last.cumulative >= 0 ? "+" : ""}{formatMoney(last.cumulative)}</em>
              </div>
            ) : null;
          })()}
        </div>
        <PersonCashflowChart projection={personProjection} person={person} />
      </div>

      {/* Filtered lists */}
      <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
        {/* Income */}
        <div className={`bg-paper border border-line border-l-[3px] ${accentBorder} rounded-[4px] shadow-soft flex flex-col`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">💼</span>
              <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">Income</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onAdd("income")}>+ Add</Button>
          </div>
          {income.length === 0 ? (
            <p className="px-5 py-6 text-[13px] italic text-ink-soft">No income yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {income.map((i) => {
                const shareAmt = i.person === "both" ? Number(i.amount) * 0.5 : Number(i.amount);
                return (
                  <li key={i.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-cream/30 cursor-pointer"
                    onClick={() => onEditIncome(i)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate text-[13px]">{i.name}</div>
                      <div className="text-[11px] text-ink-soft truncate">
                        {i.person === "both"
                          ? <span className="text-gold">⇄ Common fund · your 50%</span>
                          : <span className={accentText}>Personal</span>
                        }
                        {i.start_month ? ` · from ${monthLabel(i.start_month)}` : ""}
                        {i.end_month ? ` · until ${monthLabel(i.end_month)}` : ""}
                      </div>
                    </div>
                    <div className="font-mono text-sage text-[12px] shrink-0">+{formatMoney(shareAmt)}/mo</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Bills */}
        <div className="bg-paper border border-line border-l-[3px] border-l-burgundy rounded-[4px] shadow-soft flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">🔁</span>
              <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">Bills</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onAdd("expense")}>+ Add</Button>
          </div>
          {expenses.length === 0 ? (
            <p className="px-5 py-6 text-[13px] italic text-ink-soft">No expenses yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {expenses.map((e) => {
                const share = personShare(e.payer, e.payer_groom_pct, person);
                if (share === 0) return null;
                return (
                  <li key={e.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-cream/30 cursor-pointer"
                    onClick={() => onEditExpense(e)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate text-[13px]">{e.name}</div>
                      <div className="text-[11px] text-ink-soft truncate">
                        {e.payer === "both"
                          ? <span className="text-gold">⇄ Shared · {Math.round(share * 100)}% your share</span>
                          : <span>Personal bill</span>
                        }
                        {e.start_month ? ` · from ${monthLabel(e.start_month)}` : ""}
                        {e.end_month ? ` · until ${monthLabel(e.end_month)}` : ""}
                      </div>
                    </div>
                    <div className="font-mono text-burgundy text-[12px] shrink-0">−{formatMoney(Number(e.amount) * share)}/mo</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Purchases */}
        <div className="bg-paper border border-line border-l-[3px] border-l-gold rounded-[4px] shadow-soft flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">🛋️</span>
              <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">Purchases</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onAdd("purchase")}>+ Add</Button>
          </div>
          {purchases.length === 0 ? (
            <p className="px-5 py-6 text-[13px] italic text-ink-soft">No purchases yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {purchases.map((p) => {
                const share = personShare(p.payer, p.payer_groom_pct, person);
                if (share === 0) return null;
                return (
                  <li key={p.id}
                    className={`flex items-center gap-3 px-5 py-3 hover:bg-cream/30 cursor-pointer ${!p.scheduled ? "opacity-45" : ""}`}
                    onClick={() => onEditPurchase(p)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate text-[13px]">{p.name}</div>
                      <div className="text-[11px] text-ink-soft truncate">
                        {monthLabel(p.target_month)}
                        {p.payer === "both" ? <span className="text-gold"> · ⇄ shared {Math.round(share * 100)}%</span> : " · Personal"}
                        {Number(p.already_paid ?? 0) > 0 && <span className="text-sage"> · {formatMoney(Number(p.already_paid))} paid</span>}
                        {!p.scheduled && " · excluded"}
                      </div>
                    </div>
                    <div className={`font-mono text-[12px] shrink-0 ${p.scheduled ? "text-gold" : "text-ink-soft line-through"}`}>
                      −{formatMoney(Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)) * share)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Reusable visual atoms
// ============================================================================

function KPI({
  label, value, meta, accent = "ink",
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
      <div className="font-serif text-[22px] text-ink leading-tight"><em>{value}</em></div>
      {meta && <div className="text-[12px] text-ink-soft mt-2 truncate">{meta}</div>}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: swatch }} />
      <span className="text-ink-soft uppercase tracking-[0.15em] text-[10px] font-medium">{label}</span>
    </div>
  );
}

// ============================================================================
// View switcher — Household / Groom / Bride
// ============================================================================

type LifeView = "joint" | "groom" | "bride";

function ViewSwitcher({ view, onChange }: { view: LifeView; onChange: (v: LifeView) => void }) {
  const tabs: { value: LifeView; label: string; sub: string; activeClass: string }[] = [
    { value: "joint", label: "Household", sub: "Combined finances", activeClass: "border-ink text-ink" },
    { value: "groom", label: "Groom", sub: "Personal finances", activeClass: "border-sage text-sage" },
    { value: "bride", label: "Bride", sub: "Personal finances", activeClass: "border-rose text-rose" },
  ];
  return (
    <div className="flex gap-0 mb-8 border border-line rounded-[6px] overflow-hidden bg-cream-deep/40">
      {tabs.map((t) => {
        const active = view === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`flex-1 flex flex-col items-center py-3 px-4 transition-all border-b-[3px] ${
              active
                ? `bg-paper shadow-soft ${t.activeClass}`
                : "border-transparent text-ink-soft hover:bg-cream/60 hover:text-ink"
            }`}
          >
            <span className="text-[12px] font-semibold tracking-wide">{t.label}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] mt-0.5 opacity-70">{t.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

function PersonMonthly({
  name, accent, income, expenses, purchases, person,
}: {
  name: string;
  accent: "sage" | "rose";
  income: LifeIncomeRow[];
  expenses: LifeExpenseRow[];
  purchases: LifePurchaseRow[];
  person: "groom" | "bride";
}) {
  const todayMonth = dateToMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);

  const stats = useMemo(() => {
    const m = selectedMonth;
    const personIncome = income
      .filter((i) => isActiveInMonth(i.start_month, i.end_month, m))
      .reduce((a, i) => a + Number(i.amount) * (i.person === person ? 1 : i.person === "both" ? 0.5 : 0), 0);
    const personExpenses = expenses
      .filter((e) => isActiveInMonth(e.start_month, e.end_month, m))
      .reduce((a, e) => a + Number(e.amount) * personShare(e.payer, e.payer_groom_pct, person), 0);
    const personPurchases = purchases
      .filter((p) => p.scheduled && p.target_month === m)
      .reduce((a, p) => a + Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)) * personShare(p.payer, p.payer_groom_pct, person), 0);
    return {
      income: personIncome,
      expenses: personExpenses,
      purchases: personPurchases,
      net: personIncome - personExpenses - personPurchases,
    };
  }, [income, expenses, purchases, person, selectedMonth]);

  const accentBorder = accent === "sage" ? "border-l-sage" : "border-l-rose";
  const accentText = accent === "sage" ? "text-sage" : "text-rose";
  const noData = stats.income === 0 && stats.expenses === 0 && stats.purchases === 0;

  return (
    <div className={`bg-paper border border-line border-l-[3px] ${accentBorder} rounded-[4px] p-5 shadow-soft`}>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className={`text-[11px] uppercase tracking-[0.3em] font-medium ${accentText}`}>{name} · monthly</div>
        <div className="w-44 shrink-0">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {noData ? (
        <p className="text-[13px] italic text-ink-soft">Tag income or expenses to this person.</p>
      ) : (
        <>
          <div className={`grid gap-3 ${stats.purchases > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-1">Income</div>
              <div className="font-mono text-sage text-[15px]">+{formatMoney(stats.income)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-1">Bills</div>
              <div className="font-mono text-burgundy text-[15px]">−{formatMoney(stats.expenses)}</div>
            </div>
            {stats.purchases > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-1">Purchases</div>
                <div className="font-mono text-gold text-[15px]">−{formatMoney(stats.purchases)}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-1">Net</div>
              <div className={`font-mono text-[15px] ${stats.net >= 0 ? accentText : "text-burgundy"}`}>
                {stats.net >= 0 ? "+" : ""}{formatMoney(stats.net)}
              </div>
            </div>
          </div>
          {/* Mini bar showing income vs outgoings */}
          {stats.income > 0 && (() => {
            const total = Math.max(stats.income, stats.expenses + stats.purchases);
            const incPct = Math.round((stats.income / total) * 100);
            const expPct = Math.round(((stats.expenses + stats.purchases) / total) * 100);
            return (
              <div className="mt-3 flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-sage rounded-l-full transition-all" style={{ width: `${incPct}%` }} />
                <div className="bg-burgundy rounded-r-full transition-all" style={{ width: `${expPct}%` }} />
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

type SectionItem = {
  id: string;
  primary: string;
  secondary: string;
  value: string;
  valueClass: string;
  onClick: () => void;
  onDelete: () => void;
  onToggle?: () => void;
  toggled?: boolean;
};

function SectionCard({
  title, emoji, accent, empty, items, onAdd, totalCount, onViewAll,
}: {
  title: string;
  emoji: string;
  accent: "sage" | "burgundy" | "gold";
  empty: string;
  items: SectionItem[];
  onAdd: () => void;
  totalCount?: number;
  onViewAll?: () => void;
}) {
  const accentBorder = accent === "sage" ? "border-l-sage" : accent === "burgundy" ? "border-l-burgundy" : "border-l-gold";
  const hasMore = totalCount !== undefined && totalCount > items.length;

  return (
    <div className={`bg-paper border border-line border-l-[3px] ${accentBorder} rounded-[4px] shadow-soft flex flex-col`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{emoji}</span>
          <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">{title}</span>
          {totalCount !== undefined && totalCount > 0 && (
            <span className="text-[10px] bg-cream-deep text-ink-soft rounded-full px-1.5 py-0.5 font-mono">{totalCount}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onAdd}>+ Add</Button>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] italic text-ink-soft mb-4">{empty}</p>
          <Button onClick={onAdd}>+ Add first</Button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-cream/30">
                {it.onToggle && (
                  <button
                    type="button"
                    onClick={it.onToggle}
                    className={`w-3.5 h-3.5 rounded-sm border shrink-0 transition-colors ${it.toggled ? "bg-gold border-gold" : "bg-transparent border-line"}`}
                    aria-label={it.toggled ? "Disable" : "Enable"}
                    title={it.toggled ? "Scheduled — click to exclude from projection" : "Excluded — click to include"}
                  />
                )}
                <button
                  type="button"
                  onClick={it.onClick}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="font-medium text-ink truncate">{it.primary}</div>
                  <div className="text-[11px] text-ink-soft truncate">{it.secondary}</div>
                </button>
                <div className={`font-mono text-[13px] shrink-0 ${it.valueClass}`}>{it.value}</div>
                <button
                  type="button"
                  onClick={it.onDelete}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-soft hover:text-burgundy text-[18px] shrink-0"
                  aria-label="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {hasMore && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 border-t border-line text-[11px] text-ink-soft hover:text-ink hover:bg-cream/40 transition-colors"
            >
              Show all {totalCount} items
              <span className="text-[10px] opacity-60">↗</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Field helpers
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

// ============================================================================
// Dialogs
// ============================================================================

function IncomeDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: LifeIncomeRow | null;
  onSaved: (row: LifeIncomeRow) => void;
}) {
  const action = editing ? updateIncome.bind(null, editing.id) : createIncome;
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: LifeIncomeRow } | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok && state?.data) { onSaved(state.data); onOpenChange(false); }
  }, [state, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>income</em></> : <>New <em>income</em></>}</DialogTitle>
          <DialogDescription>A monthly income stream — salary, freelance, etc.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Celal salary" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Monthly amount (€)</Label>
              <Input id="amount" name="amount" type="number" min="0" step="1" defaultValue={editing?.amount ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Earned by</Label>
              <SelectField name="person" defaultValue={editing?.person ?? "groom"} options={PERSON_OPTIONS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Starts (optional)</Label>
              <MonthSelect name="start_month" defaultValue={editing?.start_month ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ends (optional)</Label>
              <MonthSelect name="end_month" defaultValue={editing?.end_month ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} rows={2} />
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

function ExpenseDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: LifeExpenseRow | null;
  onSaved: (row: LifeExpenseRow) => void;
}) {
  const action = editing ? updateExpense.bind(null, editing.id) : createExpense;
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: LifeExpenseRow } | null,
    FormData
  >(action, null);

  const [payer, setPayer] = useState<LifePerson>(editing?.payer ?? "both");
  const [expenseType, setExpenseType] = useState<ExpenseType>(editing?.expense_type ?? "fixed");
  // Credit live-calculation state
  const [creditTotal, setCreditTotal] = useState(editing?.credit_total ?? 0);
  const [creditMonths, setCreditMonths] = useState(editing?.credit_months ?? 12);
  const [creditRate, setCreditRate] = useState(editing?.credit_interest_rate ?? 0);

  useEffect(() => {
    setPayer(editing?.payer ?? "both");
    setExpenseType(editing?.expense_type ?? "fixed");
    setCreditTotal(editing?.credit_total ?? 0);
    setCreditMonths(editing?.credit_months ?? 12);
    setCreditRate(editing?.credit_interest_rate ?? 0);
  }, [editing]);

  useEffect(() => {
    if (state?.ok && state?.data) { onSaved(state.data); onOpenChange(false); }
  }, [state, onSaved, onOpenChange]);

  const monthly = calcMonthlyPayment(creditTotal, creditMonths, creditRate);
  const totalRepaid = monthly * creditMonths;
  const totalInterest = totalRepaid - creditTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>expense</em></> : <>New <em>recurring expense</em></>}</DialogTitle>
          <DialogDescription>A monthly bill — rent, credit instalment, subscription.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 mt-2">

          {/* Type toggle */}
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <input type="hidden" name="expense_type" value={expenseType} />
            <div className="flex gap-2">
              {(["fixed", "credit"] as ExpenseType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setExpenseType(t)}
                  className={`flex-1 px-3 py-2 rounded-[4px] text-[12px] border transition-colors ${
                    expenseType === t ? "bg-ink text-cream border-ink" : "bg-paper text-ink border-line hover:bg-cream"
                  }`}
                >
                  {t === "fixed" ? "Fixed bill" : "Credit / instalment"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name" name="name"
              defaultValue={editing?.name ?? ""}
              placeholder={expenseType === "fixed" ? "e.g. Rent" : "e.g. Car loan"}
              required autoFocus
            />
          </div>

          {expenseType === "fixed" ? (
            <>
              <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="amount">Monthly amount (€)</Label>
                  <Input id="amount" name="amount" type="number" min="0" step="1" defaultValue={editing?.amount ?? ""} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Category</Label>
                  <SelectField
                    name="category"
                    defaultValue={editing?.category ?? "Rent"}
                    options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
                <div className="flex flex-col gap-2">
                  <Label>Starts (optional)</Label>
                  <MonthSelect name="start_month" defaultValue={editing?.start_month ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Ends (optional)</Label>
                  <MonthSelect name="end_month" defaultValue={editing?.end_month ?? ""} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="credit_total">Total amount (€)</Label>
                  <Input
                    id="credit_total" name="credit_total" type="number" min="0" step="100"
                    value={creditTotal || ""}
                    onChange={(e) => setCreditTotal(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="credit_months">Number of months</Label>
                  <Input
                    id="credit_months" name="credit_months" type="number" min="1" max="360" step="1"
                    value={creditMonths || ""}
                    onChange={(e) => setCreditMonths(parseInt(e.target.value, 10) || 0)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="credit_interest_rate">Annual interest rate (%)</Label>
                  <Input
                    id="credit_interest_rate" name="credit_interest_rate" type="number" min="0" max="99" step="0.1"
                    value={creditRate || ""}
                    onChange={(e) => setCreditRate(parseFloat(e.target.value) || 0)}
                    placeholder="0 for no interest"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Category</Label>
                  <SelectField
                    name="category"
                    defaultValue={editing?.category ?? "Credit"}
                    options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Start month</Label>
                <MonthSelect name="start_month" defaultValue={editing?.start_month ?? ""} required />
              </div>
              {/* Live calculation preview */}
              {creditTotal > 0 && creditMonths > 0 && (
                <div className="bg-cream-deep/60 border border-line rounded-[4px] px-4 py-3 text-[12px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Monthly payment</span>
                    <span className="font-mono font-medium text-ink">{formatMoney(monthly)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Total repaid</span>
                    <span className="font-mono text-ink">{formatMoney(totalRepaid)}</span>
                  </div>
                  {totalInterest > 0.01 && (
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Interest cost</span>
                      <span className="font-mono text-burgundy">{formatMoney(totalInterest)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className={`grid gap-3.5 max-md:grid-cols-1 ${payer === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="flex flex-col gap-2">
              <Label>Who pays?</Label>
              <input type="hidden" name="payer" value={payer} />
              <Select value={payer} onValueChange={(v) => setPayer(v as LifePerson)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {payer === "both" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="payer_groom_pct">Groom&rsquo;s share (%)</Label>
                <Input id="payer_groom_pct" name="payer_groom_pct" type="number" min="0" max="100" step="1" defaultValue={editing?.payer_groom_pct ?? 50} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} rows={2} />
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

function PurchaseDialog({
  open, onOpenChange, editing, defaultMonth, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: LifePurchaseRow | null;
  defaultMonth: string;
  onSaved: (row: LifePurchaseRow) => void;
}) {
  const action = editing ? updatePurchase.bind(null, editing.id) : createPurchase;
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: LifePurchaseRow } | null,
    FormData
  >(action, null);

  const [payer, setPayer] = useState<LifePerson>(editing?.payer ?? "both");
  const [totalCost, setTotalCost] = useState<number>(Number(editing?.amount ?? 0));
  const [alreadyPaid, setAlreadyPaid] = useState<number>(Number(editing?.already_paid ?? 0));
  useEffect(() => {
    setPayer(editing?.payer ?? "both");
    setTotalCost(Number(editing?.amount ?? 0));
    setAlreadyPaid(Number(editing?.already_paid ?? 0));
  }, [editing]);

  useEffect(() => {
    if (state?.ok && state?.data) { onSaved(state.data); onOpenChange(false); }
  }, [state, onSaved, onOpenChange]);

  const remaining = Math.max(0, totalCost - alreadyPaid);
  const paidPct = totalCost > 0 ? Math.min(100, (alreadyPaid / totalCost) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>purchase</em></> : <>New <em>purchase</em></>}</DialogTitle>
          <DialogDescription>A one-time future purchase (furniture, appliance, etc.).</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Sofa" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Total cost (€)</Label>
              <Input id="amount" name="amount" type="number" min="0" step="1"
                value={totalCost || ""}
                onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="already_paid">Already paid (€)</Label>
              <Input id="already_paid" name="already_paid" type="number" min="0" step="1"
                value={alreadyPaid || ""}
                onChange={(e) => setAlreadyPaid(parseFloat(e.target.value) || 0)}
                placeholder="0" />
            </div>
          </div>
          {/* Live remaining preview */}
          {totalCost > 0 && (
            <div className="bg-cream-deep/60 border border-line rounded-[4px] px-4 py-3 text-[12px] space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-soft">Still to pay</span>
                <span className={`font-mono font-medium ${remaining > 0 ? "text-ink" : "text-sage"}`}>
                  {remaining > 0 ? formatMoney(remaining) : "Fully paid ✓"}
                </span>
              </div>
              {totalCost > 0 && (
                <div className="h-1.5 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-sage rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <SelectField
              name="category"
              defaultValue={editing?.category ?? "Furniture"}
              options={PURCHASE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Target month</Label>
            <MonthSelect name="target_month" defaultValue={editing?.target_month ?? defaultMonth} required />
          </div>
          <div className={`grid gap-3.5 max-md:grid-cols-1 ${payer === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="flex flex-col gap-2">
              <Label>Who pays?</Label>
              <input type="hidden" name="payer" value={payer} />
              <Select value={payer} onValueChange={(v) => setPayer(v as LifePerson)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {payer === "both" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="payer_groom_pct">Groom&rsquo;s share (%)</Label>
                <Input id="payer_groom_pct" name="payer_groom_pct" type="number" min="0" max="100" step="1" defaultValue={editing?.payer_groom_pct ?? 50} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="hidden" name="scheduled" value={editing?.scheduled === false ? "false" : "true"} />
            <span className="text-[12px] text-ink-soft italic">
              Toggle inclusion in the projection from the list (the gold checkbox).
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} rows={2} />
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

// ============================================================================
// Expanded section dialogs — full table with filters + sort
// ============================================================================

function SortHeader({ label, col, active, dir, onClick }: {
  label: string; col: string; active: string; dir: "asc" | "desc"; onClick: () => void;
}) {
  const on = active === col;
  return (
    <th className="text-left py-2.5 px-3 cursor-pointer select-none hover:text-ink transition-colors whitespace-nowrap text-[10px] uppercase tracking-[0.15em] font-medium" onClick={onClick}>
      <span className="flex items-center gap-1">
        {label}
        <span className={`transition-colors ${on ? "text-ink" : "text-ink-soft/30"}`}>{on ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </span>
    </th>
  );
}

const filterSelect = "h-8 border border-line rounded-[4px] px-2 text-[12px] bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/20";

function ExpandedIncomeDialog({ open, onOpenChange, income, onEdit, onDelete, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  income: LifeIncomeRow[];
  onEdit: (i: LifeIncomeRow) => void;
  onDelete: (i: LifeIncomeRow) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [sortCol, setSortCol] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    let r = [...income];
    if (search) r = r.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    if (personFilter !== "all") r = r.filter((i) => i.person === personFilter);
    r.sort((a, b) => {
      let c = 0;
      if (sortCol === "name") c = a.name.localeCompare(b.name);
      else if (sortCol === "amount") c = Number(a.amount) - Number(b.amount);
      else if (sortCol === "person") c = a.person.localeCompare(b.person);
      else if (sortCol === "start_month") c = (a.start_month ?? "").localeCompare(b.start_month ?? "");
      else c = a.created_at.localeCompare(b.created_at);
      return sortDir === "asc" ? c : -c;
    });
    return r;
  }, [income, search, personFilter, sortCol, sortDir]);

  const ts = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Income <em>streams</em></DialogTitle>
          <DialogDescription>{income.length} total · showing {rows.length}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-[12px] w-44" />
          <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className={filterSelect}>
            <option value="all">All persons</option>
            <option value="groom">Groom</option>
            <option value="bride">Bride</option>
            <option value="both">Both / Common</option>
          </select>
          <Button size="sm" className="ml-auto" onClick={onAdd}>+ Add</Button>
        </div>
        <div className="overflow-auto max-h-[55vh] border border-line rounded-[4px]">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-cream-deep/95 backdrop-blur-sm border-b border-line">
              <tr className="text-ink-soft">
                <SortHeader label="Name" col="name" active={sortCol} dir={sortDir} onClick={() => ts("name")} />
                <SortHeader label="Earner" col="person" active={sortCol} dir={sortDir} onClick={() => ts("person")} />
                <SortHeader label="Monthly" col="amount" active={sortCol} dir={sortDir} onClick={() => ts("amount")} />
                <SortHeader label="From" col="start_month" active={sortCol} dir={sortDir} onClick={() => ts("start_month")} />
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] font-medium">Until</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-line/50 hover:bg-cream/40 cursor-pointer group" onClick={() => onEdit(i)}>
                  <td className="py-2.5 px-3 font-medium text-ink">{i.name}</td>
                  <td className="py-2.5 px-3 text-ink-soft">{personLabel(i.person)}</td>
                  <td className="py-2.5 px-3 font-mono text-sage">+{formatMoney(i.amount)}</td>
                  <td className="py-2.5 px-3 text-ink-soft">{i.start_month ? monthLabel(i.start_month) : <em>Always</em>}</td>
                  <td className="py-2.5 px-3 text-ink-soft">{i.end_month ? monthLabel(i.end_month) : <em>Open</em>}</td>
                  <td className="py-2.5 px-3">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(i); }} className="opacity-0 group-hover:opacity-100 text-ink-soft hover:text-burgundy text-[16px] transition-opacity">×</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-soft italic text-[13px]">No results.</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpandedExpensesDialog({ open, onOpenChange, expenses, onEdit, onDelete, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  expenses: LifeExpenseRow[];
  onEdit: (e: LifeExpenseRow) => void;
  onDelete: (e: LifeExpenseRow) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [payerFilter, setPayerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortCol, setSortCol] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category).filter(Boolean))].sort(), [expenses]);

  const rows = useMemo(() => {
    let r = [...expenses];
    if (search) r = r.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
    if (categoryFilter !== "all") r = r.filter((e) => e.category === categoryFilter);
    if (payerFilter !== "all") r = r.filter((e) => e.payer === payerFilter);
    if (typeFilter !== "all") r = r.filter((e) => e.expense_type === typeFilter);
    r.sort((a, b) => {
      let c = 0;
      if (sortCol === "name") c = a.name.localeCompare(b.name);
      else if (sortCol === "amount") c = Number(a.amount) - Number(b.amount);
      else if (sortCol === "category") c = (a.category ?? "").localeCompare(b.category ?? "");
      else if (sortCol === "payer") c = a.payer.localeCompare(b.payer);
      else c = a.created_at.localeCompare(b.created_at);
      return sortDir === "asc" ? c : -c;
    });
    return r;
  }, [expenses, search, categoryFilter, payerFilter, typeFilter, sortCol, sortDir]);

  const ts = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Recurring <em>expenses</em></DialogTitle>
          <DialogDescription>{expenses.length} total · showing {rows.length}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-[12px] w-40" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={filterSelect}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c!} value={c!}>{c}</option>)}
          </select>
          <select value={payerFilter} onChange={(e) => setPayerFilter(e.target.value)} className={filterSelect}>
            <option value="all">All payers</option>
            <option value="groom">Groom</option>
            <option value="bride">Bride</option>
            <option value="both">Both</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={filterSelect}>
            <option value="all">All types</option>
            <option value="fixed">Fixed</option>
            <option value="credit">Credit</option>
          </select>
          <Button size="sm" className="ml-auto" onClick={onAdd}>+ Add</Button>
        </div>
        <div className="overflow-auto max-h-[55vh] border border-line rounded-[4px]">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-cream-deep/95 backdrop-blur-sm border-b border-line">
              <tr className="text-ink-soft">
                <SortHeader label="Name" col="name" active={sortCol} dir={sortDir} onClick={() => ts("name")} />
                <SortHeader label="Category" col="category" active={sortCol} dir={sortDir} onClick={() => ts("category")} />
                <SortHeader label="Payer" col="payer" active={sortCol} dir={sortDir} onClick={() => ts("payer")} />
                <SortHeader label="Monthly" col="amount" active={sortCol} dir={sortDir} onClick={() => ts("amount")} />
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] font-medium">Period</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-line/50 hover:bg-cream/40 cursor-pointer group" onClick={() => onEdit(e)}>
                  <td className="py-2.5 px-3 font-medium text-ink">
                    {e.name}
                    {e.expense_type === "credit" && <span className="ml-1.5 text-[9px] bg-gold/15 text-gold rounded px-1.5 py-0.5 font-medium">Credit</span>}
                  </td>
                  <td className="py-2.5 px-3 text-ink-soft">{e.category ?? "—"}</td>
                  <td className="py-2.5 px-3 text-ink-soft">{payerLabel(e.payer, e.payer_groom_pct)}</td>
                  <td className="py-2.5 px-3 font-mono text-burgundy">−{formatMoney(e.amount)}</td>
                  <td className="py-2.5 px-3 text-ink-soft text-[11px]">
                    {e.start_month ? monthLabel(e.start_month) : <em>Always</em>}
                    {(e.start_month || e.end_month) && " → "}
                    {e.end_month ? monthLabel(e.end_month) : e.start_month ? <em>Open</em> : ""}
                  </td>
                  <td className="py-2.5 px-3">
                    <button onClick={(ev) => { ev.stopPropagation(); onDelete(e); }} className="opacity-0 group-hover:opacity-100 text-ink-soft hover:text-burgundy text-[16px] transition-opacity">×</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-soft italic text-[13px]">No results.</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpandedPurchasesDialog({ open, onOpenChange, purchases, onEdit, onDelete, onToggleScheduled, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  purchases: LifePurchaseRow[];
  onEdit: (p: LifePurchaseRow) => void;
  onDelete: (p: LifePurchaseRow) => void;
  onToggleScheduled: (p: LifePurchaseRow) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [payerFilter, setPayerFilter] = useState("all");
  const [scheduledFilter, setScheduledFilter] = useState("all");
  const [sortCol, setSortCol] = useState("target_month");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const categories = useMemo(() => [...new Set(purchases.map((p) => p.category).filter(Boolean))].sort(), [purchases]);

  const rows = useMemo(() => {
    let r = [...purchases];
    if (search) r = r.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (categoryFilter !== "all") r = r.filter((p) => p.category === categoryFilter);
    if (payerFilter !== "all") r = r.filter((p) => p.payer === payerFilter);
    if (scheduledFilter === "scheduled") r = r.filter((p) => p.scheduled);
    if (scheduledFilter === "excluded") r = r.filter((p) => !p.scheduled);
    r.sort((a, b) => {
      let c = 0;
      if (sortCol === "name") c = a.name.localeCompare(b.name);
      else if (sortCol === "amount") c = Number(a.amount) - Number(b.amount);
      else if (sortCol === "remaining") c = Math.max(0, Number(a.amount) - Number(a.already_paid ?? 0)) - Math.max(0, Number(b.amount) - Number(b.already_paid ?? 0));
      else if (sortCol === "category") c = (a.category ?? "").localeCompare(b.category ?? "");
      else c = a.target_month.localeCompare(b.target_month);
      return sortDir === "asc" ? c : -c;
    });
    return r;
  }, [purchases, search, categoryFilter, payerFilter, scheduledFilter, sortCol, sortDir]);

  const ts = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80vw] w-[80vw]">
        <DialogHeader>
          <DialogTitle>One-time <em>purchases</em></DialogTitle>
          <DialogDescription>{purchases.length} total · showing {rows.length}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-[12px] w-40" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={filterSelect}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c!} value={c!}>{c}</option>)}
          </select>
          <select value={payerFilter} onChange={(e) => setPayerFilter(e.target.value)} className={filterSelect}>
            <option value="all">All payers</option>
            <option value="groom">Groom</option>
            <option value="bride">Bride</option>
            <option value="both">Both</option>
          </select>
          <select value={scheduledFilter} onChange={(e) => setScheduledFilter(e.target.value)} className={filterSelect}>
            <option value="all">All</option>
            <option value="scheduled">Scheduled only</option>
            <option value="excluded">Excluded only</option>
          </select>
          <Button size="sm" className="ml-auto" onClick={onAdd}>+ Add</Button>
        </div>
        <div className="overflow-auto max-h-[55vh] border border-line rounded-[4px]">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-cream-deep/95 backdrop-blur-sm border-b border-line">
              <tr className="text-ink-soft">
                <th className="w-10 py-2.5 px-3" />
                <SortHeader label="Name" col="name" active={sortCol} dir={sortDir} onClick={() => ts("name")} />
                <SortHeader label="Category" col="category" active={sortCol} dir={sortDir} onClick={() => ts("category")} />
                <SortHeader label="Month" col="target_month" active={sortCol} dir={sortDir} onClick={() => ts("target_month")} />
                <SortHeader label="Total" col="amount" active={sortCol} dir={sortDir} onClick={() => ts("amount")} />
                <SortHeader label="Remaining" col="remaining" active={sortCol} dir={sortDir} onClick={() => ts("remaining")} />
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.15em] font-medium">Payer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const remaining = Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0));
                return (
                  <tr key={p.id} className={`border-t border-line/50 hover:bg-cream/40 cursor-pointer group ${!p.scheduled ? "opacity-50" : ""}`} onClick={() => onEdit(p)}>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggleScheduled(p); }}
                        className={`w-3.5 h-3.5 rounded-sm border transition-colors ${p.scheduled ? "bg-gold border-gold" : "bg-transparent border-line"}`}
                        title={p.scheduled ? "Exclude from projection" : "Include in projection"}
                      />
                    </td>
                    <td className="py-2.5 px-3 font-medium text-ink">{p.name}</td>
                    <td className="py-2.5 px-3 text-ink-soft">{p.category ?? "—"}</td>
                    <td className="py-2.5 px-3 font-mono text-ink-soft">{monthLabel(p.target_month)}</td>
                    <td className="py-2.5 px-3 font-mono text-ink">{formatMoney(p.amount)}</td>
                    <td className={`py-2.5 px-3 font-mono ${remaining === 0 ? "text-sage" : "text-burgundy"}`}>
                      {remaining === 0 ? "Paid ✓" : `−${formatMoney(remaining)}`}
                    </td>
                    <td className="py-2.5 px-3 text-ink-soft">{payerLabel(p.payer, p.payer_groom_pct)}</td>
                    <td className="py-2.5 px-3">
                      <button onClick={(e) => { e.stopPropagation(); onDelete(p); }} className="opacity-0 group-hover:opacity-100 text-ink-soft hover:text-burgundy text-[16px] transition-opacity">×</button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-ink-soft italic text-[13px]">No results.</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Savings pots — three-column visual breakdown
// ============================================================================

function SavingsPots({
  savings,
  onEdit,
  onDelete,
}: {
  savings: WeddingSavingsRow[];
  onEdit: (s: WeddingSavingsRow) => void;
  onDelete: (s: WeddingSavingsRow) => void;
}) {
  const pots = useMemo(() => {
    const groomEntries = savings.filter((s) => s.contributor === "groom");
    const brideEntries = savings.filter((s) => s.contributor === "bride");
    const commonEntries = savings.filter((s) => s.contributor === "both");

    const groomTotal = groomEntries.reduce((a, s) => a + s.amount, 0);
    const brideTotal = brideEntries.reduce((a, s) => a + s.amount, 0);
    const commonTotal = commonEntries.reduce((a, s) => a + s.amount, 0);

    const transferredFromGroom = commonEntries
      .filter((s) => s.source?.startsWith("Transfer from Groom"))
      .reduce((a, s) => a + s.amount, 0);
    const transferredFromBride = commonEntries
      .filter((s) => s.source?.startsWith("Transfer from Bride"))
      .reduce((a, s) => a + s.amount, 0);

    const lastGroom = [...groomEntries].sort((a, b) => b.saved_on.localeCompare(a.saved_on))[0];
    const lastBride = [...brideEntries].sort((a, b) => b.saved_on.localeCompare(a.saved_on))[0];
    const lastCommon = [...commonEntries].sort((a, b) => b.saved_on.localeCompare(a.saved_on))[0];

    return { groomTotal, brideTotal, commonTotal, transferredFromGroom, transferredFromBride, lastGroom, lastBride, lastCommon };
  }, [savings]);

  const grandTotal = pots.groomTotal + pots.brideTotal + pots.commonTotal;

  const recentAll = useMemo(
    () => [...savings].sort((a, b) => b.saved_on.localeCompare(a.saved_on)).slice(0, 5),
    [savings]
  );

  if (savings.length === 0) {
    return (
      <div className="bg-paper border border-dashed border-line rounded-[4px] p-10 text-center text-ink-soft italic text-[14px]">
        No savings logged yet — click <strong>+ Log savings</strong> to start tracking.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Three pots */}
      <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
        {/* Groom */}
        <div className="bg-paper border border-line border-l-[3px] border-l-sage rounded-[4px] p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.3em] font-medium text-sage">Groom</div>
            <div className="text-[10px] text-ink-soft">{pots.lastGroom ? formatDate(pots.lastGroom.saved_on) : "—"}</div>
          </div>
          <div className="font-serif text-[32px] leading-none text-ink"><em>{formatMoney(pots.groomTotal)}</em></div>
          {grandTotal > 0 && (
            <div className="h-1.5 bg-cream-deep rounded-full overflow-hidden">
              <div className="h-full bg-sage rounded-full" style={{ width: `${Math.min(100, (pots.groomTotal / grandTotal) * 100)}%` }} />
            </div>
          )}
          <div className="space-y-1 text-[12px] text-ink-soft">
            <div>{pots.lastGroom?.source ?? "—"}</div>
            {pots.transferredFromGroom > 0 && (
              <div className="flex items-center gap-1 text-gold">
                <span>⇄</span><span>{formatMoney(pots.transferredFromGroom)} transferred to common</span>
              </div>
            )}
          </div>
        </div>

        {/* Bride */}
        <div className="bg-paper border border-line border-l-[3px] border-l-rose rounded-[4px] p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.3em] font-medium text-rose">Bride</div>
            <div className="text-[10px] text-ink-soft">{pots.lastBride ? formatDate(pots.lastBride.saved_on) : "—"}</div>
          </div>
          <div className="font-serif text-[32px] leading-none text-ink"><em>{formatMoney(pots.brideTotal)}</em></div>
          {grandTotal > 0 && (
            <div className="h-1.5 bg-cream-deep rounded-full overflow-hidden">
              <div className="h-full bg-rose rounded-full" style={{ width: `${Math.min(100, (pots.brideTotal / grandTotal) * 100)}%` }} />
            </div>
          )}
          <div className="space-y-1 text-[12px] text-ink-soft">
            <div>{pots.lastBride?.source ?? "—"}</div>
            {pots.transferredFromBride > 0 && (
              <div className="flex items-center gap-1 text-gold">
                <span>⇄</span><span>{formatMoney(pots.transferredFromBride)} transferred to common</span>
              </div>
            )}
          </div>
        </div>

        {/* Common fund */}
        <div className="bg-paper border border-line border-l-[3px] border-l-gold rounded-[4px] p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.3em] font-medium text-gold">Common fund</div>
            <div className="text-[10px] text-ink-soft">{pots.lastCommon ? formatDate(pots.lastCommon.saved_on) : "—"}</div>
          </div>
          <div className="font-serif text-[32px] leading-none text-ink"><em>{formatMoney(pots.commonTotal)}</em></div>
          {grandTotal > 0 && (
            <div className="h-1.5 bg-cream-deep rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min(100, (pots.commonTotal / grandTotal) * 100)}%` }} />
            </div>
          )}
          <div className="space-y-1 text-[12px] text-ink-soft">
            {pots.transferredFromGroom > 0 && <div>From groom: {formatMoney(pots.transferredFromGroom)}</div>}
            {pots.transferredFromBride > 0 && <div>From bride: {formatMoney(pots.transferredFromBride)}</div>}
            {pots.transferredFromGroom === 0 && pots.transferredFromBride === 0 && <div>{pots.lastCommon?.source ?? "—"}</div>}
          </div>
        </div>
      </div>

      {/* Recent entries */}
      <div className="bg-paper border border-line rounded-[4px] shadow-soft overflow-hidden">
        <div className="px-6 py-3 border-b border-line bg-cream/40 text-[11px] uppercase tracking-[0.2em] text-ink-soft font-medium">
          Recent entries
        </div>
        <div className="divide-y divide-line">
          {recentAll.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-4 px-6 py-3.5 hover:bg-cream/30 transition-colors cursor-pointer"
              onClick={() => onEdit(s)}
            >
              <div className="text-[18px]">{s.contributor === "groom" ? "👨" : s.contributor === "bride" ? "👰" : "💑"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink text-[13px] truncate">{s.source ?? "Savings"}</div>
                <div className="text-[11px] text-ink-soft">{formatDate(s.saved_on)}{s.notes && ` · ${s.notes}`}</div>
              </div>
              <span className={`text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border shrink-0 ${
                s.contributor === "groom" ? "border-sage/50 text-sage bg-sage/10" :
                s.contributor === "bride" ? "border-rose/50 text-rose bg-rose/10" :
                "border-gold/50 text-gold bg-gold/10"
              }`}>
                {s.contributor === "both" ? "Common" : s.contributor}
              </span>
              <div className="font-mono text-[13px] text-sage font-medium">+{formatMoney(s.amount)}</div>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-soft hover:text-burgundy"
                onClick={(e) => { e.stopPropagation(); onDelete(s); }}
              >×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SavingsDialog — log / edit a savings entry
// ============================================================================

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
  const NO_SOURCE = "__none__";

  const CONTRIBUTOR_OPTIONS = [
    { value: "groom", label: "Groom" },
    { value: "bride", label: "Bride" },
    { value: "both", label: "Common fund" },
  ];

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
              <Label htmlFor="s-amount">Amount (€)</Label>
              <Input id="s-amount" name="amount" type="number" min="0" step="1" defaultValue={editing?.amount ?? ""} placeholder="500" required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="s-date">Date</Label>
              <Input id="s-date" name="saved_on" type="date" defaultValue={editing?.saved_on ?? todayIso} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Source</Label>
              <SelectField
                name="source"
                defaultValue={editing?.source ?? SAVINGS_SOURCES[0]}
                options={[...SAVINGS_SOURCES.map((s) => ({ value: s, label: s })), { value: NO_SOURCE, label: "— None —" }]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Saved by</Label>
              <SelectField
                name="contributor"
                defaultValue={editing?.contributor ?? "groom"}
                options={CONTRIBUTOR_OPTIONS}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="s-notes">Notes (optional)</Label>
            <Input id="s-notes" name="notes" defaultValue={editing?.notes ?? ""} placeholder="Monthly salary transfer…" />
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

// ============================================================================
// TransferDialog — move from personal to common fund
// ============================================================================

function TransferDialog({
  open, onOpenChange, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (row: WeddingSavingsRow) => void;
}) {
  const [from, setFrom] = useState<"groom" | "bride">("groom");
  const todayIso = new Date().toISOString().slice(0, 10);
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: WeddingSavingsRow } | null,
    FormData
  >(createSavingEntry, null);

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
          <DialogTitle>Transfer to <em>Common fund</em></DialogTitle>
          <DialogDescription>Move personal savings to the shared wedding fund.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <input type="hidden" name="contributor" value="both" />
          <input type="hidden" name="source" value={`Transfer from ${from === "groom" ? "Groom" : "Bride"}`} />

          <div className="flex flex-col gap-2">
            <Label>Transfer from</Label>
            <div className="flex gap-2">
              {(["groom", "bride"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFrom(p)}
                  className={`flex-1 py-2.5 rounded-[4px] text-[13px] border transition-all ${
                    from === p
                      ? p === "groom" ? "bg-sage/10 border-sage text-sage font-medium" : "bg-rose/10 border-rose text-rose font-medium"
                      : "border-line text-ink-soft hover:border-ink-soft"
                  }`}
                >
                  {p === "groom" ? "👨 Groom" : "👰 Bride"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tr-amount">Amount (€)</Label>
              <Input id="tr-amount" name="amount" type="number" min="0" step="1" placeholder="5000" required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tr-date">Date</Label>
              <Input id="tr-date" name="saved_on" type="date" defaultValue={todayIso} required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tr-notes">Notes (optional)</Label>
            <Input id="tr-notes" name="notes" placeholder="e.g. After the wedding ceremony…" />
          </div>

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Transferring…" : "Transfer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ExpandedSavingsDialog — full list with search + filters
// ============================================================================

function ExpandedSavingsDialog({
  open, onOpenChange, savings, onEdit, onDelete, onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  savings: WeddingSavingsRow[];
  onEdit: (s: WeddingSavingsRow) => void;
  onDelete: (s: WeddingSavingsRow) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useState("");
  const [contributorFilter, setContributorFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: "date" | "amount") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows = useMemo(() => {
    let out = [...savings];
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((s) => (s.source ?? "").toLowerCase().includes(q) || (s.notes ?? "").toLowerCase().includes(q));
    }
    if (contributorFilter !== "all") out = out.filter((s) => s.contributor === contributorFilter);
    out.sort((a, b) => {
      const cmp = sortKey === "date" ? a.saved_on.localeCompare(b.saved_on) : a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [savings, search, contributorFilter, sortKey, sortDir]);

  const fs = "h-8 text-[12px] rounded border border-line bg-paper px-2 text-ink focus:outline-none";

  function SortTh({ col, label }: { col: "date" | "amount"; label: string }) {
    const active = sortKey === col;
    return (
      <th className="cursor-pointer select-none hover:text-ink transition-colors" onClick={() => toggleSort(col)}>
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </th>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80vw] w-[80vw]">
        <DialogHeader>
          <DialogTitle>All <em>savings</em></DialogTitle>
          <DialogDescription>{savings.length} total · showing {rows.length}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-[12px] w-40" />
          <select value={contributorFilter} onChange={(e) => setContributorFilter(e.target.value)} className={fs}>
            <option value="all">All contributors</option>
            <option value="groom">Groom</option>
            <option value="bride">Bride</option>
            <option value="both">Common fund</option>
          </select>
          <Button size="sm" onClick={onAdd} className="ml-auto text-[12px]">+ Log savings</Button>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="budget-table w-full">
            <thead>
              <tr>
                <th>Source</th>
                <th>Contributor</th>
                <SortTh col="date" label="Date" />
                <SortTh col="amount" label="Amount" />
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-cream/30 transition-colors" onClick={() => { onEdit(s); onOpenChange(false); }}>
                  <td className="font-medium">{s.source ?? "—"}</td>
                  <td>
                    <span className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${
                      s.contributor === "groom" ? "border-sage/50 text-sage bg-sage/10" :
                      s.contributor === "bride" ? "border-rose/50 text-rose bg-rose/10" :
                      "border-gold/50 text-gold bg-gold/10"
                    }`}>
                      {s.contributor === "both" ? "Common" : s.contributor}
                    </span>
                  </td>
                  <td className="text-ink-soft">{formatDate(s.saved_on)}</td>
                  <td className="num font-mono text-sage">+{formatMoney(s.amount)}</td>
                  <td className="text-ink-soft italic text-[12px]">{s.notes ?? "—"}</td>
                  <td>
                    <button type="button" className="text-ink-soft hover:text-burgundy text-[18px] transition-colors"
                      onClick={(e) => { e.stopPropagation(); onDelete(s); }} aria-label="Delete">×</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-ink-soft italic py-8">No entries match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Settings dialog
// ============================================================================

function SettingsDialog({
  open, onOpenChange, settings, weddingCashOnHand, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: LifeSettingsRow;
  weddingCashOnHand: number;
  onSaved: (s: LifeSettingsRow) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StartingCashMode>(settings.starting_cash_mode);

  async function handleSubmit(e: { preventDefault: () => void; currentTarget: HTMLFormElement }) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await updateSettings(fd);
    setPending(false);
    if ("error" in res && res.error) { setError(res.error); return; }
    if ("data" in res && res.data) { onSaved(res.data); onOpenChange(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Projection <em>settings</em></DialogTitle>
          <DialogDescription>How the cashflow is computed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Start month</Label>
              <MonthSelect name="start_month" defaultValue={settings.start_month} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="horizon_months">Horizon (months)</Label>
              <Input id="horizon_months" name="horizon_months" type="number" min="6" max="60" step="1" defaultValue={settings.horizon_months} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Starting cash</Label>
            <input type="hidden" name="starting_cash_mode" value={mode} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("from_wedding")}
                className={`flex-1 px-3 py-2 rounded-[4px] text-[12px] border transition-colors ${
                  mode === "from_wedding" ? "bg-ink text-cream border-ink" : "bg-paper text-ink border-line hover:bg-cream"
                }`}
              >
                From wedding · {formatMoney(weddingCashOnHand)}
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 px-3 py-2 rounded-[4px] text-[12px] border transition-colors ${
                  mode === "manual" ? "bg-ink text-cream border-ink" : "bg-paper text-ink border-line hover:bg-cream"
                }`}
              >
                Manual amount
              </button>
            </div>
            <p className="text-[11px] text-ink-soft italic">
              {mode === "from_wedding"
                ? "Uses your wedding savings minus what's already paid."
                : "Use the amount below as the projection's starting balance."}
            </p>
            <Input
              id="starting_cash_manual"
              name="starting_cash_manual"
              type="number"
              min="0"
              step="100"
              defaultValue={settings.starting_cash_manual ?? 0}
              disabled={mode === "from_wedding"}
            />
          </div>
          {error && <p className="text-sm text-burgundy">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
