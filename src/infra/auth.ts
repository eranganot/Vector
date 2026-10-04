/**
 * Authentication (ADR-003): Better Auth, email + password, database sessions in httpOnly cookies.
 * Authorization is NOT here; it lives in src/domain/policy and is enforced by application commands.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "./db/client";
import * as schema from "./db/schema";

const SESSION_HOURS = 12; // AZ-3: writes need a session no older than 12 h; sessions simply expire then.

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  session: { expiresIn: SESSION_HOURS * 3600, updateAge: SESSION_HOURS * 3600 },
  user: {
    additionalFields: {
      orgId: { type: "string", required: false, input: false },
      title: { type: "string", required: false, input: false },
      isSeeded: { type: "boolean", required: false, input: false },
    },
  },
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  plugins: [nextCookies()],
});
