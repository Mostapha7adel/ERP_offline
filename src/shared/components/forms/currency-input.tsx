import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue"> {
  currency?: string;
  onNumericChange?: (value: number) => void;
  value?: number;
  defaultValue?: number;
}

const formatDisplay = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const parseNumber = (display: string) => {
  const cleaned = display.replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

export function CurrencyInput({
  currency = "USD",
  onNumericChange,
  value,
  defaultValue,
  className,
  onChange,
  onBlur,
  ...props
}: CurrencyInputProps) {
  const [display, setDisplay] = React.useState<string>(
    value !== undefined
      ? formatDisplay(value)
      : defaultValue !== undefined
        ? formatDisplay(defaultValue)
        : "",
  );
  const isControlled = value !== undefined;

  React.useEffect(() => {
    if (isControlled) setDisplay(formatDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const num = parseNumber(raw);
    setDisplay(raw);
    onNumericChange?.(num);
    onChange?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (isControlled) setDisplay(formatDisplay(parseNumber(display)));
    onBlur?.(event);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {currencySymbol(currency)}
      </span>
      <input
        inputMode="decimal"
        type="text"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          "h-9 w-full rounded-lg border border-input bg-transparent ps-8 pe-3 py-1 text-sm tabular-nums shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function currencySymbol(currency: string): string {
  try {
    const symbol = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value;
    return symbol ?? currency;
  } catch {
    return currency;
  }
}