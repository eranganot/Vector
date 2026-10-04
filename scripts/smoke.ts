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
      if (body.migrations.applied < 3)
        throw new Error(`expected the Phase 2 schema (>= 3 migrations), got ${body.migrations.applied}`);
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
  {
    phase: 2,
    name: "signed-out visitors are sent to sign-in; no insight data leaks",
    run: async (base) => {
      const res = await fetch(new URL("/", base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      const loc = res.headers.get("location") ?? "";
      if (![302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
        throw new Error(`status ${res.status} location ${loc}`);
      const login = await get(base, "/login");
      if (login.res.status !== 200 || !login.text.includes("Sign in"))
        throw new Error(`login status ${login.res.status}`);
      if (/net sales/i.test(login.text)) throw new Error("insight text on the sign-in page");
      return `redirect ${res.status} → /login`;
    },
  },
  {
    phase: 2,
    name: "auth API answers and reports no session without a cookie",
    run: async (base) => {
      const { res, text } = await get(base, "/api/auth/get-session");
      if (res.status !== 200 || !(text === "null" || text === ""))
        throw new Error(`${res.status} ${text.slice(0, 80)}`);
      return "no session";
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
