import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "font-apple h-11 w-full rounded-[9px] border-none bg-[var(--fill)] px-3.5 py-2 text-[17px] text-[var(--fg)] placeholder:text-[var(--fg3)] transition-shadow duration-150",
          "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
