import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { errorHandler } from "./core/errors/error-handler.js";
import { env, isDevelopment } from "./config/env.js";
import { registerPlugins } from "./plugins/index.js";
import { authPlugin } from "./plugins/auth.js";
import { registerModules } from "./modules/index.js";
import { broadcastSync } from "./core/realtime/realtime.js";
import { getBoundPort } from "./core/runtime/bound-port.js";

/**
 * Builds and wires the Fastify application.
 * Kept as a pure factory so tests can instantiate isolated instances.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const isPkg = Boolean((process as { pkg?: unknown }).pkg);
  const app = Fastify({
    // The backend is always reached directly (localhost or LAN IP), never
    // behind a reverse proxy. Trusting X-Forwarded-For would let clients
    // forge their IP and bypass the rate limiter / poison audit logs.
    trustProxy: false,
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: "info",
            ...(isDevelopment && !isPkg ? { transport: { target: "pino-pretty" } } : {}),
          },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  // Health check (public). Includes the actual bound port so the Tauri shell
  // and any LAN client can discover where this backend is listening. The
  // version is set by the shell when spawning (LEDGERFLOW_VERSION) so the shell
  // can tell a freshly-started backend apart from an old leftover one that may
  // still be holding the port after an upgrade install.
  app.get("/health", { config: { auth: false } }, async () => {
    const version = process.env.LEDGERFLOW_VERSION;
    return version ? { status: "ok", port: getBoundPort(), version } : { status: "ok", port: getBoundPort() };
  });

  // App-secret guard: every /api/v1 request must present the per-install
  // secret (`x-app-token` header) that the Tauri shell generated and passed
  // via LEDGERFLOW_APP_SECRET. Knowing the port alone is therefore not enough
  // to reach the API. The network discovery/join/stream/heartbeat endpoints
  // stay open because they are how a LAN client learns about a host before it
  // holds the secret (join hands it out in its response).
  app.addHook("preHandler", async (request, reply) => {
    const secret = env.LEDGERFLOW_APP_SECRET;
    if (!secret) return; // dev/test runs without a secret — guard disabled
    const url = request.url.split("?")[0];
    if (!url.startsWith("/api/v1/")) return;
    if (
      url === "/api/v1/network/status" ||
      url === "/api/v1/network/join" ||
      url === "/api/v1/network/stream" ||
      url === "/api/v1/network/heartbeat"
    ) {
      return;
    }
    if (request.headers["x-app-token"] !== secret) {
      return reply.code(401).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Invalid or missing app token" },
      });
    }
  });

  await registerPlugins(app);
  await authPlugin(app);
  await registerModules(app);

  // Real-time sync: after any successful data mutation (POST/PUT/PATCH/DELETE
  // on /api/v1 data resources) notify every subscribed device so their UIs
  // re-hydrate immediately. Auth + network endpoints are excluded because they
  // are not dataset changes and would produce useless broadcasts.
  app.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode >= 400) return;
    const method = request.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
    const url = request.url;
    if (!url.startsWith("/api/v1/")) return;
    if (url.startsWith("/api/v1/auth/") || url.startsWith("/api/v1/network/")) return;
    const resource = url.split("?")[0];
    broadcastSync({ resource });
  });

  return app;
}

