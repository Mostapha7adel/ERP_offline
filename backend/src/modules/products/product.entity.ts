export type ProductStatus = "active" | "draft" | "archived";
export type ProductType = "product" | "service";

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  type: ProductType;
  category?: string;
  brand?: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  taxRate: number;
  imageUrl?: string;
  trackStock: boolean;
  reorderLevel?: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}
