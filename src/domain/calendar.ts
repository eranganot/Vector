/**
 * Retail calendar for Israel (synthetic organization, real calendar). Holiday days are excluded from
 * detector baselines and shape the synthetic data. Dates are ISO yyyy-mm-dd (local calendar days).
 */
export type DayKind = "normal" | "holiday_eve" | "holiday";

const DAYS: Record<string, DayKind> = {
  // 52-week history (plan v2, E1c; dates from Hebcal, Israel). Rosh Hashanah 5786
  "2025-09-22": "holiday_eve",
  "2025-09-23": "holiday",
  "2025-09-24": "holiday",
  // Yom Kippur 5786
  "2025-10-01": "holiday_eve",
  "2025-10-02": "holiday",
  // Sukkot and Shemini Atzeret 5786
  "2025-10-06": "holiday_eve",
  "2025-10-07": "holiday",
  "2025-10-13": "holiday_eve",
  "2025-10-14": "holiday",
  // Passover 5786 (first and seventh days)
  "2026-04-01": "holiday_eve",
  "2026-04-02": "holiday",
  "2026-04-07": "holiday_eve",
  "2026-04-08": "holiday",
  // Shavuot 5786
  "2026-05-21": "holiday_eve",
  "2026-05-22": "holiday",
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

/** A day's share of a normal week's trade: Sun 0.95 · Mon–Tue 0.9 · Wed 1.0 · Thu 1.25 · Fri 1.1 · Sat 0.35. */
export const WEEKDAY_SHAPE = [0.95, 0.9, 0.9, 1.0, 1.25, 1.1, 0.35] as const;

/**
 * How much a day trades relative to an average weekday: holiday eves spike (×1.45), holy days trade at 5% (most
 * branches closed). The synthetic generator and the budget pro-rating (plan v2, E2) use the same weights.
 */
export function tradingWeight(isoDay: string): number {
  const kind = dayKind(isoDay);
  return kind === "holiday" ? 0.05 : kind === "holiday_eve" ? 1.45 : WEEKDAY_SHAPE[weekday(isoDay)];
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
