import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  // Network mode: "standalone" (default, local only), "host" (the super admin
  // device serves the LAN workspace), or "client" (a device joined to a host).
  LAN_MODE: z.enum(["standalone", "host", "client"]).default("standalone"),
  // Per-install app secret issued by the Tauri shell. Required on every
  // /api/v1 request (except the public discovery/join endpoints) via the
  // `x-app-token` header, so knowing the port alone is not enough to use the
  // API. Absent (dev/test) means the guard is disabled.
  LEDGERFLOW_APP_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";

export function corsOrigins(): string[] | string {
  if (env.CORS_ORIGIN === "*") return true as unknown as string;
  return env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
}
