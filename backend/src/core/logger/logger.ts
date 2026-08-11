import pino from "pino";
import { env, isDevelopment } from "../../config/env.js";

const isPkg = Boolean((process as { pkg?: unknown }).pkg);

/**
 * Shared Pino logger. Fastify uses the same instance via `loggerInstance`.
 * Pretty output is enabled only when running as a plain Node dev process
 * (never inside the packaged pkg executable, where the pino-pretty transport
 * is not available).
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  transport: isDevelopment && !isPkg
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined,
});

export { logger as loggerInstance };
