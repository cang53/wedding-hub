"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
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

function getNights(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function getCountdown(start: string | null): number | null {
  if (!start) return null;
  const diff = new Date(start).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatTripDates(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!end) return s;
  const e = new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${s} → ${e}`;
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

  const openEdit = (d: HoneymoonRow) => { setEditing(d); setDialogOpen(true); };

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
        <div className="dest-grid">
          {sorted.map((d) => {
            const nights = getNights(d.start_date, d.end_date);
            const countdown = getCountdown(d.start_date);
            const images = (() => { try { return d.images ? JSON.parse(d.images) as string[] : []; } catch { return []; } })();
            const heroImage = images[0] ?? null;

            return (
              <article key={d.id} className={`dest-card2${d.favorite ? " is-fav" : ""}`}>
                {/* Hero */}
                <div className="dest-hero2" style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined} onClick={() => openEdit(d)}>
                  {!heroImage && (
                    <div className="dest-hero-placeholder2">
                      <span>{d.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="dest-hero-overlay2">
                    <div className="dest-hero-top2">
                      <button
                        type="button"
                        className="dest-heart2"
                        onClick={(e) => { e.stopPropagation(); handleToggleFav(d); }}
                        aria-label={d.favorite ? "Remove from favourites" : "Add to favourites"}
                      >
                        {d.favorite ? "♥" : "♡"}
                      </button>
                    </div>
                    <div className="dest-hero-bottom2">
                      <h4 className="dest-name2">{d.name}</h4>
                      {d.country && <p className="dest-country2">{d.country}</p>}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="dest-body2">
                  {/* Chips row */}
                  <div className="dest-chips2">
                    {d.budget != null && (
                      <span className="dest-chip2">
                        <span className="chip-icon">€</span>{formatMoney(d.budget)}<span className="chip-sub">/person</span>
                      </span>
                    )}
                    {nights != null ? (
                      <span className="dest-chip2">
                        <span className="chip-icon">🌙</span>{nights} nights
                      </span>
                    ) : d.duration ? (
                      <span className="dest-chip2">
                        <span className="chip-icon">⏱</span>{d.duration}
                      </span>
                    ) : null}
                    {d.best_time && !d.start_date && (
                      <span className="dest-chip2">
                        <span className="chip-icon">🌤</span>{d.best_time}
                      </span>
                    )}
                  </div>

                  {/* Trip dates */}
                  {d.start_date && (
                    <div className="dest-dates2">
                      <span className="dates-range">✈ {formatTripDates(d.start_date, d.end_date)}</span>
                      {countdown != null && (
                        <span className={`dates-countdown ${countdown <= 30 ? "soon" : ""}`}>
                          {countdown > 0 ? `${countdown}d to go` : countdown === 0 ? "Today!" : "Passed"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Extra images strip */}
                  {images.length > 1 && (
                    <div className="dest-images-strip">
                      {images.slice(1, 4).map((url, i) => (
                        <div key={i} className="strip-thumb" style={{ backgroundImage: `url(${url})` }}>
                          {i === 2 && images.length > 4 && (
                            <div className="strip-more">+{images.length - 4}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {d.notes && <p className="dest-notes2">&ldquo;{d.notes}&rdquo;</p>}

                  {/* Footer */}
                  <div className="dest-footer2">
                    <button className="dest-edit-btn" onClick={() => openEdit(d)}>Edit</button>
                    {d.link && (
                      <a href={d.link} target="_blank" rel="noopener noreferrer" className="dest-link-btn">
                        Explore ↗
                      </a>
                    )}
                    <button className="dest-delete-btn" onClick={() => handleDelete(d)}>✕</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <HoneymoonDialog
        key={editing?.id ?? "new"}
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
    <div className="text-center py-20 px-5 text-ink-soft">
      <div className="text-6xl mb-4 opacity-40">✈</div>
      <p className="font-serif italic text-[26px] text-ink mb-2">No destinations yet.</p>
      <p className="text-[13px]">Add your dream destinations and start planning your perfect honeymoon.</p>
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
  const pendingImagesRef = useRef<File[]>([]);
  const handledStateRef = useRef<string | null>(null);
  const [startDate, setStartDate] = useState(editing?.start_date ?? "");
  const [endDate, setEndDate] = useState(editing?.end_date ?? "");

  useEffect(() => {
    setStartDate(editing?.start_date ?? "");
    setEndDate(editing?.end_date ?? "");
  }, [editing?.id]);

  const nights = getNights(startDate || null, endDate || null);

  const handleFormSubmit = (formData: FormData) => {
    const imagesInput = document.getElementById("images") as HTMLInputElement;
    pendingImagesRef.current = imagesInput?.files ? Array.from(imagesInput.files) : [];
    handledStateRef.current = null;
    formAction(formData);
  };

  useEffect(() => {
    if (!state?.ok || !state?.data) return;
    if (handledStateRef.current === state.data.id) return;
    handledStateRef.current = state.data.id;

    const files = pendingImagesRef.current;
    if (files.length > 0) {
      const uploadFormData = new FormData();
      files.forEach(file => uploadFormData.append("images", file));
      pendingImagesRef.current = [];
      startTransition(() => {
        uploadHoneymoonImages(state.data!.id, uploadFormData).then((result) => {
          onSaved(result.ok && result.data ? result.data : state.data!);
          onOpenChange(false);
        });
      });
    } else {
      onSaved(state.data);
      onOpenChange(false);
    }
  }, [state?.ok, state?.data?.id]);

  const currentImages = (() => {
    try { return editing?.images ? JSON.parse(editing.images) as string[] : []; } catch { return []; }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? <>Edit <em>destination</em></> : <>New <em>destination</em></>}</DialogTitle>
          <DialogDescription>Dream it, plan it, book it.</DialogDescription>
        </DialogHeader>

        <form action={handleFormSubmit} className="flex flex-col gap-4 mt-2">
          {/* Core identity */}
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="col-span-2 flex flex-col gap-2 max-md:col-span-1">
              <Label htmlFor="name">Destination</Label>
              <Input id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Punta Cana" required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="country">Country / region</Label>
              <Input id="country" name="country" defaultValue={editing?.country ?? ""} placeholder="e.g. Dominican Republic" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="budget">Budget / person (€)</Label>
              <Input id="budget" name="budget" type="number" min="0" defaultValue={editing?.budget ?? ""} placeholder="0" />
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Trip dates</Label>
              {nights != null && nights > 0 && (
                <span className="text-xs text-ink-soft bg-cream-deep px-2 py-0.5 rounded">{nights} nights</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <Input
                id="start_date" name="start_date" type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                id="end_date" name="end_date" type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Extra details */}
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration">Duration (if no dates)</Label>
              <Input id="duration" name="duration" defaultValue={editing?.duration ?? ""} placeholder="e.g. 10 days" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="best_time">Best time to visit</Label>
              <Input id="best_time" name="best_time" defaultValue={editing?.best_time ?? ""} placeholder="e.g. November" />
            </div>
          </div>

          {/* Notes & link */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Why we love it</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} placeholder="What excites you about this place…" className="min-h-[72px]" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link">Link (optional)</Label>
            <Input id="link" name="link" type="url" defaultValue={editing?.link ?? ""} placeholder="https://…" />
          </div>

          {/* Images */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="images">Add photos</Label>
            <input id="images" type="file" multiple accept="image/*"
              className="block w-full text-sm text-ink-soft file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-cream-deep file:text-ink hover:file:bg-line cursor-pointer" />
          </div>

          {/* Current images */}
          {currentImages.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Current photos</Label>
              <div className="gallery">
                {currentImages.map((url, i) => (
                  <div key={i} className="gallery-item">
                    <img src={url} alt="destination" />
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm("Delete this photo?")) {
                          startTransition(() => {
                            deleteHoneymoonImage(editing!.id, url).then((result) => {
                              if (result.ok && result.data) setEditing(result.data);
                            });
                          });
                        }
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state?.error && <p className="text-sm text-burgundy">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add destination"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
