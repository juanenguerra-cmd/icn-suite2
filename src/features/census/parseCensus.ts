import type { CensusSnapshot, Resident, UnitId } from "@/types/icn";

function nowISO() {
  return new Date().toISOString();
}

function normalizeName(raw: string) {
  // "DOE, JOHN (LON200002)" -> "DOE, JOHN"
  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return noParens;
}

function extractCode(raw: string) {
  // "(LON200002)" -> "LON200002"
  const m = raw.match(/\(([^)]+)\)/);
  return m?.[1]?.trim() || null;
}

function parseColumns(line: string) {
  // Prefer tabs (reports usually paste with \t). Fallback to 2+ spaces.
  const colsTab = line.split(/\t+/).map((c) => c.trim()).filter(Boolean);
  if (colsTab.length >= 2) return colsTab;

  const colsSpace = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  return colsSpace;
}

function isSkippableLine(line: string) {
  const t = line.trim();
  if (!t) return true;

  // Report header / metadata lines
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
    "Page #",
  ];

  return skipStarts.some((s) => t.startsWith(s));
}

function parseUnitLine(line: string): UnitId | null {
  // Examples:
  // "Unit: Unit 2   Bed Certification: All"
  // "Unit: Unit 3 Bed Certification: All"
  const m = line.match(/^\s*Unit:\s*Unit\s*(\d)\b/i);
  if (!m) return null;
  const u = m[1];
  if (u === "2" || u === "3" || u === "4") return u as UnitId;
  return "UNK";
}

function parseRoomBed(line: string): string | null {
  // Room-bed lines start with something like "251-A"
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

    // Track unit section
    const unitFound = parseUnitLine(line);
    if (unitFound) {
      currentUnit = unitFound;
      continue;
    }

    // Skip non-data lines
    if (isSkippableLine(line)) continue;

    // Only parse actual room-bed rows
    const roomBed = parseRoomBed(line);
    if (!roomBed) continue;

    const cols = parseColumns(line);
    // Expected: [Room-Bed, Resident, DOB, Status, CareLevel, Alt, Payer, RoomRate, BedStatus]
    const residentRaw = cols[1] ?? "";

    // Ignore empty beds
    if (!residentRaw || residentRaw.toUpperCase().includes("EMPTY")) continue;

    const code = extractCode(residentRaw); // LON202332
    const displayName = normalizeName(residentRaw);

    if (!displayName) {
      warnings.push(`Could not parse resident name on row: "${line}"`);
      continue;
    }

    // Prefer stable facility code id if present
    const id = code ? `mrn_${code}` : `room_${roomBed}_${displayName.toLowerCase().replace(/\s+/g, "_")}`;

    residents.push({
      id,
      displayName,
      room: roomBed,
      unit: currentUnit,
      status: "active",
      lastSeenISO: createdISO,
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
    warnings,
  };
}
