"use client";

import { useRef, useState, useEffect } from "react";
import { useChatbot } from "@/hooks/useChatbot";

export default function ChatbotPage() {
  const { messages, sending, sendMessage } = useChatbot([
    {
      role: "assistant",
      content:
        "Hello! I'm the Rams @Elec AI Assistant. I can help with:\n\n" +
        "• Electrical compliance and safety questions\n" +
        "• Cold room and HVAC maintenance advice\n" +
        "• Load-shedding protection recommendations\n" +
        "• Service pricing ranges\n\n" +
        "How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sending) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
        <p className="text-industrial-400 mt-1">
          Ask me anything about electrical, refrigeration, or load-shedding.
        </p>
      </div>

      {/* Chat area */}
      <div className="bg-industrial-900 rounded-xl border border-industrial-800 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-brand-500 text-white"
                  : msg.escalate
                    ? "bg-red-500/10 border border-red-500/20 text-white"
                    : "bg-industrial-800 text-white"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-industrial-700">
                    <p className="text-xs text-industrial-500 mb-1">Sources:</p>
                    {msg.sources.slice(0, 2).map((s, j) => (
                      <p key={j} className="text-xs text-industrial-400 italic">
                        &ldquo;{s.excerpt}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-industrial-800 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-industrial-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-industrial-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-industrial-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-industrial-800 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about SANS compliance, cold room maintenance, load shedding..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-800 text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-industrial-700 disabled:text-industrial-500 text-white text-sm font-semibold rounded-xl transition-all"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-industrial-500 mt-2">
            For emergencies, call +27 71 101 8493. This AI provides general guidance only.
          </p>
        </div>
      </div>
    </div>
  );
}
