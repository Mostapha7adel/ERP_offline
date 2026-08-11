import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/config/app";
import { AppLogo } from "@/shared/components/layout/app-logo";

export function Brand({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <Link
      to="/app/dashboard"
      className={cn("flex items-center gap-2.5", className)}
    >
      <AppLogo className="size-8 rounded-lg" />
      {showText ? (
        <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
      ) : null}
    </Link>
  );
}