# AI governance direction

Status: **Direction for Phase 1 approval**; detailed design at the Phase 5 gate. Implements charter §11–13.

## Where AI is used, and where it is not

| Use AI (Phase 5+)                                         | Keep deterministic                              |
| --------------------------------------------------------- | ----------------------------------------------- |
| Narrative: "what happened / why it matters" from evidence | Detection thresholds, z-scores, cascades        |
| Weekly executive briefing across insights                 | Priority score and bands (ADR-005)              |
| Extracting commitments from unstructured meeting notes    | Authorization, approval rules, execution gating |
| Drafting recommended decisions and actions                | State transitions and audit                     |
| Scoped "Ask VECTOR about this" questions                  | Outcome verdicts                                |     | Factor inputs (e.g. compliance exposure, relevance of an external event), bounded and recorded |     |     | Proposing priority-weight or playbook changes from outcome history (D6) | Applying those changes (needs human approval) |

## Hard rules

1. **AI proposes; it never decides, approves or executes.** It acts as `system:ai`, whose outputs are always
   `recommended` and which can never call `grantApproval`, `executeAction` or `autoDecide`.
2. **Every claim cites evidence.** Structured outputs (Zod-validated) carry evidence ids per claim. A claim that cites
   nothing, or cites evidence outside the request's scope, is rejected and the template text is shown instead.
3. **Scope in = scope out.** The model receives only evidence the requesting user (or the detector's unit) may see.
4. **Untrusted text is data.** Meeting notes and external content are delimited and labelled as untrusted. No
   instruction inside them can trigger a tool call. There are no tools with consequential effects.
5. **Everything is recorded.** `AiGeneration`: provider, model, model version, prompt id + version + hash, input
   evidence ids, output, validation result, confidence, latency, cost, and whether it was served live or replayed (D8).
6. **Uncertainty is shown.** Confidence combines the deterministic data checks with the model's self-report; the
   UI shows it next to AI text, and AI text is visually marked as AI-generated.

## Provider-neutral seam

The provider is open: Claude is the working assumption, and Gemini is possible (decision at the Phase 5 gate).
All calls go through one interface:

```ts
interface ModelGateway {
  generate<T>(req: {
    promptId: string;
    promptVersion: string;
    input: unknown;
    schema: ZodType<T>;
    evidenceIds: string[];
  }): Promise<{ output: T; generationId: string; servedFrom: "live" | "replay" }>;
}
```

Adapters per provider, with prompts kept in the repo as versioned files. Switching provider means changing an
adapter and re-running evals, not rewriting features.

## Evaluation (Phase 5)

- Golden set of ~30 cases built from the planted stories, with expected affected units, key facts and an acceptable
  recommendation class.
- Automatic checks: schema valid, every claim cited, no out-of-scope evidence, units correct, numbers match evidence.
- Judged checks: groundedness and recommendation fit (LLM-as-judge with a rubric, spot-checked by Eran).
- Injection cases: hostile instructions inside meeting notes and external items.
- Run on demand and before each demo promotion, not on every PR (cost).
