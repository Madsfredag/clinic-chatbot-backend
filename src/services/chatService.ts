import type { TenantConfig } from "../config/tenants.js";
import { danishSystemPrompt } from "../prompts/danishSystemPrompt.js";
import { getRelevantKnowledge } from "./knowledgeService.js";
import { generateAiReply } from "./openaiService.js";
import { evaluateSafety } from "./safetyService.js";

type ChatInput = {
  tenant: TenantConfig;
  message: string;
  pageUrl: string;
};

function buildClinicContext(tenant: TenantConfig, pageUrl: string): string {
  return [
    `Kliniknavn: ${tenant.clinicName}`,
    `Telefon: ${tenant.phone || "Ikke angivet"}`,
    `Adresse: ${tenant.address || "Ikke angivet"}`,
    `Booking URL: ${tenant.bookingUrl || "Ikke angivet"}`,
    `Aktuel side: ${pageUrl}`,
  ].join("\n");
}

export async function createChatReply(input: ChatInput): Promise<string> {
  const safety = evaluateSafety(input.message, input.tenant.clinicName, input.tenant.phone);

  if (safety.shouldEscalate && safety.escalationMessage) {
    return safety.escalationMessage;
  }

  const knowledgeChunks = await getRelevantKnowledge(input.tenant, input.message);

  const knowledgeContext = knowledgeChunks.length
    ? knowledgeChunks.map((chunk, index) => `[Kilde ${index + 1} - ${chunk.source}]\n${chunk.text}`).join("\n\n")
    : "Ingen ekstra viden fundet.";

  return generateAiReply({
    systemPrompt: danishSystemPrompt,
    clinicContext: buildClinicContext(input.tenant, input.pageUrl),
    knowledgeContext,
    userMessage: input.message,
  });
}