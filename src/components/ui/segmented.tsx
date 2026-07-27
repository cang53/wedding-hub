"use client";

import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Apple-style segmented control: equal-width buttons in a pill track. */
export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div className={cn("flex max-w-[420px] gap-0.5 rounded-[9px] bg-[var(--fill)] p-0.5", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-[30px] flex-1 whitespace-nowrap rounded-[7px] px-3.5 text-[14px] tracking-[-0.01em] text-[var(--fg)] transition-[background-color,box-shadow] duration-150",
              active
                ? "bg-[var(--card)] font-[590] shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
                : "bg-transparent font-[450]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
