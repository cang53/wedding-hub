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
} from "@/types/db";
import { formatMoney } from "@/lib/utils";
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

// ============================================================================
// Constants
// ============================================================================

const EXPENSE_CATEGORIES = [
  "Rent", "Mortgage", "Credit", "Utilities", "Internet", "Phone",
  "Insurance", "Food", "Transport", "Subscriptions", "Other",
];

const PURCHASE_CATEGORIES = [
  "Furniture", "Appliances", "Electronics", "Deposit", "Renovation",
  "Decor", "Vehicle", "Other",
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
  weddingCashOnHand: number;
}

export function LifeBudgetClient({
  initialIncome,
  initialExpenses,
  initialPurchases,
  initialSettings,
  weddingCashOnHand,
}: Props) {
  const [income, setIncome] = useState<LifeIncomeRow[]>(initialIncome);
  const [expenses, setExpenses] = useState<LifeExpenseRow[]>(initialExpenses);
  const [purchases, setPurchases] = useState<LifePurchaseRow[]>(initialPurchases);
  const [settings, setSettings] = useState<LifeSettingsRow>(initialSettings);

  const [incomeDialog, setIncomeDialog] = useState<{ open: boolean; editing: LifeIncomeRow | null }>({ open: false, editing: null });
  const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; editing: LifeExpenseRow | null }>({ open: false, editing: null });
  const [purchaseDialog, setPurchaseDialog] = useState<{ open: boolean; editing: LifePurchaseRow | null }>({ open: false, editing: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<"joint" | "groom" | "bride">("joint");

  const [, startTransition] = useTransition();

  // Starting cash resolves from settings + (optionally) the wedding cash on hand.
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
        .reduce((a, p) => a + Number(p.amount), 0);

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
          onAdd={() => setIncomeDialog({ open: true, editing: null })}
          items={income.map((i) => ({
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
          onAdd={() => setExpenseDialog({ open: true, editing: null })}
          items={expenses.map((e) => ({
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
          onAdd={() => setPurchaseDialog({ open: true, editing: null })}
          items={purchases.map((p) => ({
            id: p.id,
            primary: p.name,
            secondary: `${p.category ?? "—"} · ${monthLabel(p.target_month)} · ${payerLabel(p.payer, p.payer_groom_pct)}`,
            value: `−${formatMoney(p.amount)}`,
            valueClass: p.scheduled ? "text-burgundy" : "text-ink-soft line-through",
            onClick: () => setPurchaseDialog({ open: true, editing: p }),
            onDelete: () => handleDeletePurchase(p),
            onToggle: () => handleToggleScheduled(p),
            toggled: p.scheduled,
          }))}
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
      .reduce((a, p) => a + Number(p.amount), 0);
    const sharedPurch = purchases
      .filter((p) => p.scheduled && p.target_month === m && p.payer === "both")
      .reduce((a, p) => a + Number(p.amount) * personShare(p.payer, p.payer_groom_pct, person), 0);
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
        .reduce((a, p) => a + Number(p.amount) * personShare(p.payer, p.payer_groom_pct, person), 0);
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
                        {!p.scheduled && " · excluded"}
                      </div>
                    </div>
                    <div className={`font-mono text-[12px] shrink-0 ${p.scheduled ? "text-gold" : "text-ink-soft line-through"}`}>
                      −{formatMoney(Number(p.amount) * share)}
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
      .reduce((a, p) => a + Number(p.amount) * personShare(p.payer, p.payer_groom_pct, person), 0);
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
  title, emoji, accent, empty, items, onAdd,
}: {
  title: string;
  emoji: string;
  accent: "sage" | "burgundy" | "gold";
  empty: string;
  items: SectionItem[];
  onAdd: () => void;
}) {
  const accentBorder = accent === "sage" ? "border-l-sage" : accent === "burgundy" ? "border-l-burgundy" : "border-l-gold";

  return (
    <div className={`bg-paper border border-line border-l-[3px] ${accentBorder} rounded-[4px] shadow-soft flex flex-col`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{emoji}</span>
          <span className="text-[11px] uppercase tracking-[0.3em] text-ink-soft font-medium">{title}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onAdd}>+ Add</Button>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] italic text-ink-soft mb-4">{empty}</p>
          <Button onClick={onAdd}>+ Add first</Button>
        </div>
      ) : (
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
  useEffect(() => { setPayer(editing?.payer ?? "both"); }, [editing]);

  useEffect(() => {
    if (state?.ok && state?.data) { onSaved(state.data); onOpenChange(false); }
  }, [state, onSaved, onOpenChange]);

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
              <Label htmlFor="amount">Amount (€)</Label>
              <Input id="amount" name="amount" type="number" min="0" step="1" defaultValue={editing?.amount ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <SelectField
                name="category"
                defaultValue={editing?.category ?? "Furniture"}
                options={PURCHASE_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
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
