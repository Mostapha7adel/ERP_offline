import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  invertColors?: boolean;
}

export function TrendIndicator({
  value,
  prefix = "",
  suffix = "%",
  className,
  invertColors = false,
}: TrendIndicatorProps) {
  const positive = value > 0;
  const negative = value < 0;
  const neutral = value === 0;

  const icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const Icon = icon;

  const baseColor = invertColors
    ? positive
      ? "text-destructive"
      : negative
        ? "text-success"
        : "text-muted-foreground"
    : positive
      ? "text-success"
      : negative
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
        baseColor,
        neutral && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span>
        {prefix}
        {Math.abs(value).toFixed(1)}
        {suffix}
      </span>
    </div>
  );
}