/**
 * Phase smoke test against a running environment. Each phase appends its checks;
 * a later phase's smoke always re-runs the earlier phases' checks.
 *   pnpm smoke --url https://<env>.up.railway.app [--expect-sha <git sha>]
 */
type Check = { phase: number; name: string; run: (base: URL) => Promise<string> };

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function get(base: URL, path: string) {
  const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000) });
  return { res, text: await res.text() };
}

const expectSha = arg("--expect-sha");

const checks: Check[] = [
  {
    phase: 0,
    name: "health is ok, DB connected, no pending migrations",
    run: async (base) => {
      const { res, text } = await get(base, "/api/health");
      const body = JSON.parse(text);
      if (res.status !== 200 || body.status !== "ok") throw new Error(`${res.status} ${text}`);
      if (!body.db.ok || body.migrations.pending !== 0) throw new Error(text);
      return `env=${body.env} sha=${body.build.shortSha} migrations=${body.migrations.applied}`;
    },
  },
  {
    phase: 0,
    name: "deployed build matches the expected commit",
    run: async (base) => {
      if (!expectSha) return "skipped (no --expect-sha)";
      const body = JSON.parse((await get(base, "/api/health")).text);
      if (body.build.shortSha !== expectSha.slice(0, 7))
        throw new Error(`expected ${expectSha.slice(0, 7)}, got ${body.build.shortSha}`);
      return body.build.shortSha;
    },
  },
  {
    phase: 0,
    name: "home page renders",
    run: async (base) => {
      const { res, text } = await get(base, "/");
      if (res.status !== 200 || !text.includes("VECTOR")) throw new Error(`status ${res.status}`);
      return "200";
    },
  },
];

async function main() {
  const url = arg("--url");
  if (!url) throw new Error("usage: pnpm smoke --url <base url> [--expect-sha <sha>]");
  const base = new URL(url);
  let failed = 0;
  for (const c of checks) {
    try {
      console.log(`PASS  P${c.phase}  ${c.name}  — ${await c.run(base)}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  P${c.phase}  ${c.name}  — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(failed ? `\n${failed} smoke check(s) failed` : `\nsmoke passed (${checks.length} checks)`);
  process.exit(failed ? 1 : 0);
}

main();
