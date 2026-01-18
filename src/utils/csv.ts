export function toCsv(rows: Record<string, any>[], columns?: string[]): string {
  const cols = columns && columns.length ? columns : Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    // Escape quotes and wrap if needed
    const needs = /[\n\r,"]/.test(s);
    const q = s.replace(/"/g, '""');
    return needs ? `"${q}"` : q;
  };
  const head = cols.map(esc).join(',');
  const body = rows.map((r) => cols.map((c) => esc((r as any)[c])).join(',')).join('\n');
  return head + (body ? '\n' + body : '') + '\n';
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
