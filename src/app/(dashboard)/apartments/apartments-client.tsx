"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApartmentRow, ApartmentStatus } from "@/types/db";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { usePageHeader } from "@/components/shell/header-context";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ActionError } from "@/components/action-error";
import { createApartment, deleteApartment, updateApartment } from "./actions";

const STATUS_OPTIONS: { value: ApartmentStatus; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "visited", label: "Visited" },
  { value: "applied", label: "Applied" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_LABEL: Record<ApartmentStatus, string> = {
  interested: "Interested", visited: "Visited", applied: "Applied", rejected: "Rejected",
};

interface Props {
  initialItems: ApartmentRow[];
}

export function ApartmentsClient({ initialItems }: Props) {
  const [items, setItems] = useState<ApartmentRow[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApartmentRow | null>(null);
  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("apartments:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "apartments" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as ApartmentRow;
          setItems((prev) => prev.some((i) => i.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as ApartmentRow;
          setItems((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as ApartmentRow;
          setItems((prev) => prev.filter((i) => i.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const sorted = [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const handleDelete = (item: ApartmentRow) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const rollback = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      const { error } = await deleteApartment(item.id);
      if (error) {
        setItems(rollback);
        setActionError(error);
      }
    });
  };

  usePageHeader("New listing", () => { setEditing(null); setDialogOpen(true); });

  return (
    <section className="font-apple flex flex-col gap-6 text-[var(--fg)]">
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      {items.length === 0 ? (
        <div className="px-1 py-16 text-center">
          <p className="text-[17px] text-[var(--fg2)]">No listings yet.</p>
          <p className="mt-2 text-[14px] text-[var(--fg3)]">Add the apartments you&rsquo;re considering.</p>
        </div>
      ) : (
        <ListGroup>
          {sorted.map((a) => {
            const specs = [
              a.rent != null ? `${formatMoney(a.rent)}/mo` : null,
              a.size != null ? `${a.size} m²` : null,
              a.bedrooms != null ? `${a.bedrooms} bed` : null,
              a.charges != null ? `+${formatMoney(a.charges)} charges` : null,
            ].filter(Boolean).join(" · ");
            return (
              <ListRow key={a.id} align="start">
                <div className="min-w-0 flex-1">
                  {a.link ? (
                    <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-[17px] tracking-[-0.014em] text-[var(--accent)] hover:opacity-60">
                      {a.title}
                    </a>
                  ) : (
                    <div className="text-[17px] tracking-[-0.014em]">{a.title}</div>
                  )}
                  <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                    {[a.address, specs].filter(Boolean).join(" · ")}
                  </div>
                  {(a.pros || a.cons) && (
                    <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg3)]">
                      {[a.pros ? `+ ${a.pros}` : null, a.cons ? `− ${a.cons}` : null].filter(Boolean).join("  ")}
                    </div>
                  )}
                </div>
                <div className="ml-auto flex flex-none flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[14px] text-[var(--fg2)]">{STATUS_LABEL[a.status]}</span>
                    <span className="text-[13px] tracking-[0.05em] text-[var(--accent)]">
                      {"★".repeat(a.rating ?? 0)}
                      <span className="text-[var(--fg3)]">{"★".repeat(5 - (a.rating ?? 0))}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <button type="button" onClick={() => { setEditing(a); setDialogOpen(true); }} className="text-[15px] text-[var(--accent)] hover:opacity-60">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(a)} className="text-[15px] text-[var(--fg3)] hover:opacity-60">
                      Delete
                    </button>
                  </div>
                </div>
              </ListRow>
            );
          })}
        </ListGroup>
      )}

      <ApartmentDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
      />
    </section>
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
  // Re-sync when the dialog is reused for a different row. Adjusting state
  // during render is cheaper than an effect: React re-runs this component
  // before committing, so the stale value never reaches the DOM.
  const [syncedDefault, setSyncedDefault] = useState(defaultValue);
  if (syncedDefault !== defaultValue) {
    setSyncedDefault(defaultValue);
    setValue(defaultValue);
  }
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

function ApartmentDialog({
  open, onOpenChange, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ApartmentRow | null;
}) {
  const action = editing ? updateApartment.bind(null, editing.id) : createApartment;
  const [state, formAction, pending] = useActionState<{ error?: string; ok?: true } | null, FormData>(action, null);

  useEffect(() => { if (state?.ok) onOpenChange(false); }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>listing</em></> : <>New <em>listing</em></>}</DialogTitle>
          <DialogDescription>An apartment to consider.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title / nickname</Label>
            <Input id="title" name="title" defaultValue={editing?.title ?? ""} placeholder="e.g. Charleroi 2-bed near station" required autoFocus />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={editing?.address ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rent">Rent (€/mo)</Label>
              <Input id="rent" name="rent" type="number" min="0" defaultValue={editing?.rent ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="charges">Charges (€/mo)</Label>
              <Input id="charges" name="charges" type="number" min="0" defaultValue={editing?.charges ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="size">Size (m²)</Label>
              <Input id="size" name="size" type="number" min="0" defaultValue={editing?.size ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input id="bedrooms" name="bedrooms" type="number" min="0" defaultValue={editing?.bedrooms ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pros">Pros</Label>
            <Input id="pros" name="pros" defaultValue={editing?.pros ?? ""} placeholder="What we love about it" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cons">Cons</Label>
            <Input id="cons" name="cons" defaultValue={editing?.cons ?? ""} placeholder="What we're worried about" />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <SelectField
                name="status"
                defaultValue={editing?.status ?? "interested"}
                options={STATUS_OPTIONS}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Rating (0–5)</Label>
              <SelectField
                name="rating"
                defaultValue={String(editing?.rating ?? 0)}
                options={[
                  { value: "0", label: "— No rating" },
                  { value: "1", label: "★" },
                  { value: "2", label: "★★" },
                  { value: "3", label: "★★★" },
                  { value: "4", label: "★★★★" },
                  { value: "5", label: "★★★★★" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="link">Link (optional)</Label>
            <Input id="link" name="link" type="url" defaultValue={editing?.link ?? ""} placeholder="https://…" />
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
