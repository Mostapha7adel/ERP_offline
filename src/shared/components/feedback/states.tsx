import { motion } from "framer-motion";
import { type LucideIcon, Inbox, TriangleAlert, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { useT } from "@/shared/lib/i18n";

interface StateShellProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { icon: "size-8", title: "text-base", pad: "py-8" },
  md: { icon: "size-10", title: "text-lg", pad: "py-12" },
  lg: { icon: "size-12", title: "text-xl", pad: "py-16" },
} as const;

export function StateShell({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = "md",
}: StateShellProps) {
  const s = sizes[size];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        s.pad,
        className,
      )}
    >
      <div
        className={cn(
          s.icon,
          "rounded-2xl border border-dashed bg-muted/40 p-3 text-muted-foreground",
        )}
      >
        <Icon className="size-full" />
      </div>
      <div className="space-y-1">
        <h3 className={cn("font-semibold", s.title)}>{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </motion.div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const { t } = useT();
  return (
    <StateShell
      icon={Inbox}
      title={title ?? t("Nothing here yet", "لا يوجد شيء هنا بعد")}
      description={description ?? t("This list is empty. Add your first record to get started.", "هذه القائمة فارغة. أضف أول سجل لك للبدء.")}
      action={action}
      className={className}
    />
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  retry,
  className,
}: ErrorStateProps) {
  const { t } = useT();
  return (
    <StateShell
      icon={TriangleAlert}
      title={title ?? t("Something went wrong", "حدث خطأ ما")}
      description={description ?? t("We could not load this section. Please try again.", "تعذّر تحميل هذا القسم. يرجى المحاولة مرة أخرى.")}
      className={className}
      action={
        retry ? (
          <Button variant="outline" size="sm" onClick={retry}>
            {t("Try again", "إعادة المحاولة")}
          </Button>
        ) : undefined
      }
    />
  );
}

interface ForbiddenStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function ForbiddenState({
  title,
  description,
  className,
}: ForbiddenStateProps) {
  const { t } = useT();
  return (
    <StateShell
      icon={ShieldAlert}
      title={title ?? t("You don't have access", "لا تملك حق الوصول")}
      description={description ?? t("Your current role does not have permission to view this page.", "دورك الحالي لا يملك صلاحية لعرض هذه الصفحة.")}
      className={className}
    />
  );
}
