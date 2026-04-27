"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TodoCategory, TodoPriority, TodoRow } from "@/types/db";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createTodo, deleteTodo, toggleTodo, updateTodo } from "./actions";

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

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

  // ---- Realtime subscription -----------------------------------------------

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("todos:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as TodoRow;
            setTodos((prev) =>
              prev.some((t) => t.id === row.id) ? prev : [row, ...prev]
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as TodoRow;
            setTodos((prev) => prev.map((t) => (t.id === row.id ? row : t)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as TodoRow;
            setTodos((prev) => prev.filter((t) => t.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---- Filtering / sorting --------------------------------------------------

  const filtered = useMemo(() => {
    return todos
      .filter((t) => {
        if (search && !t.text.toLowerCase().includes(search.toLowerCase()))
          return false;
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

  // ---- Actions --------------------------------------------------------------

  const [, startTransition] = useTransition();

  const handleToggle = (todo: TodoRow) => {
    // Optimistic flip — realtime will reconfirm with the same value.
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t))
    );
    startTransition(() => {
      toggleTodo(todo.id, !todo.done);
    });
  };

  const handleDelete = (todo: TodoRow) => {
    if (!confirm(`Delete "${todo.text}"?`)) return;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    startTransition(() => {
      deleteTodo(todo.id);
    });
  };

  const handleEdit = (todo: TodoRow) => {
    setEditing(todo);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Panel header */}
      <div className="flex items-end justify-between mb-8 pb-5 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
        <div>
          <h2 className="font-serif text-[42px] font-normal leading-none tracking-[-0.01em] mb-2">
            To-<em>do</em>
          </h2>
          <p className="text-sm text-ink-soft">What&rsquo;s next on our list.</p>
        </div>
        <Button onClick={handleNew}>+ New task</Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <Input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px]"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="list-none">
          {filtered.map((t) => (
            <li
              key={t.id}
              className={`flex items-start gap-4 p-5 bg-paper border border-line rounded-[4px] mb-2.5 transition-shadow duration-200 hover:shadow-soft ${
                t.done ? "opacity-55" : ""
              }`}
            >
              <Checkbox
                checked={t.done}
                onCheckedChange={() => handleToggle(t)}
                className="mt-0.5"
                aria-label={t.done ? "Mark as not done" : "Mark as done"}
              />
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => handleEdit(t)}
                  className={`text-[15px] text-ink font-medium mb-1 text-left hover:text-burgundy transition-colors ${
                    t.done ? "line-through" : ""
                  }`}
                >
                  {t.text}
                </button>
                <div className="flex flex-wrap gap-3 text-xs text-ink-soft items-center">
                  <span className={`tag tag-${t.category}`}>{t.category}</span>
                  <span className={`priority-${t.priority}`}>
                    {t.priority.toUpperCase()} priority
                  </span>
                  {t.due_date && <span>Due {formatDate(t.due_date)}</span>}
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(t)}
                className="self-center"
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <TodoDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
      />
    </section>
  );
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-15 px-5 text-ink-soft">
      <div className="empty-ornament mb-3">∅</div>
      <p className="font-serif italic text-[22px]">No tasks here yet.</p>
      <p className="text-[13px] mt-2">Add your first one to get started.</p>
    </div>
  );
}

// ============================================================================
// Dialog (add/edit)
// ============================================================================

function TodoDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TodoRow | null;
}) {
  const action = editing
    ? updateTodo.bind(null, editing.id)
    : createTodo;
  const isEdit = editing !== null;

  const [state, formAction, pending] = useActionState<
    { error?: string; ok?: true } | null,
    FormData
  >(action, null);

  // Close dialog on success.
  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? (
              <>
                Edit <em>task</em>
              </>
            ) : (
              <>
                New <em>task</em>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update what needs doing." : "Add something to your list."}
          </DialogDescription>
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
              {/* Hidden input for the form payload — Radix Select doesn't write to FormData on its own */}
              <SelectFormField
                name="category"
                defaultValue={editing?.category ?? "wedding"}
                options={CATEGORY_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Priority</Label>
              <SelectFormField
                name="priority"
                defaultValue={editing?.priority ?? "medium"}
                options={PRIORITY_OPTIONS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="due_date">Due date (optional)</Label>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={editing?.due_date ?? ""}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-burgundy">{state.error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Helper: Select that writes its value into a hidden <input name=...> so the
// form action receives it via FormData.
// ============================================================================

function SelectFormField({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue);

  // Keep the controlled value in sync when `defaultValue` (prop) changes
  // e.g. when opening the dialog to edit a different todo.
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
