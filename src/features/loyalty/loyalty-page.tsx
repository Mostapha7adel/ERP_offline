import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal, Star, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { loyaltyApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { LoyaltyAccount, LoyaltyTransaction } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
const columnHelper = createColumnHelper<LoyaltyAccount>();

function buildColumns(h: {
  onEarn: (a: LoyaltyAccount) => void;
  onRedeem: (a: LoyaltyAccount) => void;
  onViewHistory: (a: LoyaltyAccount) => void;
  t: TranslateFn;
}): ColumnDef<LoyaltyAccount, any>[] {
  return [
    columnHelper.accessor("customerName", {
      header: h.t("Customer", "العميل"),
      cell: (info) => {
        const a = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Star className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue() ?? a.customerId}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("pointsBalance", {
      header: h.t("Balance", "الرصيد"),
      cell: (info) => (
        <Badge variant={info.getValue() > 0 ? "success" : "muted"} dot>
          <span className="tabular-nums">{info.getValue()} {h.t("pts", "نقطة")}</span>
        </Badge>
      ),
    }),
    columnHelper.accessor("totalEarned", {
      header: h.t("Total Earned", "المحصل"),
      cell: (info) => <span className="tabular-nums text-green-600">+{info.getValue()}</span>,
    }),
    columnHelper.accessor("totalRedeemed", {
      header: h.t("Total Redeemed", "المستخدم"),
      cell: (info) => <span className="tabular-nums text-red-600">-{info.getValue()}</span>,
    }),
    columnHelper.accessor("updatedAt", {
      header: h.t("Last Activity", "آخر نشاط"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const a = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => h.onEarn(a)}>
                <ArrowUpCircle className="size-4" /> {h.t("Earn points", "إضافة نقاط")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => h.onRedeem(a)}>
                <ArrowDownCircle className="size-4" /> {h.t("Redeem points", "استخدام نقاط")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => h.onViewHistory(a)}>
                <Star className="size-4" /> {h.t("Transaction history", "سجل المعاملات")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];
}

export function LoyaltyPage() {
  const items = useLoyaltyStore((s) => s.items);
  const update = useLoyaltyStore((s) => s.update);

  const [search, setSearch] = useState("");
  const [earnOpen, setEarnOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null);
  const [points, setPoints] = useState(0);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<LoyaltyAccount | null>(null);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);

  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) =>
      [a.customerName ?? "", a.customerId].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const openEarn = (a: LoyaltyAccount) => {
    setSelectedAccount(a);
    setPoints(0);
    setDescription("");
    setEarnOpen(true);
  };

  const openRedeem = (a: LoyaltyAccount) => {
    setSelectedAccount(a);
    setPoints(0);
    setDescription("");
    setRedeemOpen(true);
  };

  const handleEarn = async () => {
    if (!selectedAccount || points <= 0) return;
    setBusy(true);
    try {
      const updated = await loyaltyApi().earn({
        customerId: selectedAccount.customerId,
        points,
        description,
      });
      update(selectedAccount.id, updated);
      toast.success(t("Points earned", "تم إضافة النقاط"));
      setEarnOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const handleRedeem = async () => {
    if (!selectedAccount || points <= 0) return;
    setBusy(true);
    try {
      const updated = await loyaltyApi().redeem({
        customerId: selectedAccount.customerId,
        points,
        description,
      });
      update(selectedAccount.id, updated);
      toast.success(t("Points redeemed", "تم استخدام النقاط"));
      setRedeemOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const viewHistory = async (a: LoyaltyAccount) => {
    try {
      const txns = await loyaltyApi().transactions(a.customerId);
      setHistory(txns);
      setHistoryAccount(a);
    } catch {
      setHistory([]);
      setHistoryAccount(a);
    }
  };

  const columns = useMemo<ColumnDef<LoyaltyAccount, any>[]>(
    () =>
      buildColumns({
        onEarn: openEarn,
        onRedeem: openRedeem,
        onViewHistory: viewHistory,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Loyalty Points", "نقاط الولاء")}
        description={t("Manage customer loyalty points balances.", "إدارة أرصدة نقاط ولاء العملاء.")}
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={6} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search customers…", "ابحث عن عملاء…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("accounts", "حساب")}</div>
              </div>
            }
            emptyTitle={t("No loyalty accounts", "لا توجد حسابات ولاء")}
            emptyDescription={t("Loyalty accounts will appear here once customers earn points.", "ستظهر حسابات الولاء هنا عندما يكسب العملاء نقاطاً.")}
          />
        )}
      </div>

      <Dialog open={earnOpen} onOpenChange={(open) => { if (!open) setEarnOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Earn Points", "إضافة نقاط")}</DialogTitle>
            <DialogDescription>
              {selectedAccount ? `${t("Customer", "العميل")}: ${selectedAccount.customerName ?? selectedAccount.customerId}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Points", "النقاط")}</Label>
              <Input
                type="number"
                min={1}
                value={points || ""}
                onChange={(e) => setPoints(Number(e.target.value))}
                placeholder={t("Enter points", "أدخل النقاط")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Description", "الوصف")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("e.g. Purchase reward", "مثلاً: مكافأة شراء")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarnOpen(false)}>{t("Cancel", "إلغاء")}</Button>
            <Button onClick={handleEarn} loading={busy} disabled={points <= 0}>
              <ArrowUpCircle className="size-4" />
              {t("Add Points", "إضافة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={redeemOpen} onOpenChange={(open) => { if (!open) setRedeemOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Redeem Points", "استخدام نقاط")}</DialogTitle>
            <DialogDescription>
              {selectedAccount
                ? `${t("Available", "المتوفر")}: ${selectedAccount.pointsBalance} ${t("pts", "نقطة")}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Points", "النقاط")}</Label>
              <Input
                type="number"
                min={1}
                max={selectedAccount?.pointsBalance ?? 0}
                value={points || ""}
                onChange={(e) => setPoints(Number(e.target.value))}
                placeholder={t("Enter points", "أدخل النقاط")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Description", "الوصف")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("e.g. Discount applied", "مثلاً: خصم مطبق")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemOpen(false)}>{t("Cancel", "إلغاء")}</Button>
            <Button onClick={handleRedeem} loading={busy} disabled={points <= 0 || points > (selectedAccount?.pointsBalance ?? 0)}>
              <ArrowDownCircle className="size-4" />
              {t("Redeem", "استخدام")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyAccount !== null} onOpenChange={(open) => { if (!open) { setHistoryAccount(null); setHistory([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Transaction History", "سجل المعاملات")}</DialogTitle>
          </DialogHeader>
          {history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Date", "التاريخ")}</TableHead>
                  <TableHead>{t("Type", "النوع")}</TableHead>
                  <TableHead className="text-end">{t("Points", "النقاط")}</TableHead>
                  <TableHead>{t("Description", "الوصف")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{formatDate(txn.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={txn.type === "earn" ? "success" : "warning"} dot>
                        {txn.type === "earn" ? t("Earn", "إضافة") : t("Redeem", "استخدام")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <span className={txn.type === "earn" ? "text-green-600" : "text-red-600"}>
                        {txn.type === "earn" ? "+" : "-"}{txn.points}
                      </span>
                    </TableCell>
                    <TableCell>{txn.description ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("No transactions found.", "لا توجد معاملات.")}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHistoryAccount(null); setHistory([]); }}>
              {t("Close", "إغلاق")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
