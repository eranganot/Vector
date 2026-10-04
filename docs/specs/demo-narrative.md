# Demo narrative

Status: **Draft for Phase 1 approval**. Two stories built on the same system: a 5-minute investor demo and a
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
| 3:40 | Dana                   | Second card: live heatwave forecast for South branches → opportunity insight (external data)                                          | Real-world intelligence                |
| 4:10 | —                      | Audit view: the whole story rebuilt from the log; hash chain verified                                                                 | Trust you can prove                    |
| 4:40 | —                      | Close: Signal → Insight → Decision → Action → Outcome, with evidence, priority and approval                                           | The product loop                       |

## Phase 2 demo (first live slice)

The Haifa Grand Canyon sales drop: Avi (Branch Manager) sees the insight → VECTOR recommends a stock transfer from
Haifa Downtown → AP-4 routes it to Yossi → Yossi approves → simulated execution → clock +7 days → outcome
`worked` → trace and audit. About 3 minutes.

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
