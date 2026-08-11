import { createEntityStore } from "./entity-store";
import type { Warehouse, StockItem } from "@/types/domain";

export const useWarehousesStore = createEntityStore<Warehouse>("warehouses", []);

export const useInventoryStore = createEntityStore<StockItem>("inventory", []);

export function stockInWarehouse(
  stock: StockItem[],
  productId: string,
  warehouseId: string,
): StockItem[] {
  return stock.filter(
    (item) => item.productId === productId && item.warehouseId === warehouseId,
  );
}

export function totalStock(stock: StockItem[], productId: string): number {
  return stock
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
}
