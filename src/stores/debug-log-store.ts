import { create } from "zustand";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status: number | null;
  duration: number | null;
  level: LogLevel;
  error?: string;
}

interface DebugLogState {
  entries: LogEntry[];
  maxEntries: number;
  addEntry: (entry: Omit<LogEntry, "id">) => void;
  clear: () => void;
}

let nextId = 1;

export const useDebugLogStore = create<DebugLogState>()((set) => ({
  entries: [],
  maxEntries: 200,

  addEntry: (entry) =>
    set((state) => ({
      entries: [
        { ...entry, id: nextId++ },
        ...state.entries,
      ].slice(0, state.maxEntries),
    })),

  clear: () => set({ entries: [] }),
}));
