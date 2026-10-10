/**
 * Phase smoke test against a running environment. Each phase appends its checks;
 * a later phase's smoke always re-runs the earlier phases' checks.
 * Plan v2 stages continue the numbering: E1 = phase 5, E2 = 6, … E7 = 11 (so `--phase 4` still means "Prod on Phase 4").
 *   pnpm smoke --url https://<env>.up.railway.app [--expect-sha <git sha>]
 */
import { SEED_VERSION } from "../src/infra/seed/org";

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
/** Run only the checks up to this phase, for an environment still on an earlier phase (Prod before a promotion). */
const maxPhase = Number(arg("--phase") ?? Infinity);

const checks: Check[] = [
  {
    phase: 0,
    name: "health is ok, DB connected, no pending migrations",
    run: async (base) => {
      const { res, text } = await get(base, "/api/health");
      const body = JSON.parse(text);
      if (res.status !== 200 || body.status !== "ok") throw new Error(`${res.status} ${text}`);
      if (!body.db.ok || body.migrations.pending !== 0) throw new Error(text);
      if (body.migrations.applied < 5)
        throw new Error(`expected the Phase 2 schema (>= 5 migrations), got ${body.migrations.applied}`);
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
  {
    phase: 2,
    name: "demo epoch is the current synthetic org with both workstreams loaded",
    run: async (base) => {
      const body = JSON.parse((await get(base, "/api/health")).text);
      const d = body.demo;
      if (!d || d.seedVersion !== SEED_VERSION) throw new Error(`seed ${d?.seedVersion}; expected ${SEED_VERSION}`);
      if (d.risks < 14 || d.opportunities < 5) throw new Error(`risks ${d.risks}, opportunities ${d.opportunities}`);
      return `seed ${d.seedVersion} · ${d.risks} risks · ${d.opportunities} opportunities`;
    },
  },
  {
    phase: 2,
    name: "sign-in page is the dark theme",
    run: async (base) => {
      const { text } = await get(base, "/login");
      const css = [...text.matchAll(/href="([^"]+\.css)"/g)].map((m) => m[1]);
      for (const href of css) if ((await get(base, href)).text.includes("#08111f")) return "dark tokens served";
      throw new Error("dark theme tokens not found in the served CSS");
    },
  },
  {
    phase: 3,
    name: "Phase 3 screens (home dashboards, unit views, Risks, Opportunities, organization, Waiting on you) require sign-in",
    run: async (base) => {
      const paths = [
        "/units/00000000-0000-4000-8000-000000000000",
        "/org",
        "/performance",
        "/approvals",
        "/risks",
        "/opportunities",
      ];
      for (const p of paths) {
        const res = await fetch(new URL(p, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
        const loc = res.headers.get("location") ?? "";
        if (![302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
          throw new Error(`${p}: status ${res.status} location ${loc}`);
        if (/net sales|Command Center/i.test(await res.text())) throw new Error(`${p}: content before sign-in`);
      }
      return `${paths.length} routes → /login`;
    },
  },
  {
    phase: 3,
    name: "sign-in page offers no external redirect target",
    run: async (base) => {
      const { res, text } = await get(base, "/login?next=https://example.com/");
      if (res.status !== 200) throw new Error(`status ${res.status}`);
      if (text.includes('value="https://example.com/"')) throw new Error("external next echoed into the form");
      return "no external next";
    },
  },
  {
    phase: 4,
    name: "Phase 4: commitments, actions and audit require sign-in; the demo runs the commitment register (seed p4+)",
    run: async (base) => {
      for (const path of ["/commitments", "/actions", "/audit"]) {
        const res = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
        const loc = res.headers.get("location") ?? "";
        if (![302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
          throw new Error(`${path}: status ${res.status} location ${loc}`);
      }
      const body = JSON.parse((await get(base, "/api/health")).text);
      if (body.migrations.applied < 7)
        throw new Error(`expected the Phase 4 schema (>= 7 migrations), got ${body.migrations.applied}`);
      if (!/^p[4-9]/.test(body.demo?.seedVersion ?? "")) throw new Error(`seed ${body.demo?.seedVersion}`);
      return `→ /login · migrations ${body.migrations.applied} · seed ${body.demo.seedVersion}`;
    },
  },
  {
    phase: 4,
    name: "Hebrew: the language cookie turns the app right-to-left; English stays the default (ADR-007)",
    run: async (base) => {
      const en = (await get(base, "/login")).text;
      if (!/<html[^>]*dir="ltr"/.test(en) || !en.includes(">Sign in<")) throw new Error("default is not English LTR");
      const res = await fetch(new URL("/login", base), {
        headers: { cookie: "vector_lang=he" },
        signal: AbortSignal.timeout(15_000),
      });
      const he = await res.text();
      if (!/<html[^>]*lang="he"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="he"/.test(he)) throw new Error("no rtl");
      if (!he.includes("כניסה")) throw new Error("sign-in page not in Hebrew");
      return "en → ltr · he → rtl";
    },
  },
  {
    phase: 5,
    name: 'E1: the product is named "VECTOR | Organizational Intelligence" in English and in Hebrew (FB-2)',
    run: async (base) => {
      const en = (await get(base, "/login")).text;
      if (!en.includes("<title>VECTOR | Organizational Intelligence</title>")) throw new Error("English title missing");
      const he = await (
        await fetch(new URL("/login", base), {
          headers: { cookie: "vector_lang=he" },
          signal: AbortSignal.timeout(15_000),
        })
      ).text();
      if (!he.includes("<title>VECTOR | אינטליגנציה ארגונית</title>")) throw new Error("Hebrew title missing");
      return "en and he titles";
    },
  },
  {
    phase: 5,
    name: "E1: the C-suite cast is seeded: the COO persona exists (ADR-008)",
    run: async (base) => {
      const text = (await get(base, "/login")).text;
      if (!text.includes("Demo personas")) return "skipped (personas off in this environment)";
      if (!text.includes("Oren Halevi")) throw new Error("COO persona missing");
      return "Oren Halevi (COO) listed";
    },
  },
  {
    phase: 5,
    name: "E1: synthetic data v5 is live (52 weeks, money lines, budgets, initiatives; seed p5+)",
    run: async (base) => {
      const body = JSON.parse((await get(base, "/api/health")).text);
      const v = /^p(\d+)-/.exec(body.demo?.seedVersion ?? "");
      if (!v || Number(v[1]) < 5) throw new Error(`seed ${body.demo?.seedVersion}, expected p5 or later`);
      if (body.migrations.applied < 10) throw new Error(`expected migration 0009, got ${body.migrations.applied}`);
      return `seed ${body.demo.seedVersion} · migrations ${body.migrations.applied}`;
    },
  },
  {
    phase: 6,
    name: "E2a: the C-suite home read model's day indexes are migrated (0010)",
    run: async (base) => {
      const body = JSON.parse((await get(base, "/api/health")).text);
      if (body.migrations.applied < 11) throw new Error(`expected migration 0010, got ${body.migrations.applied}`);
      return `migrations ${body.migrations.applied}`;
    },
  },
  {
    phase: 6,
    name: "E2b: the C-suite home and its department drill-down require sign-in (no health or money leaks)",
    run: async (base) => {
      for (const path of ["/", "/?unit=00000000-0000-4000-8000-000000000000", "/?by=region"]) {
        const res = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
        const loc = res.headers.get("location") ?? "";
        if (![302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
          throw new Error(`${path}: status ${res.status} location ${loc}`);
        if (/Money vs budget|Organization pulse/.test(await res.text())) throw new Error(`${path} leaked the home`);
      }
      return "3 routes → /login";
    },
  },
  {
    phase: 7,
    name: "E3: initiative updates are migrated (0011); the Cross-department tab requires sign-in",
    run: async (base) => {
      const body = JSON.parse((await get(base, "/api/health")).text);
      if (body.migrations.applied < 12) throw new Error(`expected migration 0011, got ${body.migrations.applied}`);
      for (const path of ["/initiatives", "/initiatives?i=I-NORTH-DC"]) {
        const res = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
        const loc = res.headers.get("location") ?? "";
        if (![302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
          throw new Error(`${path}: status ${res.status} location ${loc}`);
        if (/North DC recovery|Your action items/.test(await res.text())) throw new Error(`${path} leaked content`);
      }
      return `migrations ${body.migrations.applied} · 2 routes → /login`;
    },
  },
  {
    phase: 8,
    name: "E4: outbound messages are migrated (0012); the Action Center and the dependency flow require sign-in",
    run: async (base) => {
      const body = JSON.parse((await get(base, "/api/health")).text);
      if (body.migrations.applied < 13) throw new Error(`expected migration 0012, got ${body.migrations.applied}`);
      for (const path of [
        "/action-center",
        "/action-center?item=00000000-0000-0000-0000-000000000000",
        "/initiatives?i=I-HOLIDAY&wf=00000000-0000-0000-0000-000000000000&wd=7",
      ]) {
        const res = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
        const loc = res.headers.get("location") ?? "";
        if (![302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
          throw new Error(`${path}: status ${res.status} location ${loc}`);
        if (/Approve and send|With whom|Stock-outs|How a delay travels/.test(await res.text()))
          throw new Error(`${path} leaked content`);
      }
      return `migrations ${body.migrations.applied} · 3 routes → /login`;
    },
  },
  {
    phase: 9,
    name: "E5: reports are migrated (0013); the builder and a snapshot require sign-in and leak nothing",
    run: async (base) => {
      const body = JSON.parse((await get(base, "/api/health")).text);
      if (body.migrations.applied < 14) throw new Error(`expected migration 0013, got ${body.migrations.applied}`);
      for (const path of ["/reports", "/reports/00000000-0000-0000-0000-000000000000"]) {
        const res = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
        const loc = res.headers.get("location") ?? "";
        if (![302, 303, 307, 308].includes(res.status) || !loc.includes("/login"))
          throw new Error(`${path}: status ${res.status} location ${loc}`);
        if (/Reports builder|sha256|Decisions needed/.test(await res.text())) throw new Error(`${path} leaked content`);
      }
      return `migrations ${body.migrations.applied} · 2 routes → /login`;
    },
  },
];

async function main() {
  const url = arg("--url");
  if (!url) throw new Error("usage: pnpm smoke --url <base url> [--expect-sha <sha>] [--phase <n>]");
  const base = new URL(url);
  let failed = 0;
  const run = checks.filter((c) => c.phase <= maxPhase);
  for (const c of run) {
    try {
      console.log(`PASS  P${c.phase}  ${c.name}  — ${await c.run(base)}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  P${c.phase}  ${c.name}  — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(
    failed
      ? `\n${failed} smoke check(s) failed`
      : `\nsmoke passed (${run.length} checks${run.length < checks.length ? `, phases ≤ ${maxPhase}` : ""})`,
  );
  process.exit(failed ? 1 : 0);
}

main();
