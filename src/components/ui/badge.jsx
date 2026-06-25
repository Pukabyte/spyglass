import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-sky-500 text-slate-950 hover:bg-sky-400",
        secondary:
          "border-transparent bg-slate-800 text-slate-50 hover:bg-slate-700",
        destructive:
          "border-transparent bg-red-600 text-slate-50 hover:bg-red-500",
        outline:
          "border-slate-700 text-slate-400",
        success:
          "border-transparent bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
        warning:
          "border-transparent bg-amber-500/20 text-amber-400 border-amber-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Badge = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(badgeVariants({ variant }), className)}
    {...props}
  />
))
Badge.displayName = "Badge"

export { Badge, badgeVariants }
