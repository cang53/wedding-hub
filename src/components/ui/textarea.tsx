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
        "font-apple min-h-[70px] w-full resize-y rounded-[9px] border-none bg-[var(--fill)] px-3.5 py-2.5 text-[17px] text-[var(--fg)] placeholder:text-[var(--fg3)] transition-shadow duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
