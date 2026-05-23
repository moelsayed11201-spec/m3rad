import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500",
        {
          'border-transparent bg-indigo-500/20 text-indigo-400': variant === 'default',
          'border-transparent bg-white/10 text-slate-300': variant === 'secondary',
          'border-transparent bg-emerald-500/20 text-emerald-400': variant === 'success',
          'border-transparent bg-amber-500/20 text-amber-400': variant === 'warning',
          'border-transparent bg-rose-500/20 text-rose-400': variant === 'destructive',
          'border-white/20 text-slate-300': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
