import fs from "node:fs/promises";
import path from "node:path";

export type PriceSheet = {
  headers: string[];
  rows: string[][];
};

export type PriceWorkbook = {
  sheets: Record<string, PriceSheet>;
};

function getClinicDataDir(clinicId: string): string {
  const root = process.cwd();
  return path.join(root, "data", "clinics", clinicId);
}

function getPricesFilePath(clinicId: string): string {
  return path.join(getClinicDataDir(clinicId), "prices.json");
}

function normalizeCell(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function trimTrailingEmptyCells(cells: string[]): string[] {
  let end = cells.length;

  while (end > 0 && cells[end - 1] === "") {
    end -= 1;
  }

  return cells.slice(0, end);
}

function normalizeHeaders(headers: unknown[]): string[] {
  const normalized = headers.map((value, index) => {
    const cell = normalizeCell(value);
    return cell === "" ? `Kolonne ${index + 1}` : cell;
  });

  return trimTrailingEmptyCells(normalized);
}

function normalizeRows(rows: unknown[], headerCount: number): string[][] {
  return rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => normalizeCell(cell)))
    .map((row) => {
      const trimmed = trimTrailingEmptyCells(row);
      const sliced = trimmed.slice(0, headerCount);

      while (sliced.length < headerCount) {
        sliced.push("");
      }

      return sliced;
    })
    .filter((row) => row.some((cell) => cell !== ""));
}

function normalizeSheet(input: unknown): PriceSheet | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const maybeHeaders = (input as { headers?: unknown }).headers;
  const maybeRows = (input as { rows?: unknown }).rows;

  if (!Array.isArray(maybeHeaders) || !Array.isArray(maybeRows)) {
    return null;
  }

  const headers = normalizeHeaders(maybeHeaders);

  if (headers.length === 0) {
    return null;
  }

  const rows = normalizeRows(maybeRows, headers.length);

  return {
    headers,
    rows,
  };
}

export function normalizePriceWorkbook(input: unknown): PriceWorkbook | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const maybeSheets = (input as { sheets?: unknown }).sheets;

  if (typeof maybeSheets !== "object" || maybeSheets === null) {
    return null;
  }

  const sheets: Record<string, PriceSheet> = {};

  for (const [key, value] of Object.entries(maybeSheets as Record<string, unknown>)) {
    const trimmedKey = key.trim();

    if (trimmedKey === "") {
      continue;
    }

    const normalizedSheet = normalizeSheet(value);

    if (normalizedSheet) {
      sheets[trimmedKey] = normalizedSheet;
    }
  }

  if (Object.keys(sheets).length === 0) {
    return null;
  }

  return { sheets };
}

export async function saveClinicPriceWorkbook(
  clinicId: string,
  workbook: PriceWorkbook
): Promise<void> {
  const dir = getClinicDataDir(clinicId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = getPricesFilePath(clinicId);
  await fs.writeFile(filePath, JSON.stringify(workbook, null, 2), "utf8");
}

export async function loadClinicPriceWorkbook(
  clinicId: string
): Promise<PriceWorkbook | null> {
  const filePath = getPricesFilePath(clinicId);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return normalizePriceWorkbook(parsed);
  } catch {
    return null;
  }
}