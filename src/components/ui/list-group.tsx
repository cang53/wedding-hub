import * as React from "react";
import { cn } from "@/lib/utils";

interface ListGroupProps {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Apple-style grouped list: an optional label above a card. Rows (`ListRow`)
 * get a hairline between them that stops short of the card's left edge and
 * never appears above the first row.
 */
export function ListGroup({ label, children, className }: ListGroupProps) {
  return (
    <div className={className}>
      {label && (
        <div className="px-[18px] pb-[7px] text-[13px] tracking-[-0.004em] text-[var(--fg2)]">
          {label}
        </div>
      )}
      <div className="overflow-hidden rounded-[12px] bg-[var(--card)]">{children}</div>
    </div>
  );
}

interface ListRowProps extends React.HTMLAttributes<HTMLElement> {
  /** Render as a plain row or a clickable button. */
  as?: "div" | "button";
  /** "start" for rows with a fixed leading column (e.g. a time), "center" for everything else. */
  align?: "center" | "start";
  /** Adds the hover-opacity affordance for clickable rows. */
  interactive?: boolean;
}

export const ListRow = React.forwardRef<HTMLElement, ListRowProps>(
  ({ as = "div", align = "center", interactive = false, className, children, ...props }, ref) => {
    const Comp = as as React.ElementType;
    return (
      <div className={cn("list-row", interactive && "is-interactive")}>
        <Comp
          ref={ref}
          type={as === "button" ? "button" : undefined}
          className={cn("list-row-inner", align === "start" && "items-start", className)}
          {...props}
        >
          {children}
        </Comp>
      </div>
    );
  }
);
ListRow.displayName = "ListRow";
