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

/** A datetime-local value ("2026-10-25T12:00"), read as UTC like every time in the synthetic organization. */
const when = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "pick a date and time")
  .transform((v) => new Date(`${v}:00Z`));
const dayStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");
const ownerId = z.string().trim().min(1).max(100);

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
  recordCommitment: z
    .object({
      title: z.string().trim().min(5, "say what was promised").max(200),
      ownerUserId: ownerId,
      ownerUnitId: id,
      beneficiaryUnitIds: z.array(id).max(20).default([]),
      source: z.string().trim().min(3, "where was it promised?").max(200),
      dueAt: when,
      impactIls: z.coerce.number().min(0).max(100_000_000).optional(),
      compliance: z.coerce.number().min(0).max(1).optional(),
      resource: z
        .string()
        .trim()
        .regex(/^[a-z0-9:_-]{3,80}$/, "a resource name like sku-set:south-dairy-6")
        .optional(),
      effect: z.enum(["promote", "delist", "spend", "freeze_spend", "cutover", "peak_trading"]).optional(),
      windowStart: dayStr.optional(),
      windowEnd: dayStr.optional(),
    })
    .refine((v) => (v.resource ? !!(v.effect && v.windowStart && v.windowEnd) : !v.effect), {
      message: "an effect needs a resource, an effect and its window",
    }),
  commitment: z.object({ commitmentId: id }),
  renegotiateCommitment: z.object({
    commitmentId: id,
    dueAt: when,
    rationale: note.min(3, "say why the date moves"),
    windowStart: dayStr.optional(),
    windowEnd: dayStr.optional(),
  }),
  cancelCommitment: z.object({ commitmentId: id, rationale: note.min(3, "say why it is cancelled") }),
  // Plan v2, E3: initiatives (cross-department.md §3). `key` returns the reader to the initiative they acted on.
  completeMilestone: z.object({ key: z.string().max(60), milestoneId: id }),
  moveMilestone: z.object({
    key: z.string().max(60),
    milestoneId: id,
    dueOn: dayStr,
    reason: note.min(5, "say why the date moves"),
  }),
  resolveBarrier: z.object({
    key: z.string().max(60),
    barrierId: id,
    resolution: note.min(5, "say how it was resolved"),
  }),
  raiseBarrier: z.object({
    key: z.string().max(60),
    initiativeId: id,
    title: note.min(3, "name the barrier"),
    kind: z.enum(["dependency", "resource", "budget", "decision", "external"]),
    ownerUnitId: id,
    costIls: z.coerce.number().min(0).max(100_000_000).optional(),
  }),
  sendReminder: z.object({
    key: z.string().max(60),
    initiativeId: id,
    toUnitId: id,
    subjectKind: z.enum(["milestone", "barrier", "budget"]),
    subjectId: id.optional(),
    body: note.min(5, "write the reminder"),
  }),
  insight: z.object({ insightId: id }),
  dismissInsight: z.object({ insightId: id, rationale: note.min(3, "say why it can be dismissed") }),
  actionRef: z.object({ insightId: id, actionId: id }),
  cancelAction: z.object({ insightId: id, actionId: id, rationale: note.min(3, "say why it is cancelled") }),
  amendAction: z.object({
    insightId: id,
    actionId: id,
    estimatedCost: z.coerce.number().min(0).max(100_000_000),
    note: note.optional(),
  }),
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
