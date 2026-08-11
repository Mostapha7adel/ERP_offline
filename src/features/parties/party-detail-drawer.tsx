import { Mail, Phone, MapPin, FileText, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/shared/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { initials } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Party } from "@/types/domain";

const statusMap = {
  active: { label: "Active", labelAr: "نشط", variant: "success" as const },
  inactive: { label: "Inactive", labelAr: "غير نشط", variant: "muted" as const },
  blocked: { label: "Blocked", labelAr: "محظور", variant: "destructive" as const },
};

interface PartyDetailDrawerProps {
  party: Party | null;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export function PartyDetailDrawer({ party, onOpenChange, onEdit }: PartyDetailDrawerProps) {
  const navigate = useNavigate();
  const { t } = useT();
  if (!party) return null;
  const status = statusMap[party.status];
  const isCustomer = party.type === "customer";

  return (
    <Sheet open={Boolean(party)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="text-base">
                {initials(party.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{party.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <span>{party.code}</span>
                <Badge variant={status.variant} dot>{t(status.label, status.labelAr)}</Badge>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-4">
          <div className="flex gap-2">
<Button
              size="sm"
              variant="secondary"
              className="text-foreground"
              onClick={() =>
                navigate(isCustomer ? "/app/sales" : "/app/purchases")
              }
            >
              <ArrowUpRight className="size-4 rtl:rotate-180" />
              {isCustomer ? t("View invoices", "عرض الفواتير") : t("View purchases", "عرض المشتريات")}
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit}>
              <FileText className="size-4" />
              {t("Edit", "تعديل")}
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              {isCustomer ? t("Account receivable", "ذمم مدينة") : t("Account payable", "ذمم دائنة")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(party.balance, party.currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isCustomer ? t("Outstanding from", "مستحق من") : t("Owed to", "مستحق له")}{" "}
              {t("this", "هذا")} {isCustomer ? t("customer", "العميل") : t("supplier", "المورد")}
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Contact", "جهة الاتصال")}
            </h4>
            <div className="space-y-2 text-sm">
              {party.email ? (
                <a href={`mailto:${party.email}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                  <Mail className="size-4 text-muted-foreground" />
                  {party.email}
                </a>
              ) : null}
              {party.phone ? (
                <a href={`tel:${party.phone}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                  <Phone className="size-4 text-muted-foreground" />
                  {party.phone}
                </a>
              ) : null}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Details", "التفاصيل")}
            </h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label={t("Tax ID", "الرقم الضريبي")} value={party.taxId || "—"} />
              <Detail label={t("Currency", "العملة")} value={party.currency} />
              <Detail label={t("Payment terms", "شروط الدفع")} value={party.paymentTerms || "—"} />
              <Detail label={t("Member since", "عميل منذ")} value={formatDate(party.createdAt)} />
            </dl>
          </div>

          {(party.address.street || party.address.city) ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("Address", "العنوان")}
              </h4>
              <p className="flex items-start gap-2 text-sm text-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {party.address.street}
                  <br />
                  {[party.address.city, party.address.state, party.address.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                  <br />
                  {party.address.country}
                </span>
              </p>
            </div>
          ) : null}

          {party.note ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("Note", "ملاحظة")}
              </h4>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <FileText className="mt-0.5 size-4 shrink-0" />
                {party.note}
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}