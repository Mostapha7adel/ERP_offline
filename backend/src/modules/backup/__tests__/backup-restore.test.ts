import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dynamic DB imports used by importAll/exportAll.
vi.mock("../../../core/database/prisma.js", () => {
  const tableProxy = new Proxy(
    {},
    {
      get: () => ({
        deleteMany: vi.fn(async () => 0),
        createMany: vi.fn(async () => 0),
        findMany: vi.fn(async () => []),
      }),
    },
  );
  return {
    runInTransaction: vi.fn(async (fn: () => Promise<void>) => fn()),
    getDb: vi.fn(() => tableProxy),
    prisma: {},
  };
});

vi.mock("../../../core/database/company.js", () => ({
  resetCompanyCache: vi.fn(),
}));

vi.mock("../../../core/audit/audit.service.js", () => ({
  auditService: { log: vi.fn(async () => {}) },
}));

vi.mock("../../../core/logger/logger.js", () => ({
  logger: { info: vi.fn() },
}));

import { BackupService } from "../backup.service.js";
import { AppError } from "../../../core/errors/app-error.js";

const service = new BackupService();
const audit = { principal: { sub: "u1" } } as never;

function validSnapshot() {
  return {
    company: [{ id: "c1" }],
    user: [{ id: "u1" }],
    role: [{ id: "r1" }],
    permission: [{ id: "p1" }],
    party: [{ id: "pt1" }],
  };
}

describe("BackupService.restoreFromPayload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a flat snapshot with all required tables", async () => {
    const result = await service.restoreFromPayload(validSnapshot(), audit);
    expect(result.restored).toBe(5);
  });

  it("accepts the wrapped download format { app, version, data }", async () => {
    const payload = { app: "ledgerflow", version: 1, createdAt: "2026-01-01T00:00:00Z", data: validSnapshot() };
    const result = await service.restoreFromPayload(payload, audit);
    expect(result.restored).toBe(5);
  });

  it("rejects null / non-object payloads", async () => {
    await expect(service.restoreFromPayload(null, audit)).rejects.toThrow(AppError);
    await expect(service.restoreFromPayload("hello", audit)).rejects.toThrow("expected an object");
  });

  it("rejects a wrapped payload with the wrong app signature", async () => {
    const payload = { app: "evil", version: 1, data: validSnapshot() };
    await expect(service.restoreFromPayload(payload, audit)).rejects.toThrow("unrecognized app signature");
  });

  it("rejects a wrapped payload with an unsupported version", async () => {
    const payload = { app: "ledgerflow", version: 99, data: validSnapshot() };
    await expect(service.restoreFromPayload(payload, audit)).rejects.toThrow("unsupported backup version");
  });

  it("rejects a wrapped payload missing the data snapshot", async () => {
    const payload = { app: "ledgerflow", version: 1 };
    await expect(service.restoreFromPayload(payload, audit)).rejects.toThrow("missing data snapshot");
  });

  it("rejects a snapshot missing a required table", async () => {
    const snapshot = validSnapshot();
    delete (snapshot as Record<string, unknown>).party;
    await expect(service.restoreFromPayload(snapshot, audit)).rejects.toThrow('missing required table "party"');
  });

  it("rejects a snapshot where a table is not an array", async () => {
    const snapshot = validSnapshot();
    snapshot.party = "not-an-array" as never;
    await expect(service.restoreFromPayload(snapshot, audit)).rejects.toThrow('missing required table "party"');
  });

  it("rejects a snapshot that is an array at the top level", async () => {
    await expect(service.restoreFromPayload([], audit)).rejects.toThrow("expected a table snapshot object");
  });
});
