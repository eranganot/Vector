/**
 * Retail calendar for Israel (synthetic organization, real calendar). Holiday days are excluded from
 * detector baselines and shape the synthetic data. Dates are ISO yyyy-mm-dd (local calendar days).
 */
export type DayKind = "normal" | "holiday_eve" | "holiday";

const DAYS: Record<string, DayKind> = {
  // Rosh Hashanah 5787
  "2026-09-11": "holiday_eve",
  "2026-09-12": "holiday",
  "2026-09-13": "holiday",
  // Yom Kippur
  "2026-09-20": "holiday_eve",
  "2026-09-21": "holiday",
  // Sukkot and Shemini Atzeret / Simchat Torah
  "2026-09-25": "holiday_eve",
  "2026-09-26": "holiday",
  "2026-10-02": "holiday_eve",
  "2026-10-03": "holiday",
};

export function dayKind(isoDay: string): DayKind {
  return DAYS[isoDay] ?? "normal";
}

/** Weekday of an ISO date, 0 = Sunday … 6 = Saturday (timezone-independent). */
export function weekday(isoDay: string): number {
  return new Date(`${isoDay}T12:00:00Z`).getUTCDay();
}

export function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
