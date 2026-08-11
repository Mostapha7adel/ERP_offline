import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useT } from "@/shared/lib/i18n";

export function NotFound() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 text-center">
      <p className="bg-gradient-to-r from-primary to-[hsl(262_83%_58%)] bg-clip-text text-[8rem] font-black leading-none text-transparent">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {t("Page not found", "الصفحة غير موجودة")}
      </h1>
      <p className="mt-1 max-w-sm text-muted-foreground">
        {t("The page you are looking for doesn't exist or has been moved.", "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.")}
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("Go back", "رجوع")}
        </Button>
        <Button onClick={() => navigate("/app/dashboard")}>
          <Home className="size-4" />
          {t("Dashboard", "لوحة التحكم")}
        </Button>
      </div>
    </div>
  );
}