/** Identifies the running build so a deploy can be verified by commit SHA. */
export function buildInfo(env: Record<string, string | undefined> = process.env) {
  const sha = env.RAILWAY_GIT_COMMIT_SHA ?? env.GIT_SHA ?? "unknown";
  return { sha, shortSha: sha === "unknown" ? sha : sha.slice(0, 7) };
}
