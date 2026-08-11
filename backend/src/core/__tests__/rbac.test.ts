import { describe, it, expect, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrincipal, requirePermission, requireRole } from "../security/rbac.js";
import { AppError } from "../errors/app-error.js";

function makeRequest(principal?: Record<string, unknown>): FastifyRequest {
  return { principal } as unknown as FastifyRequest;
}

function makeReply() {
  let sent: { code: number; body: unknown } | null = null;
  let statusCode = 200;
  const reply = {
    code(c: number) {
      statusCode = c;
      return reply;
    },
    send(body: unknown) {
      sent = { code: statusCode, body };
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, getSent: () => sent };
}

describe("getPrincipal", () => {
  it("returns the attached principal", () => {
    const p = { sub: "u1", permissions: [] };
    expect(getPrincipal(makeRequest(p))).toEqual(p);
  });

  it("throws Unauthorized when missing", () => {
    expect(() => getPrincipal(makeRequest())).toThrow(AppError);
    try {
      getPrincipal(makeRequest());
    } catch (e) {
      const err = e as AppError;
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("requirePermission", () => {
  it("allows when the principal has the permission", async () => {
    const { reply, getSent } = makeReply();
    await requirePermission("users:read")(makeRequest({ permissions: ["users:read"] }), reply);
    expect(getSent()).toBeNull();
  });

  it("allows super admin wildcard", async () => {
    const { reply, getSent } = makeReply();
    await requirePermission("anything:atAll")(makeRequest({ permissions: ["*"] }), reply);
    expect(getSent()).toBeNull();
  });

  it("forbids when the permission is missing", async () => {
    const { reply, getSent } = makeReply();
    await requirePermission("users:delete")(makeRequest({ permissions: ["users:read"] }), reply);
    const sent = getSent();
    expect(sent).not.toBeNull();
    expect(sent?.code).toBe(403);
  });

  it("rejects with 401 when unauthenticated", async () => {
    const { reply, getSent } = makeReply();
    await requirePermission("users:read")(makeRequest(), reply);
    const sent = getSent();
    expect(sent?.code).toBe(401);
  });
});

describe("requireRole", () => {
  it("allows a matching role", async () => {
    const { reply, getSent } = makeReply();
    await requireRole("Admin", "Manager")(
      makeRequest({ roleName: "Manager", permissions: [] }),
      reply,
    );
    expect(getSent()).toBeNull();
  });

  it("allows super admin wildcard", async () => {
    const { reply, getSent } = makeReply();
    await requireRole("Accountant")(makeRequest({ roleName: "Super Admin", permissions: ["*"] }), reply);
    expect(getSent()).toBeNull();
  });

  it("forbids a non-matching role", async () => {
    const { reply, getSent } = makeReply();
    await requireRole("Admin")(makeRequest({ roleName: "Clerk", permissions: [] }), reply);
    expect(getSent()?.code).toBe(403);
  });
});

vi.restoreAllMocks();
