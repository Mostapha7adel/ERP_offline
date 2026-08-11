import type { FastifyInstance } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import { verifyPassword } from "../../core/security/password.js";
import { userRepository } from "../users/user.repository.js";
import { roleRepository } from "../roles/role.repository.js";
import { sessionRepository } from "./auth.repository.js";
import type { AuthSession } from "./auth.entity.js";
import type { AuthPrincipal } from "../../core/security/rbac.js";
import type { LoginInput, RefreshInput, ChangePasswordInput, ForgotPasswordInput } from "./auth.schema.js";
import { env } from "../../config/env.js";
import { auditService, type AuditContext } from "../../core/audit/audit.service.js";
import { hashPassword } from "../../core/security/password.js";
import { SUPER_ADMIN_WILDCARD } from "../../core/security/permissions.js";
import { withTransaction } from "../../core/database/transaction.js";

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  switch (match[2]) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return value * 1000;
  }
}

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  /** Build the JWT principal for a user (resolves permissions from role). */
  private async buildPrincipal(userId: string): Promise<AuthPrincipal> {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.unauthorized("User no longer exists");
    const role = await roleRepository.findById(user.roleId);
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: role?.name ?? "Unknown",
      permissions: role?.permissions ?? [],
    };
  }

  private signAccessToken(principal: AuthPrincipal): string {
    return this.app.jwt.sign(principal, { expiresIn: env.JWT_ACCESS_TTL });
  }

  private async createRefreshSession(userId: string, audit: AuditContext): Promise<AuthSession> {
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_TTL)).toISOString();
    return sessionRepository.create({
      data: {
        userId,
        token,
        expiresAt,
        ip: audit.ip,
        userAgent: undefined,
      },
    });
  }

  async login(input: LoginInput, audit: AuditContext) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      await auditService.log(audit, "auth:login:failed", "auth", undefined, { email: input.email });
      throw AppError.unauthorized("Email not found. Check the email address or create an account.");
    }
    if (user.status !== "active") {
      throw AppError.forbidden("This account is disabled");
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await auditService.log(audit, "auth:login:failed", "auth", user.id, { email: input.email });
      throw AppError.unauthorized("Incorrect password. Please try again.");
    }

    await userRepository.update({ id: user.id, data: { lastLoginAt: new Date().toISOString() } });

    const principal = await this.buildPrincipal(user.id);
    const accessToken = this.signAccessToken(principal);
    const refreshSession = await this.createRefreshSession(user.id, audit);

    await auditService.log(audit, "auth:login", "auth", user.id);

    return {
      accessToken,
      refreshToken: refreshSession.token,
      tokenType: "Bearer" as const,
      mustChangePassword: user.mustChangePassword,
      needsSetup: user.mustChangePassword && principal.permissions.includes(SUPER_ADMIN_WILDCARD),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        roleName: principal.roleName,
        permissions: principal.permissions,
      },
    };
  }

  async refresh(input: RefreshInput, ip?: string) {
    const session = await sessionRepository.findByToken(input.refreshToken);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      throw AppError.unauthorized("Invalid or expired refresh token");
    }
    const user = await userRepository.findById(session.userId);
    if (!user || user.status !== "active") {
      throw AppError.unauthorized("Account is unavailable");
    }
    const principal = await this.buildPrincipal(user.id);
    const accessToken = this.signAccessToken(principal);
    // Rotate atomically: revoke the used session and issue a fresh one so a
    // stolen token cannot be replayed, without a window where the user has no
    // valid session (a crash between delete + create would log them out).
    return withTransaction(async () => {
      await sessionRepository.deleteByToken(input.refreshToken);
      const newSession = await sessionRepository.create({
        data: {
          userId: user.id,
          token: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
          expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_TTL)).toISOString(),
          ip: ip ?? session.ip,
          userAgent: undefined,
        },
      });
      return {
        accessToken,
        refreshToken: newSession.token,
        expiresAt: newSession.expiresAt,
        tokenType: "Bearer" as const,
        mustChangePassword: user.mustChangePassword,
        needsSetup: user.mustChangePassword && principal.permissions.includes(SUPER_ADMIN_WILDCARD),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          roleName: principal.roleName,
          permissions: principal.permissions,
        },
      };
    });
  }

  async logout(refreshToken: string, audit: AuditContext): Promise<void> {
    const session = await sessionRepository.findByToken(refreshToken);
    if (session) {
      await sessionRepository.deleteByToken(refreshToken);
      await auditService.log(audit, "auth:logout", "auth", session.userId);
    }
  }

  /** Current authenticated principal (from JWT). */
  me(principal: AuthPrincipal) {
    return principal;
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    audit: AuditContext,
  ): Promise<{ success: boolean; email: string; accessToken: string }> {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.unauthorized("User no longer exists");
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) throw AppError.badRequest("Current password is incorrect");

    let email = user.email;
    if (input.email && input.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const clash = await userRepository.findByEmail(input.email);
      if (clash && clash.id !== userId) {
        throw AppError.conflict(`User with email "${input.email}" already exists`);
      }
      email = input.email.trim();
    }

    const passwordHash = await hashPassword(input.newPassword);
    await userRepository.update({ id: userId, data: { passwordHash, email, mustChangePassword: false } });
    await auditService.log(audit, "auth:change-password", "auth", userId);

    const principal = await this.buildPrincipal(userId);
    const accessToken = this.signAccessToken(principal);
    return { success: true, email, accessToken };
  }

  /** Mark the first-run credential step as done without changing credentials. */
  async completeSetup(
    userId: string,
    audit: AuditContext,
  ): Promise<{ success: boolean; accessToken: string }> {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.unauthorized("User no longer exists");
    if (user.mustChangePassword) {
      await userRepository.update({ id: userId, data: { mustChangePassword: false } });
      await auditService.log(audit, "auth:complete-setup", "auth", userId);
    }
    const principal = await this.buildPrincipal(userId);
    const accessToken = this.signAccessToken(principal);
    return { success: true, accessToken };
  }

  /**
   * Reset the super admin password. There is no email server in this offline
   * app, so the caller must prove knowledge of the account's current password
   * before the new password is applied. Only the super admin account is
   * allowed to use this flow; any other account that tries is rejected.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ success: boolean }> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw AppError.forbidden("Only the super admin can reset a password. Contact your administrator.");
    }
    const role = await roleRepository.findById(user.roleId);
    const isSuperAdmin = role?.permissions.includes(SUPER_ADMIN_WILDCARD) ?? false;
    if (!isSuperAdmin) {
      throw AppError.forbidden("Only the super admin can reset a password. Contact your administrator.");
    }
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw AppError.badRequest("Current password is incorrect");
    }
    const passwordHash = await hashPassword(input.newPassword);
    await userRepository.update({
      id: user.id,
      data: { passwordHash, mustChangePassword: false },
    });
    return { success: true };
  }
}

export function createAuthService(app: FastifyInstance): AuthService {
  return new AuthService(app);
}
