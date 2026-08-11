import { useState } from "react";
import { LogOut, Settings, ChevronsUpDown, CircleUser } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { initials } from "@/lib/utils";
import { useT } from "@/shared/lib/i18n";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Badge } from "@/shared/components/ui/badge";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";

export function UserMenu() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const roles = useAuthStore((s) => s.roles);
  const navigate = useNavigate();
  const { t } = useT();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!currentUser) return null;

  const roleName = roles.find((r) => r.id === currentUser.roleId)?.name ?? t("Member", "عضو");

  const handleLogout = () => {
    setConfirmOpen(true);
  };

  const doLogout = async () => {
    setConfirmOpen(false);
    await logout();
    navigate("/login");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: currentUser.color }}>
                {initials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-start md:block">
              <span className="block text-sm font-medium leading-tight">
                {currentUser.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                <Badge variant="secondary" className="mt-0.5 px-1.5 py-0 text-[10px]">
                  {roleName}
                </Badge>
              </span>
            </span>
            <ChevronsUpDown className="hidden size-4 text-muted-foreground md:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback style={{ backgroundColor: currentUser.color }}>
                  {initials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser.email}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/app/settings")}>
            <Settings className="size-4" />
            {t("Settings", "الإعدادات")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/app/users")}>
            <CircleUser className="size-4" />
            {t("Profile", "الملف الشخصي")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="size-4" />
            {t("Log out", "تسجيل الخروج")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Log out of LedgerFlow?", "تسجيل الخروج من LedgerFlow؟")}
        description={t(
          "You will need to sign in again to access your workspace.",
          "سيتعين عليك تسجيل الدخول مرة أخرى للوصول إلى مساحة العمل الخاصة بك.",
        )}
        confirmLabel={t("Log out", "تسجيل الخروج")}
        destructive
        onConfirm={() => void doLogout()}
      />
    </>
  );
}