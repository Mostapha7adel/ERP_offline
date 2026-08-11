import { Navigate, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Sidebar } from "@/shared/components/layout/sidebar";
import { TopNav } from "@/shared/components/layout/top-nav";
import { CommandPalette } from "@/shared/components/layout/command-palette";
import { MobileNav } from "@/shared/components/layout/mobile-nav";
import { ForcePasswordChange } from "@/features/auth/force-password-change";
import { SetupScreen } from "@/features/auth/setup-screen";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";

export function AppShell() {
  const commandOpen = useUIStore((s) => s.commandOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const needsSetup = useAuthStore((s) => s.needsSetup);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // The initial workspace/onboarding screens (change password + import/start
  // from scratch) are reserved for the super admin first login only. Other
  // roles must never be routed through them, so they are gated on isSuperAdmin.
  if (isSuperAdmin && mustChangePassword) return <ForcePasswordChange />;

  if (isSuperAdmin && needsSetup) return <SetupScreen />;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key="page"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="container px-3 py-4 sm:px-6 sm:py-6 lg:py-8"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
      />
    </div>
  );
}