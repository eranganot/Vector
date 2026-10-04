import { z } from "zod";

/**
 * Typed, validated runtime configuration. Every environment variable the app
 * reads is declared here and documented in .env.example.
 */
const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  VECTOR_ENV: z.enum(["local", "test", "dev", "demo"]).default("local"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return result.data;
}

let cached: Config | undefined;
export function config(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
