"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BudgetRow, BudgetStatus } from "@/types/db";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const CATEGORIES = [
  "Venue", "Catering", "Photography", "Music", "Attire", "Flowers",
  "Stationery", "Rings", "Transport", "Beauty", "Decoration", "Other",
];

const STATUS_OPTIONS: { value: BudgetStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "deposit", label: "Deposit paid" },
  { value: "paid", label: "Fully paid" },
];

interface Props {
  initialItems: BudgetRow[];
}

export function BudgetClient({ initialItems }: Props) {
  const [items, setItems] = useState<BudgetRow[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("budget:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "budget" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as BudgetRow;
          setItems((prev) => prev.some((i) => i.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as BudgetRow;
          setItems((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as BudgetRow;
          setItems((prev) => prev.filter((i) => i.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalEst = items.reduce((a, b) => a + (b.estimated ?? 0), 0);
  const totalPaid = items.reduce((a, b) => a + (b.paid ?? 0), 0);
  const remaining = totalEst - totalPaid;
  const pct = totalEst > 0 ? Math.min(100, (totalPaid / totalEst) * 100) : 0;

  const sorted = [...items].sort((a, b) => (b.estimated ?? 0) - (a.estimated ?? 0));

  const handleDelete = (item: BudgetRow) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteBudgetItem(item.id); });
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Panel header */}
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>budget</em>
          </h2>
          <p className="text-sm text-ink-soft">Track wedding expenses and what&rsquo;s left to pay.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ New expense</Button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-4 gap-4 mb-8 max-md:grid-cols-2">
        <div className="stat-card">
          <div className="label">Total estimated</div>
          <div className="value"><em>{formatMoney(totalEst)}</em></div>
          <div className="meta">{items.length} line items</div>
        </div>
        <div className="stat-card">
          <div className="label">Total paid</div>
          <div className="value">{formatMoney(totalPaid)}</div>
          <div className="budget-bar mt-4">
            <div className="budget-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Remaining</div>
          <div className="value"><em>{formatMoney(remaining)}</em></div>
          <div className="meta">{pct.toFixed(0)}% of budget paid</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending items</div>
          <div className="value"><em>{items.filter((b) => b.status === "pending").length}</em></div>
          <div className="meta">{items.filter((b) => b.status === "paid").length} fully paid</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-paper border border-line rounded-[4px] shadow-soft p-7">
        {items.length === 0 ? (
          <EmptyState />
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
                        onClick={() => { setEditing(b); setDialogOpen(true); }}
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
                      <Button variant="danger" size="sm" onClick={() => handleDelete(b)}>×</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
      />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-15 px-5 text-ink-soft">
      <div className="empty-ornament mb-3">€</div>
      <p className="font-serif italic text-[22px]">No expenses tracked yet.</p>
      <p className="text-[13px] mt-2">Add the venue, dress, catering — anything that costs.</p>
    </div>
  );
}

function SelectField({
  name, defaultValue, options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue);
  // Reset when defaultValue changes (edit vs new dialog).
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
  open, onOpenChange, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: BudgetRow | null;
}) {
  const action = editing ? updateBudgetItem.bind(null, editing.id) : createBudgetItem;
  const [state, formAction, pending] = useActionState<{ error?: string; ok?: true } | null, FormData>(action, null);

  useEffect(() => { if (state?.ok) onOpenChange(false); }, [state, onOpenChange]);

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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
