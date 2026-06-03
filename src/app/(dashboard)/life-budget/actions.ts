"use server";

import { createSupabaseServiceClient as createSupabaseServerClient } from "@/lib/supabase/service";
import type { ExpenseType, LifePerson, LifePurchaseOptionRow, LifePurchaseRow, StartingCashMode } from "@/types/db";

const VALID_PERSONS: LifePerson[] = ["bride", "groom", "both"];

function trimMonth(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // Accept "YYYY-MM" or "YYYY-MM-DD" (HTML month input gives YYYY-MM, date input gives YYYY-MM-DD).
  return s.slice(0, 7);
}

function parsePayerSplit(form: FormData) {
  const payer = String(form.get("payer") ?? "both") as LifePerson;
  const rawPct = parseFloat(String(form.get("payer_groom_pct") ?? "50"));
  const payer_groom_pct = payer === "both" ? (isNaN(rawPct) ? 50 : Math.min(100, Math.max(0, rawPct))) : null;
  return { payer, payer_groom_pct };
}

// ---- Income --------------------------------------------------------------

function parseIncome(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const amount = parseFloat(String(form.get("amount") ?? ""));
  const person = String(form.get("person") ?? "both") as LifePerson;
  const start_month = trimMonth(form.get("start_month"));
  const end_month = trimMonth(form.get("end_month"));
  const notes = String(form.get("notes") ?? "").trim() || null;
  const rawDay = parseInt(String(form.get("day_of_month") ?? ""), 10);
  const day_of_month = !isNaN(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : null;

  if (!name) return { error: "Please enter a name." };
  if (isNaN(amount) || amount < 0) return { error: "Please enter a valid amount." };
  if (!VALID_PERSONS.includes(person)) return { error: "Invalid person." };

  return { name, amount, person, start_month, end_month, day_of_month, notes };
}

export async function createIncome(_prev: unknown, form: FormData) {
  const parsed = parseIncome(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_income").insert(parsed as never).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updateIncome(id: string, _prev: unknown, form: FormData) {
  const parsed = parseIncome(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_income").update(parsed as never).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deleteIncome(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("life_income").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ---- Recurring expenses --------------------------------------------------

/** Add `credit_months - 1` months to a YYYY-MM string. */
function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Standard amortisation formula. Returns 0 when inputs are invalid. */
function calcMonthlyPayment(principal: number, months: number, annualRate: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function parseExpense(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const { payer, payer_groom_pct } = parsePayerSplit(form);
  const expense_type = String(form.get("expense_type") ?? "fixed") as ExpenseType;
  const rawDay = parseInt(String(form.get("day_of_month") ?? ""), 10);
  const day_of_month = !isNaN(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : null;

  if (!name) return { error: "Please enter a name." };
  if (!VALID_PERSONS.includes(payer)) return { error: "Invalid payer." };

  if (expense_type === "credit") {
    const credit_total = parseFloat(String(form.get("credit_total") ?? ""));
    const credit_months = parseInt(String(form.get("credit_months") ?? ""), 10);
    const credit_interest_rate = parseFloat(String(form.get("credit_interest_rate") ?? "0")) || 0;
    const start_month = trimMonth(form.get("start_month"));

    if (isNaN(credit_total) || credit_total <= 0) return { error: "Please enter a valid total amount." };
    if (isNaN(credit_months) || credit_months <= 0) return { error: "Please enter a valid number of months." };
    if (!start_month) return { error: "Please select a start month for the credit." };

    const amount = Math.round(calcMonthlyPayment(credit_total, credit_months, credit_interest_rate) * 100) / 100;
    const end_month = addMonths(start_month, credit_months - 1);

    return {
      name, category, notes, payer, payer_groom_pct,
      expense_type,
      amount,
      start_month,
      end_month,
      credit_total,
      credit_months,
      credit_interest_rate,
      day_of_month,
    };
  }

  // Fixed
  const amount = parseFloat(String(form.get("amount") ?? ""));
  const start_month = trimMonth(form.get("start_month"));
  const end_month = trimMonth(form.get("end_month"));

  if (isNaN(amount) || amount < 0) return { error: "Please enter a valid amount." };

  return {
    name, amount, category, payer, payer_groom_pct,
    expense_type,
    start_month, end_month,
    credit_total: null, credit_months: null, credit_interest_rate: null,
    day_of_month,
    notes,
  };
}

export async function createExpense(_prev: unknown, form: FormData) {
  const parsed = parseExpense(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_expenses").insert(parsed as never).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function updateExpense(id: string, _prev: unknown, form: FormData) {
  const parsed = parseExpense(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_expenses").update(parsed as never).eq("id", id).select().single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deleteExpense(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("life_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ---- One-time purchases --------------------------------------------------

/**
 * @param amountOverride when the purchase is driven by a chosen option, the
 *   option's price is used as the amount and the form's `amount` field (which
 *   the dialog leaves blank in options mode) is ignored.
 */
function parsePurchase(form: FormData, amountOverride?: number) {
  const name = String(form.get("name") ?? "").trim();
  const amount = amountOverride !== undefined ? amountOverride : parseFloat(String(form.get("amount") ?? ""));
  const already_paid = Math.max(0, parseFloat(String(form.get("already_paid") ?? "0")) || 0);
  const category = String(form.get("category") ?? "").trim() || null;
  const target_month = trimMonth(form.get("target_month"));
  const notes = String(form.get("notes") ?? "").trim() || null;
  const scheduled = String(form.get("scheduled") ?? "true") !== "false";
  const { payer, payer_groom_pct } = parsePayerSplit(form);
  const rawDay = parseInt(String(form.get("day_of_month") ?? ""), 10);
  const day_of_month = !isNaN(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : null;

  if (!name) return { error: "Please enter a name." };
  if (isNaN(amount) || amount < 0) return { error: "Please enter a valid amount." };
  if (already_paid > amount) return { error: "Amount already paid cannot exceed total cost." };
  if (!target_month) return { error: "Please select a target month." };
  if (!VALID_PERSONS.includes(payer)) return { error: "Invalid payer." };

  return { name, amount, already_paid, category, target_month, payer, payer_groom_pct, scheduled, day_of_month, notes };
}

// ---- Purchase options ----------------------------------------------------

type ParsedOption = {
  label: string;
  amount: number;
  link: string | null;
  notes: string | null;
  groom_like: boolean;
  bride_like: boolean;
};

/** Parse the inline options editor payload. Returns the cleaned list and the
 *  index of the chosen option (defaults to the first when unset). */
function parseOptions(form: FormData): { options: ParsedOption[]; chosenIndex: number } {
  const raw = String(form.get("options_json") ?? "").trim();
  if (!raw) return { options: [], chosenIndex: -1 };
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return { options: [], chosenIndex: -1 }; }
  if (!Array.isArray(arr)) return { options: [], chosenIndex: -1 };

  const options: ParsedOption[] = arr
    .map((o) => {
      const r = o as Record<string, unknown>;
      return {
        label: String(r.label ?? "").trim(),
        amount: Number(r.amount) || 0,
        link: String(r.link ?? "").trim() || null,
        notes: String(r.notes ?? "").trim() || null,
        groom_like: Boolean(r.groom_like),
        bride_like: Boolean(r.bride_like),
      };
    })
    .filter((o) => o.label.length > 0 && o.amount >= 0);

  let chosenIndex = parseInt(String(form.get("chosen_index") ?? ""), 10);
  if (isNaN(chosenIndex) || chosenIndex < 0 || chosenIndex >= options.length) {
    chosenIndex = options.length > 0 ? 0 : -1;
  }
  return { options, chosenIndex };
}

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;

/** Replace the option set for a purchase. Returns the inserted rows (in order),
 *  the chosen option's id and its amount. Inserts sequentially so row order —
 *  and therefore the chosen index — is reliable. */
async function persistOptions(
  supabase: SupabaseClient,
  purchaseId: string,
  options: ParsedOption[],
  chosenIndex: number,
): Promise<{ selectedId: string | null; amount: number | null; rows: LifePurchaseOptionRow[] }> {
  // Clear the FK first, then wipe the old options so we start from a clean slate.
  await supabase.from("life_purchases").update({ selected_option_id: null } as never).eq("id", purchaseId);
  await supabase.from("life_purchase_options").delete().eq("purchase_id", purchaseId);

  if (options.length === 0) return { selectedId: null, amount: null, rows: [] };

  const rows: LifePurchaseOptionRow[] = [];
  for (const o of options) {
    const { data, error } = await supabase
      .from("life_purchase_options")
      .insert({ ...o, purchase_id: purchaseId } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    rows.push(data as LifePurchaseOptionRow);
  }
  const chosen = rows[chosenIndex] ?? rows[0] ?? null;
  return { selectedId: chosen?.id ?? null, amount: chosen ? Number(chosen.amount) : null, rows };
}

export async function createPurchase(_prev: unknown, form: FormData) {
  const { options, chosenIndex } = parseOptions(form);
  const hasOptions = String(form.get("has_options") ?? "") === "true" && options.length > 0;
  const amountOverride = hasOptions ? (options[chosenIndex >= 0 ? chosenIndex : 0]?.amount ?? 0) : undefined;

  const parsed = parsePurchase(form, amountOverride);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("life_purchases").insert(parsed as never).select().single();
  if (error) return { error: error.message };

  let purchase = data as LifePurchaseRow;
  let optionRows: LifePurchaseOptionRow[] = [];
  if (hasOptions) {
    try {
      const res = await persistOptions(supabase, purchase.id, options, chosenIndex);
      optionRows = res.rows;
      const { data: upd, error: e2 } = await supabase
        .from("life_purchases")
        .update({ selected_option_id: res.selectedId, amount: res.amount ?? purchase.amount } as never)
        .eq("id", purchase.id)
        .select()
        .single();
      if (e2) return { error: e2.message };
      purchase = upd as LifePurchaseRow;
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
  return { ok: true as const, data: purchase, options: optionRows };
}

export async function updatePurchase(id: string, _prev: unknown, form: FormData) {
  const { options, chosenIndex } = parseOptions(form);
  const hasOptions = String(form.get("has_options") ?? "") === "true" && options.length > 0;
  const amountOverride = hasOptions ? (options[chosenIndex >= 0 ? chosenIndex : 0]?.amount ?? 0) : undefined;

  const parsed = parsePurchase(form, amountOverride);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createSupabaseServerClient();

  // Reconcile options first (clearing them when options mode is off) so the
  // selected_option_id can be written in the same purchase update.
  let optionRows: LifePurchaseOptionRow[] = [];
  let selectedId: string | null = null;
  try {
    const res = await persistOptions(supabase, id, hasOptions ? options : [], chosenIndex);
    optionRows = res.rows;
    selectedId = res.selectedId;
  } catch (err) {
    return { error: (err as Error).message };
  }

  const { data, error } = await supabase
    .from("life_purchases")
    .update({ ...parsed, selected_option_id: selectedId } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data: data as LifePurchaseRow, options: optionRows };
}

/** Switch the chosen option for a purchase and mirror its price into the
 *  purchase amount so the projection/calendar update everywhere. */
export async function selectPurchaseOption(purchaseId: string, optionId: string) {
  const supabase = createSupabaseServerClient();
  const { data: opt, error: e1 } = await supabase
    .from("life_purchase_options")
    .select("amount")
    .eq("id", optionId)
    .single();
  if (e1) return { error: e1.message };
  const amount = Number((opt as { amount: number }).amount);
  const { error } = await supabase
    .from("life_purchases")
    .update({ selected_option_id: optionId, amount } as never)
    .eq("id", purchaseId);
  if (error) return { error: error.message };
  return { ok: true as const, amount };
}

/** Toggle a partner's "like" on a single option. */
export async function setPurchaseOptionLike(optionId: string, who: "groom" | "bride", liked: boolean) {
  const supabase = createSupabaseServerClient();
  const patch = who === "groom" ? { groom_like: liked } : { bride_like: liked };
  const { error } = await supabase.from("life_purchase_options").update(patch as never).eq("id", optionId);
  if (error) return { error: error.message };
  return {};
}

export async function togglePurchaseScheduled(id: string, scheduled: boolean) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("life_purchases")
    .update({ scheduled } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}

export async function deletePurchase(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("life_purchases").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ---- Assign day_of_month -------------------------------------------------

export async function assignDayOfMonth(
  table: "life_income" | "life_expenses" | "life_purchases",
  id: string,
  day: number | null,
) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(table).update({ day_of_month: day } as never).eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ---- Settings ------------------------------------------------------------

export async function updateSettings(form: FormData) {
  const start_month = trimMonth(form.get("start_month")) ?? "2026-09";
  const horizon_months = Math.max(6, Math.min(60, parseInt(String(form.get("horizon_months") ?? "24"), 10) || 24));
  const starting_cash_mode = String(form.get("starting_cash_mode") ?? "from_wedding") as StartingCashMode;
  const starting_cash_manual = Math.max(0, parseFloat(String(form.get("starting_cash_manual") ?? "0")) || 0);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("life_settings")
    .update({ start_month, horizon_months, starting_cash_mode, starting_cash_manual } as never)
    .eq("id", true)
    .select()
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, data };
}
