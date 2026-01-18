export type UnitId = "2" | "3" | "4" | "UNK";

export type ResidentStatus = "active" | "discharged";

export interface Resident {
  id: string;                 // stable internal id
  displayName: string;        // "Last, First" or "First Last"
  room?: string;
  unit: UnitId;
  status: ResidentStatus;
  lastSeenISO: string;        // when last present in a census
}

export interface CensusSnapshot {
  id: string;
  createdISO: string;
  rawText: string;
  residents: Resident[];
  warnings: string[];
}

export type VaccineName =
  | "COVID"
  | "Flu"
  | "Pneumo"
  | "RSV"
  | "Shingles"
  | "Tdap"
  | "Other";

export interface VaccineRecord {
  id: string;
  residentId: string;
  name: VaccineName;
  nameOther?: string;
  dateISO: string; // YYYY-MM-DD
  notes?: string;
  createdISO: string;
}

export interface ICNState {
  schemaVersion: number;
  residentsById: Record<string, Resident>;
  censusHistory: CensusSnapshot[];

  // Vaccinations
  vaccinesByResidentId: Record<string, VaccineRecord[]>;

  importState: (data: unknown) => void;
  exportState: () => unknown;

  applyCensus: (snapshot: CensusSnapshot) => void;

  addVaccinesBatch: (
    residentId: string,
    entries: Array<Pick<VaccineRecord, "name" | "nameOther" | "dateISO" | "notes">>
  ) => void;
  deleteVaccine: (residentId: string, vaccineId: string) => void;
  resetAll: () => void;
}
