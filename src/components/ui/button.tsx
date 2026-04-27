import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — matches prototype:
 *   default: ink bg, cream text, uppercase tracking-widest, 2px radius
 *   ghost:   transparent bg, ink text + border, fills on hover
 *   danger:  transparent, burgundy text, hover underline (no fill)
 *   outline: chip-style, used for filter chips and subtle CTAs
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium uppercase tracking-[0.1em] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
  {
    variants: {
      variant: {
        default: "bg-ink text-cream rounded-[2px] hover:bg-burgundy hover:-translate-y-px",
        ghost: "bg-transparent text-ink border border-ink rounded-[2px] hover:bg-ink hover:text-cream",
        danger: "bg-transparent text-burgundy rounded-[2px] hover:text-burgundy-deep hover:underline",
        outline: "bg-transparent text-ink-soft border border-line rounded-full hover:border-ink hover:text-ink",
        link: "text-burgundy underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 text-[12px]",
        sm: "h-8 px-3.5 text-[11px]",
        lg: "h-12 px-7 text-[13px]",
        icon: "h-9 w-9 text-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
