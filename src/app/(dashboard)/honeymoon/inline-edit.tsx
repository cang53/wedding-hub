"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Inline editors — click to edit in place, commit on blur / Enter, cancel on
// Escape. Used everywhere in the planner so there are no separate edit pages.
// ============================================================================

interface InlineTextProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  /** Render the resting (non-editing) state. Defaults to the value/placeholder. */
  display?: React.ReactNode;
}

export function InlineText({
  value,
  onCommit,
  placeholder = "—",
  className,
  multiline = false,
  display,
}: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      className: cn(
        "w-full rounded-[2px] border border-burgundy/40 bg-paper px-1.5 py-0.5 outline-none focus:border-burgundy",
        className,
      ),
    };
    if (multiline) {
      return (
        <textarea
          {...shared}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        />
      );
    }
    return (
      <input
        {...shared}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") startEdit();
      }}
      className={cn(
        "cursor-text rounded-[2px] px-1.5 py-0.5 -mx-1.5 hover:bg-cream-deep/60 transition-colors",
        !value && "text-ink-soft/60 italic",
        className,
      )}
    >
      {display ?? (value || placeholder)}
    </span>
  );
}

interface InlineNumberProps {
  value: number | null;
  onCommit: (value: number | null) => void;
  placeholder?: string;
  suffix?: string;
  className?: string;
}

export function InlineNumber({
  value,
  onCommit,
  placeholder = "—",
  suffix = "",
  className,
}: InlineNumberProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setDraft(value?.toString() ?? "");
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = draft.trim() === "" ? null : Number(draft);
    const next = parsed != null && Number.isNaN(parsed) ? value : parsed;
    if (next !== value) onCommit(next);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value?.toString() ?? "");
            setEditing(false);
          }
        }}
        className={cn(
          "w-20 rounded-[2px] border border-burgundy/40 bg-paper px-1.5 py-0.5 outline-none focus:border-burgundy",
          className,
        )}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") startEdit();
      }}
      className={cn(
        "cursor-text rounded-[2px] px-1.5 py-0.5 -mx-1.5 hover:bg-cream-deep/60 transition-colors",
        value == null && "text-ink-soft/60 italic",
        className,
      )}
    >
      {value == null ? placeholder : `${value}${suffix}`}
    </span>
  );
}
