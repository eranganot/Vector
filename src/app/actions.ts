"use server";
/**
 * Server actions: thin adapters from forms to application commands. Every action re-derives the
 * actor from the session; the commands do all authorization (backend-enforced, charter §21).
 */
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, seededPeople } from "@/application/facade";
import { DomainError } from "@/domain/errors";
import { auth } from "@/infra/auth";
import { seedPassword } from "@/infra/seed/password";
import { demoPersonasEnabled, requireActor, SWITCHER_COOKIE } from "./_lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (path: string, err: unknown): never => {
  if (err instanceof DomainError) redirect(`${path}?error=${encodeURIComponent(err.message)}`);
  throw err;
};

export async function signIn(form: FormData) {
  try {
    await auth.api.signInEmail({
      body: { email: str(form, "email"), password: str(form, "password") },
      headers: await headers(),
    });
  } catch {
    redirect("/login?error=" + encodeURIComponent("Email or password is incorrect"));
  }
  (await cookies()).delete(SWITCHER_COOKIE);
  redirect("/");
}

/** Demo persona switcher (AZ-5): signs in as a seeded person through the normal auth path. */
export async function switchPersona(form: FormData) {
  if (!demoPersonasEnabled())
    redirect("/login?error=" + encodeURIComponent("Persona switching is off in this environment"));
  const email = str(form, "email");
  const people = await seededPeople();
  if (!people.some((p) => p.email === email)) redirect("/login?error=" + encodeURIComponent("Unknown persona"));
  const password = seedPassword() ?? "";
  try {
    await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    redirect("/login?error=" + encodeURIComponent("Persona sign-in failed: check SEED_USER_PASSWORD"));
  }
  (await cookies()).set(SWITCHER_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect(str(form, "next") || "/");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
  (await cookies()).delete(SWITCHER_COOKIE);
  redirect("/login");
}

export async function acceptDecisionAction(form: FormData) {
  const { actor } = await requireActor();
  const back = `/insights/${str(form, "insightId")}`;
  try {
    await api.acceptDecision(actor, str(form, "decisionId"), str(form, "rationale") || undefined);
  } catch (e) {
    fail(back, e);
  }
  revalidatePath(back);
  redirect(back);
}

export async function declineDecisionAction(form: FormData) {
  const { actor } = await requireActor();
  const back = `/insights/${str(form, "insightId")}`;
  try {
    await api.declineDecision(actor, str(form, "decisionId"), str(form, "rationale"));
  } catch (e) {
    fail(back, e);
  }
  redirect(back);
}

export async function approveAction(form: FormData) {
  const { actor } = await requireActor();
  try {
    if (str(form, "verdict") === "grant")
      await api.grant(actor, str(form, "actionId"), str(form, "rationale") || undefined);
    else await api.deny(actor, str(form, "actionId"), str(form, "rationale"));
  } catch (e) {
    fail("/approvals", e);
  }
  revalidatePath("/approvals");
  redirect("/approvals?done=" + str(form, "verdict"));
}

export async function reviewOutcomeAction(form: FormData) {
  const { actor } = await requireActor();
  const back = `/insights/${str(form, "insightId")}`;
  try {
    await api.review(actor, str(form, "outcomeId"), str(form, "lesson"));
  } catch (e) {
    fail(back, e);
  }
  redirect(back);
}

export async function advanceClockAction(form: FormData) {
  const { actor } = await requireActor();
  try {
    await api.advanceClock(actor, Number(str(form, "hours")));
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
