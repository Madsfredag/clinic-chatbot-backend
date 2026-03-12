import fs from "node:fs/promises";
import path from "node:path";

export type PriceTable = {
  headers: string[];
  rows: string[][];
};

function getClinicDataDir(clinicId: string): string {
  const root = process.cwd();
  return path.join(root, "data", "clinics", clinicId);
}

function getPricesFilePath(clinicId: string): string {
  return path.join(getClinicDataDir(clinicId), "prices.json");
}

export async function saveClinicPriceTable(
  clinicId: string,
  table: PriceTable
): Promise<void> {
  const dir = getClinicDataDir(clinicId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = getPricesFilePath(clinicId);
  await fs.writeFile(filePath, JSON.stringify(table, null, 2), "utf8");
}

export async function loadClinicPriceTable(
  clinicId: string
): Promise<PriceTable | null> {
  const filePath = getPricesFilePath(clinicId);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const maybeHeaders = (parsed as { headers?: unknown }).headers;
    const maybeRows = (parsed as { rows?: unknown }).rows;

    if (!Array.isArray(maybeHeaders) || !Array.isArray(maybeRows)) {
      return null;
    }

    const headers = maybeHeaders.filter(
      (value): value is string => typeof value === "string"
    );

    const rows = maybeRows
      .filter((row): row is unknown[] => Array.isArray(row))
      .map((row) =>
        row.map((cell) => (typeof cell === "string" ? cell : String(cell)))
      );

    return {
      headers,
      rows,
    };
  } catch {
    return null;
  }
}

function parseCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

export function parseCsv(csvContent: string): PriceTable {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const firstLine = lines.find((line) => line.length > 0);

  if (typeof firstLine !== "string") {
    throw new Error("CSV file is empty");
  }

  const headers = parseCsvLine(firstLine);

  const rows: string[][] = [];
  let isFirstDataLine = true;

  for (const line of lines) {
    if (isFirstDataLine) {
      isFirstDataLine = false;
      continue;
    }

    rows.push(parseCsvLine(line));
  }

  return {
    headers,
    rows,
  };
}