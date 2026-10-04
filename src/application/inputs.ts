/**
 * Input validation at the boundary (security.md): every form a server action receives is parsed here before any
 * command runs. Invalid input becomes a DomainError("Invalid"), shown to the person and never reaching a command.
 */
import { z } from "zod";
import { DomainError } from "@/domain/errors";

const id = z.string().uuid("a valid id is required");
const note = z.string().trim().max(2000, "keep it under 2,000 characters");
/** A path inside this app (no scheme, no host, no protocol-relative //): prevents open redirects. */
const appPath = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/, "must be a path inside VECTOR")
  .max(300);

export const INPUTS = {
  signIn: z.object({ email: z.string().trim().email("enter a valid email"), password: z.string().min(1).max(200) }),
  switchPersona: z.object({ email: z.string().trim().email(), next: appPath.optional() }),
  acceptDecision: z.object({ insightId: id, decisionId: id, rationale: note.optional() }),
  declineDecision: z.object({
    insightId: id,
    decisionId: id,
    rationale: note.min(1, "a reason is required to decline"),
  }),
  approve: z.object({ actionId: id, verdict: z.enum(["grant", "deny"]), rationale: note.optional() }),
  reviewOutcome: z.object({ insightId: id, outcomeId: id, lesson: note.min(1, "write the lesson") }),
  advanceClock: z.object({
    hours: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 14),
  }),
} as const;

/** Parse a form (or plain object) with one of the schemas above; empty fields count as absent. */
export function parseInput<K extends keyof typeof INPUTS>(
  kind: K,
  form: FormData | Record<string, unknown>,
): z.infer<(typeof INPUTS)[K]> {
  const raw =
    form instanceof FormData
      ? Object.fromEntries([...form.entries()].filter(([k, v]) => !k.startsWith("$") && v !== ""))
      : Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "" && v !== undefined));
  const r = INPUTS[kind].safeParse(raw);
  if (!r.success)
    throw new DomainError("Invalid", r.error.issues.map((i) => `${i.path.join(".") || kind}: ${i.message}`).join("; "));
  return r.data as z.infer<(typeof INPUTS)[K]>;
}
