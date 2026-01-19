export type BulkImportPackV1 = {
  version: "icn-bulk-import-v1";
  createdAt: string; // ISO
  source?: string;
  census?: Array<Record<string, unknown>>;
  vaccinations?: Array<Record<string, unknown>>;
  abt?: Array<Record<string, unknown>>;
};
