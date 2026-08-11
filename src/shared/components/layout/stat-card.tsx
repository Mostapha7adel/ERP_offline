import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
} from "@/shared/components/ui/card";
import { TrendIndicator } from "@/shared/components/feedback/trend-indicator";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  trendPrefix?: string;
  iconClassName?: string;
  footer?: React.ReactNode;
  className?: string;
  index?: number;
  currencyColor?: "default" | "success" | "destructive";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendPrefix,
  iconClassName,
  footer,
  className,
  index = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {value}
              </p>
            </div>
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl text-primary",
                iconClassName ?? "bg-primary/10",
              )}
            >
              <Icon className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {trend !== undefined ? (
              <TrendIndicator value={trend} prefix={trendPrefix} />
            ) : null}
            {footer ? (
              <span className="text-xs text-muted-foreground">{footer}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}