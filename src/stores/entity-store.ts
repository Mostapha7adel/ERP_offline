import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist } from "zustand/middleware";
import { uuid } from "@/lib/utils";

export interface EntityState<T extends { id: string }> {
  items: T[];
  add: (item: T) => T;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  upsert: (item: T) => void;
  getById: (id: string) => T | undefined;
  reset: () => void;
  hydrate: (items: T[]) => void;
  get: () => T[];
}

export type EntityStore<T extends { id: string }> = UseBoundStore<
  StoreApi<EntityState<T>>
>;

export function createEntityStore<T extends { id: string }>(
  key: string,
  initialItems: T[],
): EntityStore<T> {
  return create<EntityState<T>>()(
    persist(
      (set, get) => ({
        items: initialItems,
        add: (item) => {
          const record = { ...item };
          set((state) => ({ items: [record, ...state.items] }));
          return record;
        },
        update: (id, patch) =>
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id ? { ...item, ...patch, id } : item,
            ),
          })),
        remove: (id) =>
          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
          })),
        upsert: (item) =>
          set((state) => {
            const exists = state.items.some((i) => i.id === item.id);
            return {
              items: exists
                ? state.items.map((i) => (i.id === item.id ? item : i))
                : [item, ...state.items],
            };
          }),
        getById: (id) => get().items.find((item) => item.id === id),
        reset: () => set({ items: initialItems }),
        hydrate: (items) => set({ items }),
        get: () => get().items,
      }),
      { name: `ledgerflow:${key}` },
    ),
  );
}

export function createId(prefix: string): string {
  return uuid(prefix);
}
