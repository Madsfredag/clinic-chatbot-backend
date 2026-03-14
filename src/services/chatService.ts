import type { TenantConfig } from "../config/tenants.js";
import { danishSystemPrompt } from "../prompts/danishSystemPrompt.js";
import { getRelevantKnowledge } from "./knowledgeService.js";
import { generateAiReply } from "./openaiService.js";
import { evaluateSafety } from "./safetyService.js";
import {
  appendConversationMessage,
  getRecentConversation,
} from "./conversationService.js";
import {
  loadClinicPriceWorkbook,
  type PriceSheet,
  type PriceWorkbook,
} from "./priceService.js";

type ClinicConfig = {
  clinicName: string;
  phone: string;
  address: string;
  bookingUrl: string;
};

type ChatInput = {
  tenant: TenantConfig;
  clinic: ClinicConfig;
  message: string;
  sessionId: string;
  pageUrl: string;
};

type ScoredRow = {
  row: string[];
  score: number;
};

function buildClinicContext(clinic: ClinicConfig, pageUrl: string): string {
  return [
    `Kliniknavn: ${clinic.clinicName}`,
    `Telefon: ${clinic.phone}`,
    `Adresse: ${clinic.address}`,
    `Booking URL: ${clinic.bookingUrl}`,
    `Aktuel side: ${pageUrl}`,
  ].join("\n");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function isPriceQuestion(message: string): boolean {
  const normalized = normalizeText(message);

  const triggers = [
    "pris",
    "priser",
    "koster",
    "koste",
    "koster det",
    "hvad koster",
    "hvad er prisen",
    "betaling",
    "egenbetaling",
    "tilskud",
    "danmark",
    "kr",
    "kroner",
    "honorar",
    "udgift",
    "konsultation pris",
    "tandrensning pris",
    "rontgen pris",
  ];

  return triggers.some((trigger) => normalized.includes(trigger));
}

function wantsDanmarkContext(message: string): boolean {
  const normalized = normalizeText(message);

  return (
    normalized.includes("danmark") ||
    normalized.includes("tilskud") ||
    normalized.includes("sygeforsikring")
  );
}

function buildQueryTerms(message: string): string[] {
  const baseTokens = tokenize(message);

  const expanded = new Set<string>(baseTokens);

  const synonymGroups: Array<{ match: string[]; add: string[] }> = [
    {
      match: ["rensning", "tandrensning"],
      add: ["tandrensning", "rensning"],
    },
    {
      match: ["rontgen", "røntgen", "xray"],
      add: ["rontgen", "røntgen", "bitewings", "panoramarontgen"],
    },
    {
      match: ["undersogelse", "undersøgelse", "tjek"],
      add: ["undersogelse", "undersøgelse", "diagnostisk", "status", "fokuseret"],
    },
    {
      match: ["fyldning", "plast"],
      add: ["fyldning", "plast"],
    },
    {
      match: ["paradentose", "parodontose", "tandrodsrensning"],
      add: ["paradentose", "parodontose", "tandrodsrensning", "parodontal"],
    },
    {
      match: ["udtraekning", "udtrækning", "traekke", "trække"],
      add: ["udtraekning", "udtrækning", "tandudtrakning"],
    },
  ];

  for (const group of synonymGroups) {
    if (group.match.some((term) => expanded.has(term))) {
      for (const term of group.add) {
        expanded.add(term);
      }
    }
  }

  return Array.from(expanded);
}

function scoreRow(row: string[], queryTerms: string[]): number {
  const joined = normalizeText(row.join(" "));
  let score = 0;

  for (const term of queryTerms) {
    if (!term) {
      continue;
    }

    if (joined.includes(term)) {
      score += 3;
    }

    const words = joined.split(" ");
    if (words.includes(term)) {
      score += 4;
    }
  }

  if (joined.includes("alle")) {
    score += 1;
  }

  return score;
}

function findBestRows(sheet: PriceSheet, message: string, limit: number): string[][] {
  const queryTerms = buildQueryTerms(message);

  if (queryTerms.length === 0) {
    return [];
  }

  const scoredRows: ScoredRow[] = sheet.rows
    .map((row) => ({
      row,
      score: scoreRow(row, queryTerms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const unique: string[][] = [];
  const seen = new Set<string>();

  for (const item of scoredRows) {
    const key = item.row.join("||");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item.row);

    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

function formatRows(title: string, headers: string[], rows: string[][]): string {
  const lines = rows.map((row) =>
    headers.map((header, index) => `${header}: ${row[index] ?? ""}`).join(" | ")
  );

  return [`${title}:`, ...lines].join("\n");
}

function buildRelevantPriceContext(
  workbook: PriceWorkbook | null,
  message: string
): string {
  if (!workbook || !isPriceQuestion(message)) {
    return "";
  }

  const sections: string[] = [];
  const behandlinger = workbook.sheets.behandlinger;

  if (behandlinger) {
    const bestRows = findBestRows(behandlinger, message, 5);

    if (bestRows.length > 0) {
      sections.push(
        formatRows(
          "Relevante prisrækker fra arket Behandlinger",
          behandlinger.headers,
          bestRows
        )
      );
    }
  }

  if (wantsDanmarkContext(message) && workbook.sheets.danmarkEkstraTilskud) {
    const danmarkSheet = workbook.sheets.danmarkEkstraTilskud;
    const bestDanmarkRows = findBestRows(danmarkSheet, message, 3);

    if (bestDanmarkRows.length > 0) {
      sections.push(
        formatRows(
          "Relevante rækker fra arket Danmark ekstra tilskud",
          danmarkSheet.headers,
          bestDanmarkRows
        )
      );
    }
  }

  if (sections.length === 0) {
    return [
      "Prisvejledning:",
      "Brug kun prisoplysninger hvis de er tydeligt understøttet af de fundne rækker.",
      "Hvis der ikke findes en tydelig matchende prisrække, så sig at patienten bør kontakte klinikken for en præcis pris.",
    ].join("\n");
  }

  return [
    "Prisvejledning:",
    "Svar kun med priser der tydeligt fremgår af de relevante rækker nedenfor.",
    "Hvis spørgsmålet afhænger af alder, tilskud eller specifik behandlingstype, så nævn det tydeligt.",
    "Hvis der er usikkerhed om præcis behandling eller pris, så bed patienten kontakte klinikken.",
    "",
    ...sections,
  ].join("\n");
}

export async function createChatReply(input: ChatInput): Promise<string> {
  const safety = evaluateSafety(
    input.message,
    input.clinic.clinicName,
    input.clinic.phone
  );

  if (safety.shouldEscalate && safety.escalationMessage) {
    return safety.escalationMessage;
  }

  const knowledgeChunks = await getRelevantKnowledge(
    input.tenant.clinicId,
    input.message
  );

  const knowledgeContext = knowledgeChunks.length
    ? knowledgeChunks
        .map(
          (chunk, index) =>
            `[Kilde ${index + 1} - ${chunk.source}]\n${chunk.text}`
        )
        .join("\n\n")
    : "Ingen ekstra viden fundet.";

  const priceWorkbook = await loadClinicPriceWorkbook(input.tenant.clinicId);
  const priceContext = buildRelevantPriceContext(priceWorkbook, input.message);

  const conversationHistory = getRecentConversation(input.sessionId);

  const reply = await generateAiReply({
    systemPrompt: danishSystemPrompt,
    clinicContext: buildClinicContext(input.clinic, input.pageUrl),
    knowledgeContext: [knowledgeContext, priceContext].filter(Boolean).join("\n\n"),
    conversationHistory,
    userMessage: input.message,
  });

  appendConversationMessage(input.sessionId, {
    role: "user",
    text: input.message,
  });

  appendConversationMessage(input.sessionId, {
    role: "assistant",
    text: reply,
  });

  return reply;
}