import { useRef, useState } from "react";
import {
  UploadCloud, Download, CheckCircle2, XCircle, AlertCircle, RefreshCw, PackageSearch, Users,
} from "lucide-react";
import { importApi } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import type { ImportResult } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { StateShell } from "@/shared/components/feedback/states";

type ImportKind = "products" | "parties";

const PRODUCT_HEADERS = [
  "sku", "name", "description", "category", "brand", "unit", "purchasePrice", "salePrice", "taxRate", "trackStock", "reorderLevel", "barcode",
];

const PARTY_HEADERS = [
  "type", "name", "code", "contactName", "email", "phone", "address", "city", "taxNumber", "creditLimit", "currency",
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function toNumber(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: string | undefined): boolean {
  return /^(1|true|yes|نعم)$/i.test(String(v ?? "").trim());
}

export function ImportPage() {
  const { t } = useT();
  const canImport = usePermission("import.create");
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ImportKind>("products");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  if (!canImport) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Import", "الاستيراد")} description={t("Bulk import products and parties from CSV.", "استيراد المنتجات والأطراف بكميات كبيرة من CSV.")} />
        <Card>
          <StateShell icon={UploadCloud} title={t("No access", "لا توجد صلاحية")} description={t("You don't have permission to import data.", "لا تملك صلاحية استيراد البيانات.")} />
        </Card>
      </div>
    );
  }

  const headers = kind === "products" ? PRODUCT_HEADERS : PARTY_HEADERS;

  const downloadTemplate = () => {
    const rows: Array<Array<string | number>> = [
      headers,
      kind === "products"
        ? ["SKU-001", "Sample Product", "Optional description", "General", "Acme", "pcs", 100, 150, 14, 1, 5, "1234567890123"]
        : ["customer", "Sample Customer", "CUST-001", "Contact Person", "customer@example.com", "+201000000000", "Street 1", "Cairo", "999-123456", 50000, "EGP"],
    ];
    void downloadCsv(
      kind === "products" ? "ledgerflow-products-template.csv" : "ledgerflow-parties-template.csv",
      rows,
    );
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error(t("The file is empty.", "الملف فارغ."));
        return;
      }
      // Skip header row if present and map remaining rows by header order.
      const headerRow = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
      const hasHeader = headers.some((h) => headerRow.includes(h));
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const byKey = (r: string[], key: string): string | undefined => {
        const idx = headerRow.indexOf(key);
        return idx >= 0 ? r[idx] : undefined;
      };

      let res: ImportResult;
      if (kind === "products") {
        res = await importApi().products(
          dataRows.map((r) => ({
            sku: String(byKey(r, "sku") ?? "").trim() || `IMP-${Math.random().toString(36).slice(2, 8)}`,
            name: String(byKey(r, "name") ?? "").trim(),
            description: byKey(r, "description"),
            category: byKey(r, "category"),
            brand: byKey(r, "brand"),
            unit: byKey(r, "unit") || "pcs",
            purchasePrice: toNumber(byKey(r, "purchasePrice")) ?? 0,
            salePrice: toNumber(byKey(r, "salePrice")) ?? 0,
            taxRate: toNumber(byKey(r, "taxRate")) ?? 0,
            trackStock: toBool(byKey(r, "trackStock")),
            reorderLevel: toNumber(byKey(r, "reorderLevel")),
            barcode: byKey(r, "barcode"),
          })),
          true,
        );
      } else {
        res = await importApi().parties(
          dataRows.map((r) => ({
            type: (byKey(r, "type") ?? "customer").toLowerCase() === "supplier" ? "supplier" : "customer",
            name: String(byKey(r, "name") ?? "").trim(),
            code: byKey(r, "code"),
            contactName: byKey(r, "contactName"),
            email: byKey(r, "email"),
            phone: byKey(r, "phone"),
            address: byKey(r, "address"),
            city: byKey(r, "city"),
            taxNumber: byKey(r, "taxNumber"),
            creditLimit: toNumber(byKey(r, "creditLimit")),
            currency: byKey(r, "currency") || "EGP",
          })),
          true,
        );
      }
      setResult(res);
      toast.success(
        t("Import complete: ${created} created, ${updated} updated", "اكتمل الاستيراد: ${created} جديد، ${updated} محدث")
          .replace("${created}", String(res.created))
          .replace("${updated}", String(res.updated)),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Import failed", "فشل الاستيراد"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const tabs = (["products", "parties"] as ImportKind[]).map((k) => ({
    value: k,
    label: k === "products" ? t("Products", "المنتجات") : t("Parties", "الأطراف"),
    description: k === "products" ? t("Import product catalog by SKU (upsert).", "استيراد كتالوج المنتجات عبر SKU (تحديث أو إنشاء).") : t("Import customers and suppliers (upsert).", "استيراد العملاء والموردين (تحديث أو إنشاء)."),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Data Import", "استيراد البيانات")}
        description={t("Bulk import products and parties from CSV files.", "استيراد المنتجات والأطراف بكميات كبيرة من ملفات CSV.")}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setKind(tab.value as ImportKind); setResult(null); }}
            className={`rounded-xl border p-4 text-start transition-colors ${kind === tab.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {tab.value === "products" ? <PackageSearch className="size-4" /> : <Users className="size-4" />}
              {tab.label}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{tab.description}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            {t("Import ${kind}", "استيراد ${kind}").replace("${kind}", kind === "products" ? t("Products", "المنتجات") : t("Parties", "الأطراف"))}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="size-4" /> {t("Download template", "تنزيل قالب")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/40"
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {fileName ? fileName : t("Choose a CSV file", "اختر ملف CSV")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Headers", "العناوين")}: {headers.join(", ")}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>

          {busy ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" />
              {t("Importing…", "جارٍ الاستيراد…")}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" dot>
                  {t("Created", "جديد")}: {result.created}
                </Badge>
                <Badge variant="outline" dot>
                  {t("Updated", "محدث")}: {result.updated}
                </Badge>
                <Badge variant="muted" dot>
                  {t("Skipped", "مُتخطى")}: {result.skipped}
                </Badge>
              </div>
              {result.errors.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-1 text-xs">
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                      <span>
                        {t("Row", "سطر")} {err.row}: {err.error}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  <CheckCircle2 className="size-4" />
                  {t("All rows imported successfully.", "تم استيراد جميع السطور بنجاح.")}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {t(
                "The first row can contain the column headers shown above. Existing records are updated when their SKU (products) or code/email/phone (parties) matches.",
                "يمكن أن يحتوي السطر الأول على عناوين الأعمدة الموضحة أعلاه. يتم تحديث السجلات الموجودة عند تطابق SKU (المنتجات) أو الكود/البريد/الهاتف (الأطراف).",
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}