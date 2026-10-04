/**
 * Action types VECTOR can recommend in Phase 2, with their executor and how their outcome is measured.
 * Executors are simulated and labelled (D7).
 */
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
};

export function playbook(type: string): Playbook {
  const p = PLAYBOOKS[type];
  if (!p) throw new Error(`unknown action type ${type}`);
  return p;
}
