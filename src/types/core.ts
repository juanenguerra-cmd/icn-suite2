export type UnitKey = 'Unit 2' | 'Unit 3' | 'Unit 4' | 'Unassigned';

export type ResidentStatus = 'Active' | 'Discharged' | 'Unknown';

export type Resident = {
  id: string;
  name: string;
  mrn?: string;
  room?: string;
  unit?: UnitKey | string;
  dob?: string;
  payorSource?: string;
  status?: ResidentStatus;
  createdAt: string;
  updatedAt?: string;
  // When discharged, keep last-known location for historical references.
  lockedRoom?: string;
  lockedUnit?: UnitKey | string;
  lastSeenOnCensus?: string | null;
};

export type UnitConfig = {
  unitKey: UnitKey;
  unitName: string;
  capacity: number;
};

export type Config = {
  facilityName: string;
  totalCapacity: number;
  units: UnitConfig[];
  /** Map room-first-digit ("2") -> unitKey ("Unit 2"), plus any other aliases later. */
  unitAliases: Record<string, string>;
};

export type CensusState = {
  rawText: string;
  lastPastedAt: string | null;
  activeResidentIds: string[];
};

export type CensusParsedEntry = {
  name: string;
  mrn: string;
  room: string;
  unit: string;
  dob: string;
  status: string;
  payorSource: string;
  rawCols?: string[];
};

export type CensusHistorySnapshot = {
  date: string; // YYYY-MM-DD
  total: number;
  unitCounts: Record<string, number>;
  updatedAt: string;
};

export type VaccinationStatus = 'Given' | 'Refused' | 'Contraindicated' | 'Unknown';

export type VaccinationEntry = {
  id: string;
  residentId: string;
  residentName: string;
  mrn?: string;
  unit?: string;
  room?: string;
  vaccineType: string; // e.g., Influenza, COVID-19, Pneumococcal
  dateISO: string; // YYYY-MM-DD preferred
  status: VaccinationStatus;
  manufacturer?: string;
  lot?: string;
  route?: string;
  site?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type AntibioticStatus = 'Active' | 'Stopped' | 'Unknown';

export type AntibioticEntry = {
  id: string;
  residentId: string;
  residentName: string;
  mrn?: string;
  unit?: string;
  room?: string;
  medication: string;
  startDateISO: string;
  stopDateISO?: string;
  route?: string;
  dose?: string;
  frequency?: string;
  indication?: string;
  orderedBy?: string;
  status: AntibioticStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type PrecautionType = 'Contact' | 'Droplet' | 'Airborne' | 'Enhanced Barrier' | 'Standard' | 'Unknown';

export type InfectionCase = {
  id: string;
  residentId: string;
  residentName: string;
  mrn?: string;
  unit?: string;
  room?: string;
  syndrome?: string; // UTI, Respiratory, GI, Skin, etc.
  organism?: string;
  onsetDateISO: string;
  labDateISO?: string;
  precautions: PrecautionType;
  resolvedDateISO?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ResidentNote = {
  id: string;
  residentId: string;
  residentName: string;
  mrn?: string;
  unit?: string;
  room?: string;
  dateISO: string; // YYYY-MM-DD (for daily summary)
  text: string;
  createdAt: string;
  updatedAt?: string;
};

export type AppData = {
  version: string;
  config: Config;
  residentsById: Record<string, Resident>;
  census: CensusState;
  censusHistory: CensusHistorySnapshot[];
  vaccinations: VaccinationEntry[];
  antibiotics: AntibioticEntry[];
  infectionCases: InfectionCase[];
  residentNotes: ResidentNote[];
};
