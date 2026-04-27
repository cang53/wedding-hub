"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Round, ink-bordered checkbox that fills burgundy when checked.
 * Mirrors `.todo-checkbox` from the prototype — used as the to-do toggle.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "h-[22px] w-[22px] shrink-0 rounded-full border-[1.5px] border-ink bg-transparent transition-colors",
      "data-[state=checked]:bg-burgundy data-[state=checked]:border-burgundy data-[state=checked]:text-cream",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
