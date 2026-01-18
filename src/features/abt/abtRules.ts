import type { AntibioticRecord } from "@/types/icn";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysOnTherapy(startDateISO: string, today = new Date()): number | null {
  const s = new Date(startDateISO);
  if (Number.isNaN(s.getTime())) return null;

  const a = startOfDay(s);
  const t = startOfDay(today);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = t.getTime() - a.getTime();
  // Day count is inclusive: start day = Day 1
  const d = Math.floor(diffMs / msPerDay) + 1;
  return d < 1 ? 1 : d;
}

export function abxFlags(record: AntibioticRecord, today = new Date()) {
  const isActive = record.status === "active" && !record.stopDateISO;
  const dot = daysOnTherapy(record.startDateISO, today);
  const day = dot ?? 0;

  // Basic stewardship flags (tweakable later)
  const reviewDue = isActive && day >= 3; // 72h-ish
  const overdue = isActive && day >= 7; // one-week reassess

  return { isActive, day, reviewDue, overdue };
}

export function summarizeResidentAbx(records: AntibioticRecord[], today = new Date()) {
  const active = records.filter((r) => r.status === "active" && !r.stopDateISO);
  let reviewDue = 0;
  let overdue = 0;
  for (const r of active) {
    const f = abxFlags(r, today);
    if (f.reviewDue) reviewDue++;
    if (f.overdue) overdue++;
  }
  return { activeCount: active.length, reviewDueCount: reviewDue, overdueCount: overdue };
}
