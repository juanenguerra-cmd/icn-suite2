import * as React from "react";
import { parseCsv, parseJsonArray, parseLines } from "./parse";
import type { BulkImportPackV1 } from "./types";

type Target = "census" | "vaccinations" | "abt";

type Format = "auto" | "json" | "csv" | "lines";

function nowIso() {
  return new Date().toISOString();
}

function guessFormat(text: string): Exclude<Format, "auto"> {
  const t = text.trim();
  if (!t) return "lines";
  if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) return "json";
  if (t.includes(",") && t.split("\n")[0]?.includes(",")) return "csv";
  return "lines";
}

export function ImportCenter() {
  const [target, setTarget] = React.useState<Target>("census");
  const [format, setFormat] = React.useState<Format>("auto");
  const [source, setSource] = React.useState<string>("");
  const [text, setText] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");
  const [pack, setPack] = React.useState<BulkImportPackV1 | null>(null);

  const effectiveFormat = React.useMemo(() => {
    if (format === "auto") return guessFormat(text);
    return format;
  }, [format, text]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      setStatus(`Loaded file: ${file.name}`);
    };
    reader.readAsText(file);
  }

  function buildPack() {
    const t = text.trim();
    if (!t) {
      setStatus("Paste data or upload a file first.");
      setPack(null);
      return;
    }

    const createdAt = nowIso();
    const base: BulkImportPackV1 = {
      version: "icn-bulk-import-v1",
      createdAt,
      source: source.trim() || undefined,
    };

    let parsed: any[] | null = null;
    let parseError: string | null = null;

    if (effectiveFormat === "json") {
      const r = parseJsonArray(t);
      if (!r.ok) parseError = r.error;
      else parsed = r.value;
    } else if (effectiveFormat === "csv") {
      const r = parseCsv(t);
      if (!r.ok) parseError = r.error;
      else parsed = r.value;
    } else {
      const r = parseLines(t);
      if (!r.ok) parseError = r.error;
      else parsed = r.value;
    }

    if (parseError || !parsed) {
      setStatus(`Parse failed: ${parseError ?? "Unknown error"}`);
      setPack(null);
      return;
    }

    const out: BulkImportPackV1 = {
      ...base,
      [target]: parsed,
    } as BulkImportPackV1;

    setPack(out);
    setStatus(`OK: ${parsed.length} record(s) parsed for ${target}.`);
  }

  async function copyJson() {
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
      setStatus("Copied import pack JSON to clipboard.");
    } catch {
      setStatus("Copy failed (clipboard blocked). You can still manually select/copy the JSON.");
    }
  }

  return (
    <div className="sip-card p-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">Bulk Import Center</div>
          <span className="sip-chip">v1 pack</span>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <label className="text-xs">
            Target
            <select
              className="mt-1 w-full rounded-full border px-3 py-2"
              value={target}
              onChange={(e) => setTarget(e.target.value as Target)}
            >
              <option value="census">Census</option>
              <option value="vaccinations">Vaccinations</option>
              <option value="abt">ABT</option>
            </select>
          </label>

          <label className="text-xs">
            Format
            <select
              className="mt-1 w-full rounded-full border px-3 py-2"
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
            >
              <option value="auto">Auto-detect</option>
              <option value="json">JSON array</option>
              <option value="csv">CSV</option>
              <option value="lines">Raw lines</option>
            </select>
          </label>

          <label className="text-xs">
            Source note (optional)
            <input
              className="mt-1 w-full rounded-full border px-3 py-2"
              placeholder="e.g., Jan 2026 census export"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs">
            Upload
            <input
              className="ml-2 text-xs"
              type="file"
              accept=".json,.csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          <button
            className="rounded-full border px-3 py-2 text-sm"
            onClick={buildPack}
          >
            Build Import Pack
          </button>
          <button
            className="rounded-full border px-3 py-2 text-sm"
            onClick={copyJson}
            disabled={!pack}
            title={!pack ? "Build a pack first" : "Copy JSON"}
          >
            Copy JSON
          </button>
        </div>

        <label className="text-xs">
          Paste data
          <textarea
            className="mt-1 h-48 w-full rounded-xl border p-3 font-mono text-xs"
            placeholder={`Paste CSV, a JSON array, or raw lines here.\n\nExamples:\n- CSV: room,name,unit\n- JSON: [{\"room\":\"201A\",\"name\":\"Jane Doe\"}]\n- Lines: 201A  Jane Doe`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <div className="text-xs text-gray-600">
          Detected format: <span className="font-semibold">{effectiveFormat}</span>
        </div>

        {status ? (
          <div className="rounded-xl border p-2 text-sm">{status}</div>
        ) : null}

        {pack ? (
          <div className="rounded-xl border p-2">
            <div className="mb-2 text-xs font-semibold">Generated Import Pack JSON</div>
            <pre className="max-h-64 overflow-auto rounded-xl bg-white/60 p-2 text-xs">
              {JSON.stringify(pack, null, 2)}
            </pre>
            <div className="mt-2 text-xs text-gray-600">
              Next step: wire an “Apply Pack” button to your store once your schemas are confirmed.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
