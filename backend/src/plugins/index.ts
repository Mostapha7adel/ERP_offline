import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyJwt from "@fastify/jwt";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { env, corsOrigins } from "../config/env.js";

/**
 * Registers cross-cutting HTTP plugins in a fixed order.
 */
export async function registerPlugins(app: FastifyInstance): Promise<void> {
  await app.register(helmet, { global: true });

  await app.register(cors, {
    origin: corsOrigins(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 2000,
    timeWindow: "1 minute",
    errorResponseBuilder: (req, context) => ({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded: too many requests. Try again in ${context.after}`,
      },
    }),
  });

  // OpenAPI contract generation (from Zod schemas via type-provider)
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "LedgerFlow API",
        description: "REST API contracts for the LedgerFlow accounting desktop system",
        version: "1.0.0",
      },
      servers: [{ url: `http://${env.HOST}:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });

  // Swagger UI serves static assets from disk, which is not available inside
  // the packaged executable. Keep it for dev only; the OpenAPI JSON from
  // @fastify/swagger still works in production at /docs/json.
  const isPkg = Boolean((process as { pkg?: unknown }).pkg);
  if (!isPkg) {
    await app.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  }

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL },
    verify: { extractToken: (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer ")) return header.slice(7);
      return;
    } },
  });

  app.log.info("Plugins registered");
}
