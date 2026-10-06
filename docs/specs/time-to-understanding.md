# Time-to-Understanding test

Status: **Phase 3.** Charter §31 Phase 3 asks us to validate that people understand the organization rather than browse
data. This test measures that two ways: an automated check on every build, and a short live test with real people.

> **Plan v2 (E2):** for the C-suite, the check moves to four questions (how are we doing, why, where is it heading, where to focus): [executive-home.md §1](executive-home.md#1-the-five-second-promise).

## What "understood" means

A person understands their part of the organization when they can say, unprompted:

1. **What** needs attention (the item or the unit).
2. **How bad** it is (band, ₪ at stake, or time to impact).
3. **What should happen**, and whether it waits on them.

## Automated check (every CI run)

`tests/e2e/00-time-to-understanding.spec.ts` opens each role's home at **1440×900** (a laptop) and checks that all three
answers are visible **above the fold**, without scrolling:

Since G-P3a (Eran, 2026-10-04), every home is a dashboard of the person's scope:

| Role                     | Home (scope)        | What                                  | How bad                       | What to do                                     |
| ------------------------ | ------------------- | ------------------------------------- | ----------------------------- | ---------------------------------------------- |
| CEO (Dana)               | VECTOR Retail Group | headline naming the regions           | the KPI row (status + change) | "Waiting on you" (decisions, approvals, tasks) |
| Regional manager (Yossi) | North               | headline naming the branches          | the KPI row                   | "Waiting on you"                               |
| Branch manager (Avi)     | Haifa Grand Canyon  | headline: P1 risk, results off target | the KPI row                   | "Waiting on you: Decide" and his own task      |
| Department head (Noa)    | Supply Chain        | headline: P1 risks it owns or acts on | its department results        | "Waiting on you": her decision and her 4 tasks |

The risk summary (top item with "Why:" and "Recommended:") follows the KPI row; on the CEO's screen it starts just
below the fold.

It is a proxy: it proves the answer is on screen, not that a person reads it.

## Live test (Eran, five people, ~10 minutes each)

1. Brief: "You are the {role} of a retail group. Sign in and tell me what's going on." Use the persona switcher.
2. Start a timer when the home page appears. Stop when the person has said all three (what, how bad, what to do) for
   the most important item, without help. Note anything they misread.
3. Then ask them to find one branch two levels down, and time it.
4. Record the results in the table below (time in seconds, 0–2 score per question, comments).

**Pass:** median time to all three answers is **under 60 seconds**, at least 4 of 5 people get "what to do" right, and
finding a branch takes **at most two clicks**.

| Person | Role | Seconds to 3 answers | What (0–2) | How bad (0–2) | What to do (0–2) | Clicks to a branch | Notes |
| ------ | ---- | -------------------- | ---------- | ------------- | ---------------- | ------------------ | ----- |
|        |      |                      |            |               |                  |                    |       |
