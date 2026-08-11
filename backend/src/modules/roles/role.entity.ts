export interface Role {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  permissions: string[];
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}
