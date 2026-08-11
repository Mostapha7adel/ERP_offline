export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  manager?: string;
  phone?: string;
  isDefault: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}
