import { AppError } from "../../core/errors/app-error.js";
import { verifyPassword } from "../../core/security/password.js";
import { userRepository } from "../users/user.repository.js";
import { roleRepository } from "../roles/role.repository.js";
import { sessionRepository } from "./auth.repository.js";
import { env } from "../../config/env.js";
import { auditService } from "../../core/audit/audit.service.js";
import { hashPassword } from "../../core/security/password.js";
function parseDurationToMs(duration) {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match)
        return 7 * 24 * 60 * 60 * 1000;
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
    app;
    constructor(app) {
        this.app = app;
    }
    /** Build the JWT principal for a user (resolves permissions from role). */
    async buildPrincipal(userId) {
        const user = await userRepository.findById(userId);
        if (!user)
            throw AppError.unauthorized("User no longer exists");
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
    signAccessToken(principal) {
        return this.app.jwt.sign(principal, { expiresIn: env.JWT_ACCESS_TTL });
    }
    async createRefreshSession(userId, audit) {
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
    async login(input, audit) {
        const user = await userRepository.findByEmail(input.email);
        if (!user) {
            await auditService.log(audit, "auth:login:failed", "auth", undefined, { email: input.email });
            throw AppError.unauthorized("Invalid email or password");
        }
        if (user.status !== "active") {
            throw AppError.forbidden("This account is disabled");
        }
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) {
            await auditService.log(audit, "auth:login:failed", "auth", user.id, { email: input.email });
            throw AppError.unauthorized("Invalid email or password");
        }
        await userRepository.update({ id: user.id, data: { lastLoginAt: new Date().toISOString() } });
        const principal = await this.buildPrincipal(user.id);
        const accessToken = this.signAccessToken(principal);
        const refreshSession = await this.createRefreshSession(user.id, audit);
        await auditService.log(audit, "auth:login", "auth", user.id);
        return {
            accessToken,
            refreshToken: refreshSession.token,
            tokenType: "Bearer",
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
    async refresh(input) {
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
        return {
            accessToken,
            tokenType: "Bearer",
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
    async logout(refreshToken, audit) {
        const session = await sessionRepository.findByToken(refreshToken);
        if (session) {
            await sessionRepository.deleteByToken(refreshToken);
            await auditService.log(audit, "auth:logout", "auth", session.userId);
        }
    }
    /** Current authenticated principal (from JWT). */
    me(principal) {
        return principal;
    }
    async changePassword(userId, input, audit) {
        const user = await userRepository.findById(userId);
        if (!user)
            throw AppError.unauthorized("User no longer exists");
        const valid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid)
            throw AppError.badRequest("Current password is incorrect");
        const passwordHash = await hashPassword(input.newPassword);
        await userRepository.update({ id: userId, data: { passwordHash } });
        await auditService.log(audit, "auth:change-password", "auth", userId);
    }
}
export function createAuthService(app) {
    return new AuthService(app);
}
