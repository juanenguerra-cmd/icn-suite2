import type { CensusSnapshot, Resident, UnitId } from "@/types/icn";

function nowISO() {
  return new Date().toISOString();
}

function normalizeName(raw: string) {
  // "FINNEGAN, JOHN (LON202332)" -> "FINNEGAN, JOHN"
  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return noParens;
}

function extractCode(raw: string) {
  // "(LON202332)" -> "LON202332"
  const m = raw.match(/\(([^)]+)\)/);
  return m?.[1]?.trim() || null;
}

function parseColumns(line: string) {
  // Prefer tabs (reports usually paste with \t). Fallback to 2+ spaces.
  const colsTab = line
    .split(/\t+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (colsTab.length >= 2) return colsTab;

  return line
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function isSkippableLine(line: string) {
  const t = line.trim();
  if (!t) return true;

  // Report header / metadata lines commonly found in facility census exports.
  const skipStarts = [
    "Date:",
    "Time:",
    "User:",
    "Unit: All",
    "Floor:",
    "Filter out",
    "Exclude census",
    "Room-Bed",
    "Resident",
    "Date of Birth",
    "Resident Status",
    "Care Level",
    "Alt.",
    "Care level",
    "Primary Payer",
    "Room Rate",
    "Bed Status",
    "Daily Census",
    "Page #"
  ];

  return skipStarts.some((s) => t.startsWith(s));
}

function parseUnitLine(line: string): UnitId | null {
  // e.g. "Unit: Unit 2   Bed Certification: All"
  const m = line.match(/^\s*Unit:\s*Unit\s*(\d)\b/i);
  if (!m) return null;
  const u = m[1];
  if (u === "2" || u === "3" || u === "4") return u as UnitId;
  return "UNK";
}

function parseRoomBed(line: string): string | null {
  // Room-bed lines start with something like "251-A" (or "250-A").
  const m = line.trim().match(/^(\d{2,4}-[A-Za-z0-9]+)\b/);
  return m?.[1] ?? null;
}

export function parseCensus(rawText: string): CensusSnapshot {
  const createdISO = nowISO();
  const warnings: string[] = [];
  let currentUnit: UnitId = "UNK";

  const lines = rawText.split(/\r?\n/);
  const residents: Resident[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Track unit sections
    const unitFound = parseUnitLine(line);
    if (unitFound) {
      currentUnit = unitFound;
      continue;
    }

    if (isSkippableLine(line)) continue;

    const roomBed = parseRoomBed(line);
    if (!roomBed) continue;

    const cols = parseColumns(line);
    // Expected columns: [Room-Bed, Resident, DOB, Status, CareLevel, Alt, Payer, RoomRate, BedStatus]
    const residentRaw = cols[1] ?? "";

    // Ignore empty beds
    if (!residentRaw || residentRaw.toUpperCase().includes("EMPTY")) continue;

    const code = extractCode(residentRaw); // LON202332
    const displayName = normalizeName(residentRaw);
    if (!displayName) {
      warnings.push(`Could not parse resident name on row: "${line}"`);
      continue;
    }

    // Prefer stable facility code when present
    const id = code ? `mrn_${code}` : `room_${roomBed}_${displayName.toLowerCase().replace(/\s+/g, "_")}`;

    residents.push({
      id,
      displayName,
      room: roomBed,
      unit: currentUnit,
      status: "active",
      lastSeenISO: createdISO
    });
  }

  if (residents.length === 0) {
    warnings.push("No residents parsed. Verify the pasted census includes Room-Bed rows like 251-A.");
  }

  return {
    id: `c_${createdISO.replace(/[:.]/g, "-")}`,
    createdISO,
    rawText,
    residents,
    warnings
  };
}
