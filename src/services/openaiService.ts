import { env } from "../config/env.js";

type ConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

type GenerateReplyInput = {
  systemPrompt: string;
  clinicContext: string;
  knowledgeContext: string;
  conversationHistory: ConversationMessage[];
  userMessage: string;
};

function extractOutputText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof (payload as { output_text?: unknown }).output_text === "string"
  ) {
    return (payload as { output_text: string }).output_text.trim();
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { output?: unknown[] }).output)
  ) {
    const output = (payload as { output: unknown[] }).output;

    const texts: string[] = [];

    for (const item of output) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const content = (item as { content?: unknown[] }).content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          texts.push((part as { text: string }).text);
        }
      }
    }

    return texts.join("\n").trim();
  }

  return "";
}

export async function generateAiReply(input: GenerateReplyInput): Promise<string> {
  const historyMessages = input.conversationHistory.map((message) => ({
    role: message.role,
    content: [
      {
        type: "input_text" as const,
        text: message.text,
      },
    ],
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: input.systemPrompt,
            },
          ],
        },
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text:
                `KLINIKKONTEKST:\n${input.clinicContext}\n\n` +
                `VIDENSKONTEKST:\n${input.knowledgeContext}\n\n` +
                `Regler:\n` +
                `- Brug kun information, der er understøttet af konteksten.\n` +
                `- Hvis konteksten ikke giver et sikkert svar, sig det tydeligt.\n` +
                `- Svar altid på dansk.\n`,
            },
          ],
        },
        ...historyMessages,
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input.userMessage,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const text = extractOutputText(payload);

  if (!text) {
    throw new Error("OpenAI returned an empty reply.");
  }

  return text;
}