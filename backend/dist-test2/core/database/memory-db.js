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
    collections = new Map();
    collection(name) {
        let col = this.collections.get(name);
        if (!col) {
            col = [];
            this.collections.set(name, col);
        }
        return col;
    }
    hasCollection(name) {
        return this.collections.has(name);
    }
    replaceCollection(name, items) {
        this.collections.set(name, items);
    }
    /** Deep snapshot used for transactional rollback. */
    snapshot() {
        const snap = new Map();
        for (const [key, value] of this.collections) {
            snap.set(key, structuredClone(value));
        }
        return snap;
    }
    restore(snapshot) {
        this.collections = new Map();
        for (const [key, value] of snapshot) {
            this.collections.set(key, structuredClone(value));
        }
    }
    exportAll() {
        const out = {};
        for (const [key, value] of this.collections) {
            out[key] = structuredClone(value);
        }
        return out;
    }
    importAll(data) {
        this.collections = new Map();
        for (const [key, value] of Object.entries(data)) {
            this.collections.set(key, structuredClone(Array.isArray(value) ? value : []));
        }
    }
    clearAll() {
        this.collections = new Map();
    }
}
export const memoryDb = new MemoryDatabase();
