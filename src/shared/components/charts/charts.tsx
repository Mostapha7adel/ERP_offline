import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const axis = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
const stroke = "hsl(var(--border))";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; fill?: string }>;
  label?: string;
  currency?: boolean;
  formatter?: (value: number, name: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  currency = false,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const format = (value: number, name: string) => {
    if (formatter) return formatter(value, name);
    if (currency)
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    return String(value);
  };
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {label ? (
        <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: entry.color ?? entry.fill }}
              />
              <span className="capitalize text-muted-foreground">
                {entry.name}
              </span>
            </div>
            <span className="font-medium tabular-nums text-popover-foreground">
              {format(entry.value ?? 0, entry.name ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AreaChartCardProps {
  data: Record<string, any>[];
  xKey: string;
  series: Array<{ key: string; name: string; color: string }>;
  height?: number;
  className?: string;
  currency?: boolean;
}

export function TrendAreaChart({
  data,
  xKey,
  series,
  height = 260,
  className,
  currency = true,
}: AreaChartCardProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`grad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={stroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axis} dy={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axis}
            tickFormatter={(value) => compact(value)}
            width={48}
          />
          <Tooltip
            content={
              <ChartTooltip
                currency={currency}
              />
            }
            cursor={{ stroke: stroke, strokeDasharray: "4 4" }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface GroupedBarChartProps {
  data: Record<string, any>[];
  xKey: string;
  bars: Array<{ key: string; name: string; color: string }>;
  height?: number;
  className?: string;
  currency?: boolean;
}

export function GroupedBarChart({
  data,
  xKey,
  bars,
  height = 260,
  className,
  currency = true,
}: GroupedBarChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3}>
          <CartesianGrid stroke={stroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axis} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axis}
            tickFormatter={(v) => compact(v)}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.6)" }}
            content={<ChartTooltip currency={currency} />}
          />
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name}
              fill={b.color}
              radius={[5, 5, 0, 0]}
              maxBarSize={22}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
  currency?: boolean;
}

export function DonutChart({
  data,
  height = 240,
  centerLabel,
  centerValue,
  className,
  currency = true,
}: DonutChartProps) {
  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="92%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={<ChartTooltip currency={currency} />}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel || centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">
            {centerValue}
          </span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

interface MiniAreaProps {
  data: Array<{ x: string; y: number }>;
  height?: number;
  color?: string;
  className?: string;
}

export function MiniArea({ data, height = 48, color = "hsl(var(--primary))", className }: MiniAreaProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="mini-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={2}
            fill="url(#mini-grad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart({ data, yKey, color, height = 40, className }: {
  data: Array<Record<string, any>>;
  yKey: string;
  color?: string;
  height?: number;
  className?: string;
}) {
  const strokeColor = color ?? "hsl(var(--primary))";
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 3, right: 3, left: 3, bottom: 3 }}>
          <RechartsLine
            type="monotone"
            dataKey={yKey}
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}