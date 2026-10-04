# Information architecture

Status: **Draft for Phase 1 approval**. Wireframes: the "VECTOR Phase 1 Wireframes" design canvas (sources mirrored in [wireframes/](wireframes/)).

## Principle

Every screen answers _what matters and what should happen_, in that order. **Risks and opportunities are separate
workstreams** (ADR-006): each has its own lane and ranking on every screen, and they are never mixed in one list. KPIs appear only as **evidence behind
insights**, never as the headline. This is how VECTOR avoids turning into a BI dashboard (charter §3).

## Navigation

```text
Header:  VECTOR · [scope breadcrumb] · search · Approvals (badge) · persona chip ("Viewing as Dana Levi · CEO · demo")
Primary: Home · Approvals · Actions · Audit · (Admin: Policy · Demo controls)
```

| Route             | Screen                                                           | Primary question it answers                                             |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `/`               | Home: routed by role                                             | What needs my attention now?                                            |
| `/command-center` | Executive Command Center                                         | How is the organization doing, what matters most, what's waiting on me? |
| `/units/[id]`     | Department / Region / Branch view (one template, three flavours) | What is happening in my area, and who owns it?                          |
| `/insights/[id]`  | Insight trace                                                    | Why am I seeing this, and what should happen?                           |
| `/approvals`      | Approvals inbox                                                  | What am I being asked to approve, and why me?                           |
| `/actions`        | Actions tracker (VECTOR actions only)                            | What's in flight, and did it work?                                      |
| `/audit`          | Audit explorer                                                   | What exactly happened, who did it, and is the log intact?               |
| `/admin/demo`     | Demo controls (Admin, demo env)                                  | Reset, advance the clock, inject a planted story                        |

**Home routing:** Executive → Command Center · Department Manager → their department · Regional / Branch Manager → their
region or branch · Viewer → Command Center (read-only, their scope).

## Screen anatomy

**Command Center**

1. Header strip: one sentence of org health ("2 regions on track, North at risk") + as-of time.
2. **Top priorities**: ranked insight cards (P1/P2): title, affected units, impact, band, owner, status.
3. **Decisions waiting on you**: approvals and pending decisions.
4. Health by region: a small multiple per region (one composite status + the 2 KPIs driving it).
5. **Opportunities**, a separate lane ranked by opportunity value (O1–O3), owned mostly by Marketing and Trade & Commercial.

**Insight trace** (the core trust screen):

1. Title, band chip, status, owner, and an **"AI-generated"** or **"Rule-generated"** label.
2. What happened / why it matters.
3. **Why am I seeing this?**: Signal → Evidence (frozen chart, with source and captured time) → priority breakdown
   (five factors, weights, confidence) → affected units.
4. Recommendation: the decision + proposed actions, each with owner, due date and approval requirement ("Needs
   Regional Manager North: AP-4 inventory transfer").
5. Lifecycle timeline: decision → approval → execution → outcome, each step with who and when.
6. Audit tab: raw events, with a chain verification badge.

**Unit view (Department / Region / Branch):** risks in scope ranked by priority (region and branch views rank by **local
priority** and show the organizational band beside it, e.g. "P3 for the group · P2 for your branch"); opportunities in their own lane; actions owned in the unit; for
regions, child branches ranked by attention needed; dependencies (P4); key KPIs as compact evidence strips.

**Approvals inbox:** per request: action summary, why approval is needed (matched rules), the insight's priority and
evidence summary, Approve / Deny (rationale required on deny), and "open full trace".
