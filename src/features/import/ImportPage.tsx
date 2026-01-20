// src/features/import/ImportPage.tsx
import * as React from "react";
import { latestBackupKey } from "../shared/persist";
import { applyPacksToPersist, parseMaybeJsonText, readQueue, writeQueue, type IcnBulkPackV1 } from "./importUtils";

type QueueItem = { id: string; queuedAt?: string; pack: IcnBulkPackV1 };

function fmt(iso?: string) {
  if (!iso) return "";
  return iso.replace("T", " ").replace("Z", "");
}

export default function ImportPage() {
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [preview, setPreview] = React.useState<string>("");
  const [log, setLog] = React.useState<string>("");
  const [paste, setPaste] = React.useState<string>("");
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const refresh = React.useCallback(() => {
    const q = readQueue() as QueueItem[];
    setQueue(q);
    setLog((l) => `Loaded ${q.length} queued pack(s).\n` + l);
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  function selectAll() {
    const m: Record<string, boolean> = {};
    queue.forEach((q) => (m[q.id] = true));
    setSelected(m);
  }
  function selectNone() { setSelected({}); }

  function showPreview(item: QueueItem) {
    const pk = item.pack as any;
    const sample: any[] = [];
    if (Array.isArray(pk.datasets)) {
      pk.datasets.forEach((d: any) =>
        Array.isArray(d.records) ? d.records.slice(0, 2).forEach((r: any) => sample.push({ dataset: d.dataset, ...r })) : null
      );
    } else if (Array.isArray(pk.records)) {
      pk.records.slice(0, 6).forEach((r: any) => sample.push({ dataset: pk.dataset, ...r }));
    }
    setPreview(JSON.stringify(sample.slice(0, 10), null, 2));
  }

  function applySelected() {
    const packs = queue.filter((q) => selected[q.id]).map((q) => q.pack);
    if (!packs.length) { setLog((l) => `No queue items selected.\n` + l); return; }
    try {
      const res = applyPacksToPersist(packs);
      const remaining = queue.filter((q) => !selected[q.id]);
      writeQueue(remaining);
      setSelected({});
      setQueue(remaining);
      setLog((l) => [
        `APPLIED OK`,
        `Persist key: ${res.persistKey}`,
        `Backup key: ${res.backupKey}`,
        `Dedup dropped: ${res.dropped}`,
        ...res.applied.map((a) => `- ${a.dataset}: +${a.added}`),
        ``,
      ].join("\n") + l);
    } catch (e: any) {
      setLog((l) => `ERROR: ${e?.message || String(e)}\n` + l);
    }
  }

  function applyPasted() {
    const obj = parseMaybeJsonText(paste);
    if (!obj) { setLog((l) => `Paste is not valid JSON.\n` + l); return; }
    try {
      const res = applyPacksToPersist([obj]);
      setLog((l) => [
        `APPLIED PASTE OK`,
        `Persist key: ${res.persistKey}`,
        `Backup key: ${res.backupKey}`,
        `Dedup dropped: ${res.dropped}`,
        ...res.applied.map((a) => `- ${a.dataset}: +${a.added}`),
        ``,
      ].join("\n") + l);
    } catch (e: any) {
      setLog((l) => `ERROR: ${e?.message || String(e)}\n` + l);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const packs: any[] = [];
    for (const f of Array.from(files)) {
      const text = await f.text();
      const obj = parseMaybeJsonText(text);
      if (obj) packs.push(obj);
      else setLog((l) => `Could not parse JSON in: ${f.name}\n` + l);
    }
    if (!packs.length) return;
    try {
      const res = applyPacksToPersist(packs);
      setLog((l) => [
        `APPLIED FILES OK (${packs.length})`,
        `Persist key: ${res.persistKey}`,
        `Backup key: ${res.backupKey}`,
        `Dedup dropped: ${res.dropped}`,
        ...res.applied.map((a) => `- ${a.dataset}: +${a.added}`),
        ``,
      ].join("\n") + l);
    } catch (e: any) {
      setLog((l) => `ERROR: ${e?.message || String(e)}\n` + l);
    }
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="rounded-2xl border bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Import</h1>
            <p className="text-sm text-slate-600">Apply queued packs (or pasted/uploaded JSON) with backup + dedup.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border px-4 py-2 text-sm" onClick={refresh}>Refresh</button>
            <button className="rounded-full border px-4 py-2 text-sm" onClick={selectAll}>Select all</button>
            <button className="rounded-full border px-4 py-2 text-sm" onClick={selectNone}>Select none</button>
            <button className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm" onClick={applySelected}>Apply selected</button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border px-3 py-1 bg-white">Queue: <span className="font-mono">icn_import_queue_v1</span></span>
          <span className="rounded-full border px-3 py-1 bg-white">Latest backup: <span className="font-mono">{latestBackupKey() || "—"}</span></span>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold mb-2">Queued packs</div>
            <div className="rounded-xl border bg-white max-h-[420px] overflow-auto p-2">
              {queue.length === 0 ? (
                <div className="text-sm text-slate-500 p-2">Queue is empty. Use Ops Pro to queue packs.</div>
              ) : (
                queue.map((q) => {
                  const ds = (q.pack as any)?.dataset ?? ((q.pack as any)?.datasets ? "multi" : "unknown");
                  const rc = (q.pack as any)?.recordCount ?? ((q.pack as any)?.records ? (q.pack as any).records.length : 0);
                  return (
                    <div key={q.id} className="flex gap-2 items-start rounded-xl border p-2 mb-2 bg-white">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!!selected[q.id]}
                        onChange={(e) => setSelected((s) => ({ ...s, [q.id]: e.target.checked }))}
                      />
                      <div className="flex-1">
                        <div className="text-xs"><span className="font-mono">{String(ds)}</span> — {rc} record(s)</div>
                        <div className="text-[11px] text-slate-500">{fmt(q.queuedAt)}</div>
                      </div>
                      <button className="rounded-full border px-3 py-1 text-xs" onClick={() => showPreview(q)}>Preview</button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => fileRef.current?.click()}>Apply JSON file(s)</button>
              <input ref={fileRef} type="file" className="hidden" multiple accept="application/json,.json,.txt" onChange={(e) => handleFiles(e.target.files)} />
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => { writeQueue([]); setQueue([]); setSelected({}); setLog((l) => `Queue cleared.\n` + l); }}>
                Clear queue
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Preview</div>
            <textarea className="w-full min-h-[180px] rounded-xl border p-3 font-mono text-xs" readOnly value={preview} placeholder="Click Preview on a queued pack..." />

            <div className="mt-4 text-sm font-semibold mb-2">Paste pack JSON</div>
            <textarea className="w-full min-h-[160px] rounded-xl border p-3 font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"version":"icn-bulk-import-v1", ...}' />
            <div className="mt-2 flex gap-2">
              <button className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm" onClick={applyPasted}>Apply pasted</button>
              <button className="rounded-full border px-4 py-2 text-sm" onClick={() => setPaste("")}>Clear</button>
            </div>

            <div className="mt-4 text-sm font-semibold mb-2">Log</div>
            <textarea className="w-full min-h-[180px] rounded-xl border p-3 font-mono text-xs" readOnly value={log} />
          </div>
        </div>
      </div>
    </div>
  );
}
