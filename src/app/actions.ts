"use server";
/**
 * Server actions: thin adapters from forms to application commands. Every action re-derives the
 * actor from the session; the commands do all authorization (backend-enforced, charter §21).
 */
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, parseInput, seededPeople } from "@/application/facade";
import { DomainError } from "@/domain/errors";
import { auth } from "@/infra/auth";
import { isLocale, LOCALE_COOKIE } from "@/i18n/locale";
import { seedPassword } from "@/infra/seed/password";
import { demoPersonasEnabled, requireActor, SWITCHER_COOKIE } from "./_lib/session";
import { decodeLayout } from "./_lib/report-layout";

/**
 * Marks a notice literal as a translation key (a no-op): the English text travels in the URL and the page's `Notice`
 * translates it at display time. Keeps every notice findable by the translation scanner.
 */
const tk = (s: string) => s;

/** Where to send the person back to: their insight's trace, built only from a validated id. */
const backTo = (f: FormData) => {
  const raw = String(f.get("insightId") ?? "");
  return /^[0-9a-f-]{36}$/i.test(raw) ? `/insights/${raw}` : "/";
};
const fail = (path: string, err: unknown): never => {
  if (err instanceof DomainError) redirect(`${path}?error=${encodeURIComponent(err.message)}`);
  throw err;
};

export async function signIn(form: FormData) {
  try {
    const { email, password } = parseInput("signIn", form);
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    redirect("/login?error=" + encodeURIComponent(tk("Email or password is incorrect")));
  }
  (await cookies()).delete(SWITCHER_COOKIE);
  redirect("/");
}

