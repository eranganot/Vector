import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { actorFor, profile } from "@/application/facade";
import { auth } from "@/infra/auth";

export const SWITCHER_COOKIE = "vector_via_switcher";
export const demoPersonasEnabled = () => process.env.DEMO_PERSONAS === "on";

/** The signed-in person as a domain Actor, or a redirect to /login. */
export async function requireActor() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/login");
  const via = (await cookies()).get(SWITCHER_COOKIE)?.value === "1";
  const actor = await actorFor({ userId: s.user.id, sessionId: s.session.id, viaDemoSwitcher: via });
  return { actor, me: await profile(s.user.id), via };
}

export const can = (actor: Awaited<ReturnType<typeof requireActor>>["actor"], role: string) =>
  actor.kind === "user" && actor.assignments.some((a) => a.role === role);
