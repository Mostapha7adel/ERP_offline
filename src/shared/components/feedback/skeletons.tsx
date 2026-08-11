import { Skeleton } from "@/shared/components/ui/skeleton";

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 8, columns = 5 }: SkeletonTableProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columns }).map((__, col) => (
            <Skeleton
              key={col}
              className="h-9 flex-1"
              style={{
                width: `${col === columns - 1 ? 30 : 100 - (columns - 1) * 20}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-8 w-28" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({ variant = "table" }: { variant?: "table" | "cards" }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
        <div className="ms-auto flex gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      {variant === "table" ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <SkeletonTable />
        </div>
      ) : (
        <SkeletonCards />
      )}
    </div>
  );
}
