"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TodoCategory, TodoPriority, TodoRow } from "@/types/db";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { usePageHeader } from "@/components/shell/header-context";
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
import { ActionError } from "@/components/action-error";
import { createTodo, deleteTodo, toggleTodo, updateTodo } from "./actions";

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: "var(--accent)", medium: "var(--fg2)", low: "var(--fg3)",
};

const CATEGORY_OPTIONS: { value: TodoCategory; label: string }[] = [
  { value: "wedding", label: "Wedding" },
  { value: "honeymoon", label: "Honeymoon" },
  { value: "home", label: "Home" },
  { value: "personal", label: "Personal" },
];

const PRIORITY_OPTIONS: { value: TodoPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface Props {
  initialTodos: TodoRow[];
}

export function TodoClient({ initialTodos }: Props) {
  const [todos, setTodos] = useState<TodoRow[]>(initialTodos);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TodoRow | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("todos:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as TodoRow;
          setTodos((prev) => prev.some((t) => t.id === row.id) ? prev : [row, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as TodoRow;
          setTodos((prev) => prev.map((t) => (t.id === row.id ? row : t)));
        } else if (payload.eventType === "DELETE") {
          const row = payload.old as TodoRow;
          setTodos((prev) => prev.filter((t) => t.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    return todos
      .filter((t) => {
        if (search && !t.text.toLowerCase().includes(search.toLowerCase())) return false;
        if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
        if (statusFilter === "open" && t.done) return false;
        if (statusFilter === "done" && !t.done) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
      });
  }, [todos, search, categoryFilter, statusFilter]);

  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleToggle = (todo: TodoRow) => {
    // Optimistic flip — realtime will reconfirm with the same value.
    const rollback = todos;
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t))
    );
    startTransition(async () => {
      const { error } = await toggleTodo(todo.id, !todo.done);
      if (error) {
        setTodos(rollback);
        setActionError(error);
      }
    });
  };

  const handleDelete = (todo: TodoRow) => {
    if (!confirm(`Delete "${todo.text}"?`)) return;
    const rollback = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    startTransition(async () => {
      const { error } = await deleteTodo(todo.id);
      if (error) {
        setTodos(rollback);
        setActionError(error);
      }
    });
  };

  const handleEdit = (todo: TodoRow) => { setEditing(todo); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };

  usePageHeader("New task", handleNew);

  return (
    <section className="font-apple flex flex-col gap-6 text-[var(--fg)]">
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[240px] flex-1"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="px-1 py-16 text-center">
          <p className="text-[17px] text-[var(--fg2)]">No tasks here yet.</p>
          <p className="mt-2 text-[14px] text-[var(--fg3)]">Add your first one to get started.</p>
        </div>
      ) : (
        <ListGroup>
          {filtered.map((t) => (
            <ListRow key={t.id} className="group">
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                aria-label={t.done ? "Mark as not done" : "Mark as done"}
                onClick={() => handleToggle(t)}
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] text-[12px] font-bold text-white"
                style={{ borderColor: t.done ? "var(--accent)" : "var(--sep)", background: t.done ? "var(--accent)" : "transparent" }}
              >
                {t.done ? "✓" : ""}
              </button>
              <button
                type="button"
                onClick={() => handleEdit(t)}
                className="min-w-0 flex-1 text-left"
              >
                <div
                  className="text-[17px] tracking-[-0.014em]"
                  style={t.done ? { color: "var(--fg3)", textDecoration: "line-through" } : undefined}
                >
                  {t.text}
                </div>
                <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">
                  {t.category} · {t.priority}{t.due_date ? ` · Due ${formatDate(t.due_date)}` : ""}
                </div>
              </button>
              <span
                className="text-[14px] whitespace-nowrap"
                style={{ color: PRIORITY_COLOR[t.priority], opacity: t.done ? 0.4 : 1 }}
              >
                {t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low"}
              </span>
              <button
                type="button"
                aria-label="Delete task"
                onClick={() => handleDelete(t)}
                className="text-[15px] leading-none text-[var(--fg3)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--accent)]"
              >
                ×
              </button>
            </ListRow>
          ))}
        </ListGroup>
      )}

      <TodoDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        editing={editing}
      />
    </section>
  );
}

// ============================================================================
// Dialog (add/edit) — restyled with the rest of the shared dialogs later
// ============================================================================

function TodoDialog({
  open, onOpenChange, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TodoRow | null;
}) {
  const action = editing ? updateTodo.bind(null, editing.id) : createTodo;
  const isEdit = editing !== null;

  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true } | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? <>Edit <em>task</em></> : <>New <em>task</em></>}</DialogTitle>
          <DialogDescription>{isEdit ? "Update what needs doing." : "Add something to your list."}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="text">What needs doing?</Label>
            <Input
              id="text"
              name="text"
              defaultValue={editing?.text ?? ""}
              placeholder="e.g. Book wedding venue"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <SelectFormField name="category" defaultValue={editing?.category ?? "wedding"} options={CATEGORY_OPTIONS} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Priority</Label>
              <SelectFormField name="priority" defaultValue={editing?.priority ?? "medium"} options={PRIORITY_OPTIONS} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="due_date">Due date (optional)</Label>
            <Input id="due_date" name="due_date" type="date" defaultValue={editing?.due_date ?? ""} />
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

function SelectFormField({
  name, defaultValue, options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue);

  // Keep the controlled value in sync when `defaultValue` (prop) changes,
  // e.g. when opening the dialog to edit a different todo. Adjusting state
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
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );
}
