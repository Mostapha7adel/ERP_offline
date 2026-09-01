import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Request-level concurrency limiter.
 *
 * Limits how many requests are being processed *concurrently* to prevent
 * a single slow caller from exhausting the event loop. Extra requests
 * receive 429 immediately.
 *
 * This is separate from the global rate-limit (which counts requests in a
 * time window).  Here we cap *parallelism* — important for CPU/DB-heavy
 * report endpoints.
 */
export async function registerConcurrencyLimit(app: FastifyInstance): Promise<void> {
  const MAX_CONCURRENT = Number(process.env.LF_MAX_CONCURRENT ?? 50);
  let active = 0;

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip for health-check / docs
    if (request.url === "/health" || request.url.startsWith("/docs")) return;

    if (active >= MAX_CONCURRENT) {
      void reply.code(429).send({
        success: false,
        error: { code: "SERVER_BUSY", message: "Server is at capacity. Try again shortly." },
      });
      return;
    }
    active++;
  });

  app.addHook("onResponse", async () => {
    if (active > 0) active--;
  });

  // Expose a /health endpoint for monitoring
  app.get("/health", async () => ({
    status: "ok",
    activeRequests: active,
    maxConcurrent: MAX_CONCURRENT,
    timestamp: new Date().toISOString(),
  }));

  app.log.info({ maxConcurrent: MAX_CONCURRENT }, "Concurrency limiter registered");
}

/**
 * Request timeout enforcement.
 *
 * Heavy endpoints (reports, exports) can run indefinitely. This hook
 * adds a `X-Response-Time` header and enforces a configurable timeout
 * (default 30 s for regular routes, 120 s for report routes).
 */
export async function registerRequestTimeout(app: FastifyInstance): Promise<void> {
  const DEFAULT_TIMEOUT = Number(process.env.LF_REQUEST_TIMEOUT ?? 30_000);
  const REPORT_TIMEOUT = Number(process.env.LF_REPORT_TIMEOUT ?? 120_000);

  app.addHook("onRequest", async (request: FastifyRequest) => {
    (request as any)._startTime = process.hrtime.bigint();
    const isReport = request.url.includes("/reports/") || request.url.includes("/export");
    const timeout = isReport ? REPORT_TIMEOUT : DEFAULT_TIMEOUT;

    (request as any)._timeout = setTimeout(() => {
      if (!request.raw.destroyed) {
        request.raw.socket?.destroy();
      }
    }, timeout);
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    if ((request as any)._timeout) {
      clearTimeout((request as any)._timeout);
    }
    const start = (request as any)._startTime as bigint | undefined;
    if (start) {
      const ns = Number(process.hrtime.bigint() - start);
      const ms = (ns / 1e6).toFixed(1);
      void reply.header("X-Response-Time", `${ms}ms`);
    }
  });

  app.log.info("Request timeout enforcement registered");
}
