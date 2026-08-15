import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUser, AppRole } from "@/types/domain";
import { defaultRoles } from "@/lib/permissions";
import { authApi } from "@/lib/api";
import { mapBackendPermissions } from "@/lib/api/permissions";
import { setAccessToken, setRefreshToken, getRefreshToken, setUnauthorizedHandler, setRefreshHandler, setTokenPersistence } from "@/lib/api/client";
import { getDeviceConfig } from "@/lib/api/config";
import { clearAllDomainData } from "@/stores/reset";
import type { PermissionKey } from "@/types/navigation";

const USER_COLORS = [
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#059669",
  "#ea580c",
  "#ca8a04",
  "#2563eb",
  "#16a34a",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface AuthState {
  currentUser: AppUser | null;
  roles: AppRole[];
  isAuthenticated: boolean;
  /** True while the signed-in user must set a new password (first login). */
  mustChangePassword: boolean;
  /** True once the user completes first-run setup (import data or start fresh). */
  needsSetup: boolean;
  /** True while the persisted session is being validated against the backend at boot. */
  isSessionValidating: boolean;
  /** True once the app data has been fetched from the backend into the stores. */
  hydrated: boolean;
  /** Mark app data as loaded from the backend. */
  setHydrated: () => void;
  /** Frontend permission keys resolved from the backend principal. */
  permissions: PermissionKey[];
  /** True when the signed-in user holds the super-admin wildcard. */
  isSuperAdmin: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AppUser>;
  logout: () => Promise<void>;
  setCurrentUser: (user: AppUser, roleName: string) => void;
  setRoles: (roles: AppRole[]) => void;
  setPermissions: (permissions: PermissionKey[]) => void;
  clearMustChangePassword: () => void;
  updateCurrentUserEmail: (email: string) => void;
  updateCurrentUser: (patch: Partial<AppUser>) => void;
  completeSetup: () => void;
  validateSession: () => Promise<boolean>;
}

const initialPermissions: PermissionKey[] = [];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      roles: defaultRoles,
      isAuthenticated: false,
      mustChangePassword: false,
      needsSetup: false,
      isSessionValidating: false,
      hydrated: false,
      permissions: initialPermissions,
      isSuperAdmin: false,

      setHydrated: () => set({ hydrated: true }),

      login: async (email, password, remember = true) => {
        const result = await authApi().login({ email, password });
        setTokenPersistence(remember);
        setAccessToken(result.accessToken);
        setRefreshToken(result.refreshToken);
        const principal = result.user;
        const user: AppUser = {
          id: principal.sub,
          name: principal.name,
          email: principal.email,
          roleId: principal.roleId,
          status: "active",
          lastActiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          color: USER_COLORS[hashString(principal.email) % USER_COLORS.length] ?? "#7c3aed",
        };
        const isSuperAdmin = principal.permissions.includes("*");
        set({
          currentUser: user,
          isAuthenticated: true,
          mustChangePassword: result.mustChangePassword ?? false,
          needsSetup: result.needsSetup ?? false,
          permissions: mapBackendPermissions(principal.permissions),
          isSuperAdmin,
        });
        return user;
      },

      logout: async () => {
        const { currentUser } = get();
        if (currentUser) {
          const refreshToken = getRefreshToken();
          if (refreshToken) {
            try {
              await authApi().logout(refreshToken);
            } catch {
              // ignore network errors on logout
            }
          }
        }
        // On a client device the host's dataset was hydrated into local
        // storage; clear it so it does not linger after signing out.
        if (getDeviceConfig().mode === "client") {
          clearAllDomainData();
        }
        setAccessToken(null);
        setRefreshToken(null);
        set({
          currentUser: null,
          isAuthenticated: false,
          mustChangePassword: false,
          needsSetup: false,
          hydrated: false,
          permissions: initialPermissions,
          isSuperAdmin: false,
        });
      },

  setCurrentUser: (user, _roleName) =>
    set({ currentUser: user, isAuthenticated: true }),

  clearMustChangePassword: () => set({ mustChangePassword: false }),

  completeSetup: () => set({ needsSetup: false }),

  updateCurrentUserEmail: (email: string) =>
    set((state) =>
      state.currentUser
        ? { currentUser: { ...state.currentUser, email } }
        : state,
    ),

  updateCurrentUser: (patch: Partial<AppUser>) =>
    set((state) =>
      state.currentUser
        ? { currentUser: { ...state.currentUser, ...patch } }
        : state,
    ),

      validateSession: async () => {
        const { isAuthenticated } = get();
        if (!isAuthenticated) return true;
        set({ isSessionValidating: true });
        try {
          // authApi().me() returns the principal. On a stale access token the
          // API client silently refreshes first; if refresh fails it clears the
          // session and /auth/me would throw.
          const principal = await authApi().me();
          const user: AppUser = {
            id: principal.sub,
            name: principal.name,
            email: principal.email,
            roleId: principal.roleId,
            status: "active",
            lastActiveAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            color: USER_COLORS[hashString(principal.email) % USER_COLORS.length] ?? "#7c3aed",
          };
          set({
            currentUser: user,
            isAuthenticated: true,
            permissions: mapBackendPermissions(principal.permissions),
            isSuperAdmin: principal.permissions.includes("*"),
          });
          return true;
        } catch {
          set({
            currentUser: null,
            isAuthenticated: false,
            hydrated: false,
            permissions: initialPermissions,
          });
          return false;
        } finally {
          set({ isSessionValidating: false });
        }
      },

      setRoles: (roles) => set({ roles }),

      setPermissions: (permissions) => set({ permissions }),
    }),
    {
      name: "ledgerflow:auth",
      partialize: (state) => ({
        currentUser: state.currentUser,
        roles: state.roles,
        isAuthenticated: state.isAuthenticated,
        mustChangePassword: state.mustChangePassword,
        needsSetup: state.needsSetup,
        permissions: state.permissions,
        isSuperAdmin: state.isSuperAdmin,
      }),    },
  ),
);

export function useCurrentUserPermissions(): string[] {
  return useAuthStore((s) => s.permissions);
}

export function useCan(): (permission?: string) => boolean {
  const permissions = useCurrentUserPermissions();
  return (permission) =>
    !permission ? true : permissions.includes(permission);
}

/**
 * Attempt a silent token refresh using the stored refresh token.
 * Returns true on success and stores the fresh access/refresh pair.
 */
async function tryRefreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const result = await authApi().refresh(refreshToken);
    setAccessToken(result.accessToken);
    // The backend issues a new access token but reuses the refresh session.
    if (result.refreshToken) setRefreshToken(result.refreshToken);
    const principal = result.user;
    const user: AppUser = {
      id: principal.sub,
      name: principal.name,
      email: principal.email,
      roleId: principal.roleId,
      status: "active",
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      color: USER_COLORS[hashString(principal.email) % USER_COLORS.length] ?? "#7c3aed",
    };
    useAuthStore.setState({
      currentUser: user,
      isAuthenticated: true,
      mustChangePassword: result.mustChangePassword ?? false,
      permissions: mapBackendPermissions(principal.permissions),
      isSuperAdmin: principal.permissions.includes("*"),
    });
    return true;
  } catch {
    return false;
  }
}

/** Wire the API client so any 401 first tries a silent refresh, then clears the auth session. */
export function initAuthTokenHandling(): void {
  setRefreshHandler(tryRefreshSession);
  setUnauthorizedHandler(() => {
    setAccessToken(null);
    setRefreshToken(null);
    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
      permissions: [],
    });
  });
}
