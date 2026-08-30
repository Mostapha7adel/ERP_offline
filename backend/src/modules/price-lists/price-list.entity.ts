export interface PriceList {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PriceListItem {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  minQuantity: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
