import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — Apple redesign, used mainly inside dialogs (screens mostly use
 * their own plain accent text buttons directly):
 *   default: borderless --accent text, semibold — primary/submit actions
 *   ghost:   borderless --accent text, regular weight — Cancel etc.
 *   danger:  borderless --red text — destructive actions
 *   outline: --fill pill — subtle secondary CTA
 */
const buttonVariants = cva(
  "font-apple inline-flex items-center justify-center gap-2 whitespace-nowrap tracking-[-0.01em] transition-opacity duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-transparent text-[var(--accent)] font-[590] rounded-none hover:opacity-60",
        ghost: "bg-transparent text-[var(--accent)] font-normal rounded-none hover:opacity-60",
        danger: "bg-transparent text-[var(--red)] font-normal rounded-none hover:opacity-60",
        outline: "bg-[var(--fill)] text-[var(--fg)] rounded-full hover:opacity-80",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-2 text-[17px]",
        sm: "h-8 px-1.5 text-[15px]",
        lg: "h-12 px-2.5 text-[17px]",
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
