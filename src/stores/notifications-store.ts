import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppNotification } from "@/types/domain";
import { uuid } from "@/lib/utils";

interface NotificationsState {
  items: AppNotification[];
  hydrate: (items: AppNotification[]) => void;
  addNotification: (
    notification: Omit<AppNotification, "id" | "read" | "createdAt">,
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  unreadCount: () => number;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrate: (items) => set({ items }),
      addNotification: (notification) =>
        set((state) => ({
          items: [
            {
              ...notification,
              id: uuid("ntf"),
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...state.items,
          ].slice(0, 60),
        })),
      markRead: (id) =>
        set((state) => ({
          items: state.items.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),
      markAllRead: () =>
        set((state) => ({
          items: state.items.map((n) => ({ ...n, read: true })),
        })),
      remove: (id) =>
        set((state) => ({ items: state.items.filter((n) => n.id !== id) })),
      unreadCount: () => get().items.filter((n) => !n.read).length,
    }),
    {
      name: "ledgerflow:notifications",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
