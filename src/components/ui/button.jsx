import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-sky-500 text-slate-950 hover:bg-sky-400 active:bg-sky-600",
        destructive:
          "bg-red-600 text-slate-50 hover:bg-red-500 active:bg-red-700",
        outline:
          "border border-slate-700 bg-transparent text-slate-50 hover:bg-slate-800 hover:border-slate-600",
        secondary:
          "bg-slate-800 text-slate-50 hover:bg-slate-700 active:bg-slate-900",
        ghost:
          "text-slate-400 hover:bg-slate-800 hover:text-slate-50",
        link:
          "text-sky-500 underline-offset-4 hover:underline hover:text-sky-400",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 rounded px-3 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
