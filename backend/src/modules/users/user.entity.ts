export type UserStatus = "active" | "inactive";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  status: UserStatus;
  mustChangePassword: boolean;
  phone?: string;
  jobTitle?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}
