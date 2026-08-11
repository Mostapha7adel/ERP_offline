import { AppError } from "../core/errors/app-error.js";
/**
 * Authenticates requests via Bearer JWT and attaches the resolved principal
 * to `request.principal`. Public routes opt out with `{ config: { auth: false } }`.
 */
export async function authPlugin(app) {
    app.addHook("preHandler", async (request, reply) => {
        const routeAuth = request.routeOptions.config.auth ?? true;
        if (routeAuth === false)
            return;
        try {
            const payload = await request.jwtVerify();
            request.principal = payload;
        }
        catch {
            void reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
            });
        }
    });
    app.log.info("Auth plugin registered");
}
export { AppError };
