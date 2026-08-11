import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Wallet, Shield, ArrowRight, Plus } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/shared/components/ui/command";
import { useCan } from "@/stores/auth-store";
import { NAV_SECTIONS, NOTIFICATIONS_ROUTE } from "@/config/navigation";
import { useT } from "@/shared/lib/i18n";
import type { LucideIcon } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  labelAr: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-new-sale", label: "New sales invoice", labelAr: "فاتورة بيع جديدة", href: "/app/sales", icon: Plus, permission: "sales.create" },
  { id: "qa-new-purchase", label: "New purchase order", labelAr: "أمر شراء جديد", href: "/app/purchases", icon: Plus, permission: "purchases.create" },
  { id: "qa-new-customer", label: "Add customer", labelAr: "إضافة عميل", href: "/app/customers", icon: Plus, permission: "customers.create" },
  { id: "qa-new-product", label: "Add product", labelAr: "إضافة منتج", href: "/app/products", icon: Plus, permission: "products.create" },
  { id: "qa-record-txn", label: "Record transaction", labelAr: "تسجيل معاملة", href: "/app/treasury", icon: Wallet, permission: "treasury.create" },
  { id: "qa-create-user", label: "Invite user", labelAr: "دعوة مستخدم", href: "/app/users", icon: Shield, permission: "users.create" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : localOpen;
  const { t } = useT();
  const setOpen = (value: boolean) => {
    if (!isControlled) setLocalOpen(value);
    onOpenChange?.(value);
  };
  const navigate = useNavigate();
  const can = useCan();
  const actions = QUICK_ACTIONS.filter((a) => can(a.permission));

  const run = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!isOpen);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [isOpen]);

  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen}>
      <CommandInput placeholder={t("Type a command or search…", "اكتب أمراً أو ابحث…")} />
      <CommandList>
        <CommandEmpty>{t("No results found.", "لا توجد نتائج.")}</CommandEmpty>
        <CommandGroup heading={t("Navigate", "تنقّل")}>
          {NAV_SECTIONS.flatMap((section) =>
            section.items.map((item) => (
              <CommandItem key={item.href} value={`${item.title} ${item.keywords}`} onSelect={() => run(item.href)}>
                {renderNavIcon(item.icon)}
                <span>{item.titleAr ?? item.title}</span>
                <CommandShortcut>
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
                </CommandShortcut>
              </CommandItem>
            )),
          )}
          <CommandItem
            value="Notifications alerts bell"
            onSelect={() => run(NOTIFICATIONS_ROUTE.href)}
          >
            <NOTIFICATIONS_ROUTE.icon className="size-4" />
            <span>{t("Notifications", "الإشعارات")}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("Quick actions", "إجراءات سريعة")}>
          {actions.map((action) => (
            <CommandItem key={action.id} value={`${action.label} ${action.id}`} onSelect={() => run(action.href)}>
              <action.icon className="size-4" />
              <span>{action.labelAr ?? action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function renderNavIcon(icon?: LucideIcon) {
  const Icon = icon ?? FileText;
  return <Icon className="size-4" />;
}