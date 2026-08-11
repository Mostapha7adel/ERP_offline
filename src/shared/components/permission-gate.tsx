import type { ReactNode } from "react";
import { useCan } from "@/stores/auth-store";
import { ForbiddenState } from "@/shared/components/feedback/states";
import type { PermissionKey } from "@/types/navigation";

interface PermissionGateProps {
  permission?: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const can = useCan();
  if (!permission || can(permission)) return <>{children}</>;
  return fallback ?? <ForbiddenState className="mx-auto max-w-md" />;
}

export function usePermission(permission?: PermissionKey): boolean {
  const can = useCan();
  return !permission || can(permission);
}