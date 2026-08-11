import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../security/password.js";

describe("password hashing", () => {
  it("hashPassword produces a bcrypt hash", async () => {
    const hash = await hashPassword("SuperSecret1!");
    expect(hash).toBeTruthy();
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifyPassword accepts the correct password", async () => {
    const hash = await hashPassword("Admin@123!");
    const ok = await verifyPassword("Admin@123!", hash);
    expect(ok).toBe(true);
  });

  it("verifyPassword rejects an incorrect password", async () => {
    const hash = await hashPassword("Admin@123!");
    const ok = await verifyPassword("WrongPassword1", hash);
    expect(ok).toBe(false);
  });

  it("produces different hashes for the same password (salting)", async () => {
    const a = await hashPassword("SamePassword");
    const b = await hashPassword("SamePassword");
    expect(a).not.toBe(b);
  });
});
