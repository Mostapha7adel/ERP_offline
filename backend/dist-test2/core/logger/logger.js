import pino from "pino";
import { env, isDevelopment } from "../../config/env.js";
/**
 * Shared Pino logger. Fastify uses the same instance via `loggerInstance`.
 * Pretty output is enabled only in development.
 */
export const logger = pino({
    level: env.NODE_ENV === "test" ? "silent" : "info",
    transport: isDevelopment && !env.NODE_ENV
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
        : undefined,
});
export { logger as loggerInstance };
