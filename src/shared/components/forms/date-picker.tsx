import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { useT } from "@/shared/lib/i18n";

interface DatePickerProps {
  value?: Date | null;
  onValueChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  toDate?: Date;
  fromDate?: Date;
}

export function DatePicker({
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
  clearable = true,
  toDate,
  fromDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { t } = useT();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start gap-2 text-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {value ? (
            <span>{format(value, "MMM d, yyyy")}</span>
          ) : (
            <span>{placeholder ?? t("Select a date", "اختر تاريخاً")}</span>
          )}
          {clearable && value ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("Clear date", "مسح التاريخ")}
              className="ms-auto rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onValueChange(null);
              }}
            >
              <X className="size-3.5" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            onValueChange(date ?? null);
            setOpen(false);
          }}
          autoFocus
          toDate={toDate}
          fromDate={fromDate}
        />
      </PopoverContent>
    </Popover>
  );
}
