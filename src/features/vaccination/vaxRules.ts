import type { VaccineRecord } from "@/types/icn";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

// Configurable defaults
const FLU_SEASON_START_MONTH = 7; // Aug (0=Jan)
const FLU_SEASON_START_DAY = 1;
const FLU_SEASON_END_MONTH = 2; // Mar
const FLU_SEASON_END_DAY = 31;

export function getCurrentFluSeasonWindow(today = new Date()) {
  const t = startOfDay(today);
  const year = t.getFullYear();
  const seasonStartThisYear = new Date(year, FLU_SEASON_START_MONTH, FLU_SEASON_START_DAY);
  const startYear = t >= seasonStartThisYear ? year : year - 1;

  const seasonStart = new Date(startYear, FLU_SEASON_START_MONTH, FLU_SEASON_START_DAY);
  const seasonEnd = new Date(startYear + 1, FLU_SEASON_END_MONTH, FLU_SEASON_END_DAY);
  return { seasonStart, seasonEnd };
}

export function isFluUpToDate(records: VaccineRecord[], today = new Date()): boolean {
  const t = startOfDay(today);
  const { seasonStart, seasonEnd } = getCurrentFluSeasonWindow(t);
  const tenMonthsAgo = addMonths(t, -10);

  return records
    .filter((r) => r.name === "Flu")
    .some((r) => {
      const d = startOfDay(new Date(r.dateISO));
      return d >= seasonStart && d <= seasonEnd && d >= tenMonthsAgo && d <= t;
    });
}

export function isCovidUpToDate(records: VaccineRecord[], today = new Date()): boolean {
  const t = startOfDay(today);
  const twelveMonthsAgo = addMonths(t, -12);
  return records
    .filter((r) => r.name === "COVID")
    .some((r) => {
      const d = startOfDay(new Date(r.dateISO));
      return d >= twelveMonthsAgo && d <= t;
    });
}
