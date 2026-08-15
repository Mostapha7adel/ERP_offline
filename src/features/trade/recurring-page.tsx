import { useState } from "react";
import { useCustomersStore } from "@/stores/parties-store";
import { useSuppliersStore } from "@/stores/parties-store";
import { useProductsStore } from "@/stores/products-store";
import { useWarehousesStore } from "@/stores/inventory-store";
import { useT } from "@/shared/lib/i18n";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { RecurringModule } from "./recurring-module";
import type { InvoiceKind } from "@/types/domain";

export function RecurringPage() {
  const { t } = useT();
  const [kind, setKind] = useState<InvoiceKind>("sale");

  return (
    <div className="space-y-4">
      <Tabs value={kind} onValueChange={(v) => setKind(v as InvoiceKind)}>
        <TabsList>
          <TabsTrigger value="sale">{t("Sales recurring", "فواتير المبيعات الدورية")}</TabsTrigger>
          <TabsTrigger value="purchase">{t("Purchase recurring", "فواتير المشتريات الدورية")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <RecurringModule
        kind={kind}
        getParties={() =>
          kind === "sale"
            ? useCustomersStore.getState().items
            : useSuppliersStore.getState().items
        }
        getProducts={() => useProductsStore.getState().items}
        getWarehouses={() => useWarehousesStore.getState().items}
      />
    </div>
  );
}
