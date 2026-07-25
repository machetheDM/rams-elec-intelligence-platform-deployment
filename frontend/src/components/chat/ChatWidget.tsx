"use client";

import { useEffect, useRef, useState } from "react";
import { useChatbot } from "@/hooks/useChatbot";

/**
 * Floating RAG chat widget — presentation only.
 *
 * All message state and transport lives in useChatbot; this component
 * renders whatever the hook exposes and calls sendMessage(). Keyboard
 * accessible: Escape closes, focus moves to the input on open.
 */

const GREETING = {
  role: "assistant" as const,
  content:
    "Hello! I'm the Rams @Elec AI Assistant. I can help with electrical compliance, cold room and HVAC maintenance, load-shedding protection, and service pricing ranges.\n\nWhat can I help you with?",
};

const SUGGESTIONS = [
  "What is SANS 10142?",
  "How do I protect a cold room during load shedding?",
  "What does a compliance audit cost?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sending, sendMessage } = useChatbot([GREETING]);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const submit = (text: string) => {
    if (!text.trim() || sending) return;
    sendMessage(text);
    setInput("");
  };

  return (
    <>
      {/* ---- Launcher ---- */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-industrial-950 shadow-lg shadow-brand-500/25 transition-all duration-300 hover:bg-brand-400 hover:shadow-brand-500/40 active:scale-95 lg:bottom-8 lg:right-8"
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>

      {/* ---- Panel ---- */}
      {open && (
        <div
          role="dialog"
          aria-label="Rams @Elec AI Assistant"
          className="animate-slide-up fixed bottom-24 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-industrial-800 bg-industrial-950 shadow-2xl shadow-black/60 lg:bottom-28 lg:right-8"
          style={{ height: "min(32rem, calc(100vh - 10rem))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-industrial-800 bg-industrial-900 px-4 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">AI Assistant</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-industrial-500">
                SANS 10142 · Cold Room · Load Shedding
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-brand-500 text-industrial-950"
                      : msg.escalate
                        ? "border border-red-500/25 bg-red-500/10 text-industrial-100"
                        : "bg-industrial-900 text-industrial-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 border-t border-industrial-700 pt-2">
                      <p className="mono-label-muted">Sources</p>
                      {msg.sources.slice(0, 2).map((s, j) => (
                        <p key={j} className="mt-1 text-[11px] italic leading-relaxed text-industrial-400">
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
                <div className="rounded-lg bg-industrial-900 px-3.5 py-3">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-industrial-500"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Suggestion chips — only before the first user turn */}
            {messages.length === 1 && !sending && (
              <div className="space-y-2 pt-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => submit(suggestion)}
                    className="block w-full rounded-lg border border-industrial-800 px-3 py-2 text-left text-xs text-industrial-300 transition-colors hover:border-brand-600/40 hover:text-brand-400"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-industrial-800 bg-industrial-900 p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                placeholder="Ask a question..."
                disabled={sending}
                aria-label="Message"
                className="flex-1 rounded-lg border border-industrial-700 bg-industrial-950 px-3 py-2.5 text-sm text-white placeholder:text-industrial-600 focus:border-transparent focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => submit(input)}
                disabled={!input.trim() || sending}
                aria-label="Send message"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500 text-industrial-950 transition-all hover:bg-brand-400 disabled:bg-industrial-800 disabled:text-industrial-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-industrial-600">
              General guidance only. For emergencies call{" "}
              <a href="tel:+27711018493" className="text-brand-500 hover:text-brand-400">
                +27 71 101 8493
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </>
  );
}
