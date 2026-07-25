"use client";

/**
 * Headless chat state hook — state management only, zero markup.
 *
 * Same pattern as `@/hooks/useModelMetrics`: any chat UI (any layout, any
 * styling) can consume `messages`/`sending`/`error`/`sendMessage` without
 * this file ever needing to change. Pairs with `@/lib/api/chatbot`, which
 * does the actual fetch.
 */

import { useCallback, useState } from "react";
import { sendChatMessage, type ChatMessage, type ChatSource } from "@/lib/api/chatbot";

export interface ChatDisplayMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  escalate?: boolean;
}

export interface UseChatbotResult {
  messages: ChatDisplayMessage[];
  sending: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
}

export function useChatbot(initialMessages: ChatDisplayMessage[] = []): UseChatbotResult {
  const [messages, setMessages] = useState<ChatDisplayMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMessage: ChatDisplayMessage = { role: "user", content: trimmed };
      const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMessage]);
      setSending(true);
      setError(null);

      try {
        const result = await sendChatMessage(trimmed, history);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.reply,
            sources: result.sources,
            escalate: result.escalateToHuman,
          },
        ]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Sorry, I'm having trouble connecting. Please try again or call us at +27 71 101 8493.",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending]
  );

  return { messages, sending, error, sendMessage };
}
