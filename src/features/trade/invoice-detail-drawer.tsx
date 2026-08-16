import { FileText, Banknote, X, Download, Printer, PackageCheck, Share2, Mail, MessageCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { toast } from "@/shared/lib/toast";
import { shareApi } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { useT } from "@/shared/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Invoice, InvoiceKind, Party } from "@/types/domain";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";

interface InvoiceDetailDrawerProps {
  invoice: Invoice | null;
  kind: InvoiceKind;
  party: Party | null;
  onOpenChange: (open: boolean) => void;
  onMarkPaid?: () => void;
  onMarkReceived?: () => void;
  onVoid?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
}

export function InvoiceDetailDrawer({ invoice, kind, party, onOpenChange, onMarkPaid, onMarkReceived, onVoid, onDownload, onPrint }: InvoiceDetailDrawerProps) {
  const { t } = useT();
  const [markingPaid, setMarkingPaid] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [sharing, setSharing] = useState(false);
  if (!invoice) return null;
  const dueLabel = invoice.status === "paid" ? t("Settled", "تمت التسوية") : t("Due", "مستحق");
  const statusVariant = invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "destructive" : invoice.status === "draft" ? "muted" : "warning";

  const handleMarkPaid = async () => {
    if (!onMarkPaid) return;
    setMarkingPaid(true);
    try {
      await onMarkPaid();
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!onMarkReceived) return;
    setReceiving(true);
    try {
      await onMarkReceived();
    } finally {
      setReceiving(false);
    }
  };

  const handleVoid = async () => {
    if (!onVoid) return;
    setVoiding(true);
    try {
      await onVoid();
      setConfirmVoid(false);
    } finally {
      setVoiding(false);
    }
  };

  const openShare = async (via: "email" | "whatsapp") => {
    setSharing(true);
    try {
      const link = await shareApi().build({ type: "invoice", id: invoice.id });
      window.open(via === "email" ? link.mailto : link.whatsapp, "_blank");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to build share link", "فشل إنشاء رابط المشاركة"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet open={Boolean(invoice)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle>{invoice.number}</SheetTitle>
              <SheetDescription>
                {t(kind === "sale" ? "Sales invoice" : "Purchase order", kind === "sale" ? "فاتورة مبيعات" : "أمر شراء")} · {party?.name ?? t("Unknown", "غير معروف")}
              </SheetDescription>
            </div>
            <Badge variant={statusVariant} dot className="capitalize">
              {invoice.status}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {onMarkPaid ? (
            <Button onClick={handleMarkPaid} className="w-full" loading={markingPaid}>
              <Banknote className="size-4" />
              {t("Mark as paid", "تحديد كمدفوع")}
            </Button>
          ) : null}

          {onMarkReceived ? (
            <Button onClick={handleMarkReceived} className="w-full" loading={receiving}>
              <PackageCheck className="size-4" />
              {t("Mark as received", "تحديد كمستلم")}
            </Button>
          ) : null}

          {onVoid && invoice.status !== "cancelled" ? (
            <Button
              onClick={() => setConfirmVoid(true)}
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
            >
              <X className="size-4" />
              {t("Cancel transaction", "إلغاء المعاملة")}
            </Button>
          ) : null}

          {onDownload || onPrint ? (
            <div className="flex gap-2">
              {onDownload ? (
                <Button variant="outline" className="flex-1" onClick={onDownload}>
                  <Download className="size-4" />
                  {t("Download", "تنزيل")}
                </Button>
              ) : null}
              {onPrint ? (
                <Button variant="outline" className="flex-1" onClick={onPrint}>
                  <Printer className="size-4" />
                  {t("Print", "طباعة")}
                </Button>
              ) : null}
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full" disabled={sharing}>
                {sharing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                {t("Share", "مشاركة")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={sharing} onClick={() => void openShare("email")}>
                <Mail className="size-4" /> {t("Email", "البريد الإلكتروني")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={sharing} onClick={() => void openShare("whatsapp")}>
                <MessageCircle className="size-4" /> WhatsApp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label={t("Total", "الإجمالي")} value={formatCurrency(invoice.total, invoice.currency)} accent />
            <MiniStat label={t("Paid", "المدفوع")} value={formatCurrency(invoice.paid, invoice.currency)} />
            <MiniStat label={t("Issue date", "تاريخ الإصدار")} value={formatDate(invoice.issueDate)} />
            <MiniStat label={dueLabel} value={formatDate(invoice.dueDate)} />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Items", "البنود")}</h4>
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Description", "الوصف")}</TableHead>
                    <TableHead className="w-16 text-end">{t("Qty", "الكمية")}</TableHead>
                    <TableHead className="w-24 text-end">{t("Price", "السعر")}</TableHead>
                    <TableHead className="w-24 text-end">{t("Amount", "المبلغ")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.description || "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{line.quantity}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatCurrency(line.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1.5 border-t p-4 text-sm">
                <Row label={t("Subtotal", "المجموع الفرعي")} value={formatCurrency(invoice.subtotal, invoice.currency)} />
                {invoice.discount > 0 ? (
                  <Row label={t("Discount", "الخصم")} value={`-${formatCurrency(invoice.discount, invoice.currency)}`} />
                ) : null}
                <Row label={t("Tax", "الضريبة")} value={formatCurrency(invoice.tax, invoice.currency)} />
                <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
                  <span>{t("Total", "الإجمالي")}</span>
                  <span className="tabular-nums">{formatCurrency(invoice.total, invoice.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {party ? (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(kind === "sale" ? "Customer" : "Supplier", kind === "sale" ? "العميل" : "المورد")}
                </h4>
                <p className="text-sm font-medium">{party.name}</p>
                <p className="text-sm text-muted-foreground">{party.email || "—"}</p>
              </div>
            </>
          ) : null}

          {invoice.note ? (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Note", "ملاحظة")}</h4>
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="size-4" />
                {invoice.note}
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>

      <Dialog open={confirmVoid} onOpenChange={setConfirmVoid}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Cancel transaction", "إلغاء المعاملة")}</DialogTitle>
            <DialogDescription>
              {t(
                "This will void the invoice, reverse the stock movement and undo the recorded payment (revenue or expense). This cannot be undone.",
                "سيؤدي هذا إلى إلغاء الفاتورة وعكس حركة المخزون وإلغاء الدفعة المسجلة (إيراد أو مصروف). لا يمكن التراجع عن هذا الإجراء.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-destructive/5 p-3 text-sm">
            <span className="font-medium">{invoice.number}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            {formatCurrency(invoice.total, invoice.currency)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVoid(false)}>
              {t("Keep", "إبقاء")}
            </Button>
            <Button variant="destructive" onClick={() => void handleVoid()} loading={voiding}>
              {voiding ? t("Cancelling…", "جارٍ الإلغاء…") : t("Cancel transaction", "إلغاء المعاملة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}