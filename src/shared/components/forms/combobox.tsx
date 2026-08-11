import * as React from "react";
import { Check, ChevronsUpDown, CircleX, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Badge } from "@/shared/components/ui/badge";
import { SearchInput } from "./search-input";
import { useT } from "@/shared/lib/i18n";

export interface ComboboxOption {
  value: string;
  label: string;
  meta?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  /**
   * When true, the search box supports typing an item that is not in the
   * list: a "Create" entry appears and selecting it emits `__new__:<text>`.
   * Used for free-form line items (e.g. purchases) that aren't structured
   * products yet.
   */
  creatable?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  emptyText,
  searchPlaceholder,
  disabled,
  className,
  clearable = true,
  creatable = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const { t } = useT();
  const selected = options.find((option) => option.value === value);
  const isCustomValue = value?.startsWith("__new__:");

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const exactMatch = options.some((o) => o.label.toLowerCase() === q || (o.meta ?? "").toLowerCase() === q);

  const filtered = trimmed
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.meta ?? "").toLowerCase().includes(q),
      )
    : options;
  const showCreate = creatable && trimmed.length > 0 && !exactMatch;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !selected && !isCustomValue && "text-muted-foreground",
            className,
          )}
        >
          {selected
            ? selected.label
            : isCustomValue && value
              ? value.slice("__new__:".length)
              : (placeholder ?? t("Select an option…", "اختر خياراً…"))}
          <div className="flex items-center gap-1">
            {clearable && value ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={t("Clear selection", "مسح التحديد")}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  onValueChange("");
                }}
              >
                <CircleX className="size-4" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <SearchInput
            autoFocus
            placeholder={searchPlaceholder ?? (creatable ? t("Type or search…", "اكتب أو ابحث…") : t("Search…", "ابحث…"))}
            containerClassName="border-b rounded-none"
            className="border-0 focus-visible:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CommandList>
            <CommandEmpty>{emptyText ?? (creatable ? t("Keep typing to create an item.", "تابع الكتابة لإنشاء صنف.") : t("No results found.", "لا توجد نتائج."))}</CommandEmpty>
            {showCreate ? (
              <CommandItem
                value="__create__"
                onSelect={() => {
                  onValueChange(`__new__:${trimmed}`);
                  setOpen(false);
                }}
              >
                <Plus className="size-4 text-primary" />
                <span className="truncate">
                  {t("Create ", "إنشاء ")}
                  <span className="font-medium">{trimmed}</span>
                </span>
              </CommandItem>
            ) : null}
            {filtered.length > 0 ? (
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{option.label}</span>
                      {option.meta ? (
                        <span className="text-xs text-muted-foreground">
                          {option.meta}
                        </span>
                      ) : null}
                    </div>
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface MultiComboboxProps {
  options: ComboboxOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiCombobox({
  options,
  values,
  onValuesChange,
  placeholder,
  emptyText,
  disabled,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const { t } = useT();
  const selectedOptions = options.filter((option) => values.includes(option.value));

  const toggle = (value: string) => {
    onValuesChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-9 w-full justify-start gap-1.5 py-1.5 font-normal",
            selectedOptions.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((option) => (
                <Badge key={option.value} variant="secondary" className="text-xs">
                  {option.label}
                </Badge>
              ))}
            </div>
          ) : (
            (placeholder ?? t("Select options…", "اختر خيارات…"))
          )}
          <ChevronsUpDown className="ms-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <SearchInput
            autoFocus
            placeholder={t("Search…", "ابحث…")}
            containerClassName="border-b rounded-none"
            className="border-0 focus-visible:ring-0"
          />
          <CommandList>
            <CommandEmpty>{emptyText ?? t("No results found.", "لا توجد نتائج.")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{option.label}</span>
                  </div>
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      values.includes(option.value)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
