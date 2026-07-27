"use client";

import { useState, useTransition } from "react";
import { WEDDING_DATE, WEDDING_LOCATION } from "@/lib/config";
import { daysUntil, formatDateLong, formatDateShort, formatTime } from "@/lib/utils";
import type { TodoPriority } from "@/types/db";
import { ListGroup, ListRow } from "@/components/ui/list-group";
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

interface Props {
  standing: { label: string; value: string }[];
  upcoming: AgendaItem[];
  visibleTasks: TaskItem[];
  otherOpenCount: number;
}

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: "var(--accent)",
  medium: "var(--fg2)",
  low: "var(--fg3)",
};

export function OverviewClient({ standing, upcoming, visibleTasks, otherOpenCount }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const days = Math.max(0, daysUntil(WEDDING_DATE));
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
        </div>
      </div>

      <ListGroup label="Where things stand">
        {standing.map((s) => (
          <ListRow key={s.label}>
            <span className="text-[17px] tracking-[-0.014em]">{s.label}</span>
            <span className="ml-auto text-[17px] tracking-[-0.014em] text-[var(--fg2)] tabular-nums">{s.value}</span>
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
            return (
              <ListRow key={e.id}>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] tracking-[-0.014em]">{e.title}</div>
                  {sub && <div className="mt-0.5 text-[14px] tracking-[-0.008em] text-[var(--fg2)]">{sub}</div>}
                </div>
                <span className="ml-auto text-[15px] whitespace-nowrap text-[var(--fg2)]">
                  {formatDateShort(e.date)}
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
