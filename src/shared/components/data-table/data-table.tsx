import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/feedback/states";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useT } from "@/shared/lib/i18n";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: TData) => void;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void;
  columnVisibility?: VisibilityState;
  className?: string;
  footer?: React.ReactNode;
}

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  error = null,
  onRetry,
  onRowClick,
  toolbar,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination = true,
  pageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  className,
  footer,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [localSelection, setLocalSelection] = React.useState<RowSelectionState>({});
  const [visibility, setVisibility] = React.useState<VisibilityState>(columnVisibility ?? {});
  const { t } = useT();

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection: rowSelection ?? localSelection,
      columnVisibility: visibility,
    },
    enableRowSelection: Boolean(rowSelection !== undefined || onRowSelectionChange),
    onRowSelectionChange: onRowSelectionChange ?? setLocalSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize } },
  });

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;

  return (
    <div className={cn("w-full", className)}>
      {toolbar}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan} className="whitespace-nowrap">
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5",
                              canSort ? "cursor-pointer select-none" : "",
                            )}
                            onClick={
                              canSort
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {canSort ? (
                              <ArrowUpDown
                                className={cn(
                                  "size-3.5 transition-colors",
                                  header.column.getIsSorted() === "asc"
                                    ? "text-primary"
                                    : header.column.getIsSorted() === "desc"
                                      ? "rotate-180 text-primary"
                                      : "text-muted-foreground/40",
                                )}
                              />
                            ) : null}
                          </button>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: Math.min(6, currentPageSize) }).map((_, rowIndex) => (
                  <TableRow key={`loading-${rowIndex}`} className="hover:bg-transparent">
                    {columns.map((_, cellIndex) => (
                      <TableCell key={`${rowIndex}-${cellIndex}`}>
                        <Skeleton
                          className="h-5"
                          style={{ width: `${[62, 78, 45, 70, 30, 50][cellIndex % 6]}%` }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="px-0">
                    <EmptyState
                      title={error ? t("Something went wrong", "حدث خطأ ما") : emptyTitle}
                      description={error ?? emptyDescription}
                      action={
                        error && onRetry ? (
                          <Button variant="outline" size="sm" onClick={onRetry}>
                            {t("Try again", "إعادة المحاولة")}
                          </Button>
                        ) : (
                          emptyAction
                        )
                      }
                      className="py-12"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button, a, input, select, textarea, [role='menuitem']")) {
                        return;
                      }
                      onRowClick?.(row.original);
                    }}
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {footer ? <div className="border-t">{footer}</div> : null}
      </div>

      {pagination && !loading && table.getRowModel().rows.length > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {pageSizeOptions.length > 1 ? t("Rows per page", "صفوف لكل صفحة") : t("Showing", "عرض")} 
            </span>
            {pageSizeOptions.length > 1 && (
              <Select
                value={String(currentPageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={String(currentPageSize)} />
                </SelectTrigger>
                <SelectContent side="top">
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span>
              {table.getFilteredRowModel().rows.length} {t("of", "من")}{" "}
              {table.getPrePaginationRowModel().rows.length} {t("rows", "صفاً")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label={t("First page", "الصفحة الأولى")}
            >
              <ChevronsLeft className="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label={t("Previous page", "الصفحة السابقة")}
            >
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <span className="mx-1 min-w-[72px] text-center text-sm tabular-nums text-muted-foreground">
              {t("Page", "صفحة")} {pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label={t("Next page", "الصفحة التالية")}
            >
              <ChevronRight className="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label={t("Last page", "الصفحة الأخيرة")}
            >
              <ChevronsRight className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ColumnVisibilityDropdownProps {
  columns: { id: string; label: string }[];
  visible: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function ColumnVisibilityDropdown({
  columns,
  visible,
  onToggle,
}: ColumnVisibilityDropdownProps) {
  const { t } = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {t("Columns", "الأعمدة")}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visible[column.id] ?? true}
            onCheckedChange={() => onToggle(column.id)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { type ColumnDef, type SortingState, type ColumnFiltersState };
