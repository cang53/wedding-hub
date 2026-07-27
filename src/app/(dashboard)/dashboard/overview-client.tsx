"use client";

import { useState, useTransition } from "react";
import { WEDDING_DATE, WEDDING_LOCATION } from "@/lib/config";
import { daysUntil, formatDateLong, formatDateShort, formatTime } from "@/lib/utils";
import type { TodoPriority } from "@/types/db";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toggleTodo } from "../todo/actions";

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  all_day: boolean;
  location: string | null;
}

interface TaskItem {
  id: string;
  text: string;
  priority: TodoPriority;
}

interface RingStat {
  value: number;
  total: number;
  caption: string;
}

interface Props {
  rings: { guests: RingStat; tasks: RingStat; budget: RingStat };
  facts: { label: string; value: string }[];
  upcoming: AgendaItem[];
  visibleTasks: TaskItem[];
  otherOpenCount: number;
}

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: "var(--accent)",
  medium: "var(--fg2)",
  low: "var(--fg3)",
};

/** "Today" / "Tomorrow" / "In 4 days" / "12 Aug" — a countdown reads more
 *  urgently than a bare date for anything happening this week. */
function relativeDay(iso: string): string {
  const days = daysUntil(iso);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return formatDateShort(iso);
}

export function OverviewClient({ rings, facts, upcoming, visibleTasks, otherOpenCount }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const days = Math.max(0, daysUntil(WEDDING_DATE));
  const weeks = Math.floor(days / 7);
  const openCount = otherOpenCount + visibleTasks.filter((t) => !done[t.id]).length;
  const tasksLabel = openCount === 0 ? "All done" : `${openCount} task${openCount === 1 ? "" : "s"} open`;

  const toggle = (id: string) => {
    const next = !done[id];
    setDone((prev) => ({ ...prev, [id]: next }));
    startTransition(() => { toggleTodo(id, next); });
  };

  return (
    <section className="font-apple flex flex-col gap-[30px] text-[var(--fg)]">
      <div className="px-1 pt-1.5">
        <div className="flex items-baseline gap-3">
          <span className="text-[clamp(60px,10vw,96px)] leading-[0.86] font-bold tracking-[-0.05em] tabular-nums">
            {days}
          </span>
          <span className="text-[clamp(19px,2.4vw,26px)] font-semibold tracking-[-0.02em] text-[var(--fg2)]">
            days to go
          </span>
        </div>
        <div className="mt-3.5 text-[16px] tracking-[-0.012em] text-[var(--fg2)]">
          {formatDateLong(WEDDING_DATE).replace(",", "")} · {WEDDING_LOCATION}
          {weeks > 0 && <span className="text-[var(--fg3)]"> · about {weeks} weeks</span>}
        </div>
      </div>

      {/* Live progress on the three things that actually have a finish line */}
      <div className="grid grid-cols-3 gap-3 rounded-[12px] bg-[var(--card)] px-4 py-6 max-sm:grid-cols-1 max-sm:gap-6">
        <ProgressRing
          value={rings.guests.value}
          total={rings.guests.total}
          label="RSVPs in"
          caption={rings.guests.caption}
          color="var(--green)"
        />
        <ProgressRing
          value={rings.tasks.value}
          total={rings.tasks.total}
          label="Tasks done"
          caption={rings.tasks.caption}
          color="var(--accent)"
        />
        <ProgressRing
          value={rings.budget.value}
          total={rings.budget.total}
          label="Budget paid"
          caption={rings.budget.caption}
          color="var(--amber)"
        />
      </div>

      <ListGroup label="Where things stand">
        {facts.map((f) => (
          <ListRow key={f.label}>
            <span className="text-[17px] tracking-[-0.014em]">{f.label}</span>
            <span className="ml-auto text-[17px] tracking-[-0.014em] text-[var(--fg2)] tabular-nums">{f.value}</span>
          </ListRow>
        ))}
      </ListGroup>

      <ListGroup label="Next up">
        {upcoming.length === 0 ? (
          <ListRow>
            <span className="text-[15px] text-[var(--fg2)]">No upcoming events.</span>
          </ListRow>
        ) : (
          upcoming.map((e) => {
            const sub = [e.location, !e.all_day && formatTime(e.date)].filter(Boolean).join(" · ");
            const soon = daysUntil(e.date) <= 7;
            return (
              <ListRow key={e.id}>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] tracking-[-0.014em]">{e.title}</div>
                  {sub && <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">{sub}</div>}
                </div>
                <span
                  className="ml-auto text-[15px] whitespace-nowrap"
                  style={{ color: soon ? "var(--accent)" : "var(--fg2)" }}
                >
                  {relativeDay(e.date)}
                </span>
              </ListRow>
            );
          })
        )}
      </ListGroup>

      <ListGroup label={tasksLabel}>
        {visibleTasks.length === 0 ? (
          <ListRow>
            <span className="text-[15px] text-[var(--fg2)]">Nothing on the list.</span>
          </ListRow>
        ) : (
          visibleTasks.map((t) => {
            const checked = !!done[t.id];
            return (
              <ListRow
                key={t.id}
                as="button"
                interactive
                role="checkbox"
                aria-checked={checked}
                aria-label={t.text}
                onClick={() => toggle(t.id)}
              >
                <span
                  className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] text-[12px] font-bold text-white transition-colors"
                  style={{
                    borderColor: checked ? "var(--accent)" : "var(--sep)",
                    background: checked ? "var(--accent)" : "transparent",
                  }}
                >
                  {checked ? "✓" : ""}
                </span>
                <span
                  className="flex-1 text-[17px] tracking-[-0.014em]"
                  style={checked ? { color: "var(--fg3)", textDecoration: "line-through" } : undefined}
                >
                  {t.text}
                </span>
                <span
                  className="text-[14px] whitespace-nowrap"
                  style={{ color: PRIORITY_COLOR[t.priority], opacity: checked ? 0.4 : 1 }}
                >
                  {t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low"}
                </span>
              </ListRow>
            );
          })
        )}
      </ListGroup>
    </section>
  );
}
