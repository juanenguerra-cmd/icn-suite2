// Minimal, dependency-free parsing helpers.
// Designed to be safe: never throws (returns { ok:false, error }).

export type ParseResult<T> =
  | { ok: true; value: T; warnings?: string[] }
  | { ok: false; error: string };

function safeJsonParse(text: string): ParseResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Invalid JSON" };
  }
}

// Tiny CSV parser: handles commas, quotes, and CRLF.
export function parseCsv(text: string): ParseResult<Array<Record<string, string>>> {
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = t.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: "CSV needs a header row and at least one data row." };

  const rows: string[][] = [];
  for (const line of lines) {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    rows.push(out.map((s) => s.trim()));
  }

  const header = rows[0];
  if (header.every((h) => !h)) return { ok: false, error: "CSV header row is empty." };

  const data: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c] || `col_${c + 1}`;
      obj[key] = row[c] ?? "";
    }
    data.push(obj);
  }
  return { ok: true, value: data };
}

export function parseJsonArray(text: string): ParseResult<Array<Record<string, unknown>>> {
  const r = safeJsonParse(text);
  if (!r.ok) return r;
  if (!Array.isArray(r.value)) return { ok: false, error: "JSON must be an array of objects." };
  const arr = r.value as unknown[];
  const bad = arr.find((x) => typeof x !== "object" || x === null || Array.isArray(x));
  if (bad) return { ok: false, error: "JSON array must contain only objects." };
  return { ok: true, value: arr as Array<Record<string, unknown>> };
}

// Lightweight "raw text" -> objects: one item per line.
// Common patterns:
// - "Room-Bed  Resident Name" (2+ spaces split)
// - "Resident Name | Room-Bed | Unit" (pipe)
export function parseLines(text: string): ParseResult<Array<Record<string, string>>> {
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, error: "Paste at least one line." };

  const items: Array<Record<string, string>> = [];
  for (const line of lines) {
    if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      items.push({ col1: parts[0] ?? "", col2: parts[1] ?? "", col3: parts[2] ?? "" });
      continue;
    }

    // Split on 2+ spaces to reduce false positives with names.
    const parts = line.split(/\s{2,}/g).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      items.push({ col1: parts[0], col2: parts.slice(1).join(" ") });
    } else {
      items.push({ col1: line });
    }
  }

  return { ok: true, value: items };
}
