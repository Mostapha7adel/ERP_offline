/**
 * In-memory database adapter.
 *
 * This is the current implementation of the "Database Layer". It mirrors the
 * persistence contract the rest of the app relies on, and it supports
 * snapshot/restore so transactions and restore/backup work end-to-end.
 *
 * When the SQLite schema is introduced, this file is swapped for a Prisma
 * client (same responsibilities: collections <-> models), leaving the
 * repository layer untouched.
 */
export class MemoryDatabase {
  private collections = new Map<string, unknown[]>();

  collection<T>(name: string): T[] {
    let col = this.collections.get(name) as T[] | undefined;
    if (!col) {
      col = [];
      this.collections.set(name, col);
    }
    return col;
  }

  hasCollection(name: string): boolean {
    return this.collections.has(name);
  }

  replaceCollection<T>(name: string, items: T[]): void {
    this.collections.set(name, items);
  }

  /** Deep snapshot used for transactional rollback. */
  snapshot(): Map<string, unknown[]> {
    const snap = new Map<string, unknown[]>();
    for (const [key, value] of this.collections) {
      snap.set(key, structuredClone(value));
    }
    return snap;
  }

  restore(snapshot: Map<string, unknown[]>): void {
    this.collections = new Map();
    for (const [key, value] of snapshot) {
      this.collections.set(key, structuredClone(value));
    }
  }

  exportAll(): Record<string, unknown[]> {
    const out: Record<string, unknown[]> = {};
    for (const [key, value] of this.collections) {
      out[key] = structuredClone(value);
    }
    return out;
  }

  importAll(data: Record<string, unknown[]>): void {
    this.collections = new Map();
    for (const [key, value] of Object.entries(data)) {
      this.collections.set(key, structuredClone(Array.isArray(value) ? value : []));
    }
  }

  clearAll(): void {
    this.collections = new Map();
  }
}

export const memoryDb = new MemoryDatabase();
