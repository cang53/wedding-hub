"use client";

import { Fragment, useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type {
  LifeIncomeRow,
  LifeExpenseRow,
  LifePurchaseRow,
  LifePurchaseOptionRow,
  LifeSettingsRow,
  LifePerson,
  ExpensePayer,
  StartingCashMode,
  ExpenseType,
  WeddingSavingsRow,
  ExpenseBreakdownItem,
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
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { Segmented } from "@/components/ui/segmented";
import { usePageHeader } from "@/components/shell/header-context";
import {
  createIncome, updateIncome, deleteIncome,
  createExpense, updateExpense, deleteExpense,
  createPurchase, updatePurchase, deletePurchase, togglePurchaseScheduled,
  updateSettings, assignDayOfMonth,
} from "./actions";
import { createSavingEntry, updateSavingEntry, deleteSavingEntry } from "./savings-actions";

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

// Expense payer adds "Gift" and "Free" — covered externally, so €0 to the couple.
const EXPENSE_PAYER_OPTIONS: { value: ExpensePayer; label: string }[] = [
  ...PERSON_OPTIONS,
  { value: "gift", label: "🎁 Gift" },
  { value: "free", label: "Free" },
];

/** True when an expense is covered externally (gift / free) and therefore
 *  doesn't cost the couple anything. */
function isExternalPayer(payer: ExpensePayer): boolean {
  return payer === "gift" || payer === "free";
}

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

function personShare(payer: ExpensePayer, groomPct: number | null, side: "groom" | "bride"): number {
  if (payer === side) return 1;
  if (payer === "both") {
    const g = (groomPct ?? 50) / 100;
    return side === "groom" ? g : 1 - g;
  }
  return 0;
}

/** Same projection math as the household one, scoped to one person's share of joint items. */
function personProjectionFor(
  person: "groom" | "bride",
  income: LifeIncomeRow[],
  expenses: LifeExpenseRow[],
  purchases: LifePurchaseRow[],
  settings: LifeSettingsRow,
  personStartingCash: number
): PersonPoint[] {
  const months = monthsList(settings.start_month, settings.horizon_months);
  let cumulative = personStartingCash;
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
}

/** Did this month have a scheduled, non-external purchase relevant to `person` (or anyone, if omitted)? */
function monthHasPurchase(purchases: LifePurchaseRow[], month: string, person?: "groom" | "bride"): boolean {
  return purchases.some((p) => {
    if (!p.scheduled || p.target_month !== month || isExternalPayer(p.payer)) return false;
    return person ? personShare(p.payer, p.payer_groom_pct, person) > 0 : true;
  });
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
  initialPurchaseOptions: LifePurchaseOptionRow[];
  initialSettings: LifeSettingsRow;
  initialSavings: WeddingSavingsRow[];
}

export function LifeBudgetClient({
  initialIncome,
  initialExpenses,
  initialPurchases,
  initialPurchaseOptions,
  initialSettings,
  initialSavings,
}: Props) {
  const [income, setIncome] = useState<LifeIncomeRow[]>(initialIncome);
  const [expenses, setExpenses] = useState<LifeExpenseRow[]>(initialExpenses);
  const [purchases, setPurchases] = useState<LifePurchaseRow[]>(initialPurchases);
  const [purchaseOptions, setPurchaseOptions] = useState<LifePurchaseOptionRow[]>(initialPurchaseOptions);
  const [settings, setSettings] = useState<LifeSettingsRow>(initialSettings);
  const [savings, setSavings] = useState<WeddingSavingsRow[]>(initialSavings);

  const [incomeDialog, setIncomeDialog] = useState<{ open: boolean; editing: LifeIncomeRow | null }>({ open: false, editing: null });
  const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; editing: LifeExpenseRow | null }>({ open: false, editing: null });
  const [purchaseDialog, setPurchaseDialog] = useState<{ open: boolean; editing: LifePurchaseRow | null }>({ open: false, editing: null });
  const [savingsDialog, setSavingsDialog] = useState<{ open: boolean; editing: WeddingSavingsRow | null }>({ open: false, editing: null });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [expandedSavingsOpen, setExpandedSavingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<LifeView>("joint");
  const [expandedSection, setExpandedSection] = useState<"income" | "expense" | "purchase" | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; onConfirm: () => void }>({ open: false, title: "", onConfirm: () => {} });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // Starting cash: total of the wedding savings ledger.
  const weddingCashOnHand = useMemo(
    () => savings.reduce((a, s) => a + Number(s.amount), 0),
    [savings]
  );

  // Starting cash resolves from settings + (optionally) the reactive wedding cash on hand.
  const startingCash = settings.starting_cash_mode === "from_wedding"
    ? weddingCashOnHand
    : Number(settings.starting_cash_manual ?? 0);

  // Per-person starting cash: personal savings + 50% of the common fund.
  // This always uses actual logged savings regardless of starting_cash_mode
  // (that mode only affects the joint household projection, not individual positions).
  const perPersonStartingCash = useMemo(() => {
    const groomSaved = savings.filter((s) => s.contributor === "groom").reduce((a, s) => a + Number(s.amount), 0);
    const brideSaved = savings.filter((s) => s.contributor === "bride").reduce((a, s) => a + Number(s.amount), 0);
    const commonSaved = savings.filter((s) => s.contributor === "both").reduce((a, s) => a + Number(s.amount), 0);
    const halfCommon = commonSaved * 0.5;
    return {
      groom: groomSaved + halfCommon,
      bride: brideSaved + halfCommon,
      groomSaved,
      brideSaved,
      commonSaved,
    };
  }, [savings]);

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
        .reduce((a, e) => a + (isExternalPayer(e.payer) ? 0 : Number(e.amount)), 0);

      const monthPurchases = purchases
        .filter((p) => p.scheduled && p.target_month === month && !isExternalPayer(p.payer))
        .reduce((a, p) => a + Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)), 0);

      const totalOut = monthFixed + monthPurchases;
      const net = monthIncome - totalOut;
      cumulative += net;

      return { month, income: monthIncome, fixed: monthFixed, purchases: monthPurchases, net, cumulative };
    });

    return series;
  }, [income, expenses, purchases, settings, startingCash]);

  // ---- Action handlers ----------------------------------------------------
  const handleDeleteIncome = (item: LifeIncomeRow) => {
    setErrorBanner(null);
    setConfirmState({
      open: true,
      title: `Delete "${item.name}"?`,
      onConfirm: () => {
        const prev = income;
        setIncome((p) => p.filter((i) => i.id !== item.id));
        setConfirmState((s) => ({ ...s, open: false }));
        startTransition(async () => {
          const res = await deleteIncome(item.id);
          if (res?.error) { setIncome(prev); setErrorBanner(res.error); }
        });
      },
    });
  };
  const handleDeleteExpense = (item: LifeExpenseRow) => {
    setErrorBanner(null);
    setConfirmState({
      open: true,
      title: `Delete "${item.name}"?`,
      onConfirm: () => {
        const prev = expenses;
        setExpenses((p) => p.filter((i) => i.id !== item.id));
        setConfirmState((s) => ({ ...s, open: false }));
        startTransition(async () => {
          const res = await deleteExpense(item.id);
          if (res?.error) { setExpenses(prev); setErrorBanner(res.error); }
        });
      },
    });
  };
  const handleDeletePurchase = (item: LifePurchaseRow) => {
    setErrorBanner(null);
    setConfirmState({
      open: true,
      title: `Delete "${item.name}"?`,
      onConfirm: () => {
        const prev = purchases;
        setPurchases((p) => p.filter((i) => i.id !== item.id));
        setConfirmState((s) => ({ ...s, open: false }));
        startTransition(async () => {
          const res = await deletePurchase(item.id);
          if (res?.error) { setPurchases(prev); setErrorBanner(res.error); }
        });
      },
    });
  };
  const handleToggleScheduled = (item: LifePurchaseRow) => {
    const next = !item.scheduled;
    setPurchases((prev) => prev.map((p) => (p.id === item.id ? { ...p, scheduled: next } : p)));
    startTransition(() => { togglePurchaseScheduled(item.id, next); });
  };
  const handleDeleteSaving = (item: WeddingSavingsRow) => {
    setErrorBanner(null);
    setConfirmState({
      open: true,
      title: `Delete savings entry of ${formatMoney(item.amount)}?`,
      onConfirm: () => {
        const prev = savings;
        setSavings((p) => p.filter((i) => i.id !== item.id));
        setConfirmState((s) => ({ ...s, open: false }));
        startTransition(async () => {
          await deleteSavingEntry(item.id);
        });
      },
    });
  };

  // ---- Assign day of month (calendar drag-and-drop) -----------------------
  const handleAssignDay = (type: "income" | "expense" | "purchase", id: string, day: number | null) => {
    if (type === "income") setIncome((prev) => prev.map((i) => i.id === id ? { ...i, day_of_month: day } : i));
    else if (type === "expense") setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, day_of_month: day } : e));
    else setPurchases((prev) => prev.map((p) => p.id === id ? { ...p, day_of_month: day } : p));
    startTransition(() => {
      const table = type === "income" ? "life_income" : type === "expense" ? "life_expenses" : "life_purchases";
      assignDayOfMonth(table, id, day);
    });
  };


  // Group purchase options by purchase for compact list display.
  const optionsByPurchase = useMemo(() => {
    const m = new Map<string, LifePurchaseOptionRow[]>();
    purchaseOptions.forEach((o) => {
      const arr = m.get(o.purchase_id) ?? [];
      arr.push(o);
      m.set(o.purchase_id, arr);
    });
    return m;
  }, [purchaseOptions]);

  /** Short "· 3 options: Dyson V11" suffix for a purchase that has options. */
  const optionsSuffix = (p: LifePurchaseRow): string => {
    const opts = optionsByPurchase.get(p.id);
    if (!opts || opts.length === 0) return "";
    const chosen = opts.find((o) => o.id === p.selected_option_id);
    return ` · ${opts.length} option${opts.length > 1 ? "s" : ""}${chosen ? `: ${chosen.label}` : ""}`;
  };


  // ---- Per-person projections & per-view derived data ---------------------
  const groomProjection = useMemo(
    () => personProjectionFor("groom", income, expenses, purchases, settings, perPersonStartingCash.groom),
    [income, expenses, purchases, settings, perPersonStartingCash.groom]
  );
  const brideProjection = useMemo(
    () => personProjectionFor("bride", income, expenses, purchases, settings, perPersonStartingCash.bride),
    [income, expenses, purchases, settings, perPersonStartingCash.bride]
  );

  const activeProjection = view === "groom" ? groomProjection : view === "bride" ? brideProjection : null;
  const heroIn = activeProjection ? (activeProjection[0]?.totalIn ?? 0) : (projection[0]?.income ?? 0);
  const heroOut = activeProjection
    ? (activeProjection[0]?.totalOut ?? 0)
    : (projection[0]?.fixed ?? 0) + (projection[0]?.purchases ?? 0);
  const heroNet = heroIn - heroOut;

  const barSeries = (activeProjection ?? projection).slice(0, 12).map((p) => ({
    month: p.month,
    cumulative: p.cumulative,
    hasPurchase: monthHasPurchase(purchases, p.month, view === "joint" ? undefined : (view as "groom" | "bride")),
  }));
  const cashRangeLabel = barSeries.length > 0
    ? `${monthLabel(barSeries[0].month)} to ${monthLabel(barSeries[barSeries.length - 1].month)}`
    : "";

  const incomeRows = view === "joint" ? income : income.filter((i) => i.person === view || i.person === "both");
  const expenseRows = view === "joint"
    ? expenses
    : expenses.filter((e) => personShare(e.payer, e.payer_groom_pct, view as "groom" | "bride") > 0);
  const purchaseRows = view === "joint"
    ? purchases
    : purchases.filter((p) => personShare(p.payer, p.payer_groom_pct, view as "groom" | "bride") > 0);

  const incomeAmount = (i: LifeIncomeRow) =>
    view === "joint" ? Number(i.amount) : Number(i.amount) * (i.person === view ? 1 : 0.5);
  const expenseAmount = (e: LifeExpenseRow) =>
    view === "joint" ? Number(e.amount) : Number(e.amount) * personShare(e.payer, e.payer_groom_pct, view as "groom" | "bride");
  const purchaseAmount = (p: LifePurchaseRow) => {
    const remaining = Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0));
    return view === "joint" ? remaining : remaining * personShare(p.payer, p.payer_groom_pct, view as "groom" | "bride");
  };

  usePageHeader("Add line", () => setExpenseDialog({ open: true, editing: null }));

  // ---- Render -------------------------------------------------------------
  return (
    <section className="font-apple flex flex-col gap-7 text-[var(--fg)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={[
            { value: "joint", label: "Household" },
            { value: "groom", label: "Celal" },
            { value: "bride", label: "Selver" },
            { value: "calendar", label: "Calendar" },
          ]}
          value={view}
          onChange={setView}
        />
        <button type="button" onClick={() => setSettingsOpen(true)} className="text-[15px] text-[var(--accent)] hover:opacity-60">
          Settings
        </button>
      </div>

      {errorBanner && (
        <div className="flex items-center justify-between rounded-[12px] bg-[var(--fill)] px-[18px] py-3 text-[13px] text-[var(--accent)]">
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)} className="ml-4 text-[16px] leading-none opacity-70 hover:opacity-100">×</button>
        </div>
      )}

      {view === "calendar" ? (
        <CalendarView
          income={income}
          expenses={expenses}
          purchases={purchases}
          settings={settings}
          startingCash={weddingCashOnHand}
          groomStartingCash={perPersonStartingCash.groom}
          brideStartingCash={perPersonStartingCash.bride}
          projection={projection}
          onAssignDay={handleAssignDay}
        />
      ) : (
        <>
          <div className="px-1 py-0.5">
            <div className="text-[clamp(38px,6vw,54px)] leading-none font-bold tracking-[-0.04em] tabular-nums">
              {formatMoney(heroNet)} left over
            </div>
            <div className="mt-3 text-[16px] tracking-[-0.012em] text-[var(--fg2)]">
              {formatMoney(heroIn)} in · {formatMoney(heroOut)} out, every month
            </div>
          </div>

          <ListGroup label={`Projected cash · ${cashRangeLabel}`}>
            <div className="px-[18px] pt-5 pb-[18px]">
              <CashBars series={barSeries} />
            </div>
          </ListGroup>

          <ListGroup
            label={
              <div className="flex items-center justify-between">
                <span>Income each month</span>
                <button
                  type="button"
                  onClick={() => setIncomeDialog({ open: true, editing: null })}
                  className="text-[var(--accent)] hover:opacity-60"
                >
                  + Add
                </button>
              </div>
            }
          >
            {incomeRows.length === 0 ? (
              <ListRow><span className="text-[15px] text-[var(--fg2)]">No income yet.</span></ListRow>
            ) : (
              incomeRows.map((i) => (
                <ListRow key={i.id} as="button" interactive onClick={() => setIncomeDialog({ open: true, editing: i })}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] tracking-[-0.014em]">{i.name}</div>
                    <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                      {personLabel(i.person)}
                      {i.start_month ? ` · from ${monthLabel(i.start_month)}` : ""}
                      {i.end_month ? ` · until ${monthLabel(i.end_month)}` : ""}
                    </div>
                  </div>
                  <span className="ml-auto text-[17px] tabular-nums whitespace-nowrap">{formatMoney(incomeAmount(i))}/mo</span>
                </ListRow>
              ))
            )}
          </ListGroup>

          <ListGroup
            label={
              <div className="flex items-center justify-between">
                <span>Costs each month</span>
                <button
                  type="button"
                  onClick={() => setExpenseDialog({ open: true, editing: null })}
                  className="text-[var(--accent)] hover:opacity-60"
                >
                  + Add
                </button>
              </div>
            }
          >
            {expenseRows.length === 0 ? (
              <ListRow><span className="text-[15px] text-[var(--fg2)]">No recurring costs yet.</span></ListRow>
            ) : (
              expenseRows.map((e) => (
                <ListRow key={e.id} as="button" interactive onClick={() => setExpenseDialog({ open: true, editing: e })}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] tracking-[-0.014em]">{e.name}</div>
                    <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                      {e.expense_type === "credit"
                        ? `Credit · ${e.credit_months}mo${e.credit_interest_rate ? ` @ ${e.credit_interest_rate}%` : ""} · ${payerLabel(e.payer, e.payer_groom_pct)}`
                        : `${e.category ?? "—"} · ${payerLabel(e.payer, e.payer_groom_pct)}`}
                    </div>
                  </div>
                  <span className="ml-auto text-[17px] tabular-nums whitespace-nowrap text-[var(--fg2)]">
                    {formatMoney(expenseAmount(e))}/mo
                  </span>
                </ListRow>
              ))
            )}
          </ListGroup>

          <ListGroup
            label={
              <div className="flex items-center justify-between">
                <span>Planned purchases</span>
                <button
                  type="button"
                  onClick={() => setPurchaseDialog({ open: true, editing: null })}
                  className="text-[var(--accent)] hover:opacity-60"
                >
                  + Add
                </button>
              </div>
            }
          >
            {purchaseRows.length === 0 ? (
              <ListRow><span className="text-[15px] text-[var(--fg2)]">No purchases planned yet.</span></ListRow>
            ) : (
              purchaseRows.map((p) => (
                <ListRow key={p.id} as="button" interactive onClick={() => setPurchaseDialog({ open: true, editing: p })}>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[17px] tracking-[-0.014em]"
                      style={!p.scheduled ? { color: "var(--fg3)", textDecoration: "line-through" } : undefined}
                    >
                      {p.name}
                    </div>
                    <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                      {monthLabel(p.target_month)} · {payerLabel(p.payer, p.payer_groom_pct)}{optionsSuffix(p)}
                    </div>
                  </div>
                  <span className="ml-auto text-[17px] tabular-nums whitespace-nowrap text-[var(--fg2)]">
                    {formatMoney(purchaseAmount(p))}
                  </span>
                </ListRow>
              ))
            )}
          </ListGroup>

          <div>
            <div className="px-[18px] pb-[7px] text-[13px] tracking-[-0.004em] text-[var(--fg2)]">Wedding savings</div>
            <div className="overflow-hidden rounded-[12px] bg-[var(--card)]">
              <ListRow>
                <span className="text-[17px] tracking-[-0.014em]">Celal</span>
                <span className="ml-auto text-[17px] tabular-nums text-[var(--fg2)]">{formatMoney(perPersonStartingCash.groomSaved)}</span>
              </ListRow>
              <ListRow>
                <span className="text-[17px] tracking-[-0.014em]">Selver</span>
                <span className="ml-auto text-[17px] tabular-nums text-[var(--fg2)]">{formatMoney(perPersonStartingCash.brideSaved)}</span>
              </ListRow>
              <ListRow>
                <span className="text-[17px] tracking-[-0.014em]">Common</span>
                <span className="ml-auto text-[17px] tabular-nums text-[var(--fg2)]">{formatMoney(perPersonStartingCash.commonSaved)}</span>
              </ListRow>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[15px]">
              <button type="button" onClick={() => setTransferDialogOpen(true)} className="text-[var(--accent)] hover:opacity-60">
                Transfer to common
              </button>
              <button type="button" onClick={() => setExpandedSavingsOpen(true)} className="text-[var(--accent)] hover:opacity-60">
                View all
              </button>
              <button type="button" onClick={() => setSavingsDialog({ open: true, editing: null })} className="text-[var(--accent)] hover:opacity-60">
                Log savings
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[13px] text-[var(--fg3)]">
            <span>Search a longer list:</span>
            <button type="button" onClick={() => setExpandedSection("income")} className="hover:text-[var(--accent)]">Income</button>
            <button type="button" onClick={() => setExpandedSection("expense")} className="hover:text-[var(--accent)]">Costs</button>
            <button type="button" onClick={() => setExpandedSection("purchase")} className="hover:text-[var(--accent)]">Purchases</button>
          </div>
        </>
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
          editingOptions={purchaseDialog.editing ? purchaseOptions.filter((o) => o.purchase_id === purchaseDialog.editing!.id) : []}
          defaultMonth={settings.start_month}
          onSaved={(row, options) => {
            setPurchases((prev) => {
              const exists = prev.some((i) => i.id === row.id);
              const next = exists ? prev.map((i) => (i.id === row.id ? row : i)) : [...prev, row];
              return next.sort((a, b) => a.target_month.localeCompare(b.target_month));
            });
            setPurchaseOptions((prev) => [...prev.filter((o) => o.purchase_id !== row.id), ...options]);
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

      <Dialog open={confirmState.open} onOpenChange={(o) => setConfirmState((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>{confirmState.title}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmState((s) => ({ ...s, open: false }))}>Cancel</Button>
            <Button type="button" className="bg-burgundy text-cream hover:bg-burgundy/90" onClick={confirmState.onConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ============================================================================
// Display helpers
// ============================================================================

/** The 12-bar cash projection chart from the design handoff: bar height is
 *  cumulative cash for the month, accent-colored when a purchase lands then. */
function CashBars({ series }: { series: { month: string; cumulative: number; hasPurchase: boolean }[] }) {
  const max = Math.max(1, ...series.map((s) => s.cumulative));
  const last = series[series.length - 1];
  return (
    <div>
      <div className="flex h-[150px] items-end gap-[clamp(3px,0.9vw,9px)]">
        {series.map((s) => (
          <div
            key={s.month}
            title={formatMoney(s.cumulative)}
            className="min-h-[4px] flex-1 rounded-[2px]"
            style={{
              height: `${Math.max(0, (s.cumulative / max) * 100)}%`,
              background: s.hasPurchase ? "var(--accent)" : "var(--fill)",
            }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex gap-[clamp(3px,0.9vw,9px)] border-t border-[var(--sep)] pt-2">
        {series.map((s) => (
          <div key={s.month} className="flex-1 text-center text-[11px] text-[var(--fg3)]">
            {monthToDate(s.month).toLocaleDateString("en-GB", { month: "short" }).charAt(0)}
          </div>
        ))}
      </div>
      {last && (
        <div className="mt-3 text-[13px] text-[var(--fg2)]">
          Ends at {formatMoney(last.cumulative)}. Highlighted months carry a planned purchase.
        </div>
      )}
    </div>
  );
}

function personLabel(p: LifePerson): string {
  return p === "both" ? "Joint" : p === "groom" ? "Groom" : "Bride";
}

function payerLabel(payer: ExpensePayer, pct: number | null): string {
  if (payer === "both") return `Both (${pct ?? 50}% groom)`;
  if (payer === "gift") return "Gift";
  if (payer === "free") return "Free";
  return payer === "groom" ? "Groom" : "Bride";
}

function formatMoneyShort(n: number): string {
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

// Shared shape for a month's projected cash position (household or per-person).
type PersonPoint = { month: string; net: number; cumulative: number; totalIn: number; totalOut: number };

type LifeView = "joint" | "groom" | "bride" | "calendar";

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
              <Input id="amount" name="amount" type="number" min="0" step="any" defaultValue={editing?.amount ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Earned by</Label>
              <SelectField name="person" defaultValue={editing?.person ?? "groom"} options={PERSON_OPTIONS} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Starts (optional)</Label>
              <MonthSelect name="start_month" defaultValue={editing?.start_month ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ends (optional)</Label>
              <MonthSelect name="end_month" defaultValue={editing?.end_month ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-dom">Day of month (1–31, optional)</Label>
              <Input id="income-dom" name="day_of_month" type="number" min="1" max="31" defaultValue={editing?.day_of_month ?? ""} placeholder="e.g. 25" />
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

// ---- Breakdown editor ------------------------------------------------------

type BreakdownItem = { key: string; label: string; amount: number };

function newBreakdownItem(): BreakdownItem {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    label: "",
    amount: 0,
  };
}

function toBreakdownItems(stored: ExpenseBreakdownItem[]): BreakdownItem[] {
  return stored.map((item) => ({
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    label: item.label,
    amount: item.amount,
  }));
}

function BreakdownEditor({
  total,
  items,
  onChange,
}: {
  total: number;
  items: BreakdownItem[];
  onChange: (items: BreakdownItem[]) => void;
}) {
  const assigned = items.reduce((s, i) => s + (i.amount || 0), 0);
  const remaining = total - assigned;
  const isOver = assigned > total + 0.01;
  const isDone = total > 0 && Math.abs(remaining) < 0.01;
  const pct = total > 0 ? Math.min(100, (assigned / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 border border-line rounded-[4px] p-3 bg-cream/30">
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft font-medium mb-0.5">Breakdown</div>
      {items.map((item, idx) => (
        <div key={item.key} className="flex gap-2 items-center">
          <Input
            placeholder="Label (e.g. Flights)"
            value={item.label}
            onChange={(e) =>
              onChange(items.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))
            }
            className="flex-1 h-8 text-[12px]"
          />
          <Input
            type="number"
            min="0"
            step="any"
            value={item.amount || ""}
            onChange={(e) =>
              onChange(items.map((it, i) => (i === idx ? { ...it, amount: parseFloat(e.target.value) || 0 } : it)))
            }
            className="w-24 h-8 text-[12px] font-mono"
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="text-ink-soft hover:text-burgundy text-[18px] leading-none shrink-0"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 mt-0.5">
        <button
          type="button"
          onClick={() => onChange([...items, newBreakdownItem()])}
          className="text-[12px] text-gold hover:text-gold/80 font-medium transition-colors"
        >
          + Add item
        </button>
        {items.length > 0 && total > 0 && (
          <span
            className={`text-[11px] font-mono tabular-nums ${
              isOver ? "text-burgundy" : isDone ? "text-sage" : "text-ink-soft"
            }`}
          >
            {formatMoney(assigned)} / {formatMoney(total)}
            {isDone ? " ✓" : isOver ? ` (+${formatMoney(assigned - total)})` : ` (${formatMoney(remaining)} left)`}
          </span>
        )}
      </div>
      {items.length > 0 && total > 0 && (
        <div className="w-full h-1 bg-line rounded-full overflow-hidden mt-0.5">
          <div
            className={`h-full rounded-full transition-all ${isOver ? "bg-burgundy" : isDone ? "bg-sage" : "bg-gold"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ---- ExpenseDialog ----------------------------------------------------------

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

  const [payer, setPayer] = useState<ExpensePayer>(editing?.payer ?? "both");
  const [expenseType, setExpenseType] = useState<ExpenseType>(editing?.expense_type ?? "fixed");
  const [fixedAmount, setFixedAmount] = useState(Number(editing?.amount ?? 0));
  // Credit live-calculation state
  const [creditTotal, setCreditTotal] = useState(editing?.credit_total ?? 0);
  const [creditMonths, setCreditMonths] = useState(editing?.credit_months ?? 12);
  const [creditRate, setCreditRate] = useState(editing?.credit_interest_rate ?? 0);
  // Breakdown items
  const [breakdownItems, setBreakdownItems] = useState<BreakdownItem[]>(() =>
    toBreakdownItems(editing?.breakdown_items ?? [])
  );

  useEffect(() => {
    setPayer(editing?.payer ?? "both");
    setExpenseType(editing?.expense_type ?? "fixed");
    setFixedAmount(Number(editing?.amount ?? 0));
    setCreditTotal(editing?.credit_total ?? 0);
    setCreditMonths(editing?.credit_months ?? 12);
    setCreditRate(editing?.credit_interest_rate ?? 0);
    setBreakdownItems(toBreakdownItems(editing?.breakdown_items ?? []));
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
                  <Input
                    id="amount" name="amount" type="number" min="0" step="any"
                    value={fixedAmount || ""}
                    onChange={(e) => setFixedAmount(parseFloat(e.target.value) || 0)}
                    required
                  />
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
              {breakdownItems.length === 0 ? (
                <button type="button" onClick={() => setBreakdownItems([newBreakdownItem()])}
                  className="self-start text-[12px] text-gold hover:text-gold/80 font-medium transition-colors">
                  + Break down into items
                </button>
              ) : (
                <BreakdownEditor total={fixedAmount} items={breakdownItems} onChange={setBreakdownItems} />
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="credit_total">Total amount (€)</Label>
                  <Input
                    id="credit_total" name="credit_total" type="number" min="0" step="any"
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
              {breakdownItems.length === 0 ? (
                <button type="button" onClick={() => setBreakdownItems([newBreakdownItem()])}
                  className="self-start text-[12px] text-gold hover:text-gold/80 font-medium transition-colors">
                  + Break down into items
                </button>
              ) : (
                <BreakdownEditor total={creditTotal} items={breakdownItems} onChange={setBreakdownItems} />
              )}
            </>
          )}

          <div className={`grid gap-3.5 max-md:grid-cols-1 ${payer === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="flex flex-col gap-2">
              <Label>Who pays?</Label>
              <input type="hidden" name="payer" value={payer} />
              <Select value={payer} onValueChange={(v) => setPayer(v as ExpensePayer)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_PAYER_OPTIONS.map((o) => (
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

          {isExternalPayer(payer) && (
            <p className="text-[12px] text-ink-soft italic -mt-1">
              {payer === "gift" ? "Covered as a gift" : "This one's free"} — tracked for reference, but it won&rsquo;t reduce your savings.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-dom">Day of month (1–31, optional)</Label>
              <Input id="expense-dom" name="day_of_month" type="number" min="1" max="31" defaultValue={editing?.day_of_month ?? ""} placeholder="e.g. 25" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} rows={2} />
          </div>
          <input
            type="hidden"
            name="breakdown_items_json"
            value={JSON.stringify(breakdownItems.map(({ label, amount }) => ({ label, amount })))}
          />
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

type EditableOption = {
  key: string;
  label: string;
  amount: number;
  link: string;
  notes: string;
  groom_like: boolean;
  bride_like: boolean;
};

function newOption(over: Partial<EditableOption> = {}): EditableOption {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    label: "", amount: 0, link: "", notes: "", groom_like: false, bride_like: false, ...over,
  };
}

function PurchaseDialog({
  open, onOpenChange, editing, editingOptions, defaultMonth, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: LifePurchaseRow | null;
  editingOptions: LifePurchaseOptionRow[];
  defaultMonth: string;
  onSaved: (row: LifePurchaseRow, options: LifePurchaseOptionRow[]) => void;
}) {
  const action = editing ? updatePurchase.bind(null, editing.id) : createPurchase;
  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true; data?: LifePurchaseRow; options?: LifePurchaseOptionRow[] } | null,
    FormData
  >(action, null);

  const [payer, setPayer] = useState<ExpensePayer>(editing?.payer ?? "both");
  const [totalCost, setTotalCost] = useState<number>(Number(editing?.amount ?? 0));
  const [alreadyPaid, setAlreadyPaid] = useState<number>(Number(editing?.already_paid ?? 0));
  const [breakdownItems, setBreakdownItems] = useState<BreakdownItem[]>(() =>
    toBreakdownItems(editing?.breakdown_items ?? [])
  );

  // Options ("compare several products & vote") — dialog is keyed by purchase
  // id, so initial state derived here is correct for each open.
  const [optionsMode, setOptionsMode] = useState(editingOptions.length > 0);
  const [opts, setOpts] = useState<EditableOption[]>(
    editingOptions.map((o) => ({
      key: o.id, label: o.label, amount: Number(o.amount),
      link: o.link ?? "", notes: o.notes ?? "", groom_like: o.groom_like, bride_like: o.bride_like,
    })),
  );
  const [chosenIdx, setChosenIdx] = useState(() => {
    const i = editingOptions.findIndex((o) => o.id === editing?.selected_option_id);
    return i >= 0 ? i : 0;
  });

  useEffect(() => {
    if (state?.ok && state?.data) { onSaved(state.data, state.options ?? []); onOpenChange(false); }
  }, [state, onSaved, onOpenChange]);

  const safeChosen = Math.min(chosenIdx, Math.max(0, opts.length - 1));
  const validOpts = opts.filter((o) => o.label.trim() && o.amount > 0);
  const effectiveCost = optionsMode && opts.length > 0 ? (opts[safeChosen]?.amount ?? 0) : totalCost;
  const remaining = Math.max(0, effectiveCost - alreadyPaid);
  const paidPct = effectiveCost > 0 ? Math.min(100, (alreadyPaid / effectiveCost) * 100) : 0;
  const canSave = !optionsMode || validOpts.length > 0;

  const enableOptions = () => {
    setOptionsMode(true);
    if (opts.length === 0) {
      setOpts([newOption({ amount: totalCost || 0 })]);
      setChosenIdx(0);
    }
  };
  const updateOpt = (i: number, patch: Partial<EditableOption>) =>
    setOpts((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const removeOpt = (i: number) =>
    setOpts((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      setChosenIdx((c) => (i < c ? c - 1 : Math.min(c, Math.max(0, next.length - 1))));
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>purchase</em></> : <>New <em>purchase</em></>}</DialogTitle>
          <DialogDescription>A one-time future purchase (furniture, appliance, etc.).</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4 mt-2">
          {/* Hidden payload for the options editor */}
          <input type="hidden" name="has_options" value={optionsMode ? "true" : "false"} />
          <input type="hidden" name="options_json" value={JSON.stringify(opts.map(({ key, ...rest }) => { void key; return rest; }))} />
          <input type="hidden" name="chosen_index" value={String(safeChosen)} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Vacuum cleaner" required autoFocus />
          </div>

          {!optionsMode ? (
            <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount">Total cost (€)</Label>
                <Input id="amount" name="amount" type="number" min="0" step="any"
                  value={totalCost || ""}
                  onChange={(e) => setTotalCost(parseFloat(e.target.value) || 0)}
                  required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="already_paid">Already paid (€)</Label>
                <Input id="already_paid" name="already_paid" type="number" min="0" step="any"
                  value={alreadyPaid || ""}
                  onChange={(e) => setAlreadyPaid(parseFloat(e.target.value) || 0)}
                  placeholder="0" />
              </div>
            </div>
          ) : (
            <input type="hidden" name="already_paid" value={alreadyPaid || 0} />
          )}

          {/* Options toggle */}
          {!optionsMode ? (
            <button type="button" onClick={enableOptions}
              className="self-start text-[12px] text-gold hover:text-gold/80 font-medium transition-colors">
              + Compare options (different products / prices)
            </button>
          ) : (
            <OptionsEditor
              opts={opts}
              chosenIdx={safeChosen}
              onChoose={setChosenIdx}
              onUpdate={updateOpt}
              onRemove={removeOpt}
              onAdd={() => setOpts((prev) => [...prev, newOption()])}
              onDisable={() => setOptionsMode(false)}
              alreadyPaid={alreadyPaid}
              onAlreadyPaid={setAlreadyPaid}
            />
          )}

          {/* Live remaining preview */}
          {effectiveCost > 0 && (
            <div className="bg-cream-deep/60 border border-line rounded-[4px] px-4 py-3 text-[12px] space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-soft">{optionsMode ? "Chosen option · still to pay" : "Still to pay"}</span>
                <span className={`font-mono font-medium ${remaining > 0 ? "text-ink" : "text-sage"}`}>
                  {remaining > 0 ? formatMoney(remaining) : "Fully paid ✓"}
                </span>
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-sage rounded-full transition-all" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
          )}

          {breakdownItems.length === 0 ? (
            <button type="button" onClick={() => setBreakdownItems([newBreakdownItem()])}
              className="self-start text-[12px] text-gold hover:text-gold/80 font-medium transition-colors">
              + Break down into items
            </button>
          ) : (
            <BreakdownEditor total={effectiveCost} items={breakdownItems} onChange={setBreakdownItems} />
          )}

          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <SelectField
              name="category"
              defaultValue={editing?.category ?? "Furniture"}
              options={PURCHASE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Target month</Label>
              <MonthSelect name="target_month" defaultValue={editing?.target_month ?? defaultMonth} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="purchase-dom">Day of month (optional)</Label>
              <Input id="purchase-dom" name="day_of_month" type="number" min="1" max="31" defaultValue={editing?.day_of_month ?? ""} placeholder="e.g. 25" />
            </div>
          </div>
          <div className={`grid gap-3.5 max-md:grid-cols-1 ${payer === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="flex flex-col gap-2">
              <Label>Who pays?</Label>
              <input type="hidden" name="payer" value={payer} />
              <Select value={payer} onValueChange={(v) => setPayer(v as ExpensePayer)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_PAYER_OPTIONS.map((o) => (
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
          {isExternalPayer(payer) && (
            <p className="text-[12px] text-ink-soft italic -mt-1">
              {payer === "gift" ? "Covered as a gift" : "This one's free"} — tracked for reference, but it won&rsquo;t reduce your savings.
            </p>
          )}
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
          <input
            type="hidden"
            name="breakdown_items_json"
            value={JSON.stringify(breakdownItems.map(({ label, amount }) => ({ label, amount })))}
          />
          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}
          {optionsMode && !canSave && (
            <p className="text-sm text-burgundy">Give at least one option a name and a price above €0.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending || !canSave}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Options editor — compare alternatives, vote, and pick the one that drives
// the purchase price everywhere in the Life After tab.
// ----------------------------------------------------------------------------

function OptionsEditor({
  opts, chosenIdx, onChoose, onUpdate, onRemove, onAdd, onDisable, alreadyPaid, onAlreadyPaid,
}: {
  opts: EditableOption[];
  chosenIdx: number;
  onChoose: (i: number) => void;
  onUpdate: (i: number, patch: Partial<EditableOption>) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  onDisable: () => void;
  alreadyPaid: number;
  onAlreadyPaid: (v: number) => void;
}) {
  return (
    <div className="border border-gold/40 bg-gold/[0.04] rounded-[6px] p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-gold font-medium">Options to compare</span>
          <span className="text-[10px] bg-cream-deep text-ink-soft rounded-full px-1.5 py-0.5 font-mono">{opts.length}</span>
        </div>
        <button type="button" onClick={onDisable} className="text-[11px] text-ink-soft hover:text-burgundy transition-colors">
          Remove options
        </button>
      </div>
      <p className="text-[11px] text-ink-soft -mt-1">
        Add the alternatives you&rsquo;re weighing, tap a heart to vote, then choose one — its price flows through your whole plan.
      </p>

      <div className="flex flex-col gap-2">
        {opts.map((o, i) => {
          const chosen = i === chosenIdx;
          return (
            <div key={o.key}
              className={`rounded-[5px] border p-2.5 transition-all ${chosen ? "border-gold bg-paper ring-1 ring-gold/30" : "border-line bg-paper/60"}`}>
              <div className="flex items-center gap-2">
                {/* Choose radio */}
                <button type="button" onClick={() => onChoose(i)} title={chosen ? "Chosen" : "Choose this one"}
                  className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${chosen ? "border-gold" : "border-line hover:border-gold/60"}`}>
                  {chosen && <span className="w-2 h-2 rounded-full bg-gold" />}
                </button>
                <Input
                  value={o.label}
                  onChange={(e) => onUpdate(i, { label: e.target.value })}
                  placeholder={`Option ${i + 1} — e.g. Dyson V11`}
                  className="flex-1 h-8 text-[13px]"
                />
                <div className="relative shrink-0 w-[104px]">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-soft">€</span>
                  <Input
                    type="number" min="0" step="any"
                    value={o.amount || ""}
                    onChange={(e) => onUpdate(i, { amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-8 text-[13px] pl-5 font-mono"
                  />
                </div>
                <button type="button" onClick={() => onRemove(i)} disabled={opts.length <= 1}
                  className="text-ink-soft hover:text-burgundy text-[18px] leading-none shrink-0 disabled:opacity-25 disabled:cursor-not-allowed"
                  aria-label="Remove option">×</button>
              </div>
              <div className="flex items-center gap-2 mt-2 pl-6">
                <Input
                  value={o.link}
                  onChange={(e) => onUpdate(i, { link: e.target.value })}
                  placeholder="Link (optional)"
                  className="flex-1 h-7 text-[11px]"
                />
                <VoteHeart who="Groom" active={o.groom_like} accent="sage" onClick={() => onUpdate(i, { groom_like: !o.groom_like })} />
                <VoteHeart who="Bride" active={o.bride_like} accent="rose" onClick={() => onUpdate(i, { bride_like: !o.bride_like })} />
                {chosen && <span className="text-[10px] uppercase tracking-[0.15em] text-gold font-medium">Chosen</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={onAdd}
          className="text-[12px] text-gold hover:text-gold/80 font-medium transition-colors">+ Add option</button>
        <label className="flex items-center gap-2 text-[11px] text-ink-soft">
          Already paid (€)
          <Input type="number" min="0" step="any" value={alreadyPaid || ""}
            onChange={(e) => onAlreadyPaid(parseFloat(e.target.value) || 0)}
            placeholder="0" className="h-7 w-[90px] text-[12px] font-mono" />
        </label>
      </div>
    </div>
  );
}

function VoteHeart({ who, active, accent, onClick }: {
  who: string; active: boolean; accent: "sage" | "rose"; onClick: () => void;
}) {
  const activeCls = accent === "sage" ? "text-sage border-sage bg-sage/10" : "text-rose border-rose bg-rose/10";
  return (
    <button type="button" onClick={onClick} title={`${who} likes this`}
      className={`flex items-center gap-1 px-2 h-7 rounded-full border text-[10px] font-medium transition-colors shrink-0 ${
        active ? activeCls : "text-ink-soft/60 border-line hover:border-ink-soft/40"
      }`}>
      <span>{active ? "♥" : "♡"}</span>{who}
    </button>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <option value="gift">Gift</option>
            <option value="free">Free</option>
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
              {rows.map((e) => {
                const hasBreakdown = (e.breakdown_items?.length ?? 0) > 0;
                const isExpanded = expandedId === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr className="border-t border-line/50 hover:bg-cream/40 cursor-pointer group" onClick={() => onEdit(e)}>
                      <td className="py-2.5 px-3 font-medium text-ink">
                        <div className="flex items-center gap-1.5">
                          {hasBreakdown && (
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); setExpandedId(isExpanded ? null : e.id); }}
                              className={`text-[10px] w-4 h-4 flex items-center justify-center rounded transition-transform shrink-0 text-ink-soft hover:text-ink ${isExpanded ? "rotate-90" : ""}`}
                              title="Show breakdown"
                            >
                              ▶
                            </button>
                          )}
                          {e.name}
                          {e.expense_type === "credit" && <span className="ml-1 text-[9px] bg-gold/15 text-gold rounded px-1.5 py-0.5 font-medium">Credit</span>}
                          {hasBreakdown && <span className="text-[9px] bg-line text-ink-soft rounded px-1.5 py-0.5 font-medium">{e.breakdown_items.length} items</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-ink-soft">{e.category ?? "—"}</td>
                      <td className="py-2.5 px-3 text-ink-soft">{payerLabel(e.payer, e.payer_groom_pct)}</td>
                      <td className={`py-2.5 px-3 font-mono ${isExternalPayer(e.payer) ? "text-ink-soft" : "text-burgundy"}`}>
                        {isExternalPayer(e.payer) ? formatMoney(e.amount) : `−${formatMoney(e.amount)}`}
                      </td>
                      <td className="py-2.5 px-3 text-ink-soft text-[11px]">
                        {e.start_month ? monthLabel(e.start_month) : <em>Always</em>}
                        {(e.start_month || e.end_month) && " → "}
                        {e.end_month ? monthLabel(e.end_month) : e.start_month ? <em>Open</em> : ""}
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={(ev) => { ev.stopPropagation(); onDelete(e); }} className="opacity-0 group-hover:opacity-100 text-ink-soft hover:text-burgundy text-[16px] transition-opacity">×</button>
                      </td>
                    </tr>
                    {isExpanded && hasBreakdown && (
                      <tr className="bg-cream/50">
                        <td colSpan={6} className="px-6 pb-3 pt-1">
                          <div className="border-l-2 border-gold/40 pl-3 flex flex-col gap-1">
                            {e.breakdown_items.map((item, idx) => {
                              const pct = e.amount > 0 ? (item.amount / e.amount) * 100 : 0;
                              return (
                                <div key={idx} className="flex items-center gap-3 text-[12px]">
                                  <span className="text-ink-soft w-3.5 shrink-0">·</span>
                                  <span className="flex-1 text-ink">{item.label}</span>
                                  <span className="font-mono text-ink-soft text-[11px]">{pct.toFixed(0)}%</span>
                                  <span className={`font-mono font-medium w-20 text-right ${isExternalPayer(e.payer) ? "text-ink-soft" : "text-burgundy"}`}>
                                    {isExternalPayer(e.payer) ? formatMoney(item.amount) : `−${formatMoney(item.amount)}`}
                                  </span>
                                </div>
                              );
                            })}
                            {(() => {
                              const assigned = e.breakdown_items.reduce((s, i) => s + i.amount, 0);
                              const diff = e.amount - assigned;
                              if (Math.abs(diff) < 0.01) return null;
                              return (
                                <div className="text-[11px] text-ink-soft italic mt-0.5">
                                  {diff > 0 ? `${formatMoney(diff)} unassigned` : `${formatMoney(-diff)} over total`}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <option value="gift">Gift</option>
            <option value="free">Free</option>
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
                const hasBreakdown = (p.breakdown_items?.length ?? 0) > 0;
                const isExpanded = expandedId === p.id;
                return (
                  <Fragment key={p.id}>
                    <tr className={`border-t border-line/50 hover:bg-cream/40 cursor-pointer group ${!p.scheduled ? "opacity-50" : ""}`} onClick={() => onEdit(p)}>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onToggleScheduled(p); }}
                          className={`w-3.5 h-3.5 rounded-sm border transition-colors ${p.scheduled ? "bg-gold border-gold" : "bg-transparent border-line"}`}
                          title={p.scheduled ? "Exclude from projection" : "Include in projection"}
                        />
                      </td>
                      <td className="py-2.5 px-3 font-medium text-ink">
                        <div className="flex items-center gap-1.5">
                          {hasBreakdown && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : p.id); }}
                              className={`text-[10px] w-4 h-4 flex items-center justify-center rounded transition-transform shrink-0 text-ink-soft hover:text-ink ${isExpanded ? "rotate-90" : ""}`}
                              title="Show breakdown"
                            >
                              ▶
                            </button>
                          )}
                          {p.name}
                          {hasBreakdown && <span className="text-[9px] bg-line text-ink-soft rounded px-1.5 py-0.5 font-medium">{p.breakdown_items.length} items</span>}
                        </div>
                      </td>
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
                    {isExpanded && hasBreakdown && (
                      <tr className="bg-cream/50">
                        <td colSpan={8} className="px-8 pb-3 pt-1">
                          <div className="border-l-2 border-gold/40 pl-3 flex flex-col gap-1">
                            {p.breakdown_items.map((item, idx) => {
                              const pct = p.amount > 0 ? (item.amount / p.amount) * 100 : 0;
                              return (
                                <div key={idx} className="flex items-center gap-3 text-[12px]">
                                  <span className="text-ink-soft w-3.5 shrink-0">·</span>
                                  <span className="flex-1 text-ink">{item.label}</span>
                                  <span className="font-mono text-ink-soft text-[11px]">{pct.toFixed(0)}%</span>
                                  <span className={`font-mono font-medium w-20 text-right ${isExternalPayer(p.payer) ? "text-ink-soft" : "text-burgundy"}`}>
                                    {isExternalPayer(p.payer) ? formatMoney(item.amount) : `−${formatMoney(item.amount)}`}
                                  </span>
                                </div>
                              );
                            })}
                            {(() => {
                              const assigned = p.breakdown_items.reduce((s, i) => s + i.amount, 0);
                              const diff = p.amount - assigned;
                              if (Math.abs(diff) < 0.01) return null;
                              return (
                                <div className="text-[11px] text-ink-soft italic mt-0.5">
                                  {diff > 0 ? `${formatMoney(diff)} unassigned` : `${formatMoney(-diff)} over total`}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
  pots: allocatedPots,
  onEdit,
  onDelete,
}: {
  savings: WeddingSavingsRow[];
  pots: { groom: number; bride: number; groomSaved: number; brideSaved: number; commonSaved: number };
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
          <div className="pt-3 border-t border-line">
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-0.5">Starting position after wedding</div>
            <div className="font-mono font-medium text-sage text-[15px]">{formatMoney(allocatedPots.groom)}</div>
            <div className="text-[10px] text-ink-soft mt-0.5">personal + ½ common − ½ costs</div>
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
          <div className="pt-3 border-t border-line">
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-0.5">Starting position after wedding</div>
            <div className="font-mono font-medium text-rose text-[15px]">{formatMoney(allocatedPots.bride)}</div>
            <div className="text-[10px] text-ink-soft mt-0.5">personal + ½ common − ½ costs</div>
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
          {pots.commonTotal > 0 && (
            <div className="pt-3 border-t border-line">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-soft mb-1">Split 50/50</div>
              <div className="flex justify-between text-[12px]">
                <span className="text-sage">→ Groom {formatMoney(pots.commonTotal * 0.5)}</span>
                <span className="text-rose">Bride {formatMoney(pots.commonTotal * 0.5)} →</span>
              </div>
            </div>
          )}
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
              <Input id="s-amount" name="amount" type="number" min="0" step="any" defaultValue={editing?.amount ?? ""} placeholder="500" required autoFocus />
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
              <Input id="tr-amount" name="amount" type="number" min="0" step="any" placeholder="5000" required autoFocus />
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
// CalendarView
// ============================================================================

type CalendarPersonFilter = "all" | "groom" | "bride";
type CalendarDragItem = { id: string; type: "income" | "expense" | "purchase" };
type CalEv = { id: string; type: "income" | "expense" | "purchase"; name: string; amount: number; day: number | null };
type TLNode = { day: number; events: (CalEv & { day: number })[]; balanceBefore: number; balanceAfter: number };

// ============================================================================
// CashTimeline — horizontal flow of events + running balance
// ============================================================================

function CashTimeline({
  nodes, unscheduledEvents, cashAtMonthStart, daysInMonth, currentMonth, selectedDay, onSelectDay,
}: {
  nodes: TLNode[];
  unscheduledEvents: CalEv[];
  cashAtMonthStart: number;
  daysInMonth: number;
  currentMonth: string;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}) {
  const scheduledEnd = nodes.length > 0 ? nodes[nodes.length - 1].balanceAfter : cashAtMonthStart;
  const unschedNet = unscheduledEvents.reduce((a, e) => a + (e.type === "income" ? e.amount : -e.amount), 0);
  const finalEnd = scheduledEnd + unschedNet;
  const [cY, cM] = currentMonth.split("-").map(Number);

  const lineCol = (bal: number) => bal >= 0 ? "#7c8a6b" : "#7a1f2b";
  const txtCol = (bal: number) => bal >= 0 ? "text-sage" : "text-burgundy";

  const Connector = ({ fromBal, days }: { fromBal: number; days: number }) => {
    const c = lineCol(fromBal);
    return (
      <div
        className="flex flex-col items-center justify-center relative min-w-[28px]"
        style={{ flexGrow: Math.max(1, days), flexBasis: 0 }}
      >
        <div className="text-[9px] font-mono text-ink-soft/40 mb-1.5 h-3 leading-none text-center">
          {days > 1 ? `${days}d` : ""}
        </div>
        <div className="w-full h-[2px]" style={{ background: `linear-gradient(to right, ${c}80, ${c})` }} />
        <div className={`mt-1.5 text-[9px] font-mono ${txtCol(fromBal)}`}>{formatMoneyShort(fromBal)}</div>
      </div>
    );
  };

  const Cap = ({ label, amount, delta }: { label: string; amount: number; delta?: number }) => (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="text-[9px] uppercase tracking-[0.2em] text-ink-soft font-medium">{label}</div>
      <div className={`w-[52px] h-[52px] rounded-full border-2 flex items-center justify-center ${amount >= 0 ? "border-sage bg-sage/10" : "border-burgundy bg-burgundy/10"}`}>
        <div className={`text-[9px] font-mono font-bold text-center leading-tight ${txtCol(amount)}`}>
          {formatMoneyShort(amount)}
        </div>
      </div>
      {delta !== undefined && (
        <div className={`text-[9px] font-medium ${delta >= 0 ? "text-sage" : "text-burgundy"}`}>
          {delta >= 0 ? "▲" : "▼"} {formatMoneyShort(Math.abs(delta))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-y-3 py-2 px-1">
        <Cap label="Start" amount={cashAtMonthStart} />

        {nodes.length === 0 && !unscheduledEvents.length ? (
          <div className="flex-1 mx-6 text-[12px] italic text-ink-soft">
            Pin events to days on the calendar to see the flow here.
          </div>
        ) : (
          <>
            {nodes.map((node, idx) => {
              const prevDay = idx === 0 ? 0 : nodes[idx - 1].day;
              const isSelected = selectedDay === node.day;
              const dayLabel = new Date(cY, cM - 1, node.day)
                .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

              return (
                <div key={node.day} className="contents">
                  <Connector fromBal={node.balanceBefore} days={node.day - prevDay} />
                  <div
                    onClick={() => onSelectDay(isSelected ? null : node.day)}
                    className={`shrink-0 cursor-pointer rounded-[6px] border transition-all min-w-[112px] max-w-[160px] p-2.5
                      ${isSelected
                        ? "border-ink bg-ink text-cream shadow-lg scale-[1.03] z-10 relative"
                        : "border-line bg-paper hover:border-ink/30 hover:shadow-soft"
                      }`}
                  >
                    <div className={`text-[10px] font-medium mb-2 ${isSelected ? "text-cream/60" : "text-ink-soft"}`}>{dayLabel}</div>
                    <div className="space-y-1.5">
                      {node.events.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-1.5">
                          <span className="text-[11px] shrink-0">{ev.type === "income" ? "💼" : ev.type === "expense" ? "🔁" : "🛋️"}</span>
                          <div className="min-w-0">
                            <div className={`text-[10px] truncate leading-tight ${isSelected ? "text-cream/80" : "text-ink"}`}>{ev.name}</div>
                            <div className={`text-[10px] font-mono font-medium ${
                              isSelected
                                ? ev.type === "income" ? "text-[#a8c49a]" : "text-[#c47a7a]"
                                : ev.type === "income" ? "text-sage" : "text-burgundy"
                            }`}>{ev.type === "income" ? "+" : "−"}{formatMoney(ev.amount)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className={`mt-2 pt-1.5 border-t flex items-center justify-between gap-2 ${isSelected ? "border-cream/20" : "border-line"}`}>
                      <span className={`text-[9px] ${isSelected ? "text-cream/50" : "text-ink-soft"}`}>After</span>
                      <span className={`text-[11px] font-mono font-bold ${
                        isSelected
                          ? node.balanceAfter >= 0 ? "text-[#a8c49a]" : "text-[#c47a7a]"
                          : txtCol(node.balanceAfter)
                      }`}>{formatMoneyShort(node.balanceAfter)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Connector from last node to end */}
            <Connector
              fromBal={nodes.length > 0 ? nodes[nodes.length - 1].balanceAfter : cashAtMonthStart}
              days={daysInMonth - (nodes.length > 0 ? nodes[nodes.length - 1].day : 0)}
            />

            {/* Unscheduled block */}
            {unscheduledEvents.length > 0 && (
              <>
                <div className="shrink-0 flex items-center" style={{ width: 24 }}>
                  <div className="w-full border-t-2 border-dashed border-ink-soft/25" />
                </div>
                <div className="shrink-0 rounded-[6px] border border-dashed border-line/70 p-2.5 min-w-[130px] bg-cream/30">
                  <div className="text-[10px] text-ink-soft font-medium mb-1.5">Unscheduled ({unscheduledEvents.length})</div>
                  {unscheduledEvents.slice(0, 4).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px]">{ev.type === "income" ? "💼" : ev.type === "expense" ? "🔁" : "🛋️"}</span>
                      <span className={`text-[9px] font-mono shrink-0 ${ev.type === "income" ? "text-sage" : "text-burgundy"}`}>
                        {ev.type === "income" ? "+" : "−"}{formatMoney(ev.amount)}
                      </span>
                      <span className="text-[9px] text-ink-soft truncate">{ev.name}</span>
                    </div>
                  ))}
                  {unscheduledEvents.length > 4 && <div className="text-[9px] text-ink-soft italic">+{unscheduledEvents.length - 4} more</div>}
                  <div className={`mt-1.5 pt-1 border-t border-dashed border-line/50 text-[9px] font-mono font-medium ${unschedNet >= 0 ? "text-sage" : "text-burgundy"}`}>
                    Net: {unschedNet >= 0 ? "+" : "−"}{formatMoney(Math.abs(unschedNet))}
                  </div>
                </div>
                <div className="shrink-0 flex items-center" style={{ width: 16 }}>
                  <div className="w-full border-t-2 border-dashed border-ink-soft/25" />
                </div>
              </>
            )}
          </>
        )}

        <Cap label="End" amount={finalEnd} delta={finalEnd - cashAtMonthStart} />
      </div>
    </div>
  );
}

interface CalendarViewProps {
  income: LifeIncomeRow[];
  expenses: LifeExpenseRow[];
  purchases: LifePurchaseRow[];
  settings: LifeSettingsRow;
  startingCash: number;
  groomStartingCash: number;
  brideStartingCash: number;
  projection: Array<{ month: string; income: number; fixed: number; purchases: number; net: number; cumulative: number }>;
  onAssignDay: (type: "income" | "expense" | "purchase", id: string, day: number | null) => void;
}

function CalendarView({ income, expenses, purchases, settings, startingCash, groomStartingCash, brideStartingCash, projection, onAssignDay }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = dateToMonth(new Date());
    return today >= settings.start_month ? today : settings.start_month;
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [personFilter, setPersonFilter] = useState<CalendarPersonFilter>("all");
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const maxMonth = useMemo(() => {
    if (projection.length > 0) return projection[projection.length - 1].month;
    const d = monthToDate(settings.start_month);
    d.setMonth(d.getMonth() + settings.horizon_months - 1);
    return dateToMonth(d);
  }, [projection, settings]);

  const goMonth = (dir: 1 | -1) => {
    const d = monthToDate(currentMonth);
    d.setMonth(d.getMonth() + dir);
    const next = dateToMonth(d);
    if (next < settings.start_month || next > maxMonth) return;
    setCurrentMonth(next);
    setSelectedDay(null);
  };

  // Filtered source arrays by person
  const filteredIncome = useMemo(() =>
    personFilter === "all" ? income : income.filter((i) => i.person === personFilter || i.person === "both"),
    [income, personFilter]);
  const filteredExpenses = useMemo(() =>
    personFilter === "all" ? expenses : expenses.filter((e) => e.payer === personFilter || e.payer === "both"),
    [expenses, personFilter]);
  const filteredPurchases = useMemo(() =>
    personFilter === "all" ? purchases : purchases.filter((p) => p.payer === personFilter || p.payer === "both"),
    [purchases, personFilter]);

  // Active items this month — split into scheduled (has day) and unscheduled
  const allEvents = useMemo(() => {
    const out: CalEv[] = [];
    filteredIncome.forEach((i) => {
      if (isActiveInMonth(i.start_month, i.end_month, currentMonth)) {
        const amt = personFilter !== "all" && i.person === "both" ? Number(i.amount) * 0.5 : Number(i.amount);
        out.push({ id: i.id, type: "income", name: i.name, amount: amt, day: i.day_of_month ?? null });
      }
    });
    filteredExpenses.forEach((e) => {
      if (isActiveInMonth(e.start_month, e.end_month, currentMonth)) {
        const share = personFilter !== "all"
          ? personShare(e.payer, e.payer_groom_pct, personFilter)
          : (isExternalPayer(e.payer) ? 0 : 1);
        if (share === 0) return;
        out.push({ id: e.id, type: "expense", name: e.name, amount: Number(e.amount) * share, day: e.day_of_month ?? null });
      }
    });
    filteredPurchases.forEach((p) => {
      if (p.scheduled && p.target_month === currentMonth) {
        const share = personFilter !== "all"
          ? personShare(p.payer, p.payer_groom_pct, personFilter)
          : (isExternalPayer(p.payer) ? 0 : 1);
        if (share === 0) return;
        const rem = Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0));
        out.push({ id: p.id, type: "purchase", name: p.name, amount: rem * share, day: p.day_of_month ?? null });
      }
    });
    return out;
  }, [currentMonth, filteredIncome, filteredExpenses, filteredPurchases, personFilter]);

  const scheduledEvents = useMemo(() => allEvents.filter((e) => e.day !== null) as (CalEv & { day: number })[], [allEvents]);
  const unscheduledEvents = useMemo(() => allEvents.filter((e) => e.day === null), [allEvents]);

  const cashAtMonthStart = useMemo(() => {
    // Base savings pot depends on the active person filter: the full combined
    // ledger for "all", or that person's pot (personal savings + half of the
    // common fund) when filtering on groom/bride.
    let cash = personFilter === "all"
      ? startingCash
      : personFilter === "groom" ? groomStartingCash : brideStartingCash;

    // Walk forward from the horizon start, accumulating each prior month's flows
    // using the same person-aware splitting as the calendar events below.
    const allMonths = monthsList(settings.start_month, settings.horizon_months);
    for (const month of allMonths) {
      if (month >= currentMonth) break;
      filteredIncome.forEach((i) => {
        if (isActiveInMonth(i.start_month, i.end_month, month)) {
          cash += personFilter !== "all" && i.person === "both" ? Number(i.amount) * 0.5 : Number(i.amount);
        }
      });
      filteredExpenses.forEach((e) => {
        if (isActiveInMonth(e.start_month, e.end_month, month)) {
          const share = personFilter !== "all"
            ? personShare(e.payer, e.payer_groom_pct, personFilter)
            : (isExternalPayer(e.payer) ? 0 : 1);
          cash -= Number(e.amount) * share;
        }
      });
      filteredPurchases.forEach((p) => {
        if (p.scheduled && p.target_month === month) {
          const share = personFilter !== "all"
            ? personShare(p.payer, p.payer_groom_pct, personFilter)
            : (isExternalPayer(p.payer) ? 0 : 1);
          cash -= Math.max(0, Number(p.amount) - Number(p.already_paid ?? 0)) * share;
        }
      });
    }
    return cash;
  }, [currentMonth, filteredIncome, filteredExpenses, filteredPurchases, settings, startingCash, groomStartingCash, brideStartingCash, personFilter]);

  const timelineNodes = useMemo((): TLNode[] => {
    const map = new Map<number, (CalEv & { day: number })[]>();
    scheduledEvents.forEach((ev) => {
      const arr = map.get(ev.day) ?? [];
      arr.push(ev);
      map.set(ev.day, arr);
    });
    const days = Array.from(map.keys()).sort((a, b) => a - b);
    let balance = cashAtMonthStart;
    return days.map((day) => {
      const events = map.get(day)!;
      const balanceBefore = balance;
      events.forEach((ev) => { balance += ev.type === "income" ? ev.amount : -ev.amount; });
      return { day, events, balanceBefore, balanceAfter: balance };
    });
  }, [scheduledEvents, cashAtMonthStart]);

  const [y, m] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  const dailyBalances = useMemo(() => {
    const arr: number[] = Array(daysInMonth + 1).fill(0);
    let cash = cashAtMonthStart;
    for (let d = 1; d <= daysInMonth; d++) {
      scheduledEvents.filter((e) => e.day === d).forEach((ev) => {
        cash += ev.type === "income" ? ev.amount : -ev.amount;
      });
      arr[d] = cash;
    }
    return arr;
  }, [scheduledEvents, cashAtMonthStart, daysInMonth]);

  const monthTotals = useMemo(() => {
    const inc = scheduledEvents.filter((e) => e.type === "income").reduce((a, e) => a + e.amount, 0);
    const exp = scheduledEvents.filter((e) => e.type === "expense").reduce((a, e) => a + e.amount, 0);
    const pur = scheduledEvents.filter((e) => e.type === "purchase").reduce((a, e) => a + e.amount, 0);
    const unschedInc = unscheduledEvents.filter((e) => e.type === "income").reduce((a, e) => a + e.amount, 0);
    const unschedOut = unscheduledEvents.filter((e) => e.type !== "income").reduce((a, e) => a + e.amount, 0);
    return { inc: inc + unschedInc, exp: exp + unschedOut, pur, end: cashAtMonthStart + inc + unschedInc - exp - unschedOut - pur };
  }, [scheduledEvents, unscheduledEvents, cashAtMonthStart]);

  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
  const leadingCells = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const todayStr = dateToMonth(new Date());
  const todayDay = todayStr === currentMonth ? new Date().getDate() : null;

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const handleDrop = (day: number, e: { preventDefault: () => void; dataTransfer: DataTransfer }) => {
    e.preventDefault();
    setDragOverDay(null);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const { id, type } = JSON.parse(raw) as CalendarDragItem;
    onAssignDay(type, id, day);
  };

  const handleUnassign = (ev: CalEv, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onAssignDay(ev.type, ev.id, null);
  };

  return (
    <div className="animate-in fade-in duration-200">
      {/* Top bar: navigation + person filter */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <button type="button" onClick={() => goMonth(-1)} disabled={currentMonth <= settings.start_month}
          className="px-3 py-1.5 text-[13px] border border-line rounded-[4px] hover:bg-cream/60 disabled:opacity-30 disabled:cursor-not-allowed">← Prev</button>
        <div className="font-serif text-[22px] text-ink flex-1 text-center">
          {monthToDate(currentMonth).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </div>
        <button type="button" onClick={() => goMonth(1)} disabled={currentMonth >= maxMonth}
          className="px-3 py-1.5 text-[13px] border border-line rounded-[4px] hover:bg-cream/60 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
      </div>

      {/* Person filter */}
      <div className="flex gap-0 mb-4 border border-line rounded-[6px] overflow-hidden bg-cream-deep/40 w-fit">
        {(["all", "groom", "bride"] as const).map((f) => {
          const active = personFilter === f;
          const activeClass = f === "groom" ? "bg-paper text-sage border-b-2 border-sage shadow-soft"
            : f === "bride" ? "bg-paper text-rose border-b-2 border-rose shadow-soft"
            : "bg-paper text-ink border-b-2 border-ink shadow-soft";
          return (
            <button key={f} type="button" onClick={() => setPersonFilter(f)}
              className={`px-5 py-2 text-[12px] font-medium transition-colors border-b-2 ${active ? activeClass : "border-transparent text-ink-soft hover:bg-cream/60 hover:text-ink"}`}>
              {f === "all" ? "All" : f === "groom" ? "Groom" : "Bride"}
            </button>
          );
        })}
      </div>

      {/* Cash flow timeline */}
      <CashTimeline
        nodes={timelineNodes}
        unscheduledEvents={unscheduledEvents}
        cashAtMonthStart={cashAtMonthStart}
        daysInMonth={daysInMonth}
        currentMonth={currentMonth}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />

      {/* Summary strip */}
      <div className="mb-4 px-5 py-3 bg-cream-deep/60 border border-line rounded-[4px] flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
        <span className="text-ink-soft">Starting <strong className="font-mono text-ink">{formatMoney(cashAtMonthStart)}</strong></span>
        <span className="text-sage">Income <strong className="font-mono">+{formatMoney(monthTotals.inc)}</strong></span>
        <span className="text-burgundy">Expenses <strong className="font-mono">−{formatMoney(monthTotals.exp)}</strong></span>
        {monthTotals.pur > 0 && <span className="text-gold">Purchases <strong className="font-mono">−{formatMoney(monthTotals.pur)}</strong></span>}
        <span className={monthTotals.end >= cashAtMonthStart ? "text-sage" : "text-burgundy"}>
          Ending <strong className="font-mono">{formatMoney(monthTotals.end)}</strong>
        </span>
        {unscheduledEvents.length > 0 && (
          <span className="text-ink-soft italic">{unscheduledEvents.length} item{unscheduledEvents.length > 1 ? "s" : ""} not pinned to a day →</span>
        )}
      </div>

      {/* Main layout: calendar + sidebar */}
      <div className="flex gap-5 items-start max-lg:flex-col">

        {/* Calendar grid */}
        <div className="flex-1 min-w-0 bg-paper border border-line rounded-[4px] overflow-hidden shadow-soft">
          <div className="grid grid-cols-7 border-b border-line">
            {DAY_LABELS.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] uppercase tracking-[0.2em] text-ink-soft font-medium">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array(leadingCells).fill(null).map((_, i) => (
              <div key={"lead-" + i} className="min-h-[88px] border-r border-b border-line/50 bg-cream/20" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayEvents = scheduledEvents.filter((e) => e.day === day);
              const bal = dailyBalances[day];
              const isToday = day === todayDay;
              const isSelected = day === selectedDay;
              const isDragOver = dragOverDay === day;
              const isNegativeBal = bal < 0 && dayEvents.length > 0;
              return (
                <div key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDay(day); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null); }}
                  onDrop={(e) => handleDrop(day, e)}
                  className={`min-h-[88px] border-r border-b border-line/50 p-1.5 cursor-pointer transition-colors
                    ${isDragOver ? "ring-2 ring-inset ring-gold/60 bg-gold/8" : isSelected ? "bg-cream-deep" : isNegativeBal ? "bg-burgundy/5 hover:bg-burgundy/10" : "hover:bg-cream/60"}
                    ${isToday ? "ring-2 ring-ink/20 ring-inset" : ""}
                  `}
                >
                  <div className={`text-right text-[11px] mb-1 ${isToday ? "font-bold text-ink" : "text-ink-soft/60"}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayEvents.map((ev) => (
                      <div key={ev.id} className={`group/chip rounded px-1 py-0.5 text-[9px] leading-tight border flex items-start gap-0.5
                        ${ev.type === "income" ? "bg-sage/15 text-sage border-sage/30" : ev.type === "expense" ? "bg-burgundy/10 text-burgundy border-burgundy/20" : "bg-gold/15 text-gold border-gold/30"}
                      `}>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{ev.name}</div>
                          <div className="font-mono">{ev.type === "income" ? "+" : "−"}{formatMoney(ev.amount)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleUnassign(ev, e)}
                          className="opacity-0 group-hover/chip:opacity-70 hover:!opacity-100 text-[10px] leading-none shrink-0 mt-0.5"
                          title="Move back to unscheduled"
                        >×</button>
                      </div>
                    ))}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className={`mt-1 text-right font-mono text-[9px] ${bal >= 0 ? "text-sage" : "text-burgundy"}`}>{formatMoney(bal)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — unscheduled items */}
        <div className="w-60 shrink-0 max-lg:w-full">
          <div className="bg-paper border border-line rounded-[4px] shadow-soft sticky top-4">
            <div className="px-4 py-3 border-b border-line">
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-soft font-medium">Not pinned to a day</div>
              <div className="text-[10px] text-ink-soft mt-1 leading-snug">Drag onto a day to assign, or leave here for monthly totals.</div>
            </div>
            {unscheduledEvents.length === 0 ? (
              <p className="px-4 py-6 text-[11px] italic text-ink-soft text-center">All items have a day pinned.</p>
            ) : (
              <ul className="divide-y divide-line">
                {unscheduledEvents.map((ev) => (
                  <li key={ev.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify({ id: ev.id, type: ev.type } satisfies CalendarDragItem));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="flex items-center gap-2.5 px-3 py-2.5 cursor-grab active:cursor-grabbing hover:bg-cream/40 group/item select-none"
                  >
                    <span className="text-[13px] shrink-0">{ev.type === "income" ? "💼" : ev.type === "expense" ? "🔁" : "🛋️"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-ink truncate">{ev.name}</div>
                      <div className={`text-[10px] font-mono ${ev.type === "income" ? "text-sage" : "text-burgundy"}`}>
                        {ev.type === "income" ? "+" : "−"}{formatMoney(ev.amount)}
                      </div>
                    </div>
                    <span className="text-[13px] text-ink-soft/30 group-hover/item:text-ink-soft shrink-0" aria-hidden>⠿</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay !== null && (() => {
        const dayEvents = scheduledEvents.filter((e) => e.day === selectedDay);
        const openBal = selectedDay === 1 ? cashAtMonthStart : dailyBalances[selectedDay - 1];
        const closeBal = dailyBalances[selectedDay];
        const date = new Date(y, m - 1, selectedDay);
        const dateLabel = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        return (
          <div className="mt-4 bg-paper border border-line rounded-[4px] shadow-soft p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-serif text-[18px] text-ink">{dateLabel}</div>
              <button type="button" onClick={() => setSelectedDay(null)} className="text-ink-soft hover:text-ink text-[20px] leading-none">×</button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[12px] text-ink-soft pb-2 border-b border-line">
                <span>Opening balance</span>
                <span className="font-mono text-ink">{formatMoney(openBal)}</span>
              </div>
              {dayEvents.length === 0 ? (
                <p className="text-[13px] italic text-ink-soft py-3">No events pinned to this day.</p>
              ) : dayEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                  <span className="text-[16px]">{ev.type === "income" ? "💼" : ev.type === "expense" ? "🔁" : "🛋️"}</span>
                  <span className="flex-1 text-ink">{ev.name}</span>
                  <span className={`font-mono ${ev.type === "income" ? "text-sage" : "text-burgundy"}`}>
                    {ev.type === "income" ? "+" : "−"}{formatMoney(ev.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-[13px] font-medium pt-2 border-t border-line">
                <span>Closing balance</span>
                <span className={`font-mono font-bold ${closeBal >= 0 ? "text-sage" : "text-burgundy"}`}>{formatMoney(closeBal)}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
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
              step="any"
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
