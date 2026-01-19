import type { CensusSnapshot, Resident, UnitId } from "@/types/icn";

function idFromResident(displayName: string, room?: string) {
  // Stable-ish ID: name + room (upgrade later with facility identifiers)
  const base = `${displayName.trim().toLowerCase()}|${(room ?? "").trim().toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `r_${h.toString(16)}`;
}

function inferUnit(room?: string): UnitId {
  // Placeholder heuristic. Replace with your real room→unit mapping rules.
  if (!room) return "UNK";
  const n = parseInt(room.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n)) return "UNK";
  if (n >= 200 && n < 300) return "2";
  if (n >= 300 && n < 400) return "3";
  if (n >= 400 && n < 500) return "4";
  return "UNK";
}

export function parseCensus(rawText: string): CensusSnapshot {
  const createdISO = new Date().toISOString();
  const warnings: string[] = [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const residents: Resident[] = [];

  for (const line of lines) {
    // Supported initial patterns:
    // "Last, First | 212A"
    // "First Last - 312"
    const parts = line.split("|").map((p) => p.trim());
    let left = parts[0] ?? "";
    let room = parts[1]?.trim();

    if (!room) {
      const m = line.match(/(.+?)\s+[-–—]\s*(\S+)$/);
      if (m) {
        left = m[1].trim();
        room = m[2].trim();
      }
    }

    const displayName = left.replace(/\s+/g, " ").trim();
    if (!displayName || displayName.length < 3) {
      warnings.push(`Skipped unreadable line: "${line}"`);
      continue;
    }

    const unit = inferUnit(room);
    if (unit === "UNK") warnings.push(`Could not infer unit for "${displayName}" (room: "${room ?? "?"}")`);

    const id = idFromResident(displayName, room);

    residents.push({
      id,
      displayName,
      room,
      unit,
      status: "active",
      lastSeenISO: createdISO
    });
  }

  if (residents.length === 0) warnings.push("No residents parsed. Check formatting of the census paste.");

  return {
    id: `c_${createdISO.replace(/[:.]/g, "-")}`,
    createdISO,
    rawText,
    residents,
    warnings
  };
}
