# Demo narrative

Status: **Approved (Phase 1, 2026-10-04); Phase 2 demo updated as built.** Two stories built on the same system: a 5-minute investor demo and a
20-minute internal deep dive. Each phase's demo is a subset of these.

## The one-line pitch

Every company has a dozen systems and nobody can say what matters this morning. VECTOR turns signals into
explained priorities and closes the loop from decision to measured outcome, with humans in control and
every step on the record.

## 5-minute investor story (target state, Phase 7)

| Time | Persona                | What happens on screen                                                                                                                | Point it makes                         |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 0:00 | —                      | One slide: "14 systems, 0 answers to _what matters today?_"                                                                           | The problem                            |
| 0:20 | Dana (CEO)             | Command Center: health by region, **3 priorities**, 2 decisions waiting. Top: _P1 stock-out risk in North before the holiday weekend_ | Priorities, not dashboards             |
| 1:00 | Dana                   | Opens it → **Why am I seeing this?** Signal → frozen evidence chart → priority breakdown (impact ₪600k, 9 branches, 48 h)             | Explainable, not AI magic              |
| 1:40 | Dana                   | Recommendation: transfer stock from the Center DC + expedite delivery. Badge: _Needs Yossi's approval: rule AP-4 inventory transfer_  | Human control by policy                |
| 2:10 | Yossi (Regional North) | Persona switch → Approvals inbox → reads the trace → **Approve** with a note                                                          | Clear ownership; nothing self-approves |
| 2:40 | —                      | Executes (labelled _simulated_); demo clock advances 3 days                                                                           | Closed loop                            |
| 3:10 | Dana                   | Outcome: OSA 91% → 98%, verdict **worked**, lesson recorded                                                                           | Did it work? Learn                     |
| 3:40 | Dana                   | Opportunities lane: live heatwave forecast for South branches → O1 "pursue now" (external data), managed separately from risks        | Risk and upside handled differently    |
| 4:10 | —                      | Audit view: the whole story rebuilt from the log; hash chain verified                                                                 | Trust you can prove                    |
| 4:40 | —                      | Close: Signal → Insight → Decision → Action → Outcome, with evidence, priority and approval                                           | The product loop                       |

## Phase 2 demo (as built, about 6 minutes)

All on the Dev/demo environment, from a fresh reset (Demo controls → Reset demo).

| Step | Persona                | On screen                                                                                                                                                                                                                               | Point it makes                              |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1    | Dana (CEO)             | **Today**: "14 risks (4 P1) and 5 opportunities", eight approvals waiting; risks and opportunities in separate lanes                                                                                                                    | Priorities, not dashboards; two workstreams |
| 2    | Dana                   | **Performance**: group KPIs vs target, health by region (Center and North at risk), organization pulse of 8 departments                                                                                                                 | The organization at a glance                |
| 3    | Dana                   | Opens the recall (P1 92) → **Why am I seeing this?**: signal, source record, six-factor breakdown with compliance 1.0, owner Legal & Compliance and the involved departments                                                            | Explainable and cross-department            |
| 4    | Avi (Branch Manager)   | Today shows the Haifa sales drop as **P1 for Haifa Grand Canyon** (group P2). Trace: sales and availability fell on the same days; VECTOR recommends a transfer from the best-stocked North sibling (Haifa Downtown in the seeded data) | Local priority; evidence                    |
| 5    | Avi                    | **Accept recommendation** → the transfer shows "Needs approval: AP-4 inventory transfer", eligible Regional Manager North or Supply Chain or Executive                                                                                  | Human control by policy                     |
| 6    | Noa (VP Supply)        | Approvals inbox: the Haifa transfer is not there (she owns it, AZ-2)                                                                                                                                                                    | Separation of duties                        |
| 7    | Yossi (Regional North) | Approvals → **Approve** the Haifa transfer with a note → executed (labelled simulated)                                                                                                                                                  | Clear ownership; nothing self-approves      |
| 8    | Maya (Regional Center) | Today: labor cost over plan is **P2 for Center** (group P3); Performance: her 12 branches, labor in red                                                                                                                                 | Same item, different priority by scope      |
| 9    | Admin → Dana           | Demo controls **+8 days** → the Haifa trace shows outcome **worked**, insight resolved; Audit: chain verified                                                                                                                           | Closed loop; trust you can prove            |

Optional: Lior (Tel Aviv Dizengoff) sees the shrinkage spike as P2 and what he is waiting on from Store Operations, Finance
and HR; Omer (South) approves the heatwave opportunity's deliveries and staffing; Noa's department dashboard shows who she
depends on and who depends on her.

## 20-minute internal deep dive

1. Problem and product promise (2 min)
2. The 5-minute story, slower, with questions (6 min)
3. Under the hood (6 min): domain lifecycle and state machines, permission ≠ authorization ≠ approval ≠ execution,
   priority formula and calibration, audit integrity
4. AI governance (3 min): where AI helps, what it may never do, evaluation, record and replay
5. Roadmap and what's real vs. simulated (3 min)

## Honesty rules for every demo

- Data is labelled synthetic; executed actions are labelled simulated (D7); replayed AI output is badged "recorded" (D8).
- No claim in the script that the product can't do live, on the demo environment, that day.
