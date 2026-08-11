import { useSuppliersStore } from "@/stores/parties-store";
import { useProductsStore } from "@/stores/products-store";
import { useWarehousesStore, useInventoryStore } from "@/stores/inventory-store";
import { InvoicesModule } from "./invoices-module";

export function PurchasesPage() {
  return (
    <InvoicesModule
      kind="purchase"
      getParties={() => useSuppliersStore.getState().items}
      getProducts={() => useProductsStore.getState().items}
      getWarehouses={() => useWarehousesStore.getState().items}
      getStock={() => useInventoryStore.getState().items}
    />
  );
}