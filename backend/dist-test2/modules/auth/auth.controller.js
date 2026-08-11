import { createAuthService } from "./auth.service.js";
import { loginSchema, refreshSchema, changePasswordSchema, loginResponseSchema, refreshResponseSchema, meResponseSchema, simpleSuccessSchema, } from "./auth.schema.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { getPrincipal } from "../../core/security/rbac.js";
export async function registerAuthController(app) {
    const typed = app.withTypeProvider();
    const service = createAuthService(app);
    // Public routes opt out of JWT auth via config.
    const publicConfig = { auth: false };
    typed.post("/auth/login", {
        config: publicConfig,
        schema: {
            description: "Authenticate and obtain tokens",
            body: loginSchema,
            response: { 200: loginResponseSchema },
        },
    }, async (request) => {
        return ok(await service.login(request.body, getAuditContext(request)));
    });
    typed.post("/auth/refresh", {
        config: publicConfig,
        schema: {
            description: "Exchange a refresh token for a new access token",
            body: refreshSchema,
            response: { 200: refreshResponseSchema },
        },
    }, async (request) => {
        return ok(await service.refresh(request.body));
    });
    typed.post("/auth/logout", {
        schema: {
            description: "Invalidate the current refresh session",
            security: [{ bearerAuth: [] }],
            body: refreshSchema,
            response: { 200: simpleSuccessSchema },
        },
    }, async (request) => {
        await service.logout(request.body.refreshToken, getAuditContext(request));
        return ok({ success: true });
    });
    typed.get("/auth/me", {
        schema: {
            description: "Return the current authenticated principal",
            security: [{ bearerAuth: [] }],
            response: { 200: meResponseSchema },
        },
    }, async (request) => {
        return ok(getPrincipal(request));
    });
    typed.post("/auth/change-password", {
        schema: {
            description: "Change the current user's password",
            security: [{ bearerAuth: [] }],
            body: changePasswordSchema,
            response: { 200: simpleSuccessSchema },
        },
    }, async (request) => {
        const principal = getPrincipal(request);
        await service.changePassword(principal.sub, request.body, getAuditContext(request));
        return ok({ success: true });
    });
}
