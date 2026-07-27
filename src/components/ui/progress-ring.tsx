interface Props {
  /** How much is done. */
  value: number;
  /** The whole. A total of 0 renders an empty ring rather than dividing by zero. */
  total: number;
  label: string;
  /** Raw-count line under the label, e.g. "10 of 22". */
  caption?: string;
  color?: string;
  size?: number;
}

/**
 * A single progress ring. Three of these side by side give the Overview a
 * live, at-a-glance read on the parts of the planning that actually have a
 * finish line (replies in, tasks done, budget paid).
 */
export function ProgressRing({
  value, total, label, caption, color = "var(--accent)", size = 104,
}: Props) {
  const pct = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            style={{ transition: "stroke-dashoffset .6s cubic-bezier(.4,1.1,.5,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[22px] font-bold tracking-[-0.03em] tabular-nums">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[15px] tracking-[-0.012em]">{label}</div>
        {caption && <div className="mt-0.5 text-[13px] tabular-nums text-[var(--fg2)]">{caption}</div>}
      </div>
    </div>
  );
}
