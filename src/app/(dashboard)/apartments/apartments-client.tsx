"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApartmentRow, ApartmentStatus } from "@/types/db";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createApartment, deleteApartment, updateApartment } from "./actions";

const STATUS_OPTIONS: { value: ApartmentStatus; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "visited", label: "Visited" },
  { value: "applied", label: "Applied" },
  { value: "rejected", label: "Rejected" },
];

interface Props {
  initialItems: ApartmentRow[];
}

export function ApartmentsClient({ initialItems }: Props) {
  const [items, setItems] = useState<ApartmentRow[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApartmentRow | null>(null);
  const [, startTransition] = useTransition();

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
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteApartment(item.id); });
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            Our <em>future home</em>
          </h2>
          <p className="text-sm text-ink-soft">Apartments to consider before September.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ New listing</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {sorted.map((a) => (
            <div key={a.id} className="apt-card mb-3.5">
              <div>
                <h4 className="font-serif text-2xl font-medium mb-1">
                  {a.link ? (
                    <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-burgundy no-underline hover:underline">
                      {a.title}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="text-left hover:text-burgundy transition-colors"
                      onClick={() => { setEditing(a); setDialogOpen(true); }}
                    >
                      {a.title}
                    </button>
                  )}
                </h4>
                {a.address && <div className="addr">{a.address}</div>}
                <div className="specs">
                  {a.rent != null && (
                    <span><strong className="font-serif text-lg text-burgundy font-medium">{formatMoney(a.rent)}</strong>/mo</span>
                  )}
                  {a.size != null && (
                    <span><strong className="font-serif text-lg text-burgundy font-medium">{a.size}</strong> m²</span>
                  )}
                  {a.bedrooms != null && (
                    <span><strong className="font-serif text-lg text-burgundy font-medium">{a.bedrooms}</strong> bed</span>
                  )}
                  {a.charges != null && (
                    <span>+{formatMoney(a.charges)} charges</span>
                  )}
                </div>
                {a.pros && <div className="pros">+ {a.pros}</div>}
                {a.cons && <div className="cons">– {a.cons}</div>}
              </div>
              <div className="right">
                <span className={`apt-status apt-status-${a.status}`}>{a.status}</span>
                <div className="apt-rating" style={{ color: "var(--gold)", fontSize: "16px", letterSpacing: "2px" }}>
                  {"★".repeat(a.rating ?? 0)}{"☆".repeat(5 - (a.rating ?? 0))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditing(a); setDialogOpen(true); }}
                >
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(a)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ApartmentDialog
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
      <div className="empty-ornament mb-3">⌂</div>
      <p className="font-serif italic text-[22px]">No listings yet.</p>
      <p className="text-[13px] mt-2">Add the apartments you&rsquo;re considering.</p>
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
