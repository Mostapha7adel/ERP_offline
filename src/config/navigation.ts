import {
  BarChart3,
  Bell,
  Building2,
  LayoutDashboard,
  Landmark,
  LayoutList,
  Laptop,
  Package,
  ReceiptText,
  CalendarClock,
  RotateCcw,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  CircleUser,
  Truck,
  Users,
  Wallet,
  FileText,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import type { NavSection } from "@/types/navigation";

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    titleAr: "نظرة عامة",
    items: [
      {
        title: "Dashboard",
        titleAr: "لوحة التحكم",
        href: "/app/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
        keywords: "home overview analytics kpi",
      },
    ],
  },
  {
    title: "Operations",
    titleAr: "العمليات",
    items: [
      {
        title: "Customers",
        titleAr: "العملاء",
        href: "/app/customers",
        icon: Users,
        permission: "customers.view",
        keywords: "clients contacts parties accounts receivable",
      },
      {
        title: "Suppliers",
        titleAr: "الموردون",
        href: "/app/suppliers",
        icon: Truck,
        permission: "suppliers.view",
        keywords: "vendors contacts parties accounts payable",
      },
      {
        title: "Products",
        titleAr: "المنتجات",
        href: "/app/products",
        icon: Package,
        permission: "products.view",
        keywords: "items catalog sku services stock",
      },
      {
        title: "Warehouses",
        titleAr: "المخازن",
        href: "/app/warehouses",
        icon: Building2,
        permission: "warehouses.view",
        keywords: "locations stores storage branches",
      },
      {
        title: "Inventory",
        titleAr: "المخزون",
        href: "/app/inventory",
        icon: LayoutList,
        permission: "inventory.view",
        keywords: "stock levels quantities batches movements",
      },
    ],
  },
  {
    title: "Trade",
    titleAr: "التجارة",
    items: [
      {
        title: "Sales",
        titleAr: "المبيعات",
        href: "/app/sales",
        icon: ShoppingBag,
        permission: "sales.view",
        keywords: "invoices orders revenue invoices",
      },
      {
        title: "Purchases",
        titleAr: "المشتريات",
        href: "/app/purchases",
        icon: ShoppingCart,
        permission: "purchases.view",
        keywords: "bills purchase orders expenses",
      },
      {
        title: "Quotes",
        titleAr: "عروض الأسعار",
        href: "/app/quotes",
        icon: FileText,
        permission: "quotes.view",
        keywords: "quotations estimates proposals quotes",
      },
      {
        title: "Recurring",
        titleAr: "الفواتير الدورية",
        href: "/app/recurring",
        icon: Repeat,
        permission: "recurring.view",
        keywords: "subscriptions recurring automatic repeat",
      },
      {
        title: "Notes",
        titleAr: "الإشعارات الدائنة والمدينة",
        href: "/app/notes",
        icon: ReceiptText,
        permission: "notes.view",
        keywords: "credit notes debit notes refunds returns adjustments",
      },
    ],
  },
  {
    title: "Finance",
    titleAr: "المالية",
    items: [
      {
        title: "Treasury",
        titleAr: "الخزينة",
        href: "/app/treasury",
        icon: Wallet,
        permission: "treasury.view",
        keywords: "bank cash accounts transactions payments",
      },
      {
        title: "Accounting",
        titleAr: "المحاسبة",
        href: "/app/accounting",
        icon: Landmark,
        permission: "accounting.view",
        keywords: "chart of accounts journal ledger entries",
      },
      {
        title: "Fiscal Year",
        titleAr: "السنة المالية",
        href: "/app/fiscal-year",
        icon: CalendarClock,
        permission: "accounting.view",
        keywords: "fiscal year closing retained earnings period lock",
      },
      {
        title: "Reports",
        titleAr: "التقارير",
        href: "/app/reports",
        icon: BarChart3,
        permission: "reports.view",
        keywords: "analytics statements profit loss balance sheet",
      },
    ],
  },
  {
    title: "System",
    titleAr: "النظام",
    items: [
      {
        title: "Profile",
        titleAr: "الملف الشخصي",
        href: "/app/profile",
        icon: CircleUser,
        permission: undefined,
        keywords: "profile account user name email job title role",
      },
      {
        title: "Users & Access",
        titleAr: "المستخدمون والصلاحيات",
        href: "/app/users",
        icon: Shield,
        permission: "users.view",
        superAdminOnly: true,
        keywords: "users roles permissions members team",
      },
      {
        title: "Settings",
        titleAr: "الإعدادات",
        href: "/app/settings",
        icon: Settings,
        permission: undefined,
        keywords: "preferences company profile configuration",
      },
      {
        title: "Backup & Restore",
        titleAr: "النسخ الاحتياطي والاستعادة",
        href: "/app/backup",
        icon: RotateCcw,
        permission: "backup.manage",
        keywords: "backup restore export import data safety",
      },
      {
        title: "Devices",
        titleAr: "الأجهزة",
        href: "/app/devices",
        icon: Laptop,
        permission: "network.view",
        keywords: "devices network lan wifi connect devices online",
      },
    ],
  },
];

export const NOTIFICATIONS_ROUTE = {
  title: "Notifications",
  titleAr: "الإشعارات",
  href: "/app/notifications",
  icon: Bell as LucideIcon,
  keywords: "alerts notifications bell inbox",
};

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => [
  ...section.items,
  {
    title: NOTIFICATIONS_ROUTE.title,
    titleAr: NOTIFICATIONS_ROUTE.titleAr,
    href: NOTIFICATIONS_ROUTE.href,
    icon: NOTIFICATIONS_ROUTE.icon,
    permission: undefined,
    keywords: NOTIFICATIONS_ROUTE.keywords,
  },
]);

export function findRouteByPath(pathname: string) {
  const item = ALL_NAV_ITEMS.find((item) => item.href === pathname);
  return item ?? null;
}
