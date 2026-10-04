/** Password for seeded demo users: from SEED_USER_PASSWORD, with a fixed default only in local/test. */
export function seedPassword(): string | undefined {
  const env = process.env.VECTOR_ENV ?? "local";
  return process.env.SEED_USER_PASSWORD || (env === "local" || env === "test" ? "vector-local-only" : undefined);
}
