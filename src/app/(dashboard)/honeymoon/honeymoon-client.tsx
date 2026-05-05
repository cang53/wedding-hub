"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { HoneymoonRow } from "@/types/db";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createDestination, deleteDestination, toggleFavorite, updateDestination, uploadHoneymoonImages, deleteHoneymoonImage } from "./actions";

interface Props {
  initialItems: HoneymoonRow[];
}

export function HoneymoonClient({ initialItems }: Props) {
  const [items, setItems] = useState<HoneymoonRow[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HoneymoonRow | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("honeymoon:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "honeymoon" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as HoneymoonRow;
          setItems((prev) => prev.some((i) => i.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as HoneymoonRow;
          setItems((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as HoneymoonRow;
          setItems((prev) => prev.filter((i) => i.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const sorted = [...items].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  const handleToggleFav = (item: HoneymoonRow) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, favorite: !i.favorite } : i)));
    startTransition(() => { toggleFavorite(item.id, !item.favorite); });
  };

  const handleDelete = (item: HoneymoonRow) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(() => { deleteDestination(item.id); });
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            The <em>honeymoon</em>
          </h2>
          <p className="text-sm text-ink-soft">Where we&rsquo;ll celebrate after the I do&rsquo;s.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ New destination</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="destinations-grid">
          {sorted.map((d) => (
            <div key={d.id} className={`dest-card${d.favorite ? " favorited" : ""}`}>
              <button
                type="button"
                className="heart"
                onClick={() => handleToggleFav(d)}
                aria-label={d.favorite ? "Remove from favourites" : "Add to favourites"}
              >
                {d.favorite ? "♥" : "♡"}
              </button>
              <h4
                className="cursor-pointer hover:text-burgundy transition-colors"
                onClick={() => { setEditing(d); setDialogOpen(true); }}
              >
                {d.name}
              </h4>
              {d.country && <div className="location">{d.country}</div>}
              <div className="stats">
                {d.budget != null && (
                  <div className="stat-mini">
                    <span className="k">Budget</span>
                    <span className="v">{formatMoney(d.budget)}</span>
                  </div>
                )}
                {d.duration && (
                  <div className="stat-mini">
                    <span className="k">Duration</span>
                    <span className="v">{d.duration}</span>
                  </div>
                )}
                {d.best_time && (
                  <div className="stat-mini">
                    <span className="k">Best time</span>
                    <span className="v">{d.best_time}</span>
                  </div>
                )}
                {d.start_date && (
                  <div className="stat-mini">
                    <span className="k">Trip dates</span>
                    <span className="v">{new Date(d.start_date).toLocaleDateString("en-GB", { month: "short", day: "numeric" })} {d.end_date ? `- ${new Date(d.end_date).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}` : ""}</span>
                  </div>
                )}
              </div>
              {d.images && (() => {
                const images = JSON.parse(d.images) as string[];
                return images.length > 0 && (
                  <div className="gallery">
                    {images.map((url, i) => (
                      <div key={i} className="gallery-item">
                        <img src={url} alt="destination" />
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this image?")) {
                              startTransition(() => {
                                deleteHoneymoonImage(d.id, url).then((result) => {
                                  if (result.ok && result.data) {
                                    setItems((prev) => prev.map((i) => (i.id === result.data!.id ? result.data! : i)));
                                  }
                                });
                              });
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {d.notes && <div className="notes">{d.notes}</div>}
              <div className="actions">
                {d.link && (
                  <a href={d.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    View
                  </a>
                )}
                <Button variant="danger" size="sm" onClick={() => handleDelete(d)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <HoneymoonDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        setEditing={setEditing}
        onSaved={(item) => {
          setItems((prev) => {
            const exists = prev.some((i) => i.id === item.id);
            return exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
          });
        }}
      />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-15 px-5 text-ink-soft">
      <div className="empty-ornament mb-3">✈</div>
      <p className="font-serif italic text-[22px]">No destinations yet.</p>
      <p className="text-[13px] mt-2">Where shall we go?</p>
    </div>
  );
}

function HoneymoonDialog({
  open, onOpenChange, editing, setEditing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: HoneymoonRow | null;
  setEditing: (item: HoneymoonRow | null) => void;
  onSaved: (item: HoneymoonRow) => void;
}) {
  const [, startTransition] = useTransition();
  const action = editing ? updateDestination.bind(null, editing.id) : createDestination;
  const [state, formAction, pending] = useActionState<{ error?: string; ok?: true; data?: HoneymoonRow } | null, FormData>(action, null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);

  const handleFormSubmit = (formData: FormData) => {
    const imagesInput = document.getElementById("images") as HTMLInputElement;
    const files = imagesInput?.files ? Array.from(imagesInput.files) : [];
    setPendingImages(files);
    formAction(formData);
  };

  useEffect(() => {
    if (!state?.ok || !state?.data) return;

    if (pendingImages.length > 0) {
      const uploadFormData = new FormData();
      pendingImages.forEach(file => uploadFormData.append("images", file));

      startTransition(() => {
        uploadHoneymoonImages(state.data!.id, uploadFormData).then((result) => {
          if (result.ok && result.data) {
            onSaved(result.data);
            onOpenChange(false);
            setPendingImages([]);
          }
        });
      });
    } else {
      onSaved(state.data);
      onOpenChange(false);
    }
  }, [state?.ok, state?.data?.id, pendingImages.length, onOpenChange, onSaved]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>destination</em></> : <>New <em>destination</em></>}</DialogTitle>
          <DialogDescription>Where could we go?</DialogDescription>
        </DialogHeader>

        <form action={handleFormSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Place name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Punta Cana" required autoFocus />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="country">Country / region</Label>
            <Input id="country" name="country" defaultValue={editing?.country ?? ""} placeholder="e.g. Dominican Republic" />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="budget">Budget per person (€)</Label>
              <Input id="budget" name="budget" type="number" min="0" defaultValue={editing?.budget ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration">Duration</Label>
              <Input id="duration" name="duration" defaultValue={editing?.duration ?? ""} placeholder="e.g. 10 days" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="best_time">Best time to visit (optional)</Label>
            <Input id="best_time" name="best_time" defaultValue={editing?.best_time ?? ""} placeholder="e.g. November" />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_date">Trip start date (optional)</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={editing?.start_date ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end_date">Trip end date (optional)</Label>
              <Input id="end_date" name="end_date" type="date" defaultValue={editing?.end_date ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes / what we love about it</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="link">Link (optional)</Label>
            <Input id="link" name="link" type="url" defaultValue={editing?.link ?? ""} placeholder="https://…" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="images">Add images</Label>
            <input id="images" type="file" multiple accept="image/*" className="block w-full text-sm text-ink-soft file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-cream-deep file:text-ink hover:file:bg-cream" />
            <p className="text-xs text-ink-soft">Upload one or more images for this destination</p>
          </div>

          {editing && editing.images && (() => {
            const currentImages = JSON.parse(editing.images) as string[];
            return currentImages.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Current images</p>
                <div className="gallery">
                  {currentImages.map((url, i) => (
                    <div key={i} className="gallery-item">
                      <img src={url} alt="destination" />
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          if (confirm("Delete this image?")) {
                            startTransition(() => {
                              deleteHoneymoonImage(editing.id, url).then((result) => {
                                if (result.ok && result.data) {
                                  setEditing(result.data);
                                }
                              });
                            });
                          }
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : pendingImages.length > 0 ? "Save & Upload" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
