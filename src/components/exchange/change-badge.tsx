"use client";

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";
import { TrendingDown, TrendingUp } from "lucide-react";

interface ChangeBadgeProps {
  value: number; // percent
  className?: string;
  withIcon?: boolean;
  size?: "sm" | "md";
}

/** Green/red pill showing 24h change percentage. */
export function ChangeBadge({ value, className, withIcon = false, size = "md" }: ChangeBadgeProps) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md font-semibold tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
        className
      )}
    >
      {withIcon && (up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
      {fmtPct(value)}
    </span>
  );
}
