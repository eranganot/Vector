import { and, eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import type { Db } from "@/application/db";
import * as s from "@/infra/db/schema";
import { SEED_VERSION, USERS } from "./org";

/**
 * Why the boot-time `demo:reset --if-empty` must seed a new epoch, or null when the active one is current.
 * Besides a new SEED_VERSION, a rotated SEED_USER_PASSWORD needs a reseed: the seeded people keep the password they were
 * seeded with, and the persona switcher signs in with the current one (STATUS.md, 2026-10-04: Prod sign-in failed after
 * the secrets were rotated).
 */
export async function reseedReason(db: Db, password: string): Promise<string | null> {
  const [active] = await db
    .select({ id: s.organization.id })
    .from(s.organization)
    .where(and(eq(s.organization.isActive, true), eq(s.organization.seedVersion, SEED_VERSION)));
  if (!active) return `no active ${SEED_VERSION} epoch`;
  const probe = USERS[0].email;
  const [cred] = await db
    .select({ hash: s.account.password })
    .from(s.account)
    .innerJoin(s.user, eq(s.user.id, s.account.userId))
    .where(and(eq(s.user.email, probe), eq(s.account.providerId, "credential")));
  if (!cred?.hash) return `seeded person ${probe} has no password`;
  if (!(await verifyPassword({ hash: cred.hash, password })))
    return "SEED_USER_PASSWORD changed since the epoch was seeded";
  return null;
}
