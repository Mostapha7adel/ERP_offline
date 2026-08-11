import { useCustomersStore } from "@/stores/parties-store";
import { useProductsStore } from "@/stores/products-store";
import { useWarehousesStore, useInventoryStore } from "@/stores/inventory-store";
import { InvoicesModule } from "./invoices-module";

export function SalesPage() {
  return (
    <InvoicesModule
      kind="sale"
      getParties={() => useCustomersStore.getState().items}
      getProducts={() => useProductsStore.getState().items}
      getWarehouses={() => useWarehousesStore.getState().items}
      getStock={() => useInventoryStore.getState().items}
    />
  );
}