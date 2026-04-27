import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — paper background, line border, burgundy on focus.
 * Matches the prototype's `.todo-toolbar input` and `.form-row input` recipes.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "h-10 w-full rounded-[2px] border border-line bg-paper px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/60 transition-colors duration-200",
          "focus:outline-none focus:border-burgundy",
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
