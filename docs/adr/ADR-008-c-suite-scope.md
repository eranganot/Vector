# ADR-008: C-suite read scope

- Status: proposed (E0, 2026-10-06). The requirement is Eran's (FB-1); the mechanism is Claude's, to confirm at the E0 gate.
- Context: plan v2 makes the C-suite the primary users. Eran (2026-10-06 17:52): "CEO, CFO, COO can see everything; the
  other C-suite should see only their department, but they should also see all the cross-projects that their department
  is included in." Today (ADR-003) a Department Manager reads only what touches their department's subtree, and only the
  Executive, the board Viewer and the Admin read the whole group.

## Decision

1. **Seeing and acting are separate grants.** Wider _reading_ never brings wider _acting_. A C-level who reads the whole
   group may still approve, decide or record only where their acting role allows it (AZ-1 is unchanged).
2. **Group readers.** The CFO and the new COO keep their acting role and also get a **Viewer @ Group** assignment (the
   board observer's role). Viewer already carries `insight.read` and `audit.read` over the group and nothing else.
   No new role and no change to the permission matrix are needed.

   | Person              | Acting role (unchanged scope of action)                  | Reading                |
   | ------------------- | -------------------------------------------------------- | ---------------------- |
   | Dana Levi, CEO      | Executive @ Group                                        | Group                  |
   | Michal Golan, CFO   | Department Manager @ Finance                             | Group (Viewer @ Group) |
   | COO (new persona)   | Department Manager @ Store Operations and @ Supply Chain | Group (Viewer @ Group) |
   | Other C-suite (VPs) | Department Manager @ their department                    | Their department + § 3 |

   Why the COO does not act as an Executive: AP rules ask the Executive "only when nobody else may approve" (G3-a). A
   second Executive would change who is asked for many approvals. The COO's decision rights over operations come from
   the two operations departments, where the VPs (Shira, Noa) remain the heads (`is_head`), so routing is unchanged.

3. **Cross-department initiatives.** An `Initiative` (cross-department.md) stores `visible_unit_ids` = every
   participating unit and its ancestors. Its existing read rule (scope ∩ visible units ≠ ∅) then gives every
   participating department's managers the initiative, its milestones, barriers and linked dependencies, with no new
   rule. Insights and actions linked to an initiative keep their own visibility: an initiative never widens what you
   can read about an insight.
4. **Who is C-suite** is a person flag, `is_c_suite`, not a role. It chooses the executive home layout and navigation
   (IA v2), never permissions. Seeded C-suite: Dana (CEO), Michal (CFO), the COO, Shira (Store Operations), Noa (Supply
   Chain), Eitan (Trade & Commercial), Ronit (Marketing), Hila (HR), Yael (General Counsel), Amir (CIO). Everyone else
   keeps today's home.

## Consequences

- Michal and the COO see every risk, opportunity, initiative and audit event in the group. Their Approve and Decide
  buttons still appear only where they may act; the UI derives that from the same `authorize()` the commands use.
- The integration suite gains a matrix test: for each C-suite persona, what they can read (group vs. department plus
  initiatives) and that reading the group never lets them approve outside their acting scope.
- The board observer is unchanged.
