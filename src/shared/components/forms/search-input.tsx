import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/shared/components/ui/input";
import { Kbd } from "@/shared/components/ui/kbd";
import { useT } from "@/shared/lib/i18n";

interface SearchInputProps extends React.ComponentProps<typeof Input> {
  onClear?: () => void;
  shortcut?: string;
  containerClassName?: string;
  icon?: boolean;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, shortcut, containerClassName, icon = true, value, ...props }, ref) => {
    const hasValue = Boolean(value);
    const { t } = useT();
    return (
      <div className={cn("relative", containerClassName)}>
        {icon ? (
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        ) : null}
        <Input
          ref={ref}
          className={cn(
            "h-9 ps-8 pe-14",
            icon ? "" : "ps-3",
            className,
          )}
          value={value}
          {...props}
        />
        {shortcut && !hasValue ? (
          <div className="absolute end-2.5 top-1/2 -translate-y-1/2">
            <Kbd>{shortcut}</Kbd>
          </div>
        ) : null}
        {hasValue && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("Clear search", "مسح البحث")}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
