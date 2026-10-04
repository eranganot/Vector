/**
 * Action types VECTOR can recommend, with their executor, the department whose budget pays (AP-3) and how
 * their outcome is measured.
 * Executors are simulated and labelled (D7).
 */
import { DomainError } from "@/domain/errors";
export type Playbook = {
  type: string;
  executor: "internal_task" | "outbox_message";
  audience?: "internal" | "external";
  /** Outcome watch (O1); absent = informational action with no outcome to measure. */
  outcome?: { kpiCode: string; direction: "up" | "down"; threshold: number; windowDays: number };
  /** Department code whose budget the cost comes from (AP-3). */
  budgetDepartmentCode?: string;
};

export const PLAYBOOKS: Record<string, Playbook> = {
  notify_owner: { type: "notify_owner", executor: "internal_task" },
  inventory_transfer: {
    type: "inventory_transfer",
    executor: "internal_task",
    outcome: { kpiCode: "osa", direction: "up", threshold: 5, windowDays: 7 },
    budgetDepartmentCode: "D-SUPPLY",
  },
  customer_message: { type: "customer_message", executor: "outbox_message", audience: "external" },
  staffing_change: { type: "staffing_change", executor: "internal_task", budgetDepartmentCode: "D-STORE" },
  supplier_message: { type: "supplier_message", executor: "outbox_message", audience: "external" },
  reroute_delivery: { type: "reroute_delivery", executor: "internal_task", budgetDepartmentCode: "D-SUPPLY" },
  recall: { type: "recall", executor: "internal_task", budgetDepartmentCode: "D-SUPPLY" },
  regulatory_notification: { type: "regulatory_notification", executor: "internal_task" },
  contract_clause_invocation: { type: "contract_clause_invocation", executor: "internal_task" },
  schedule_change: { type: "schedule_change", executor: "internal_task", budgetDepartmentCode: "D-IT" },
  campaign_change: { type: "campaign_change", executor: "internal_task", budgetDepartmentCode: "D-MKT" },
  purchase_order: { type: "purchase_order", executor: "internal_task", budgetDepartmentCode: "D-TRADE" },
  price_change: { type: "price_change", executor: "internal_task", budgetDepartmentCode: "D-TRADE" },
  budget_decision: { type: "budget_decision", executor: "internal_task", budgetDepartmentCode: "D-FIN" },
  forecast_update: { type: "forecast_update", executor: "internal_task", budgetDepartmentCode: "D-FIN" },
  training_session: { type: "training_session", executor: "internal_task", budgetDepartmentCode: "D-HR" },
};

export function playbook(type: string): Playbook {
  const p = PLAYBOOKS[type];
  // A domain refusal (audited by runCommand), not a crash: e.g. a playbook retired while older actions still use it.
  if (!p) throw new DomainError("Invalid", `unknown action type ${type}`);
  return p;
}
