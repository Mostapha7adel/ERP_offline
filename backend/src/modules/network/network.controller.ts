import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { networkService } from "./network.service.js";
import {
  networkWorkspaceSchema,
  networkDeviceSchema,
  createWorkspaceSchema,
  joinWorkspaceSchema,
  heartbeatSchema,
  kickDeviceSchema,
} from "./network.entity.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission, requireSuperAdmin, type AuthPrincipal } from "../../core/security/rbac.js";
import { subscribeStream, unsubscribeStream } from "../../core/realtime/realtime.js";

const joinResponseSchema = z.object({
  workspaceName: z.string(),
  deviceId: z.string(),
  token: z.string(),
});

const statusSchema = z.object({
  app: z.string(),
  mode: z.string(),
  workspaceReady: z.boolean(),
  serverTime: z.string(),
  hostIps: z.array(z.string()),
});

export function registerNetworkController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // Public — used by a client to verify a host is reachable before joining.
  typed.get("/network/status", {
    config: { auth: false },
    schema: {
      description: "Host reachability + workspace readiness (public)",
      response: { 200: z.object({ success: z.literal(true), data: statusSchema }) },
    },
  }, async () => ok(await networkService.status()));

  // Public (token via query) — server-sent events for real-time sync. The
  // token is passed as a query parameter because EventSource cannot set an
  // Authorization header. A valid access token is required to subscribe.
  typed.get("/network/stream", {
    config: { auth: false },
    schema: {
      description: "Server-sent events: real-time sync notifications",
      querystring: z.object({ token: z.string().optional() }),
    },
  }, async (request, reply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Missing token" } });
    }
    let principal: AuthPrincipal;
    try {
      principal = (await app.jwt.verify(query.token)) as unknown as AuthPrincipal;
    } catch {
      return reply.code(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    }
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();
    try {
      reply.raw.write(`: connected ${principal.sub}\n\n`);
    } catch {
      // socket closed during handshake
    }
    const id = crypto.randomUUID();
    subscribeStream(id, reply);
    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(": keepalive\n\n");
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);
    reply.raw.on("close", () => {
      clearInterval(keepAlive);
      unsubscribeStream(id);
    });
  });

  // Host admin — create/activate the LAN workspace and register the host device.
  typed.post("/network/workspace", {
    preHandler: requirePermission(PERMISSIONS["network:manage"]),
    schema: {
      description: "Create the LAN workspace and register this device as host",
      security: [{ bearerAuth: [] }],
      body: createWorkspaceSchema,
      response: {
        200: z.object({
          success: z.literal(true),
          data: networkWorkspaceSchema.extend({ token: z.string() }),
        }),
      },
    },
  }, async (request) => {
    const body = request.body as z.infer<typeof createWorkspaceSchema>;
    return ok(await networkService.createWorkspace(body, getAuditContext(request)));
  });

  // Host admin — current workspace incl. the join code.
  typed.get("/network/workspace", {
    preHandler: requirePermission(PERMISSIONS["network:manage"]),
    schema: {
      description: "Get the active workspace with its join code",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: networkWorkspaceSchema }) },
    },
  }, async () => ok(await networkService.getWorkspace()));

  // Super admin — delete the workspace and all devices so the host can be
  // recreated under a different name.
  typed.delete("/network/workspace", {
    preHandler: requireSuperAdmin(),
    schema: {
      description: "Delete the LAN workspace and all registered devices (recreate a new host)",
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          success: z.literal(true),
          data: z.object({ success: z.boolean() }),
        }),
      },
    },
  }, async (request) => ok(await networkService.deleteWorkspace(getAuditContext(request))));

  // Public — join an existing workspace with its join code.
  typed.post("/network/join", {
    config: { auth: false },
    schema: {
      description: "Join a workspace using its join code",
      body: joinWorkspaceSchema,
      response: { 200: z.object({ success: z.literal(true), data: joinResponseSchema }) },
    },
  }, async (request) => {
    const body = request.body as z.infer<typeof joinWorkspaceSchema>;
    return ok(await networkService.join(body, request.ip));
  });

  // Public (token-validated) — keep the device online / record signed-in user.
  typed.post("/network/heartbeat", {
    config: { auth: false },
    schema: {
      description: "Heartbeat from a joined device (device token)",
      body: heartbeatSchema,
      response: {
        200: z.object({
          success: z.literal(true),
          data: z.object({ ok: z.boolean(), serverTime: z.string() }),
        }),
      },
    },
  }, async (request) => {
    const body = request.body as z.infer<typeof heartbeatSchema>;
    return ok(await networkService.heartbeat(body));
  });

  // Super admin — list every registered device (no secrets).
  typed.get("/network/devices", {
    preHandler: requirePermission(PERMISSIONS["network:read"]),
    schema: {
      description: "List registered LAN devices",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(networkDeviceSchema) }) },
    },
  }, async () => ok(await networkService.listDevices()));

  // Super admin — remove a device from the workspace.
  typed.post("/network/kick", {
    preHandler: requirePermission(PERMISSIONS["network:manage"]),
    schema: {
      description: "Remove a device from the workspace",
      security: [{ bearerAuth: [] }],
      body: kickDeviceSchema,
      response: {
        200: z.object({
          success: z.literal(true),
          data: z.object({ success: z.boolean() }),
        }),
      },
    },
  }, async (request) => {
    const body = request.body as z.infer<typeof kickDeviceSchema>;
    return ok(await networkService.kick(body.deviceId));
  });
}
