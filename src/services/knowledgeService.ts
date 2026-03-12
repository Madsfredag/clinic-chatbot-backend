import fs from "node:fs/promises";
import path from "node:path";

type KnowledgeChunk = {
  source: string;
  text: string;
};

function splitIntoChunks(text: string, maxLength = 900): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= maxLength) {
      current = paragraph;
    } else {
      for (let i = 0; i < paragraph.length; i += maxLength) {
        chunks.push(paragraph.slice(i, i + maxLength));
      }
      current = "";
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function scoreChunk(query: string, chunk: string): number {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2);

  const haystack = chunk.toLowerCase();

  let score = 0;

  for (const word of words) {
    if (haystack.includes(word)) {
      score += 1;
    }
  }

  return score;
}

async function readFileIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export async function getRelevantKnowledge(
  clinicId: string,
  userMessage: string
): Promise<KnowledgeChunk[]> {
  const projectRoot = process.cwd();

  const commonPath = path.join(
    projectRoot,
    "src",
    "knowledge",
    "common",
    "dental.md"
  );

  const clinicPath = path.join(
    projectRoot,
    "src",
    "knowledge",
    "clinics",
    clinicId,
    "clinic.md"
  );

  const [commonText, clinicText] = await Promise.all([
    readFileIfExists(commonPath),
    readFileIfExists(clinicPath),
  ]);

  const sources: KnowledgeChunk[] = [];

  if (clinicText) {
    for (const chunk of splitIntoChunks(clinicText)) {
      sources.push({ source: "clinic", text: chunk });
    }
  }

  if (commonText) {
    for (const chunk of splitIntoChunks(commonText)) {
      sources.push({ source: "common", text: chunk });
    }
  }

  return sources
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(userMessage, chunk.text),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ source, text }) => ({ source, text }));
}