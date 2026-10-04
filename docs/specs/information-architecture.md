# Information architecture

Status: **Approved (Phase 1, 2026-10-04); updated for Phase 2 as built.** The Phase 1 wireframes (light, in
[wireframes/](wireframes/)) are kept as the approved structure; the built screens are in [screens/](screens/) and supersede
them visually (dark theme, G2).

## Principle

Every screen answers _what matters and what should happen_, in that order. **Risks and opportunities are separate
workstreams** (ADR-006): each has its own lane and ranking on every screen, and they are never mixed in one list. KPIs appear only as **evidence behind
insights**, never as the headline. This is how VECTOR avoids turning into a BI dashboard (charter §3).

## Navigation (as built)

```text
Sidebar (desktop) / top bar (mobile):  VECTOR · Today · Performance · Approvals (badge) · Audit* · Demo controls**
Header:                                 demo clock · persona chip ("Viewing as Dana Levi · CEO · demo") with the switcher
* Executive and Admin   ** Admin
```

| Route            | Screen                                                                    | Primary question it answers                             | Status     |
| ---------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| `/login`         | Sign in / demo personas                                                   | Who am I in this demo?                                  | Built      |
| `/`              | **Today**: waiting on you, risk lane, opportunity lane, recently resolved | What needs my attention now?                            | Built      |
| `/performance`   | **Performance**, by position (group, region, branch, department)          | How is my area doing, and what drives it?               | Built (G2) |
| `/insights/[id]` | Insight trace                                                             | Why am I seeing this, and what should happen?           | Built      |
| `/approvals`     | Approvals inbox                                                           | What am I being asked to approve, and why me?           | Built      |
| `/audit`         | Audit: chain verification (explorer later)                                | Is the log intact? (what exactly happened: Phase 4)     | Partial    |
| `/admin/demo`    | Demo controls                                                             | Reset, advance the clock (+1 h, +1 day, +73 h, +8 days) | Built      |
| `/units/[id]`    | Department / Region / Branch drill-down                                   | What is happening in this unit, and who owns it?        | Phase 3    |
| `/actions`       | Actions tracker                                                           | What's in flight, and did it work?                      | Phase 4    |

Search and the scope breadcrumb arrive with the unit views (Phase 3).

**Home:** everyone lands on **Today**, scoped to their role. Region and branch managers see risks ranked by local priority;
the Performance page carries the role-specific view (performance-dashboards.md). Role-routed homes (Command Center for the
Executive, unit view for managers) are Phase 3.

## Visual

Dark theme (Eran, G2): deep navy ground, panels one step lighter, cyan accent for the active item, actions and charts;
red / amber / cyan / grey for P1–P4, green for opportunities (O1 solid, O2 outlined, O3 grey). IBM Plex Sans and Mono.
Numbers in KPI cards are large; status is always a dot plus a word, never colour alone.

## Screen anatomy

**Command Center** (Phase 3; in Phase 2 its content is split between Today and the group Performance dashboard)

1. Header strip: one sentence of org health ("2 regions on track, North at risk") + as-of time.
2. **Top priorities**: ranked insight cards (P1/P2): title, affected units, impact, band, owner, status.
3. **Decisions waiting on you**: approvals and pending decisions.
4. Health by region: a small multiple per region (one composite status + the 2 KPIs driving it).
5. **Opportunities**, a separate lane ranked by opportunity value (O1–O3); owners vary (Store Operations, Marketing, Trade &
   Commercial, IT).

**Insight trace** (the core trust screen):

1. Title, band chip (local band for region/branch managers, with the group band beside it), workstream, status, and a
   source label (**"Rule-generated"**, **"Scenario catalog · synthetic feed"**, later **"AI-generated"**).
2. What happened / why it matters.
3. **Why am I seeing this?**: Signal → Evidence (frozen chart, with source and captured time) → priority breakdown
   (six risk factors or five opportunity factors, weights, confidence; plus the local score where it applies) → owner
   department and involved units.
4. Recommendation: the decision + proposed actions, each with owner, due date and approval requirement ("Needs
   Regional Manager North: AP-4 inventory transfer").
5. Lifecycle: decision → approval → execution → outcome, each step with who and when.
6. Audit trail: every event for the insight and its decision, actions, approvals and outcomes (chain verification badge on
   `/audit`).

**Unit view (Department / Region / Branch):** risks in scope ranked by priority (region and branch views rank by **local
priority** and show the organizational band beside it, e.g. "P3 for the group · P2 for your branch"); opportunities in their own lane; actions owned in the unit; for
regions, child branches ranked by attention needed; dependencies (P4); key KPIs as compact evidence strips.

**Approvals inbox:** per request: action summary, why approval is needed (matched rules), the insight's priority and
evidence summary, Approve / Deny (rationale required on deny), and "open full trace".
