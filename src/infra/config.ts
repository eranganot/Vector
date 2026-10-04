import { z } from "zod";

/**
 * Typed, validated runtime configuration. Every environment variable the app
 * reads is declared here and documented in .env.example.
 */
const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Restricted app role (vector_app). Falls back to DATABASE_URL for local development. */
  APP_DATABASE_URL: z.string().min(1).optional(),
  /** Environment name (case-insensitive): local | test | dev | demo | prod. */
  VECTOR_ENV: z
    .preprocess((v) => (typeof v === "string" ? v.toLowerCase() : v), z.enum(["local", "test", "dev", "demo", "prod"]))
    .default("local"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function parseConfig(env: Record<string, string | undefined>): Config {
  // Treat empty values (KEY= in an env file) as unset.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  const result = ConfigSchema.safeParse(cleaned);
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
