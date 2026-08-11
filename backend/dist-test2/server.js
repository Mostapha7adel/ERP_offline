import { buildServer } from "./app.js";
import { env } from "./config/env.js";
import { seedDatabase } from "./seed/seed.js";
import { logger } from "./core/logger/logger.js";
async function main() {
    await seedDatabase();
    const app = await buildServer();
    try {
        await app.listen({ port: env.PORT, host: env.HOST });
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception");
    process.exit(1);
});
void main();
