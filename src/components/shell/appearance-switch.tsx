"use client";

interface Props {
  theme: "light" | "dark";
  onToggle: () => void;
  className?: string;
}

/** The 47x28 pill switch from the handoff — knob slides on an accent/fill track. */
export function AppearanceSwitch({ theme, onToggle, className }: Props) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label="Toggle appearance"
      aria-pressed={dark}
      onClick={onToggle}
      className={`relative h-7 w-[47px] shrink-0 rounded-full border-none p-0 transition-colors duration-200 ${className ?? ""}`}
      style={{ background: dark ? "var(--accent)" : "var(--fill)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200"
        style={{
          transform: dark ? "translateX(19px)" : "translateX(0)",
          transitionTimingFunction: "cubic-bezier(.4,1.25,.5,1)",
        }}
      />
    </button>
  );
}
