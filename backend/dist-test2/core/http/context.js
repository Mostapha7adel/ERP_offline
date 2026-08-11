/**
 * Builds the audit context for a request: authenticated principal + client IP.
 */
export function getAuditContext(request) {
    return {
        principal: request.principal,
        ip: request.ip,
    };
}
