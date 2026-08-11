import { AppError } from "../errors/app-error.js";
import { SUPER_ADMIN_WILDCARD } from "./permissions.js";
/** Load the principal from a verified JWT (set by the auth preHandler). */
export function getPrincipal(request) {
    const principal = request.principal;
    if (!principal) {
        throw AppError.unauthorized("Missing authentication");
    }
    return principal;
}
/**
 * Pre-handler factory enforcing a required permission.
 * Super admins (wildcard) bypass every check.
 */
export function requirePermission(permission) {
    return async (request, reply) => {
        const principal = request.principal;
        if (!principal) {
            void reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Missing authentication" },
            });
            return;
        }
        const allowed = principal.permissions.includes(SUPER_ADMIN_WILDCARD) ||
            principal.permissions.includes(permission);
        if (!allowed) {
            void reply.code(403).send({
                success: false,
                error: { code: "FORBIDDEN", message: `Missing permission: ${permission}` },
            });
            return;
        }
    };
}
/** Pre-handler enforcing a specific role (or wildcard super admin). */
export function requireRole(...roles) {
    return async (request, reply) => {
        const principal = request.principal;
        if (!principal) {
            void reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Missing authentication" },
            });
            return;
        }
        const allowed = principal.permissions.includes(SUPER_ADMIN_WILDCARD) ||
            roles.includes(principal.roleName);
        if (!allowed) {
            void reply.code(403).send({
                success: false,
                error: { code: "FORBIDDEN", message: `Role '${principal.roleName}' is not allowed` },
            });
            return;
        }
    };
}
