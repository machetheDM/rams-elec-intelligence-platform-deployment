/**
 * Chatbot service API client — pure data-fetching, no React and no markup.
 *
 * See `@/lib/api/triage.ts` for the same pattern and rationale. Calls the
 * same-origin `/api/chatbot` route (`frontend/src/app/api/chatbot/route.ts`),
 * never the chatbot service directly — that endpoint requires a server-only
 * X-API-Key.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSource {
  excerpt: string;
  relevance: number;
}

export interface ChatQueryResult {
  reply: string;
  sources: ChatSource[];
  escalateToHuman: boolean;
  escalationReason: string | null;
}

interface ChatbotApiResponse {
  reply: string;
  sources?: ChatSource[];
  escalate_to_human?: boolean;
  escalation_reason?: string | null;
}

/**
 * Send a message to the RAG chatbot and get a reply.
 *
 * `history` should be prior turns only (not including `message`) — the
 * chatbot service caps it to the last 6 messages server-side regardless.
 */
export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = [],
  customerId?: string
): Promise<ChatQueryResult> {
  const res = await fetch("/api/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_history: history,
      customer_id: customerId ?? null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Chatbot request failed (HTTP ${res.status})`);
  }

  const data: ChatbotApiResponse = await res.json();
  return {
    reply: data.reply,
    sources: data.sources ?? [],
    escalateToHuman: data.escalate_to_human ?? false,
    escalationReason: data.escalation_reason ?? null,
  };
}
