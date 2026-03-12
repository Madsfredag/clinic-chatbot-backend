type ConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

const MAX_MESSAGES_PER_SESSION = 4;
const conversations = new Map<string, ConversationMessage[]>();

export function getRecentConversation(
  sessionId: string
): ConversationMessage[] {
  return conversations.get(sessionId) ?? [];
}

export function appendConversationMessage(
  sessionId: string,
  message: ConversationMessage
): void {
  const current = conversations.get(sessionId) ?? [];
  const next = [...current, message].slice(-MAX_MESSAGES_PER_SESSION);
  conversations.set(sessionId, next);
}