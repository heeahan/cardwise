export function parseCsvDocument(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"' && quoted && input[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = "";
    } else value += char;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function normalizeImportDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)) ? null : trimmed;
  const parsed = Date.parse(trimmed); return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}
