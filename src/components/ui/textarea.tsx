import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[70px] w-full resize-y rounded-[2px] border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 transition-colors duration-200",
        "focus:outline-none focus:border-burgundy",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
