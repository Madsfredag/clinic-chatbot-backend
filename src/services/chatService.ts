import type { TenantConfig } from "../config/tenants.js";
import { danishSystemPrompt } from "../prompts/danishSystemPrompt.js";
import { getRelevantKnowledge } from "./knowledgeService.js";
import { generateAiReply } from "./openaiService.js";
import { evaluateSafety } from "./safetyService.js";
import {
  appendConversationMessage,
  getRecentConversation,
} from "./conversationService.js";
import { loadClinicPriceTable } from "./priceService.js";

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

function buildClinicContext(clinic: ClinicConfig, pageUrl: string): string {
  return [
    `Kliniknavn: ${clinic.clinicName}`,
    `Telefon: ${clinic.phone}`,
    `Adresse: ${clinic.address}`,
    `Booking URL: ${clinic.bookingUrl}`,
    `Aktuel side: ${pageUrl}`,
  ].join("\n");
}

function formatPriceTable(table: { headers: string[]; rows: string[][] }): string {
  const headerLine = table.headers.join(" | ");
  const rowLines = table.rows.map((row) => row.join(" | "));

  return ["Prisoversigt fra klinikken:", headerLine, ...rowLines].join("\n");
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

  const priceTable = await loadClinicPriceTable(input.tenant.clinicId);
  const priceContext = priceTable ? formatPriceTable(priceTable) : "";

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