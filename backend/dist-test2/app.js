import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { errorHandler } from "./core/errors/error-handler.js";
import { env, isDevelopment } from "./config/env.js";
import { registerPlugins } from "./plugins/index.js";
import { authPlugin } from "./plugins/auth.js";
import { registerModules } from "./modules/index.js";
/**
 * Builds and wires the Fastify application.
 * Kept as a pure factory so tests can instantiate isolated instances.
 */
export async function buildServer() {
    const app = Fastify({
        trustProxy: true,
        logger: env.NODE_ENV === "test"
            ? false
            : {
                level: "info",
                ...(isDevelopment ? { transport: { target: "pino-pretty" } } : {}),
            },
    });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    // Health check (public)
    app.get("/health", { config: { auth: false } }, async () => ({ status: "ok" }));
    await registerPlugins(app);
    await authPlugin(app);
    await registerModules(app);
    return app;
}
