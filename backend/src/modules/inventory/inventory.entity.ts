export type MovementType =
  | "initial"
  | "purchase"
  | "sale"
  | "adjustment"
  | "transfer-in"
  | "transfer-out"
  | "return"
  | "write-off";

export interface StockItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  reservedQuantity: number;
  reorderLevel: number;
  averageCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number; // signed
  reference?: string;
  referenceId?: string;
  note?: string;
  cost: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