/** Demo persona switcher (AZ-5): signs in as a seeded person through the normal auth path. */
export async function switchPersona(form: FormData) {
  if (!demoPersonasEnabled())
    redirect("/login?error=" + encodeURIComponent(tk("Persona switching is off in this environment")));
  let input: ReturnType<typeof parseInput<"switchPersona">>;
  try {
    input = parseInput("switchPersona", form);
  } catch {
    redirect("/login?error=" + encodeURIComponent(tk("Unknown persona")));
  }
  const email = input.email;
  const people = await seededPeople();
  if (!people.some((p) => p.email === email)) redirect("/login?error=" + encodeURIComponent(tk("Unknown persona")));
  const password = seedPassword() ?? "";
  try {
    await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    redirect("/login?error=" + encodeURIComponent(tk("Persona sign-in failed: check SEED_USER_PASSWORD")));
  }
  (await cookies()).set(SWITCHER_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect(input.next ?? "/"); // validated: a path inside VECTOR (no open redirect)
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
  (await cookies()).delete(SWITCHER_COOKIE);
  redirect("/login");
}

export async function acceptDecisionAction(form: FormData) {
  const { actor } = await requireActor();
  const back = backTo(form);
  try {
    const i = parseInput("acceptDecision", form);
    await api.acceptDecision(actor, i.decisionId, i.rationale);
  } catch (e) {
    fail(back, e);
  }
  revalidatePath(back);
  redirect(back);
}

export async function declineDecisionAction(form: FormData) {
  const { actor } = await requireActor();
  const back = backTo(form);
  try {
    const i = parseInput("declineDecision", form);
    await api.declineDecision(actor, i.decisionId, i.rationale);
  } catch (e) {
    fail(back, e);
  }
  redirect(back);
}

export async function approveAction(form: FormData) {
  const { actor } = await requireActor();
  let verdict: "grant" | "deny" = "grant";
  try {
    const i = parseInput("approve", form);
    verdict = i.verdict;
    if (i.verdict === "grant") await api.grant(actor, i.actionId, i.rationale);
    else await api.deny(actor, i.actionId, i.rationale ?? "");
  } catch (e) {
    fail("/approvals", e);
  }
  revalidatePath("/approvals");
  redirect("/approvals?done=" + verdict);
}

export async function reviewOutcomeAction(form: FormData) {
  const { actor } = await requireActor();
  const back = backTo(form);
  try {
    const i = parseInput("reviewOutcome", form);
    await api.review(actor, i.outcomeId, i.lesson);
  } catch (e) {
    fail(back, e);
  }
  redirect(back);
}

export async function advanceClockAction(form: FormData) {
  const { actor } = await requireActor();
  try {
    await api.advanceClock(actor, parseInput("advanceClock", form).hours);
  } catch (e) {
    fail("/admin/demo", e);
  }
  redirect("/admin/demo?done=advanced");
}

export async function resetDemoAction() {
  const { actor } = await requireActor();
  const password = seedPassword() ?? "";
  try {
    await api.resetDemo(actor, password);
  } catch (e) {
    fail("/admin/demo", e);
  }
  // Sessions survive (same people); actors re-resolve against the new epoch.
  redirect("/admin/demo?done=reset");
}

// ── Commitments (Phase 4) ────────────────────────────────────────────────────
const COMMITMENTS_PATH = "/commitments";

export async function recordCommitmentAction(form: FormData) {
  const { actor } = await requireActor();
  let conflictInsight: string | null = null;
  try {
    const raw = Object.fromEntries(
      [...form.entries()].filter(([k, v]) => !k.startsWith("$") && v !== "" && k !== "beneficiaryUnitIds"),
    );
    const i = parseInput("recordCommitment", {
      ...raw,
      beneficiaryUnitIds: form.getAll("beneficiaryUnitIds").map(String),
    });
    const r = await api.recordCommitment(actor, {
      title: i.title,
      ownerUserId: i.ownerUserId,
      ownerUnitId: i.ownerUnitId,
      beneficiaryUnitIds: i.beneficiaryUnitIds,
      source: i.source,
      dueAt: i.dueAt,
      impactIls: i.impactIls,
      compliance: i.compliance,
      effects:
        i.resource && i.effect && i.windowStart && i.windowEnd
          ? [{ resource: i.resource, effect: i.effect, windowStart: i.windowStart, windowEnd: i.windowEnd }]
          : [],
    });
    conflictInsight = r.conflicts[0]?.insightId ?? null;
  } catch (e) {
    fail(COMMITMENTS_PATH, e);
  }
  revalidatePath(COMMITMENTS_PATH);
  redirect(`${COMMITMENTS_PATH}?done=${conflictInsight ? `conflict&insight=${conflictInsight}` : "recorded"}`);
}

export async function completeCommitmentAction(form: FormData) {
  const { actor } = await requireActor();
  try {
    await api.completeCommitment(actor, parseInput("commitment", form).commitmentId);
  } catch (e) {
    fail(COMMITMENTS_PATH, e);
  }
  revalidatePath(COMMITMENTS_PATH);
  redirect(`${COMMITMENTS_PATH}?done=completed`);
}

export async function renegotiateCommitmentAction(form: FormData) {
  const { actor } = await requireActor();
  try {
    const i = parseInput("renegotiateCommitment", form);
    const current = (await api.commitments(actor))?.owe.find((c) => c.id === i.commitmentId);
    // A new window moves the commitment's effects with it (e.g. a promotion moved out of a conflict).
    const effects =
      i.windowStart && i.windowEnd && current
        ? current.effects.map((e) => ({ ...e, windowStart: i.windowStart!, windowEnd: i.windowEnd! }))
        : undefined;
    await api.renegotiateCommitment(actor, i.commitmentId, { dueAt: i.dueAt, rationale: i.rationale, effects });
  } catch (e) {
    fail(COMMITMENTS_PATH, e);
  }
  revalidatePath(COMMITMENTS_PATH);
  redirect(`${COMMITMENTS_PATH}?done=renegotiated`);
}

export async function cancelCommitmentAction(form: FormData) {
  const { actor } = await requireActor();
  try {
    const i = parseInput("cancelCommitment", form);
    await api.cancelCommitment(actor, i.commitmentId, i.rationale);
  } catch (e) {
    fail(COMMITMENTS_PATH, e);
  }
  revalidatePath(COMMITMENTS_PATH);
  redirect(`${COMMITMENTS_PATH}?done=cancelled`);
}

// ── Insight and action lifecycle from the trace (Phase 4: every human command in the UI) ──
async function onTrace(
  form: FormData,
  run: (actor: Awaited<ReturnType<typeof requireActor>>["actor"]) => Promise<unknown>,
) {
  const { actor } = await requireActor();
  const back = backTo(form);
  try {
    await run(actor);
  } catch (e) {
    fail(back, e);
  }
  revalidatePath(back);
  redirect(back);
}

export async function acknowledgeInsightAction(form: FormData) {
  await onTrace(form, (a) => api.acknowledge(a, parseInput("insight", form).insightId));
}
export async function dismissInsightAction(form: FormData) {
  await onTrace(form, (a) => {
    const i = parseInput("dismissInsight", form);
    return api.dismiss(a, i.insightId, i.rationale);
  });
}
export async function cancelActionAction(form: FormData) {
  await onTrace(form, (a) => {
    const i = parseInput("cancelAction", form);
    return api.cancelAction(a, i.actionId, i.rationale);
  });
}
export async function amendActionAction(form: FormData) {
  await onTrace(form, (a) => {
    const i = parseInput("amendAction", form);
    return api.amendAction(a, i.actionId, i.estimatedCost, i.note);
  });
}
export async function retryActionAction(form: FormData) {
  await onTrace(form, (a) => api.retryAction(a, parseInput("actionRef", form).actionId));
}

// ── Language (Eran, 2026-10-05: Hebrew, RTL, chosen by the user) ──
export async function setLanguageAction(form: FormData) {
  const lang = String(form.get("lang") ?? "");
  if (!isLocale(lang)) redirect("/");
  (await cookies()).set(LOCALE_COOKIE, lang, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // Back to the same page: the referer's path only (never another site).
  const ref = (await headers()).get("referer");
  let back = "/";
  try {
    if (ref) {
      const u = new URL(ref);
      const candidate = u.pathname + u.search;
      if (/^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/.test(candidate)) back = candidate;
    }
  } catch {
    back = "/";
  }
  redirect(back);
}

// ── Initiatives (plan v2, E3; cross-department.md §3) ──
const INITIATIVES_PATH = "/initiatives";
async function onInitiative(
  form: FormData,
  done: string,
  run: (actor: Awaited<ReturnType<typeof requireActor>>["actor"], key: string) => Promise<unknown>,
) {
  const { actor } = await requireActor();
  const key = String(form.get("key") ?? "");
  const back = key ? `${INITIATIVES_PATH}?i=${encodeURIComponent(key)}` : INITIATIVES_PATH;
  try {
    await run(actor, key);
  } catch (e) {
    if (e instanceof DomainError)
      redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(INITIATIVES_PATH);
  redirect(`${back}${back.includes("?") ? "&" : "?"}done=${done}`);
}

export async function completeMilestoneAction(form: FormData) {
  await onInitiative(form, "milestone_done", async (a) =>
    api.completeMilestone(a, parseInput("completeMilestone", form).milestoneId),
  );
}

export async function moveMilestoneAction(form: FormData) {
  await onInitiative(form, "milestone_moved", async (a) => {
    const i = parseInput("moveMilestone", form);
    await api.moveMilestone(a, i.milestoneId, i.dueOn, i.reason);
  });
}

export async function resolveBarrierAction(form: FormData) {
  await onInitiative(form, "barrier_resolved", async (a) => {
    const i = parseInput("resolveBarrier", form);
    await api.resolveBarrier(a, i.barrierId, i.resolution);
  });
}

export async function raiseBarrierAction(form: FormData) {
  await onInitiative(form, "barrier_raised", async (a) => {
    const i = parseInput("raiseBarrier", form);
    await api.raiseBarrier(a, i.initiativeId, i);
  });
}

export async function sendReminderAction(form: FormData) {
  await onInitiative(form, "reminder_sent", async (a) => {
    const i = parseInput("sendReminder", form);
    await api.sendInitiativeReminder(a, i.initiativeId, i);
  });
}

// ── Action Center (plan v2, E4; action-center.md §3–§4) ──
const CENTER_PATH = "/action-center";
const centerBack = (f: FormData) => {
  const raw = String(f.get("insightId") ?? "");
  return /^[0-9a-f-]{36}$/i.test(raw) ? `${CENTER_PATH}?item=${raw}` : `${CENTER_PATH}?`;
};

export async function approveAndSendAction(form: FormData) {
  const { actor } = await requireActor();
  const back = centerBack(form);
  try {
    const i = parseInput("approveAndSend", {
      ...Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$") && k !== "cc" && k !== "grant")),
      ccUserIds: form.getAll("cc").map(String).filter(Boolean),
      grantActionIds: form.getAll("grant").map(String).filter(Boolean),
    });
    await api.approveAndSend(actor, i.insightId, i);
  } catch (e) {
    if (e instanceof DomainError) redirect(`${back}&error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(CENTER_PATH);
  redirect(`${back}&done=sent`);
}

export async function declineInCenterAction(form: FormData) {
  const { actor } = await requireActor();
  const back = centerBack(form);
  try {
    const i = parseInput("declineInCenter", form);
    await api.declineInCenter(actor, i.insightId, i.rationale);
  } catch (e) {
    if (e instanceof DomainError) redirect(`${back}&error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(CENTER_PATH);
  redirect(`${CENTER_PATH}?done=declined`);
}

// ── Reports (plan v2, E5; reports.md §3) ──
export async function generateReportAction(form: FormData) {
  const { actor } = await requireActor();
  const scope = String(form.get("scope") ?? "");
  const raw = String(form.get("layout") ?? "");
  const back = `/reports?s=${encodeURIComponent(scope)}&l=${encodeURIComponent(raw)}`;
  if (!/^[0-9a-f-]{36}$/i.test(scope)) redirect(`${back}&error=${encodeURIComponent(tk("Choose a scope"))}`);
  const layout = decodeLayout(raw, "weekly_management", (id) => /^[0-9a-f-]{36}$/i.test(id));
  const lang = (await cookies()).get(LOCALE_COOKIE)?.value === "he" ? "he" : "en";
  let id = "";
  try {
    id = await api.generateReport(actor, { scopeUnitId: scope, layout, language: lang });
  } catch (e) {
    if (e instanceof DomainError) redirect(`${back}&error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/reports");
  redirect(`/reports/${id}`);
}

export async function saveReportLayoutAction(form: FormData) {
  const { actor } = await requireActor();
  const scope = String(form.get("scope") ?? "");
  const raw = String(form.get("layout") ?? "");
  const back = `/reports?s=${encodeURIComponent(scope)}&l=${encodeURIComponent(raw)}`;
  const layout = decodeLayout(raw, "weekly_management", (id) => /^[0-9a-f-]{36}$/i.test(id));
  let id = "";
  try {
    id = await api.saveReportLayout(actor, { name: String(form.get("name") ?? ""), layout });
  } catch (e) {
    if (e instanceof DomainError) redirect(`${back}&error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/reports");
  redirect(
    `${back}&done=${encodeURIComponent(tk("Saved as your version. Pick it from Template next time."))}&mine=${id}`,
  );
}

export async function deleteReportLayoutAction(form: FormData) {
  const { actor } = await requireActor();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/reports");
  try {
    await api.deleteReportLayout(actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/reports?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/reports");
  redirect(`/reports?done=${encodeURIComponent(tk("Your version was deleted."))}`);
}
