import * as React from "react";
import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ALL_NAV_ITEMS } from "@/config/navigation";
import { useT } from "@/shared/lib/i18n";

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { t, locale } = useT();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const match = ALL_NAV_ITEMS.find((item) => item.href === href);
    return {
      href,
      label: match
        ? (locale === "ar" ? match.titleAr ?? match.title : match.title)
        : segment.charAt(0).toUpperCase() + segment.slice(1),
      isCurrent: index === segments.length - 1,
    };
  });

  return (
    <nav aria-label={t("Breadcrumb", "مسار التنقل")} className="flex items-center gap-1 text-sm">
      <Link
        to="/app/dashboard"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("Home", "الرئيسية")}
      >
        <Home className="size-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight className="size-3.5 text-muted-foreground/50 rtl:rotate-180" />
          {crumb.isCurrent ? (
            <span className="px-1.5 py-0.5 font-medium text-foreground">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.href}
              className="rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}